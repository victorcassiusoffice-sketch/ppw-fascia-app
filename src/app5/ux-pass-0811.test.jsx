// UX pass 2026-08-11 (Agent 9) — the three P1s and the P2s that can be proven
// without a device.
//
// F1 is the one that costs money: the app opened checkout in a popup, threw away
// window.open's return value, and flipped to "Waiting for your purchase to
// confirm…" whether or not the checkout had opened. On iPhone Safari — popups
// blocked by default — a customer with a card in hand got a spinner, no checkout
// anywhere, and no way forward.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { setState, getState, onlyExamplesLeft, clearExamples } from './store5.js';
import { GUMROAD_URL, passwordSetHere, signOut } from './membership.js';
import MembershipCard from './screens/MembershipCard.jsx';
import OnboardingScreen from './screens/OnboardingScreen.jsx';

const LS = (k) => 'ppw5.' + k;

function signedInFree() {
  localStorage.setItem(LS('authToken'), 'jwt');
  localStorage.setItem(LS('authEmail'), 'buyer@example.com');
  setState({ signedIn: true, premium: false, accountOpen: true });
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  setState({ signedIn: false, premium: false, accountOpen: false, aiOpen: false, onboarded: false, obStep: 0, termsOk: false });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('F1 — public checkout is closed', () => {
  it('does not offer a store, a price, or a buy button', () => {
    signedInFree();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    render(<MembershipCard />);
    expect(screen.queryByText(/go premium/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /checkout/i })).toBeNull();
    expect(screen.queryByText(/\$\d/)).toBeNull();
    const link = screen.getByRole('link', { name: /victor@ppwellness.co/i });
    expect(link.getAttribute('href') || '').toMatch(/^mailto:victor@ppwellness\.co/);
    expect(document.body.innerHTML).not.toMatch(/gumroad|stripe/i);
    expect(GUMROAD_URL).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });
});

describe('F2 — one layer at a time', () => {
  it('opening the AI flow closes the account sheet underneath it', async () => {
    const { openAiBridge } = await import('./store5.js');
    setState({ accountOpen: true });
    openAiBridge();
    expect(getState().accountOpen).toBe(false);
    expect(getState().aiOpen).toBe(true);
  });

  it('finishing onboarding leaves nothing open behind', async () => {
    const { finishOnboarding } = await import('./store5.js');
    setState({ accountOpen: true, termsOk: true, premiumUpsell: 'something' });
    finishOnboarding();
    expect(getState().accountOpen).toBe(false);
    expect(getState().premiumUpsell).toBeNull();
    expect(getState().onboarded).toBe(true);
  });
});

describe('F3 — the AI path is no longer a one-way door', () => {
  it('choosing AI does NOT destroy the choice screen', () => {
    setState({ termsOk: true, obStep: 1 });
    render(<OnboardingScreen />);
    fireEvent.click(screen.getByText(/start by talking to my ai/i));
    expect(getState().aiOpen).toBe(true);
    // The wizard is still alive underneath, so closing the AI sheet returns here.
    expect(getState().onboarded).toBe(false);
  });

  it('the empty-day option is still reachable after picking AI', () => {
    setState({ termsOk: true, obStep: 1 });
    const { rerender } = render(<OnboardingScreen />);
    fireEvent.click(screen.getByText(/start by talking to my ai/i));
    rerender(<OnboardingScreen />);
    expect(screen.getByText(/start with an empty day/i)).toBeTruthy();
  });
});

describe('F6 — the demo slots say they are ours', () => {
  it('every starter item is marked as an example', () => {
    localStorage.clear();
    const items = getState().deckItems;
    if (items.length) expect(items.every((it) => it.example)).toBe(true);
  });

  it('knows when the day is still nothing but examples, and can clear them', () => {
    setState({ deckItems: [{ id: 'a', title: 'x', example: true }, { id: 'b', title: 'y', example: true }] });
    expect(onlyExamplesLeft()).toBe(true);
    clearExamples();
    expect(getState().deckItems).toEqual([]);
  });

  it('leaves the user’s own items alone', () => {
    setState({ deckItems: [{ id: 'a', title: 'x', example: true }, { id: 'mine', title: 'mine' }] });
    expect(onlyExamplesLeft()).toBe(false);
    clearExamples();
    expect(getState().deckItems.map((i) => i.id)).toEqual(['mine']);
  });
});

describe('F8 — the password confirmation stops forgetting itself', () => {
  it('survives a re-render, because it is not held in component state', () => {
    localStorage.setItem(LS('pwSet'), '1');
    expect(passwordSetHere()).toBe(true);
    signedInFree();
    render(<MembershipCard />);
    expect(screen.getByText(/password saved · change it/i)).toBeTruthy();
  });

  it('does not follow the account to the next person on this device', () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    localStorage.setItem(LS('pwSet'), '1');
    signOut();
    expect(passwordSetHere()).toBe(false);
  });
});

describe('F9 — the terms gate exposes its state', () => {
  it('a screen reader can tell agreed from not agreed', () => {
    setState({ obStep: 1, termsOk: false });
    render(<OnboardingScreen />);
    const box = screen.getByRole('checkbox', { name: /terms and health disclaimer/i });
    expect(box.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(box);
    expect(getState().termsOk).toBe(true);
  });
});
