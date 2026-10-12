// "… THEN IT REMINDS THEM THERE ALLOWANCE PER, DAY."
//
// The last clause of Vic's ask, and the one a sibling pass flagged as unbuilt:
// statusFor() knew the sentence to show and quitItem() knows what time of day to
// show it, but nothing fired either. This file holds the wire.
//
// IT RIDES THE EXISTING ENGINE, not a second one. store5's startSlotEngine()
// already ticks every 20s, already compares each item's `time` against the
// clock, already remembers per-minute what it has fired, already stands down
// while an undismissed popup is on screen, and already respects the `reminders`
// setting. A reminder path of its own for the quit plan would have to re-earn
// every one of those, and would get one of them wrong.
//
// WHAT THE ASSERTIONS ARE REALLY ABOUT: the banner the engine raises (`slotPop`,
// rendered by screens/Popups.jsx) is this app's stand-in for a lock-screen
// notification, and it shows `title` and nothing else. So these tests check the
// reminder arrives AND that what arrives gives nothing away.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The engine is reached through deleteItem's import chain; stub it so no test
// here depends on IndexedDB.
vi.mock('../files5.js', () => ({
  saveFile: vi.fn(async () => 'f-new'),
  fileUrl: vi.fn(async () => null),
  deleteFile: vi.fn(async () => {}),
}));

async function freshStore() {
  vi.resetModules();
  return await import('../store5.js');
}

// 07:00 on a date whose day key is UNPADDED in both halves — '2026-9-5', the
// shape that is not ISO-parseable. If any of this had been built on
// new Date(key) instead of the app's own date system, the allowance would come
// back NaN here and the sentence would read "NaN left of today's NaN".
const AT_0700 = () => new Date(2026, 8, 5, 7, 0, 5);
const TICK = 20000;

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe('the daily reminder', () => {
  it('arrives at the time the plan is set for', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0700());
    const s = await freshStore();
    s.setState({ deckItems: [], reminders: true, slotPop: null, notePop: null, playerItem: null, doneByDate: {} });
    s.startQuitPlan({ from: 20, to: 0, days: 28, at: '07:00' });

    s.startSlotEngine();
    expect(s.getState().slotPop).toBe(null);
    vi.advanceTimersByTime(TICK);

    const pop = s.getState().slotPop;
    expect(pop).toBeTruthy();
    expect(pop.id).toBe(s.QUIT_ITEM_ID);
    expect(pop.time).toBe('07:00');
    // Nothing to play — so the banner's Play button is not rendered and there
    // is no control on it that would do nothing.
    expect(pop.hasUrl).toBe(false);
  });

  it('gives nothing away on the banner a locked phone would show', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0700());
    const s = await freshStore();
    s.setState({ deckItems: [], reminders: true, slotPop: null, notePop: null, playerItem: null, doneByDate: {} });
    s.startQuitPlan({ from: 20, to: 0, days: 28, at: '07:00' });
    s.startSlotEngine();
    vi.advanceTimersByTime(TICK);

    // `title` is the ONLY field Popups.jsx prints from the item.
    expect(s.getState().slotPop.title).toBe(s.QUIT_SLOT_TITLE);
    expect(s.getState().slotPop.title).not.toMatch(/\d/);
    expect(s.getState().slotPop.title).not.toMatch(/smok|cigarette|quit|allowance|left/i);
  });

  it('proves the day maths against the app own key format, not a typed date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0700());
    const s = await freshStore();
    // The key this plan is filed under — single-digit month AND day.
    expect(s.todayKey()).toBe('2026-9-5');
    expect(Number.isNaN(new Date(s.todayKey() + 'T00:00:00').getTime())).toBe(true);

    s.startQuitPlan({ from: 20, to: 0, days: 28, at: '07:00' });
    const st = s.quitStatus();
    expect(st.allowance).toBe(20);        // not NaN
    expect(st.text).toMatch(/^20 left of today/);
    expect(st.text).not.toMatch(/NaN/);
  });

  it('stays quiet when reminders are switched off', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0700());
    const s = await freshStore();
    s.setState({ deckItems: [], reminders: false, slotPop: null, notePop: null, playerItem: null, doneByDate: {} });
    s.startQuitPlan({ from: 20, to: 0, days: 28, at: '07:00' });
    s.startSlotEngine();
    vi.advanceTimersByTime(TICK);
    expect(s.getState().slotPop).toBe(null);
  });

  it('does not fire at all when there is no plan', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0700());
    const s = await freshStore();
    s.setState({ deckItems: [], reminders: true, slotPop: null, notePop: null, playerItem: null, doneByDate: {} });
    s.startSlotEngine();
    vi.advanceTimersByTime(TICK * 3);
    expect(s.getState().slotPop).toBe(null);
  });

  it('stops reminding the moment the plan is deleted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0700());
    const s = await freshStore();
    s.setState({ deckItems: [], reminders: true, slotPop: null, notePop: null, playerItem: null, doneByDate: {} });
    s.startQuitPlan({ from: 20, to: 0, days: 28, at: '07:00' });
    s.startSlotEngine();
    vi.advanceTimersByTime(TICK);
    expect(s.getState().slotPop).toBeTruthy();

    s.dismissSlotPop();
    s.clearQuitPlan();
    // Same minute, so the engine is still at 07:00 and would fire again if the
    // item still existed. It is derived from the plan, so it does not.
    vi.advanceTimersByTime(TICK * 2);
    expect(s.getState().slotPop).toBe(null);
  });

  it('does not stop a real stack from firing in the same minute', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0700());
    const s = await freshStore();
    s.setState({
      deckItems: [{ id: 'a', title: 'Morning stretch', time: '07:00', repeat: 'daily' }],
      reminders: true, slotPop: null, notePop: null, playerItem: null, doneByDate: {},
    });
    s.startQuitPlan({ from: 20, to: 0, days: 28, at: '07:00' });
    s.startSlotEngine();

    // The real stack is first (the derived item is appended), then the quit
    // reminder on the next tick — the per-minute set that made two stacks
    // sharing a time work carries this one too.
    vi.advanceTimersByTime(TICK);
    expect(s.getState().slotPop?.id).toBe('a');
    s.dismissSlotPop();
    vi.advanceTimersByTime(TICK);
    expect(s.getState().slotPop?.id).toBe(s.QUIT_ITEM_ID);
  });
});
