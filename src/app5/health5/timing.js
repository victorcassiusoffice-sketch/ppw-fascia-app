// timing.js — things that should not be swallowed together.
//
// Iron and calcium block each other. Levothyroxine needs a clear run at an
// empty stomach. Orlistat takes the fat-soluble vitamins down with it. None of
// this is dangerous — it just quietly wastes the supplement, which is worse in
// a way, because nothing tells the person it is happening.
//
// `timing.separateFrom[].ids` on each nutrient names what to keep it away from,
// including medicines as "other:<id>". We only ever raise a tip when two things
// are actually in the SAME slot — a clash the person has already created, not a
// theoretical one.

/** "other:orlistat" → { kind:'other', id:'orlistat' } */
function parseRef(ref) {
  const s = String(ref || '');
  const i = s.indexOf(':');
  if (i === -1) return { kind: 'nutrient', id: s };
  return { kind: s.slice(0, i), id: s.slice(i + 1) };
}

/** Every nutrient and ingredient id a product contains. */
function idsIn(product) {
  return new Set((product?.perServing || []).map((l) => l.id).filter(Boolean));
}

/**
 * Clashes inside one slot.
 *
 * slotProducts — the products scheduled at the same time
 * medicines    — the person's medicine ids, which can clash too
 *
 * Returns [{ aId, bId, hours, why, aName, bName }], one per pair, de-duplicated
 * so "iron vs calcium" is not also reported as "calcium vs iron".
 */
export function slotConflicts({ slotProducts = [], medicines = [], data } = {}) {
  const out = [];
  const seen = new Set();

  const productsWith = (id) => slotProducts.filter((p) => idsIn(p).has(id));

  for (const product of slotProducts) {
    for (const lineId of idsIn(product)) {
      const nutrient = data?.nutrientsById?.get(lineId);
      for (const rule of nutrient?.timing?.separateFrom || []) {
        for (const ref of rule.ids || []) {
          const { kind, id } = parseRef(ref);

          // A medicine the person takes, named by the rule.
          if (kind === 'other' && medicines.includes(id)) {
            const key = `${lineId}|med:${id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
              aId: lineId,
              aName: nutrient?.name || lineId,
              bId: id,
              bName: rule.what || id,
              bIsMedicine: true,
              hours: Number(rule.hours) || 2,
              why: rule.why,
            });
            continue;
          }

          // Another supplement in the same slot.
          const others = productsWith(id).filter((p) => p.id !== product.id);
          if (!others.length) continue;
          const key = [lineId, id].sort().join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            aId: lineId,
            aName: nutrient?.name || lineId,
            bId: id,
            bName: data?.nutrientsById?.get(id)?.name || data?.ingredientsById?.get(id)?.name || rule.what || id,
            productIds: [product.id, ...others.map((p) => p.id)],
            hours: Number(rule.hours) || 2,
            why: rule.why,
          });
        }
      }
    }
  }

  return out;
}

/** "08:00" + 2h → "10:00". Wraps within the day rather than spilling past it. */
export function shiftTime(hhmm, hours) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return hhmm;
  const total = (+m[1] * 60 + +m[2] + Math.round(Number(hours) * 60)) % 1440;
  const t = (total + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Plain-language tip for one clash, ready for the UI. */
export function conflictTip(conflict) {
  if (!conflict) return null;
  return {
    text: `${conflict.aName} and ${conflict.bName} work better ${conflict.hours} hours apart.`,
    why: conflict.why,
    hours: conflict.hours,
  };
}
