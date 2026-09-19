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
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
