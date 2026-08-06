// profile.js — the account's own copy of "I have set this app up".
//
// THE PROBLEM IT EXISTS FOR: `onboarded` and `termsOk` are localStorage flags on
// one device (store5.js), so a returning customer in a fresh browser or on a new
// phone is walked through the whole setup wizard again and asked to re-accept
// terms they already accepted. Signing in restores their PAYMENT and nothing else.
//
// ⚠ THE BACKEND HALF DOES NOT EXIST YET. Checked on 2026-08-06: no branch of
// ppw-wellness-assistant contains /api/me/profile. This module is written to the
// agreed contract (backend ask A3) and is deliberately INERT until Agent 4 ships:
// every call fails soft and returns null, so a missing route behaves exactly like
// today rather than breaking sign-in or showing anyone an error. The moment the
// route appears, this lights up with no further app change.
//
//   GET  /api/me/profile → { onboarded: bool, termsAcceptedAt: iso|null, aiOptIn: bool }
//   POST /api/me/profile ← any subset of the same fields
//
// A brand-new account must answer 200 with all-false/null, NOT 404 — otherwise
// "no profile yet" is indistinguishable from "route not deployed".

import { apiRequest, isSignedIn } from './membership.js';

/** Normalise whatever comes back, so a half-shaped answer can't corrupt the app. */
function shape(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    onboarded: r.onboarded === true,
    termsAcceptedAt: typeof r.termsAcceptedAt === 'string' ? r.termsAcceptedAt : null,
    aiOptIn: r.aiOptIn === true,
  };
}

/**
 * The account's setup state, or null when it cannot be known — signed out, route
 * not deployed, or offline. null means "no opinion": callers must fall back to
 * the device's own flags rather than treating it as "not onboarded", or a
 * returning customer would be sent through setup a second time by our own bug.
 */
export async function fetchProfile() {
  if (!isSignedIn()) return null;
  try {
    return shape(await apiRequest('/api/me/profile', { auth: true }));
  } catch {
    return null; // 404 while A3 is unbuilt, 401, offline — all "no opinion"
  }
}

/** Push setup state to the account. Fire-and-forget: never blocks or surfaces. */
export async function saveProfile(patch) {
  if (!isSignedIn()) return false;
  const body = {};
  if (typeof patch?.onboarded === 'boolean') body.onboarded = patch.onboarded;
  if (typeof patch?.termsAcceptedAt === 'string') body.termsAcceptedAt = patch.termsAcceptedAt;
  if (typeof patch?.aiOptIn === 'boolean') body.aiOptIn = patch.aiOptIn;
  if (!Object.keys(body).length) return false;
  try {
    await apiRequest('/api/me/profile', { method: 'POST', body, auth: true });
    return true;
  } catch {
    return false;
  }
}
