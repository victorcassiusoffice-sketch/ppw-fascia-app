// useHintWatcher — one place that watches the store and asks for hints.
//
// The alternative was a maybeHint() call sprinkled through a dozen store
// actions, which would have made store5 import the hint engine that imports
// store5, and left the triggers scattered across files nobody would think to
// look in. Instead: one hook, mounted once by App5, that diffs the store from
// render to render and asks. The engine still decides whether to answer.
//
// A few hints cannot be seen in the store at all (a drag that completed, a tap
// on the bell) — those call maybeHint() from the control itself.

import React from 'react';
import { useStore5, getState, FREE_CAP_UPSELL, useDayCount, todayKey, rearmHint } from '../store5.js';
import { maybeHint } from './hints5.js';
import { isStandalone } from './quests5.js';

const doneCount = (S) => ((S.doneByDate || {})[todayKey()] || []).length;
const autoCount = (S) => (S.deckItems || []).filter((x) => x.auto).length;

export default function useHintWatcher() {
  const S = useStore5();
  const prev = React.useRef(null);

  React.useEffect(() => {
    const p = prev.current;
    prev.current = {
      addOpen: S.addOpen, selected: S.selectedIds.length, auto: autoCount(S),
      done: doneCount(S), lastAddedId: S.lastAddedId, viewDate: S.viewDate,
      upsell: S.premiumUpsell, tab: S.stackTab, screen: S.screen,
      slotPop: !!S.slotPop, reminders: S.reminders,
    };
    if (!p) return;                 // first pass is the baseline, never a trigger
    if (!S.onboarded) return;

    // The selection circle sits one tap from bulk delete and looks exactly like
    // a "done" tick. Say what it is the first time it is used.
    if (p.selected === 0 && S.selectedIds.length === 1) { maybeHint('select-circle'); return; }

    // AUTO is a checkbox with no words attached.
    if (autoCount(S) > p.auto) { maybeHint('auto-box'); return; }

    // Ticked things vanish into an unlabelled disc. For anyone who skipped the
    // guide, this is the only explanation they will get.
    if (doneCount(S) > p.done) { maybeHint('done-vanish'); return; }

    // Everything lands at 09:00 daily, silently, and nothing says so.
    if (S.lastAddedId && S.lastAddedId !== p.lastAddedId) { maybeHint('link-defaults'); return; }

    // The stack is showing a different day and the only way back is a chip the
    // size of a stamp.
    if (S.viewDate && S.viewDate !== p.viewDate && S.viewDate !== todayKey()) { maybeHint('today-chip'); return; }

    // The free cap counts the four example cards we put there ourselves.
    if (S.premiumUpsell && S.premiumUpsell !== p.upsell && S.premiumUpsell === FREE_CAP_UPSELL) { maybeHint('free-cap'); return; }

    if (S.screen === 'library' && S.stackTab !== p.tab) {
      if (S.stackTab === 'routines' && !S.premium) { maybeHint('routines-paywall'); return; }
      if (S.stackTab === 'supps') { maybeHint('supps-intro'); return; }
    }

    // Two ways to fill a day, and the tiles that look like they add things but
    // do not.
    if (!p.addOpen && S.addOpen) { maybeHint('add-intro'); return; }

    // THE ONE THAT MATTERS MOST. The first time a nudge actually appears, say
    // what it is and — more importantly — what it is not. This is the moment
    // someone forms a belief about whether this app will wake them up, and it
    // will not.
    if (S.slotPop && !p.slotPop) { maybeHint('reminder-truth'); return; }

    // Switching Reminders ON is the other moment that belief gets formed, and
    // it can happen without ever having seen a banner — so it buys back one of
    // this hint's two lives.
    if (S.reminders && !p.reminders) { rearmHint('reminder-truth'); maybeHint('reminder-truth'); return; }
  }, [S]);

  // The install nudge waits for a habit rather than nagging a first-timer: the
  // third distinct day of use, on the Stack, with nothing else on screen and at
  // least one thing in the day that the user put there.
  React.useEffect(() => {
    if (!S.onboarded || S.screen !== 'stack') return;
    if (useDayCount() < 3) return;
    if (isStandalone()) return;
    if (!(S.deckItems || []).some((x) => x.example !== true)) return;
    const t = setTimeout(() => { if (getState().screen === 'stack') maybeHint('install-nudge'); }, 4000);
    return () => clearTimeout(t);
  }, [S.screen, S.onboarded, S.deckItems]);
}
