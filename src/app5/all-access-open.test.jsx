// EVERY FEATURE IS OPEN TO WHOEVER GETS THROUGH THE DOOR.
//
// Vic, 2026-10-08: "So all access available including sharing routines."
//
// This file walks the whole product AS A STORY, in the order a real visitor
// meets it: a gym owner who typed the access code, agreed to keep what they see
// to themselves, has never paid, is not signed in, and has no entitlement of any
// kind on the server. Every step runs the REAL functions the screens call.
//
// WHAT MAKES IT DIFFERENT FROM ITS NEIGHBOURS. premium-open.test.jsx proves each
// gate declines to bite, one gate at a time. storefront-removed.test.jsx proves
// no price or buy button is left in the tree. Neither of them walks a journey,
// and a journey is where a lock actually hides: a feature can be reachable at
// every individual call site and still be unusable end to end — which is exactly
// what routine SHARING was, because it was the premium gate that mattered most.
// So the assertions here are about the ABSENCE OF A GATE at each step, not the
// presence of a feature: after every action, `premiumUpsell` and `capRefusal`
// must still be null and the action must have actually landed.
//
// THE ONE THAT HAD TO BE PROVEN WITH TWO INSTANCES. "Sharing a routine" is not
// one function, it is two devices: a practitioner's app builds a link, and a
// client's app — a different store, a different localStorage, nobody signed in
// on either — has to decode it and SAVE IT as their own. Block 4 does that for
// real: `routineToLink` on instance A, a wiped device, `parseRoutineLink` on
// instance B. Nothing else in the suite joins those two halves (the receive
// tests build the payload by hand on purpose, so a wire-format change fails them
// rather than being quietly followed), so nothing else could have caught a send
// and a receive that disagreed.
//
// THE PAID TIER IS NOT WHAT IS BEING TESTED HERE. premium-gates.test.jsx forces
// PREMIUM_OPEN false and proves the paywall machinery still works. This file
// runs the build that ships, unmocked, and is deliberately silent about what a
// gated user would meet.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'motion/react';

// STATIC, and that is load-bearing: these screens bind the store5 instance they
// are imported with, so they must share the one `store` below. A dynamically
// imported store after vi.resetModules() is a DIFFERENT module instance, and a
// screen reading state nobody wrote renders the default — which would make these
// assertions pass against any code at all. The two-instance round trip in block
// 4 is therefore done at the function level, with no rendering.
import * as store from './store5.js';
import LibraryScreen from './screens/LibraryScreen.jsx';
import SharedRoutineSheet from './screens/SharedRoutineSheet.jsx';
import GateNotice from './screens/GateNotice.jsx';
import AccessGate from './screens/AccessGate.jsx';
import { grantAccess, hasAccess, revokeLocalAccess } from './access.js';
import { acceptNda, ndaAccepted, clearNdaAcceptance } from './nda.js';
import registry from './access-codes.json';

const LS = (k) => 'ppw5.' + k;

/** Stacks, by the dozen. `title` is all any add path needs. */
const deck = (n, tag = 'i') =>
  Array.from({ length: n }, (_, i) => ({ id: tag + i, title: 'thing ' + i }));

/**
 * The id of a licence that is live in the committed registry.
 *
 * The ID, never the code: ids are public (they are what a device writes down),
 * and no plaintext code may ever appear in a test — src/app5/access-codes.json
 * holds hashes only and the plaintext lives in the gitignored ACCESS-CODES.md.
 * Reading it from the registry rather than hardcoding one also means this file
 * keeps working the next time a code is rotated.
 */
const LIVE_CODE_ID = (registry.codes.find((c) => !c.revoked) || {}).id;

/**
 * Put this device in the state a visitor is in one second after the door opened:
 * a live licence written down, the current wording agreed to, and nothing else.
 *
 * Goes through the real `grantAccess` / `acceptNda` rather than writing the keys,
 * so if either record's shape changes this helper changes with it.
 */
function throughTheDoor() {
  grantAccess(LIVE_CODE_ID);
  acceptNda(LIVE_CODE_ID);
}

/** A store booted from a clean module registry — what a brand-new install gets. */
async function freshStore() {
  vi.resetModules();
  return await import('./store5.js');
}

/** Point the URL somewhere, the way the demo-embed tests do. */
const at = (href) => window.history.replaceState({}, '', href);

/**
 * THE CLAIM UNDER TEST, in one function.
 *
 * Nothing refused and nothing withheld: no paywall reason raised, no cap refusal
 * recorded, and the server's own verdict still an honest "nothing bought". Called
 * after every step of the walk, because a gate that appears on step 7 of 9 is a
 * feature nobody can finish using.
 */
function nothingWasRefused(s = store) {
  const S = s.getState();
  expect(S.premiumUpsell).toBeNull();
  expect(S.capRefusal).toBeNull();
  expect(s.premiumGated(S)).toBe(false);
  // Still a non-payer. If this ever goes true the walk proved nothing — it would
  // mean the test bought its way in rather than the app letting it in.
  expect(S.premiumPaid).toBe(false);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  at('/');
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  // No account, no purchase — and `premium` comes from the APP's own sign-out
  // path rather than from a value this test wrote, which is the difference
  // between proving the build is open and asserting that it is.
  store.signOutMembership();
  store.setState({
    onboarded: true, firstRunChoice: true, termsOk: true,
    deckItems: [], doneByDate: {}, routines: [], selectedIds: [],
    premiumUpsell: null, capRefusal: null,
    pendingShare: null, shareError: null, shareHidden: false,
    stackTab: 'routines', screen: 'library', viewDate: null,
    addOpen: false, aiOpen: false, accountOpen: false, termsOpen: false,
    playerItem: null, scheduleTarget: null, repeatId: null, editId: null,
    coach: null, hint: null, journalOpen: false, hintsOff: true,
    guide: { q: {}, welcomed: 1 },
    protocols: [], protocolsStatus: 'ready',
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 },
  )));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
  revokeLocalAccess();
  clearNdaAcceptance();
});

// ── 1. in, with nothing bought ──────────────────────────────────────────────
describe('1 · the visitor who just typed the code', () => {
  it('is inside on a licence and an agreement, and on nothing else', () => {
    throughTheDoor();
    expect(hasAccess()).toBe(true);
    expect(ndaAccepted()).toBe(true);
    // The door is what let them in. Not a purchase, not an account.
    expect(localStorage.getItem(LS('authToken'))).toBeNull();
    expect(localStorage.getItem(LS('ent'))).toBeNull();
    expect(store.getState().signedIn).toBe(false);
    expect(store.getState().premiumPaid).toBe(false);
  });

  it('meets no door on screen once the licence is on this device', () => {
    throughTheDoor();
    render(<AccessGate />);
    expect(document.body.textContent.trim()).toBe('');
  });

  it('boots into the whole product from a virgin install', async () => {
    throughTheDoor();
    const s = await freshStore();
    expect(s.getState().premium).toBe(true);
    nothingWasRefused(s);
  });

  it('lands on the Routines shelf, and the shelf is not steered out from under them', () => {
    // LibraryScreen corrects a boot `stackTab` of 'routines' to 'media' for a
    // GATED user, at import time. Nobody is gated, so the default the store
    // ships with has to survive the screen opening on it — this is the first
    // shelf a visitor sees, and being bounced to Media reads as it being
    // withheld. Asserted through the RENDER rather than off the store default,
    // because the store default alone would still read 'routines' on a gated
    // build and pass for the wrong reason.
    throughTheDoor();
    expect(store.getState().stackTab).toBe('routines');
    render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);
    expect(store.getState().stackTab).toBe('routines');
    expect(screen.getByText('Create Routine')).toBeTruthy();
  });
});

// ── 2. building a day, far past the old cap ─────────────────────────────────
describe('2 · building a stack, well past where the free cap used to stop', () => {
  it('takes a library item at four times the old limit', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP * 4) });
    expect(s.overLimit()).toBe(false);
    expect(s.addToStack({ title: 'one more' })).toBe(true);
    expect(s.getState().deckItems).toHaveLength(s.FREE_STACK_CAP * 4 + 1);
    nothingWasRefused(s);
  });

  it('keeps going to a hundred stacks, one at a time, through every add path', async () => {
    const s = await freshStore();
    // A fresh install already ships the four example slots, which is what made
    // the old cap bite so early — six usable slots for the life of the app.
    const started = s.getState().deckItems.length;
    expect(started).toBe(4);

    // Every door into the deck, not just the convenient one: a pasted link, an
    // affirmation, a document, a library row and a dated one-off. A cap left on
    // any single path is a feature that stops working at an arbitrary moment.
    for (let i = 0; i < 20; i++) {
      expect(s.addToStack({ title: 'library ' + i })).toBe(true);
      expect(s.addCustomUrl('https://example.com/clip-' + i).ok).toBe(true);
      s.setState({ noteText: 'affirmation ' + i });
      expect(s.addNote().ok).toBe(true);
      expect(s.addDocToToday('plan-' + i + '.pdf', 'file-' + i).ok).toBe(true);
      expect(s.addItemToDate({ title: 'dated ' + i }, s.todayKey()).ok).toBe(true);
    }
    expect(s.getState().deckItems).toHaveLength(started + 100);
    nothingWasRefused(s);
  });

  it('imports a twenty-stack programme in one batch, onto an already-full day', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP * 3) });
    const out = s.addItemsToToday(deck(20, 'batch').map((d) => ({ ...d, repeat: 'once' })));
    expect(out.ok).toBe(true);
    expect(out.count).toBe(20);
    nothingWasRefused(s);
  });
});

// ── 3. the routine builder ──────────────────────────────────────────────────
describe('3 · the routine builder: make one, edit it, use it, bin it', () => {
  it('runs the whole life of a routine with no account', async () => {
    const s = await freshStore();

    const r = s.createRoutine('Morning reset', s.routineItemsForSave([
      { title: 'Breath work', time: '07:00', repeat: 'daily' },
      { title: 'Wall slides', time: '07:20', repeat: 'daily' },
      { title: 'Clinic review', time: '10:00', repeat: 'weekly', dayOffset: 7 },
    ]));
    expect(r).not.toBeNull();
    nothingWasRefused(s);

    // Rename — the gate `updateRoutine` used to be missing and then had.
    expect(s.updateRoutine(r.id, { name: 'Evening reset' })).toBe(true);
    expect(s.getState().routines[0].name).toBe('Evening reset');

    // Edit the contents, not just the label.
    expect(s.updateRoutine(r.id, {
      items: s.routineItemsForSave([...r.items, { title: 'Sleep wind-down', time: '21:30' }]),
    })).toBe(true);
    expect(s.getState().routines[0].items).toHaveLength(4);

    // Drop it onto a day, which is the only thing a saved routine is FOR.
    const applied = s.applyRoutineToDate(r.id, s.todayKey());
    expect(applied.ok).toBe(true);
    expect(applied.count).toBe(4);
    expect(applied.upsell).toBeUndefined();
    // The day-7 stack landed a week out, not flattened onto today — the whole
    // point of prescribing a schedule rather than a to-do list.
    const weekOut = s.getState().deckItems.find((it) => it.title === 'Clinic review');
    expect(weekOut.anchor).toBe(s.dateKeyFromOffset(7));
    expect(weekOut.repeat).toBe('weekly');
    nothingWasRefused(s);

    s.deleteRoutine(r.id);
    expect(s.getState().routines).toEqual([]);
    nothingWasRefused(s);
  });

  it('keeps writing routines past any number that used to be a limit', async () => {
    const s = await freshStore();
    for (let i = 0; i < 25; i++) {
      expect(s.createRoutine('Programme ' + i, [{ title: 'step', time: '08:00' }])).not.toBeNull();
    }
    expect(s.getState().routines).toHaveLength(25);
    // On this person's own device, not just in memory.
    expect(JSON.parse(localStorage.getItem(LS('routines')))).toHaveLength(25);
    nothingWasRefused(s);
  });

  it('puts the builder on the Routines shelf for someone with no account', () => {
    throughTheDoor();
    store.setTab('routines');
    render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);
    // The builder itself, not a description of it behind a locked card.
    expect(screen.getByText('Create Routine')).toBeTruthy();
    expect(screen.getByText(/Bundle stacks into a named routine/i)).toBeTruthy();
    expect(screen.queryByText(/not on this account/i)).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('offers share, schedule and delete on a saved routine, with no lock on any of them', () => {
    throughTheDoor();
    store.setTab('routines');
    store.createRoutine('Shoulder rehab', [{ title: 'Pendulum swings', time: '08:00' }]);
    render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);
    expect(screen.getByLabelText('Share routine')).toBeTruthy();
    expect(screen.getByLabelText('Add routine to a day')).toBeTruthy();
    expect(screen.getByLabelText('Delete routine')).toBeTruthy();
    expect(screen.queryByLabelText(/unlock/i)).toBeNull();
  });
});

// ── 4. SHARING — the one Vic named ─────────────────────────────────────────
// Two app instances, two devices, nobody signed in on either. This is the step
// that used to be the premium gate that mattered most, on BOTH halves: the
// practitioner needed Premium to have a routine to send at all (createRoutine),
// and the client needed it to keep what arrived (createRoutine again, from the
// receive sheet). Either refusal breaks the product's main journey.
describe('4 · sending a routine to someone else, and them keeping it', () => {
  it('travels from one unpaid device to another and is saved there', async () => {
    // ── the practitioner's phone ──
    const sender = await freshStore();
    const routine = sender.createRoutine('Shoulder rehab — weeks 1-6', sender.routineItemsForSave([
      { title: 'Pendulum swings', meta: '2 min each arm', url: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', time: '08:00', repeat: 'daily' },
      { title: 'Wall slides', time: '08:20', repeat: 'daily' },
      { title: 'Review with the clinic', time: '10:00', repeat: 'weekly', dayOffset: 7 },
    ]));
    expect(routine).not.toBeNull();
    nothingWasRefused(sender);

    // The real sender, the one the Share button calls. null here would mean the
    // app silently fell back to the .md file — covered separately in block 5,
    // and not what a client taps in WhatsApp.
    const link = sender.routineToLink(routine);
    expect(typeof link).toBe('string');
    expect(link).toContain('#r=');

    // ── the client's phone: a different device entirely ──
    localStorage.clear();
    sessionStorage.clear();
    const client = await freshStore();
    // Prove it really is a second device before relying on anything it says.
    expect(client).not.toBe(sender);
    expect(client.getState().routines).toEqual([]);
    expect(client.getState().signedIn).toBe(false);
    expect(client.getState().premiumPaid).toBe(false);

    const res = client.parseRoutineLink(link);
    expect(res.ok).toBe(true);
    expect(res.name).toBe('Shoulder rehab — weeks 1-6');
    expect(res.items).toHaveLength(3);
    expect(res.dropped).toBe(0);

    // Held, not taken: nothing is theirs until they answer for it.
    client.setPendingShare({ name: res.name, items: res.items, dropped: res.dropped });
    expect(client.getState().routines).toEqual([]);
    expect(client.getState().deckItems.some((it) => it.title === 'Wall slides')).toBe(false);

    // ── the answer: "Save to my Routines" ──
    const saved = client.createRoutine(res.name, client.routineItemsForSave(res.items));
    expect(saved).not.toBeNull();
    nothingWasRefused(client);

    // It is on the CLIENT's own device now.
    const onDisk = JSON.parse(localStorage.getItem(LS('routines')));
    expect(onDisk).toHaveLength(1);
    expect(onDisk[0].name).toBe('Shoulder rehab — weeks 1-6');
    expect(onDisk[0].items).toHaveLength(3);

    // AND THE PRESCRIPTION SURVIVED THE TRIP. A link that arrives as three
    // things to do this morning is not the programme that was sent, and the
    // client has no way of knowing the difference.
    expect(onDisk[0].items[2].dayOffset).toBe(7);
    expect(onDisk[0].items[2].repeat).toBe('weekly');
    expect(onDisk[0].items[0].time).toBe('08:00');
    expect(onDisk[0].items[0].url).toBe('https://www.youtube.com/watch?v=v7AYKMP6rOE');
    // The internal in-flight name never reaches disk — writing it there is how a
    // day-21 stack came back as day 0 the next time it was shared.
    expect(JSON.stringify(onDisk)).not.toContain('_day');

    // And they can then use it, which is the point of keeping it.
    const applied = client.applyRoutineToDate(saved.id, client.todayKey());
    expect(applied.ok).toBe(true);
    expect(applied.count).toBe(3);
    nothingWasRefused(client);
  });

  it('is saved by the sheet\'s own button, with no refusal anywhere on screen', () => {
    throughTheDoor();
    // Built by the real pair rather than by hand, so this is the same programme
    // the block above put on the wire.
    const r = { name: 'Shoulder rehab — weeks 1-6', items: [
      { title: 'Pendulum swings', time: '08:00', repeat: 'daily' },
      { title: 'Review with the clinic', time: '10:00', repeat: 'weekly', dayOffset: 7 },
    ] };
    const res = store.parseRoutineLink(store.routineToLink(r));
    expect(res.ok).toBe(true);
    store.setPendingShare({ name: res.name, items: res.items, dropped: res.dropped });

    render(<SharedRoutineSheet />);
    // The schedule is disclosed, so the person can see what they are accepting.
    expect(screen.getByText('Shoulder rehab — weeks 1-6')).toBeTruthy();
    expect(screen.getByText(/10:00 · Weekly · from day 7/)).toBeTruthy();

    fireEvent.click(screen.getByText('Save to my Routines'));

    expect(screen.getByText(/Saved .* to your Routines/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(LS('routines')))).toHaveLength(1);
    expect(store.getState().pendingShare).toBeNull();
    nothingWasRefused();
  });

  it('shows nothing from the refusal card at any point in receiving one', () => {
    throughTheDoor();
    store.setPendingShare({ name: 'Programme', items: [{ title: 'Step one', time: '09:00' }] });
    render(<><SharedRoutineSheet /><GateNotice /></>);
    fireEvent.click(screen.getByText('Save to my Routines'));
    // The refusal card is mounted the whole time and renders nothing, which is
    // the difference between "the gate did not fire" and "the gate is not there".
    expect(screen.queryByText(/not on your plan/i)).toBeNull();
    expect(screen.queryByText(/part of premium/i)).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
    nothingWasRefused();
  });

  it('adds a shared programme straight to today instead, if that is the answer', () => {
    throughTheDoor();
    store.setState({ deckItems: deck(store.FREE_STACK_CAP * 2) });
    store.setPendingShare({ name: 'Six weeks', items: deck(20, 'shared').map((d) => ({ ...d, time: '09:00' })) });
    render(<SharedRoutineSheet />);
    fireEvent.click(screen.getByText('Add all to today'));
    // Twenty stacks on top of twenty already there. "That's more stacks than
    // this plan holds" is the refusal this path used to produce.
    expect(screen.getByText(/20 stacks added to today/)).toBeTruthy();
    expect(screen.queryByText(/more stacks than this plan holds/i)).toBeNull();
    nothingWasRefused();
  });

  it('sends sixty short stacks on one link, and all sixty arrive', async () => {
    const sender = await freshStore();
    // PLAN_MAX_ITEMS is the decoder's ceiling and the sender refuses above it,
    // falling back to the file. At the ceiling exactly, the link must carry the
    // whole thing — a programme silently arriving a third short is the failure
    // this pins, and it is invisible to both ends.
    //
    // SHORT titles, because the ITEM ceiling is not the binding one in practice
    // — the URL budget is. See the test below.
    const r = sender.createRoutine('Long course', deck(sender.PLAN_MAX_ITEMS, 'long').map((d, i) => ({
      title: d.title, time: '09:00', repeat: 'once', dayOffset: i % 60,
    })));
    const link = sender.routineToLink(r);
    expect(typeof link).toBe('string');

    localStorage.clear();
    const client = await freshStore();
    const res = client.parseRoutineLink(link);
    expect(res.ok).toBe(true);
    expect(res.items).toHaveLength(sender.PLAN_MAX_ITEMS);
    expect(res.dropped).toBe(0);
    expect(client.createRoutine(res.name, client.routineItemsForSave(res.items))).not.toBeNull();
    nothingWasRefused(client);
  });

  /**
   * WHERE "OPEN" STOPS BEING USABLE, AND IT IS NOT A GATE.
   *
   * Nothing refuses a long programme. But LINK_MAX_URL is 8,000 characters, and
   * a real practitioner's wording is nothing like `thing 7` — measured on the
   * payload this app actually emits, a six-week programme with sentence-length
   * titles and a video on each stack stops fitting one link at about 25 stacks,
   * and titles alone at about 40. Above that `routineToLink` returns null, the
   * sender is told "too long for a link — sharing it as a file instead", and the
   * programme goes as a .md attachment.
   *
   * THAT IS WHERE IT BREAKS DOWN FOR THE CLIENT, not for the practitioner: a .md
   * tapped in a message cannot open this app on a phone at all. Verified from
   * public/manifest.json this run — it declares neither `file_handlers` nor
   * `share_target` — and iOS gives a web app no way to claim a document type.
   *
   * So this test does not assert a limit is fine. It pins the threshold so the
   * fall to the file rail stays a known, measured fact rather than a surprise in
   * the field, and it proves the file still carries the WHOLE programme when the
   * link cannot.
   */
  it('falls to the file rail for a realistically-worded six-week programme, and loses nothing', async () => {
    const sender = await freshStore();
    const realistic = (n) => Array.from({ length: n }, (_, i) => ({
      title: 'Week ' + (1 + Math.floor(i / 10)) + ' — thoracic rotation with band, 2 x 12 each side',
      meta: '3 min each side, slow tempo',
      url: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', thumb: 'yt',
      time: '08:00', repeat: 'daily', dayOffset: i,
    }));

    // Twenty stacks of real wording still travel as a tappable link.
    const short = sender.createRoutine('Shoulder rehab — weeks 1-3', sender.routineItemsForSave(realistic(20)));
    expect(typeof sender.routineToLink(short)).toBe('string');

    // Forty do not. Null is the sender's signal to use the file, never a
    // truncated link — half a payload decodes to nothing at the far end and the
    // recipient cannot tell that from a broken app.
    const long = sender.createRoutine('Shoulder rehab — weeks 1-6', sender.routineItemsForSave(realistic(40)));
    expect(sender.routineToLink(long)).toBeNull();

    // And the file carries all forty, with the schedule intact — the rail has no
    // item cap, which is the whole reason it is the fallback.
    const md = sender.routineToMd(long);
    localStorage.clear();
    const client = await freshStore();
    const res = client.parseRoutineMd(md);
    expect(res.ok).toBe(true);
    expect(res.items).toHaveLength(40);
    // A freshly parsed item carries the in-flight `_day`; `routineItemsForSave`
    // is what turns it into the public `dayOffset` that goes on disk.
    expect(res.items[39]._day).toBe(39);
    expect(client.createRoutine(res.name, client.routineItemsForSave(res.items))).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(LS('routines')))[0].items[39].dayOffset).toBe(39);
    nothingWasRefused(client);
  });
});

// ── 5. the file rail ────────────────────────────────────────────────────────
describe('5 · receiving the same programme as a .md file', () => {
  it('round-trips through the file the app writes, and is kept', async () => {
    const sender = await freshStore();
    const r = sender.createRoutine('Rehab pack', sender.routineItemsForSave([
      { title: 'Pendulum swings', time: '08:00', repeat: 'daily' },
      { title: 'Review with the clinic', time: '10:00', repeat: 'weekly', dayOffset: 21 },
    ]));
    const md = sender.routineToMd(r);

    localStorage.clear();
    const client = await freshStore();
    const res = client.parseRoutineMd(md);
    expect(res.ok).toBe(true);
    expect(res.items).toHaveLength(2);

    // Both answers the import draft offers, and neither is refused.
    const added = client.addItemsToToday(res.items);
    expect(added.ok).toBe(true);
    expect(added.count).toBe(2);
    expect(client.createRoutine(res.name, client.routineItemsForSave(res.items))).not.toBeNull();
    // Three weeks out is still three weeks out — the day the export/import cycle
    // used to flatten to zero.
    expect(JSON.parse(localStorage.getItem(LS('routines')))[0].items[1].dayOffset).toBe(21);
    nothingWasRefused(client);
  });
});

// ── 6. the AI bridge ───────────────────────────────────────────────────────
describe('6 · the AI bridge plan path', () => {
  it('accepts a plan that would have been refused, onto a day already over the cap', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP * 2) });
    const parsed = s.parsePlanDoc({
      ppw: 'routine', v: 1, name: 'My week',
      items: deck(18, 'ai').map((d, i) => ({ title: d.title, time: '09:00', dayOffset: i % 7, repeat: 'once' })),
    });
    expect(parsed.ok).toBe(true);
    const out = s.addItemsToPlan(parsed.items);
    expect(out.ok).toBe(true);
    expect(out.count).toBe(18);
    nothingWasRefused(s);
  });

  it('rebuilds the whole day and lets Undo put it back', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP * 2) });
    const replaceIds = s.getState().deckItems.map((it) => it.id);
    const out = s.applyPlanRebuild(deck(30, 'new').map((d) => ({ title: d.title, time: '09:00' })), replaceIds);
    expect(out.ok).toBe(true);
    expect(out.count).toBe(30);
    expect(out.fits).toBeUndefined();
    s.restoreItems(out.removed);
    expect(s.getState().deckItems).toHaveLength(50);
    nothingWasRefused(s);
  });

  /**
   * THE PROMPT THE PERSON PASTES OUT IS PART OF THE PRODUCT, so a limit hiding
   * in it is a limit on the feature.
   *
   * `buildPrompt` writes the app's own headroom into the text the visitor copies
   * into their AI. Get it wrong and the refusal happens where nobody can see it:
   * the AI is told "my app is completely full, do not send me a plan block yet"
   * and dutifully doesn't, while the store would have taken every item.
   *
   * ⚠ WHY THIS IS A LOOP OVER ENTITLEMENT PATHS AND NOT ONE ASSERTION.
   * `buildPrompt` decides between the full plan and the capped one by reading
   * `S.premium` RAW (aiPrompt.js:152) rather than by asking `premiumGated()` the
   * way every gate in store5.js does. That makes this the one surface where a
   * stray `premium: false` would quietly re-cap the product — so what keeps the
   * AI bridge open is not the prompt's own logic but the invariant that nothing
   * in the app can write that false. Every writer of `state.premium` sets it
   * from PREMIUM_OPEN (store5.js:255, 371, 1671, 1716, 1723, 1733). This test
   * holds that invariant down from the OUTSIDE: if anyone adds a seventh writer
   * that can leave it false, the prompt goes capped and this fails.
   */
  it('asks for a full plan on every path the app can actually arrive by', async () => {
    const s = await freshStore();
    const { buildPrompt } = await import('./assistant/aiPrompt.js');

    // The four ways a visitor's entitlement is decided. None involves a payment.
    const paths = [
      ['a fresh install', () => {}],
      ['signing out', () => s.signOutMembership()],
      ['the server reporting no purchase', () => s.applyServerEntitlement({ premium: false })],
      ['a signed-out entitlement read', () => s.syncEntitlement()],
    ];
    for (const [name, arriveBy] of paths) {
      await arriveBy();
      expect(s.getState().premium, name).toBe(true);
      const prompt = buildPrompt(s.getState());
      expect(prompt, name).toMatch(/room for 60 more things/);
      expect(prompt, name).toMatch(/today and the next 6 days/);
      expect(prompt, name).not.toMatch(/completely full/i);
      nothingWasRefused(s);
    }
  });

  /**
   * THE ROUND TRIP CANNOT END IN A REFUSAL.
   *
   * The user leaves the app, pastes the prompt into their AI, waits, comes back
   * and taps Apply. If the number the prompt asked for is bigger than what
   * `addItemsToPlan` will accept, that whole trip ends in a wall — the exact
   * fault the old `Math.max(1, cap - used)` headroom caused. So read the number
   * out of the real prompt and make the real store swallow it.
   */
  it('asks for a number the store will actually accept, on a day already over the old cap', async () => {
    const s = await freshStore();
    const { buildPrompt } = await import('./assistant/aiPrompt.js');
    s.setState({ deckItems: deck(s.FREE_STACK_CAP * 3) });

    const asked = Number(/at most (\d+) items?/.exec(buildPrompt(s.getState()))[1]);
    expect(asked).toBe(60);

    const out = s.addItemsToPlan(deck(asked, 'ai').map((d) => ({ title: d.title, time: '09:00' })));
    expect(out.ok).toBe(true);
    expect(out.count).toBe(asked);
    nothingWasRefused(s);
  });
});

// ── 7. protocols ───────────────────────────────────────────────────────────
describe('7 · protocols, including the ones that used to be sold', () => {
  const library = () => render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);

  it('opens a protocol that is marked monetised, with no padlock and no refusal', () => {
    throughTheDoor();
    store.setTab('protocols');
    store.setState({
      protocolsStatus: 'ready',
      protocols: [
        { id: 'free-1', title: 'Myofascial Recovery', category: 'recovery', version: '1', register: 'free', url: 'protocols/pdf/free-1.pdf' },
        { id: 'paid-1', title: 'Testosterone Protocol', category: 'testosterone', version: '1', register: 'monetised', url: 'protocols/pdf/paid-1.pdf' },
      ],
    });
    library();

    expect(screen.getByText('Testosterone Protocol')).toBeTruthy();
    // Two protocols, two open "View" links — the monetised one included.
    expect(screen.getAllByLabelText('View protocol')).toHaveLength(2);
    expect(screen.queryByText(/^Locked · /)).toBeNull();
    expect(screen.queryByLabelText(/is locked$/)).toBeNull();
    expect(screen.queryByLabelText(/^Why .* is locked$/)).toBeNull();
  });

  it('quick-adds a monetised protocol to today instead of explaining a limit', () => {
    throughTheDoor();
    store.setTab('protocols');
    store.setState({
      protocolsStatus: 'ready',
      protocols: [{ id: 'paid-1', title: 'Testosterone Protocol', category: 'testosterone', version: '1', register: 'monetised', url: 'protocols/pdf/paid-1.pdf' }],
    });
    library();

    fireEvent.click(screen.getByLabelText("Add to today's stack"));
    expect(store.getState().deckItems.some((it) => it.title === 'Testosterone Protocol')).toBe(true);
    nothingWasRefused();
  });
});

// ── 8. the day itself ──────────────────────────────────────────────────────
describe('8 · the calendar, repeats, reminders, notes and documents', () => {
  it('schedules, repeats and reshapes a day of a hundred stacks', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP * 10) });

    // A one-off on a date three weeks out, from the calendar's day picker.
    const future = s.dateKeyFromOffset(21);
    const made = s.addItemToDate({ title: 'Clinic review', time: '10:00' }, future);
    expect(made.ok).toBe(true);
    expect(s.itemsForDate(future).some((it) => it.title === 'Clinic review')).toBe(true);
    expect(s.itemsForDate(s.todayKey()).some((it) => it.title === 'Clinic review')).toBe(false);

    // Repeats, times, untimed, autoplay, done/undone — the card's whole control set.
    const id = made.item.id;
    s.setRepeat(id, 'weekly');
    expect(s.getState().deckItems.find((it) => it.id === id).repeat).toBe('weekly');
    s.setItemTime(id, '11:30');
    expect(s.getState().deckItems.find((it) => it.id === id).time).toBe('11:30');
    s.setNoTime(id, true);
    expect(s.getState().deckItems.find((it) => it.id === id).time).toBeNull();
    s.setNoTime(id, false);
    s.toggleAuto(id);
    s.markDone(id, future);
    expect(s.itemsForDate(future).find((it) => it.id === id).done).toBe(true);
    s.undoDone(id, future);
    expect(s.itemsForDate(future).find((it) => it.id === id).done).toBe(false);
    nothingWasRefused(s);

    // Reminders — the setting the slot engine reads.
    s.setReminders(true);
    expect(s.getState().reminders).toBe(true);
    nothingWasRefused(s);
  });

  it('writes notes and documents with the day already far past the old cap', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP * 5), noteText: 'I did enough today.' });
    expect(s.addNote().ok).toBe(true);
    expect(s.addDocToToday('discharge-summary.pdf', 'idb-1').ok).toBe(true);
    expect(s.getState().deckItems).toHaveLength(s.FREE_STACK_CAP * 5 + 2);
    nothingWasRefused(s);
  });

  it('bulk-selects and deletes without a limit showing up on the way out', async () => {
    const s = await freshStore();
    s.setState({ deckItems: deck(40) });
    s.selectAll(s.getState().deckItems.slice(0, 15).map((it) => it.id));
    s.deleteSelected();
    expect(s.getState().deckItems).toHaveLength(25);
    nothingWasRefused(s);
  });
});

// ── 9. the Library's four shelves ──────────────────────────────────────────
describe('9 · every Library tab, with nothing withheld on any of them', () => {
  const library = () => render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);

  it('opens all four and offers no price, padlock or upgrade on any', () => {
    throughTheDoor();
    store.setState({
      protocolsStatus: 'ready',
      mediaItems: [{ id: 'm1', title: 'Yoga For Complete Beginners', meta: 'YouTube · 20 min', thumb: 'yt' }],
      protocols: [{ id: 'p1', title: 'Myofascial Recovery', category: 'recovery', version: '1', register: 'monetised', url: 'protocols/pdf/p1.pdf' }],
    });

    for (const tab of ['routines', 'media', 'protocols', 'supps']) {
      cleanup();
      store.setTab(tab);
      library();
      const text = document.body.textContent;
      expect(text, tab).not.toMatch(/\$\s?\d/);
      expect(text, tab).not.toMatch(/go premium|unlock routines|free plan/i);
      expect(screen.queryByLabelText(/unlock/i), tab).toBeNull();
      nothingWasRefused();
    }
  });

  it('ticks a supplement and schedules it, with no tier anywhere near the shelf', () => {
    throughTheDoor();
    store.setTab('supps');
    library();

    // The real control a visitor taps. Selection is the component's own state,
    // not the store's, so this has to go through the screen.
    const tick = screen.getByLabelText('Select Magnesium Glycinate');
    expect(tick.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(tick);
    expect(screen.getByLabelText('Select Magnesium Glycinate').getAttribute('aria-checked')).toBe('true');

    // And onto a day, which is the thing the shelf is for.
    fireEvent.click(screen.getByLabelText('Add Magnesium Glycinate to a day'));
    expect(store.getState().scheduleTarget).toBeTruthy();
    expect(store.getState().scheduleTarget.type).toBe('item');
    nothingWasRefused();
  });
});

// ── 10. the demo in the website iframe ─────────────────────────────────────
// A prospect on ppwellness.co meets the app through `?demo=1`. There is nothing
// to sell them either, so there must be nothing locked in front of them — and
// no code door, since they have not been given a code.
describe('10 · the prospect in the marketing-page iframe', () => {
  afterEach(() => at('/'));

  it('opens the whole product, claiming no membership and asking for no code', async () => {
    at('/?demo=1');
    const s = await freshStore();
    expect(s.getState().premium).toBe(true);
    expect(s.getState().premiumPaid).toBe(false);
    expect(s.premiumGated(s.getState())).toBe(false);
    // No licence on this device and none minted — the demo door stands BESIDE
    // the code door rather than opening it.
    expect(hasAccess()).toBe(false);
    render(<AccessGate />);
    expect(document.body.textContent.trim()).toBe('');
  });

  it('lets a prospect build and keep a routine for the length of the visit', async () => {
    at('/?demo=1');
    const s = await freshStore();
    // The demo ships one example routine, so a prospect's own is the second.
    const before = s.getState().routines.length;
    expect(s.createRoutine('Our studio morning', [{ title: 'Mobility', time: '07:00' }])).not.toBeNull();
    expect(s.getState().routines).toHaveLength(before + 1);
    nothingWasRefused(s);
    // Open, and STILL writing nothing to the visitor's browser — the two are
    // not in tension: lsWrite is a no-op under the demo, so the product is fully
    // usable for the visit and gone on the next load.
    expect(localStorage.getItem(LS('routines'))).toBeNull();
  });

  it('lets a prospect push past the old cap and take a shared programme', async () => {
    at('/?demo=1');
    const s = await freshStore();
    s.setState({ deckItems: deck(s.FREE_STACK_CAP * 3) });
    expect(s.overLimit()).toBe(false);
    expect(s.addToStack({ title: 'one more' })).toBe(true);

    const res = s.parseRoutineLink(s.routineToLink({
      name: 'Try this with your members', items: [{ title: 'Breath work', time: '07:00', repeat: 'daily' }],
    }));
    expect(res.ok).toBe(true);
    s.setPendingShare({ name: res.name, items: res.items, dropped: res.dropped });
    expect(s.createRoutine(res.name, s.routineItemsForSave(res.items))).not.toBeNull();
    nothingWasRefused(s);
  });
});
