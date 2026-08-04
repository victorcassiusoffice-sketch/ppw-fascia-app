// Staying signed in (2026-08-04).
//
// The fault these guard: the backend signs a 60-minute session and the app never
// renewed it, so a signed-in user was silently signed out about an hour in and
// met the paywall again. Nothing was mistyped and nothing expired on the user's
// side — the app simply let the session die.
//
// Two behaviours are load-bearing and easy to break later:
//   1. renew EARLY (with life left), never after the fact — a 401 is too late
//   2. a failed renew must not sign anyone out unless the server actually said 401

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sessionExpiresAt, ensureFreshSession, refreshSession,
  staySignedIn, setStaySignedIn, readToken, isSignedIn, signOut,
  SESSION_REFRESH_MARGIN_MS,
} from './membership.js';

const LS = (k) => 'ppw5.' + k;

/** A JWT shaped like the backend's: header.payload.signature, exp in seconds. */
function jwt(expMs) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'usr_1', exp: Math.floor(expMs / 1000) })}.sig`;
}

const MIN = 60 * 1000;

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('session expiry is read from the token itself', () => {
  it('decodes exp', () => {
    const at = Date.now() + 40 * MIN;
    localStorage.setItem(LS('authToken'), jwt(at));
    expect(sessionExpiresAt()).toBeGreaterThan(Date.now() + 39 * MIN);
    expect(sessionExpiresAt()).toBeLessThanOrEqual(at);
  });

  it('returns 0 for a token it cannot read, rather than guessing', () => {
    localStorage.setItem(LS('authToken'), 'not-a-jwt');
    expect(sessionExpiresAt()).toBe(0);
  });

  it('returns 0 when signed out', () => {
    expect(sessionExpiresAt()).toBe(0);
  });
});

describe('renewing early', () => {
  it('leaves a healthy session alone — no call at all', async () => {
    localStorage.setItem(LS('authToken'), jwt(Date.now() + 55 * MIN));
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await ensureFreshSession()).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('renews once the session is inside the safety margin, and keeps the new token', async () => {
    localStorage.setItem(LS('authToken'), jwt(Date.now() + (SESSION_REFRESH_MARGIN_MS - MIN)));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ token: jwt(Date.now() + 60 * MIN) }), { status: 200 },
    )));
    expect(await ensureFreshSession()).toBe(true);
    expect(sessionExpiresAt()).toBeGreaterThan(Date.now() + 50 * MIN);
  });

  it('sends the current session as a Bearer token when renewing', async () => {
    const t = jwt(Date.now() + MIN);
    localStorage.setItem(LS('authToken'), t);
    const spy = vi.fn(async () => new Response(JSON.stringify({ token: jwt(Date.now() + 60 * MIN) }), { status: 200 }));
    vi.stubGlobal('fetch', spy);
    await ensureFreshSession();
    expect(String(spy.mock.calls[0][0])).toMatch(/\/api\/auth\/refresh$/);
    expect(spy.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${t}`);
  });

  it('makes no call when nobody is signed in', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await ensureFreshSession()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('a failed renew does not throw people out', () => {
  it('offline keeps the session standing', async () => {
    localStorage.setItem(LS('authToken'), jwt(Date.now() + MIN));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await refreshSession()).toBe(false);
    expect(isSignedIn()).toBe(true);
  });

  it('a server error keeps the session standing', async () => {
    localStorage.setItem(LS('authToken'), jwt(Date.now() + MIN));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 })));
    expect(await refreshSession()).toBe(false);
    expect(isSignedIn()).toBe(true);
  });

  it('only a real 401 signs out', async () => {
    localStorage.setItem(LS('authToken'), jwt(Date.now() - MIN)); // already dead
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })));
    expect(await refreshSession()).toBe(false);
    expect(isSignedIn()).toBe(false);
  });
});

describe('keep me signed in', () => {
  it('defaults to on', () => {
    expect(staySignedIn()).toBe(true);
  });

  it('off puts the session in the tab, not on the device', async () => {
    setStaySignedIn(false);
    localStorage.setItem(LS('authToken'), 'old');   // pretend a device-stored session exists
    setStaySignedIn(false);                          // moves it
    expect(sessionStorage.getItem(LS('authToken'))).toBe('old');
    expect(localStorage.getItem(LS('authToken'))).toBeNull();
    expect(readToken()).toBe('old');
  });

  it('back on returns the session to the device', () => {
    setStaySignedIn(false);
    sessionStorage.setItem(LS('authToken'), 'tok');
    setStaySignedIn(true);
    expect(localStorage.getItem(LS('authToken'))).toBe('tok');
    expect(sessionStorage.getItem(LS('authToken'))).toBeNull();
  });

  it('signing out clears both stores — no session left hiding in the other', () => {
    localStorage.setItem(LS('authToken'), 'a');
    sessionStorage.setItem(LS('authToken'), 'b');
    signOut();
    expect(isSignedIn()).toBe(false);
    expect(readToken()).toBeNull();
  });
});
