// flags.js — conditions and medicines, applied to what the person actually takes.
//
// rules.json is the ONLY source of flags. nutrients.json carries a readable copy
// in `conditionFlags`, and the engine never reads it — two sources would drift
// and one of them would be wrong.
//
// The shape of the problem: a person has conditions (some stated, some implied
// by a medicine or a surgery date) and takes products made of ingredients. Every
// (condition × ingredient) and (medicine × ingredient) pair may produce a flag.
// A flag can be conditional — only above a dose, only for certain forms, only
// near an operation — and a flag whose `when` is not met is INACTIVE: it shows
// nothing and, importantly, hides nothing.
//
// The subtle one is `defaulted`. Those thresholds are the app's own
// "multivitamin level" amounts, not health limits. They exist so an ordinary
// multivitamin is not gated by, say, a blood-pressure medicine. The detail
// screen says "Applies above <amount> a day" so nobody mistakes an app choice
// for a medical one.

import { convertLine, resolveForm } from './units.js';

/** avoid is strictest; info is weakest. Index = severity rank. */
export const ACTION_ORDER = ['avoid', 'doctor_first', 'caution', 'check_level', 'may_need_more', 'info'];
const rank = (a) => {
  const i = ACTION_ORDER.indexOf(a);
  return i === -1 ? ACTION_ORDER.length : i;
};
export const strictest = (actions) => actions.slice().sort((a, b) => rank(a) - rank(b))[0] || null;

/** Days between two ISO dates (b - a), calendar days. */
function daysUntil(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const a = new Date(`${String(fromISO).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(toISO).slice(0, 10)}T00:00:00`);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Every condition that applies, including the ones nobody typed in.
 *
 * A medicine implies conditions (warfarin → blood_thinners), a surgery date
 * implies upcoming/recent surgery, age implies age_65_plus, and diet implies
 * vegan_vegetarian. Rules written against those ids then work without asking
 * the person the same thing twice.
 */
export function activeConditions(profile = {}, todayISO = null) {
  const out = new Set(profile.conditions || []);
  const rules = profile._rules || null;

  for (const medId of profile.medicines || []) {
    const med = rules?.medicines?.find?.((m) => m.id === medId);
    for (const c of med?.impliesConditions || []) out.add(c);
  }

  const age = Number(profile.age);
  if (Number.isFinite(age) && age >= 65) out.add('age_65_plus');

  const diet = String(profile.diet || '').toLowerCase();
  if (/vegan|vegetarian|plant/.test(diet)) out.add('vegan_vegetarian');

  const sDate = profile.surgery?.date || null;
  if (profile.surgery && !sDate) {
    // A surgery with no date: treat every surgery rule as live and ask for the
    // date. Better to over-warn before an operation than to miss it.
    out.add('upcoming_surgery');
  } else if (sDate && todayISO) {
    const d = daysUntil(todayISO, sDate);
    if (d != null && d >= 0) out.add('upcoming_surgery');
    if (d != null && d < 0 && d >= -42) out.add('recent_surgery');
  }

  return out;
}

/**
 * Does this product match a rules.json group?
 * Group membership is derived, not stored on the ingredient, so the definitions
 * in rules.groups are implemented here once.
 */
export function matchesGroup(groupId, product, data) {
  const lines = product?.perServing || [];
  const ids = lines.map((l) => l.id);
  const has = (...wanted) => wanted.some((w) => ids.includes(w));

  switch (groupId) {
    case 'any_supplement':
      return true;

    case 'herbal': {
      // Herbs, ashwagandha, and anything the person typed as "other" — never
      // vitamins, minerals, multivitamins, cod liver oil or foods.
      if (ids.includes('ashwagandha')) return true;
      return lines.some((l) => {
        if (l.id === 'other') return true;
        const ing = data?.ingredientsById?.get(l.id);
        return !!ing?.herbal;
      });
    }

    case 'venoactive':
      return has('mpff_diosmin_hesperidin', 'horse_chestnut_aescin');

    case 'beta_carotene':
      return lines.some((l) => {
        if (l.id !== 'vitamin_a') return false;
        const n = data?.nutrientsById?.get('vitamin_a');
        return resolveForm(n, l) === 'beta_carotene';
      });

    case 'multivitamin_iron_c':
      return has('iron', 'vitamin_c');

    case 'multivitamin_minerals':
      return has('calcium', 'magnesium', 'iron', 'zinc');

    default:
      return false;
  }
}

/** Does a flag's target point at something in this product? */
function targetMatches(target, product, data) {
  if (!target) return false;
  if (target.type === 'group') return matchesGroup(target.id, product, data);
  const ids = (product?.perServing || []).map((l) => l.id);
  if (target.type === 'nutrient' || target.type === 'ingredient') return ids.includes(target.id);
  return false;
}

/**
 * How much of this nutrient does the person take a day, counted the way the
 * LIMIT counts it — the basis `when.aboveDaily` uses. When the rule names
 * forms, only lines in those forms count (vitamin A: retinol, not the
 * beta-carotene alongside it).
 */
function dailyAmountFor(targetId, forms, cabinet, data) {
  const nutrient = data?.nutrientsById?.get(targetId);
  if (!nutrient) return 0;
  let total = 0;
  for (const product of cabinet || []) {
    const servings = Number(product.servings) > 0 ? Number(product.servings) : 1;
    for (const line of product.perServing || []) {
      if (line.id !== targetId) continue;
      if (forms && forms.length) {
        const f = resolveForm(nutrient, line) || 'unknown';
        if (!forms.includes(f)) continue;
      }
      const c = convertLine(nutrient, line);
      if (c.ok) total += c.limit * servings;
    }
  }
  return total;
}

/** Is the line's form one the rule names? "unknown" means the label is silent. */
function formMatchesRule(forms, product, targetId, data) {
  if (!forms || !forms.length) return true;
  const nutrient = data?.nutrientsById?.get(targetId);
  if (!nutrient) return false;
  return (product?.perServing || []).some((l) => {
    if (l.id !== targetId) return false;
    const f = resolveForm(nutrient, l) || 'unknown';
    return forms.includes(f);
  });
}

/**
 * Evaluate a `when` clause. Unmet = the flag is inactive and shows nothing.
 * Returns { active, reason } so the UI can explain a threshold if it wants to.
 */
export function whenHolds(when, { product, target, cabinet, data, profile, todayISO }) {
  if (!when) return { active: true };

  if (when.forms && target?.id) {
    if (!formMatchesRule(when.forms, product, target.id, data)) return { active: false, reason: 'form' };
  }

  if (when.aboveDaily != null && target?.id) {
    const amount = dailyAmountFor(target.id, when.forms, cabinet, data);
    if (!(amount > Number(when.aboveDaily))) {
      return { active: false, reason: 'below_threshold', amount, threshold: Number(when.aboveDaily) };
    }
  }

  if (when.withinDaysBeforeSurgery != null) {
    const sDate = profile?.surgery?.date;
    if (!sDate) return { active: true, reason: 'surgery_date_unknown', askDate: true };
    const d = daysUntil(todayISO, sDate);
    if (d == null || d < 0 || d > Number(when.withinDaysBeforeSurgery)) {
      return { active: false, reason: 'outside_surgery_window', daysUntil: d };
    }
  }

  return { active: true };
}

/**
 * All flags for one product.
 *
 * Returns { action, flags[] } — the strictest action and every reason behind
 * it, because someone deserves to know all of why, not just the worst of it.
 */
export function flagsForProduct(product, { data, profile = {}, cabinet = [], todayISO = null } = {}) {
  const rules = data?.rules;
  if (!rules || !product) return { action: null, flags: [] };

  const prof = { ...profile, _rules: rules };
  const conditions = activeConditions(prof, todayISO);
  const flags = [];

  const consider = (raw, source) => {
    const target = raw.target;
    if (!targetMatches(target, product, data)) return;
    const held = whenHolds(raw.when, { product, target, cabinet, data, profile: prof, todayISO });
    if (!held.active) return;
    const action = source.kind === 'medicine' ? raw.badge : raw.action;
    if (!action) return;
    flags.push({
      action,
      target,
      label: raw.label,
      why: raw.why || raw.effect,
      action_text: raw.action,
      alsoWhy: raw.alsoWhy || [],
      severity: raw.severity,
      source: raw.source || raw.sources?.[0],
      from: source,
      when: raw.when || null,
      defaulted: !!raw.when?.defaulted,
      threshold: raw.when?.aboveDaily ?? null,
      askDate: !!held.askDate,
    });
  };

  for (const cond of rules.conditions || []) {
    if (!conditions.has(cond.id)) continue;
    for (const f of cond.flags || []) consider(f, { kind: 'condition', id: cond.id, name: cond.name });
  }

  for (const medId of prof.medicines || []) {
    const med = (rules.medicines || []).find((m) => m.id === medId);
    if (!med) continue;
    for (const i of med.interactions || []) consider(i, { kind: 'medicine', id: med.id, name: med.name });
  }

  return { action: strictest(flags.map((f) => f.action)), flags };
}

/**
 * Flags per nutrient, for the dashboard.
 *
 * A nutrient with an `avoid` or `doctor_first` flag has its low/partial state
 * and food nudges suppressed — telling someone with kidney disease that they
 * are low on potassium would be actively harmful.
 */
export function flagsForNutrients({ data, profile = {}, cabinet = [], todayISO = null } = {}) {
  const rules = data?.rules;
  const out = {};
  if (!rules) return out;

  const prof = { ...profile, _rules: rules };
  const conditions = activeConditions(prof, todayISO);

  const push = (id, flag) => {
    if (!out[id]) out[id] = { action: null, flags: [], suppressed: false };
    out[id].flags.push(flag);
  };

  const consider = (raw, source) => {
    const t = raw.target;
    if (!t || t.type !== 'nutrient') return;
    // A nutrient-level view asks "does this apply to me at all", so a rule
    // gated on a dose only counts when something in the cabinet reaches it.
    const held = whenHolds(raw.when, { product: productWith(t.id, cabinet), target: t, cabinet, data, profile: prof, todayISO });
    if (!held.active) return;
    const action = source.kind === 'medicine' ? raw.badge : raw.action;
    if (!action) return;
    push(t.id, {
      action, why: raw.why || raw.effect, label: raw.label,
      alsoWhy: raw.alsoWhy || [], from: source, defaulted: !!raw.when?.defaulted,
      threshold: raw.when?.aboveDaily ?? null, source: raw.source || raw.sources?.[0],
    });
  };

  for (const cond of rules.conditions || []) {
    if (!conditions.has(cond.id)) continue;
    for (const f of cond.flags || []) consider(f, { kind: 'condition', id: cond.id, name: cond.name });
  }
  for (const medId of prof.medicines || []) {
    const med = (rules.medicines || []).find((m) => m.id === medId);
    if (!med) continue;
    for (const i of med.interactions || []) consider(i, { kind: 'medicine', id: med.id, name: med.name });
  }

  for (const [id, v] of Object.entries(out)) {
    v.action = strictest(v.flags.map((f) => f.action));
    v.suppressed = v.action === 'avoid' || v.action === 'doctor_first';
  }
  return out;
}

/** The first product containing a nutrient — enough for a form check. */
function productWith(nutrientId, cabinet) {
  return (cabinet || []).find((p) => (p.perServing || []).some((l) => l.id === nutrientId)) || { perServing: [{ id: nutrientId }] };
}

/**
 * The "Before your operation" list.
 *
 * `advice` decides the wording, and the difference matters: continue_ask items
 * (iron, vitamin D, C, zinc, magnesium, fish oil) must NEVER say "Pause", and
 * valerian is tapered rather than stopped. An item shows the strictest advice
 * across its ingredients and the earliest date.
 */
export function surgeryPlan({ data, profile = {}, cabinet = [], todayISO = null } = {}) {
  const rules = data?.rules;
  const sDate = profile?.surgery?.date || null;
  if (!rules?.pauseBeforeSurgery?.length || !profile?.surgery) return null;

  const order = rules.pauseAdviceOrder || ['pause', 'taper_ask', 'ask_pause', 'continue_ask'];
  const arank = (a) => { const i = order.indexOf(a); return i === -1 ? order.length : i; };
  const items = [];

  for (const product of cabinet) {
    const matched = [];
    for (const row of rules.pauseBeforeSurgery) {
      if (row.target?.type === 'group') {
        if (matchesGroup(row.target.id, product, data)) matched.push(row);
      } else if (targetMatches(row.target, product, data)) {
        matched.push(row);
      }
    }
    if (!matched.length) continue;

    // A specific row beats the any_supplement default.
    const specific = matched.filter((r) => r.target?.id !== 'any_supplement');
    const rows = specific.length ? specific : matched;
    const best = rows.slice().sort((a, b) => arank(a.advice) - arank(b.advice))[0];
    const days = Number(best.adviceFromDaysBefore ?? best.stopDaysBefore ?? 14);
    const fromISO = sDate ? addDays(sDate, -days) : null;

    items.push({
      productId: product.id,
      productName: product.name,
      advice: best.advice,
      why: best.why,
      stopDaysBefore: best.stopDaysBefore ?? null,
      fromISO,
      source: best.source,
      evidence: best.evidence,
      rows,
    });
  }

  // "Tell your team every supplement" at day −28, or today if that has passed.
  const tellISO = sDate ? addDays(sDate, -28) : null;
  const tellDue = tellISO && todayISO && tellISO < todayISO ? todayISO : tellISO;

  return {
    surgeryDate: sDate,
    needsDate: !sDate,
    tellTeamOn: tellDue,
    items: items.sort((a, b) => arank(a.advice) - arank(b.advice)),
  };
}

function addDays(iso, n) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + n);
  // Format from LOCAL parts. toISOString() would convert local midnight to UTC
  // and, anywhere east of Greenwich (Mauritius is UTC+4), hand back the day
  // before — every "pause from" date a day early.
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
