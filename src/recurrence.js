// Recurrence engine (2026-06-03) — pure, fully unit-testable.
//
// A recurring routine is NOT copied into N day-buckets. It lives once as a
// "rule" and is expanded on read. The day view = rule expansion for the date,
// minus per-date {deleted} overrides, plus per-date {patch} overrides, plus
// one-off userStacks::<ISO>. See docs/calendar-recurrence-report.md §4.
//
// All functions here are pure (no localStorage, no React) so the data model
// can be proven correct in isolation.

export const MAX_INTERVAL = 30;   // "Every N days" custom interval ceiling
export const DEFAULT_HORIZON_DAYS = 30;  // recurrence fills the calendar 30 days ahead

/* ─── ISO date helpers (UTC-anchored to avoid TZ drift on day arithmetic) ─── */

// Add `n` whole days to a YYYY-MM-DD string, returning a YYYY-MM-DD string.
export function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Whole-day difference bISO - aISO (positive when b is after a).
export function diffDaysISO(aISO, bISO) {
  const a = Date.parse(aISO + 'T00:00:00Z');
  const b = Date.parse(bISO + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

function clampInt(n, lo, hi) {
  n = Math.floor(Number(n) || 0);
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/* ─── Rule semantics ─── */

// Resolve a rule's day-step interval.
//   everyday → 1 · weekly → 7 · everyN → clamp(interval, 1..30)
export function ruleInterval(rule) {
  if (!rule) return 1;
  switch (rule.freq) {
    case 'everyday': return 1;
    case 'weekly':   return 7;
    case 'everyN':   return clampInt(rule.interval, 1, MAX_INTERVAL);
    default:         return 1;
  }
}

// Horizon (in days) from the anchor that a rule is allowed to fill.
export function ruleHorizon(rule) {
  const h = rule && rule.horizonDays != null ? Math.floor(Number(rule.horizonDays)) : DEFAULT_HORIZON_DAYS;
  if (!Number.isFinite(h) || h <= 0) return DEFAULT_HORIZON_DAYS;
  return Math.min(h, DEFAULT_HORIZON_DAYS);
}

// Does this rule produce an occurrence on `dateISO`?
//   • dateISO must be on/after the anchor
//   • (dateISO - anchor) must be a whole multiple of the interval
//   • dateISO must be within the anchor's horizon (≤ anchor + horizonDays)
export function ruleOccursOn(rule, dateISO) {
  if (!rule || !rule.anchorDate) return false;
  const delta = diffDaysISO(rule.anchorDate, dateISO);
  if (delta < 0) return false;
  if (delta > ruleHorizon(rule)) return false;
  const step = ruleInterval(rule);
  return delta % step === 0;
}

// Expand a single rule into the list of ISO dates it occurs on, within the
// inclusive window [fromISO, toISO], clamped to the rule's horizon.
// Returns a sorted array of YYYY-MM-DD strings.
export function expandRule(rule, fromISO, toISO) {
  if (!rule || !rule.anchorDate) return [];
  const step = ruleInterval(rule);
  const horizon = ruleHorizon(rule);
  const lastAllowed = addDaysISO(rule.anchorDate, horizon);

  // Start at the first occurrence on/after fromISO that lands on the cadence.
  let start = rule.anchorDate;
  if (diffDaysISO(rule.anchorDate, fromISO) > 0) {
    const gap = diffDaysISO(rule.anchorDate, fromISO);
    const k = Math.ceil(gap / step);
    start = addDaysISO(rule.anchorDate, k * step);
  }

  const out = [];
  let cur = start;
  // Hard cap on iterations as a runaway guard (window can't exceed horizon+1).
  for (let i = 0; i <= horizon + 1; i++) {
    if (diffDaysISO(cur, toISO) < 0) break;       // past the window end
    if (diffDaysISO(cur, lastAllowed) < 0) break; // past the horizon
    if (diffDaysISO(fromISO, cur) >= 0) out.push(cur);
    cur = addDaysISO(cur, step);
  }
  return out;
}

/* ─── Day-view assembly (pure) ─── */

// Given all rules, the per-date override map for `dateISO`, and the date,
// return the recurring stack payloads that should appear on that date, with
// per-date {deleted} applied (removed) and {patch} applied (merged).
// Each entry: { ruleId, stack } where stack is the (patched) payload.
export function recurringStacksForDate(rules, overridesForDate, dateISO) {
  if (!Array.isArray(rules)) return [];
  const ov = overridesForDate || {};
  const out = [];
  for (const rule of rules) {
    if (!ruleOccursOn(rule, dateISO)) continue;
    const o = ov[rule.id];
    if (o && o.deleted) continue;                 // "this day only" skip
    const patch = o && o.patch ? o.patch : null;
    const stack = patch ? { ...rule.stack, ...patch } : rule.stack;
    out.push({ ruleId: rule.id, stack });
  }
  return out;
}

// Build a recurrence rule record from an AddStackModal scope choice.
//   scope: 'everyday' | 'weekly' | 'everyN'
export function makeRule({ id, stack, anchorDate, freq, interval, createdAt }) {
  const rule = {
    id,
    stack,
    anchorDate,
    freq,
    horizonDays: DEFAULT_HORIZON_DAYS,
    createdAt: createdAt || 0,
  };
  if (freq === 'everyN') rule.interval = clampInt(interval, 1, MAX_INTERVAL);
  else if (freq === 'weekly') rule.interval = 7;
  else rule.interval = 1;
  return rule;
}
