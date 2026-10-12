// QuitSetupSheet — the two numbers, and how long.
//
// Vic, 2026-10-12: "you put how many they smoke and how many they need to get
// down to, then it reminds them there allowance per, day."
//
// So this sheet asks exactly those two numbers plus the length of the taper,
// and nothing else. It follows the app's existing sheet idiom (AddSheet /
// SharedRoutineSheet): bottom sheet above the nav dock, `var(--surface-strong)`
// over a dim backdrop, ppwSheetIn, 48px targets, 390px-first.
//
// THREE DECISIONS WORTH THE INK.
//
// 1. IT OPENS ALREADY FILLED IN. 20 a day down to none over 28 days is a real
//    plan, so somebody who agrees with it taps Start and is done. A form that
//    opens empty asks a person who has just decided to cut down to do data
//    entry first, which is where the decision gets postponed.
//
// 2. DISMISSAL IS NOT A DECISION. The backdrop and the close button leave the
//    plan and the whole log exactly as they were. Only the control labelled
//    "Delete this plan" destroys anything — the 2026-10-05 shared-routine
//    lesson, where a stray tap on a dim backdrop lost a six-week prescription
//    with no undo. Deleting also takes every logged day with it, which the
//    confirm step says out loud before it happens.
//
// 3. THE REFUSAL IS A SENTENCE, NOT A SHAKE. checkPlanInput (through
//    startQuitPlan) returns one plain line — "Your starting number needs to be
//    higher than the number you are heading for." — and it goes on screen as a
//    live region with the sheet still up and the numbers still there to fix.

import React from 'react';
import {
  useStore5, closeQuitSetup, startQuitPlan, clearQuitPlan, setQuitAt, quitStatus, QUIT_DEFAULT_AT,
} from '../store5.js';
import { DISCLAIMER, HELP_LINE, METHOD_NOTE } from './plan.js';

// A plan somebody would actually recognise as theirs, so Start is one tap away.
const DEFAULTS = { from: 20, to: 0, days: 28 };

const field = {
  marginTop: 6, width: '100%', height: 48, padding: '0 12px', borderRadius: 12,
  border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)',
  color: 'var(--ink)', outline: 'none', fontSize: 16, fontWeight: 600,
};
const label = { display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const btnPrimary = { width: '100%', minHeight: 48, borderRadius: 15, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' };
// Subordinate to everything else, and it says what it does. Nothing unlabelled
// in this app may destroy a person's data.
const btnDestroy = { width: '100%', minHeight: 44, marginTop: 10, borderRadius: 12, border: 'none', background: 'none', color: 'var(--dim)', fontWeight: 600, fontSize: 12.5 };

export default function QuitSetupSheet() {
  const S = useStore5();
  // Every hook above every early return — React #300, as at OnboardingScreen.jsx:123.
  const [from, setFrom] = React.useState(String(DEFAULTS.from));
  const [to, setTo] = React.useState(String(DEFAULTS.to));
  const [days, setDays] = React.useState(String(DEFAULTS.days));
  const [at, setAt] = React.useState(QUIT_DEFAULT_AT);
  const [err, setErr] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const plan = S.quitPlan;

  // Opening the sheet on an existing plan shows that plan's own numbers, so
  // "change how long this runs" is an edit rather than a re-type from scratch.
  React.useEffect(() => {
    if (!S.quitOpen) return;
    setErr(null);
    setConfirmDelete(false);
    setAt(S.quitAt || QUIT_DEFAULT_AT);
    if (plan) { setFrom(String(plan.from)); setTo(String(plan.to)); setDays(String(plan.days)); }
  }, [S.quitOpen]);

  if (!S.quitOpen) return null;

  const start = () => {
    // One call does the checking and the building, so a sheet cannot get a
    // half-sane plan past a check it forgot to run.
    const bad = startQuitPlan({ from, to, days, at });
    if (bad) { setErr(bad); return; }
    closeQuitSetup();
  };

  const st = plan ? quitStatus() : null;

  // z35 — with the other config sheets (AddSheet 30, RepeatSheet 34,
  // EditStackSheet 36), and deliberately BELOW the slot reminder at 37: the
  // engine stops firing while an undismissed banner is set, so a banner hidden
  // behind a sheet would silently stall every later reminder. Below the wizard
  // (40), the first-run doors (41), the account sheet (42), terms (50), the
  // passcode lock (70) and the front door (80) for the obvious reason — none of
  // those may be painted over by a sheet reached from Settings.
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 35, display: 'flex', alignItems: 'flex-end' }}>
      {/* Backdrop: closes, changes nothing. See note 2 in the header. */}
      <div onClick={closeQuitSetup} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'relative', margin: '0 14px calc(96px + env(safe-area-inset-bottom, 0px))', width: '100%', maxHeight: '78%', overflowY: 'auto', borderRadius: 30, padding: '22px 20px 20px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Cutting down</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>
              {plan ? `Day ${st.dayNumber} of ${plan.days}` : 'Two numbers and how long'}
            </div>
          </div>
          <button onClick={closeQuitSetup} aria-label="Close" style={{ width: 48, height: 48, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={label}>How many a day now</span>
            {/* inputMode numeric so a phone shows a keypad; type=number for the
                desktop spinners and the browser's own validation. */}
            <input type="number" inputMode="numeric" min="1" max="200" value={from}
              onChange={(e) => { setFrom(e.target.value); setErr(null); }}
              aria-label="How many a day now" style={field} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={label}>Heading for</span>
            <input type="number" inputMode="numeric" min="0" max="200" value={to}
              onChange={(e) => { setTo(e.target.value); setErr(null); }}
              aria-label="The number you are heading for" style={field} />
          </label>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={label}>Over how many days</span>
            <input type="number" inputMode="numeric" min="2" max="730" value={days}
              onChange={(e) => { setDays(e.target.value); setErr(null); }}
              aria-label="How many days" style={field} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={label}>Reminder at</span>
            {/* Live, so moving the time on an existing plan takes effect without
                rebuilding it — and still gets saved by Start on a new one. */}
            <input type="time" value={at}
              onChange={(e) => { setAt(e.target.value); if (plan) setQuitAt(e.target.value); }}
              aria-label="Reminder time" style={field} />
          </label>
        </div>

        {err && (
          <div role="alert" style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.45, color: 'var(--bad)' }}>{err}</div>
        )}

        <button onClick={start} style={{ ...btnPrimary, marginTop: 16 }}>
          {plan ? 'Save the plan' : 'Start the plan'}
        </button>

        {/* The three lines, before anyone commits to anything. Same sentences
            the daily card carries, from the same constants. */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[DISCLAIMER, METHOD_NOTE, HELP_LINE].map((line) => (
            <p key={line} style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--dim)' }}>{line}</p>
          ))}
        </div>

        {plan && (confirmDelete ? (
          <div style={{ marginTop: 14, borderRadius: 16, padding: '12px 14px', border: '1px solid var(--rim)', background: 'var(--track)' }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink)' }}>
              This ends the plan and deletes every day you have logged. The reminder goes from your Stack.
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>Keep it</button>
              <button onClick={clearQuitPlan} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontWeight: 600, fontSize: 13 }}>Delete it</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={btnDestroy}>Delete this plan</button>
        ))}
      </div>
    </div>
  );
}
