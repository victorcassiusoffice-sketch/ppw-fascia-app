// Email + password sign-in (2026-08-04, Vic's call).
//
// The backend has always had /api/auth/password/login and /api/auth/password/set.
// The app never called either, so the ONLY way in was an inbox round-trip — leave
// the app, find the mail, tap a link that opens in the default browser rather than
// the window you started in. Password is now the main door; the emailed link is
// the backup and the forgotten-password path.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  passwordSignIn, setPassword, extractLoginToken, PASSWORD_MIN,
  isSignedIn, readEmail, readToken, staySignedIn,
} from './membership.js';
import { setState } from './store5.js';
import MembershipCard from './screens/MembershipCard.jsx';

const LS = (k) => 'ppw5.' + k;

/** Answers the login POST, then the entitlement GET that follows it. */
function stubSignIn({ loginStatus = 200, loginBody = { token: 'jwt-pw' }, premium = false } = {}) {
  const spy = vi.fn(async (url) => {
    if (String(url).includes('/api/auth/password/login')) {
      return new Response(JSON.stringify(loginBody), { status: loginStatus });
    }
    if (String(url).includes('/api/auth/password/set')) {
      return new Response(JSON.stringify({ set: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ premium, entitlement: premium ? 'paid' : 'none', userId: 'usr_7' }), { status: 200 });
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  setState({ premium: false, signedIn: false });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('password sign-in', () => {
  it('signs in and keeps the session', async () => {
    stubSignIn();
    const ent = await passwordSignIn('buyer@example.com', 'hunter2!!');
    expect(isSignedIn()).toBe(true);
    expect(readToken()).toBe('jwt-pw');
    expect(readEmail()).toBe('buyer@example.com');
    expect(ent.entitlement).toBe('none');
  });

  it('unlocks Premium straight from the password door', async () => {
    stubSignIn({ premium: true });
    const ent = await passwordSignIn('buyer@example.com', 'hunter2!!');
    expect(ent.premium).toBe(true);
  });

  it('posts to the password route with a lowercased email', async () => {
    const spy = stubSignIn();
    await passwordSignIn('  Buyer@Example.COM ', 'hunter2!!');
    const [url, opts] = spy.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/auth\/password\/login$/);
    expect(JSON.parse(opts.body)).toEqual({ email: 'buyer@example.com', password: 'hunter2!!' });
  });

  it('checks the email before spending a request', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(passwordSignIn('nope', 'hunter2!!')).rejects.toThrow(/valid email/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a 401 explains BOTH causes, because the server will not say which', async () => {
    stubSignIn({ loginStatus: 401, loginBody: { error: 'Invalid email or password' } });
    await expect(passwordSignIn('buyer@example.com', 'wrong')).rejects.toThrow(/never set a password/i);
    expect(isSignedIn()).toBe(false);
  });

  it('leaves no half-session behind when sign-in fails', async () => {
    stubSignIn({ loginStatus: 401, loginBody: { error: 'Invalid email or password' } });
    await passwordSignIn('buyer@example.com', 'wrong').catch(() => {});
    expect(readToken()).toBeNull();
  });
});

describe('setting a password', () => {
  it('saves it on the signed-in account', async () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    const spy = stubSignIn();
    await setPassword('longenough1');
    const call = spy.mock.calls.find(([u]) => String(u).includes('/password/set'));
    expect(call).toBeTruthy();
    expect(call[1].headers.Authorization).toBe('Bearer jwt');
  });

  it('refuses a short password locally, matching the backend minimum', async () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(setPassword('a'.repeat(PASSWORD_MIN - 1))).rejects.toThrow(/at least/i);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('the emailed link and the "code" are the same string', () => {
  it('accepts a pasted whole link', () => {
    expect(extractLoginToken('https://app.ppwellness.co/?login_token=abc123XYZ'))
      .toBe('abc123XYZ');
  });

  it('accepts a bare code', () => {
    expect(extractLoginToken('  abc123XYZ ')).toBe('abc123XYZ');
  });

  it('handles a link with other params or a hash', () => {
    expect(extractLoginToken('https://app.ppwellness.co/?utm=x&login_token=tok_9#/app')).toBe('tok_9');
  });
});

describe('the sign-in card', () => {
  it('leads with email + password and keeps the emailed link as the backup', () => {
    render(<MembershipCard />);
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    expect(screen.getByText(/^sign in$/i)).toBeTruthy();
    expect(screen.getByText(/no password yet, or forgotten it/i)).toBeTruthy();
  });

  it('offers "keep me signed in", on by default', () => {
    render(<MembershipCard />);
    const box = screen.getByLabelText(/keep me signed in/i);
    expect(box.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(box);
    expect(staySignedIn()).toBe(false);
    expect(screen.getByLabelText(/keep me signed in/i).getAttribute('aria-checked')).toBe('false');
  });

  it('signs in from the form and shows the signed-in state', async () => {
    stubSignIn({ premium: true });
    render(<MembershipCard />);
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'hunter2!!' } });
    fireEvent.click(screen.getByText(/^sign in$/i));
    await waitFor(() => expect(isSignedIn()).toBe(true));
  });

  it('a signed-in member is offered a password', () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    setState({ signedIn: true, premium: true });
    render(<MembershipCard />);
    expect(screen.getByText(/set a password/i)).toBeTruthy();
  });
});
