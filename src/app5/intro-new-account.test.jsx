// A BRAND-NEW ACCOUNT KEEPS THE PITCH (2026-10-05).
//
// THE DEFECT. OnboardingScreen's returning-user effect fired on `S.signedIn`
// alone, and account CREATION sets the very same flag as a returning sign-in
// (applyServerEntitlement -> signedIn: isSignedIn()). So the primary accent CTA
// on the first screen the app shows — FirstRunChoice's "Create an account" —
// jumped the person straight to the consent tick, past the second pitch screen
// entirely: the six cards landing, the payoff screenshot of the real Stack
// screen, and the four info chips that carry the ONLY explanation anywhere in
// the app of what a Stack, a link-card, AUTO and sharing are. They then met
// WELCOME_STEPS saying "The six cards in the pitch were examples, and the screen
// beneath them was a picture of this one" — about a screen they never saw.
//
// A brand-new account is exactly who the pitch is for. The skip is for someone
// who has already read it on another phone.
//
// WHAT TELLS THEM APART, and why two signals rather than one:
//
//   S.accountMode === 'create'  — the DOOR. Written by openAccount('create')
//     before the sign-in even starts, so it is already in the store on the
//     render that brings `signedIn`, whatever order the writes land in.
//   S.justCreated               — the SERVER's verdict (isNewAccount), for a
//     magic link tapped out of an email where no door was pressed on this
//     device. Both call sites (MembershipCard, App5's ?login_token= handler)
//     write it in the same batch as `signedIn`, so it is normally visible on
//     the same render; the door is what makes the fix hold if it ever is not.
//
// Honest residual, pinned by the 'worst ordering' test below: if `justCreated`
// ever arrived a render LATER than `signedIn` AND no door was pressed (the
// email-link path), the sample would read 'returning' and the pitch would be
// skipped again. The door covers every in-app path.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';
import { setState, getState } from './store5.js';
import OnboardingScreen from './screens/OnboardingScreen.jsx';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // Element.scrollTo is called by the info-chip carousel; jsdom has no such method.
  Element.prototype.scrollTo = () => {};
  setState({
    onboarded: false, obStep: 0, termsOk: false, signedIn: false,
    firstRunChoice: true, accountOpen: false, accountMode: 'signin', justCreated: false,
  });
});
afterEach(cleanup);

const PITCH = /watch your stack build itself/i;
const CONSENT_TICK = /i agree to the terms/i;

describe('creating an account does not skip the pitch', () => {
  it('keeps the new person on the pitch after sign-up lands', () => {
    setState({ accountMode: 'create' });        // FirstRunChoice's accent CTA
    render(<OnboardingScreen />);
    expect(screen.getByText(PITCH)).toBeTruthy();

    act(() => { setState({ signedIn: true, justCreated: true }); });

    expect(getState().obStep).toBe(0);
    expect(screen.getByText(PITCH)).toBeTruthy();
    expect(screen.queryByText(CONSENT_TICK)).toBeNull();
  });

  it('holds even in the worst ordering — the session flag first, the server verdict a render later', () => {
    setState({ accountMode: 'create' });
    render(<OnboardingScreen />);

    // Two separate store writes, two separate renders: the pessimistic version
    // of what the sign-in call sites do. The door is what carries it here.
    act(() => { setState({ signedIn: true }); });
    act(() => { setState({ justCreated: true }); });

    expect(getState().obStep).toBe(0);
    expect(screen.getByText(PITCH)).toBeTruthy();
  });

  it('believes the server even when no door was pressed on this device', () => {
    // A magic link tapped in an email on a fresh install: accountMode is still
    // the default, and `justCreated` is the only thing that knows.
    render(<OnboardingScreen />);
    act(() => { setState({ signedIn: true, justCreated: true }); });

    expect(getState().obStep).toBe(0);
    expect(screen.getByText(PITCH)).toBeTruthy();
  });

  it('does not yank them off the pitch if they later open the sign-in sheet', () => {
    setState({ accountMode: 'create' });
    render(<OnboardingScreen />);
    act(() => { setState({ signedIn: true, justCreated: true }); });
    // closeAccount() clears justCreated; the footer's "I already have one"
    // flips accountMode. Neither is new information about who this person is.
    act(() => { setState({ justCreated: false, accountMode: 'signin' }); });

    expect(getState().obStep).toBe(0);
    expect(screen.getByText(PITCH)).toBeTruthy();
  });

  it('still lets the new person move on by hand', () => {
    setState({ accountMode: 'create' });
    render(<OnboardingScreen />);
    act(() => { setState({ signedIn: true, justCreated: true }); });
    // The step-0 primary CTA. Being kept on the pitch is not a dead end.
    act(() => { screen.getByText(/^build mine$/i).click(); });

    expect(getState().obStep).toBe(1);
    expect(screen.getByText(CONSENT_TICK)).toBeTruthy();
  });
});

describe('a returning account still skips the teaching screens', () => {
  it('lands straight on the consent tick', () => {
    setState({ accountMode: 'signin' });
    render(<OnboardingScreen />);
    act(() => { setState({ signedIn: true }); });

    expect(getState().obStep).toBe(1);
    expect(screen.getByText(CONSENT_TICK)).toBeTruthy();
  });
});
