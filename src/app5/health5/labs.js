// labs.js — reading blood test results, carefully.
//
// This module exists mostly to say NO. A lab result is the only thing that can
// unlock an iron suggestion, so the mapping has to be strict in both directions:
//
//   • Only FERRITIN speaks for iron. Not haemoglobin, not serum iron, not TSAT,
//     not TIBC. A low haemoglobin has many causes that iron will not fix, and
//     some it would make worse. The brief is explicit and so is this code.
//   • Calcium and potassium results are notes with "talk to your doctor" —
//     never a supplement nudge, whichever way they read.
//   • A result older than 6 months unlocks nothing. An undated one never does.
//
// Everything unmapped is kept as a plain note. Nothing is thrown away; it just
// does not get to drive a recommendation.

export const LAB_FRESH_MONTHS = 6;

/**
 * Test name → nutrient id. Keys are already normalised by normaliseTestName().
 * Matched as a WHOLE name, never "contains", so "serum iron" cannot match the
 * iron rules by accident.
 */
export const LAB_MAP = {
  ferritin: 'iron',

  '25(oh)d': 'vitamin_d',
  '25-hydroxy vitamin d': 'vitamin_d',
  '25 hydroxy vitamin d': 'vitamin_d',
  'vitamin d': 'vitamin_d',
  calcidiol: 'vitamin_d',

  b12: 'vitamin_b12',
  'vitamin b12': 'vitamin_b12',
  cobalamin: 'vitamin_b12',
  'active b12': 'vitamin_b12',
  holotranscobalamin: 'vitamin_b12',

  folate: 'vitamin_b9',
  'red cell folate': 'vitamin_b9',

  magnesium: 'magnesium',
  zinc: 'zinc',
  selenium: 'selenium',
};

/** Tests that are notes only — they never nudge a supplement either way. */
export const NOTE_ONLY = new Set(['calcium', 'potassium']);

/**
 * High MMA means B12 is LOW — the one test where the direction flips, because
 * methylmalonic acid builds up when B12 is short.
 */
export const INVERTED = {
  mma: 'vitamin_b12',
  'methylmalonic acid': 'vitamin_b12',
};

/**
 * Normalise a test name: lower-case, strip punctuation, drop the words that
 * only say where the sample came from, so "Serum ferritin", "Ferritin, serum"
 * and "S-Ferritin" all become "ferritin".
 */
export function normaliseTestName(raw) {
  if (raw == null) return '';
  let s = String(raw).toLowerCase().trim();
  s = s.replace(/^[sp]-/, '');
  s = s.replace(/[,;]/g, ' ');
  s = s.replace(/\b(serum|plasma|total|blood)\b/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // Keep the brackets in "25(oh)d", drop other stray punctuation.
  s = s.replace(/[^a-z0-9()\- ]/g, '').replace(/\s+/g, ' ').trim();
  return s;
}

/** Months between a date and today. null when undated or unparseable. */
export function monthsSince(dateISO, todayISO) {
  if (!dateISO || !todayISO) return null;
  const a = new Date(`${String(dateISO).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(todayISO).slice(0, 10)}T00:00:00`);
  if (isNaN(a) || isNaN(b)) return null;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);
}

/**
 * Interpret one lab entry.
 *
 * Returns { nutrientId, result, fresh, months, noteOnly, unmapped, raw }.
 * `result` is already flipped for inverted tests, so callers never have to
 * remember that high MMA means low B12.
 */
export function readLab(entry, todayISO) {
  const name = normaliseTestName(entry?.test);
  const months = monthsSince(entry?.date, todayISO);
  const fresh = months != null && months <= LAB_FRESH_MONTHS;
  const base = { raw: entry, test: name, months, fresh, dated: !!entry?.date };

  if (NOTE_ONLY.has(name)) {
    return { ...base, noteOnly: true, nutrientId: null, result: entry?.result || null };
  }

  const inverted = INVERTED[name];
  if (inverted) {
    const r = entry?.result === 'high' ? 'low' : entry?.result === 'low' ? 'high' : entry?.result || null;
    return { ...base, nutrientId: inverted, result: r, inverted: true };
  }

  const nutrientId = LAB_MAP[name] || null;
  if (!nutrientId) return { ...base, unmapped: true, nutrientId: null, result: entry?.result || null };

  return { ...base, nutrientId, result: entry?.result || null };
}

/** Read a whole list, newest first per nutrient. */
export function readLabs(labs = [], todayISO) {
  return (labs || []).map((l) => readLab(l, todayISO));
}

/**
 * Does a recent result say this nutrient is low?
 *
 * The gate for iron suggestions. Requires a mapped test, a "low" reading, a
 * date, and that date inside 6 months. Anything less returns false — and
 * `staleLow` lets the UI say "Out of date — ask for a new test" rather than
 * silently ignoring a result the person can see on their own screen.
 */
export function labSaysLow(labs, nutrientId, todayISO) {
  const read = readLabs(labs, todayISO).filter((l) => l.nutrientId === nutrientId && l.result === 'low');
  if (!read.length) return { low: false };
  const fresh = read.find((l) => l.fresh);
  if (fresh) return { low: true, months: fresh.months, entry: fresh };
  const undated = read.find((l) => !l.dated);
  if (undated) return { low: false, undated: true, entry: undated };
  const stale = read.sort((a, b) => (a.months ?? 1e9) - (b.months ?? 1e9))[0];
  return { low: false, staleLow: true, months: stale.months, entry: stale };
}

/** May the app suggest iron? Only on a recent, low ferritin. */
export function ironUnlocked(labs, todayISO) {
  return labSaysLow(labs, 'iron', todayISO).low === true;
}
