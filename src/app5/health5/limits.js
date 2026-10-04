// limits.js — the safe maximum, and whether today's amount is near or past it.
//
// The limit is the part that has to be right. Everything here comes from the
// nutrient's own `limit` block; nothing is inferred.
//
// Three things make this less obvious than "is X > Y":
//   • WHAT COUNTS varies. Magnesium counts supplements only (food magnesium is
//     not the problem). Vitamin A counts preformed retinol only. Folate counts
//     folic acid in µg, not DFE. `appliesTo` decides.
//   • The limit itself can move — by form (niacin: 10 or 35) and by age
//     (calcium: 2,500 under 51, 2,000 after).
//   • Over-max is not the only warning. There are softer ones that must NOT be
//     dressed up as breaching a limit: cautionAt (omega-3 over 1 g),
//     productCautionAt (one product over 500 µg iodine), infoAt (biotin and
//     blood tests). Calling those "over max" would cry wolf.
//
// A doctor-prescribed dose is never reported as over-max. The number and the
// maximum are still shown — we just stop telling someone their doctor is wrong.

/** Which total does this limit measure? */
export function limitAppliesTo(nutrient) {
  return nutrient?.limit?.appliesTo || 'total';
}

/**
 * The limit value for this person, after byForm and byAge.
 * Returns { value, unit, kind, appliesTo, warn, note, source } with value null
 * when the nutrient has no limit (protein, potassium).
 */
export function limitFor(nutrient, { age = null, form = null } = {}) {
  const lim = nutrient?.limit;
  if (!lim) return { value: null, warn: false };
  const out = {
    value: lim.value == null ? null : Number(lim.value),
    unit: lim.unit || nutrient.unit,
    kind: lim.kind,
    appliesTo: lim.appliesTo || 'total',
    warn: !!lim.warn,
    note: lim.note,
    source: lim.source,
    supervisedException: !!lim.supervisedException,
  };

  if (lim.byForm) {
    const key = form && lim.byForm[form] != null ? form : 'unknown';
    if (lim.byForm[key] != null) out.value = Number(lim.byForm[key]);
    out.byForm = true;
  }

  if (Array.isArray(lim.byAge) && lim.byAge.length) {
    // Unknown age takes the strictest band — never the generous one.
    if (age == null) {
      const vals = lim.byAge.map((b) => Number(b.value)).filter(Number.isFinite);
      if (vals.length) out.value = Math.min(...vals);
    } else {
      for (const band of lim.byAge) {
        const okFrom = band.from == null || age >= Number(band.from);
        const okTo = band.to == null || age <= Number(band.to);
        if (okFrom && okTo) out.value = Number(band.value);
      }
    }
    out.byAge = true;
  }

  return out;
}

/** The amber "more than experts advise" threshold, which is not a limit breach. */
export function cautionFor(nutrient, { age = null } = {}) {
  const lim = nutrient?.limit;
  if (!lim || lim.cautionAt == null) return null;
  let value = Number(lim.cautionAt);
  for (const band of lim.cautionByAge || []) {
    if (band.from != null && age != null && age >= Number(band.from)) value = Number(band.value);
  }
  return {
    value,
    text: lim.cautionText,
    appliesTo: lim.cautionAppliesTo || lim.appliesTo || 'total',
  };
}

/**
 * Judge one nutrient's day.
 *
 * totals: { meter, limitTotal, supplementsOnly, foodOnly, retinolOnly, folicAcidOnly, ... }
 * Returns a state plus the numbers behind it, so the UI never has to recompute.
 *
 * States, in the order they win:
 *   supervised → over_max → near_max → covered → partial → low → none
 */
export function evaluate(nutrient, {
  totals = {},
  target = null,
  age = null,
  form = null,
  supervised = false,
  thresholds = { lowBelowPct: 50, nearMaxPct: 80 },
  canShowLow: allowLow = true,
  suppressed = false,
} = {}) {
  const lim = limitFor(nutrient, { age, form });
  const caution = cautionFor(nutrient, { age });

  // Pick the total this limit actually measures.
  const countedForLimit = pickCounted(lim.appliesTo, totals);
  const meter = Number(totals.meter) || 0;

  const pctOfTarget = target ? (meter / target) * 100 : null;
  const pctOfLimit = lim.value ? (countedForLimit / lim.value) * 100 : null;

  const out = {
    state: 'none',
    meter,
    target,
    pctOfTarget,
    limit: lim.value,
    limitUnit: lim.unit,
    limitAppliesTo: lim.appliesTo,
    countedForLimit,
    pctOfLimit,
    supervised: !!supervised,
    notes: [],
  };

  // A dose the person's doctor set is reported, not judged.
  if (supervised && lim.value != null) {
    out.state = 'supervised';
    out.notes.push({ kind: 'supervised', text: 'Doctor-supervised' });
    return out;
  }

  // Soft warnings stand alongside the state, never instead of it.
  if (caution && caution.value != null) {
    const countedForCaution = pickCounted(caution.appliesTo, totals);
    if (countedForCaution > caution.value) {
      out.notes.push({ kind: 'caution', text: caution.text, at: caution.value });
    }
  }
  if (nutrient?.limit?.infoAt != null && countedForLimit > Number(nutrient.limit.infoAt)) {
    out.notes.push({ kind: 'info', text: nutrient.limit.infoText, at: Number(nutrient.limit.infoAt) });
  }

  // Suppressed = the person has an avoid/doctor_first flag here. We must not
  // nudge them toward more, but a limit breach still has to show.
  if (lim.value != null && lim.warn) {
    if (countedForLimit > lim.value) { out.state = 'over_max'; return out; }
    if (pctOfLimit != null && pctOfLimit >= thresholds.nearMaxPct) { out.state = 'near_max'; return out; }
  }

  if (suppressed) { out.state = 'ask_doctor'; return out; }

  if (target == null) { out.state = meter > 0 ? 'tracked' : 'none'; return out; }

  if (pctOfTarget >= 100) { out.state = 'covered'; return out; }
  if (!allowLow) { out.state = 'tracked'; return out; }
  if (pctOfTarget >= thresholds.lowBelowPct) { out.state = 'partial'; return out; }
  out.state = 'low';
  return out;
}

/** Map an `appliesTo` key onto the right running total. */
function pickCounted(appliesTo, totals) {
  switch (appliesTo) {
    case 'supplements_only': return Number(totals.supplementsOnly) || 0;
    case 'preformed_retinol': return Number(totals.limitTotal) || 0;  // beta-carotene already contributes 0
    case 'folic_acid': return Number(totals.limitTotal) || 0;          // conversion already in µg folic acid
    case 'total':
    default: return Number(totals.limitTotal) || 0;
  }
}

/** One product carrying more than experts advise, regardless of the daily total. */
export function productCaution(nutrient, amountInProduct) {
  const at = nutrient?.limit?.productCautionAt;
  if (at == null) return null;
  if (!(Number(amountInProduct) > Number(at))) return null;
  return { at: Number(at), text: nutrient.limit.productCautionText };
}

/**
 * Would adding this amount push the person over? Used by the add sheet so the
 * warning arrives before they save, not afterwards on a meter.
 */
export function wouldExceed(nutrient, { currentTotals = {}, adding = {}, age = null, form = null }) {
  const lim = limitFor(nutrient, { age, form });
  if (lim.value == null || !lim.warn) return null;
  const key = lim.appliesTo === 'supplements_only' ? 'supplementsOnly' : 'limitTotal';
  const after = (Number(currentTotals[key]) || 0) + (Number(adding[key]) || Number(adding.limit) || 0);
  if (after <= lim.value) return null;
  return { after, limit: lim.value, unit: lim.unit, appliesTo: lim.appliesTo };
}
