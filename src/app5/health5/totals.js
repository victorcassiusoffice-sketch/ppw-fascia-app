// totals.js — adding up a day.
//
// Four running totals per nutrient, because different questions need different
// sums:
//   meter            — toward the daily target (supplements + food)
//   limitTotal       — toward the safe maximum, using each line's LIMIT number
//   supplementsOnly  — for limits that count supplements only (magnesium, B3)
//   foodOnly         — so the UI can show the two segments separately
//
// "Today" counts what was actually ticked. "Planned" counts everything
// scheduled, so someone can see where the day is heading before they get there
// — and so the add sheet can warn before a limit is crossed, not after.
//
// Ingredients that are not nutrients can still feed a meter: psyllium husk
// contributes 0.8 g of fibre per gram, via `contributes` in ingredients.json.

import { convertLine } from './units.js';

const blank = () => ({ meter: 0, limitTotal: 0, supplementsOnly: 0, foodOnly: 0, lines: [], flagged: [] });

/** Ensure a bucket exists for a nutrient id. */
function bucket(map, id) {
  if (!map[id]) map[id] = blank();
  return map[id];
}

/**
 * Convert one product's lines into per-nutrient contributions.
 *
 * product: { id, name, servings, perServing: [{id, amount, unit, form, name}], supervised }
 * Returns { byNutrient, flagged } where flagged lists lines we kept but could
 * not count (unknown unit, missing amount) — they must stay visible.
 */
export function productContributions(product, data) {
  const servings = Number(product?.servings) > 0 ? Number(product.servings) : 1;
  const byNutrient = {};
  const flagged = [];

  for (const line of product?.perServing || []) {
    const nutrient = data?.nutrientsById?.get(line.id);

    if (nutrient) {
      const c = convertLine(nutrient, line);
      if (!c.ok) {
        flagged.push({ ...line, reason: c.reason, needsLabel: !!c.needsLabel, productId: product.id });
        continue;
      }
      const b = bucket(byNutrient, line.id);
      b.meter += c.meter * servings;
      b.limitTotal += c.limit * servings;
      b.supplementsOnly += c.limit * servings;
      b.lines.push({ productId: product.id, productName: product.name, amount: c.meter * servings, form: c.form, formKnown: c.formKnown });
      continue;
    }

    // Not a nutrient: an ingredient may still feed a meter (psyllium → fibre).
    const ing = data?.ingredientsById?.get(line.id);
    if (ing?.contributes?.length) {
      for (const c of ing.contributes) {
        const target = data?.nutrientsById?.get(c.id);
        if (!target) continue;
        const conv = convertLine(target, { ...line, id: c.id });
        if (!conv.ok) { flagged.push({ ...line, reason: conv.reason, productId: product.id }); continue; }
        const factor = Number(c.factor) || 1;
        const b = bucket(byNutrient, c.id);
        b.meter += conv.meter * servings * factor;
        b.limitTotal += conv.limit * servings * factor;
        b.supplementsOnly += conv.limit * servings * factor;
        b.lines.push({ productId: product.id, productName: product.name, amount: conv.meter * servings * factor, via: ing.id });
      }
      continue;
    }

    // An "other" ingredient with no meter of its own still matters for flags,
    // so it is recorded rather than discarded.
    if (line.id && line.id !== 'other') {
      flagged.push({ ...line, reason: 'not_a_meter', productId: product.id, soft: true });
    }
  }

  return { byNutrient, flagged };
}

/**
 * Totals for a day.
 *
 * cabinet   — the person's products
 * takenIds  — product ids ticked today (for 'today'); ignored for 'planned'
 * foods     — [{ nutrients: { id: amount } }] already in each nutrient's unit
 * estimate  — profile.foodEstimate, only counted if the person accepted it
 * scope     — 'today' | 'planned'
 */
export function dayTotals({
  cabinet = [],
  takenIds = [],
  foods = [],
  estimate = null,
  data,
  scope = 'today',
} = {}) {
  const taken = new Set(takenIds);
  const out = {};
  const flagged = [];
  const supervisedNutrients = new Set();

  for (const product of cabinet) {
    // Planned counts everything scheduled; an "I still take this" item with no
    // slot is only ever counted when it is actually logged.
    const isScheduled = product.scheduled !== false;
    const counted = scope === 'planned' ? isScheduled : taken.has(product.id);
    if (!counted) continue;

    const { byNutrient, flagged: f } = productContributions(product, data);
    flagged.push(...f);

    for (const [id, add] of Object.entries(byNutrient)) {
      const b = bucket(out, id);
      b.meter += add.meter;
      b.limitTotal += add.limitTotal;
      b.supplementsOnly += add.supplementsOnly;
      b.lines.push(...add.lines);
      if (product.supervised) supervisedNutrients.add(id);
    }
  }

  // Food: already in the nutrient's own unit, so it is added directly. Food
  // never counts toward a supplements_only limit.
  const addFood = (map, source) => {
    for (const [id, amount] of Object.entries(map || {})) {
      const v = Number(amount);
      if (!isFinite(v) || v <= 0) continue;
      if (!data?.nutrientsById?.has(id)) continue;
      const b = bucket(out, id);
      b.meter += v;
      b.limitTotal += v;
      b.foodOnly += v;
      b.lines.push({ source, amount: v, isFood: true });
    }
  };

  for (const f of foods) addFood(f?.nutrients, f?.name || 'Food');
  if (estimate && estimate.accepted !== false) addFood(estimate.nutrients || estimate, 'AI estimate');

  return { byNutrient: out, flagged, supervisedNutrients, scope };
}

/**
 * Do we have food data for THIS nutrient? food_first meters depend on it: with
 * no food figure for magnesium we must not say "low", because most magnesium
 * comes from food we have not been told about.
 */
export function hasFoodDataFor(totals, nutrientId) {
  const b = totals?.byNutrient?.[nutrientId];
  return !!(b && b.foodOnly > 0);
}

/** Totals for one nutrient, zeroed rather than undefined. */
export function totalsFor(totals, nutrientId) {
  return totals?.byNutrient?.[nutrientId] || blank();
}
