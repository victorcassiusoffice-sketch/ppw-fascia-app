// data.js — lazy loader for the vetted health data.
//
// The three data files are ~1.8 MB together. Nobody opening the app to tick a
// walk should pay for that, so nothing loads until something actually needs it:
// the Health sheet, the supplements cabinet, or an AI import.
//
// Loaded once, kept for the session. The service worker caches by the sha256 in
// public/health/manifest.json, so changing a data file replaces the cached copy
// instead of serving a stale one.
//
// Tests inject data with setHealthData() and never touch the network.

let cache = null;
let inflight = null;

/** Where the files live once tools/sync-health.mjs has run. */
const base = () => {
  const b = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return `${String(b).replace(/\/$/, '')}/health`;
};

async function fetchJson(path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`health data ${path}: ${res.status}`);
  return res.json();
}

/**
 * Load nutrients, ingredients and rules together. Concurrent callers share one
 * in-flight promise — opening the Health sheet while an import is parsing must
 * not fetch everything twice.
 */
export function loadHealthData() {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    const [nutrients, ingredients, rules] = await Promise.all([
      fetchJson(`${base()}/nutrients.json`),
      fetchJson(`${base()}/ingredients.json`),
      fetchJson(`${base()}/rules.json`),
    ]);
    cache = index({ nutrients, ingredients, rules });
    inflight = null;
    return cache;
  })().catch((e) => {
    inflight = null;
    throw e;
  });
  return inflight;
}

/** Already loaded? Returns null rather than fetching — for render paths. */
export function peekHealthData() {
  return cache;
}

/** Tests and previews inject raw files; pass null to clear. */
export function setHealthData(raw) {
  cache = raw ? index(raw) : null;
  inflight = null;
  return cache;
}

/**
 * Build the lookups the engine uses on every render, once, up front:
 * id maps and a synonym map for the ingredient picker and AI import.
 */
export function index({ nutrients, ingredients, rules }) {
  const nList = nutrients?.nutrients || [];
  const iList = ingredients?.ingredients || [];

  const nutrientsById = new Map(nList.map((n) => [n.id, n]));
  const ingredientsById = new Map(iList.map((i) => [i.id, i]));

  // One synonym table for both kinds, so "d3" and "ispaghula" resolve the same way.
  const bySynonym = new Map();
  const add = (key, kind, id) => {
    const k = normaliseName(key);
    if (k && !bySynonym.has(k)) bySynonym.set(k, { kind, id });
  };
  for (const n of nList) {
    add(n.name, 'nutrient', n.id);
    add(n.id.replace(/_/g, ' '), 'nutrient', n.id);
    for (const s of n.synonyms || []) add(s, 'nutrient', n.id);
  }
  for (const i of iList) {
    add(i.name, 'ingredient', i.id);
    add(i.id.replace(/_/g, ' '), 'ingredient', i.id);
    for (const s of i.synonyms || []) add(s, 'ingredient', i.id);
  }

  return {
    nutrients, ingredients, rules,
    nutrientList: nList,
    ingredientList: iList,
    nutrientsById, ingredientsById, bySynonym,
    thresholds: nutrients?.thresholds || { lowBelowPct: 50, nearMaxPct: 80 },
    sections: nutrients?.sections || {},
  };
}

/**
 * Normalise a name for matching, per the build notes: lower-case, straight
 * apostrophes, "st." → "st", and drop the plant-part words that vary between
 * labels ("extract", "root", "leaf", "powder").
 */
export function normaliseName(raw) {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\bst\./g, 'st')
    .replace(/\b(extract|root|leaf|leaves|powder|standardized|standardised)\b/g, ' ')
    .replace(/[^a-z0-9'+\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look a name up as a whole phrase, then by whole-word containment so
 * "Siberian ginseng extract" still finds ginseng. Never a loose substring
 * match: "iron" must not match "environment".
 */
export function lookupName(data, raw) {
  const key = normaliseName(raw);
  if (!key || !data?.bySynonym) return null;
  const exact = data.bySynonym.get(key);
  if (exact) return exact;
  for (const [syn, hit] of data.bySynonym) {
    if (syn.length < 4) continue;
    const re = new RegExp(`(^|\\s)${syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    if (re.test(key)) return hit;
  }
  return null;
}
