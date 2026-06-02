// Per-date independence + override-isolation tests (2026-06-03).
//
// GATE-1 (a): the regression guard the old addUrl.test.jsx lacked — mount a
// daily hook on date A, switch to date B, and assert the two dates never share
// state. This exercises the exact branch (re-read on key change, no stale
// write) that the old useLocalStorage skipped.
//
// GATE-1 (c): the same isolation proven through the recurrence override hooks —
// "this day only" delete writes a single-date override and touches neither
// other dates nor the rule; "all occurrences" delete removes the rule.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useLocalStorage,
  useUserStacks,
  useRecurrenceRules,
  useRecurrenceOverrides,
} from './state.js';
import { LS_KEYS } from './config.js';

const A = '2026-06-03';
const B = '2026-06-04';

beforeEach(() => { localStorage.clear(); });

describe('useLocalStorage primitive — re-reads on key change, never stale-writes', () => {
  it('reflects the NEW key value and does not stamp it onto the old key', () => {
    localStorage.setItem('k1', JSON.stringify(['one']));
    localStorage.setItem('k2', JSON.stringify(['two']));
    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorage(key, []),
      { initialProps: { key: 'k1' } },
    );
    expect(result.current[0]).toEqual(['one']);

    rerender({ key: 'k2' });
    // Re-read happened: we see k2's value, not the stale k1 value.
    expect(result.current[0]).toEqual(['two']);
    // The old bug stamped the in-memory value onto the new key on the key
    // change. Confirm BOTH keys still hold their own original values.
    expect(JSON.parse(localStorage.getItem('k1'))).toEqual(['one']);
    expect(JSON.parse(localStorage.getItem('k2'))).toEqual(['two']);
  });
});

describe('useUserStacks — every date is independent (GATE-1 a)', () => {
  it('adding on A is invisible on B, and deleting on B never cascades to A', () => {
    const { result, rerender } = renderHook(
      ({ date }) => useUserStacks(date),
      { initialProps: { date: A } },
    );

    // Add a stack on date A.
    act(() => { result.current.addStack({ id: 'a1', type: 'text', title: 'A-only' }); });
    expect(result.current.stacks.map(s => s.id)).toEqual(['a1']);

    // Switch to B → must NOT see A's stack (the original bug showed it here).
    rerender({ date: B });
    expect(result.current.stacks).toEqual([]);

    // Add a different stack on B.
    act(() => { result.current.addStack({ id: 'b1', type: 'text', title: 'B-only' }); });
    expect(result.current.stacks.map(s => s.id)).toEqual(['b1']);

    // Back to A → still exactly A's stack (B's add didn't leak / overwrite).
    rerender({ date: A });
    expect(result.current.stacks.map(s => s.id)).toEqual(['a1']);

    // Delete on B…
    rerender({ date: B });
    act(() => { result.current.removeStack('b1'); });
    expect(result.current.stacks).toEqual([]);

    // …and A is still intact (the cascade the old code produced is gone).
    rerender({ date: A });
    expect(result.current.stacks.map(s => s.id)).toEqual(['a1']);

    // Storage keys hold their own independent values.
    expect(JSON.parse(localStorage.getItem(`${LS_KEYS.USER_STACKS}::${A}`)).map(s => s.id)).toEqual(['a1']);
    expect(JSON.parse(localStorage.getItem(`${LS_KEYS.USER_STACKS}::${B}`))).toEqual([]);
  });
});

describe('recurrence override hooks — isolation (GATE-1 c)', () => {
  it('"this day only" delete writes a single-date override; rule + other dates untouched', () => {
    // Seed a rule.
    const rulesHook = renderHook(() => useRecurrenceRules());
    act(() => {
      rulesHook.result.current.addRule({
        id: 'rule::x', stack: { id: 's', type: 'text', title: 'Daily' },
        anchorDate: A, freq: 'everyday', interval: 1, horizonDays: 30,
      });
    });

    // "This day only" delete on date A.
    const ovA = renderHook(({ date }) => useRecurrenceOverrides(date), { initialProps: { date: A } });
    act(() => { ovA.result.current.deleteOccurrence('rule::x'); });

    // Override written for A only.
    expect(JSON.parse(localStorage.getItem(`${LS_KEYS.RECURRENCE_OVERRIDES}::${A}`)))
      .toEqual({ 'rule::x': { deleted: true } });
    // Date B has no override.
    expect(localStorage.getItem(`${LS_KEYS.RECURRENCE_OVERRIDES}::${B}`)).toBeNull();
    // The rule itself is untouched.
    expect(JSON.parse(localStorage.getItem(LS_KEYS.RECURRENCE_RULES))).toHaveLength(1);
  });

  it('"all occurrences" delete removes the rule', () => {
    const rulesHook = renderHook(() => useRecurrenceRules());
    act(() => {
      rulesHook.result.current.addRule({
        id: 'rule::y', stack: { id: 's2', type: 'text', title: 'Weekly' },
        anchorDate: A, freq: 'weekly', interval: 7, horizonDays: 30,
      });
    });
    expect(JSON.parse(localStorage.getItem(LS_KEYS.RECURRENCE_RULES))).toHaveLength(1);

    act(() => { rulesHook.result.current.removeRule('rule::y'); });
    expect(JSON.parse(localStorage.getItem(LS_KEYS.RECURRENCE_RULES))).toEqual([]);
  });
});
