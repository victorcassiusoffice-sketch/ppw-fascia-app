// Wave 2 — sign-up, first run, and the update prompt (2026-08-06).
//
// The fault these guard, proven on the live build 11ec509 in a clean browser:
// the ONLY account words a brand-new visitor saw were "Sign in", "Next", and
// "Already have an account? Sign in". No sign-up, no create-account, no
// get-started anywhere — and one of the two controls opened by asking whether
// you already had an account, which tells a new customer the path is not theirs
// while offering no path that is.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act, waitFor } from '@testing-library/react';

// The update bar's source of truth is the real swUpdate module; drive it directly.
const sw = { cb: null };
vi.mock('../lib/swUpdate.js', () => ({
  onUpdateState: (cb) => { sw.cb = cb; cb({ updateReady: false, version: 'test' }); return () => { sw.cb = null; }; },
  applyUpdate: vi.fn(),
}));
import { applyUpdate } from '../lib/swUpdate.js';

import { setState, getState, applyServerProfile } from './store5.js';
import { fetchProfile, saveProfile } from './profile.js';
import FirstRunChoice from './screens/FirstRunChoice.jsx';
import AccountSheet from './screens/AccountSheet.jsx';
import UpdateBar from './screens/UpdateBar.jsx';

const LS = (k) => 'ppw5.' + k;

function Shell() {
  return (<><AccountSheet /><FirstRunChoice /></>);
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  setState({
    onboarded: false, firstRunChoice: false, signedIn: false, premium: false,
    accountOpen: false, accountMode: 'signin', justCreated: false, termsOk: false, obStep: 0,
  });
});
afterEach(cleanup);

describe('a new visitor is offered a way in', () => {
  it('opens with a real choice, not two buttons that both say sign in', () => {
    render(<Shell />);
    expect(screen.getByText(/^create an account$/i)).toBeTruthy();
    expect(screen.getByText(/^i already have one$/i)).toBeTruthy();
  });

  it('"Create an account" opens the account sheet in create mode', () => {
    render(<Shell />);
    fireEvent.click(screen.getByText(/^create an account$/i));
    expect(getState().accountMode).toBe('create');
    expect(screen.getByText(/create my account/i)).toBeTruthy();
  });

  it('a new account is never asked for a password it cannot have', () => {
    render(<Shell />);
    fireEvent.click(screen.getByText(/^create an account$/i));
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();
  });

  it('"I already have one" opens the same sheet as sign-in', () => {
    render(<Shell />);
    fireEvent.click(screen.getByText(/^i already have one$/i));
    expect(getState().accountMode).toBe('signin');
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
  });

  // The app has always worked without an account and says so in its own copy.
  // A sign-up wall would trade one exclusion for another.
  it('lets someone look around without an account, and remembers that', () => {
    render(<Shell />);
    fireEvent.click(screen.getByText(/look around first/i));
    expect(getState().firstRunChoice).toBe(true);
    expect(localStorage.getItem(LS('frc'))).toBe('1');
    expect(screen.queryByText(/^create an account$/i)).toBeNull();
  });

  it('is never shown to someone who already set the app up', () => {
    setState({ onboarded: true });
    render(<Shell />);
    expect(screen.queryByText(/^create an account$/i)).toBeNull();
  });

  it('gets out of the way the moment someone signs in', () => {
    render(<Shell />);
    act(() => { setState({ signedIn: true }); });
    expect(getState().firstRunChoice).toBe(true);
  });
});

describe('saying an account was created', () => {
  it('says it only when the server confirms — never a guess', () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    setState({ accountOpen: true, signedIn: true, justCreated: true });
    render(<AccountSheet />);
    expect(screen.getByText(/your account is set up/i)).toBeTruthy();
    expect(screen.getByText(/sign straight in next time/i)).toBeTruthy();
  });

  it('stays quiet when the backend did not say so', () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    setState({ accountOpen: true, signedIn: true, justCreated: false });
    render(<AccountSheet />);
    expect(screen.queryByText(/your account is set up/i)).toBeNull();
  });

  it('clears the moment once the screen is closed', () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    setState({ accountOpen: true, signedIn: true, justCreated: true });
    render(<AccountSheet />);
    fireEvent.click(screen.getByLabelText(/close/i));
    expect(getState().justCreated).toBe(false);
  });
});

describe('the account owns the setup (A3 client half — backend not built yet)', () => {
  it('a missing endpoint is silence, not an error', async () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })));
    await expect(fetchProfile()).resolves.toBeNull();
    await expect(saveProfile({ onboarded: true })).resolves.toBe(false);
    vi.unstubAllGlobals();
  });

  it('makes no request at all when signed out', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await fetchProfile()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('restores setup from the account, so the wizard does not replay', () => {
    expect(applyServerProfile({ onboarded: true, termsAcceptedAt: '2026-08-01T00:00:00Z', aiOptIn: false })).toBe(true);
    expect(getState().onboarded).toBe(true);
    expect(getState().termsOk).toBe(true);
    expect(localStorage.getItem(LS('onboarded'))).toBe('1');
  });

  // The dangerous direction: a null/negative answer must NEVER un-set the device.
  // Doing so would push a returning customer back through setup — the exact fault
  // this is meant to cure.
  it('never un-does setup on a missing or negative answer', () => {
    setState({ onboarded: true, termsOk: true });
    applyServerProfile(null);
    expect(getState().onboarded).toBe(true);
    applyServerProfile({ onboarded: false, termsAcceptedAt: null, aiOptIn: false });
    expect(getState().onboarded).toBe(true);
    expect(getState().termsOk).toBe(true);
  });
});

describe('telling people a new version is ready', () => {
  // This prompt existed but has rendered NOWHERE since the 2026-07-06 cutover:
  // UpdateToast sits in the legacy branch of App.jsx, below the early return that
  // sends every route to App5. A cached build already cost a full day.
  it('stays hidden while there is nothing to update to', () => {
    render(<UpdateBar />);
    expect(screen.queryByText(/a new version is ready/i)).toBeNull();
  });

  it('appears when a new build is waiting', async () => {
    render(<UpdateBar />);
    act(() => sw.cb({ updateReady: true, version: 'test' }));
    await waitFor(() => expect(screen.getByText(/a new version is ready/i)).toBeTruthy());
  });

  it('applies the update only when the user asks for it', async () => {
    render(<UpdateBar />);
    act(() => sw.cb({ updateReady: true, version: 'test' }));
    await waitFor(() => screen.getByText(/^update$/i));
    expect(applyUpdate).not.toHaveBeenCalled();   // never forced mid-session
    fireEvent.click(screen.getByText(/^update$/i));
    expect(applyUpdate).toHaveBeenCalled();
  });

  it('lets someone carry on with the old build, and says what that costs', async () => {
    render(<UpdateBar />);
    act(() => sw.cb({ updateReady: true, version: 'test' }));
    await waitFor(() => screen.getByText(/^later$/i));
    expect(screen.getByText(/won.t have the latest fixes/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/^later$/i));
    expect(screen.queryByText(/a new version is ready/i)).toBeNull();
  });
});
