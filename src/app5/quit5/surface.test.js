// THE QUIT SURFACE — the plan as the app actually carries it.
//
// Vic, 2026-10-12: "intergrate a quit smoking app JSON you put how many they
// smoke and how many they need to get down to, then it reminds them there
// allowance per, day."
//
// quit5/plan.test.js already proves the ARITHMETIC on its own. This file is
// about the three things the engine deliberately knows nothing about:
//
//   1. THE STORE SLICE. One key, `ppw5.quit`, holding the plan as JSON, read
//      back through readPlan so a corrupt blob opens an empty quit screen
//      rather than taking the app down.
//   2. THE DERIVED DECK ITEM. The reminder on the Stack is COMPUTED from the
//      plan every time it is asked for; it is not a row in `deckItems`. So
//      there is no second copy to fall out of step, and deleting the plan
//      deletes the reminder in the same breath — proven below rather than
//      hoped for.
//   3. THE NOTIFICATION-SAFE TITLE. The item's `title` is the only field the
//      slot engine passes to a reminder banner (store5.js, `slotPop`), and
//      that banner is the in-app stand-in for a lock-screen notification. A
//      title reading "6 left today" tells a whole room, off a locked phone on
//      a kitchen table, that this person smokes. So the title carries no
//      number and no subject, and the counts live in `status`, which only the
//      card on screen reads.
//
// TRAP 1 (unpadded day keys) IS LIVE IN THIS FILE. todayKey() returns
// '2026-10-4', and `new Date('2026-10-4T00:00:00')` is an Invalid Date — a
// sibling branch shipped a whole feature whose date checks all failed silently
// because its tests fed PADDED dates it had typed itself. So every day in here
// comes from the app's own dateKeyFromOffset(), never from a string literal,
// and the taper is walked across a month boundary on purpose.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DISCLAIMER, HELP_LINE, METHOD_NOTE } from './plan.js';

const LS = (k) => 'ppw5.' + k;

/** A store booted from a clean module registry — the device as it sits on disk. */
async function freshStore(url = '/') {
  try { window.history.replaceState({}, '', url); } catch { /* no jsdom history */ }
  vi.resetModules();
  return await import('../store5.js');
}

describe('setting up a quit plan', () => {
  beforeEach(() => { localStorage.clear(); });

  it('has nothing to show until a plan is set up', async () => {
    const s = await freshStore();
    expect(s.getState().quitPlan).toBe(null);
    expect(s.quitItem()).toBe(null);
    expect(s.quitStatus()).toBe(null);
  });

  it('produces today as the allowance the person said they smoke now', async () => {
    const s = await freshStore();
    expect(s.startQuitPlan({ from: 20, to: 0, days: 28 })).toBe(null);   // null = no complaint

    const st = s.quitStatus();
    // Day one is the starting number exactly: nobody has failed before they
    // start, and somebody who signs up at 9pm has already smoked today.
    expect(st.allowance).toBe(20);
    expect(st.remaining).toBe(20);
    expect(st.dayNumber).toBe(1);
    expect(st.over).toBe(false);
    expect(st.text).toMatch(/^20 left of today/);
  });

  it('refuses a plan that makes no sense, in words a form can print', async () => {
    const s = await freshStore();
    const msg = s.startQuitPlan({ from: 5, to: 10, days: 28 });
    expect(typeof msg).toBe('string');
    expect(msg).toMatch(/higher than/i);
    // Refused means refused — no half-built plan left behind for the Stack to
    // start reminding somebody about.
    expect(s.getState().quitPlan).toBe(null);
    expect(s.quitItem()).toBe(null);
  });

  it('writes the plan as readable JSON under one ppw5 key, and reads it back', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 20, to: 0, days: 28 });

    const raw = localStorage.getItem(LS('quit'));
    expect(raw).toBeTruthy();
    const json = JSON.parse(raw);
    expect(json.from).toBe(20);
    expect(json.to).toBe(0);
    expect(json.days).toBe(28);
    expect(json.v).toBe(1);

    // The real test of persistence: a cold boot of the same device.
    const again = await freshStore();
    expect(again.getState().quitPlan).toMatchObject({ from: 20, to: 0, days: 28 });
  });

  it('opens an empty quit screen on a corrupt stored plan, rather than falling over', async () => {
    localStorage.setItem(LS('quit'), '{"v":1,"from":"nonsense"');   // truncated JSON
    const s = await freshStore();
    expect(s.getState().quitPlan).toBe(null);
    expect(s.quitItem()).toBe(null);
  });
});

describe('today on the Stack', () => {
  beforeEach(() => { localStorage.clear(); });

  it('puts one reminder on the day, derived from the plan', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 10, to: 0, days: 10 });

    const it = s.quitItem();
    expect(it).toBeTruthy();
    expect(it.kind).toBe('quit');
    expect(it.time).toBe(s.QUIT_DEFAULT_AT);
    expect(it.repeat).toBe('daily');
    // It is NOT a row in the deck. There is one copy of this fact and it is the
    // plan; anything else would be a second copy to drift.
    expect(s.getState().deckItems.some((x) => x.id === it.id)).toBe(false);
  });

  it('goes with the plan when the plan is deleted', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 10, to: 0, days: 10 });
    expect(s.quitItem()).toBeTruthy();

    s.clearQuitPlan();
    expect(s.quitItem()).toBe(null);
    expect(s.getState().quitPlan).toBe(null);
    expect(localStorage.getItem(LS('quit'))).toBe(null);
  });

  it('says nothing on a day before the plan began', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 10, to: 0, days: 10 });
    // Yesterday, in the app's own unpadded key format.
    expect(s.quitItem(s.dateKeyFromOffset(-1))).toBe(null);
  });

  it('steps the allowance down across the taper, on the app own day keys', async () => {
    const s = await freshStore();
    // 28 days and a 20-a-day start, begun today — so the walk below crosses a
    // month boundary whatever today is, which is where a key like '2026-11-1'
    // would break anything parsing keys as ISO strings.
    s.startQuitPlan({ from: 20, to: 0, days: 28 });

    const walk = [];
    for (let i = 0; i < 28; i += 1) {
      const key = s.dateKeyFromOffset(i);
      const item = s.quitItem(key);
      expect(item).toBeTruthy();                    // never a null day inside the plan
      expect(Number.isFinite(item.status.allowance)).toBe(true);   // never NaN from a bad key
      walk.push(item.status.allowance);
    }

    expect(walk[0]).toBe(20);                       // day one: what they smoke now
    expect(walk[27]).toBe(0);                       // the last day: where they said they were heading
    // Never rises. A taper that goes back up on a Thursday is a bug somebody
    // would have to notice themselves.
    for (let i = 1; i < walk.length; i += 1) expect(walk[i]).toBeLessThanOrEqual(walk[i - 1]);
    expect(walk[14]).toBeLessThan(walk[0]);         // and it really does move
  });

  it('keeps reminding after the taper ends, at the number they were heading for', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 4, to: 0, days: 4 });
    const after = s.quitItem(s.dateKeyFromOffset(40));
    expect(after).toBeTruthy();
    expect(after.status.allowance).toBe(0);
    expect(after.status.done).toBe(true);
  });
});

describe('logging one, in the moment', () => {
  beforeEach(() => { localStorage.clear(); });

  it('takes one off what is left, one tap at a time', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 6, to: 0, days: 6 });
    expect(s.quitStatus().remaining).toBe(6);

    s.logOneSmoked();
    expect(s.quitStatus().smoked).toBe(1);
    expect(s.quitStatus().remaining).toBe(5);

    s.logOneSmoked();
    s.logOneSmoked();
    expect(s.quitStatus().remaining).toBe(3);
    expect(s.quitStatus().text).toMatch(/^3 left of today/);
  });

  it('takes one back, for the tap that was an accident', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 6, to: 0, days: 6 });
    s.logOneSmoked();
    s.logOneSmoked();
    s.undoOneSmoked();
    expect(s.quitStatus().smoked).toBe(1);
    // And it never goes below none — there is no such thing as minus one.
    s.undoOneSmoked();
    s.undoOneSmoked();
    expect(s.quitStatus().smoked).toBe(0);
    expect(s.quitStatus().remaining).toBe(6);
  });

  it('survives the app being closed — a log is not a session', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 6, to: 0, days: 6 });
    s.logOneSmoked();
    s.logOneSmoked();

    const again = await freshStore();
    expect(again.quitStatus().smoked).toBe(2);
    expect(again.quitStatus().remaining).toBe(4);
  });

  it('reports a day that went over as a fact, and leaves tomorrow alone', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 6, to: 0, days: 6 });
    const tomorrow = s.dateKeyFromOffset(1);
    const tomorrowBefore = s.quitItem(tomorrow).status.allowance;

    for (let i = 0; i < 9; i += 1) s.logOneSmoked();
    const st = s.quitStatus();
    expect(st.over).toBe(true);
    expect(st.remaining).toBe(-3);
    expect(st.text).toMatch(/3 more than today/);
    expect(st.text).toMatch(/unchanged/);
    // No telling-off anywhere in what the person is shown.
    expect(st.text).not.toMatch(/fail|blew|ruin|broke|streak|sorry|bad/i);

    // The arithmetic guarantee, asserted rather than assumed: a heavy day moves
    // nothing about tomorrow, in either direction.
    expect(s.quitItem(tomorrow).status.allowance).toBe(tomorrowBefore);
  });

  it('logs against the day it is told about, not always today', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 6, to: 0, days: 6 });
    const yesterdayInPlan = s.dateKeyFromOffset(1);   // day 2 of the plan
    s.logOneSmoked(yesterdayInPlan);
    expect(s.quitStatus(yesterdayInPlan).smoked).toBe(1);
    expect(s.quitStatus().smoked).toBe(0);            // today untouched
  });

  it('does nothing at all when there is no plan to log against', async () => {
    const s = await freshStore();
    s.logOneSmoked();
    s.undoOneSmoked();
    expect(s.getState().quitPlan).toBe(null);
    expect(localStorage.getItem(LS('quit'))).toBe(null);
  });
});

describe('what a locked phone on a table shows', () => {
  beforeEach(() => { localStorage.clear(); });

  it('names no number and no subject in the title the reminder banner shows', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 20, to: 0, days: 28 });
    for (let i = 0; i < 14; i += 1) s.logOneSmoked();
    const it = s.quitItem();

    // Both are the named constants, so a screen cannot compose its own
    // chattier version of either and leave the pair looking deliberate.
    expect(it.title).toBe(s.QUIT_SLOT_TITLE);
    expect(it.meta).toBe(s.QUIT_SLOT_META);
    // `title` and `meta` are the two fields a generic renderer or a future
    // notification body would reach for. Neither may carry the detail.
    for (const field of [it.title, it.meta]) {
      expect(field).toBeTruthy();
      expect(field).not.toMatch(/\d/);
      expect(field).not.toMatch(/smok|cigarette|cig\b|quit|nicotine|tobacco|vape|allowance|left/i);
    }
    // The numbers exist — they are just somewhere only the screen in your hand
    // reads them from.
    expect(it.status.allowance).toBe(20);
    expect(it.status.smoked).toBe(14);
    expect(it.status.text).toMatch(/\d/);
  });

  it('keeps the same discreet title whether the day is fine or over', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 2, to: 0, days: 4 });
    const fine = s.quitItem().title;
    for (let i = 0; i < 5; i += 1) s.logOneSmoked();
    expect(s.quitStatus().over).toBe(true);
    // A title that changes when the day goes badly is itself the disclosure —
    // "You are over" on a lock screen says everything the plain one withholds.
    expect(s.quitItem().title).toBe(fine);
  });
});

describe('the demo embed touches no device', () => {
  beforeEach(() => { localStorage.clear(); });

  it('writes no quit plan on a ?demo=1 load', async () => {
    const s = await freshStore('/?demo=1');
    expect(s.startQuitPlan({ from: 20, to: 0, days: 28 })).toBe(null);
    // In memory for the visitor tapping around the iframe …
    expect(s.getState().quitPlan).toMatchObject({ from: 20, to: 0 });
    s.logOneSmoked();
    expect(s.quitStatus().smoked).toBe(1);
    // … and not one byte on the browser of whoever uses this machine properly.
    expect(localStorage.getItem(LS('quit'))).toBe(null);
    expect(localStorage.getItem(LS('quitAt'))).toBe(null);
  });

  it('never reads a real plan back into a demo', async () => {
    // A real user of this machine has a plan on disk.
    const real = await freshStore();
    real.startQuitPlan({ from: 15, to: 0, days: 20 });
    expect(localStorage.getItem(LS('quit'))).toBeTruthy();

    // The marketing page frames the app. It must not show this person's own
    // plan back to them inside a web page.
    const demo = await freshStore('/?demo=1');
    expect(demo.getState().quitPlan).toBe(null);
    expect(demo.quitItem()).toBe(null);
  });
});

describe('honesty, where the person reads it', () => {
  beforeEach(() => { localStorage.clear(); });

  it('carries the three lines on the item itself, so a screen cannot lose them', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 20, to: 0, days: 28 });
    const lines = s.quitItem().notes;
    expect(lines).toEqual([DISCLAIMER, METHOD_NOTE, HELP_LINE]);
    // The one that matters most: a real person to ask, named.
    expect(lines.join(' ')).toMatch(/pharmacist|doctor/i);
    expect(lines.join(' ')).toMatch(/nicotine replacement/i);
  });

  it('invents no statistic on the surface either', async () => {
    const s = await freshStore();
    s.startQuitPlan({ from: 20, to: 0, days: 28 });
    const it = s.quitItem();
    const words = [it.title, it.meta, ...it.notes].join(' ');
    expect(words).not.toMatch(/%|per cent|percent|\btimes more likely\b|success rate/i);
  });
});
