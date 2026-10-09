// A HELD PROGRAMME SURVIVES EVERYTHING THAT IS NOT AN ANSWER (2026-10-05).
//
// A practitioner sends one link. Until the client taps Save, Add or Discard,
// nobody has answered it — and four separate accidents used to destroy it
// permanently anyway:
//
//   1. "Add all to today" never cleared it, so the sheet ambushed every launch
//      and a second tap re-added the whole programme.
//   2. The sheet (z45) painted over the account sheet (z42) — the app's only
//      sign-in door, and the one the sheet's own paywall sends people to — so
//      the only reachable control was a backdrop that deleted the programme.
//   3. One tap on the dim area deleted it: state, the localStorage mirror, and
//      `#r=` was already stripped from the URL. No undo, no mention of it
//      anywhere else in the app.
//   4. A corrupt SECOND link nulled the good one in state while leaving it on
//      disk, and the error panel's OK then deleted that orphan.
//
// Plus two things that made the sheet unreachable or invisible: no hashchange
// listener (a link tapped with the app already open did nothing at all), and
// anySheetOpen not knowing about it (the welcome tour, the quest coach and the
// one-shot hints all fired on top of it).
//
// Every test here asserts what the recipient ends up holding, never how it is
// wired.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── THE PAID BUILD, ON DEMAND (2026-10-05) ──────────────────────────────────
// The shipped build is OPEN: PREMIUM_OPEN in membership.js is true, so the B2B
// pivot leaves nothing gated and no refusal can happen. Any test below that
// describes a REFUSAL is therefore describing the PAID build, and calls
// paidBuild() first — which flips the switch back through this getter and proves
// that gate still bites. Every other test in this file runs the app as it ships.
/** Put the paywall back, for one test. Cleared before every test. */
const paidBuild = () => { globalThis.__ppwPaidBuild = true; };

import { render, cleanup, screen, act, fireEvent } from '@testing-library/react';

const completeSignIn = vi.fn(async () => ({ premium: false }));
vi.mock('./membership.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    completeSignIn: (...a) => completeSignIn(...a),
    // ONE mock per module path: a second vi.mock('./membership.js') replaces this
    // one wholesale and the completeSignIn fake above vanishes with it, so the
    // paid-build switch has to live in here too.
    get PREMIUM_OPEN() { return globalThis.__ppwPaidBuild !== true; },
  };
});

import {
  setState, getState, setPendingShare, clearPendingShare, applyServerEntitlement,
  anySheetOpen, openAccount, closeAccount, hintCount, FREE_STACK_CAP,
} from './store5.js';
import { maybeHint, resetHintEngine } from './coach/hints5.js';
import App5 from './App5.jsx';
import SharedRoutineSheet from './screens/SharedRoutineSheet.jsx';
import GateNotice from './screens/GateNotice.jsx';
import AccountSheet from './screens/AccountSheet.jsx';

const LS = (k) => 'ppw5.' + k;

// Hand-built, so a change to the wire format fails these tests rather than
// being quietly followed by them.
function payload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const WIRE = {
  p: 'ppwr', v: 1, n: 'Shoulder rehab — weeks 1-6',
  i: [
    { t: 'Pendulum swings', h: '08:00', r: 'daily' },
    { t: 'Wall slides', h: '08:20', r: 'daily' },
    { t: 'Review with the clinic', h: '10:00', r: 'weekly', d: 7 },
  ],
};
const HELD = {
  name: 'Shoulder rehab — weeks 1-6',
  items: [
    { title: 'Pendulum swings', time: '08:00', repeat: 'daily' },
    { title: 'Wall slides', time: '08:20', repeat: 'daily' },
    { title: 'Review with the clinic', time: '10:00', repeat: 'weekly', _day: 7 },
  ],
};

beforeEach(() => {
  delete globalThis.__ppwPaidBuild;
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  resetHintEngine();
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  window.history.replaceState({}, '', '/');
  setState({
    pendingShare: null, shareError: null, shareHidden: false,
    screen: 'stack', viewDate: null, coach: null, journalOpen: false, hint: null,
    guide: { q: {}, welcomed: 1 }, hints: {}, hintsOff: false,
    onboarded: true, firstRunChoice: true, termsOk: true, termsOpen: false,
    signedIn: false, premium: false,
    addOpen: false, aiOpen: false, accountOpen: false, completedOpen: false,
    playerItem: null, scheduleTarget: null, repeatId: null, editId: null, premiumUpsell: null,
    routines: [], deckItems: [], selectedIds: [], doneByDate: {},
  });
});
afterEach(cleanup);

const sheet = () => render(<SharedRoutineSheet />);
const bootAt = async (href) => {
  window.history.replaceState({}, '', href);
  await act(async () => { render(<App5 />); });
};
/** What a browser does when a link is tapped into an already-open document. */
const tapLinkIntoOpenApp = async (href) => {
  await act(async () => {
    window.history.replaceState({}, '', href);
    window.dispatchEvent(new Event('hashchange'));
  });
};

// ── 1. "Add all to today" is an answer ───────────────────────────────────

describe('adding a shared programme to today', () => {
  it('answers the share, so it does not ambush the next launch', () => {
    applyServerEntitlement({ premium: true });
    setPendingShare(HELD);
    sheet();

    fireEvent.click(screen.getByText('Add all to today'));

    expect(getState().deckItems.length).toBe(3);
    expect(screen.getByText('3 stacks added to today')).toBeTruthy();
    // The two things that brought the sheet back on every launch.
    expect(getState().pendingShare).toBeNull();
    expect(localStorage.getItem(LS('pendingShare'))).toBeNull();
  });

  it('cannot be applied twice', () => {
    applyServerEntitlement({ premium: true });
    setPendingShare(HELD);
    sheet();

    fireEvent.click(screen.getByText('Add all to today'));
    // The sheet is answered, so the primary action is gone rather than live.
    expect(screen.queryByText('Add all to today')).toBeNull();
    expect(screen.queryByText('Pendulum swings')).toBeNull();
    expect(getState().deckItems.length).toBe(3);
    expect(getState().deckItems.filter((x) => x.title === 'Wall slides').length).toBe(1);
  });

  it('comes back when the free cap refused it — a refusal is not an answer', () => {
    paidBuild(); // only the paid build can refuse it
    applyServerEntitlement({ premium: false });
    setState({ deckItems: Array.from({ length: FREE_STACK_CAP - 1 }, (_, i) => ({ id: 'x' + i, title: 'own ' + i, time: '07:00' })) });
    setPendingShare(HELD);
    render(<><SharedRoutineSheet /><GateNotice /></>);

    fireEvent.click(screen.getByText('Add all to today'));

    expect(screen.getByText(/nothing was added/i)).toBeTruthy();
    expect(getState().pendingShare).toBeTruthy();
    expect(localStorage.getItem(LS('pendingShare'))).toBeTruthy();
  });
});

// ── 2. the account sheet gets right of way ───────────────────────────────

describe('the sign-in door underneath the share sheet', () => {
  it('stands down while the account sheet is open, and comes back after', () => {
    setPendingShare(HELD);
    const { container } = render(<SharedRoutineSheet />);
    expect(screen.getByText('Pendulum swings')).toBeTruthy();

    act(() => { openAccount('signin'); });
    // Nothing of this layer is painting — not the card, not the backdrop.
    expect(container.firstChild).toBeNull();
    // And the programme is untouched by standing down.
    expect(getState().pendingShare).toBeTruthy();
    expect(localStorage.getItem(LS('pendingShare'))).toBeTruthy();

    act(() => { closeAccount(); });
    expect(screen.getByText('Pendulum swings')).toBeTruthy();
  });

  /**
   * REWRITTEN 2026-10-08. This used to walk the route a signed-out recipient
   * actually took: tap Save → meet the paywall → tap its "Sign in to go Premium"
   * → land in the sign-in field. That middle step was a sell, and it is gone, so
   * the route it tested cannot be walked any more.
   *
   * The guarantee underneath it is still worth holding, and splits in two:
   *   · the refusal is a DEAD END ON PURPOSE now — it states the limit and offers
   *     no purchase and no sign-in, because signing in would not help;
   *   · and reaching the sign-in field still costs nothing once the refusal is
   *     dismissed, with the shared programme untouched the whole way.
   */
  it('refuses a signed-out recipient without selling, and still lets them reach the sign-in field', () => {
    paidBuild(); // nothing can be refused on the shipped build
    applyServerEntitlement({ premium: false });
    setPendingShare(HELD);
    render(<><SharedRoutineSheet /><GateNotice /><AccountSheet /></>);

    fireEvent.click(screen.getByText('Save to my Routines'));

    // The refusal is what they meet, and it is the end of the conversation.
    expect(screen.getByText('Not on your plan')).toBeTruthy();
    expect(screen.queryByText(/sign in to go premium/i)).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(getState().accountOpen).toBeFalsy();

    // The door is still one tap away from anywhere that opens it, and this layer
    // stands down rather than painting over it.
    act(() => { openAccount('signin'); });
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.queryByText('Pendulum swings')).toBeNull();
    expect(getState().pendingShare).toBeTruthy();
  });
});

// ── 3. dismissal is not deletion ─────────────────────────────────────────

describe('tapping past a shared programme', () => {
  it('keeps it when the dim area outside the sheet is tapped', () => {
    setPendingShare(HELD);
    const { container } = sheet();
    const backdrop = container.firstChild.firstChild;

    fireEvent.click(backdrop);

    expect(getState().pendingShare).toBeTruthy();
    expect(localStorage.getItem(LS('pendingShare'))).toBeTruthy();
    expect(screen.queryByText('Save to my Routines')).toBeNull();   // out of the way
    expect(screen.getByText('1 programme waiting')).toBeTruthy();   // and findable
  });

  it('keeps it on "Not now", which is what those words mean', () => {
    setPendingShare(HELD);
    sheet();
    fireEvent.click(screen.getByText('Not now'));
    expect(getState().pendingShare).toBeTruthy();
    expect(localStorage.getItem(LS('pendingShare'))).toBeTruthy();
    expect(screen.getByText('1 programme waiting')).toBeTruthy();
  });

  it('gives a way back — the chip reopens the whole programme', () => {
    setPendingShare(HELD);
    sheet();
    fireEvent.click(screen.getByText('Not now'));

    fireEvent.click(screen.getByText('1 programme waiting'));

    expect(screen.getByText('Shoulder rehab — weeks 1-6')).toBeTruthy();
    expect(screen.getByText('Review with the clinic')).toBeTruthy();
    expect(screen.getByText('Save to my Routines')).toBeTruthy();
  });

  it('is still there on the next launch, because dismissing did not touch the mirror', async () => {
    // What an onboarded recipient's device really carries, so the cold boot
    // below lands past the first-run doors rather than behind them.
    localStorage.setItem(LS('onboarded'), '1');
    localStorage.setItem(LS('terms'), '1');
    localStorage.setItem(LS('frc'), '1');
    await bootAt('/#r=' + payload(WIRE));
    fireEvent.click(screen.getByText('Not now'));
    cleanup();

    // A real cold boot, not a re-render: a fresh module registry hydrates from
    // localStorage exactly as the next launch does. shareHidden is NOT
    // persisted on purpose — an unanswered programme coming back is the whole
    // point of that mirror, and there is now a labelled Discard for a real no.
    vi.resetModules();
    const s = await import('./store5.js');
    expect(s.getState().pendingShare.name).toBe('Shoulder rehab — weeks 1-6');
    expect(s.getState().pendingShare.items.length).toBe(3);
    expect(s.getState().shareHidden).toBe(false);
    expect(s.shareSheetUp(s.getState())).toBe(true);
  });

  // The way back must not become furniture in the way. A pill floating at z45
  // over an open sheet reads as a glitch, and the dismissal was a request for
  // the screen back in the first place.
  it('steps the chip aside while another layer owns the screen', () => {
    setPendingShare(HELD);
    const { container } = sheet();
    fireEvent.click(screen.getByText('Not now'));
    expect(screen.getByText('1 programme waiting')).toBeTruthy();

    act(() => { setState({ addOpen: true }); });
    expect(container.firstChild).toBeNull();

    act(() => { setState({ addOpen: false }); });
    expect(screen.getByText('1 programme waiting')).toBeTruthy();
  });

  it('only forgets it on the control that says it discards', () => {
    setPendingShare(HELD);
    sheet();

    fireEvent.click(screen.getByText('Discard this programme'));

    expect(getState().pendingShare).toBeNull();
    expect(localStorage.getItem(LS('pendingShare'))).toBeNull();
    expect(screen.queryByText('Save to my Routines')).toBeNull();
    expect(screen.queryByText('1 programme waiting')).toBeNull();
  });
});

// ── 4. a bad link never touches a good one ───────────────────────────────

describe('a second link that did not survive the trip', () => {
  it('leaves a programme already waiting completely alone', async () => {
    await bootAt('/#r=' + payload(WIRE));
    expect(getState().pendingShare).toBeTruthy();

    await tapLinkIntoOpenApp('/#r=not-base64-at-all$$$');

    // The error is told, and the programme is still held — in BOTH copies.
    expect(getState().shareError).toMatch(/did not come through/i);
    expect(getState().pendingShare).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(LS('pendingShare'))).items.length).toBe(3);
    // On screen together: the warning above the programme, not instead of it.
    expect(screen.getByText(/That other link didn’t open/)).toBeTruthy();
    expect(screen.getByText('Pendulum swings')).toBeTruthy();
  });

  it('is dismissed on its own — acknowledging it is not an answer to the share', async () => {
    await bootAt('/#r=' + payload(WIRE));
    await tapLinkIntoOpenApp('/#r=broken$$$');

    fireEvent.click(screen.getByText('OK'));

    expect(getState().shareError).toBeNull();
    expect(getState().pendingShare).toBeTruthy();
    expect(localStorage.getItem(LS('pendingShare'))).toBeTruthy();
    expect(screen.getByText('Save to my Routines')).toBeTruthy();
  });

  it('is shown even to someone who had tapped the held programme away', async () => {
    await bootAt('/#r=' + payload(WIRE));
    fireEvent.click(screen.getByText('Not now'));

    await tapLinkIntoOpenApp('/#r=broken$$$');

    expect(screen.getByText(/That other link didn’t open/)).toBeTruthy();
  });
});

// ── 5. a link tapped while the app is already open ───────────────────────

describe('a link tapped with the app already on screen', () => {
  it('opens the programme instead of doing nothing at all', async () => {
    await bootAt('/');
    expect(getState().pendingShare).toBeNull();

    await tapLinkIntoOpenApp('/#r=' + payload(WIRE));

    expect(getState().pendingShare).toBeTruthy();
    expect(screen.getByText('Shoulder rehab — weeks 1-6')).toBeTruthy();
    expect(screen.getByText('Save to my Routines')).toBeTruthy();
    expect(window.location.hash).toBe('');      // consumed, so a reload is safe
  });

  it('says so when that link is unreadable, rather than ignoring the tap', async () => {
    await bootAt('/');
    await tapLinkIntoOpenApp('/#r=$$$not-a-link$$$');
    expect(getState().shareError).toMatch(/did not come through/i);
    expect(screen.getByText(/didn’t open/)).toBeTruthy();
  });

  it('leaves somebody else’s fragment alone', async () => {
    await bootAt('/#r=' + payload(WIRE));
    clearPendingShare();

    await tapLinkIntoOpenApp('/#section-3');

    expect(getState().pendingShare).toBeNull();
    expect(getState().shareError).toBeNull();
    expect(window.location.hash).toBe('#section-3');
  });
});

// ── 6. guidance never covers a programme someone was just sent ───────────

describe('the guide and a held programme', () => {
  it('counts the share sheet as a layer that owns the screen', () => {
    expect(anySheetOpen(getState())).toBe(false);
    setPendingShare(HELD);
    expect(anySheetOpen(getState())).toBe(true);
    // Tapped away: the person is using the app again, so the guide is free.
    setState({ shareHidden: true });
    expect(anySheetOpen(getState())).toBe(false);
    setState({ shareHidden: false });
    clearPendingShare();
    expect(anySheetOpen(getState())).toBe(false);
  });

  it('does not spend a one-shot hint behind it', () => {
    setPendingShare(HELD);
    // Hints are lifetime-capped and the flag is written to localStorage BEFORE
    // the bubble is shown, so firing here spends the only life a person gets.
    expect(maybeHint('done-vanish')).toBe(false);
    expect(hintCount('done-vanish')).toBe(0);
    // Even a sheet-anchored hint, which skips the general sheet check.
    setState({ addOpen: true });
    expect(maybeHint('add-intro')).toBe(false);
    expect(hintCount('add-intro')).toBe(0);
  });

  it('does not open the welcome tour on top of it', async () => {
    vi.useFakeTimers();
    try {
      setPendingShare(HELD);
      setState({ guide: { q: {} } });     // never welcomed
      await act(async () => { render(<App5 />); });
      await act(async () => { vi.advanceTimersByTime(2000); });

      expect(screen.queryByText('Your Stack — the real one.')).toBeNull();
      expect(screen.getByText('Shoulder rehab — weeks 1-6')).toBeTruthy();

      // Out of the way, and the welcome is free to run.
      await act(async () => { fireEvent.click(screen.getByText('Not now')); });
      await act(async () => { vi.advanceTimersByTime(2000); });
      expect(screen.getByText('Your Stack — the real one.')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
