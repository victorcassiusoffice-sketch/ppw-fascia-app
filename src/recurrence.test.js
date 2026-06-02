// Recurrence engine tests (2026-06-03) — GATE-1 (b) expansion + (c) override
// isolation. Pure functions, no DOM.

import { describe, it, expect } from 'vitest';
import {
  addDaysISO,
  diffDaysISO,
  ruleInterval,
  ruleOccursOn,
  expandRule,
  recurringStacksForDate,
  makeRule,
  MAX_INTERVAL,
  DEFAULT_HORIZON_DAYS,
} from './recurrence.js';

const ANCHOR = '2026-06-03';

describe('ISO date helpers', () => {
  it('addDaysISO crosses month boundaries', () => {
    expect(addDaysISO('2026-06-29', 5)).toBe('2026-07-04');
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysISO(ANCHOR, 0)).toBe(ANCHOR);
  });
  it('diffDaysISO is signed whole days', () => {
    expect(diffDaysISO(ANCHOR, '2026-06-10')).toBe(7);
    expect(diffDaysISO('2026-06-10', ANCHOR)).toBe(-7);
    expect(diffDaysISO(ANCHOR, ANCHOR)).toBe(0);
  });
});

describe('ruleInterval', () => {
  it('maps freq to a day step', () => {
    expect(ruleInterval({ freq: 'everyday' })).toBe(1);
    expect(ruleInterval({ freq: 'weekly' })).toBe(7);
    expect(ruleInterval({ freq: 'everyN', interval: 5 })).toBe(5);
  });
  it('clamps everyN interval to 1..30', () => {
    expect(ruleInterval({ freq: 'everyN', interval: 0 })).toBe(1);
    expect(ruleInterval({ freq: 'everyN', interval: 99 })).toBe(MAX_INTERVAL);
  });
});

describe('expandRule — everyday fills consecutive days', () => {
  it('produces every date in the window', () => {
    const rule = makeRule({ id: 'r1', stack: {}, anchorDate: ANCHOR, freq: 'everyday' });
    const dates = expandRule(rule, ANCHOR, addDaysISO(ANCHOR, 5));
    expect(dates).toEqual([
      '2026-06-03', '2026-06-04', '2026-06-05',
      '2026-06-06', '2026-06-07', '2026-06-08',
    ]);
  });
});

describe('expandRule — weekly hits anchor + 7k', () => {
  it('lands only on weekly multiples within the horizon', () => {
    const rule = makeRule({ id: 'r2', stack: {}, anchorDate: ANCHOR, freq: 'weekly' });
    const dates = expandRule(rule, ANCHOR, addDaysISO(ANCHOR, 40));
    expect(dates).toEqual([
      addDaysISO(ANCHOR, 0),
      addDaysISO(ANCHOR, 7),
      addDaysISO(ANCHOR, 14),
      addDaysISO(ANCHOR, 21),
      addDaysISO(ANCHOR, 28),
      // +35 is beyond the 30-day horizon → excluded
    ]);
  });
});

describe('expandRule — everyN', () => {
  it('N=2 lands on every other day up to the horizon', () => {
    const rule = makeRule({ id: 'r3', stack: {}, anchorDate: ANCHOR, freq: 'everyN', interval: 2 });
    const dates = expandRule(rule, ANCHOR, addDaysISO(ANCHOR, DEFAULT_HORIZON_DAYS));
    // 0,2,4,...,30 → 16 occurrences
    expect(dates).toHaveLength(16);
    expect(dates[0]).toBe(addDaysISO(ANCHOR, 0));
    expect(dates[dates.length - 1]).toBe(addDaysISO(ANCHOR, 30));
    for (const d of dates) expect(diffDaysISO(ANCHOR, d) % 2).toBe(0);
  });
  it('N=30 hits only anchor and anchor+30', () => {
    const rule = makeRule({ id: 'r4', stack: {}, anchorDate: ANCHOR, freq: 'everyN', interval: 30 });
    const dates = expandRule(rule, ANCHOR, addDaysISO(ANCHOR, 60));
    expect(dates).toEqual([addDaysISO(ANCHOR, 0), addDaysISO(ANCHOR, 30)]);
  });
});

describe('expandRule — nothing expands beyond the 30-day horizon', () => {
  it('caps even when the requested window is far longer', () => {
    const rule = makeRule({ id: 'r5', stack: {}, anchorDate: ANCHOR, freq: 'everyday' });
    const dates = expandRule(rule, ANCHOR, addDaysISO(ANCHOR, 365));
    expect(dates).toHaveLength(DEFAULT_HORIZON_DAYS + 1); // inclusive of anchor
    expect(dates[dates.length - 1]).toBe(addDaysISO(ANCHOR, DEFAULT_HORIZON_DAYS));
  });
  it('a window starting after the anchor still respects the cadence', () => {
    const rule = makeRule({ id: 'r6', stack: {}, anchorDate: ANCHOR, freq: 'everyN', interval: 3 });
    const from = addDaysISO(ANCHOR, 5);  // not on cadence (5 % 3 !== 0)
    const dates = expandRule(rule, from, addDaysISO(ANCHOR, 12));
    // next on-cadence date ≥ +5 is +6, then +9, +12
    expect(dates).toEqual([addDaysISO(ANCHOR, 6), addDaysISO(ANCHOR, 9), addDaysISO(ANCHOR, 12)]);
  });
});

describe('ruleOccursOn', () => {
  const rule = makeRule({ id: 'r7', stack: {}, anchorDate: ANCHOR, freq: 'everyN', interval: 2 });
  it('is true on cadence dates within the horizon', () => {
    expect(ruleOccursOn(rule, ANCHOR)).toBe(true);
    expect(ruleOccursOn(rule, addDaysISO(ANCHOR, 2))).toBe(true);
    expect(ruleOccursOn(rule, addDaysISO(ANCHOR, 30))).toBe(true);
  });
  it('is false off-cadence, before the anchor, or beyond the horizon', () => {
    expect(ruleOccursOn(rule, addDaysISO(ANCHOR, 1))).toBe(false);
    expect(ruleOccursOn(rule, addDaysISO(ANCHOR, -2))).toBe(false);
    expect(ruleOccursOn(rule, addDaysISO(ANCHOR, 32))).toBe(false);
  });
});

describe('recurringStacksForDate — OVERRIDE ISOLATION (GATE-1 c)', () => {
  const rule = makeRule({
    id: 'rule::abc',
    stack: { id: 's1', type: 'link', title: 'Yoga', time: '08:00' },
    anchorDate: ANCHOR,
    freq: 'everyday',
  });
  const rules = [rule];

  it('returns the stack on a matching date with no overrides', () => {
    const out = recurringStacksForDate(rules, {}, ANCHOR);
    expect(out).toHaveLength(1);
    expect(out[0].ruleId).toBe('rule::abc');
    expect(out[0].stack.title).toBe('Yoga');
  });

  it('"this day only" delete (override.deleted) skips ONLY that date', () => {
    const overridesForThatDate = { 'rule::abc': { deleted: true } };
    // Deleted on the override date → not returned…
    expect(recurringStacksForDate(rules, overridesForThatDate, ANCHOR)).toHaveLength(0);
    // …but a DIFFERENT date (which has its own empty override map) still shows it.
    expect(recurringStacksForDate(rules, {}, addDaysISO(ANCHOR, 1))).toHaveLength(1);
  });

  it('a per-date patch merges onto that date only and leaves the rule untouched', () => {
    const overrides = { 'rule::abc': { patch: { time: '07:30' } } };
    const patched = recurringStacksForDate(rules, overrides, ANCHOR);
    expect(patched[0].stack.time).toBe('07:30');
    // The underlying rule's stack is not mutated.
    expect(rule.stack.time).toBe('08:00');
    // A different date is unaffected.
    expect(recurringStacksForDate(rules, {}, addDaysISO(ANCHOR, 1))[0].stack.time).toBe('08:00');
  });
});
