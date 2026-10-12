// ─────────────────────────────────────────────────────────────────────────
// daykey.js — the app's day-key format, and nothing else.
//
// WHY THIS IS ITS OWN FILE. These four functions were inside store5.js, which
// imports React and reads localStorage at module scope. Anything wanting to do
// day arithmetic therefore had to boot the whole store — so the temptation was
// to write a second little date system instead, and a second date system is how
// a day key ends up in two formats.
//
// store5.js still re-exports all four, so every existing `import { todayKey }
// from './store5.js'` is unchanged. This file is for pure modules (the quit
// taper's plan.js) that must be provable on their own.
//
// THE FORMAT IS UNPADDED: 'YYYY-M-D', e.g. '2026-10-4'. That is deliberate and
// load-bearing, because every stored day key in the wild is in it. The trap it
// sets, which has already cost this repo a whole silently-broken feature:
//
//     new Date('2026-10-4T00:00:00')   ->   Invalid Date
//
// A single-digit day or month is not ISO 8601, so Date.parse() refuses it. Never
// parse a day key as a string. keyToDate() below splits it and uses the numeric
// Date constructor, which is why it also accepts a padded '2026-10-04'.
// ─────────────────────────────────────────────────────────────────────────

/** Today, in the store's unpadded `YYYY-M-D` form. */
export function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

/** A day key -> local midnight. Numeric constructor, so padded keys work too. */
export function keyToDate(k) { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

/**
 * Whole days from bKey to aKey (so aKey later = positive).
 * Math.round, not a floor: a DST change makes a "day" 23 or 25 hours long, and
 * truncating that drops or doubles a day twice a year.
 */
export function dayDiff(aKey, bKey) { return Math.round((keyToDate(aKey) - keyToDate(bKey)) / 86400000); }

/** `n` days from `from`, as a key. MUST match todayKey()'s unpadded format or
 *  the item files on a day the app never renders. */
export function dateKeyFromOffset(n, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + (Number(n) || 0));
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/** Is this a day key the rest of the app would recognise? */
export function isDayKey(k) {
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(String(k || ''))) return false;
  const d = keyToDate(k);
  // Rejects '2026-2-31', which the Date constructor would roll into March.
  return !Number.isNaN(d.getTime()) && dateKeyFromOffset(0, d) === normDayKey(k);
}

/** A key in canonical unpadded form, so '2026-10-04' and '2026-10-4' compare equal. */
export function normDayKey(k) {
  const p = String(k).split('-');
  return +p[0] + '-' + +p[1] + '-' + +p[2];
}
