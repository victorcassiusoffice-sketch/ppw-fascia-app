// The guards on the share rails (2026-10-05, review pass).
//
// Every test here pins a defect the first cut of the link rail shipped with.
// They are about what the two PEOPLE get — the practitioner who sends a
// programme and the client who receives it — not about the shape of the codec,
// which routine-link.test.js already covers.
//
// The six faults:
//   1. The sender encoded every stack; the receiver kept 60 and said nothing.
//   2. Day offsets were clamped to 27, so weeks 5 and 6 of a six-week course
//      collapsed onto one day.
//   3. '99:99' was accepted as a clock time, so the stack never reminded.
//   4. Two applies in the same millisecond minted the same stack ids.
//   5. The free-cap refusal said something false and offered a dead remedy.
//   6. parseYouTubeId matched a hostname anywhere in the url, so a stranger's
//      link could wear a real YouTube thumbnail and play a real YouTube video
//      while "Open" went to the attacker's host.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── THE PAID BUILD, ON DEMAND (2026-10-05) ──────────────────────────────────
// The shipped build is OPEN: PREMIUM_OPEN in membership.js is true, so the B2B
// pivot leaves nothing gated and no refusal can happen. Any test below that
// describes a REFUSAL is therefore describing the PAID build, and calls
// paidBuild() first — which flips the switch back through this getter and proves
// that gate still bites. Every other test in this file runs the app as it ships.
vi.mock('./membership.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get PREMIUM_OPEN() { return globalThis.__ppwPaidBuild !== true; },
}));
/** Put the paywall back, for one test. Cleared before every test. */
const paidBuild = () => { globalThis.__ppwPaidBuild = true; };

import { render, cleanup, screen, fireEvent } from '@testing-library/react';

async function freshStore() {
  vi.resetModules();
  return await import('./store5.js');
}

// Built by hand, not by the encoder: a crafted payload is exactly what the
// decoder's own ceilings exist for.
function payload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const linkFor = (obj) => '#r=' + payload(obj);

// A real programme shape: short daily cues, no urls. This is the case the URL
// budget never catches, because 70 of them fit in one link comfortably.
const cues = (n) => ({
  name: 'Daily cues — twelve weeks',
  items: Array.from({ length: n }, (_, i) => ({ title: 'Day ' + (i + 1) + ' cue' })),
});

beforeEach(() => { delete globalThis.__ppwPaidBuild; localStorage.clear(); vi.useRealTimers(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('1. a programme past the stack ceiling is refused, never quietly shortened', () => {
  it('refuses to build a link above the ceiling even though it would have fitted', async () => {
    const s = await freshStore();

    const atCeiling = s.routineToLink(cues(s.PLAN_MAX_ITEMS));
    expect(atCeiling).not.toBeNull();
    // The point of this test: the refusal below is NOT the URL budget. Sixty of
    // these stacks fit with thousands of characters to spare, so sixty-one
    // would have fitted too — and used to, arriving one stack short.
    expect(atCeiling.length).toBeLessThan(s.LINK_MAX_URL / 2);

    expect(s.routineToLink(cues(s.PLAN_MAX_ITEMS + 1))).toBeNull();
    expect(s.routineToLink(cues(84))).toBeNull();
  });

  it('hands the whole programme to the file rail the sender falls back to', async () => {
    const s = await freshStore();
    const r = cues(84);
    // null is the signal to share the .md file instead, so the file must be the
    // lossless one — otherwise refusing the link loses the tail either way.
    expect(s.routineToLink(r)).toBeNull();
    const back = s.parseRoutineMd(s.routineToMd(r));
    expect(back.ok).toBe(true);
    expect(back.items).toHaveLength(84);
    expect(back.items[83].title).toBe('Day 84 cue');
  });

  it('tells the recipient how many stacks the ceiling dropped', async () => {
    const s = await freshStore();
    const many = Array.from({ length: 70 }, (_, i) => ({ t: 'Stack ' + i }));

    const r = s.parseRoutineLink(linkFor({ p: 'ppwr', v: 1, n: 'Flood', i: many }));

    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(s.PLAN_MAX_ITEMS);
    expect(r.dropped).toBe(10); // was: nothing in the result said so at all
  });

  it('reports nothing dropped for a programme that arrived whole', async () => {
    const s = await freshStore();
    const r = s.parseRoutineLink(s.routineToLink(cues(6)));
    expect(r.items).toHaveLength(6);
    expect(r.dropped).toBe(0);
  });

  it('keeps the dropped count on the held share, and on its disk mirror', async () => {
    const s = await freshStore();
    s.setPendingShare({ name: 'Flood', items: [{ title: 'One' }], dropped: 10 });

    expect(s.getState().pendingShare.dropped).toBe(10);
    // the mirror the first-run doors rely on, written under the store's own key
    expect(JSON.parse(localStorage.getItem('ppw5.pendingShare')).dropped).toBe(10);
  });

  it('still knows the count after the reload the first-run doors cause', async () => {
    // The new recipient meets the first-run choice and the terms gate before
    // the sheet is ever shown, which is why the share is mirrored to disk at
    // all. If the count did not come back with it, it would be lost on the one
    // path it matters on.
    localStorage.setItem('ppw5.pendingShare', JSON.stringify({ name: 'Twelve weeks', items: [{ title: 'Day 1 cue' }], dropped: 24 }));

    const s = await freshStore(); // a cold boot, not a re-render

    expect(s.getState().pendingShare.dropped).toBe(24);
  });

  it('shows the recipient the stacks that did not fit, instead of a short programme', async () => {
    const s = await freshStore();
    const SharedRoutineSheet = (await import('./screens/SharedRoutineSheet.jsx')).default;
    s.setState({ onboarded: true, firstRunChoice: true, premium: true });
    s.setPendingShare({ name: 'Twelve weeks', items: [{ title: 'Day 1 cue' }], dropped: 24 });

    render(<SharedRoutineSheet />);

    expect(screen.getByText(/24 stacks/i)).toBeTruthy();
    expect(screen.getByText(/ask .*for the file/i)).toBeTruthy();
  });
});

describe('2. a six-week programme keeps its weeks', () => {
  const WEEKS = {
    name: 'Shoulder rehab — six weeks',
    items: [0, 7, 14, 21, 28, 35, 41].map((d) => ({ title: 'Week ' + (Math.floor(d / 7) + 1), dayOffset: d })),
  };
  const DAYS = [0, 7, 14, 21, 28, 35, 41];

  it('carries week five, week six and the discharge review on the link rail', async () => {
    const s = await freshStore();
    const back = s.parseRoutineLink(s.routineToLink(WEEKS));
    // Was [0,7,14,21,27,27,27]: three prescribed days merged into one.
    expect(back.items.map((i) => i._day)).toEqual(DAYS);
  });

  it('carries them on the file rail too', async () => {
    const s = await freshStore();
    const back = s.parseRoutineMd(s.routineToMd(WEEKS));
    expect(back.items.map((i) => i._day)).toEqual(DAYS);
  });

  it('keeps them when the client saves the programme to their Routines', async () => {
    const s = await freshStore();
    const saved = s.routineItemsForSave(s.parseRoutineLink(s.routineToLink(WEEKS)).items);
    expect(saved.map((i) => i.dayOffset || 0)).toEqual(DAYS);
  });

  it('puts week six on its own date when the programme is dropped on a day', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [], doneByDate: {}, premium: true, routines: [{ id: 'r1', name: 'Six weeks', items: WEEKS.items }] });

    expect(s.applyRoutineToDate('r1', '2026-10-28').ok).toBe(true);

    const anchors = s.getState().deckItems.map((i) => i.anchor);
    // Week 5, week 6 and the discharge review used to all land on 2026-11-24.
    expect(anchors[4]).toBe('2026-11-25');
    expect(anchors[5]).toBe('2026-12-2');
    expect(anchors[6]).toBe('2026-12-8');
    expect(new Set(anchors).size).toBe(7);
  });

  it('still holds the AI bridge to its own four-week planning ceiling', async () => {
    const s = await freshStore();
    const p = s.parsePlanDoc({ ppw: 'routine', name: 'AI plan', items: [{ title: 'Later', dayOffset: 35 }] });
    expect(p.items[0]._day).toBe(s.PLAN_MAX_OFFSET);
  });

  it('still clamps a hostile offset rather than hiding the stack for ever', async () => {
    const s = await freshStore();
    const r = s.parseRoutineLink(linkFor({ p: 'ppwr', v: 1, n: 'Far', i: [{ t: 'Someday', d: 99999 }, { t: 'Negative', d: -5 }] }));
    expect(r.items[0]._day).toBe(s.SHARE_MAX_OFFSET);
    expect(r.items[1]._day).toBe(0);
  });
});

describe('3. a clock time the clock cannot reach is dropped, not stored', () => {
  const IMPOSSIBLE = ['99:99', '24:00', '7:60', '25:30', '-1:00'];

  it('drops an impossible time off a link', async () => {
    const s = await freshStore();
    for (const h of IMPOSSIBLE) {
      const r = s.parseRoutineLink(linkFor({ p: 'ppwr', v: 1, n: 'Bad clock', i: [{ t: 'Never fires', h }] }));
      // Stored verbatim, the slot engine's `x.time === hm` could never match it,
      // the <input type="time"> rendered blank, and the .ics export said it had
      // worked. The default time is applied downstream instead.
      expect(r.items[0].time, h).toBeUndefined();
    }
  });

  it('drops an impossible time out of a file', async () => {
    const s = await freshStore();
    for (const time of IMPOSSIBLE) {
      const md = '```ppw-routine\n' + JSON.stringify({ ppw: 'routine', v: 1, name: 'x', items: [{ title: 'Never fires', time }] }) + '\n```';
      expect(s.parseRoutineMd(md).items[0].time, time).toBeUndefined();
    }
  });

  it('pads a single-digit hour so the reminder can match the clock', async () => {
    const s = await freshStore();
    // '7:30' is a real time a person means, and the slot engine compares against
    // a zero-padded clock, so an unpadded one never fires either.
    expect(s.parseRoutineLink(linkFor({ p: 'ppwr', v: 1, n: 'x', i: [{ t: 'Morning', h: '7:30' }] })).items[0].time).toBe('07:30');
    expect(s.parseRoutineLink(s.routineToLink({ name: 'x', items: [{ title: 'Morning', time: '7:30' }] })).items[0].time).toBe('07:30');
    const md = '```ppw-routine\n' + JSON.stringify({ ppw: 'routine', v: 1, name: 'x', items: [{ title: 'Morning', time: '7:30' }] }) + '\n```';
    expect(s.parseRoutineMd(md).items[0].time).toBe('07:30');
  });

  it('does not build a stack on an impossible time already saved on disk', async () => {
    const s = await freshStore();
    // What the loose regex left in ppw5.routines before this was fixed. The
    // stack it makes must still be one the slot engine can fire and the .ics
    // export can carry, so the bad value is replaced, not copied.
    s.setState({
      deckItems: [], doneByDate: {}, premium: true,
      routines: [{ id: 'r1', name: 'Imported last week', items: [{ title: 'Never fired', time: '99:99' }] }],
    });

    s.applyRoutineToDate('r1', '2026-11-3');
    expect(s.getState().deckItems[0].time).toBe('09:00');

    s.setState({ deckItems: [] });
    s.addItemsToToday([{ title: 'Never fired', time: '24:00' }]);
    expect(s.getState().deckItems[0].time).toBe('09:00');
  });

  it('leaves a real time alone', async () => {
    const s = await freshStore();
    const r = s.parseRoutineLink(s.routineToLink({ name: 'x', items: [{ title: 'Evening', time: '18:45' }] }));
    expect(r.items[0].time).toBe('18:45');
  });
});

describe('4. two applies never mint the same stack id', () => {
  it('keeps every id distinct when "Add all to today" is tapped twice in one millisecond', async () => {
    const s = await freshStore();
    vi.spyOn(Date, 'now').mockReturnValue(1790000000000);
    s.setState({ deckItems: [], doneByDate: {}, premium: true });
    const items = [{ title: 'Pendulum swings' }, { title: 'Wall slides' }];

    s.addItemsToToday(items);
    s.addItemsToToday(items);

    const ids = s.getState().deckItems.map((i) => i.id);
    expect(ids).toHaveLength(4);
    // Duplicate ids make deleteItem remove two rows and markDone tick two —
    // the exact collision uid() exists to prevent.
    expect(new Set(ids).size).toBe(4);
    s.deleteItem(ids[0]);
    expect(s.getState().deckItems).toHaveLength(3);
  });

  it('keeps every id distinct when a routine is dropped on two days in one millisecond', async () => {
    const s = await freshStore();
    vi.spyOn(Date, 'now').mockReturnValue(1790000000000);
    s.setState({ deckItems: [], doneByDate: {}, premium: true, routines: [{ id: 'r1', name: 'r', items: [{ title: 'Mobility' }, { title: 'Carries' }] }] });

    s.applyRoutineToDate('r1', '2026-11-3');
    s.applyRoutineToDate('r1', '2026-11-10');

    const ids = s.getState().deckItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(4);
  });
});

// Every test in this block is about a REFUSAL, so the whole block runs the paid
// build — on the shipped build there is no cap to refuse anything (paidBuild()).
describe('5. the free-cap refusal says something true', () => {
  beforeEach(() => paidBuild());
  const batch = (n) => Array.from({ length: n }, (_, i) => ({ title: 'Prescribed stack ' + (i + 1) }));
  const examples = () => Array.from({ length: 4 }, (_, i) => ({ id: 'ex' + i, title: 'Example ' + i, time: '08:00', example: true }));

  it('does not tell a client with four stacks that they have reached the limit', async () => {
    const s = await freshStore();
    s.setState({ premium: false, deckItems: examples(), doneByDate: {} });

    expect(s.addItemsToToday(batch(20)).upsell).toBe(true);

    const msg = s.getState().premiumUpsell;
    expect(msg).not.toBe(s.FREE_CAP_UPSELL);
    expect(msg).not.toMatch(/reached/i); // they are at 4 of 10
    expect(msg).toContain('20');
    expect(msg).toContain(String(s.FREE_STACK_CAP));
  });

  it('does not offer to clear the examples when clearing them cannot help', async () => {
    const s = await freshStore();
    s.setState({ premium: false, deckItems: examples(), doneByDate: {} });
    s.addItemsToToday(batch(20));
    // Four freed slots cannot hold twenty stacks, and tapping the button
    // emptied the starter deck for nothing.
    expect(s.freeSlotAdviceApplies(s.getState())).toBe(false);
  });

  it('still offers it when freeing those slots would make room', async () => {
    const s = await freshStore();
    s.setState({ premium: false, deckItems: examples(), doneByDate: {} });

    expect(s.addItemsToToday(batch(7)).upsell).toBe(true);

    expect(s.freeSlotAdviceApplies(s.getState())).toBe(true);
    const msg = s.getState().premiumUpsell;
    expect(msg).toContain('7');
    expect(msg).toContain('4'); // in use
  });

  it('keeps the at-the-cap sentence for a client who really is at the cap', async () => {
    const s = await freshStore();
    s.setState({ premium: false, deckItems: Array.from({ length: s.FREE_STACK_CAP }, (_, i) => ({ id: 'x' + i, title: 'own ' + i })), doneByDate: {} });

    expect(s.addToStack({ title: 'One more' })).toBe(false);

    expect(s.getState().premiumUpsell).toBe(s.FREE_CAP_UPSELL);
    expect(s.freeSlotAdviceApplies(s.getState())).toBe(true);
  });

  it('shows the paywall the true sentence and no dead remedy', async () => {
    const s = await freshStore();
    const UpsellModal = (await import('./screens/UpsellModal.jsx')).default;
    s.setState({ premium: false, onboarded: true, accountOpen: false, deckItems: examples(), doneByDate: {} });
    s.addItemsToToday(batch(20));

    render(<UpsellModal />);

    expect(screen.getByText(/20 stacks/i)).toBeTruthy();
    expect(screen.queryByText('Clear the examples')).toBeNull();
    expect(screen.queryByText(/Clearing them frees their slots/i)).toBeNull();
  });

  it('keeps the clear-the-examples remedy on the paywall when it would work', async () => {
    const s = await freshStore();
    const UpsellModal = (await import('./screens/UpsellModal.jsx')).default;
    s.setState({ premium: false, onboarded: true, accountOpen: false, deckItems: examples(), doneByDate: {} });
    s.addItemsToToday(batch(7));

    render(<UpsellModal />);

    expect(screen.getByText('Clear the examples')).toBeTruthy();
    fireEvent.click(screen.getByText('Clear the examples'));
    expect(s.getState().deckItems).toHaveLength(0);
  });
});

describe('6. a stranger cannot borrow a YouTube identity', () => {
  const EVIL = 'https://evil.example/youtube.com/watch?v=tybOi4hjZFQ';

  it('reads no video id out of a url that only mentions youtube.com', async () => {
    const s = await freshStore();
    expect(s.parseYouTubeId(EVIL)).toBeNull();
    expect(s.parseYouTubeId('https://youtube.com.evil.example/watch?v=tybOi4hjZFQ')).toBeNull();
    expect(s.parseYouTubeId('https://evil.example/x?u=https://youtu.be/tybOi4hjZFQ')).toBeNull();
  });

  it('gives a hostile link no thumbnail and nothing to put in an iframe', async () => {
    const s = await freshStore();
    const snap = s.itemFromUrl(EVIL);
    expect(snap.url).toBe(EVIL);
    expect(snap.embed).toBeUndefined();
    expect(snap.thumbUrl).toBeUndefined();
    expect(snap.thumb).not.toBe('yt');
    expect(snap.title).toBe('evil.example');
  });

  it('does not dress a shared hostile link as a real video on the recipient\'s phone', async () => {
    const s = await freshStore();
    const r = s.parseRoutineLink(linkFor({
      p: 'ppwr', v: 1, n: 'Breathwork',
      i: [{ t: 'Wim Hof Guided Breathing', m: 'YouTube · Breathwork · 11 min', u: EVIL, b: 'yt' }],
    }));
    const got = r.items[0];
    expect(got.url).toBe(EVIL);
    expect(got.embed).toBeUndefined();
    expect(got.thumbUrl).toBeUndefined();
    expect(got.thumb).not.toBe('yt');
  });

  it('still recognises every real YouTube link a practitioner would send', async () => {
    const s = await freshStore();
    const ID = 'tybOi4hjZFQ';
    for (const u of [
      'https://www.youtube.com/watch?v=' + ID,
      'https://youtube.com/watch?v=' + ID,
      'https://m.youtube.com/watch?v=' + ID,
      'https://music.youtube.com/watch?v=' + ID,
      'https://www.youtube.com/watch?list=PL123&v=' + ID,
      'https://www.youtube.com/embed/' + ID,
      'https://www.youtube-nocookie.com/embed/' + ID,
      'https://www.youtube.com/shorts/' + ID,
      'https://www.youtube.com/live/' + ID,
      'https://youtu.be/' + ID,
      'https://youtu.be/' + ID + '?t=42',
    ]) {
      expect(s.parseYouTubeId(u), u).toBe(ID);
    }
    const snap = s.itemFromUrl('https://youtu.be/' + ID);
    expect(snap.thumb).toBe('yt');
    expect(snap.embed).toContain('youtube.com/embed/' + ID);
    expect(snap.thumbUrl).toContain('i.ytimg.com/vi/' + ID);
  });
});
