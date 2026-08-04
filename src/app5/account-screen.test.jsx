// The Account screen (2026-08-04).
//
// Vic: "there is no set password, keep logged in, add passkey etc. It's not a
// professional normal app." The app had magic-link sign-in and NO account surface
// at all, so none of that furniture had anywhere to live. These guard the parts
// that are easy to quietly lose: who you are, the delete path, and — the one that
// can cost a customer real money — the warning that deleting the account does not
// stop the Gumroad subscription.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { setState, getState } from './store5.js';
import { isSignedIn, staySignedIn } from './membership.js';
import AccountSheet from './screens/AccountSheet.jsx';

const LS = (k) => 'ppw5.' + k;

function signedIn(email = 'buyer@example.com') {
  localStorage.setItem(LS('authToken'), 'jwt');
  localStorage.setItem(LS('authEmail'), email);
  setState({ accountOpen: true, signedIn: true, premium: false });
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  setState({ accountOpen: false, signedIn: false, premium: false });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('you can tell you are signed in', () => {
  it('names the account at the top of the screen', () => {
    signedIn();
    render(<AccountSheet />);
    expect(screen.getByText(/signed in as buyer@example\.com/i)).toBeTruthy();
  });

  it('signed out, it is a sign-in screen instead', () => {
    setState({ accountOpen: true, signedIn: false });
    render(<AccountSheet />);
    expect(screen.queryByText(/signed in as/i)).toBeNull();
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
  });

  it('says how signing in works rather than leaving it unexplained', () => {
    setState({ accountOpen: true, signedIn: false });
    render(<AccountSheet />);
    expect(screen.getByText(/passkeys are coming/i)).toBeTruthy();
  });
});

describe('keep me signed in', () => {
  it('is offered on the account screen and holds its setting', () => {
    signedIn();
    render(<AccountSheet />);
    const box = screen.getByLabelText(/keep me signed in on this device/i);
    expect(box.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(box);
    expect(staySignedIn()).toBe(false);
  });
});

describe('deleting the account', () => {
  it('never deletes on the first tap', () => {
    signedIn();
    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/delete my account/i));
    expect(screen.getByText(/delete this account\?/i)).toBeTruthy();
    expect(isSignedIn()).toBe(true); // nothing has happened yet
  });

  it('warns that deleting does NOT stop the subscription billing', () => {
    signedIn();
    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/delete my account/i));
    expect(screen.getByText(/does not cancel your subscription/i)).toBeTruthy();
    expect(screen.getByText(/cancel that on\s+Gumroad first/i)).toBeTruthy();
  });

  it('backing out leaves the account alone', () => {
    signedIn();
    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/delete my account/i));
    fireEvent.click(screen.getByText(/keep it/i));
    expect(screen.queryByText(/delete this account\?/i)).toBeNull();
    expect(isSignedIn()).toBe(true);
  });

  it('confirming calls DELETE /api/me/data and signs the user out', async () => {
    signedIn();
    const spy = vi.fn(async (url, opts) => {
      if (opts?.method === 'DELETE') return new Response(JSON.stringify({ deleted: true }), { status: 200 });
      return new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 });
    });
    vi.stubGlobal('fetch', spy);
    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/delete my account/i));
    fireEvent.click(screen.getByText(/delete for good/i));
    await waitFor(() => expect(isSignedIn()).toBe(false));
    const del = spy.mock.calls.find(([, o]) => o?.method === 'DELETE');
    expect(String(del[0])).toMatch(/\/api\/me\/data$/);
    expect(del[1].headers.Authorization).toBe('Bearer jwt');
    expect(getState().signedIn).toBe(false);
    expect(getState().premium).toBe(false);
  });

  it('a failed delete keeps the user signed in and says so', async () => {
    signedIn();
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      if (opts?.method === 'DELETE') return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
      return new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 });
    }));
    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/delete my account/i));
    fireEvent.click(screen.getByText(/delete for good/i));
    await waitFor(() => expect(screen.getByText(/server error|could not delete/i)).toBeTruthy());
    expect(isSignedIn()).toBe(true);
  });

  it('is not offered to someone who is not signed in', () => {
    setState({ accountOpen: true, signedIn: false });
    render(<AccountSheet />);
    expect(screen.queryByText(/delete my account/i)).toBeNull();
  });
});
