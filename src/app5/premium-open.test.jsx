// EVERYTHING UNLOCKED — the B2B pivot (Vic, 2026-10-05).
//
// The app is no longer sold to the public a seat at a time; it is sold to
// businesses who embed it or run it as a platform. So there is no paid tier to
// enforce, and a visitor must meet the whole product.
//
// The premium machinery was NOT deleted — it is switched off by one constant,
// `PREMIUM_OPEN` in membership.js. These tests cover the open build: what a
// stranger with no account can do, and the fact that nothing anywhere offers to
// sell them something they already have. Its twin, premium-gates.test.jsx, runs
// the SAME store with the constant forced false and proves every gate still
// bites — so the switch is a switch, not a tombstone.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'motion/react';
import { setState, getState } from './store5.js';
import MembershipCard from './screens/MembershipCard.jsx';
import GateNotice from './screens/GateNotice.jsx';
// Statically imported ON PURPOSE: these screens must share the same store5
// instance as the `setState` above. A dynamic import after vi.resetModules()
// binds its own copy of the store, and a screen reading state nobody wrote
// renders the default — which would make these assertions pass on any code.
import LibraryScreen from './screens/LibraryScreen.jsx';

const LS = (k) => 'ppw5.' + k;
const deck = (n) => Array.from({ length: n }, (_, i) => ({ id: 'i' + i, title: 't' + i }));

// A store booted from a clean module registry, so a hydration claim is about
// what a brand-new install actually gets.
async function freshStore() {
  vi.resetModules();
  return await import('./store5.js');
}

// The same store with the switch forced back to false: the paid build. Used
// here only to prove a real subscriber survives the flip.
async function closedStore() {
  vi.doMock('./membership.js', async (importOriginal) => ({
    ...(await importOriginal()),
    PREMIUM_OPEN: false,
  }));
  vi.resetModules();
  return await import('./store5.js');
}

// What the app has on disk after a genuine, server-verified purchase.
function paidSessionOnDisk() {
  localStorage.setItem(LS('authToken'), 'jwt');
  localStorage.setItem(LS('authEmail'), 'buyer@example.com');
  localStorage.setItem(LS('ent'), JSON.stringify({
    premium: true, entitlement: 'paid', currentPeriodEnd: null,
    userId: 'usr_1', checkedAt: Date.now(), verified: true,
  }));
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  setState({ premium: true, premiumPaid: false, premiumUpsell: null, capRefusal: null, signedIn: false, routines: [], deckItems: [] });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.doUnmock('./membership.js'); vi.resetModules(); });

describe('a stranger with no account gets the whole app', () => {
  it('boots unlocked, with nothing bought and nobody signed in', async () => {
    const s = await freshStore();
    expect(s.getState().signedIn).toBe(false);
    expect(s.getState().premium).toBe(true);
    // The server's own answer is kept separately and is still an honest "no".
    expect(s.getState().premiumPaid).toBe(false);
  });

  it('saves a routine without an account and raises no paywall', async () => {
    const s = await freshStore();
    const r = s.createRoutine('Morning', [{ id: 'x', title: 'thing' }]);
    expect(r).not.toBeNull();
    expect(s.getState().routines.length).toBe(1);
    expect(s.getState().premiumUpsell).toBeNull();
  });

  it('renames and schedules that routine too', async () => {
    const s = await freshStore();
    const r = s.createRoutine('Morning', [{ id: 'x', title: 'thing', time: '07:00' }]);
    expect(s.updateRoutine(r.id, { name: 'Evening' })).toBe(true);
    const out = s.applyRoutineToDate(r.id, s.todayKey());
    expect(out.ok).toBe(true);
    expect(out.upsell).toBeUndefined();
    expect(s.getState().premiumUpsell).toBeNull();
  });

  it('keeps taking stacks far past the old free limit', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP * 4) });
    expect(s.overLimit()).toBe(false);
    expect(s.addToStack({ title: 'one more' })).toBe(true);
    expect(s.addNote).toBeTypeOf('function');
    expect(s.getState().premiumUpsell).toBeNull();
  });

  it('imports a whole 20-stack programme in one go', async () => {
    const s = await freshStore();
    const out = s.addItemsToToday(deck(20).map((d) => ({ ...d, repeat: 'once' })));
    expect(out.ok).toBe(true);
    expect(out.count).toBe(20);
    expect(s.getState().premiumUpsell).toBeNull();
    expect(s.getState().capRefusal).toBeNull();
  });

  it('accepts an AI-built plan that would have been refused', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP) });
    const out = s.addItemsToPlan([{ title: 'breath work', _day: 0 }]);
    expect(out.ok).toBe(true);
    expect(s.getState().premiumUpsell).toBeNull();
  });

  it('opens a pasted link and a note at any deck size', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP + 5), noteText: 'stand up straight' });
    expect(s.addCustomUrl('https://youtu.be/abc12345678').ok).toBe(true);
    expect(s.addNote().ok).toBe(true);
    expect(s.getState().premiumUpsell).toBeNull();
  });
});

describe('nothing offers to sell what is already free', () => {
  it('the paywall renders nothing, even when something sets a reason on it', () => {
    setState({ premiumUpsell: 'Routines are part of Premium.' });
    render(<GateNotice />);
    expect(screen.queryByText(/Go Premium/i)).toBeNull();
    expect(screen.queryByText(/Premium feature/i)).toBeNull();
    expect(document.body.textContent.trim()).toBe('');
  });

  it('the membership card does not sell to a signed-in non-payer', () => {
    localStorage.setItem(LS('authToken'), 'jwt');
    localStorage.setItem(LS('authEmail'), 'guest@example.com');
    setState({ signedIn: true, premium: true, premiumPaid: false });
    render(<MembershipCard />);
    expect(screen.queryByText(/Go Premium/i)).toBeNull();
    // and it does not claim a membership nobody paid for
    expect(screen.queryByText(/Premium · active/i)).toBeNull();
    expect(screen.getByText(/everything is unlocked/i)).toBeTruthy();
  });

  it('the signed-out card invites a sign-in without mentioning a purchase', () => {
    setState({ signedIn: false, premium: true, premiumPaid: false });
    render(<MembershipCard />);
    expect(screen.queryByText(/buy Premium/i)).toBeNull();
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
  });
});

describe('a stale premium flag cannot resurrect the paywall', () => {
  // The gates used to read `!state.premium` each for themselves, so anything that
  // left `premium: false` behind — a view rendered before hydrate, an old caller,
  // a console poke — put the paid tier back on a build that has no paid tier.
  // Every gate asks premiumGated() now, and that asks the switch first.
  it('the store still refuses nothing', async () => {
    const s = await freshStore();
    s.setState({ premium: false, deckItems: deck(s.FREE_STACK_CAP * 2) });
    expect(s.premiumGated()).toBe(false);
    expect(s.overLimit()).toBe(false);
    expect(s.createRoutine('Morning', [{ id: 'x' }])).not.toBeNull();
    expect(s.getState().premiumUpsell).toBeNull();
  });

  it('the Library still offers no price and no lock', () => {
    setState({ premium: false, stackTab: 'routines', protocols: [], mediaItems: [], routines: [] });
    render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);
    expect(screen.queryByText(/Unlock Routines/i)).toBeNull();
    expect(screen.queryByText(/\$9\.99/)).toBeNull();
    expect(screen.queryByText(/mo$/)).toBeNull();
  });
});

describe('the existing subscriber is not broken by any of this', () => {
  it('a verified server answer is still recorded while everything is open', async () => {
    const s = await freshStore();
    s.applyServerEntitlement({ premium: true, entitlement: 'paid' });
    expect(s.getState().premiumPaid).toBe(true);
    expect(s.getState().premium).toBe(true);
  });

  it('their card still says Premium · active, not "unlocked for everyone"', () => {
    paidSessionOnDisk();
    setState({ signedIn: true, premium: true, premiumPaid: true });
    render(<MembershipCard />);
    expect(screen.getByText(/Premium · active/i)).toBeTruthy();
    expect(screen.queryByText(/Go Premium/i)).toBeNull();
  });

  it('survives the switch going back to false — their session still unlocks', async () => {
    paidSessionOnDisk();
    const s = await closedStore();
    expect(s.getState().premium).toBe(true);          // cachedPremium(), untouched
    expect(s.createRoutine('Morning', [{ id: 'x' }])).not.toBeNull();
  });

  it('and with the switch false a stranger is refused again', async () => {
    const s = await closedStore();
    expect(s.getState().premium).toBe(false);
    expect(s.createRoutine('Sneaky', [{ id: 'x' }])).toBeNull();
    expect(s.getState().premiumUpsell).toMatch(/Premium/);
  });
});
