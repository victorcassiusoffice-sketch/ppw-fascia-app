// targets.js — how much of a nutrient this particular person needs today.
//
// A target is never a single number in the data: it varies by sex, by age, by
// pregnancy and breastfeeding, and for protein by body weight and training. The
// rules are all in nutrients.json (`meter`), and this module only applies them.
//
// Two deliberate choices, both from the brief:
//   • Unknown sex uses the HIGHER target, so we never tell someone they are
//     covered when they might not be. Iron is the exception — it uses the male
//     (lower) value, because wrongly telling someone they are low on iron
//     pushes them toward a supplement that is genuinely risky to take blind.
//   • Pregnancy and breastfeeding take max(normal, pregnancy) — never less than
//     the ordinary adult need.

/** Everything the target maths can depend on, in one place. */
export function profileBasis(profile = {}) {
  const age = Number.isFinite(Number(profile.age)) ? Number(profile.age) : null;
  const conditions = new Set(profile.conditions || []);
  return {
    sex: profile.sex === 'male' || profile.sex === 'female' ? profile.sex : null,
    age,
    weightKg: Number.isFinite(Number(profile.weightKg)) ? Number(profile.weightKg) : null,
    pregnant: conditions.has('pregnancy'),
    breastfeeding: conditions.has('breastfeeding'),
    training: !!profile.training || conditions.has('athlete'),
    conditions,
  };
}

/** Pick the sex-keyed value, honouring unknown-sex policy. */
function bySex(obj, basis, unknownSex) {
  if (!obj) return null;
  const m = Number(obj.male);
  const f = Number(obj.female);
  if (basis.sex === 'male') return m;
  if (basis.sex === 'female') return f;
  if (unknownSex === 'male') return m;      // iron
  if (unknownSex === 'female') return f;
  const vals = [m, f].filter(Number.isFinite);
  return vals.length ? Math.max(...vals) : null;   // default: the higher one
}

/** Protein has its own rules: g/kg, adjusted for training and age. */
function proteinTarget(nutrient, basis) {
  const r = nutrient?.meter?.rules;
  if (!r) return null;

  // Kidney disease: there is no safe general number, so the app shows none.
  for (const c of r.noTargetIf || []) {
    if (basis.conditions.has(c)) {
      return { value: null, why: r.why, noTarget: true, reason: c };
    }
  }

  if (basis.weightKg) {
    let perKg = Number(r.perKg) || 0.8;
    if (basis.training) perKg = Number(r.activePerKg) || perKg;
    else if (basis.age != null && r.olderFromAge != null && basis.age >= r.olderFromAge) {
      perKg = Number(r.olderPerKg) || perKg;
    }
    return { value: Math.round(basis.weightKg * perKg), why: r.why, perKg };
  }

  // No weight: fall back to flat grams rather than guessing a body weight.
  const fb = bySex(r.fallbackGrams, basis, nutrient?.meter?.unknownSex);
  return { value: fb, why: r.why, fallback: true };
}

/**
 * The daily target for one nutrient.
 * Returns { value, unit, mode, why, noTarget?, source } — value null means the
 * meter shows amounts without a target (food_only, user_set, track, or protein
 * with kidney disease).
 */
export function targetFor(nutrient, profile = {}) {
  if (!nutrient?.meter) return { value: null, mode: null };
  const meter = nutrient.meter;
  const basis = profileBasis(profile);
  const out = { unit: nutrient.unit, mode: meter.mode, why: meter.targetWhy, section: meter.section };

  // Carbs: information only unless the person sets their own.
  if (meter.mode === 'user_set') {
    const set = profile?.targets?.[nutrient.id];
    return { ...out, value: Number.isFinite(Number(set)) ? Number(set) : null, userSet: true };
  }

  if (nutrient.id === 'protein') {
    const p = proteinTarget(nutrient, basis);
    return { ...out, ...p };
  }

  let value = bySex(meter.target, basis, meter.unknownSex);

  // Age bands replace the base target. Highest matching `from` wins.
  const rules = (meter.ageRules || []).filter((r) => basis.age != null && basis.age >= Number(r.from));
  if (rules.length) {
    const best = rules.sort((a, b) => Number(b.from) - Number(a.from))[0];
    const v = bySex(best, basis, meter.unknownSex);
    if (Number.isFinite(v)) value = v;
  }

  // Pregnancy and breastfeeding never lower the ordinary need.
  if (basis.pregnant && Number.isFinite(Number(meter.pregnancyTarget))) {
    value = Math.max(Number(value) || 0, Number(meter.pregnancyTarget));
  }
  if (basis.breastfeeding && Number.isFinite(Number(meter.lactationTarget))) {
    value = Math.max(Number(value) || 0, Number(meter.lactationTarget));
  }

  return { ...out, value: Number.isFinite(value) ? value : null };
}

/**
 * Does this nutrient show "low" at all?
 *
 * food_only (potassium, chromium, molybdenum, manganese) and track (collagen,
 * creatine…) never do — there is no supplement nudge to make. labs_led (iron)
 * only does when a recent lab says so. food_first only does when we actually
 * have food data for THAT nutrient, because judging magnesium on supplements
 * alone would tell almost everyone they are low when most of it comes from food.
 */
export function canShowLow(nutrient, { hasFoodDataForNutrient = false, labSaysLow = false } = {}) {
  const mode = nutrient?.meter?.mode;
  if (mode === 'food_only' || mode === 'track' || mode === 'user_set') return false;
  if (mode === 'labs_led') return !!labSaysLow;
  if (mode === 'food_first') return !!hasFoodDataForNutrient;
  return true;   // target
}

/** Should the app ever suggest a supplement for this nutrient? */
export function canSuggestSupplement(nutrient, opts = {}) {
  const id = nutrient?.id;
  if (id === 'potassium') return false;                       // never, per the brief
  if (id === 'iron') return !!opts.labSaysLow;                // only on a recent low ferritin
  if (nutrient?.meter?.mode === 'food_only') return false;
  return true;
}
