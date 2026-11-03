// The practitioner licence, on the client (2026-11-03, plan step 2).
//
// The server (ppw-wellness-assistant, /api/me/entitlement?app=lifestyle) answers
// `entitlement: 'practitioner', practitioner: true` for a licensed therapist and
// `'none', false` once revoked. This file proves the app only ever BELIEVES
// that answer — never a flag someone typed into localStorage — and that the
// Studio follows it both ways: open on a licence, down on a revoke, gone on
// sign-out, kept offline for the grace period and no longer.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cachedPractitioner, fetchEntitlement, readEntitlementCache, OFFLINE_GRACE_MS, signOut } from './membership.js';
import { applyServerEntitlement, signOutMembership, syncEntitlement, openStudio, getState, setState } from './store5.js';

const LS = (k) => 'ppw5.' + k;

/** Exactly what a real verified read for a licensed practitioner leaves behind. */
function licensedOnDisk(overrides = {}) {
  localStorage.setItem(LS('authToken'), 'jwt.token.here');
  localStorage.setItem(LS('authEmail'), 'therapist@example.com');
  localStorage.setItem(LS('ent'), JSON.stringify({
    premium: true, entitlement: 'practitioner', practitioner: true, currentPeriodEnd: null,
    userId: 'usr_t', checkedAt: Date.now(), verified: true, ...overrides,
  }));
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  setState({ practitioner: false, studioOpen: false, signedIn: false, premiumPaid: false, routines: [] });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('cachedPractitioner — the cache can only confirm what the server said', () => {
  it('is false with nothing on disk, and false for a client account', () => {
    expect(cachedPractitioner()).toBe(false);
    licensedOnDisk({ entitlement: 'paid', practitioner: false });
    expect(cachedPractitioner()).toBe(false);
  });
  it('is true for a verified, fresh, signed-in licence', () => {
    licensedOnDisk();
    expect(cachedPractitioner()).toBe(true);
  });
  it('is false once signed out, even with the cache still there', () => {
    licensedOnDisk();
    localStorage.removeItem(LS('authToken'));
    expect(cachedPractitioner()).toBe(false);
  });
  it('is false for a cache not written by a real server read', () => {
    licensedOnDisk({ verified: false });
    expect(cachedPractitioner()).toBe(false);
  });
  it('is false once the offline grace period is over', () => {
    licensedOnDisk({ checkedAt: Date.now() - OFFLINE_GRACE_MS - 1000 });
    expect(cachedPractitioner()).toBe(false);
  });
  it('is false once the licence period has lapsed', () => {
    licensedOnDisk({ currentPeriodEnd: new Date(Date.now() - 86400000).toISOString() });
    expect(cachedPractitioner()).toBe(false);
    licensedOnDisk({ currentPeriodEnd: new Date(Date.now() + 86400000).toISOString() });
    expect(cachedPractitioner()).toBe(true);
  });
});

describe('fetchEntitlement writes the licence from the server answer', () => {
  it('reads `practitioner: true`', async () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: true, entitlement: 'practitioner', practitioner: true, userId: 'usr_t' }), { status: 200 })));
    const ent = await fetchEntitlement();
    expect(ent.practitioner).toBe(true);
    expect(readEntitlementCache().practitioner).toBe(true);
    expect(cachedPractitioner()).toBe(true);
  });
  it('reads the entitlement string alone, for a backend that sends no boolean', async () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: true, entitlement: 'practitioner' }), { status: 200 })));
    expect((await fetchEntitlement()).practitioner).toBe(true);
  });
  it('a revoked licence reads false, and the cache follows', async () => {
    licensedOnDisk();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none', practitioner: false }), { status: 200 })));
    expect((await fetchEntitlement()).practitioner).toBe(false);
    expect(cachedPractitioner()).toBe(false);
  });
});

describe('the store follows the server both ways', () => {
  it('applyServerEntitlement opens the licence, and a revoke takes the Studio down with it', () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    applyServerEntitlement({ premium: true, practitioner: true });
    expect(getState().practitioner).toBe(true);
    expect(openStudio()).toBe(true);
    expect(getState().studioOpen).toBe(true);

    applyServerEntitlement({ premium: false, practitioner: false });
    expect(getState().practitioner).toBe(false);
    expect(getState().studioOpen).toBe(false);
    expect(openStudio()).toBe(false);
  });

  it('signing out drops the licence and closes the Studio', () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    applyServerEntitlement({ premium: true, practitioner: true });
    openStudio();
    signOutMembership();
    expect(getState().practitioner).toBe(false);
    expect(getState().studioOpen).toBe(false);
    expect(getState().signedIn).toBe(false);
  });

  it('syncEntitlement signed out is never a practitioner, and makes no request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    setState({ practitioner: true, studioOpen: true });
    await syncEntitlement();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getState().practitioner).toBe(false);
    expect(getState().studioOpen).toBe(false);
  });

  it('offline, a fresh verified licence keeps the Studio for the grace period', async () => {
    licensedOnDisk();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    setState({ practitioner: true, studioOpen: true, signedIn: true });
    await syncEntitlement();
    expect(getState().practitioner).toBe(true);
    expect(getState().studioOpen).toBe(true);
  });

  it('a hand-written flag opens nothing on a fresh boot; a real cache does', async () => {
    localStorage.setItem(LS('ent'), JSON.stringify({ practitioner: true, verified: true, checkedAt: Date.now() })); // no session
    vi.resetModules();
    let s = await import('./store5.js');
    expect(s.getState().practitioner).toBe(false);
    expect(s.openStudio()).toBe(false);

    licensedOnDisk();
    vi.resetModules();
    s = await import('./store5.js');
    expect(s.getState().practitioner).toBe(true);
    expect(s.openStudio()).toBe(true);
    vi.resetModules();
    signOut();
  });
});
