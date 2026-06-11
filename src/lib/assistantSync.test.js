// D2 (2026-06-11) — unit tests for the pure plan-op mapper.
// Verifies every op type maps onto the REAL localStorage shapes the app uses
// (src/config.js LS_KEYS), that re-applying an op is idempotent, and that
// malformed payloads are rejected without writing or throwing.

import { describe, it, expect, beforeEach } from 'vitest';
import { applyPlanOp, ASSISTANT_NS } from './assistantSync.js';
import { LS_KEYS } from '../config.js';

// Minimal localStorage-compatible fake (getItem/setItem/removeItem/length/key).
function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    get length() { return map.size; },
    key: (i) => Array.from(map.keys())[i] ?? null,
    _raw: (k) => map.get(k),
    _json: (k) => JSON.parse(map.get(k)),
    _has: (k) => map.has(k),
  };
}

const TODAY = new Date().toISOString().slice(0, 10);
const userKey = (d) => LS_KEYS.USER_STACKS + '::' + d;

let store;
beforeEach(() => { store = makeStorage(); });

describe('add_stack (one-off)', () => {
  const op = { id: 'op_a1', op: 'add_stack', payload: { title: 'Morning fascia release', type: 'text', time: '07:30', durationSec: 600, date: '2026-06-12' } };

  it('writes an assistant-namespaced stack into the dated user-stacks bucket', () => {
    const r = applyPlanOp(op, store);
    expect(r.applied).toBe(true);
    const list = store._json(userKey('2026-06-12'));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: ASSISTANT_NS + 'op_a1',
      type: 'text',
      time: '07:30',
      durationSec: 600,
      title: 'Morning fascia release',
      source: 'assistant',
      assistantOpId: 'op_a1',
    });
    expect(list[0].text).toContain('Morning fascia release');
  });

  it('defaults to today when no date is given', () => {
    const r = applyPlanOp({ id: 'op_a2', op: 'add_stack', payload: { title: 'Hydrate' } }, store);
    expect(r.applied).toBe(true);
    expect(store._has(userKey(TODAY))).toBe(true);
    expect(store._json(userKey(TODAY))).toHaveLength(1);
  });

  it('is idempotent on re-apply (same op id never duplicates)', () => {
    expect(applyPlanOp(op, store).applied).toBe(true);
    const second = applyPlanOp(op, store);
    expect(second.applied).toBe(false);
    expect(second.reason).toBe('duplicate');
    expect(store._json(userKey('2026-06-12'))).toHaveLength(1);
  });

  it('folds a note into the rendered text', () => {
    applyPlanOp({ id: 'op_a3', op: 'add_stack', payload: { title: 'Wind down', note: 'Coach: ease into week 1', date: TODAY } }, store);
    const list = store._json(userKey(TODAY));
    expect(list[0].text).toContain('Coach: ease into week 1');
    expect(list[0].note).toBe('Coach: ease into week 1');
  });
});

describe('add_stack (recurring) + schedule_routine', () => {
  it('creates a recurrence rule with the assistant id and mapped freq', () => {
    const r = applyPlanOp({ id: 'op_r1', op: 'add_stack', payload: { title: 'Daily mobility', recurrence: { freq: 'everyday' }, time: '08:00' } }, store);
    expect(r.applied).toBe(true);
    const rules = store._json(LS_KEYS.RECURRENCE_RULES);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe(ASSISTANT_NS + 'op_r1');
    expect(rules[0].freq).toBe('everyday');
    expect(rules[0].stack).toMatchObject({ source: 'assistant', assistantOpId: 'op_r1', title: 'Daily mobility' });
    expect(rules[0].anchorDate).toBe(TODAY);
  });

  it('maps weekdays/weekends to everyday (app engine has no weekday filter)', () => {
    applyPlanOp({ id: 'op_r2', op: 'schedule_routine', payload: { title: 'Weekday breath', recurrence: { freq: 'weekdays' } } }, store);
    expect(store._json(LS_KEYS.RECURRENCE_RULES)[0].freq).toBe('everyday');
  });

  it('maps weekly through', () => {
    applyPlanOp({ id: 'op_r3', op: 'schedule_routine', payload: { title: 'Weekly reset', recurrence: { freq: 'weekly' } } }, store);
    expect(store._json(LS_KEYS.RECURRENCE_RULES)[0].freq).toBe('weekly');
  });

  it('schedule_routine without recurrence is rejected', () => {
    const r = applyPlanOp({ id: 'op_r4', op: 'schedule_routine', payload: { title: 'No cadence' } }, store);
    expect(r.applied).toBe(false);
    expect(store._has(LS_KEYS.RECURRENCE_RULES)).toBe(false);
  });

  it('is idempotent on re-apply', () => {
    const op = { id: 'op_r5', op: 'add_stack', payload: { title: 'Daily', recurrence: { freq: 'everyday' } } };
    expect(applyPlanOp(op, store).applied).toBe(true);
    expect(applyPlanOp(op, store).applied).toBe(false);
    expect(store._json(LS_KEYS.RECURRENCE_RULES)).toHaveLength(1);
  });
});

describe('set_fasting_window', () => {
  it('writes ppw.ifPrefs', () => {
    const r = applyPlanOp({ id: 'op_f1', op: 'set_fasting_window', payload: { enabled: true, windowStart: '12:00', windowEnd: '20:00' } }, store);
    expect(r.applied).toBe(true);
    expect(store._json(LS_KEYS.IF_PREFS)).toMatchObject({ enabled: true, windowStart: '12:00', windowEnd: '20:00' });
  });

  it('rejects an invalid window time', () => {
    const r = applyPlanOp({ id: 'op_f2', op: 'set_fasting_window', payload: { windowStart: '25:00', windowEnd: '20:00' } }, store);
    expect(r.applied).toBe(false);
    expect(store._has(LS_KEYS.IF_PREFS)).toBe(false);
  });

  it('is idempotent (re-apply yields identical prefs)', () => {
    const op = { id: 'op_f3', op: 'set_fasting_window', payload: { windowStart: '13:00', windowEnd: '21:00' } };
    applyPlanOp(op, store);
    const first = store._raw(LS_KEYS.IF_PREFS);
    applyPlanOp(op, store);
    expect(store._raw(LS_KEYS.IF_PREFS)).toBe(first);
  });
});

describe('tick_condition', () => {
  it('adds zone codes to ppw.activeRoutines.savedZones (uppercased, deduped)', () => {
    const r = applyPlanOp({ id: 'op_z1', op: 'tick_condition', payload: { zoneCodes: ['lb', 'HAM-L', 'lb'], action: 'add' } }, store);
    expect(r.applied).toBe(true);
    expect(store._json(LS_KEYS.ACTIVE_ROUTINES).savedZones.sort()).toEqual(['HAM-L', 'LB']);
  });

  it('removes zone codes', () => {
    store = makeStorage({ [LS_KEYS.ACTIVE_ROUTINES]: JSON.stringify({ savedZones: ['LB', 'HAM-L'], level: 'beginner' }) });
    applyPlanOp({ id: 'op_z2', op: 'tick_condition', payload: { zoneCodes: ['LB'], action: 'remove' } }, store);
    expect(store._json(LS_KEYS.ACTIVE_ROUTINES).savedZones).toEqual(['HAM-L']);
  });

  it('is idempotent on add', () => {
    const op = { id: 'op_z3', op: 'tick_condition', payload: { zoneCodes: ['LB'], action: 'add' } };
    applyPlanOp(op, store);
    applyPlanOp(op, store);
    expect(store._json(LS_KEYS.ACTIVE_ROUTINES).savedZones).toEqual(['LB']);
  });

  it('rejects when no valid zone codes', () => {
    const r = applyPlanOp({ id: 'op_z4', op: 'tick_condition', payload: { zoneCodes: [], action: 'add' } }, store);
    expect(r.applied).toBe(false);
  });
});

describe('set_reminder', () => {
  it('flags an existing assistant one-off stack', () => {
    applyPlanOp({ id: 'op_s1', op: 'add_stack', payload: { title: 'Stretch', date: TODAY } }, store);
    const r = applyPlanOp({ id: 'op_s2', op: 'set_reminder', payload: { stackRef: 'op_s1', remind: true } }, store);
    expect(r.applied).toBe(true);
    expect(store._json(userKey(TODAY))[0].remind).toBe(true);
  });

  it('flags an existing assistant recurrence rule', () => {
    applyPlanOp({ id: 'op_s3', op: 'add_stack', payload: { title: 'Daily', recurrence: { freq: 'everyday' } } }, store);
    const r = applyPlanOp({ id: 'op_s4', op: 'set_reminder', payload: { stackRef: 'op_s3' } }, store);
    expect(r.applied).toBe(true);
    expect(store._json(LS_KEYS.RECURRENCE_RULES)[0].stack.remind).toBe(true);
  });

  it('returns not-applied when the target is missing', () => {
    const r = applyPlanOp({ id: 'op_s5', op: 'set_reminder', payload: { stackRef: 'op_nope' } }, store);
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('target_not_found');
  });
});

describe('remove_item', () => {
  it('removes a one-off assistant stack and is idempotent', () => {
    applyPlanOp({ id: 'op_d1', op: 'add_stack', payload: { title: 'Bye', date: TODAY } }, store);
    const first = applyPlanOp({ id: 'op_d2', op: 'remove_item', payload: { stackRef: 'op_d1' } }, store);
    expect(first.applied).toBe(true);
    expect(store._json(userKey(TODAY))).toHaveLength(0);
    const second = applyPlanOp({ id: 'op_d3', op: 'remove_item', payload: { stackRef: 'op_d1' } }, store);
    expect(second.applied).toBe(false);
    expect(second.reason).toBe('target_not_found');
  });

  it('removes an assistant recurrence rule', () => {
    applyPlanOp({ id: 'op_d4', op: 'add_stack', payload: { title: 'Daily', recurrence: { freq: 'everyday' } } }, store);
    const r = applyPlanOp({ id: 'op_d5', op: 'remove_item', payload: { stackRef: 'op_d4' } }, store);
    expect(r.applied).toBe(true);
    expect(store._json(LS_KEYS.RECURRENCE_RULES)).toHaveLength(0);
  });
});

describe('malformed / rejection', () => {
  it('rejects an unknown op', () => {
    expect(applyPlanOp({ id: 'op_x', op: 'frobnicate', payload: {} }, store)).toMatchObject({ applied: false, reason: 'unknown_op' });
  });
  it('rejects null / non-object ops', () => {
    expect(applyPlanOp(null, store).applied).toBe(false);
    expect(applyPlanOp(42, store).applied).toBe(false);
  });
  it('rejects add_stack with no title', () => {
    expect(applyPlanOp({ id: 'op_x2', op: 'add_stack', payload: { time: '08:00' } }, store).applied).toBe(false);
  });
  it('rejects a create op with no op id', () => {
    expect(applyPlanOp({ op: 'add_stack', payload: { title: 'x' } }, store)).toMatchObject({ applied: false, reason: 'missing_op_id' });
  });
  it('writes nothing to storage on a rejected op', () => {
    applyPlanOp({ id: 'op_x3', op: 'add_stack', payload: {} }, store);
    expect(store.length).toBe(0);
  });
});
