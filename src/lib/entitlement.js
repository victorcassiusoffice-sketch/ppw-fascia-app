// Pro/premium entitlement — client-side gate for Pro-only surfaces (the Wellness
// Assistant launch button).
//
// ⚠ DO NOT GATE A PAID FEATURE ON THIS (2026-07-28). This is a local flag; anyone
// can set ppw.entitlement='pro' in DevTools. It is safe only because the one thing
// it touches — the Assistant launch button — costs nothing to reveal (the Assistant
// service enforces its own paywall before spending a token).
//
// PAID features (routines, unlimited stacks, monetised protocol PDFs, the orb) use
// a DIFFERENT, server-verified seam: `S.premium` in app5/store5.js, hydrated by
// app5/membership.js from GET /api/me/entitlement. Gating anything monetised here
// instead would re-open gap G3 — the bypass that made the whole paywall free.
//
// This app has no backend/auth of its own (localStorage-only PWA), so "is this a
// Pro member?" is read from a local marker. That is a UI gate, NOT a security
// boundary: the real spend boundary lives in the separate Assistant service, which
// independently enforces owner / valid-guest / active-subscription before it ever
// calls the model. So even if a user forces this flag, opening the Assistant still
// lands them on its paywall — they cannot spend tokens for free.
//
// Default is NOT Pro. Combined with FEATURE_ASSISTANT_LAUNCH defaulting false, the
// launch button is invisible to everyone until go-live.

import { LS_KEYS } from '../config.js';

export function isProMember() {
  try {
    return localStorage.getItem(LS_KEYS.ENTITLEMENT) === 'pro';
  } catch {
    // Private mode / storage disabled → treat as free (fail closed).
    return false;
  }
}

// setProMember — the ONE seam for granting/revoking Pro. Called today by the
// manual Settings toggle (2026-07-06, no payment gateway wired yet — Vic's own
// on/off switch for testing). When a real Gumroad unlock ships (a redeemed
// license-key page, or a checkout-redirect landing route), it should call this
// exact same function with the verified result — nothing else in the app needs
// to change, since every Pro-gated surface already reads through isProMember().
export function setProMember(isPro) {
  try {
    if (isPro) localStorage.setItem(LS_KEYS.ENTITLEMENT, 'pro');
    else localStorage.removeItem(LS_KEYS.ENTITLEMENT);
  } catch {
    // Private mode / storage disabled — no-op; isProMember() already fails closed.
  }
}
