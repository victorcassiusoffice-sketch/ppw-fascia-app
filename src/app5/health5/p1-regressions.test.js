// Three more the review found, all of which a green suite had been hiding.
//
// The first is the one that mattered most: every test in this engine fed it
// dates like '2026-10-04', but the APP writes '2026-10-4'. Date rejects that,
// so every surgery window and every lab-freshness check would have failed
// silently the first time real app data reached it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setHealthData } from './data.js';
import { convertLine } from './units.js';
import { parseDayKey, toDayISO, activeConditions, surgeryPlan } from './flags.js';
import { monthsSince, labSaysLow, ironUnlocked } from './labs.js';
import { dayTotals } from './totals.js';
import { evaluate } from './limits.js';

const read = (f) => JSON.parse(readFileSync(join(process.cwd(), 'docs/health-pack/data', f), 'utf8'));
const data = setHealthData({
  nutrients: read('nutrients.json'),
  ingredients: read('ingredients.json'),
  rules: read('rules.json'),
});

// EXACTLY what store5.todayKey() produces: no zero-padding.
const APP_TODAY = '2026-10-4';
const APP_SURGERY = '2026-11-3';

describe('P1-A — the app writes unpadded date keys, and Date rejects them', () => {
  it('new Date() genuinely cannot read the app’s own format', () => {
    expect(isNaN(new Date('2026-10-4T00:00:00'))).toBe(true);   // the bug, demonstrated
    expect(parseDayKey('2026-10-4')).toBeInstanceOf(Date);       // the fix
  });

  it('parses padded and unpadded identically', () => {
    expect(toDayISO(parseDayKey('2026-10-4'))).toBe('2026-10-04');
    expect(toDayISO(parseDayKey('2026-10-04'))).toBe('2026-10-04');
    expect(parseDayKey('nonsense')).toBeNull();
    expect(parseDayKey(null)).toBeNull();
  });

  it('a surgery window works with real app dates', () => {
    const c = activeConditions({ surgery: { date: APP_SURGERY }, _rules: data.rules }, APP_TODAY);
    expect(c.has('upcoming_surgery')).toBe(true);
  });

  it('a pause date is right when both dates come from the app', () => {
    const garlic = { id: 'g', name: 'Garlic', servings: 1, perServing: [{ id: 'garlic', amount: 600, unit: 'mg' }] };
    const plan = surgeryPlan({ data, profile: { surgery: { date: APP_SURGERY } }, cabinet: [garlic], todayISO: APP_TODAY });
    expect(plan.items[0].fromISO).toBe('2026-10-27');    // 7 days before, padded back out
  });

  it('lab freshness works with real app dates', () => {
    expect(monthsSince('2026-9-4', APP_TODAY)).toBe(1);
    expect(ironUnlocked([{ test: 'Ferritin', result: 'low', date: '2026-9-1' }], APP_TODAY)).toBe(true);
    expect(labSaysLow([{ test: 'Ferritin', result: 'low', date: '2026-2-1' }], 'iron', APP_TODAY).staleLow).toBe(true);
  });
});

describe('P1-B — probiotics are counted in billions', () => {
  const pro = data.nutrientsById.get('probiotics');

  it('500 million CFU is half a billion, not five hundred', () => {
    const r = convertLine(pro, { amount: 500, unit: 'million CFU' });
    expect(r.ok).toBe(true);
    expect(r.meter).toBeCloseTo(0.5, 6);
  });

  it('billions pass through unchanged', () => {
    expect(convertLine(pro, { amount: 5, unit: 'billion CFU' }).meter).toBe(5);
  });

  it('a raw CFU count scales too', () => {
    expect(convertLine(pro, { amount: 1e9, unit: 'CFU' }).meter).toBeCloseTo(1, 6);
  });
});

describe('P1-C — a plate of food is not a limit breach', () => {
  const liver = [{ name: 'Liver', nutrients: { vitamin_a: 6000, vitamin_b9: 500 } }];

  it('food vitamin A does not trip the preformed-retinol limit', () => {
    const t = dayTotals({ cabinet: [], foods: liver, data });
    const r = evaluate(data.nutrientsById.get('vitamin_a'), { totals: t.byNutrient.vitamin_a, target: 900, thresholds: data.thresholds });
    expect(r.countedForLimit).toBe(0);
    expect(r.state).not.toBe('over_max');
    expect(r.meter).toBe(6000);           // still counted toward the target
  });

  it('food folate does not trip the folic-acid limit', () => {
    const t = dayTotals({ cabinet: [], foods: liver, data });
    const r = evaluate(data.nutrientsById.get('vitamin_b9'), { totals: t.byNutrient.vitamin_b9, target: 400, thresholds: data.thresholds });
    expect(r.countedForLimit).toBe(0);
  });

  it('a supplement still trips both', () => {
    const cabinet = [{
      id: 'p', name: 'High A+folate', servings: 1,
      perServing: [{ id: 'vitamin_a', amount: 4000, unit: 'µg', form: 'retinol' }, { id: 'vitamin_b9', amount: 1200, unit: 'µg', form: 'folic acid' }],
    }];
    const t = dayTotals({ cabinet, takenIds: ['p'], data });
    expect(evaluate(data.nutrientsById.get('vitamin_a'), { totals: t.byNutrient.vitamin_a, target: 900, thresholds: data.thresholds }).state).toBe('over_max');
    expect(evaluate(data.nutrientsById.get('vitamin_b9'), { totals: t.byNutrient.vitamin_b9, target: 400, thresholds: data.thresholds }).state).toBe('over_max');
  });

  it('a total-based limit still counts food, as it should', () => {
    const t = dayTotals({ cabinet: [], foods: [{ name: 'Fortified milk', nutrients: { calcium: 2600 } }], data });
    const r = evaluate(data.nutrientsById.get('calcium'), { totals: t.byNutrient.calcium, target: 1000, age: 40, thresholds: data.thresholds });
    expect(r.countedForLimit).toBe(2600);
    expect(r.state).toBe('over_max');
  });
});
