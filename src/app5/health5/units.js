// units.js — turning what a label says into two numbers.
//
// Every supplement line produces TWO amounts, not one:
//   meter — what it contributes toward the daily target
//   limit — what it contributes toward the safe maximum
// They differ more often than you would expect. 400 IU of synthetic vitamin E
// is 180 mg toward the target but 364 mg toward the limit. Beta-carotene counts
// toward the vitamin A target and NOTHING toward the vitamin A limit, because
// the limit is about preformed retinol only. Folic acid counts 1.7× toward the
// target (DFE) and 1× toward the limit.
//
// That is why nutrients.json stores every multiplier as a [meter, limit] pair.
// This module only ever applies those pairs. It invents no numbers.
//
// Unknown units and unknown forms are never silently dropped — a dropped line
// is an invisible dose. An unknown unit keeps the line and flags it; an unknown
// form uses the cautious `unknown` row, and callers ask the person a question
// rather than showing red on a guess.

/** Label spellings → the unit keys used in nutrients.json. */
export const UNIT_ALIASES = {
  mcg: 'µg', 'μg': 'µg', ug: 'µg', microgram: 'µg', micrograms: 'µg', 'µg': 'µg',
  mg: 'mg', milligram: 'mg', milligrams: 'mg',
  g: 'g', gram: 'g', grams: 'g',
  iu: 'IU', 'i.u.': 'IU', 'i.u': 'IU', ui: 'IU',
  'mcg dfe': 'µg DFE', 'µg dfe': 'µg DFE', 'μg dfe': 'µg DFE', 'ug dfe': 'µg DFE',
  'mcg rae': 'µg', 'µg rae': 'µg', 'μg rae': 'µg', 'ug rae': 'µg',
  'mg ne': 'mg', 'mg α-te': 'mg', 'mg a-te': 'mg', 'mg at': 'mg',
  'billion cfu': 'billion_cfu', 'bn cfu': 'billion_cfu', 'billion_cfu': 'billion_cfu',
  'million cfu': 'million_cfu', 'million_cfu': 'million_cfu',
  cfu: 'cfu',
};

/** Normalise a unit as written on a label. Returns null when unrecognised. */
export function normaliseUnit(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
  if (!s) return null;
  return UNIT_ALIASES[s] || null;
}

/**
 * Work out which form a line is in.
 * Order: an explicit `form`, then the label's "(as …)" part, then the name
 * itself — each looked up in the nutrient's own synonymForms. Returns null when
 * nothing matches, which callers treat as "ask, don't guess".
 */
export function resolveForm(nutrient, { form, name, label } = {}) {
  const map = nutrient?.synonymForms || {};
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const direct = norm(form);
  if (direct) {
    // An explicit form may already be a form key (e.g. "d3"), or a synonym.
    if (nutrient?.unitRules?.forms?.[direct] || nutrient?.unitRules?.iu?.[direct]) return direct;
    if (map[direct]) return map[direct];
  }

  const text = `${label || ''} ${name || ''}`;
  const asPart = /\(\s*as\s+([^)]+)\)/i.exec(text);
  // Prefer the "(as …)" part when the label has one — that is the bit naming the
  // form. Only read the whole name when it does not.
  const candidates = asPart ? [norm(asPart[1])] : [norm(name), norm(label)];

  for (const c of candidates) {
    if (!c) continue;
    if (map[c]) return map[c];

    // Collect EVERY distinct form the text names — not the first, not the
    // longest.
    //
    // This is the difference between safe and dangerous. A real multivitamin
    // says "Vitamin A (as retinyl palmitate and beta-carotene)". Picking one of
    // those two silently decides whether 3,000 µg counts toward the preformed-
    // retinol limit (retinol: all of it) or not at all (beta-carotene: none of
    // it) — and so whether a pregnant person sees "avoid" or sees nothing.
    //
    // Picking by synonym length made the engine LESS safe the MORE honest the
    // label was: a bare "Vitamin A" correctly asked the question, while the
    // fuller label resolved to beta-carotene and counted zero.
    //
    // Two named forms means we do not know which applies, so we say so: the
    // caller falls back to the cautious `unknown` row and asks one question.
    const found = new Set();
    for (const k of Object.keys(map)) {
      if (wholeWord(k).test(c)) found.add(map[k]);
    }
    if (found.size === 1) return [...found][0];
    if (found.size > 1) return null;   // ambiguous — never guess
  }
  return null;
}

/** Whole-word matcher for a synonym, so "d3" cannot match inside "d30". */
function wholeWord(key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, (m) => `\\${m}`);
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`);
}

/**
 * Would knowing the form RELAX the verdict?
 *
 * The `unknown` rows in nutrients.json are deliberately the cautious ones, so a
 * line with no stated form is already counted the strict way. Asking is only
 * worth a person's time when the answer could clear a warning — "is it
 * niacinamide?" (limit 10 -> 35), "is it beta-carotene?" (counts -> doesn't).
 *
 * We never ask in order to make something stricter. Vitamin D is the case that
 * proves it: unknown converts like D3, which is what almost every bottle is;
 * only prescription calcifediol differs, and it differs upward. Asking everyone
 * about their vitamin D to catch that would be noise.
 */
export function formMatters(nutrient) {
  const u = nutrient?.unitRules;
  if (!u) return false;

  // A lower limit multiplier = less counted against the maximum = relaxed.
  for (const set of [u.forms, u.iu, u.dfeUnit].filter(Boolean)) {
    const unknown = set.unknown;
    if (!Array.isArray(unknown)) continue;
    for (const [key, v] of Object.entries(set)) {
      if (key === 'unknown' || !Array.isArray(v)) continue;
      if (Number(v[1]) < Number(unknown[1])) return true;
    }
  }

  // A higher allowed limit for a known form is also a relaxation (vitamin B3).
  const byForm = nutrient?.limit?.byForm;
  if (byForm && byForm.unknown != null) {
    for (const [key, v] of Object.entries(byForm)) {
      if (key === 'unknown') continue;
      if (Number(v) > Number(byForm.unknown)) return true;
    }
  }
  return false;
}

const pair = (v) => (Array.isArray(v) ? [Number(v[0]) || 0, Number(v[1]) || 0] : null);

/**
 * Convert one supplement line into { meter, limit } in the nutrient's base unit.
 *
 * Returns:
 *   { ok:true, meter, limit, form, formKnown, unit }
 *   { ok:false, reason:'unknown_unit'|'no_amount'|'unknown_nutrient', ... }
 * An unparseable line is NEVER dropped — the caller keeps it and shows
 * "Check this amount".
 */
export function convertLine(nutrient, line = {}) {
  const amount = Number(line.amount);
  const rawUnit = line.unit;

  if (!nutrient || !nutrient.unitRules) {
    return { ok: false, reason: 'unknown_nutrient', meter: 0, limit: 0, flagged: true };
  }
  if (!isFinite(amount) || amount < 0 || line.amount == null) {
    return { ok: false, reason: 'no_amount', meter: 0, limit: 0, flagged: true, needsLabel: true };
  }

  const unit = normaliseUnit(rawUnit);
  if (!unit) {
    // "drops", "scoops", "capsules" — keep the line, flag it, count nothing.
    return { ok: false, reason: 'unknown_unit', unit: rawUnit, meter: 0, limit: 0, flagged: true };
  }

  const u = nutrient.unitRules;
  const formKey = resolveForm(nutrient, line);
  // A synonym can map straight to the `unknown` row ("niacin" does, because US
  // labels write "Niacin (as niacinamide)" and bare "Niacin" tells us nothing).
  // That is a resolved LOOKUP but an unresolved FORM.
  const formKnown = !!formKey && formKey !== 'unknown';
  const form = formKey || 'unknown';

  // 1. µg DFE — its own table (folate given already as DFE).
  if (unit === 'µg DFE' && u.dfeUnit) {
    const p = pair(u.dfeUnit[form]) || pair(u.dfeUnit.unknown) || [1, 1];
    return { ok: true, meter: amount * p[0], limit: amount * p[1], form, formKnown, unit };
  }

  // 2. IU — multiplier depends entirely on the form.
  if (unit === 'IU') {
    if (!u.iu) return { ok: false, reason: 'unknown_unit', unit: rawUnit, meter: 0, limit: 0, flagged: true };
    const p = pair(u.iu[form]) || pair(u.iu.unknown) || [0, 0];
    return { ok: true, meter: amount * p[0], limit: amount * p[1], form, formKnown, unit };
  }

  // 3. A form that redefines what a mass unit means (beta-carotene in mg:
  //    1 mg of beta-carotene is 500 µg RAE, and 0 toward the retinol limit).
  if (u.formByUnit?.[form]?.[unit]) {
    const p = pair(u.formByUnit[form][unit]);
    return { ok: true, meter: amount * p[0], limit: amount * p[1], form, formKnown, unit };
  }

  // 4. Ordinary mass: to base unit, then the form's [meter, limit] pair.
  if (u.mass && u.mass[unit] != null) {
    const base = amount * u.mass[unit];
    const p = pair(u.forms?.[form]) || pair(u.forms?.unknown) || [1, 1];
    return { ok: true, meter: base * p[0], limit: base * p[1], form, formKnown, unit };
  }

  // 5. Count-style units. Probiotics carry their own `cfu` table because the
  //    base unit is billions: without it "500 million CFU" was counted as 500
  //    BILLION, a thousandfold over-read of the same bottle.
  if (u.cfu && u.cfu[unit] != null) {
    const factor = Number(u.cfu[unit]);
    return { ok: true, meter: amount * factor, limit: amount * factor, form, formKnown, unit };
  }
  if (['billion_cfu', 'million_cfu', 'cfu'].includes(unit)) {
    return { ok: true, meter: amount, limit: amount, form, formKnown, unit };
  }

  return { ok: false, reason: 'unknown_unit', unit: rawUnit, meter: 0, limit: 0, flagged: true };
}

/**
 * Does this line need a form question before we can judge it?
 * "Niacin 20 mg" is fine at 20 mg of nicotinamide and over the limit at 20 mg
 * of nicotinic acid — so we ask rather than show red on a coin toss.
 */
export function needsFormQuestion(nutrient, line = {}) {
  if (!nutrient) return false;
  const f = resolveForm(nutrient, line);
  if (f && f !== 'unknown') return false;
  return formMatters(nutrient);
}

/** Tidy display of a converted amount: trims noise without inventing precision. */
export function formatAmount(value, unit) {
  if (value == null || !isFinite(value)) return '—';
  const v = Number(value);
  const rounded = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  const s = String(rounded).replace(/\.0+$/, '');
  return unit ? `${s} ${unit}` : s;
}

/**
 * The form choices to offer when we have to ask which form a label says.
 *
 * Returns one option per DISTINCT form, labelled by the first synonym that
 * names it — which in nutrients.json is the one a bottle is most likely to
 * print. `unknown` is never offered as a choice: it is what we already assume,
 * and the UI clears the form instead.
 *
 * Offering synonyms rather than forms would be wrong twice over: the same form
 * would appear three times for vitamin A, and truncating the list could hide
 * the only option that relaxes the verdict.
 */
export function formOptions(nutrient) {
  const map = nutrient?.synonymForms || {};
  const byForm = new Map();
  for (const [syn, form] of Object.entries(map)) {
    if (!form || form === 'unknown') continue;
    if (!byForm.has(form)) byForm.set(form, syn);
  }
  return [...byForm].map(([key, label]) => ({ key, label }));
}
