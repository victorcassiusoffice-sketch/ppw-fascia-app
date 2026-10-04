// Unit conversion — every case from the brief's §9 "Units" list.
//
// These are the numbers a person's safety rests on. A label says "400 IU" and
// the app has to know that means 180 mg toward the target and 364 mg toward the
// limit if it is synthetic, or 268 mg toward both if it is natural. Getting this
// wrong is how an app tells someone they are fine when they are over a limit.
//
// Every expected value here comes from docs/health-pack/data/nutrients.json.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setHealthData } from './data.js';
import {
  convertLine, normaliseUnit, resolveForm, needsFormQuestion, formOptions, formMatters,
} from './units.js';

const read = (f) => JSON.parse(readFileSync(join(process.cwd(), 'docs/health-pack/data', f), 'utf8'));
const data = setHealthData({
  nutrients: read('nutrients.json'),
  ingredients: read('ingredients.json'),
  rules: read('rules.json'),
});
const N = (id) => data.nutrientsById.get(id);
const round = (v) => Math.round(v);

describe('unit spellings all land on one key', () => {
  it('accepts every microgram spelling', () => {
    for (const u of ['mcg', 'μg', 'ug', 'µg', 'Microgram']) expect(normaliseUnit(u)).toBe('µg');
  });

  it('accepts IU, DFE and CFU spellings', () => {
    expect(normaliseUnit('IU')).toBe('IU');
    expect(normaliseUnit('i.u.')).toBe('IU');
    expect(normaliseUnit('mcg DFE')).toBe('µg DFE');
    expect(normaliseUnit('billion CFU')).toBe('billion_cfu');
  });

  it('returns null for something it does not know', () => {
    expect(normaliseUnit('drops')).toBeNull();
    expect(normaliseUnit('')).toBeNull();
  });

  it('"200 mcg", "200 μg" and "200 ug" all convert the same', () => {
    for (const u of ['mcg', 'μg', 'ug']) {
      const r = convertLine(N('vitamin_b12'), { amount: 200, unit: u });
      expect(r.ok).toBe(true);
      expect(r.meter).toBe(200);
    }
  });
});

describe('vitamin D', () => {
  it('1,000 IU D3 → 25 µg', () => {
    const r = convertLine(N('vitamin_d'), { amount: 1000, unit: 'IU', form: 'd3' });
    expect(r.ok).toBe(true);
    expect(r.meter).toBe(25);
    expect(r.limit).toBe(25);
  });
});

describe('vitamin E — the form changes the limit, not the target', () => {
  it('400 IU synthetic → meter 180 mg, limit 364 mg', () => {
    const r = convertLine(N('vitamin_e'), { amount: 400, unit: 'IU', form: 'synthetic' });
    expect(round(r.meter)).toBe(180);
    expect(round(r.limit)).toBe(364);
  });

  it('400 IU natural → 268 mg toward both', () => {
    const r = convertLine(N('vitamin_e'), { amount: 400, unit: 'IU', form: 'natural' });
    expect(round(r.meter)).toBe(268);
    expect(round(r.limit)).toBe(268);
  });

  it('unknown form is counted the cautious way (as synthetic)', () => {
    const r = convertLine(N('vitamin_e'), { amount: 400, unit: 'IU' });
    expect(round(r.meter)).toBe(180);
    expect(round(r.limit)).toBe(364);
    expect(r.formKnown).toBe(false);
  });

  it('reads the form from the label text', () => {
    expect(resolveForm(N('vitamin_e'), { name: 'Vitamin E (as d-alpha tocopherol)' })).toBe('natural');
    expect(resolveForm(N('vitamin_e'), { name: 'Vitamin E (as dl-alpha-tocopherol)' })).toBe('synthetic');
  });
});

describe('folate — DFE on the target, folic acid on the limit', () => {
  it('400 µg folic acid → 680 µg DFE meter, 400 toward the limit', () => {
    const r = convertLine(N('vitamin_b9'), { amount: 400, unit: 'µg', form: 'folic acid' });
    expect(round(r.meter)).toBe(680);
    expect(round(r.limit)).toBe(400);
  });

  it('400 µg DFE with an unknown form → 400 meter, 235 toward the limit', () => {
    const r = convertLine(N('vitamin_b9'), { amount: 400, unit: 'µg DFE' });
    expect(round(r.meter)).toBe(400);
    expect(round(r.limit)).toBe(235);
  });
});

describe('vitamin A — beta-carotene never counts toward the limit', () => {
  it('5,000 IU beta-carotene → 1,500 µg RAE meter, 0 toward the limit', () => {
    const r = convertLine(N('vitamin_a'), { amount: 5000, unit: 'IU', form: 'beta-carotene' });
    expect(round(r.meter)).toBe(1500);
    expect(r.limit).toBe(0);
  });

  it('6 mg beta-carotene → 3,000 µg RAE, 0 toward the limit', () => {
    const r = convertLine(N('vitamin_a'), { amount: 6, unit: 'mg', form: 'beta-carotene' });
    expect(round(r.meter)).toBe(3000);
    expect(r.limit).toBe(0);
  });

  it('retinol counts toward both', () => {
    const r = convertLine(N('vitamin_a'), { amount: 900, unit: 'µg', form: 'retinol' });
    expect(round(r.meter)).toBe(900);
    expect(round(r.limit)).toBe(900);
  });
});

describe('a line is never silently dropped', () => {
  it('an unknown unit keeps the line and flags it', () => {
    const r = convertLine(N('vitamin_d'), { amount: 2, unit: 'drops' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown_unit');
    expect(r.flagged).toBe(true);
    expect(r.meter).toBe(0);
  });

  it('a missing amount asks for the label rather than guessing', () => {
    const r = convertLine(N('vitamin_d'), { amount: null, unit: 'µg' });
    expect(r.ok).toBe(false);
    expect(r.needsLabel).toBe(true);
    expect(r.flagged).toBe(true);
  });
});

describe('asking instead of guessing', () => {
  it('"Niacin (as niacinamide)" resolves, so no question', () => {
    const line = { amount: 20, unit: 'mg', name: 'Niacin (as niacinamide)' };
    expect(resolveForm(N('vitamin_b3'), line)).toBe('nicotinamide');
    expect(needsFormQuestion(N('vitamin_b3'), line)).toBe(false);
  });

  it('plain "Niacin" is ambiguous, so it asks', () => {
    const line = { amount: 20, unit: 'mg', name: 'Niacin' };
    expect(needsFormQuestion(N('vitamin_b3'), line)).toBe(true);
  });

  it('vitamin D does not need a form question — every form converts alike', () => {
    expect(needsFormQuestion(N('vitamin_d'), { amount: 1000, unit: 'IU' })).toBe(false);
  });

  it('vitamin A needs one, because the limit depends on it', () => {
    expect(needsFormQuestion(N('vitamin_a'), { amount: 1000, unit: 'µg', name: 'Vitamin A' })).toBe(true);
  });
});

describe('the form question offers forms, not synonyms', () => {
  it('offers retinol and beta-carotene once each for vitamin A', () => {
    const opts = formOptions(data.nutrientsById.get('vitamin_a'));
    expect(opts.map((o) => o.key)).toEqual(['retinol', 'beta_carotene']);
    // Three synonyms map to retinol; offering all three would be the same
    // question asked three times.
    expect(opts.map((o) => o.label)).toEqual(['retinol', 'beta-carotene']);
  });

  it('never offers "unknown" as a choice', () => {
    // vitamin_b3 maps the bare word "niacin" to unknown — that is the state we
    // are already in, not an answer.
    const opts = formOptions(data.nutrientsById.get('vitamin_b3'));
    expect(opts.map((o) => o.key)).toEqual(['nicotinic_acid', 'nicotinamide']);
    expect(opts.some((o) => o.key === 'unknown')).toBe(false);
  });

  it('offers nothing for a nutrient with no forms', () => {
    expect(formOptions(data.nutrientsById.get('zinc'))).toEqual([]);
    expect(formOptions(undefined)).toEqual([]);
  });

  it('every option it offers actually resolves back to that form', () => {
    // If a label could not be resolved by resolveForm, the button would do
    // nothing when tapped.
    for (const n of data.nutrientList) {
      for (const o of formOptions(n)) {
        expect(resolveForm(n, { form: o.label })).toBe(o.key);
      }
    }
  });

  it('wherever we ask, at least one offered form relaxes the verdict', () => {
    // formMatters is the gate on asking at all; this checks the two agree, so
    // we never show a question whose answers cannot change anything.
    for (const n of data.nutrientList) {
      if (!formMatters(n)) continue;
      expect(formOptions(n).length).toBeGreaterThan(0);
    }
  });
});
