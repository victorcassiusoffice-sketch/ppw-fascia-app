// Practitioner -> client routine sharing (2026-09-19).
//
// This is the rail a physio practice would actually use: build a programme,
// export it, hand the file to a client, client imports it. It was losing the
// one thing that makes it a programme.
//
// routineToMd has always serialised the items WHOLE, so `repeat` was in the
// file. But parseRoutineMd whitelisted eight keys and `repeat` was not one of
// them, and addItemsToToday then hard-set `anchor: today, repeat: 'once'`. A
// six-week DAILY programme arrived as six one-off items on the day the client
// happened to open it, and every reminder past day one silently did not exist.
//
// 2026-10-05 — the same programme was still being lost, two doors further on.
// Two faults, one naming slip: `dayOffset` is the key a payload and a saved
// routine use, `_day` is the name a freshly PARSED item carries. routineToMd
// serialised items whole, so it re-emitted `_day` — which nothing reads back —
// and a day-21 stack came home on day 0 after one export→import→export cycle.
// And applyRoutineToDate, the ONLY route from a saved routine onto the calendar,
// hard-set `anchor: thatDay, repeat: 'once'` for every stack, so the moment
// "Save to my Routines" became the way a client accepted a shared programme,
// using it flattened it. src/lib/ics.js then exported one alarm that never
// repeated, because rruleFor() returns null for 'once'.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rruleFor } from '../lib/ics.js';

async function freshStore() {
  vi.resetModules();
  return await import('./store5.js');
}

beforeEach(() => { localStorage.clear(); });

const PROGRAMME = {
  name: 'Shoulder rehab — weeks 1-6',
  items: [
    { title: 'Pendulum swings', meta: '2 min each arm', time: '08:00', repeat: 'daily' },
    { title: 'Wall slides', meta: '3 x 10', time: '13:00', repeat: 'daily' },
    { title: 'Review with the clinic', time: '10:00', repeat: 'weekly', dayOffset: 7 },
  ],
};

describe('the file a practitioner hands over carries the schedule', () => {
  it('survives the round trip out and back', async () => {
    const s = await freshStore();
    const md = s.routineToMd(PROGRAMME);
    const back = s.parseRoutineMd(md);

    expect(back.ok).toBe(true);
    expect(back.name).toBe('Shoulder rehab — weeks 1-6');
    expect(back.items.map((i) => i.repeat)).toEqual(['daily', 'daily', 'weekly']);
    expect(back.items[2]._day).toBe(7);
  });

  it('still reads as a human document, not just a payload', async () => {
    const s = await freshStore();
    const md = s.routineToMd(PROGRAMME);
    expect(md).toContain('# Shoulder rehab — weeks 1-6');
    expect(md).toContain('**Pendulum swings**');
    expect(md).toContain('```ppw-routine');
  });
});

describe('the client gets the programme, not a to-do list for today', () => {
  it('keeps each stack repeating the way it was prescribed', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [], premium: true, doneByDate: {} });

    const back = s.parseRoutineMd(s.routineToMd(PROGRAMME));
    s.addItemsToToday(back.items);

    const got = s.getState().deckItems;
    expect(got.map((i) => i.repeat)).toEqual(['daily', 'daily', 'weekly']);
    // before the fix every one of these was 'once'
    expect(got.every((i) => i.repeat === 'once')).toBe(false);
  });

  it('starts a later stack on its own day, not today', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [], premium: true, doneByDate: {} });

    const back = s.parseRoutineMd(s.routineToMd(PROGRAMME));
    s.addItemsToToday(back.items);

    const got = s.getState().deckItems;
    expect(got[0].anchor).toBe(s.todayKey());
    expect(got[2].anchor).toBe(s.dateKeyFromOffset(7));
    expect(got[2].anchor).not.toBe(s.todayKey());
  });

  it('does not leak the internal day field onto the stored stack', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [], premium: true, doneByDate: {} });
    const back = s.parseRoutineMd(s.routineToMd(PROGRAMME));
    s.addItemsToToday(back.items);
    expect(s.getState().deckItems.some((i) => '_day' in i)).toBe(false);
  });

  it('never trusts a repeat value it does not recognise', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [], premium: true, doneByDate: {} });

    const md = s.routineToMd({ name: 'Odd', items: [{ title: 'Thing', time: '08:00', repeat: 'whenever-you-like' }] });
    const back = s.parseRoutineMd(md);
    s.addItemsToToday(back.items);

    expect(s.getState().deckItems[0].repeat).toBe('once');
  });
});

describe('nothing changes for a routine that never had a schedule', () => {
  it('lands once, today, exactly as before', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [], premium: true, doneByDate: {} });

    s.addItemsToToday([{ title: 'Just this', time: '09:00' }, { title: 'And this' }]);

    const got = s.getState().deckItems;
    expect(got.map((i) => i.repeat)).toEqual(['once', 'once']);
    expect(got.every((i) => i.anchor === s.todayKey())).toBe(true);
  });

  it('still staggers an untimed stack from 09:00', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [], premium: true, doneByDate: {} });
    s.addItemsToToday([{ title: 'A' }, { title: 'B' }]);
    expect(s.getState().deckItems.map((i) => i.time)).toEqual(['09:00', '09:30']);
  });
});

// A six-week programme with a stack that does not start until week four — the
// shape that exposed every one of the 2026-10-05 faults.
const SIX_WEEK = {
  name: 'Return to lifting — 6 weeks',
  items: [
    { title: 'Daily mobility', meta: '10 min', time: '07:30', repeat: 'daily' },
    { title: 'Loaded carries', meta: 'start light', time: '17:00', repeat: 'weekly', dayOffset: 7 },
    { title: 'First heavy session', meta: 'only once cleared', time: '18:00', repeat: 'weekly', dayOffset: 21 },
  ],
};

describe('the programme survives being passed on again', () => {
  it('still starts the week-four stack in week four after a second hand-off', async () => {
    const s = await freshStore();

    // client receives it, then forwards it to their own trainer
    const first = s.parseRoutineMd(s.routineToMd(SIX_WEEK));
    const again = s.parseRoutineMd(s.routineToMd({ name: first.name, items: first.items }));

    expect(again.ok).toBe(true);
    expect(again.items.map((i) => i._day)).toEqual([0, 7, 21]);
    expect(again.items.map((i) => i.repeat)).toEqual(['daily', 'weekly', 'weekly']);
  });

  it('writes the day under the name the importer actually reads', async () => {
    const s = await freshStore();
    // Re-exporting a programme that was just imported is where this went wrong:
    // the items now carry `_day`, which is this app's private name for an item
    // in flight and which no importer reads. Writing it into a file someone
    // else opens is what lost week four.
    const imported = s.parseRoutineMd(s.routineToMd(SIX_WEEK)).items;
    const md = s.routineToMd({ name: 'Passed on', items: imported });

    expect(md).toContain('"dayOffset": 21');
    expect(md).not.toContain('_day');
  });

  it('does not write the sender\'s own copy of the stack into the file', async () => {
    const s = await freshStore();
    const md = s.routineToMd({
      name: 'With a document',
      items: [{ id: 'rt9', title: 'Your scan', thumb: 'doc', kind: 'doc', fileId: 'blob-on-my-phone', anchor: '2026-10-5' }],
    });
    // a fileId points at the SENDER's device storage; it could never travel
    expect(md).not.toContain('blob-on-my-phone');
    expect(md).not.toContain('"anchor"');
  });
});

describe('saving a shared programme keeps its schedule on disk', () => {
  it('stores the day under the public name, not the internal one', async () => {
    const s = await freshStore();
    s.setState({ premium: true, routines: [] });

    const back = s.parseRoutineMd(s.routineToMd(SIX_WEEK));
    s.createRoutine(back.name, s.routineItemsForSave(back.items));

    const onDisk = JSON.parse(localStorage.getItem('ppw5.routines'));
    expect(onDisk).toHaveLength(1);
    expect(onDisk[0].name).toBe('Return to lifting — 6 weeks');
    expect(JSON.stringify(onDisk)).not.toContain('_day');
    expect(onDisk[0].items.map((i) => i.dayOffset)).toEqual([undefined, 7, 21]);
  });

  it('adds a saved stack to the right day whichever name its offset has', async () => {
    // "Add all to today" takes parsed items (`_day`), but a stack read back off
    // a saved routine carries `dayOffset`. Either must land on the same day, and
    // neither may follow the stack into storage.
    const s = await freshStore();
    s.setState({ deckItems: [], premium: true, doneByDate: {} });
    s.addItemsToToday([{ title: 'Public name', time: '08:00', dayOffset: 7 }, { title: 'Internal name', time: '09:00', _day: 7 }]);

    const got = s.getState().deckItems;
    expect(got.map((i) => i.anchor)).toEqual([s.dateKeyFromOffset(7), s.dateKeyFromOffset(7)]);
    expect(got.some((i) => 'dayOffset' in i || '_day' in i)).toBe(false);
  });

  it('does not store a day offset of zero as noise', async () => {
    const s = await freshStore();
    expect('dayOffset' in s.routineItemsForSave([{ title: 'Today', _day: 0 }])[0]).toBe(false);
  });

  it('leaves everything else on the stack alone', async () => {
    const s = await freshStore();
    const [out] = s.routineItemsForSave([{ title: 'Your scan', kind: 'doc', fileId: 'f1', noteAnim: 'pulse', _day: 3 }]);
    expect(out).toEqual({ title: 'Your scan', kind: 'doc', fileId: 'f1', noteAnim: 'pulse', dayOffset: 3 });
  });
});

describe('using a saved programme puts it on the calendar as prescribed', () => {
  // The routine as it sits in ppw5.routines after being saved from a share.
  const SAVED = [
    { title: 'Daily mobility', time: '07:30', repeat: 'daily' },
    { title: 'Loaded carries', time: '17:00', repeat: 'weekly', dayOffset: 7 },
    { title: 'First heavy session', time: '18:00', repeat: 'weekly', dayOffset: 21 },
  ];
  const withRoutine = async (items = SAVED) => {
    const s = await freshStore();
    s.setState({ deckItems: [], doneByDate: {}, premium: true, routines: [{ id: 'r1', name: 'Return to lifting', items }] });
    return s;
  };

  it('starts on the day the client picked and runs forward from there', async () => {
    const s = await withRoutine();
    expect(s.applyRoutineToDate('r1', '2026-11-3').ok).toBe(true);

    const got = s.getState().deckItems;
    expect(got.map((i) => i.anchor)).toEqual(['2026-11-3', '2026-11-10', '2026-11-24']);
  });

  it('counts the weeks across a month end, on unpadded keys', async () => {
    // The app's date keys are unpadded ('2026-11-28'), so offset arithmetic has
    // to go through a real Date — string maths here would emit '2026-11-35'.
    const s = await withRoutine();
    s.applyRoutineToDate('r1', '2026-11-28');
    expect(s.getState().deckItems.map((i) => i.anchor)).toEqual(['2026-11-28', '2026-12-5', '2026-12-19']);
  });

  it('keeps each stack repeating the way it was prescribed', async () => {
    const s = await withRoutine();
    s.applyRoutineToDate('r1', '2026-11-3');

    const got = s.getState().deckItems;
    expect(got.map((i) => i.repeat)).toEqual(['daily', 'weekly', 'weekly']);
    // before the fix every one of these was 'once', on one single day
    expect(got.every((i) => i.repeat === 'once')).toBe(false);
  });

  it('exports a phone alarm that actually recurs', async () => {
    // A stack whose repeat was flattened to 'once' gets no RRULE at all, so the
    // .ics handed to the phone's Calendar fired a single alert and the client
    // heard nothing again for six weeks.
    const s = await withRoutine();
    s.applyRoutineToDate('r1', '2026-11-3');
    for (const it of s.getState().deckItems) expect(rruleFor(it.repeat), it.title).not.toBeNull();
  });

  it('puts neither day-offset name onto the stored stack', async () => {
    const s = await withRoutine();
    s.applyRoutineToDate('r1', '2026-11-3');
    const got = s.getState().deckItems;
    expect(got.some((i) => 'dayOffset' in i)).toBe(false);
    expect(got.some((i) => '_day' in i)).toBe(false);
  });

  it('still reads a routine saved before the day got its public name', async () => {
    // Routines written by the old code carry `_day` on disk. Nobody is migrating
    // storage, so every reader takes either key, forever.
    const s = await withRoutine([
      { title: 'Daily mobility', time: '07:30', repeat: 'daily' },
      { title: 'Loaded carries', time: '17:00', repeat: 'weekly', _day: 7 },
    ]);
    s.applyRoutineToDate('r1', '2026-11-3');
    expect(s.getState().deckItems.map((i) => i.anchor)).toEqual(['2026-11-3', '2026-11-10']);
  });

  it('lands a routine that never had a schedule exactly as before', async () => {
    const s = await withRoutine([{ title: 'a', time: '07:00' }, { title: 'b', time: '08:00' }]);
    s.applyRoutineToDate('r1', '2026-11-3');

    const got = s.getState().deckItems;
    expect(got.map((i) => i.repeat)).toEqual(['once', 'once']);
    expect(got.every((i) => i.anchor === '2026-11-3')).toBe(true);
  });

  it('still staggers an untimed stack from 09:00', async () => {
    const s = await withRoutine([{ title: 'a' }, { title: 'b' }]);
    s.applyRoutineToDate('r1', '2026-11-3');
    expect(s.getState().deckItems.map((i) => i.time)).toEqual(['09:00', '09:30']);
  });

  it('a free user is still sent to the upsell, not given the routine', async () => {
    const s = await withRoutine();
    s.setState({ premium: false });
    expect(s.applyRoutineToDate('r1', '2026-11-3').upsell).toBe(true);
    expect(s.getState().deckItems).toHaveLength(0);
    expect(s.getState().premiumUpsell).toBeTruthy();
  });
});
