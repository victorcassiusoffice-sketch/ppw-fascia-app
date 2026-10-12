// The quit-smoking taper, proven as arithmetic (Vic 2026-10-12).
//
// Vic's ask, verbatim: "you put how many they smoke and how many they need to
// get down to, then it reminds them there allowance per, day."
//
// Two things this file exists to stop:
//
// 1. DAY KEYS. The app's own day key is UNPADDED — store5.todayKey() returns
//    '2026-10-4', and new Date('2026-10-4T00:00:00') is an Invalid Date. A
//    sibling branch shipped a whole feature whose every date check failed
//    silently because its tests fed PADDED dates. Every date in this file is in
//    the format the app actually produces, and the first test below pins the
//    trap itself so nobody re-introduces a Date.parse().
//
// 2. SHAME. Going over the allowance is a fact, not a verdict. The wording is
//    asserted here, on the engine rather than on a screen, so a redesign cannot
//    quietly turn a bad day into a told-off one.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_DAYS,
  MAX_PER_DAY,
  MIN_DAYS,
  DISCLAIMER,
  HELP_LINE,
  METHOD_NOTE,
  allowanceCurve,
  allowanceFor,
  checkPlanInput,
  dayNumberFor,
  logSmoked,
  readPlan,
  planFrom,
  remainingFor,
  statusFor,
} from './plan.js';

// plan.js touches no storage — it is pure arithmetic, which is the whole point
// of it being its own module. The clear is here so that if anyone ever makes it
// import the store, these tests do not start leaking state between cases.
beforeEach(() => { try { localStorage.clear(); } catch {} });

const plan28 = () => planFrom({ from: 20, to: 0, days: 28, startedOn: '2026-10-4' });

describe('the app own day-key format (trap 1)', () => {
  it('is not ISO-parseable, which is why the engine never parses keys as strings', () => {
    // If this ever stops being true the comment above can go. Until then, any
    // day arithmetic built on Date.parse() is silently broken for most of the
    // year — every single-digit day and every single-digit month.
    expect(Number.isNaN(new Date('2026-10-4T00:00:00').getTime())).toBe(true);
  });

  it('counts days from an unpadded key, across a month boundary', () => {
    const p = planFrom({ from: 10, to: 0, days: 40, startedOn: '2026-10-4' });
    expect(dayNumberFor(p, '2026-10-4')).toBe(1);   // the day they signed up is Day 1
    expect(dayNumberFor(p, '2026-10-9')).toBe(6);
    expect(dayNumberFor(p, '2026-11-3')).toBe(31);  // 31 October days, then over the edge
  });

  it('will not file a plan on a day that does not exist', () => {
    // A REGRESSION GUARD, not a behaviour change: this is what the engine
    // already does, pinned because isDayKey's rejection of an impossible date
    // is easy to lose. '2026-2-31' and '2026-13-1' both look like day keys and
    // the Date constructor would roll them into March and January 2027 — a plan
    // anchored to a day the app never renders, with every allowance off by the
    // size of the roll. A bad key given to planFrom falls back to today, and a
    // STORED plan carrying one is not read at all.
    expect(planFrom({ from: 20, to: 0, days: 28, startedOn: '2026-2-31' }).startedOn)
      .toBe(planFrom({ from: 20, to: 0, days: 28 }).startedOn);
    expect(readPlan({ v: 1, from: 20, to: 0, days: 28, startedOn: '2026-2-31', smoked: {} })).toBe(null);
    expect(readPlan({ v: 1, from: 20, to: 0, days: 28, startedOn: '2026-13-1', smoked: {} })).toBe(null);
  });

  it('reads a padded key as the same day, so a stored plan survives either form', () => {
    const p = plan28();
    expect(allowanceFor(p, '2026-10-07')).toBe(allowanceFor(p, '2026-10-7'));
  });
});

describe('planFrom', () => {
  it('writes the plan as inspectable JSON', () => {
    expect(plan28()).toEqual({
      v: 1, startedOn: '2026-10-4', from: 20, to: 0, days: 28, smoked: {},
    });
    // It round-trips, because a plan is a thing a person may one day want out
    // of the app rather than locked inside it.
    expect(readPlan(JSON.stringify(plan28()))).toEqual(plan28());
  });

  it('refuses a target that is not below the starting number, in plain words', () => {
    expect(checkPlanInput({ from: 10, to: 10, days: 20 }))
      .toBe('Your starting number needs to be higher than the number you are heading for.');
    expect(checkPlanInput({ from: 5, to: 9, days: 20 })).toBeTruthy();
    expect(() => planFrom({ from: 10, to: 10, days: 20, startedOn: '2026-10-4' })).toThrow();
  });

  it('takes a one-step plan: one a day, down to none', () => {
    const p = planFrom({ from: 1, to: 0, days: 1, startedOn: '2026-10-4' });
    expect(p.days).toBe(MIN_DAYS);                       // one day cannot start AND end
    expect(allowanceCurve(p)).toEqual([1, 0]);
  });

  it('rounds a number somebody typed with a decimal point', () => {
    const p = planFrom({ from: 19.6, to: 0.4, days: 27.5, startedOn: '2026-10-4' });
    expect([p.from, p.to, p.days]).toEqual([20, 0, 28]);
  });

  it('refuses nonsense rather than building a nonsense plan', () => {
    expect(checkPlanInput({ from: 1e9, to: 0, days: 28 })).toContain(String(MAX_PER_DAY));
    expect(checkPlanInput({ from: 20, to: 0, days: 1e6 })).toContain(String(MAX_DAYS));
    expect(checkPlanInput({ from: NaN, to: 0, days: 28 })).toBeTruthy();
    expect(checkPlanInput({ from: Infinity, to: 0, days: 28 })).toBeTruthy();
    expect(checkPlanInput({ from: 'twenty', to: 0, days: 28 })).toBeTruthy();
    expect(checkPlanInput({ from: -5, to: -9, days: 28 })).toBeTruthy();
    expect(checkPlanInput({ from: 20, to: 0, days: 28 })).toBe(null);  // the good one
  });

  it('rejects a corrupt or foreign stored plan instead of crashing a screen', () => {
    expect(readPlan('not json')).toBe(null);
    expect(readPlan(null)).toBe(null);
    expect(readPlan({ v: 2, from: 20, to: 0, days: 28, startedOn: '2026-10-4' })).toBe(null);
    expect(readPlan({ v: 1, from: 0, to: 9, days: 28, startedOn: '2026-10-4' })).toBe(null);
    expect(readPlan({ v: 1, from: 20, to: 0, days: 28, startedOn: '2026-10-4', smoked: 'x' }))
      .toEqual({ v: 1, from: 20, to: 0, days: 28, startedOn: '2026-10-4', smoked: {} });
  });
});

describe('the allowance', () => {
  it('is the starting number on day one — nobody has failed before they start', () => {
    // Somebody who signs up at 9pm has already smoked today's cigarettes. If
    // day one dropped, the app would open on a day they could not win.
    expect(allowanceFor(plan28(), '2026-10-4')).toBe(20);
  });

  it('is the target on the last day of the taper', () => {
    expect(allowanceFor(plan28(), '2026-10-31')).toBe(0);  // day 28 of 28
  });

  it('stays at the target for ever afterwards', () => {
    const p = plan28();
    expect(allowanceFor(p, '2026-11-1')).toBe(0);
    expect(allowanceFor(p, '2027-6-1')).toBe(0);
    const q = planFrom({ from: 20, to: 5, days: 10, startedOn: '2026-10-4' });
    expect(allowanceFor(q, '2029-1-1')).toBe(5);
  });

  it('says the starting number for a day before the plan began', () => {
    // A back-dated view must not invent a limit the person never agreed to.
    expect(allowanceFor(plan28(), '2026-10-1')).toBe(20);
    expect(dayNumberFor(plan28(), '2026-10-1')).toBe(-2);
  });

  it('never returns NaN for a plan nobody built through planFrom', () => {
    // allowanceFor is exported, so a screen can hand it a literal rather than a
    // plan planFrom clamped. A plan of 1 day cannot both start at `from` and end
    // at `to`, and the guards in allowanceFor — not a clamped day index — are
    // what keep `last` (0 here) out of the divisor.
    const p = { v: 1, startedOn: '2026-10-4', from: 8, to: 0, days: 1, smoked: {} };
    expect(allowanceFor(p, '2026-10-4')).toBe(8);
    expect(allowanceFor(p, '2026-10-5')).toBe(0);
    expect(allowanceFor(p, '2027-1-1')).toBe(0);
  });

  it('never goes up, on any shape of plan', () => {
    const shapes = [
      { from: 20, to: 0, days: 28 },   // the common one
      { from: 17, to: 3, days: 9 },    // nothing divides evenly
      { from: 3, to: 0, days: 60 },    // a long taper off a small habit
      { from: 200, to: 1, days: 2 },   // the extremes, both ends
      { from: 1, to: 0, days: 730 },
      { from: 40, to: 39, days: 365 },
    ];
    shapes.forEach((s) => {
      const curve = allowanceCurve(planFrom({ ...s, startedOn: '2026-10-4' }));
      expect(curve.length).toBe(s.days);
      expect(curve[0]).toBe(s.from);
      expect(curve[curve.length - 1]).toBe(s.to);
      curve.forEach((n, i) => {
        expect(Number.isInteger(n)).toBe(true);
        if (i) expect(n).toBeLessThanOrEqual(curve[i - 1]);
      });
    });
  });

  it('rounds a part-cigarette UP, and only the last day down to the target', () => {
    // THE ROUNDING DECISION, pinned. An allowance is a permission, so where the
    // sum lands between two numbers the person gets the larger one rather than
    // a stricter plan than they agreed to. The one deliberate round-down is the
    // final day: it is set to the target exactly, because rounding that one up
    // would mean the plan never arrives where they said they were heading.
    const p = planFrom({ from: 17, to: 3, days: 9, startedOn: '2026-10-4' });
    //                     17 -> 3 across 8 steps = 1.75 a day
    expect(allowanceCurve(p)).toEqual([17, 16, 14, 12, 10, 9, 7, 5, 3]);

    // Rounding up means 20 -> 0 over 28 days holds at 20 for a second day. That
    // is the price of being generous, and it is the right way round.
    expect(allowanceCurve(plan28()).slice(0, 3)).toEqual([20, 20, 19]);
    expect(allowanceCurve(plan28()).slice(-3)).toEqual([2, 1, 0]);
  });

  it('is not changed by what anyone actually smoked', () => {
    // The plan is the plan. A heavy day does not move tomorrow's number in
    // either direction — no punishment, and no quietly-raised ceiling either.
    const p = logSmoked(plan28(), '2026-10-5', 40);
    expect(allowanceFor(p, '2026-10-6')).toBe(allowanceFor(plan28(), '2026-10-6'));
  });
});

describe('logging what was actually smoked', () => {
  it('leaves the plan it was given alone', () => {
    const before = plan28();
    const after = logSmoked(before, '2026-10-4', 12);
    expect(before.smoked).toEqual({});
    expect(after.smoked).toEqual({ '2026-10-4': 12 });
  });

  it('records a day with none on it as none, not as nothing', () => {
    // 0 is an answer, and the one most worth keeping.
    const p = logSmoked(plan28(), '2026-10-4', 0);
    expect(p.smoked['2026-10-4']).toBe(0);
    expect(remainingFor(p, '2026-10-4')).toBe(20);
  });

  it('clears a day when the count is taken back', () => {
    const p = logSmoked(logSmoked(plan28(), '2026-10-4', 12), '2026-10-4', null);
    expect('2026-10-4' in p.smoked).toBe(false);
  });

  it('refuses to store a count that cannot be real', () => {
    expect(logSmoked(plan28(), '2026-10-4', -3).smoked['2026-10-4']).toBe(0);
    expect(logSmoked(plan28(), '2026-10-4', 1e9).smoked['2026-10-4']).toBe(MAX_PER_DAY);
    expect(logSmoked(plan28(), '2026-10-4', 7.6).smoked['2026-10-4']).toBe(8);
    expect(logSmoked(plan28(), 'rubbish', 5)).toEqual(plan28());
  });

  it('reports what is left, and by how much a day went over', () => {
    const p = logSmoked(plan28(), '2026-10-4', 14);
    expect(remainingFor(p, '2026-10-4')).toBe(6);
    expect(remainingFor(logSmoked(p, '2026-10-4', 25), '2026-10-4')).toBe(-5);
    expect(remainingFor(plan28(), '2026-10-4')).toBe(20);  // nothing logged yet
  });
});

describe('what the person is told', () => {
  it('gives the day, today number, and what is left', () => {
    const s = statusFor(logSmoked(plan28(), '2026-10-4', 14), '2026-10-4');
    expect(s.dayNumber).toBe(1);
    expect(s.allowance).toBe(20);
    expect(s.smoked).toBe(14);
    expect(s.remaining).toBe(6);
    expect(s.over).toBe(false);
    expect(s.text).toBe('6 left of today’s 20.');
  });

  it('says so plainly when the day is used up', () => {
    const s = statusFor(logSmoked(plan28(), '2026-10-4', 20), '2026-10-4');
    expect(s.over).toBe(false);
    expect(s.text).toBe('That is today’s 20.');
  });

  it('reports a day over the number as a fact, with no telling-off', () => {
    // THE TEST THAT MATTERS. Somebody having a bad day should still want to
    // open this tomorrow, so the wording carries no verdict, and the engine
    // itself is what promises tomorrow is unchanged.
    const s = statusFor(logSmoked(plan28(), '2026-10-6', 25), '2026-10-6');
    expect(s.over).toBe(true);
    expect(s.remaining).toBe(-6);
    expect(s.text).toBe('6 more than today’s 19. Tomorrow’s number is unchanged.');
    expect(s.text).not.toMatch(
      /fail|slip|relaps|streak|guilt|shame|sorry|bad|wrong|should|only|try harder|exceed|limit|over your/i
    );
  });

  it('counts the days the way a person would, from one', () => {
    expect(statusFor(plan28(), '2026-10-4').dayNumber).toBe(1);
    expect(statusFor(plan28(), '2026-10-31').dayNumber).toBe(28);
    expect(statusFor(plan28(), '2026-11-5').dayNumber).toBe(33);  // past the end, still counting
  });

  it('knows when the taper is finished', () => {
    expect(statusFor(plan28(), '2026-10-30').done).toBe(false);
    expect(statusFor(plan28(), '2026-11-1').done).toBe(true);
  });

  it('has nothing to say when there is no plan yet, rather than falling over', () => {
    // A screen can render before anyone has set a plan up. Returning null makes
    // that screen branch; inventing a status would have it announce "0 left of
    // today's 0", and throwing would white-screen the app (which this repo has
    // done once already — see skills/render_verification_gate).
    expect(statusFor(null, '2026-10-4')).toBe(null);
    expect(statusFor(undefined, '2026-10-4')).toBe(null);
  });
});

describe('honesty', () => {
  it('says what this is, in one short line', () => {
    expect(DISCLAIMER).toBe('This tracks a habit. It is not medical advice.');
  });

  it('points at real help without lecturing', () => {
    expect(HELP_LINE).toMatch(/pharmacist|doctor/i);
    expect(HELP_LINE).toMatch(/nicotine replacement/i);
    expect(HELP_LINE.length).toBeLessThan(140);
  });

  it('does not claim cutting down is the recommended way', () => {
    expect(METHOD_NOTE).toMatch(/one (way|approach)/i);
    expect(METHOD_NOTE).not.toMatch(/best|recommend|proven|should/i);
  });

  it('invents no statistic anywhere in what it says', () => {
    // No success rates, no percentages, no clinical claims — there is no source
    // for a number of that kind, so there is no number of that kind.
    [DISCLAIMER, HELP_LINE, METHOD_NOTE].forEach((line) => {
      expect(line).not.toMatch(/\d/);
      expect(line).not.toMatch(/%|percent|studies|research|proven|clinically/i);
    });
  });
});
