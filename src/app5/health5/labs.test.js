// Labs and timing — the §9 cases.
//
// The iron gate is the one that matters. A low haemoglobin is NOT evidence of
// low iron, and an app that treats it that way sends people toward a supplement
// that is genuinely risky to take without knowing why they are anaemic.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setHealthData } from './data.js';
import { normaliseTestName, readLab, labSaysLow, ironUnlocked, monthsSince } from './labs.js';
import { slotConflicts, shiftTime } from './timing.js';

const read = (f) => JSON.parse(readFileSync(join(process.cwd(), 'docs/health-pack/data', f), 'utf8'));
const data = setHealthData({
  nutrients: read('nutrients.json'),
  ingredients: read('ingredients.json'),
  rules: read('rules.json'),
});

const TODAY = '2026-10-04';

describe('test names normalise to one key', () => {
  it('strips where the sample came from', () => {
    for (const n of ['Serum ferritin', 'Ferritin, serum', 'S-Ferritin', 'FERRITIN']) {
      expect(normaliseTestName(n)).toBe('ferritin');
    }
  });

  it('keeps 25(OH)D readable', () => {
    expect(normaliseTestName('25(OH)D')).toBe('25(oh)d');
  });
});

describe('only ferritin speaks for iron', () => {
  it('a low ferritin from last month unlocks iron', () => {
    const labs = [{ test: 'Ferritin', value: 8, unit: 'µg/L', date: '2026-09-01', result: 'low' }];
    expect(labSaysLow(labs, 'iron', TODAY).low).toBe(true);
    expect(ironUnlocked(labs, TODAY)).toBe(true);
  });

  it('a low haemoglobin alone unlocks nothing', () => {
    const labs = [{ test: 'Haemoglobin', value: 10, unit: 'g/dL', date: '2026-09-01', result: 'low' }];
    expect(readLab(labs[0], TODAY).unmapped).toBe(true);
    expect(ironUnlocked(labs, TODAY)).toBe(false);
  });

  it('serum iron and TSAT are plain notes, not iron evidence', () => {
    for (const t of ['Serum iron', 'TSAT', 'Transferrin saturation', 'TIBC']) {
      expect(readLab({ test: t, result: 'low', date: '2026-09-01' }, TODAY).nutrientId).toBeNull();
    }
    expect(ironUnlocked([{ test: 'TSAT', result: 'low', date: '2026-09-01' }], TODAY)).toBe(false);
  });

  it('a ferritin from 8 months ago is out of date', () => {
    const labs = [{ test: 'Ferritin', date: '2026-02-01', result: 'low' }];
    const r = labSaysLow(labs, 'iron', TODAY);
    expect(r.low).toBe(false);
    expect(r.staleLow).toBe(true);
    expect(r.months).toBeGreaterThan(6);
  });

  it('an undated result never unlocks anything', () => {
    const r = labSaysLow([{ test: 'Ferritin', result: 'low' }], 'iron', TODAY);
    expect(r.low).toBe(false);
    expect(r.undated).toBe(true);
  });
});

describe('MMA runs backwards', () => {
  it('a HIGH MMA means B12 is low', () => {
    const r = readLab({ test: 'MMA', result: 'high', date: '2026-09-01' }, TODAY);
    expect(r.nutrientId).toBe('vitamin_b12');
    expect(r.result).toBe('low');
    expect(r.inverted).toBe(true);
  });

  it('homocysteine stays a plain note', () => {
    expect(readLab({ test: 'Homocysteine', result: 'high', date: '2026-09-01' }, TODAY).unmapped).toBe(true);
  });
});

describe('calcium and potassium results never nudge a supplement', () => {
  for (const t of ['Calcium', 'Potassium']) {
    it(`${t} is note-only`, () => {
      const r = readLab({ test: t, result: 'low', date: '2026-09-01' }, TODAY);
      expect(r.noteOnly).toBe(true);
      expect(r.nutrientId).toBeNull();
    });
  }
});

describe('freshness', () => {
  it('counts whole months', () => {
    expect(monthsSince('2026-09-04', TODAY)).toBe(1);
    expect(monthsSince('2026-04-04', TODAY)).toBe(6);
    expect(monthsSince(null, TODAY)).toBeNull();
  });
});

describe('timing clashes inside one slot', () => {
  const P = (id, lineId) => ({ id, name: id, servings: 1, perServing: [{ id: lineId, amount: 10, unit: 'mg' }] });

  it('iron and calcium in the same slot raise one tip', () => {
    const c = slotConflicts({ slotProducts: [P('a', 'iron'), P('b', 'calcium')], data });
    expect(c.length).toBeGreaterThan(0);
    const pair = c.find((x) => [x.aId, x.bId].includes('iron') && [x.aId, x.bId].includes('calcium'));
    expect(pair).toBeTruthy();
    expect(pair.hours).toBeGreaterThan(0);
  });

  it('reports the pair once, not twice', () => {
    const c = slotConflicts({ slotProducts: [P('a', 'iron'), P('b', 'calcium')], data });
    const pairs = c.filter((x) => [x.aId, x.bId].sort().join('|') === 'calcium|iron');
    expect(pairs.length).toBe(1);
  });

  it('raises nothing when they are in different slots', () => {
    expect(slotConflicts({ slotProducts: [P('a', 'iron')], data }).length).toBe(0);
  });

  it('"move by N hours" wraps inside the day', () => {
    expect(shiftTime('08:00', 2)).toBe('10:00');
    expect(shiftTime('23:00', 2)).toBe('01:00');
    expect(shiftTime('bad', 2)).toBe('bad');
  });
});
