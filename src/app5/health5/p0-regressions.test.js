// The five P0s an adversarial review found in the first cut of this engine.
//
// Every one of them passed the original suite, because the tests and the code
// were written by the same hand and shared the same blind spots. They are
// written here as the behaviour a PERSON would experience, not as unit assertions
// about internals, so a future refactor has to keep the promise rather than the
// implementation.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setHealthData } from './data.js';
import { resolveForm, convertLine, needsFormQuestion } from './units.js';
import { flagsForProduct, flagsForNutrients, surgeryPlan } from './flags.js';
import { dayTotals, dosesPerDay, supervisedScope } from './totals.js';
import { evaluate } from './limits.js';

const read = (f) => JSON.parse(readFileSync(join(process.cwd(), 'docs/health-pack/data', f), 'utf8'));
const data = setHealthData({
  nutrients: read('nutrients.json'),
  ingredients: read('ingredients.json'),
  rules: read('rules.json'),
});
const TODAY = '2026-10-04';
const VIT_A = data.nutrientsById.get('vitamin_a');
const PREGNANT = { conditions: ['pregnancy'] };

const product = (id, perServing, extra = {}) => ({ id, name: id, servings: 1, perServing, ...extra });
const actionFor = (p, profile) => flagsForProduct(p, { data, profile, cabinet: [p], todayISO: TODAY }).action;

describe('P0-1 — a label naming two forms must not resolve to one of them', () => {
  // The original code picked the longest matching synonym, which meant the
  // engine got LESS safe the MORE honest the label was: a bare "Vitamin A"
  // correctly asked a question, while "as retinol and beta-carotene" silently
  // resolved to beta-carotene, counted 0 toward the retinol limit, and showed a
  // pregnant user nothing at all.
  const AMBIGUOUS = [
    'Vitamin A (as retinol and beta-carotene)',
    'Vitamin A (as retinyl palmitate and beta-carotene)',
    'Vitamin A (as beta-carotene and retinyl acetate)',
  ];

  for (const name of AMBIGUOUS) {
    it(`"${name}" is treated as unknown, not guessed`, () => {
      const line = { id: 'vitamin_a', amount: 3000, unit: 'µg', name };
      expect(resolveForm(VIT_A, line)).toBeNull();
      expect(needsFormQuestion(VIT_A, line)).toBe(true);
    });

    it(`"${name}" still counts toward the retinol limit`, () => {
      const line = { id: 'vitamin_a', amount: 3000, unit: 'µg', name };
      expect(convertLine(VIT_A, line).limit).toBe(3000);   // not 0
    });

    it(`"${name}" still warns a pregnant user`, () => {
      const line = { id: 'vitamin_a', amount: 3000, unit: 'µg', name };
      expect(actionFor(product('a', [line]), PREGNANT)).toBe('doctor_first');
    });
  }

  it('an unambiguous label still resolves exactly as before', () => {
    expect(resolveForm(VIT_A, { name: 'Vitamin A (as retinol)' })).toBe('retinol');
    expect(resolveForm(VIT_A, { name: 'Vitamin A (as beta-carotene)' })).toBe('beta_carotene');
    expect(actionFor(product('a', [{ id: 'vitamin_a', amount: 3000, unit: 'µg', form: 'retinol' }]), PREGNANT)).toBe('avoid');
  });

  it('being more specific never makes the verdict weaker', () => {
    const bare = convertLine(VIT_A, { id: 'vitamin_a', amount: 3000, unit: 'µg', name: 'Vitamin A' });
    const both = convertLine(VIT_A, { id: 'vitamin_a', amount: 3000, unit: 'µg', name: 'Vitamin A (as retinol and beta-carotene)' });
    expect(both.limit).toBeGreaterThanOrEqual(bare.limit);
  });
});

describe('P0-2 — one prescribed dose does not excuse everything in the bottle', () => {
  const ironAndZinc = product('m',
    [{ id: 'iron', amount: 65, unit: 'mg' }, { id: 'zinc', amount: 50, unit: 'mg' }],
    { supervised: true });

  it('will not guess which nutrient the doctor prescribed', () => {
    const scope = supervisedScope(ironAndZinc, data);
    expect(scope.ids.size).toBe(0);
    expect(scope.ambiguous).toBe(true);
    expect(scope.candidates).toEqual(['iron', 'zinc']);
  });

  it('keeps showing the zinc breach until the question is answered', () => {
    const t = dayTotals({ cabinet: [ironAndZinc], takenIds: ['m'], data });
    const r = evaluate(data.nutrientsById.get('zinc'), {
      totals: t.byNutrient.zinc, target: 11, supervised: t.supervisedNutrients.has('zinc'), thresholds: data.thresholds,
    });
    expect(r.state).toBe('over_max');
    expect(t.supervisedAmbiguous).toHaveLength(1);
  });

  it('honours an explicit answer', () => {
    const answered = { ...ironAndZinc, supervisedFor: ['iron'] };
    const t = dayTotals({ cabinet: [answered], takenIds: ['m'], data });
    expect([...t.supervisedNutrients]).toEqual(['iron']);
    const zinc = evaluate(data.nutrientsById.get('zinc'), {
      totals: t.byNutrient.zinc, target: 11, supervised: t.supervisedNutrients.has('zinc'), thresholds: data.thresholds,
    });
    expect(zinc.state).toBe('over_max');      // still reported
  });

  it('a single-nutrient prescription needs no question (the section-9 case)', () => {
    const ironOnly = product('fe', [{ id: 'iron', amount: 65, unit: 'mg' }], { supervised: true });
    const t = dayTotals({ cabinet: [ironOnly], takenIds: ['fe'], data });
    expect([...t.supervisedNutrients]).toEqual(['iron']);
    const r = evaluate(data.nutrientsById.get('iron'), {
      totals: t.byNutrient.iron, target: 8, supervised: true, thresholds: data.thresholds,
    });
    expect(r.state).toBe('supervised');
    expect(r.limit).toBe(40);     // the number and the max are still shown
    expect(r.meter).toBe(65);
  });
});

describe('P0-3 — a supplement taken twice a day counts twice', () => {
  it('counts both doses toward the limit', () => {
    const twice = product('mg', [{ id: 'magnesium', amount: 200, unit: 'mg' }], { times: ['08:00', '20:00'] });
    const t = dayTotals({ cabinet: [twice], takenIds: ['mg'], data });
    expect(t.byNutrient.magnesium.supplementsOnly).toBe(400);
    const r = evaluate(data.nutrientsById.get('magnesium'), {
      totals: t.byNutrient.magnesium, target: 320, thresholds: data.thresholds, canShowLow: false,
    });
    expect(r.state).toBe('over_max');    // 400 against a 250 mg supplement limit
  });

  it('a single time is still one dose', () => {
    const once = product('mg', [{ id: 'magnesium', amount: 200, unit: 'mg' }], { times: ['08:00'] });
    expect(dayTotals({ cabinet: [once], takenIds: ['mg'], data }).byNutrient.magnesium.supplementsOnly).toBe(200);
  });

  it('servings and doses multiply, they do not replace each other', () => {
    const two = product('mg', [{ id: 'magnesium', amount: 100, unit: 'mg' }], { servings: 2, times: ['08:00', '20:00'] });
    expect(dosesPerDay(two)).toBe(2);
    expect(dayTotals({ cabinet: [two], takenIds: ['mg'], data }).byNutrient.magnesium.supplementsOnly).toBe(400);
  });

  it('no times at all behaves exactly as before', () => {
    const plain = product('mg', [{ id: 'magnesium', amount: 200, unit: 'mg' }]);
    expect(dosesPerDay(plain)).toBe(1);
    expect(dayTotals({ cabinet: [plain], takenIds: ['mg'], data }).byNutrient.magnesium.supplementsOnly).toBe(200);
  });
});

describe('P0-4 — a multivitamin is never told to "Pause"', () => {
  const multivitamin = product('mv', [
    { id: 'iron', amount: 14, unit: 'mg' },
    { id: 'vitamin_e', amount: 15, unit: 'mg' },
    { id: 'vitamin_c', amount: 80, unit: 'mg' },
  ]);
  const plan = (cabinet, date) => surgeryPlan({ data, profile: { surgery: { date } }, cabinet, todayISO: TODAY });

  it('says "ask your team", because 15 mg does not reach the vitamin E row', () => {
    const row = plan([multivitamin], '2026-11-03').items.find((i) => i.productId === 'mv');
    expect(row.advice).toBe('ask_pause');
    expect(row.advice).not.toBe('pause');
  });

  it('does say pause once the vitamin E is genuinely high', () => {
    const highE = product('mv2', [{ id: 'vitamin_e', amount: 400, unit: 'mg', form: 'natural' }]);
    expect(plan([highE], '2026-11-03').items.find((i) => i.productId === 'mv2').advice).toBe('pause');
  });

  it('an item the team would continue carries no stop date', () => {
    const iron = product('fe', [{ id: 'iron', amount: 14, unit: 'mg' }]);
    const row = plan([iron], '2026-10-07').items.find((i) => i.productId === 'fe');
    expect(row.advice).toBe('continue_ask');
    expect(row.fromISO).toBeNull();
  });
});

describe('P0-5 — the order of the cabinet changes nothing', () => {
  const betaCarotene = product('bc', [{ id: 'vitamin_a', amount: 6, unit: 'mg', form: 'beta-carotene' }]);
  const retinol = product('ret', [{ id: 'vitamin_a', amount: 3000, unit: 'µg', form: 'retinol' }]);

  for (const order of [[betaCarotene, retinol], [retinol, betaCarotene]]) {
    it(`warns a pregnant user with the cabinet as [${order.map((p) => p.id).join(', ')}]`, () => {
      const f = flagsForNutrients({ data, profile: PREGNANT, cabinet: order, todayISO: TODAY });
      expect(f.vitamin_a?.action).toBe('avoid');
      expect(f.vitamin_a?.suppressed).toBe(true);
    });
  }

  it('beta-carotene alone still raises nothing in pregnancy', () => {
    const f = flagsForNutrients({ data, profile: PREGNANT, cabinet: [betaCarotene], todayISO: TODAY });
    expect(f.vitamin_a?.action).toBeUndefined();
  });
});
