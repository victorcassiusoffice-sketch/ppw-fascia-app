// store.js — the ppw5.health slice.
//
// Kept in its own file and its own localStorage key for one reason: "Delete my
// health data" has to be a single, complete, obvious act. One key to remove,
// plus the voice-note files. Nothing health-related leaks into ppw5.stacks or
// ppw5.prefs, so deleting it cannot half-work.
//
// Everything here is additive. Existing keys keep their format exactly.
//
// This data never leaves the device. There is no sync, no analytics, no backend
// call anywhere in this module — the only way any of it reaches an AI is if the
// person turns on a consent toggle and copies the prompt themselves.

export const HEALTH_KEY = 'ppw5.health';
export const HEALTH_SCHEMA = 1;

/** Health features are for adults. The gate is checked, not assumed. */
export const MIN_AGE = 18;

export function emptyHealth() {
  return {
    _schema: HEALTH_SCHEMA,
    profile: {
      // Day shape — reused by protocol anchors (wake, meals, bed, training).
      wake: null, bed: null, workStart: null, workEnd: null,
      meals: { breakfast: null, lunch: null, dinner: null },
      training: false,
      // Who this is, for targets and flags.
      sex: null, age: null, weightKg: null, diet: null,
      conditions: [], conditionsOther: [],
      medicines: [], medicinesOther: [],
      allergies: [],
      surgery: null,              // { date } | null
      labs: [],                   // [{ test, value, unit, date, result }]
      foodEstimate: null,         // { nutrients: {id: amount}, accepted }
      ageConfirmed: null,         // true once "18 or over" is answered
    },
    cabinet: [],                  // the person's supplements
    doneSupps: {},                // { 'YYYY-M-D': { slotId: [productId] } }
    foodLogs: {},                 // { 'YYYY-M-D': [{ name, nutrients }] }
    gut: { fermented: {}, plants: {} },   // per date / per ISO week
    askDoctor: [],                // [{ text, addedAt, done }]
    activeProtocols: [],          // [{ id, startISO, endISO, reviewISO }]
    consents: [],                 // [{ kind, ref, dateISO }] — doctor-OK taps
    settings: { trackMacros: false, aiIncludeHealth: false, aiIncludeSupps: false },
  };
}

/** Read the slice, tolerating absent or corrupt storage. */
export function loadHealth() {
  try {
    const raw = localStorage.getItem(HEALTH_KEY);
    if (!raw) return emptyHealth();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyHealth();
    // Merge onto the empty shape so a slice written by an older build still
    // has every field this one expects.
    const base = emptyHealth();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile || {}) },
      gut: { ...base.gut, ...(parsed.gut || {}) },
      settings: { ...base.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return emptyHealth();
  }
}

export function saveHealth(health) {
  try {
    localStorage.setItem(HEALTH_KEY, JSON.stringify(health));
    return true;
  } catch {
    return false;   // private mode / storage full — the app keeps working
  }
}

/**
 * Delete everything. Returns the list of voice-note file ids the caller must
 * also remove from IndexedDB — this module does not reach into files5 itself,
 * so the deletion stays one explicit, traceable act.
 */
export function deleteHealth(health) {
  const voiceFileIds = [];
  try {
    localStorage.removeItem(HEALTH_KEY);
  } catch { /* nothing more we can do */ }
  return { ok: true, voiceFileIds };
}

// ── age gate ────────────────────────────────────────────────────────────────

/**
 * Are health features available?
 * Under 18: no supplements, protocols or meters. Unknown age: ask once.
 */
export function healthAgeState(profile = {}) {
  // Number(null) is 0, and 0 is finite — so reading the age without this guard
  // treats "not told us" as "age zero" and silently locks an adult out instead
  // of asking them. emptyHealth() stores age: null, so this is the normal path,
  // not an edge case.
  const raw = profile.age;
  const age = raw == null || raw === '' ? NaN : Number(raw);
  if (Number.isFinite(age)) {
    return age >= MIN_AGE ? { allowed: true, reason: 'age' } : { allowed: false, reason: 'under_18' };
  }
  if (profile.ageConfirmed === true) return { allowed: true, reason: 'confirmed' };
  if (profile.ageConfirmed === false) return { allowed: false, reason: 'under_18' };
  return { allowed: false, reason: 'ask', ask: true };
}

export const healthAllowed = (profile) => healthAgeState(profile).allowed;

// ── small helpers the UI will want ──────────────────────────────────────────

/** ISO week key, for "plant variety this week". */
export function weekKey(dateISO) {
  const d = new Date(`${String(dateISO).slice(0, 10)}T00:00:00`);
  if (isNaN(d)) return null;
  const t = new Date(d);
  t.setDate(t.getDate() + 4 - (t.getDay() || 7));       // ISO: Thursday decides the year
  const yearStart = new Date(t.getFullYear(), 0, 1);
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Record a "My doctor says it's OK" tap, with the date, as the brief requires. */
export function addConsent(health, kind, ref, dateISO) {
  const consents = [...(health.consents || [])];
  if (!consents.some((c) => c.kind === kind && c.ref === ref)) {
    consents.push({ kind, ref, dateISO });
  }
  return { ...health, consents };
}

export function hasConsent(health, kind, ref) {
  return (health?.consents || []).some((c) => c.kind === kind && c.ref === ref);
}

/** Add a question for the doctor, without duplicating it. */
export function addAskDoctor(health, text, dateISO) {
  const t = String(text || '').trim().slice(0, 200);
  if (!t) return health;
  const list = [...(health.askDoctor || [])];
  if (list.some((q) => q.text === t)) return health;
  list.push({ text: t, addedAt: dateISO, done: false });
  return { ...health, askDoctor: list };
}
