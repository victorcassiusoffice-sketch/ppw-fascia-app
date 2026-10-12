// QuitCard — today's allowance, on the Stack.
//
// Vic, 2026-10-12: "… then it reminds them there allowance per, day."
//
// This is the "reminds them" half, on the screen the person opens anyway. It is
// DERIVED: everything it shows comes from store5's quitItem(), which computes it
// from the plan on every read. There is no row in `deckItems` to fall out of
// step with the plan, and deleting the plan deletes this card in the same breath
// — the store header says why it is not appended to stackFor() instead.
//
// FOUR THINGS THIS FILE IS DELIBERATE ABOUT.
//
// 1. IT DOES NOT BRANCH ON `status.over`. The engine hands over a boolean for
//    layout, and the single most effective way to break what the engine
//    guarantees — that a heavy day is reported as a fact, not a verdict — is a
//    screen that turns the number red, breaks a streak or frowns at it. The
//    strongest guarantee that this card cannot paint a failure is that it has
//    no code path for one: one set of colours, one layout, every day. The words
//    change because statusFor's words change, and those are tested in
//    quit5/plan.test.js.
//
// 2. THE HONESTY LINES ARE RENDERED HERE, not just defined somewhere. plan.js
//    can prove the sentences exist; only a mounted card proves anybody is shown
//    them. HELP_LINE is the one that points at a pharmacist or doctor and names
//    nicotine replacement, and it is the line most worth a person's eye landing
//    on daily — this app is not the treatment.
//
// 3. ONE TAP TO LOG, 48px, in the moment. This gets used outdoors, one-handed,
//    in the middle of the thing being recorded. Anything that asked for a
//    number first would be filled in later or not at all, and an allowance that
//    reads as untouched all day is worse than no log.
//
// 4. THE TITLE IS THE DISCREET ONE. `item.title` is store5's QUIT_SLOT_TITLE,
//    which carries no number and no subject because the slot engine hands that
//    same string to the reminder banner. The counts are on the card, where the
//    phone is in somebody's hand.

import React from 'react';
import { useStore5, quitItem, logOneSmoked, undoOneSmoked, openQuitSetup, todayKey } from '../store5.js';

const btnPrimary = {
  flex: 1, minHeight: 48, borderRadius: 15, border: '1px solid var(--acc-rim)',
  background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14.5,
  textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)',
};
const btnQuiet = {
  minHeight: 48, padding: '0 14px', borderRadius: 15, border: '1px solid var(--rim)',
  background: 'transparent', color: 'var(--dim)', fontWeight: 600, fontSize: 13,
};

export default function QuitCard() {
  const S = useStore5();
  // The Stack can be opened on any date from the Calendar, so the card answers
  // for the day on screen rather than always for today.
  const key = S.viewDate || todayKey();
  const item = quitItem(key, S);
  // No plan, or a day the plan never covered. Nothing to say, so nothing drawn.
  if (!item) return null;
  const st = item.status;
  const days = S.quitPlan ? S.quitPlan.days : 0;

  return (
    <div style={{ marginTop: 14, borderRadius: 26, padding: '16px 18px 14px', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 999, background: 'var(--disc)', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          {/* A line coming down. Not a cigarette, and not a warning sign. */}
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h3M4 7l12 11" /><path d="M20 18h-3" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{item.title}</div>
          <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--dim)' }}>
            Day {st.dayNumber}{days ? ` of ${days}` : ''}
          </div>
        </div>
        {/* Tapping the time opens the setup sheet, which is also where the
            reminder time is changed — one way in, so there is no second place
            that can disagree about the plan. */}
        <button onClick={openQuitSetup} aria-label="Open your plan"
          style={{ minHeight: 48, padding: '0 10px', flex: 'none', background: 'none', border: 'none', color: 'var(--dim)', fontSize: 15, fontWeight: 600 }}>
          {item.time}
        </button>
      </div>

      {/* The one line the whole card exists for. The engine wrote these words. */}
      <div style={{ marginTop: 12, fontSize: 19, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>
        {st.text}
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => logOneSmoked(key)} style={btnPrimary}>Log one</button>
        {/* Disabled rather than hidden: a control that appears once there is
            something to undo is a control nobody learns is there. */}
        <button onClick={() => undoOneSmoked(key)} disabled={st.smoked === 0}
          style={{ ...btnQuiet, flex: 'none', opacity: st.smoked === 0 ? .45 : 1 }}>
          Take one back
        </button>
      </div>

      {/* Honesty. Small, and never behind a tap — see note 2 in the header. */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {item.notes.map((line) => (
          <p key={line} style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--dim)' }}>{line}</p>
        ))}
      </div>
    </div>
  );
}
