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
// accounts and the entitlement column. This file never sees a payment token —
// the bundle ships to every user. Public checkout is closed; see licensing.js.
// ─────────────────────────────────────────────────────────────────────────

import { WELLNESS_ASSISTANT_URL } from '../config.js';
import { isOwnerAdminEmail, LICENSE_ONLY_MESSAGE, PUBLIC_CHECKOUT_ENABLED } from './licensing.js';
// passcode.js deliberately imports nothing from here, so this stays one-way.
import {
  isEnabled as passcodeEnabled, passcodeToken, updateSealedToken,
  disablePasscode, enablePasscode,
} from './passcode.js';

const LS = (k) => 'ppw5.' + k;

// Which app this is, in the backend's app registry (api/_lib/apps.ts). Drives the
// magic-link email's branding and where that link lands.
export const APP_ID = 'lifestyle';

// ── PUBLIC CHECKOUT ──────────────────────────────────────────────────────────
// Retired. The app is licensed per company. This stays null so no screen can
// build a store link by accident. Do not point it at Gumroad, Stripe, or any
// other public checkout. PUBLIC_CHECKOUT_ENABLED in licensing.js is the flag.
export const GUMROAD_URL = PUBLIC_CHECKOUT_ENABLED ? '' : null;

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

// Tab-scoped twin of the above, for "don't keep me signed in".
function sRead(key) { try { return sessionStorage.getItem(LS(key)); } catch { return null; } }
function sWrite(key, v) { try { sessionStorage.setItem(LS(key), v); } catch {} }
function sDrop(key) { try { sessionStorage.removeItem(LS(key)); } catch {} }

/**
 * "Keep me signed in" decides WHERE the session token is kept, not how long the
 * server honours it. On (the default) → localStorage, so the session survives
 * closing the app. Off → sessionStorage, so it dies with the tab, which is what
 * a borrowed or shared device needs.
 *
 * ⚠ The ceiling is the server's, not ours: the backend signs a 60-minute session
 * (SESSION_TTL, api/_lib/auth.ts). Even with this on, a session left untouched
 * for longer than that is gone until the backend issues longer-lived sessions.
 */
export function staySignedIn() { return read('stayIn') !== '0'; }

export function setStaySignedIn(on) {
  write('stayIn', on ? '1' : '0');
  // Move any live session to the store the new choice implies, so the setting
  // takes effect now rather than at the next sign-in.
  const tok = readToken();
  if (!tok) return;
  if (on) { write('authToken', tok); sDrop('authToken'); }
  else { sWrite('authToken', tok); drop('authToken'); }
}

/**
 * The session JWT, or null when signed out. Tab-scoped copy wins.
 *
 * With a passcode set, the token is NOT on disk at all — only ciphertext is, and
 * the plaintext lives in passcode.js's memory while unlocked. Everything in the
 * app already reads the session through this one function, so that swap needed no
 * changes anywhere else. Locked reads as "no session", which is correct: without
 * the passcode there genuinely isn't one.
 */
export function readToken() {
  if (passcodeEnabled()) return passcodeToken();
  return sRead('authToken') || read('authToken');
}
export function readEmail() { return read('authEmail'); }
export function isSignedIn() { return !!readToken(); }

function writeSession(token, email) {
  if (token) {
    if (passcodeEnabled()) {
      // Re-seal instead of writing plaintext. Load-bearing: sessions rotate in
      // the background (ensureFreshSession), so without this the vault would
      // still hold the token from the day the passcode was set, and the next
      // unlock would hand back a dead session.
      updateSealedToken(token);
      drop('authToken'); sDrop('authToken');
    } else if (staySignedIn()) {
      // Exactly one store holds the token, so signing out of one can't leave the
      // other quietly holding a live session.
      write('authToken', token); sDrop('authToken');
    } else {
      sWrite('authToken', token); drop('authToken');
    }
  }
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
 * True when Premium is coming from the ADMIN_EMAILS allow-list rather than from a
 * payment — i.e. staff. Read from the entitlement response's own `role`, which the
 * backend already returns; no backend change was needed for this.
 */
export function isAdminGrant() {
  const c = readEntitlementCache();
  return !!c && c.role === 'admin' && c.entitlement !== 'paid';
}

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

/** The same fetch plumbing, for sibling modules (profile.js). Not for UI code. */
export const apiRequest = api;

// ── new account vs returning ─────────────────────────────────────────────────
// The backend creates an account silently the first time it sees an email
// (upsertUserByEmail), so a brand-new customer is never told an account was made
// for them. The contract with the backend (Wave 2 item 7, Agent 4's half) is a
// single boolean `isNewAccount` on the sign-in response — safe to return, because
// it only ever reaches someone who has just proved control of that inbox.
//
// Stashed rather than returned, because the sign-in that matters most happens in
// App5's ?login_token= handler, far from the screen that has to say the words.
// Absent flag = we simply don't claim an account was created. Never guessed.
function noteNewAccount(r) {
  if (r && r.isNewAccount === true) write('newAccount', '1');
}

/** True once, for the sign-in that created the account. Clears itself. */
export function consumeNewAccount() {
  const was = read('newAccount') === '1';
  if (was) drop('newAccount');
  return was;
}

/**
 * Step 1 of sign-in: ask for a magic link.
 *
 * The mailer IS live (Resend, proven end-to-end 2026-08-04 — an earlier comment
 * here said it wasn't, which stopped being true on 2026-07-29). The email carries
 * a tap-through button and, since the backend's A2 change, a labelled copyable
 * code beside it; both are the same `login_token`, and it now lasts 60 minutes
 * rather than 15.
 *
 * Outside production the backend returns the token as `devToken` and we complete
 * sign-in immediately. Returns { completed } so the UI can say the truthful thing.
 */
export async function requestSignIn(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('Enter a valid email address.');
  // `app` tells the backend which product this is, so the email is branded
  // "PPWellness Lifestyle App" and its magic link returns HERE rather than to
  // the Assistant. The backend resolves it through its own registry — it never
  // accepts a return URL from us.
  const r = await api('/api/auth/login', { method: 'POST', body: { email: clean, app: APP_ID } });
  if (r?.devToken) {
    await completeSignIn(r.devToken, clean);
    return { completed: true };
  }
  return { completed: false };
}

/**
 * The emailed link and the "code" the app asks for are the SAME string: the
 * email carries `…/?login_token=<32 chars>` and the box wants the part after the
 * `=`. Nothing said so, so people pasted the whole link and were told it was
 * invalid. Take either.
 */
export function extractLoginToken(pasted) {
  const raw = String(pasted || '').trim();
  const m = /[?&#]login_token=([^&\s#]+)/.exec(raw);
  if (!m) return raw;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

/** Step 2: exchange the emailed/pasted one-time token for a session. */
export async function completeSignIn(loginToken, email) {
  const tok = extractLoginToken(loginToken);
  if (!tok) throw new Error('Paste the sign-in link or code from your email.');
  let r;
  try {
    r = await api('/api/auth/callback', { method: 'POST', body: { token: tok } });
  } catch (e) {
    // A dead token is the single most common failure of this path, and "Request
    // failed (401)" tells a customer nothing about what to do next. Single-use
    // and time-limited both land here; the way forward is the same for both.
    if (e.status === 401 || e.status === 400) {
      const err = new Error('That link has expired or was already used. Ask for a new one — links last an hour and work once.');
      err.status = e.status;
      err.expiredLink = true;
      throw err;
    }
    throw e;
  }
  if (!r?.token) throw new Error('That link has expired or was already used. Ask for a new one.');
  noteNewAccount(r);
  writeSession(r.token, email || readEmail());
  await closeUnlicensedSignup(r, email || readEmail());
  return await fetchEntitlement();
}

/**
 * Public registration is closed. The membership API still creates a user the
 * first time it sees an email. When it tells us that just happened, tear the
 * account down — except the owner allow-list, who may sign in on a fresh
 * install for a demo. Existing staff never hit this: isNewAccount is absent.
 */
async function closeUnlicensedSignup(authResponse, email) {
  if (!authResponse || authResponse.isNewAccount !== true) return;
  if (isOwnerAdminEmail(email)) return;
  drop('newAccount');
  try {
    await deleteAccount();
  } catch {
    signOut();
  }
  const err = new Error(LICENSE_ONLY_MESSAGE);
  err.code = 'unlicensed-signup';
  throw err;
}

/**
 * The authority on Premium. Reads the live server value, caches it, and returns
 * a normalised shape. A 401 means the session expired → sign out cleanly rather
 * than leaving a half-signed-in state that silently never unlocks.
 */
export async function fetchEntitlement() {
  try {
    // ?app= is REQUIRED as of 2026-07-30. The backend serves several PPW apps
    // from one set of accounts and grants access per app, so an entitlement read
    // that doesn't name its app gets answered for the DEFAULT app — which would
    // report a paying Lifestyle subscriber as not premium. APP_ID is the same
    // constant sent at sign-in, so the two can never disagree.
    const r = await api(`/api/me/entitlement?app=${encodeURIComponent(APP_ID)}`, { auth: true });
    const ent = {
      premium: r.premium === true,
      entitlement: r.entitlement ?? 'none',
      // The server computes premium as `role === "admin" || entitlement === "paid"
      // || entitlement === "guest"`, so an address on ADMIN_EMAILS is Premium with
      // no purchase behind it. Vic's own account is one, which made his view look
      // like a billing fault. Keeping the role lets the UI say WHY.
      role: r.role ?? null,
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

// ── email + password ─────────────────────────────────────────────────────────
// The backend has had these two routes all along (api/_lib/handlers.ts:
// /api/auth/password/login and /api/auth/password/set — both answered live when
// probed on 2026-08-04). The app never called either, so the only way in was an
// inbox round-trip: leave the app, find the mail, tap a link that opens in the
// DEFAULT browser rather than the window you started in. Password is now the
// main door; the emailed link stays as the backup and the forgotten-password path.

/** The backend's own minimum (setOwnPassword rejects shorter with a 400). */
export const PASSWORD_MIN = 8;

export async function passwordSignIn(email, password) {
  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('Enter a valid email address.');
  if (!password) throw new Error('Enter your password.');
  let r;
  try {
    r = await api('/api/auth/password/login', { method: 'POST', body: { email: clean, password } });
  } catch (e) {
    // The server answers 401 for a wrong password AND for an account that has
    // never set one, and deliberately does not say which (it would confirm
    // whether an email is registered). So the copy has to cover both cases.
    if (e.status === 401) {
      const err = new Error('That email and password don’t match. If you have never set a password, use the email link instead.');
      err.status = 401;
      throw err;
    }
    throw e;
  }
  if (!r?.token) throw new Error('Sign-in failed — try the email link instead.');
  noteNewAccount(r);
  writeSession(r.token, clean);
  await closeUnlicensedSignup(r, clean);
  return await fetchEntitlement();
}

/**
 * Whether a password was set from THIS device.
 *
 * F8 (UX pass 2026-08-11): the "Password saved · change it" label reverted to
 * "Set a password" as soon as the card re-rendered into another state, because
 * the confirmation lived only in component state and died with the component.
 * Telling someone their password is unset moments after they set it is the kind
 * of small lie that makes people stop trusting the rest of the screen.
 *
 * Device-local on purpose, and NOT a claim about the account: the backend still
 * exposes no `hasPassword` (that ask is with Agent 4). It records what we did,
 * which is the only thing we can honestly know.
 */
export function passwordSetHere() { return read('pwSet') === '1'; }

/** Set (or change) the password on the signed-in account. */
export async function setPassword(password) {
  const pw = String(password || '');
  if (pw.length < PASSWORD_MIN) throw new Error(`Use at least ${PASSWORD_MIN} characters.`);
  await api('/api/auth/password/set', { method: 'POST', body: { password: pw }, auth: true });
  write('pwSet', '1');
  return true;
}

// ── staying signed in ────────────────────────────────────────────────────────
// The backend signs a 60-minute session (SESSION_TTL in api/_lib/auth.ts) and
// nothing in the app ever renewed it. So a signed-in user was quietly signed out
// about an hour in: the next entitlement read came back 401 and fetchEntitlement
// called signOut(). Nobody typed anything wrong — the session simply died while
// the app was open, and the paywall reappeared.
//
// POST /api/auth/refresh mints a fresh token from a still-valid one, so keeping
// a session alive costs one cheap call. It cannot resurrect an EXPIRED session —
// surviving a long close still needs a longer server-side session.

/** Epoch ms this session expires, or 0 if unknown. Reads the JWT's own `exp`. */
export function sessionExpiresAt() {
  const t = readToken();
  if (!t) return 0;
  const parts = String(t).split('.');
  if (parts.length !== 3) return 0;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) ? exp * 1000 : 0;
  } catch {
    return 0; // not our shape — treat as unknown, ensureFreshSession will just refresh
  }
}

/** Renew with this much life left, so a slow network never races the expiry. */
export const SESSION_REFRESH_MARGIN_MS = 20 * 60 * 1000;

/** Trade a still-valid session for a fresh one. True if the session was renewed. */
export async function refreshSession() {
  if (!isSignedIn()) return false;
  try {
    const r = await api('/api/auth/refresh', { method: 'POST', body: {}, auth: true });
    if (!r?.token) return false;
    writeSession(r.token, readEmail());
    return true;
  } catch (e) {
    // 401 = already dead; anything else (offline, 500) leaves the session alone
    // rather than signing a paying member out over a dropped request.
    if (e.status === 401) signOut();
    return false;
  }
}

/** Renew only when the session is close to expiring. Safe to call on every resume. */
export async function ensureFreshSession() {
  if (!isSignedIn()) return false;
  const exp = sessionExpiresAt();
  if (exp && exp - Date.now() > SESSION_REFRESH_MARGIN_MS) return true;
  return await refreshSession();
}

/**
 * Turn the passcode on: seal the live session and delete every plaintext copy.
 *
 * Lives here rather than in passcode.js because only this module knows where the
 * token is kept — and the whole value of the feature depends on the plaintext
 * being GONE afterwards, not merely shadowed.
 */
export async function setSessionPasscode(passcode) {
  const t = readToken();
  if (!t) throw new Error('Sign in first, then set a passcode.');
  await enablePasscode(passcode, t);
  drop('authToken');
  sDrop('authToken');
  return true;
}

/** Turn it off: hand the session back to ordinary storage. */
export function clearSessionPasscode() {
  const t = disablePasscode();
  if (t) writeSession(t, null);
  return true;
}

/**
 * Permanently delete the account.
 *
 * The backend runs `DELETE FROM users WHERE id=$1`, which cascades to everything
 * that row owns — entitlement, subscription record, stored messages. Read from
 * api/_lib/handlers.ts, not assumed.
 *
 * Deleting the app account does not cancel a company invoice, or any older
 * subscription that was billed outside this app.
 */
export async function deleteAccount() {
  await api('/api/me/data', { method: 'DELETE', auth: true });
  signOut();
  return true;
}

export function signOut() {
  drop('authToken');
  sDrop('authToken');
  drop('authEmail');
  drop('ent');
  write('premium', '0');
  // Belongs to the account that just left, not to the device — otherwise the next
  // person to sign in here is told their password is already set.
  drop('pwSet');
  // The passcode vault holds the session itself. Leaving it behind would mean a
  // later unlock resurrected a session the user had explicitly ended.
  if (passcodeEnabled()) disablePasscode();
}

/**
 * Dormant. Public checkout is off, and nothing in the UI calls this.
 * Kept so a non-https URL can never be handed to window.open if a caller
 * passes one in. Returns null for anything that is not https.
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

/** Local-dev unlock so the app can be worked on without a deployed backend. */
export function setDevPremium(on) {
  if (!isDev()) return false;
  if (on) write('devPremium', '1'); else drop('devPremium');
  return true;
}
export function devPremiumAvailable() { return isDev(); }
