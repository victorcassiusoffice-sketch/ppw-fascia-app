// Limits, targets and meter modes — the §9 cases.
//
// These decide whether the app tells someone they are fine, low, or over a safe
// maximum. The food_first cases matter most and are the least obvious: with no
// food data for magnesium, the app must NOT say "low", because most magnesium
// comes from food it has not been told about. Saying "low" there would push
// someone toward a supplement they may not need.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setHealthData } from './data.js';
import { limitFor, cautionFor, evaluate, productCaution } from './limits.js';
import { targetFor, canShowLow, canSuggestSupplement } from './targets.js';

const read = (f) => JSON.parse(readFileSync(join(process.cwd(), 'docs/health-pack/data', f), 'utf8'));
const data = setHealthData({
  nutrients: read('nutrients.json'),
  ingredients: read('ingredients.json'),
  rules: read('rules.json'),
});
const N = (id) => data.nutrientsById.get(id);
const TH = data.thresholds;

/** Judge a nutrient from plain numbers. */
const judge = (id, totals, opts = {}) => {
  const n = N(id);
  const t = opts.target !== undefined ? opts.target : targetFor(n, opts.profile || {}).value;
  return evaluate(n, {
    totals,
    target: t,
    age: opts.age ?? opts.profile?.age ?? null,
    form: opts.form || null,
    supervised: !!opts.supervised,
    thresholds: TH,
    canShowLow: opts.canShowLow !== false,
    suppressed: !!opts.suppressed,
  });
};

describe('limits — what counts toward the maximum', () => {
  it('magnesium 300 mg of supplements is over max even with food alongside', () => {
    // Magnesium's limit counts supplements only, so the 200 mg of food is
    // irrelevant to the breach — and must not be used to excuse it.
    const r = judge('magnesium', { meter: 500, limitTotal: 500, supplementsOnly: 300, foodOnly: 200 });
    expect(r.limit).toBe(250);
    expect(r.limitAppliesTo).toBe('supplements_only');
    expect(r.countedForLimit).toBe(300);
    expect(r.state).toBe('over_max');
  });

  it('zinc 30 mg is over the 25 mg limit', () => {
    const r = judge('zinc', { meter: 30, limitTotal: 30, supplementsOnly: 30 });
    expect(r.limit).toBe(25);
    expect(r.state).toBe('over_max');
  });

  it('niacin: 20 mg as nicotinamide is fine, as nicotinic acid is over', () => {
    const fine = judge('vitamin_b3', { meter: 20, limitTotal: 20, supplementsOnly: 20 }, { form: 'nicotinamide' });
    expect(fine.limit).toBe(35);
    expect(Math.round(fine.pctOfLimit)).toBe(57);
    expect(fine.state).not.toBe('over_max');

    const over = judge('vitamin_b3', { meter: 20, limitTotal: 20, supplementsOnly: 20 }, { form: 'nicotinic_acid' });
    expect(over.limit).toBe(10);
    expect(over.state).toBe('over_max');
  });

  it('calcium 2,200 mg is near max at 40 and over max at 60', () => {
    const young = judge('calcium', { meter: 2200, limitTotal: 2200 }, { age: 40 });
    expect(young.limit).toBe(2500);
    expect(young.state).toBe('near_max');

    const older = judge('calcium', { meter: 2200, limitTotal: 2200 }, { age: 60 });
    expect(older.limit).toBe(2000);
    expect(older.state).toBe('over_max');
  });

  it('a doctor-prescribed iron dose reports as supervised, not over max', () => {
    const r = judge('iron', { meter: 65, limitTotal: 65, supplementsOnly: 65 }, { supervised: true });
    expect(r.state).toBe('supervised');
    expect(r.limit).toBe(40);      // the number and the max are still shown
    expect(r.meter).toBe(65);
  });

  it('a weekly doctor-prescribed vitamin D is supervised, not over max', () => {
    const r = judge('vitamin_d', { meter: 1250, limitTotal: 1250 }, { supervised: true });
    expect(r.state).toBe('supervised');
  });
});

describe('softer warnings are not limit breaches', () => {
  it('omega-3 1,500 mg is a caution, not over max', () => {
    const r = judge('omega_3', { meter: 1500, limitTotal: 1500, supplementsOnly: 1500 });
    expect(r.state).not.toBe('over_max');
    expect(r.notes.some((n) => n.kind === 'caution')).toBe(true);
    expect(cautionFor(N('omega_3')).value).toBe(1000);
  });

  it('manganese caution drops to 0.5 mg from 65', () => {
    expect(cautionFor(N('manganese'), { age: 40 }).value).toBe(4);
    expect(cautionFor(N('manganese'), { age: 70 }).value).toBe(0.5);
  });

  it('an iodine product over 500 µg gets a product caution, and 600 reads near max', () => {
    expect(productCaution(N('iodine'), 600)).toBeTruthy();
    expect(productCaution(N('iodine'), 400)).toBeNull();
    const r = judge('iodine', { meter: 600, limitTotal: 600 });
    expect(r.state).toBe('near_max');   // exactly 100% is not yet over
  });
});

describe('meter modes decide whether "low" is honest', () => {
  it('magnesium with no food data never shows low', () => {
    expect(canShowLow(N('magnesium'), { hasFoodDataForNutrient: false })).toBe(false);
    const r = judge('magnesium', { meter: 100, limitTotal: 100, supplementsOnly: 100 }, { canShowLow: false });
    expect(r.state).not.toBe('low');
  });

  it('magnesium with food data for magnesium can show low', () => {
    expect(canShowLow(N('magnesium'), { hasFoodDataForNutrient: true })).toBe(true);
    const r = judge('magnesium', { meter: 100, limitTotal: 100, foodOnly: 50 }, { canShowLow: true });
    expect(r.state).toBe('low');
  });

  it('potassium never shows low and is never suggested', () => {
    expect(canShowLow(N('potassium'), { hasFoodDataForNutrient: true })).toBe(false);
    expect(canSuggestSupplement(N('potassium'))).toBe(false);
  });

  it('iron shows low only with a recent low ferritin', () => {
    expect(canShowLow(N('iron'), { labSaysLow: false })).toBe(false);
    expect(canShowLow(N('iron'), { labSaysLow: true })).toBe(true);
    expect(canSuggestSupplement(N('iron'), { labSaysLow: false })).toBe(false);
    expect(canSuggestSupplement(N('iron'), { labSaysLow: true })).toBe(true);
  });

  it('a suppressed nutrient asks the doctor instead of showing low', () => {
    const r = judge('iodine', { meter: 10, limitTotal: 10 }, { suppressed: true });
    expect(r.state).toBe('ask_doctor');
  });
});

describe('targets', () => {
  it('unknown sex takes the higher target, except iron which takes male', () => {
    expect(targetFor(N('vitamin_a'), {}).value).toBe(900);          // male 900 > female 700
    expect(targetFor(N('iron'), {}).value).toBe(8);                 // male value on purpose
    expect(targetFor(N('iron'), { sex: 'female', age: 30 }).value).toBe(18);
  });

  it('age 72 needs 20 µg of vitamin D', () => {
    expect(targetFor(N('vitamin_d'), { age: 72, sex: 'male' }).value).toBe(20);
    expect(targetFor(N('vitamin_d'), { age: 40, sex: 'male' }).value).toBe(15);
  });

  it('pregnancy never lowers the ordinary need', () => {
    const p = targetFor(N('iron'), { sex: 'female', age: 30, conditions: ['pregnancy'] });
    expect(p.value).toBe(27);
    const d = targetFor(N('vitamin_d'), { sex: 'female', age: 30, conditions: ['pregnancy'] });
    expect(d.value).toBe(15);
  });

  it('protein: an 80 kg person who trains needs 96 g', () => {
    const r = targetFor(N('protein'), { weightKg: 80, training: true, sex: 'male', age: 30 });
    expect(r.value).toBe(96);
  });

  it('protein: 1.0 g/kg from 65', () => {
    expect(targetFor(N('protein'), { weightKg: 70, age: 70, sex: 'male' }).value).toBe(70);
  });

  it('protein: kidney disease has no target, by design', () => {
    const r = targetFor(N('protein'), { weightKg: 80, conditions: ['kidney_disease'] });
    expect(r.value).toBeNull();
    expect(r.noTarget).toBe(true);
  });

  it('protein falls back to flat grams without a weight', () => {
    expect(targetFor(N('protein'), { sex: 'female', age: 30 }).value).toBe(48);
  });

  it('carbs have no target until the person sets one', () => {
    expect(targetFor(N('carbohydrates'), {}).value).toBeNull();
    expect(targetFor(N('carbohydrates'), { targets: { carbohydrates: 130 } }).value).toBe(130);
  });
});

describe('unknown age takes the strictest limit band', () => {
  it('calcium with no age uses 2,000 mg', () => {
    expect(limitFor(N('calcium'), { age: null }).value).toBe(2000);
  });
});
