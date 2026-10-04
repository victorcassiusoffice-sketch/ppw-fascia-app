// Flags — the §9 list, case for case.
//
// This is the part of the app that says "don't take that" or "ask your doctor
// first". Every expectation here is a safety behaviour from the brief, and the
// negative cases matter as much as the positive ones: a flag that fires when it
// shouldn't trains people to ignore the ones that should.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setHealthData } from './data.js';
import { flagsForProduct, flagsForNutrients, activeConditions, surgeryPlan, strictest, matchesGroup } from './flags.js';

const read = (f) => JSON.parse(readFileSync(join(process.cwd(), 'docs/health-pack/data', f), 'utf8'));
const data = setHealthData({
  nutrients: read('nutrients.json'),
  ingredients: read('ingredients.json'),
  rules: read('rules.json'),
});

const TODAY = '2026-10-04';
/** One product with one line. */
const P = (id, line, extra = {}) => ({ id, name: id, servings: 1, perServing: [line], ...extra });
/** The strictest action for a product, given a profile. */
const act = (product, profile) =>
  flagsForProduct(product, { data, profile, cabinet: [product], todayISO: TODAY }).action;

describe('vitamin A in pregnancy depends entirely on the form', () => {
  const preg = { conditions: ['pregnancy'] };

  it('retinol is avoid', () => {
    expect(act(P('a', { id: 'vitamin_a', amount: 800, unit: 'µg', form: 'retinol' }), preg)).toBe('avoid');
  });

  it('beta-carotene raises nothing', () => {
    expect(act(P('a', { id: 'vitamin_a', amount: 6, unit: 'mg', form: 'beta-carotene' }), preg)).toBeNull();
  });

  it('an unlabelled form is doctor_first — we ask rather than assume', () => {
    expect(act(P('a', { id: 'vitamin_a', amount: 800, unit: 'µg' }), preg)).toBe('doctor_first');
  });
});

describe('thresholds decide whether a flag fires at all', () => {
  it('trying to conceive: 1,000 µg retinol is nothing, 4,000 µg is avoid', () => {
    const t = { conditions: ['trying_to_conceive'] };
    expect(act(P('a', { id: 'vitamin_a', amount: 1000, unit: 'µg', form: 'retinol' }), t)).toBeNull();
    expect(act(P('a', { id: 'vitamin_a', amount: 4000, unit: 'µg', form: 'retinol' }), t)).toBe('avoid');
  });

  it('migraine: 200 mg magnesium is nothing, 400 mg is doctor_first', () => {
    const m = { conditions: ['migraine'] };
    expect(act(P('m', { id: 'magnesium', amount: 200, unit: 'mg' }), m)).toBeNull();
    expect(act(P('m', { id: 'magnesium', amount: 400, unit: 'mg' }), m)).toBe('doctor_first');
  });

  it('high blood pressure: 100 mg magnesium is caution only, 300 mg is doctor_first', () => {
    const h = { conditions: ['high_blood_pressure'] };
    expect(act(P('m', { id: 'magnesium', amount: 100, unit: 'mg' }), h)).toBe('caution');
    expect(act(P('m', { id: 'magnesium', amount: 300, unit: 'mg' }), h)).toBe('doctor_first');
  });

  it('kidney disease flags magnesium at any amount', () => {
    const k = { conditions: ['kidney_disease'] };
    expect(act(P('m', { id: 'magnesium', amount: 100, unit: 'mg' }), k)).toBe('doctor_first');
  });

  it('B6: 2 mg is nothing with an anti-seizure medicine, 30 mg is doctor_first', () => {
    const e = { medicines: ['anti_seizure_medicines'] };
    const low = act(P('b', { id: 'vitamin_b6', amount: 2, unit: 'mg' }), e);
    const high = act(P('b', { id: 'vitamin_b6', amount: 30, unit: 'mg' }), e);
    expect(high).toBe('doctor_first');
    expect(low).not.toBe('doctor_first');
  });
});

describe('smoking and beta-carotene', () => {
  const s = { conditions: ['smoker'] };

  it('beta-carotene is avoid', () => {
    expect(act(P('bc', { id: 'vitamin_a', amount: 6, unit: 'mg', form: 'beta-carotene' }), s)).toBe('avoid');
  });

  it('an unlabelled vitamin A is caution, not avoid', () => {
    expect(act(P('a', { id: 'vitamin_a', amount: 800, unit: 'µg' }), s)).toBe('caution');
  });
});

describe('medicines', () => {
  it('warfarin implies blood_thinners and flags vitamin K', () => {
    const w = { medicines: ['warfarin'] };
    expect(activeConditions({ ...w, _rules: data.rules }, TODAY).has('blood_thinners')).toBe(true);
    expect(act(P('k', { id: 'vitamin_k', amount: 100, unit: 'µg' }), w)).toBe('doctor_first');
  });

  it('St John’s wort with an SSRI is avoid', () => {
    expect(act(P('sjw', { id: 'st_johns_wort', amount: 300, unit: 'mg' }), { medicines: ['ssris_snris'] })).toBe('avoid');
  });

  it('cranberry with warfarin is avoid', () => {
    expect(act(P('cr', { id: 'cranberry', amount: 500, unit: 'mg' }), { medicines: ['warfarin'] })).toBe('avoid');
  });

  it('a garlic supplement with apixaban is avoid', () => {
    expect(act(P('g', { id: 'garlic', amount: 600, unit: 'mg' }), { medicines: ['doacs'] })).toBe('avoid');
  });
});

describe('ACE inhibitors and potassium — the dose is the whole question', () => {
  const ace = { medicines: ['ace_inhibitors_and_arbs'] };

  it('a potassium salt substitute is avoid', () => {
    expect(act(P('ks', { id: 'potassium_salt_substitute', amount: 1, unit: 'g' }), ace)).toBe('avoid');
  });

  it('a multivitamin with 80 mg potassium raises nothing', () => {
    expect(act(P('mv', { id: 'potassium', amount: 80, unit: 'mg' }), ace)).toBeNull();
  });

  it('300 mg of potassium is avoid', () => {
    expect(act(P('k', { id: 'potassium', amount: 300, unit: 'mg' }), ace)).toBe('avoid');
  });
});

describe('the strictest badge wins, and every reason is kept', () => {
  it('reports avoid when avoid and caution both apply', () => {
    expect(strictest(['caution', 'avoid', 'doctor_first'])).toBe('avoid');
    expect(strictest(['check_level', 'caution'])).toBe('caution');
    expect(strictest([])).toBeNull();
  });

  it('lists every reason, not just the worst', () => {
    const product = P('a', { id: 'vitamin_a', amount: 4000, unit: 'µg', form: 'retinol' });
    const r = flagsForProduct(product, {
      data,
      profile: { conditions: ['pregnancy', 'liver_disease'] },
      cabinet: [product],
      todayISO: TODAY,
    });
    expect(r.action).toBe('avoid');
    expect(r.flags.length).toBeGreaterThan(1);
  });
});

describe('groups are derived, not stored', () => {
  it('herbal matches a herb but never a vitamin', () => {
    expect(matchesGroup('herbal', P('g', { id: 'garlic', amount: 600, unit: 'mg' }), data)).toBe(true);
    expect(matchesGroup('herbal', P('d', { id: 'vitamin_d', amount: 25, unit: 'µg' }), data)).toBe(false);
    expect(matchesGroup('herbal', P('cl', { id: 'cod_liver_oil', amount: 5, unit: 'mg' }), data)).toBe(false);
  });

  it('ashwagandha counts as herbal even though it is a nutrient id', () => {
    expect(matchesGroup('herbal', P('ash', { id: 'ashwagandha', amount: 600, unit: 'mg' }), data)).toBe(true);
  });

  it('beta_carotene matches only vitamin A in that form', () => {
    expect(matchesGroup('beta_carotene', P('bc', { id: 'vitamin_a', amount: 6, unit: 'mg', form: 'beta-carotene' }), data)).toBe(true);
    expect(matchesGroup('beta_carotene', P('r', { id: 'vitamin_a', amount: 900, unit: 'µg', form: 'retinol' }), data)).toBe(false);
  });

  it('venoactive matches the two venoactive products', () => {
    expect(matchesGroup('venoactive', P('v', { id: 'mpff_diosmin_hesperidin', amount: 1, unit: 'g' }), data)).toBe(true);
    expect(matchesGroup('venoactive', P('x', { id: 'vitamin_c', amount: 500, unit: 'mg' }), data)).toBe(false);
  });
});

describe('a flagged nutrient stops showing "low"', () => {
  it('iodine with thyroid disease is suppressed', () => {
    const cabinet = [P('i', { id: 'iodine', amount: 150, unit: 'µg' })];
    const f = flagsForNutrients({ data, profile: { conditions: ['thyroid_disease'] }, cabinet, todayISO: TODAY });
    expect(f.iodine).toBeTruthy();
    expect(f.iodine.suppressed).toBe(true);
  });

  it('vitamin K with warfarin is suppressed', () => {
    const cabinet = [P('k', { id: 'vitamin_k', amount: 100, unit: 'µg' })];
    const f = flagsForNutrients({ data, profile: { medicines: ['warfarin'] }, cabinet, todayISO: TODAY });
    expect(f.vitamin_k.suppressed).toBe(true);
  });

  it('a nutrient with no flag is not suppressed', () => {
    const cabinet = [P('c', { id: 'vitamin_c', amount: 200, unit: 'mg' })];
    const f = flagsForNutrients({ data, profile: {}, cabinet, todayISO: TODAY });
    expect(f.vitamin_c?.suppressed).toBeFalsy();
  });
});

describe('surgery — the wording is the safety feature', () => {
  const garlic = P('g', { id: 'garlic', amount: 600, unit: 'mg' });
  const valerian = P('v', { id: 'valerian', amount: 500, unit: 'mg' });
  const iron = P('fe', { id: 'iron', amount: 14, unit: 'mg' });

  const planFor = (cabinet, date) =>
    surgeryPlan({ data, profile: { surgery: { date } }, cabinet, todayISO: TODAY });

  it('garlic 30 days out says pause from a date, and is not avoid', () => {
    const plan = planFor([garlic], '2026-11-03');
    const row = plan.items.find((i) => i.productId === 'g');
    expect(row.advice).toBe('pause');
    expect(row.fromISO).toBe('2026-10-27');   // 7 days before
    expect(act(garlic, { surgery: { date: '2026-11-03' } })).not.toBe('avoid');
  });

  it('garlic 5 days out is avoid', () => {
    expect(act(garlic, { surgery: { date: '2026-10-09' } })).toBe('avoid');
  });

  it('valerian is tapered, never paused', () => {
    const row = planFor([valerian], '2026-10-24').items.find((i) => i.productId === 'v');
    expect(row.advice).toBe('taper_ask');
    expect(row.advice).not.toBe('pause');
  });

  it('iron is usually continued — never "pause"', () => {
    const row = planFor([iron], '2026-10-07').items.find((i) => i.productId === 'fe');
    expect(row.advice).toBe('continue_ask');
  });

  it('"tell your team" lands 28 days before, or today if that has passed', () => {
    expect(planFor([garlic], '2026-11-02').tellTeamOn).toBe('2026-10-05');
    expect(planFor([garlic], '2026-10-10').tellTeamOn).toBe(TODAY);
  });

  it('a surgery with no date still treats the rules as live', () => {
    expect(activeConditions({ surgery: {}, _rules: data.rules }, TODAY).has('upcoming_surgery')).toBe(true);
  });
});

describe('implied conditions', () => {
  it('age 65 and a vegan diet are inferred, not asked twice', () => {
    const c = activeConditions({ age: 70, diet: 'vegan', _rules: data.rules }, TODAY);
    expect(c.has('age_65_plus')).toBe(true);
    expect(c.has('vegan_vegetarian')).toBe(true);
  });

  it('a recent operation stays flagged for 42 days', () => {
    expect(activeConditions({ surgery: { date: '2026-09-20' }, _rules: data.rules }, TODAY).has('recent_surgery')).toBe(true);
    expect(activeConditions({ surgery: { date: '2026-07-01' }, _rules: data.rules }, TODAY).has('recent_surgery')).toBe(false);
  });
});
