// Sign in BEFORE setup (2026-08-04).
//
// The fault these guard: the setup wizard covers the whole screen, so the app's
// only "Sign in" button sat underneath it. Someone who already had an account
// had to complete setup again to reach the button that would have restored it —
// which is exactly what a returning user on a new phone or a fresh browser hit.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { setState, getState } from './store5.js';
import OnboardingScreen from './screens/OnboardingScreen.jsx';
import AccountSheet from './screens/AccountSheet.jsx';

const LS = (k) => 'ppw5.' + k;

function Shell() {
  return (<>
    <AccountSheet />
    <OnboardingScreen />
  </>);
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  setState({ onboarded: false, obStep: 0, termsOk: false, signedIn: false, accountOpen: false });
});
afterEach(cleanup);

describe('a returning user can sign in without finishing setup', () => {
  // Wave 2: this line used to read "Already have an account? Sign in" — the only
  // account control on the screen, phrased so a NEW customer is told the path is
  // not theirs. Both visitors now get a door.
  it('offers both doors on the very first setup screen', () => {
    render(<Shell />);
    expect(screen.getByText(/create an account/i)).toBeTruthy();
    expect(screen.getByText(/i already have one/i)).toBeTruthy();
  });

  it('the sign-in form actually appears over the wizard when tapped', () => {
    render(<Shell />);
    fireEvent.click(screen.getByText(/i already have one/i));
    expect(getState().accountOpen).toBe(true);
    expect(getState().accountMode).toBe('signin');
    // the real form, not just a state flag: the one shared MembershipCard
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
  });

  it('the create-account door opens the same sheet in create mode', () => {
    render(<Shell />);
    fireEvent.click(screen.getByText(/create an account/i));
    expect(getState().accountMode).toBe('create');
    expect(screen.getByText(/create my account/i)).toBeTruthy();
    // no password box: a brand-new account has no password to type
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();
  });

  it('the account sheet is stacked ABOVE the wizard, or it renders invisibly', () => {
    setState({ accountOpen: true });
    const { container } = render(<Shell />);
    const layers = [...container.querySelectorAll('div[style*="z-index"]')]
      .map((el) => Number(el.style.zIndex))
      .filter(Number.isFinite);
    const sheet = Math.max(...layers.filter((z) => z >= 42));
    const wizard = 40; // OnboardingScreen's layer
    expect(sheet).toBeGreaterThan(wizard);
  });

  it('once signed in, setup skips the teaching screens and lands on consent', () => {
    render(<Shell />);
    expect(getState().obStep).toBe(0);
    act(() => { setState({ signedIn: true }); });   // sign-in lands while the wizard is open
    expect(getState().obStep).toBe(2);
    expect(screen.getByText(/I agree to the Terms/i)).toBeTruthy();
  });

  it('shows who is signed in, so the wizard is not a dead end', () => {
    localStorage.setItem(LS('authEmail'), 'buyer@example.com');
    setState({ signedIn: true });
    render(<Shell />);
    expect(screen.getByText(/signed in as/i).textContent).toMatch(/buyer@example\.com/);
    expect(screen.queryByText(/create an account/i)).toBeNull();
  });

  it('consent is still required — signing in does not waive the terms tick', () => {
    setState({ signedIn: true });
    render(<Shell />);
    expect(getState().termsOk).toBe(false);
    expect(getState().onboarded).toBe(false);
  });
});
