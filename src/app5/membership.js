// ─────────────────────────────────────────────────────────────────────────
// membership.js — the app's thin client for server-verified Premium.
//
// Until now Premium was a boolean in localStorage, which meant anyone with
// DevTools had it for free (gap G3). Now the SERVER decides: the app signs in,
// asks /api/me/entitlement, and unlocks from that answer. localStorage keeps a
// copy so the app still works on a plane, but a cached copy can only ever
// CONFIRM something the server already said — it can never grant on its own.
//
// Deliberately imports nothing from store5.js: store5 hydrates from here at boot,
// so a dependency the other way would be circular. UI calls these functions and
// hands the result to store5.applyServerEntitlement().
//
// Backend: the ppw-wellness-assistant API (own Vercel project + Neon DB). It owns
// accounts, Gumroad webhooks and the entitlement column. This file never sees a
// Gumroad token or a payment detail — the bundle ships to every user.
// ─────────────────────────────────────────────────────────────────────────

import { WELLNESS_ASSISTANT_URL } from '../config.js';

const LS = (k) => 'ppw5.' + k;

// ── GUMROAD PRODUCT SEAM ─────────────────────────────────────────────────────
// The live permalink for "PPW Lifestyle App — Premium", e.g.
// 'https://victorix08.gumroad.com/l/ppw-premium'. Stays null until Vic publishes
// the product and confirms the handle — an invented URL would send buyers to a
// 404 with their card out. While null the paywall shows an honest "not on sale
// yet" note instead of a dead button.
// NEVER put a seller token or licence key here — this bundle ships to every user.
export const GUMROAD_URL = null;

// Pricing shown in the paywall. Must match the Gumroad product exactly (plans spec
// §3.1): $9.99/mo · $47.94/6mo · $59.88/yr.
export const PREM_PRICE = '$9.99';
export const PREM_PRICE_NOTE = 'from $4.99/mo billed yearly';
export const PREM_PRICE_FULL = '$9.99/mo · $47.94/6 mo · $59.88/yr';

// Build-time override so a future custom domain doesn't need a code edit.
export const API_BASE = String(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PPW_API_BASE) ||
  WELLNESS_ASSISTANT_URL || ''
).replace(/\/+$/, '');

// How long a verified "paid" answer keeps unlocking with no network. Long enough
// to survive a holiday offline, short enough that a cancelled member doesn't keep
// Premium forever on a device that never phones home again.
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Local dev only. Vite replaces import.meta.env.DEV with `false` in the production
// build, so this whole branch is dead code on GitHub Pages — it is NOT a shippable
// bypass, unlike the old Settings toggle it replaces.
const isDev = () => {
  try { return import.meta.env?.DEV === true; } catch { return false; }
};

// ── storage ──────────────────────────────────────────────────────────────────
function read(key) { try { return localStorage.getItem(LS(key)); } catch { return null; } }
function write(key, v) { try { localStorage.setItem(LS(key), v); } catch {} }
function drop(key) { try { localStorage.removeItem(LS(key)); } catch {} }
function readJson(key) { try { return JSON.parse(read(key) || 'null'); } catch { return null; } }

/** The session JWT, or null when signed out. */
export function readToken() { return read('authToken'); }
export function readEmail() { return read('authEmail'); }
export function isSignedIn() { return !!readToken(); }

function writeSession(token, email) {
  if (token) write('authToken', token);
  if (email) write('authEmail', String(email).toLowerCase());
}

/** The last server answer: { premium, entitlement, currentPeriodEnd, userId, checkedAt }. */
export function readEntitlementCache() {
  const c = readJson('ent');
  return c && typeof c === 'object' ? c : null;
}

function writeEntitlementCache(c) {
  write('ent', JSON.stringify(c));
  // Legacy mirror. store5 no longer TRUSTS this key — it is kept only so older
  // code paths and Vic's muscle memory see a consistent value.
  write('premium', c.premium ? '1' : '0');
}

export function userId() { return readEntitlementCache()?.userId ?? null; }

/**
 * G3 — the boot-time answer to "is this user Premium?", offline-safe but not forgeable.
 *
 * Four things must all hold. Setting ppw5.premium='1' by hand satisfies none of
 * them, which is the entire point: that key alone no longer unlocks anything.
 */
export function cachedPremium() {
  if (isDev() && read('devPremium') === '1') return true; // stripped from prod builds
  const c = readEntitlementCache();
  if (!c || c.premium !== true) return false;
  if (!isSignedIn()) return false;                        // 1. still signed in
  if (!c.verified) return false;                          // 2. written by a real server read
  const checked = Number(c.checkedAt || 0);
  if (!checked || Date.now() - checked > OFFLINE_GRACE_MS) return false; // 3. not stale
  if (c.currentPeriodEnd) {                               // 4. period hasn't lapsed
    const end = new Date(c.currentPeriodEnd).getTime();
    if (Number.isFinite(end) && end < Date.now()) return false;
  }
  return true;
}

// ── API ──────────────────────────────────────────────────────────────────────
async function api(path, { method = 'GET', body, auth = false } = {}) {
  if (!API_BASE) throw new Error('Membership service is not configured.');
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = readToken();
    if (!t) throw new Error('Not signed in.');
    headers.Authorization = `Bearer ${t}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    const e = new Error('Could not reach the membership service. Check your connection.');
    e.offline = true;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error || `Request failed (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data;
}

/**
 * Step 1 of sign-in: ask for a magic link.
 *
 * ⚠ The backend does not send email yet (api/_lib/handlers.ts#authLogin: "the raw
 * token is emailed (email provider out of scope here)"). Outside production it
 * returns the token as `devToken` and we complete sign-in immediately; in
 * production the caller must fall back to the paste-a-code path until a mailer
 * is wired. Returns { completed } so the UI can say the truthful thing.
 */
export async function requestSignIn(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('Enter a valid email address.');
  const r = await api('/api/auth/login', { method: 'POST', body: { email: clean } });
  if (r?.devToken) {
    await completeSignIn(r.devToken, clean);
    return { completed: true };
  }
  return { completed: false };
}

/** Step 2: exchange the emailed/pasted one-time token for a session. */
export async function completeSignIn(loginToken, email) {
  const tok = String(loginToken || '').trim();
  if (!tok) throw new Error('Paste the sign-in code from your email.');
  const r = await api('/api/auth/callback', { method: 'POST', body: { token: tok } });
  if (!r?.token) throw new Error('That sign-in code is invalid or has expired.');
  writeSession(r.token, email || readEmail());
  return await fetchEntitlement();
}

/**
 * The authority on Premium. Reads the live server value, caches it, and returns
 * a normalised shape. A 401 means the session expired → sign out cleanly rather
 * than leaving a half-signed-in state that silently never unlocks.
 */
export async function fetchEntitlement() {
  try {
    const r = await api('/api/me/entitlement', { auth: true });
    const ent = {
      premium: r.premium === true,
      entitlement: r.entitlement ?? 'none',
      currentPeriodEnd: r.currentPeriodEnd ?? null,
      userId: r.userId ?? null,
      checkedAt: Date.now(),
      verified: true,
    };
    writeEntitlementCache(ent);
    return ent;
  } catch (e) {
    if (e.status === 401) { signOut(); return { premium: false, entitlement: 'none', signedOut: true }; }
    throw e; // offline / server error — the cache keeps the user unlocked meanwhile
  }
}

export function signOut() {
  drop('authToken');
  drop('authEmail');
  drop('ent');
  write('premium', '0');
}

/**
 * The checkout link. `app_user_id` rides along as a URL parameter; Gumroad passes
 * unknown params straight through to its ping as url_params[app_user_id], which is
 * how the backend matches a purchase to this account even when the buyer pays with
 * a different email. Verified against the Gumroad source (Purchase#payload_for_ping_notification).
 */
export function checkoutUrl(gumroadUrl, uid = userId()) {
  if (!gumroadUrl) return null;
  try {
    const u = new URL(gumroadUrl);
    if (u.protocol !== 'https:') return null; // never hand a non-https URL to window.open
    if (uid) u.searchParams.set('app_user_id', uid);
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Poll while a purchase settles. Gumroad pings the backend within seconds, but the
 * user is staring at the app, so we check every 5s for 2 minutes and stop the
 * moment Premium lands. Returns the entitlement that unlocked, or null on timeout.
 */
export async function pollForPremium({ intervalMs = 5000, timeoutMs = 120000, onTick } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ent = await fetchEntitlement();
      if (ent.premium) return ent;
      onTick?.(ent);
    } catch {
      // transient — keep waiting rather than failing the purchase flow
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/** Local-dev unlock so the app can be worked on without a deployed backend. */
export function setDevPremium(on) {
  if (!isDev()) return false;
  if (on) write('devPremium', '1'); else drop('devPremium');
  return true;
}
export function devPremiumAvailable() { return isDev(); }
