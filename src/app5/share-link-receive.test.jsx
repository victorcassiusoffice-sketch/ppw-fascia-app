// Receiving a shared routine (2026-10-05).
//
// The link is the whole feature, and the boot pass is where it can go wrong in
// ways nobody would ever report. Two faults these pin:
//
//   1. If the fragment is not stripped the moment it is read, every refresh
//      imports the same programme again — a client ends up with the six-week
//      plan three times over and no idea why.
//   2. The magic-link branch already re-appended `url.hash` verbatim after
//      deleting its token. A routine arriving on the SAME url as a sign-in
//      would have been put straight back into the address bar by that line.
//
// So these tests drive the real App5 against a real URL, and assert what a
// recipient ends up holding — never how the parse is wired.

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

// Only the one network call a magic link makes is faked; the rest of membership
// is real, and a signed-out boot makes no requests at all.
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

import { setState, getState, clearPendingShare, setPendingShare, applyServerEntitlement, FREE_STACK_CAP } from './store5.js';
import App5 from './App5.jsx';
import SharedRoutineSheet from './screens/SharedRoutineSheet.jsx';
import UpsellModal from './screens/UpsellModal.jsx';

const LS = (k) => 'ppw5.' + k;

// Built here rather than through routineToLink, so a change to the wire format
// fails these tests instead of being quietly followed by them.
function payload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const PROGRAMME = {
  p: 'ppwr', v: 1, n: 'Shoulder rehab — weeks 1-6',
  i: [
    { t: 'Pendulum swings', m: '2 min each arm', u: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', h: '08:00', r: 'daily' },
    { t: 'Wall slides', h: '08:20', r: 'daily' },
    { t: 'Review with the clinic', h: '10:00', r: 'weekly', d: 7 },
  ],
};

// jsdom has no layout, and the stack screen scrolls itself into view on mount.
beforeEach(() => {
  delete globalThis.__ppwPaidBuild;
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  window.history.replaceState({}, '', '/');
  setState({
    // shareHidden: the store is a singleton across this file, so a test that
    // taps the sheet away would otherwise leave the next one looking at a chip.
    pendingShare: null, shareError: null, shareHidden: false,
    screen: 'stack', viewDate: null, coach: null, journalOpen: false, hint: null,
    guide: { q: {}, welcomed: 1 }, hints: {}, hintsOff: true,
    onboarded: true, firstRunChoice: true, termsOk: true, signedIn: false, premium: false,
    addOpen: false, aiOpen: false, termsOpen: false, accountOpen: false, completedOpen: false,
    playerItem: null, scheduleTarget: null, repeatId: null, premiumUpsell: null,
    routines: [], selectedIds: [],
  });
});
afterEach(cleanup);

const bootAt = async (href) => {
  window.history.replaceState({}, '', href);
  await act(async () => { render(<App5 />); });
};

describe('a routine arriving as a link', () => {
  it('is held, with its name and all of its stacks', async () => {
    await bootAt('/#r=' + payload(PROGRAMME));
    const held = getState().pendingShare;
    expect(held).toBeTruthy();
    expect(held.name).toBe('Shoulder rehab — weeks 1-6');
    expect(held.items.length).toBe(3);
    expect(held.items.map((x) => x.title)).toContain('Review with the clinic');
    expect(getState().shareError).toBeNull();
  });

  // Nothing is applied on boot. The recipient of a stranger's message answers
  // for the programme in the sheet, or it never lands anywhere.
  it('writes nothing into the deck or the routines on its own', async () => {
    const before = getState().deckItems.length;
    await bootAt('/#r=' + payload(PROGRAMME));
    expect(getState().routines.length).toBe(0);
    expect(getState().deckItems.length).toBe(before);
  });

  it('leaves no payload in the address bar', async () => {
    await bootAt('/#r=' + payload(PROGRAMME));
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  // The whole point of the strip: a refresh is the commonest thing a confused
  // recipient does, and it must not import the programme a second time.
  it('does not arrive twice when the page is reloaded', async () => {
    await bootAt('/#r=' + payload(PROGRAMME));
    clearPendingShare();          // they tapped "Not now"
    cleanup();
    await act(async () => { render(<App5 />); });   // the reload
    expect(getState().pendingShare).toBeNull();
    expect(localStorage.getItem(LS('pendingShare'))).toBeNull();
  });

  // Mirrored to storage because the recipient most likely to reload is the one
  // who has never opened the app: they meet the first-run doors and the terms
  // gate first, and by then the url they arrived on is already clean.
  it('survives in storage until it is answered', async () => {
    await bootAt('/#r=' + payload(PROGRAMME));
    const saved = JSON.parse(localStorage.getItem(LS('pendingShare')));
    expect(saved.name).toBe('Shoulder rehab — weeks 1-6');
    expect(saved.items.length).toBe(3);
    clearPendingShare();
    expect(localStorage.getItem(LS('pendingShare'))).toBeNull();
    expect(getState().pendingShare).toBeNull();
  });
});

describe('a link that did not survive the trip', () => {
  it('says so, and the app still works', async () => {
    await bootAt('/#r=' + 'not-base64-at-all$$$');
    expect(getState().pendingShare).toBeNull();
    expect(getState().shareError).toMatch(/did not come through/i);
    expect(screen.getByLabelText('Add a stack')).toBeTruthy();
    expect(window.location.hash).toBe('');
  });

  // A `.md` payload read with the link's rules, or any other envelope, is a
  // mismatch rather than a crash.
  it('refuses a payload that is not a routine link', async () => {
    await bootAt('/#r=' + payload({ ppw: 'routine', v: 2, items: [{ title: 'x' }] }));
    expect(getState().pendingShare).toBeNull();
    expect(getState().shareError).toBeTruthy();
  });

  // An empty marker is not ours to consume, so nothing is held, nothing is
  // reported, and any fragment that is not a routine link is left alone.
  it('ignores a bare marker and leaves a foreign fragment alone', async () => {
    await bootAt('/#settings');
    expect(getState().pendingShare).toBeNull();
    expect(getState().shareError).toBeNull();
    expect(window.location.hash).toBe('#settings');
  });
});

// A fresh module, so these read the store's own boot-time hydration rather
// than whatever a previous test left in memory.
async function freshStore() {
  vi.resetModules();
  return await import('./store5.js');
}

describe('a share held across a reload', () => {
  it('is still there when the app boots again', async () => {
    localStorage.setItem(LS('pendingShare'), JSON.stringify({ name: 'Knee programme', items: [{ title: 'Step-downs' }, { title: 'Wall sits' }] }));
    const s = await freshStore();
    expect(s.getState().pendingShare.name).toBe('Knee programme');
    expect(s.getState().pendingShare.items.length).toBe(2);
  });

  // A half-written key must not put an empty sheet on screen with nothing in it
  // to accept, and must never stop the app booting.
  it('is ignored when the stored copy is unusable', async () => {
    localStorage.setItem(LS('pendingShare'), '{not json');
    expect((await freshStore()).getState().pendingShare).toBeNull();
    localStorage.setItem(LS('pendingShare'), JSON.stringify({ name: 'Empty', items: [] }));
    expect((await freshStore()).getState().pendingShare).toBeNull();
  });
});

describe('a sign-in link and a routine link in the same url', () => {
  it('consumes each exactly once and leaves a clean path', async () => {
    await bootAt('/?login_token=magic-abc#r=' + payload(PROGRAMME));
    expect(completeSignIn).toHaveBeenCalledTimes(1);
    expect(completeSignIn).toHaveBeenCalledWith('magic-abc');
    expect(getState().pendingShare.items.length).toBe(3);
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
  });
});

// --- the sheet the recipient actually answers --------------------------------
//
// The sheet is rendered on its own below rather than through App5. That is
// deliberate: mounting App5 and then awaiting runs the boot chain, and
// syncEntitlement() for a signed-out user writes `premium: cachedPremium()`
// back over a test-set `premium: true`. These tests are about what the person
// holding the phone sees and what ends up on disk, so they drive the component
// against the real store, and the last test proves App5 renders it at all.

// The parsed shape the fragment reader hands over: `_day`, never `dayOffset`
// (the naming law in store5.js). A day-7 stack is in here because the whole
// point of the sheet is that a recipient can SEE a stack that is not today's.
const HELD = {
  name: 'Shoulder rehab — weeks 1-6',
  items: [
    { title: 'Pendulum swings', meta: '2 min each arm', time: '08:00', repeat: 'daily', _day: 0 },
    { title: 'Wall slides', time: '08:20', repeat: 'daily', _day: 0 },
    { title: 'Review with the clinic', time: '10:00', repeat: 'weekly', _day: 7 },
  ],
};

const sheet = () => render(<SharedRoutineSheet />);

describe('the sheet that asks what to do with a shared routine', () => {
  it('discloses the whole schedule, not just the titles', () => {
    applyServerEntitlement({ premium: true });
    setPendingShare(HELD);
    sheet();

    expect(screen.getByText('Shoulder rehab — weeks 1-6')).toBeTruthy();
    expect(screen.getByText('3 stacks · shared with you')).toBeTruthy();
    HELD.items.forEach((it) => expect(screen.getByText(it.title)).toBeTruthy());
    // Time, repeat and start day — the three things the .md draft preview left
    // out, so nobody can accept a six-week programme believing it is one day's
    // worth of work.
    expect(screen.getByText(/08:00 · Every day/)).toBeTruthy();
    expect(screen.getByText(/10:00 · Weekly · from day 7/)).toBeTruthy();
  });

  // An item that arrives with no repeat lands as 'once' (addItemsToToday and
  // applyRoutineToDate both do `repeat || 'once'`), so the sheet must not
  // promise a daily habit it is not going to create.
  it('says "Just once" for a stack that does not repeat', () => {
    setPendingShare({ name: 'One-off', items: [{ title: 'Assessment', time: '09:00' }] });
    sheet();
    expect(screen.getByText(/09:00 · Just once/)).toBeTruthy();
  });

  // A Document stack cannot really be shared on EITHER rail: `fileId` points at
  // the sender's own IndexedDB and both parsers drop it. The recipient would
  // otherwise get a row with a doc icon that opens nothing, and no way of
  // knowing why. Fixing it properly needs file upload, i.e. a backend.
  it('admits that a shared document has not come with it', () => {
    setPendingShare({ name: 'Rehab pack', items: [{ title: 'Discharge summary.pdf', meta: 'Document', thumb: 'doc', time: '09:00' }] });
    sheet();
    expect(screen.getByText(/stays on the sender/i)).toBeTruthy();
  });

  it('puts the routine on disk when a paying user saves it', () => {
    applyServerEntitlement({ premium: true });
    setPendingShare(HELD);
    sheet();

    fireEvent.click(screen.getByText('Save to my Routines'));

    const saved = JSON.parse(localStorage.getItem(LS('routines')));
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe('Shoulder rehab — weeks 1-6');
    expect(saved[0].items.length).toBe(3);
    // The day survives under its PUBLIC name and the internal one is gone:
    // writing `_day` into ppw5.routines is how a day-21 stack came back as day
    // 0 the next time the routine was shared.
    expect(saved[0].items[2].dayOffset).toBe(7);
    expect(JSON.stringify(saved)).not.toContain('_day');
    // The share is answered — nothing held in state, nothing left in storage to
    // put the sheet back on the next boot — and the person is told it landed.
    expect(getState().pendingShare).toBeNull();
    expect(localStorage.getItem(LS('pendingShare'))).toBeNull();
    expect(screen.queryByText('Pendulum swings')).toBeNull();
    expect(screen.getByText(/Saved .* to your Routines/)).toBeTruthy();
  });

  // The button is SHOWN to a free user on purpose: hiding it is not a paywall
  // (the G1/W11 reasoning in store5.js). The store refuses, and the refusal is
  // what they see — never a button that does nothing.
  it('shows a free user the paywall rather than hiding the button', () => {
    paidBuild(); // there is no paywall to show on the shipped build
    applyServerEntitlement({ premium: false });
    setPendingShare(HELD);
    render(<><SharedRoutineSheet /><UpsellModal /></>);

    const save = screen.getByText('Save to my Routines');
    expect(save).toBeTruthy();
    fireEvent.click(save);

    expect(getState().routines.length).toBe(0);
    expect(localStorage.getItem(LS('routines'))).toBeNull();
    expect(screen.getByText('Premium feature')).toBeTruthy();
    expect(getState().premiumUpsell).toMatch(/Premium/);
    // and the programme is still here for when they come back to it
    expect(screen.getByText('Pendulum swings')).toBeTruthy();
    expect(getState().pendingShare).toBeTruthy();
  });

  it('refuses "Add all to today" over the free cap, and says nothing was added', () => {
    paidBuild(); // the free cap only exists on the paid build
    applyServerEntitlement({ premium: false });
    const own = Array.from({ length: FREE_STACK_CAP - 1 }, (_, i) => ({ id: 'x' + i, title: 'own ' + i, time: '07:00' }));
    setState({ deckItems: own });
    setPendingShare(HELD);
    render(<><SharedRoutineSheet /><UpsellModal /></>);

    fireEvent.click(screen.getByText('Add all to today'));

    expect(getState().deckItems.length).toBe(own.length); // all-or-nothing, so none
    expect(screen.getByText(/nothing was added/i)).toBeTruthy();
    expect(getState().premiumUpsell).toMatch(new RegExp(String(FREE_STACK_CAP)));
  });

  it('adds the stacks to today for a user with room', () => {
    applyServerEntitlement({ premium: true });
    setState({ deckItems: [] });
    setPendingShare(HELD);
    sheet();

    fireEvent.click(screen.getByText('Add all to today'));

    expect(getState().deckItems.length).toBe(3);
    expect(screen.getByText('3 stacks added to today')).toBeTruthy();
  });

  // CHANGED 2026-10-05 (review pass). This test used to assert that "Not now"
  // forgot the programme entirely — which is what the code did, and which is
  // the defect: the quietest button on the sheet, and the unlabelled backdrop
  // beside it, deleted a six-week prescription from state AND from the
  // localStorage mirror, with `#r=` already stripped from the URL so there was
  // nothing left to reload. "Not now" now means not now; only the labelled
  // control discards. The non-destructive path is covered in full by
  // share-receive-integrity.test.jsx.
  it('forgets the routine only on the control that says it discards', () => {
    setPendingShare(HELD);
    sheet();

    fireEvent.click(screen.getByText('Not now'));
    expect(getState().pendingShare).toBeTruthy();                   // put away, not thrown away
    expect(localStorage.getItem(LS('pendingShare'))).toBeTruthy();
    fireEvent.click(screen.getByText('1 programme waiting'));       // the way back

    fireEvent.click(screen.getByText('Discard this programme'));
    expect(getState().pendingShare).toBeNull();
    expect(localStorage.getItem(LS('pendingShare'))).toBeNull();
    expect(screen.queryByText('Save to my Routines')).toBeNull();
  });

  // A brand-new recipient taps a link and meets the first-run doors and the
  // wizard. The routine waits behind them rather than competing with them.
  it('waits for the first-run choice and the wizard, then appears', () => {
    setPendingShare(HELD);
    setState({ firstRunChoice: false, onboarded: false });
    const { container, rerender } = render(<SharedRoutineSheet />);
    expect(container.firstChild).toBeNull();

    setState({ firstRunChoice: true });
    rerender(<SharedRoutineSheet />);
    expect(container.firstChild).toBeNull(); // the wizard still has the screen

    setState({ onboarded: true });
    rerender(<SharedRoutineSheet />);
    expect(screen.getByText('Shoulder rehab — weeks 1-6')).toBeTruthy();
  });

  // THE field failure this sheet exists to survive: on iOS, WhatsApp's in-app
  // browser is its own storage partition, so a save made there is invisible in
  // the installed app. jsdom is never standalone, so the hatch is on screen.
  it('offers the link back when the app is not running standalone', () => {
    setPendingShare(HELD);
    sheet();
    expect(screen.getByText(/own browser/i)).toBeTruthy();
    const copy = screen.getByText('Copy this link');
    expect(copy).toBeTruthy();

    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledTimes(1);
    // What is handed back has to be a working link, not a description of one.
    expect(writeText.mock.calls[0][0]).toContain('#r=');
  });

  // shareError was being set by the boot pass and rendered by nothing, so a
  // recipient whose link a messenger had mangled got total silence.
  it('tells the recipient when the link itself did not survive', () => {
    setState({ pendingShare: null, shareError: 'That routine link did not come through. Ask whoever sent it for a fresh one.' });
    sheet();
    expect(screen.getByText(/did not come through/i)).toBeTruthy();
    fireEvent.click(screen.getByText('OK'));
    expect(getState().shareError).toBeNull();
  });
});

describe('the sheet is reachable from the app, not only from a test', () => {
  it('is on screen after booting on a shared link', async () => {
    await bootAt('/#r=' + payload(PROGRAMME));
    expect(screen.getByText('Shoulder rehab — weeks 1-6')).toBeTruthy();
    expect(screen.getByText('Save to my Routines')).toBeTruthy();
  });
});
