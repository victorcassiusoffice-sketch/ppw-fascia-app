// Premium is now server-verified (Approach A, 2026-07-28).
//
// The two gaps this closes were both "the client decides", and both were free
// money for anyone who opened DevTools:
//   G3 — ppw5.premium='1' in localStorage unlocked everything at boot
//   G1 — createRoutine() had no store-level guard, only a hidden button
//
// These tests are the regression guard for exactly that.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cachedPremium, readEntitlementCache, signOut, GUMROAD_URL,
  fetchEntitlement, completeSignIn, requestSignIn, isSignedIn, OFFLINE_GRACE_MS,
} from './membership.js';

const LS = (k) => 'ppw5.' + k;

/** Exactly what a real verified read leaves behind. */
function seedVerified(overrides = {}) {
  localStorage.setItem(LS('authToken'), 'jwt.token.here');
  localStorage.setItem(LS('authEmail'), 'buyer@example.com');
  localStorage.setItem(LS('ent'), JSON.stringify({
    premium: true, entitlement: 'paid', currentPeriodEnd: null,
    userId: 'usr_1', checkedAt: Date.now(), verified: true, ...overrides,
  }));
}

beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('G3 — a localStorage flag can no longer buy Premium', () => {
  it('ppw5.premium=1 on its own unlocks nothing', () => {
    localStorage.setItem(LS('premium'), '1'); // the old whole-paywall bypass
    expect(cachedPremium()).toBe(false);
  });

  it('a hand-written entitlement cache is rejected without a session', () => {
    // Attacker copies the shape of a real cache but has no signed-in session.
    localStorage.setItem(LS('ent'), JSON.stringify({ premium: true, verified: true, checkedAt: Date.now() }));
    expect(cachedPremium()).toBe(false);
  });

  it('a cache not marked as server-verified is rejected', () => {
    seedVerified({ verified: false });
    expect(cachedPremium()).toBe(false);
  });

  it('accepts a genuine verified cache (so the app still works offline)', () => {
    seedVerified();
    expect(cachedPremium()).toBe(true);
  });

  it('expires a verified cache once it goes stale', () => {
    seedVerified({ checkedAt: Date.now() - OFFLINE_GRACE_MS - 1000 });
    expect(cachedPremium()).toBe(false);
  });

  it('locks once the paid period has passed, even if the cache is fresh', () => {
    seedVerified({ currentPeriodEnd: '2020-01-01T00:00:00Z' });
    expect(cachedPremium()).toBe(false);
  });

  it('keeps access while the paid period is still running', () => {
    seedVerified({ currentPeriodEnd: '2099-01-01T00:00:00Z' });
    expect(cachedPremium()).toBe(true);
  });

  it('signing out clears the grant', () => {
    seedVerified();
    expect(cachedPremium()).toBe(true);
    signOut();
    expect(cachedPremium()).toBe(false);
    expect(isSignedIn()).toBe(false);
  });
});

describe('entitlement fetch', () => {
  it('caches a verified server answer', async () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ premium: true, entitlement: 'paid', userId: 'usr_9', currentPeriodEnd: null }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const ent = await fetchEntitlement();
    expect(ent.premium).toBe(true);
    const c = readEntitlementCache();
    expect(c.verified).toBe(true);
    expect(c.userId).toBe('usr_9');
    expect(cachedPremium()).toBe(true);
  });

  it('sends the session as a Bearer token', async () => {
    localStorage.setItem(LS('authToken'), 'jwt-abc');
    const spy = vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 }));
    vi.stubGlobal('fetch', spy);
    await fetchEntitlement();
    expect(spy.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-abc');
  });

  it('a 401 signs the user out instead of leaving a zombie session', async () => {
    seedVerified();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })));
    const ent = await fetchEntitlement();
    expect(ent.premium).toBe(false);
    expect(isSignedIn()).toBe(false);
    expect(cachedPremium()).toBe(false);
  });

  it('a network failure throws rather than silently revoking a paying member', async () => {
    seedVerified();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(fetchEntitlement()).rejects.toThrow(/could not reach/i);
    expect(cachedPremium()).toBe(true); // cache still stands
  });
});

describe('sign-in', () => {
  it('rejects a malformed email before calling the server', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(requestSignIn('not-an-email')).rejects.toThrow(/valid email/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it('completes immediately when the backend returns a dev token', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/api/auth/login')) return new Response(JSON.stringify({ sent: true, devToken: 'dev-123' }), { status: 200 });
      if (String(url).endsWith('/api/auth/callback')) return new Response(JSON.stringify({ token: 'jwt-new', entitlement: 'none' }), { status: 200 });
      return new Response(JSON.stringify({ premium: false, entitlement: 'none', userId: 'usr_2' }), { status: 200 });
    }));
    const r = await requestSignIn('buyer@example.com');
    expect(r.completed).toBe(true);
    expect(isSignedIn()).toBe(true);
  });

  it('reports "check your email" when no dev token comes back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ sent: true }), { status: 200 })));
    expect((await requestSignIn('buyer@example.com')).completed).toBe(false);
    expect(isSignedIn()).toBe(false);
  });

  // Copy changed 2026-08-06 (Wave 2 item 5): "Request failed (401)" told a
  // customer nothing they could act on. Expired and already-used are the same
  // dead end with the same way out, so they share one plain sentence.
  it('rejects an expired one-time code, and says what to do about it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid or expired link' }), { status: 401 })));
    await expect(completeSignIn('stale-code', 'buyer@example.com'))
      .rejects.toThrow(/expired or was already used.*ask for a new one/is);
  });
});

// THE 22 AUG P0. The Gumroad profile was renamed victorix08 → ppwellness and the
// old subdomain 404s with no forwarding, so the live buy button pointed at a dead
// page while the app looked perfectly healthy. Nothing failed: no test, no build,
// no console error — the only symptom was a customer landing on a 404 with their
// card out.
//
// Nothing renders this constant any more (the storefront came out on 2026-10-08),
// but it is still the record of WHICH product the live subscription belongs to, so
// it still has to name a store that exists.
describe('the Gumroad product record points at a real store', () => {
  it('uses the current Gumroad handle, over https', () => {
    expect(GUMROAD_URL).toMatch(/^https:\/\/ppwellness\.gumroad\.com\//);
  });

  it('does not point at the retired handle, which 404s and does not redirect', () => {
    expect(GUMROAD_URL).not.toContain('victorix08');
  });
});

// ── REMOVED 2026-10-08: the `checkout link` block ───────────────────────────
// Four tests covering membership.js's checkoutUrl(): that it carried app_user_id
// so the webhook could match a sale to this account, that it still worked with no
// user id, that it returned null rather than shipping a dead button, and that it
// refused a non-https URL. The function went with the storefront, so there is
// nothing left for them to assert.
//
// The security rule they encoded is worth remembering if a checkout is ever built
// again: NEVER hand a URL to window.open without checking the protocol first —
// `javascript:` and plain `http:` both have to be refused at the builder, not at
// the button. `storefront-removed.test.jsx` now asserts the function is absent.
