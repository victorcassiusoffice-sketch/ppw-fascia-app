// ─────────────────────────────────────────────────────────────────────────
// plan.js — the quit-smoking taper. Arithmetic only.
//
// Vic's ask, 2026-10-12, verbatim: "intergrate a quit smoking app JSON you put
// how many they smoke and how many they need to get down to, then it reminds
// them there allowance per, day."
//
// "PLAN" MEANS TWO THINGS IN THIS APP, so: in quit5/ a plan is the smoking
// taper below. The unrelated src/app5/assistant/parsePlan.js is about a DAY plan
// pasted back from somebody's AI. Nothing is shared between them, and the reader
// here is called readPlan so a grep for parsePlan lands in one place only.
//
// PURE ON PURPOSE. No React, no localStorage, no network, no clock except the
// one default below. Whatever screen or reminder lands on top of this, the
// numbers underneath can be proven on their own — see plan.test.js. The day-key
// helpers come from ../daykey.js, which is the app's own date system with the
// store (and its React import) left out.
//
// ── THE PLAN, AS JSON ──────────────────────────────────────────────────────
//   {
//     v: 1,                  // schema version. A plan with any other v is not
//                            //   read — see readPlan. Bump it, never reuse it.
//     startedOn: '2026-10-4',// the app's own UNPADDED day key, 'YYYY-M-D'
//     from: 20,              // a day's smoking now. Integer, 1..MAX_PER_DAY
//     to: 0,                 // where they are heading. 0 is allowed and is the
//                            //   point of the thing. Always below `from`.
//     days: 28,              // how long the taper runs, MIN_DAYS..MAX_DAYS.
//                            //   Day 1 is `from`; day `days` is `to`.
//     smoked: {              // what actually happened, by day key.
//       '2026-10-4': 18      //   0 is a real answer and is kept as one.
//     }
//   }
//
// It is JSON and nothing but JSON: it versions, a person can read it, and it
// could be handed out of the app later without a migration step.
//
// ── THE ROUNDING DECISION ──────────────────────────────────────────────────
// A taper of 20 down to 0 across 28 days does not land on whole cigarettes. Two
// rules, chosen rather than fallen into:
//
//   Day 1 and the last day are not computed at all. Day 1 is `from` exactly —
//   somebody who signs up at 9pm has already smoked today, and an app that
//   opened on a day they had already lost would not be opened twice. The last
//   day is `to` exactly.
//
//   Every day in between rounds UP. An allowance is a permission, not a score,
//   so where the sum falls between two numbers the person gets the larger one;
//   rounding down would mean handing them a stricter plan than the one they
//   agreed to. The single deliberate round-down in the whole file is that last
//   day pinned to `to`, because rounding THAT up would mean a plan that never
//   arrives where they said they were heading.
//
// Rounding up has a visible price: 20 -> 0 over 28 days sits at 20 for two days
// before it moves. That is the right way round, and plan.test.js pins it so it
// cannot be "tidied" into a harsher curve by accident.
//
// ── WHAT THIS IS NOT ───────────────────────────────────────────────────────
// Not medical advice, and it does not imply cutting down is the recommended
// route — tapering is one approach among several and this file claims nothing
// about which works. There are no success rates in here, no percentages and no
// clinical claims, because there is no source for them. The three lines a person
// reads are DISCLAIMER, METHOD_NOTE and HELP_LINE, and they live here so a
// redesign cannot quietly drop them or inflate them into advice.
//
// Going over is reported as a fact. No red, no streak, no verdict: the wording
// is asserted in the test file, and the arithmetic itself guarantees that a bad
// day moves nothing about tomorrow.
// ─────────────────────────────────────────────────────────────────────────

import { dayDiff, dateKeyFromOffset, isDayKey, keyToDate, todayKey } from '../daykey.js';

/** The shortest honest taper. One day cannot both start at `from` and end at
 *  `to`, so a plan of 1 day (or 0, or -5) becomes two: today, then the target. */
export const MIN_DAYS = 2;
/** Two years. Longer than this is a typo, not a plan. */
export const MAX_DAYS = 730;
/** A typo guard, not a judgement: past this, somebody has mistyped. */
export const MAX_PER_DAY = 200;

export const SCHEMA_VERSION = 1;

// The three lines a person reads. Short, plain, and no number in any of them.
export const DISCLAIMER = 'This tracks a habit. It is not medical advice.';
export const METHOD_NOTE = 'Cutting down day by day is one way to stop. It is not the only one, and it may not be the one for you.';
export const HELP_LINE = 'A pharmacist or doctor can talk you through stop-smoking support and nicotine replacement.';

const int = (v) => Math.round(Number(v));
const finite = (v) => Number.isFinite(Number(v));

/**
 * Is this something we can build a plan from? Returns null when it is fine, or
 * one plain sentence when it is not — so a form can show the sentence without
 * catching an exception, and planFrom can throw the same words.
 */
export function checkPlanInput({ from, to, days } = {}) {
  if (!finite(from) || !finite(to) || !finite(days)) {
    return 'Enter how many you smoke now and the number you are heading for.';
  }
  const f = int(from);
  const t = int(to);
  const d = int(days);
  if (t < 0) return 'The number you are heading for cannot be below zero.';
  if (f > MAX_PER_DAY) return 'That is more than this plan takes — the most is ' + MAX_PER_DAY + ' a day.';
  // Checked after the ceiling so a wild `from` reports the typo rather than
  // this, and checked before the length so the message is about the real fault.
  if (f <= t) return 'Your starting number needs to be higher than the number you are heading for.';
  if (d > MAX_DAYS) return 'The longest plan this takes is ' + MAX_DAYS + ' days.';
  return null;
}

/**
 * Build a plan. `startedOn` defaults to today in the app's own key format.
 * Throws the same sentence checkPlanInput returns, because a caller that
 * skipped the check should not get a half-sane plan out of it.
 */
export function planFrom({ from, to, days, startedOn } = {}) {
  const bad = checkPlanInput({ from, to, days });
  if (bad) throw new Error(bad);
  const started = isDayKey(startedOn) ? dateKeyFromOffset(0, keyToDate(startedOn)) : todayKey();
  return {
    v: SCHEMA_VERSION,
    startedOn: started,
    from: int(from),
    to: int(to),
    // Clamped UP only. A day count below the minimum has one sensible reading
    // (the shortest taper there is); a day count above the maximum has none, so
    // checkPlanInput refuses that one outright rather than quietly shortening it.
    days: Math.max(MIN_DAYS, int(days)),
    smoked: {},
  };
}

/**
 * Read a plan back — from an object or from the JSON string a screen stored.
 * Returns null for anything it cannot trust, so a corrupt blob shows an empty
 * quit screen rather than taking the app down with it.
 */
export function readPlan(raw) {
  let o = raw;
  if (typeof raw === 'string') {
    try { o = JSON.parse(raw); } catch { return null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.v !== SCHEMA_VERSION) return null;            // a foreign version, not ours to guess at
  if (!isDayKey(o.startedOn)) return null;
  if (checkPlanInput(o)) return null;
  const days = Math.max(MIN_DAYS, int(o.days));
  const smoked = {};
  // Hostile or half-written `smoked` is dropped entry by entry rather than
  // failing the whole plan: the plan is the valuable part, the log is history.
  if (o.smoked && typeof o.smoked === 'object' && !Array.isArray(o.smoked)) {
    Object.keys(o.smoked).forEach((k) => {
      if (isDayKey(k) && finite(o.smoked[k])) smoked[normKey(k)] = clampCount(o.smoked[k]);
    });
  }
  return { v: SCHEMA_VERSION, startedOn: dateKeyFromOffset(0, keyToDate(o.startedOn)), from: int(o.from), to: int(o.to), days, smoked };
}

// Keys are normalised through the date system itself, so a padded '2026-10-04'
// written by some other screen lands on the same day as '2026-10-4'.
const normKey = (k) => dateKeyFromOffset(0, keyToDate(k));
const clampCount = (n) => Math.min(MAX_PER_DAY, Math.max(0, int(n)));

/** Which day of the plan `dayKey` is, counted the way a person counts: day 1 is
 *  the day they started. Negative before that — a back-dated view, not an error. */
export function dayNumberFor(plan, dayKey) {
  return dayIndex(plan, dayKey) + 1;
}

// Zero-based offset from the start. Internal; dayNumberFor is the one to show.
function dayIndex(plan, dayKey) {
  if (!plan || !isDayKey(dayKey)) return 0;
  return dayDiff(dayKey, plan.startedOn);
}

/**
 * The allowance for a day: how many they may smoke, by the plan they set.
 *
 * The two guards are what make the out-of-range promises true, and they are
 * open-ended on purpose rather than clamping the day index first. `i <= 0`
 * covers every day BEFORE the plan began — it reports `from`, because the plan
 * has nothing to say about a day it did not cover and must not invent a limit
 * nobody agreed to. `i >= last` covers every day AFTER the last one, so the
 * allowance stays at `to` for ever.
 *
 * An earlier version clamped the index to [0, last] as well. A mutation run
 * found the clamp bought nothing the guards did not already give, and that it
 * quietly broke the one case it was supposed to protect: a hand-built plan with
 * days: 1 clamps every day to index 0 and so reports `from` for ever, never
 * reaching `to`. Two mechanisms where one is needed is how the load-bearing one
 * gets tidied away by the next reader.
 *
 * They also keep the divisor honest: the line is only evaluated for
 * 0 < i < last, so `last` of 0 is never divided by.
 */
export function allowanceFor(plan, dayKey) {
  if (!plan) return 0;
  const last = plan.days - 1;
  const i = dayIndex(plan, dayKey);
  if (i <= 0) return plan.from;        // day one is not computed. See the header.
  if (i >= last) return plan.to;       // the one deliberate round-down.
  // Straight line between the two pinned ends, rounded up. ceil() of a falling
  // line can never rise, which is the monotonic-non-increasing guarantee.
  return Math.ceil(plan.from - ((plan.from - plan.to) * i) / last);
}

/** Every day's allowance, day 1 first — for drawing the taper, and for proving
 *  in one line that it never goes up. */
export function allowanceCurve(plan) {
  if (!plan) return [];
  const out = [];
  for (let i = 0; i < plan.days; i += 1) out.push(allowanceFor(plan, dayKeyAt(plan, i)));
  return out;
}

/** The day key `i` days into the plan (0 = the day it started). */
export function dayKeyAt(plan, i) {
  return dateKeyFromOffset(i, keyToDate(plan.startedOn));
}

/** How many were logged on a day. No entry means none logged, which is not the
 *  same as a logged zero — but for arithmetic both are 0. */
export function smokedOn(plan, dayKey) {
  if (!plan || !plan.smoked || !isDayKey(dayKey)) return 0;
  const n = plan.smoked[normKey(dayKey)];
  return finite(n) ? clampCount(n) : 0;
}

/** Allowance minus what was smoked. Negative means the day went over, and by
 *  how much — the screen needs the size of it, not just the fact. */
export function remainingFor(plan, dayKey) {
  return allowanceFor(plan, dayKey) - smokedOn(plan, dayKey);
}

/**
 * Record what was actually smoked on a day. Returns a NEW plan — nothing here
 * mutates, so a screen can hold the old one and a caller cannot be surprised.
 * `n` of null (or undefined) clears the day, which is how an undo works.
 */
export function logSmoked(plan, dayKey, n) {
  if (!plan) return plan;
  if (!isDayKey(dayKey)) return plan;          // a key we cannot place is not recorded anywhere
  const key = normKey(dayKey);
  const smoked = { ...(plan.smoked || {}) };
  if (n === null || n === undefined || !finite(n)) delete smoked[key];
  else smoked[key] = clampCount(n);
  return { ...plan, smoked };
}

/**
 * Everything a day needs to say, including the words.
 *
 * The wording lives in the engine so it can be tested, and so going over reads
 * as a fact rather than a verdict: no "failed", no streak to break, and a
 * sentence that says out loud what the arithmetic already guarantees — that
 * tomorrow's number has not moved. Somebody having a bad day should still want
 * to open this tomorrow.
 */
export function statusFor(plan, dayKey = todayKey()) {
  // No plan set up yet: null, so the screen branches. Inventing a status would
  // have it announce "0 left of today's 0", and reading plan.days off nothing
  // white-screens the app — which this app has done once already.
  if (!plan) return null;
  const allowance = allowanceFor(plan, dayKey);
  const smoked = smokedOn(plan, dayKey);
  const remaining = allowance - smoked;
  const over = remaining < 0;
  // Curly apostrophe: this text goes straight onto a card, where a typewriter
  // quote looks like a bug.
  let text;
  if (over) text = -remaining + ' more than today’s ' + allowance + '. Tomorrow’s number is unchanged.';
  else if (remaining === 0) text = 'That is today’s ' + allowance + '.';
  else text = remaining + ' left of today’s ' + allowance + '.';
  return {
    dayNumber: dayNumberFor(plan, dayKey),
    allowance,
    smoked,
    remaining,
    over,
    done: dayIndex(plan, dayKey) >= plan.days - 1,
    text,
  };
}
