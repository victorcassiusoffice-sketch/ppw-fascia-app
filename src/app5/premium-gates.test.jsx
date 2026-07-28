// Store-level premium gates (G1 + G3, 2026-07-28).
//
// The UI hides paid features from free users, but hiding a button is not a
// paywall. These prove the STORE refuses, which is what actually holds when a
// view is stale, a caller is new, or someone is poking at the console.

import { describe, it, expect, beforeEach, vi } from 'vitest';

async function freshStore() {
  vi.resetModules();
  return await import('./store5.js');
}

beforeEach(() => { localStorage.clear(); });

describe('G1 — createRoutine is gated in the store, not just the UI', () => {
  it('refuses for a free user and raises the upsell instead', async () => {
    const s = await freshStore();
    s.applyServerEntitlement({ premium: false });
    const before = s.getState().routines.length;

    const r = s.createRoutine('Sneaky routine', [{ id: 'x', title: 'thing' }]);

    expect(r).toBeNull();
    expect(s.getState().routines.length).toBe(before); // nothing persisted
    expect(s.getState().premiumUpsell).toMatch(/Premium/);
    expect(JSON.parse(localStorage.getItem('ppw5.routines') || 'null')).toBeNull();
  });

  it('allows it once the server says paid', async () => {
    const s = await freshStore();
    s.applyServerEntitlement({ premium: true });
    const r = s.createRoutine('Morning', [{ id: 'x', title: 'thing' }]);
    expect(r).not.toBeNull();
    expect(r.name).toBe('Morning');
    expect(s.getState().routines.length).toBe(1);
  });
});

describe('G3 — boot does not trust a raw localStorage flag', () => {
  it('ppw5.premium=1 alone leaves the app on the free tier', async () => {
    localStorage.setItem('ppw5.premium', '1'); // the old one-key bypass
    const s = await freshStore();
    expect(s.getState().premium).toBe(false);
    // and the paid features stay shut
    expect(s.createRoutine('nope', [])).toBeNull();
  });

  it('boots Premium from a genuine verified session', async () => {
    localStorage.setItem('ppw5.authToken', 'jwt');
    localStorage.setItem('ppw5.ent', JSON.stringify({
      premium: true, entitlement: 'paid', currentPeriodEnd: null,
      userId: 'usr_1', checkedAt: Date.now(), verified: true,
    }));
    const s = await freshStore();
    expect(s.getState().premium).toBe(true);
  });
});

describe('free-tier limits still apply to non-Premium users', () => {
  it('caps the deck at 10 stacks', async () => {
    const s = await freshStore();
    s.applyServerEntitlement({ premium: false });
    s.setState({ deckItems: Array.from({ length: 10 }, (_, i) => ({ id: 'i' + i, title: 't' + i })) });
    expect(s.overLimit()).toBe(true);
  });

  it('lifts the cap for Premium', async () => {
    const s = await freshStore();
    s.applyServerEntitlement({ premium: true });
    s.setState({ deckItems: Array.from({ length: 25 }, (_, i) => ({ id: 'i' + i, title: 't' + i })) });
    expect(s.overLimit()).toBe(false);
  });
});
