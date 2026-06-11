// Pro/premium entitlement — client-side gate for Pro-only surfaces (the Wellness
// Assistant launch button).
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
