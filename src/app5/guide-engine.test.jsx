// Guided onboarding — the ENGINE (2026-08-24).
//
// What these guard, in order of how badly they would hurt if they broke:
//
//  • A `do` step must advance ONLY when the real thing happened. If it advanced
//    on a tap on the dimmer, the guide would be a slideshow wearing a costume.
//  • The pause ✕ must never record a quest as done. Someone who bailed out has
//    not learned the thing, and a falsely-ticked quest is a lie they cannot
//    undo.
//  • Completion must be idempotent: replaying a quest never un-ticks it.
//  • The migration must skip the WELCOME for veterans and NOTHING else — they
//    were never taught any of this, so silencing their guide would be a
//    downgrade dressed up as respect for their time.
//  • The hint engine's depth-1 rule must DROP a second hint without burning its
//    flag, or a one-shot hint gets spent on a moment nobody could see.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';

import {
  setState, getState, save,
  openCoach, advanceCoach, closeCoach, recordQuest, questDone, questCount,
  openJournal, closeJournal, guideDone, guideFinished,
  setHint, clearHint, hintCount, burnHint, setHintsOff, anySheetOpen,
  todayKey, tomorrowKey, recordUseDay, useDayCount, markLibSeen, hasLibSeen,
  noteAdded, setAiStep,
} from './store5.js';
import CoachMarks from './coach/CoachMarks.jsx';
import { QUESTS, QUEST_IDS, doneCountOf, allDone, firstIncomplete, startQuest } from './coach/quests5.js';
import { maybeHint, resetHintEngine, HINTS, hintQuestOffer, setDragging } from './coach/hints5.js';

const LS = (k) => 'ppw5.' + k;

/** A clean device, then whatever this test needs on top. */
function reset(patch = {}) {
  localStorage.clear(); sessionStorage.clear();
  resetHintEngine();
  setState({
    screen: 'stack', viewDate: null, coach: null, journalOpen: false, hint: null,
    lastAddedId: null, aiStep: 0, guide: { q: {} }, hints: {}, hintsOff: false,
    onboarded: true, addOpen: false, aiOpen: false, termsOpen: false, accountOpen: false,
    completedOpen: false, playerItem: null, scheduleTarget: null, repeatId: null,
    premiumUpsell: null, doneByDate: {}, selectedIds: [], calSelKey: null,
    ...patch,
  });
}

beforeEach(() => reset());
afterEach(cleanup);

// ── the coach engine ─────────────────────────────────────────────────────

describe('a do-step waits for the real thing', () => {
  const twoSteps = [
    { target: null, mode: 'do', title: 'Tick one', body: 'Tap the tick.', advanceOn: (S) => (S.doneByDate[todayKey()] || []).length > 0 },
    { target: null, title: 'Second', body: 'Done.' },
  ];

  it('does not advance on a tap on the dimmer', () => {
    openCoach({ steps: twoSteps, questId: 'test' });
    const { container } = render(<div><CoachMarks /></div>);
    expect(screen.getByText('Tick one')).toBeTruthy();
    // every dim panel, tapped
    container.querySelectorAll('div[style]').forEach((n) => fireEvent.click(n));
    expect(getState().coach.i).toBe(0);
    expect(screen.getByText('Tick one')).toBeTruthy();
  });

  it('tells the user the screen is their turn, and offers no Next', () => {
    openCoach({ steps: twoSteps, questId: 'test' });
    render(<CoachMarks />);
    expect(screen.getByText(/your turn — do it on the screen/i)).toBeTruthy();
    expect(screen.queryByText(/^next$/i)).toBeNull();
  });

  it('advances when the store says the real thing happened', async () => {
    vi.useFakeTimers();
    openCoach({ steps: twoSteps, questId: 'test' });
    render(<CoachMarks />);
    // The real event lands first (which re-renders and arms the step's timer),
    // then time passes. Doing both inside one act() would run the timer before
    // the effect that schedules it.
    await act(async () => { setState({ doneByDate: { [todayKey()]: ['x1'] } }); });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(getState().coach.i).toBe(1);
    vi.useRealTimers();
  });
});

describe('the pause never counts as finishing', () => {
  it('closes the coach and records nothing', () => {
    openCoach({ steps: [{ target: null, title: 'A', body: 'b', complete: true }], questId: 'tick' });
    closeCoach();
    expect(getState().coach).toBeNull();
    expect(questDone('tick')).toBe(false);
  });

  it('renders a visible way out on every controlled step', () => {
    openCoach({ steps: [{ target: null, mode: 'do', title: 'A', body: 'b', advanceOn: () => false }], questId: 'tick' });
    render(<CoachMarks />);
    const pause = screen.getByLabelText(/pause the guide/i);
    expect(pause).toBeTruthy();
    fireEvent.click(pause);
    expect(getState().coach).toBeNull();
    expect(questDone('tick')).toBe(false);
  });

  it('remembers where the quest was, so coming back resumes it', () => {
    openCoach({ steps: [{ title: 'A', body: 'b' }, { title: 'B', body: 'b' }], questId: 'add', i: 1 });
    closeCoach();
    const r = JSON.parse(localStorage.getItem(LS('guideResume')) || 'null');
    expect(r).toEqual({ questId: 'add', i: 1 });
  });
});

describe('quest completion', () => {
  it('is recorded when the last step is passed, not before', () => {
    openCoach({ steps: [{ title: 'A', body: 'b' }, { title: 'B', body: 'b', complete: true }], questId: 'tick' });
    advanceCoach();
    expect(questDone('tick')).toBe(false);
    advanceCoach();
    expect(questDone('tick')).toBe(true);
    expect(getState().coach).toBeNull();
  });

  it('survives a reload', () => {
    recordQuest('tick');
    const raw = JSON.parse(localStorage.getItem(LS('guide')));
    expect(raw.q.tick).toBeGreaterThan(0);
  });

  it('never un-ticks on replay', () => {
    recordQuest('tick');
    const first = getState().guide.q.tick;
    recordQuest('tick');
    expect(getState().guide.q.tick).toBe(first);
    expect(questCount()).toBe(1);
  });

  it('knows when all eight are done', () => {
    expect(allDone(getState())).toBe(false);
    QUEST_IDS.forEach(recordQuest);
    expect(doneCountOf(getState())).toBe(8);
    expect(allDone(getState())).toBe(true);
    expect(firstIncomplete(getState())).toBeNull();
  });
});

describe('the eight quests', () => {
  it('are eight, each with a title, a blurb and at least one step', () => {
    expect(QUESTS).toHaveLength(8);
    for (const q of QUESTS) {
      expect(q.title).toBeTruthy();
      expect(q.blurb).toBeTruthy();
      const steps = q.build(getState());
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      for (const s of steps) {
        expect(s.title).toBeTruthy();
        expect(s.body).toBeTruthy();
        if (s.mode === 'do') expect(typeof s.advanceOn).toBe('function');
      }
      // exactly one step closes the quest
      expect(steps.filter((s) => s.complete)).toHaveLength(1);
      expect(steps[steps.length - 1].complete).toBe(true);
    }
  });

  it('never promises an alarm, a notification or the lock screen', () => {
    const words = /\balarm\b|\bnotification|\block screen\b|\bpush notification\b/i;
    for (const q of QUESTS) {
      for (const s of q.build(getState())) {
        const body = typeof s.body === 'function' ? s.body(getState()) : s.body;
        const title = typeof s.title === 'function' ? s.title(getState()) : s.title;
        // "set your phone's own alarm as well" is the one honest use — it is
        // telling the user to leave the app, not promising the app will ring.
        const text = String(title) + ' ' + String(body);
        if (words.test(text)) expect(text).toMatch(/your phone’s own alarm|your phone's own alarm/);
      }
    }
  });

  it('starts a quest at its first step and closes the journal on the way', () => {
    openJournal();
    startQuest('tick');
    expect(getState().journalOpen).toBe(false);
    expect(getState().coach.questId).toBe('tick');
    expect(getState().coach.i).toBe(0);
  });

  it('can resume a quest part-way through', () => {
    startQuest('tomorrow', 2);
    expect(getState().coach.i).toBe(2);
  });
});

describe('quest predicates read the real store', () => {
  it('quest 1 completes only when something was actually ticked today', () => {
    const steps = QUESTS[0].build(getState());
    expect(steps[0].advanceOn(getState())).toBe(false);
    setState({ doneByDate: { [todayKey()]: ['a'] } });
    expect(steps[0].advanceOn(getState())).toBe(true);
  });

  it('quest 2 ignores the example cards — only a REAL add counts', () => {
    setState({ deckItems: [{ id: 'd1', example: true }] });
    const steps = QUESTS[1].build(getState());
    setState({ deckItems: [{ id: 'd1', example: true }, { id: 'd2', example: true }] });
    expect(steps[1].advanceOn(getState())).toBe(false);
    setState({ deckItems: [{ id: 'd1', example: true }, { id: 'u1', title: 'mine' }] });
    expect(steps[1].advanceOn(getState())).toBe(true);
  });

  it('quest 4 uses the store’s own unpadded date key for tomorrow', () => {
    const tk = tomorrowKey();
    expect(tk).toMatch(/^\d{4}-\d{1,2}-\d{1,2}$/);
    expect(tk.includes('-0')).toBe(tk.split('-').some((p) => p.length === 2 && p[0] === '0' && p !== tk.split('-')[0]) ? true : false);
    const steps = QUESTS[3].build(getState());
    setState({ screen: 'calendar', calSelKey: tk });
    expect(steps[1].advanceOn(getState())).toBe(true);
    // the way home is "no viewDate", which is how backToToday leaves the store
    setState({ screen: 'stack', viewDate: null });
    expect(steps[3].advanceOn(getState())).toBe(true);
  });

  it('quest 6 waits for the AI round trip to actually reach the preview', () => {
    const steps = QUESTS[5].build(getState());
    setAiStep(2);
    expect(steps[1].advanceOn(getState())).toBe(false);
    setAiStep(3);
    expect(steps[1].advanceOn(getState())).toBe(true);
  });

  it('quest 8 completes on any look change, not one particular one', () => {
    const steps = QUESTS[7].build(getState());
    expect(steps[0].advanceOn(getState())).toBe(false);
    setState({ a11y: { on: true, zoom: 1 } });
    expect(steps[0].advanceOn(getState())).toBe(true);
  });
});

// ── the hint engine ──────────────────────────────────────────────────────

describe('the hint engine', () => {
  it('drops a second hint WITHOUT burning its flag', () => {
    expect(maybeHint('done-vanish')).toBe(true);
    expect(hintCount('done-vanish')).toBe(1);
    // something else asks while the first is up
    expect(maybeHint('bell')).toBe(false);
    expect(hintCount('bell')).toBe(0);        // still armed for its next chance
  });

  it('holds a 20 second cooldown between ordinary hints', () => {
    expect(maybeHint('done-vanish')).toBe(true);
    clearHint();
    expect(maybeHint('bell')).toBe(false);
    expect(hintCount('bell')).toBe(0);
  });

  it('lets an exempt hint answer the tap that caused it, immediately', () => {
    expect(maybeHint('done-vanish')).toBe(true);
    clearHint();
    expect(maybeHint('select-circle')).toBe(true);   // exempt — skips the cooldown
  });

  it('respects the lifetime cap', () => {
    expect(maybeHint('done-vanish')).toBe(true);
    clearHint(); resetHintEngine();
    expect(maybeHint('done-vanish')).toBe(false);
  });

  it('gives the two-life hints a second life', () => {
    expect(HINTS['today-chip'].cap).toBe(2);
    expect(HINTS['reminder-truth'].cap).toBe(2);
    maybeHint('today-chip'); clearHint(); resetHintEngine();
    expect(maybeHint('today-chip')).toBe(true);
    clearHint(); resetHintEngine();
    expect(maybeHint('today-chip')).toBe(false);
  });

  it('never fires over a sheet, the coach, the journal or a drag', () => {
    setState({ addOpen: true });
    expect(maybeHint('done-vanish')).toBe(false);
    reset({ coach: { steps: [{ title: 'a', body: 'b' }], i: 0 } });
    expect(maybeHint('done-vanish')).toBe(false);
    reset({ journalOpen: true });
    expect(maybeHint('done-vanish')).toBe(false);
    reset(); setDragging(true);
    expect(maybeHint('done-vanish')).toBe(false);
    setDragging(false);
  });

  it('lets a sheet-anchored hint fire with its own sheet open', () => {
    setState({ addOpen: true });
    expect(maybeHint('add-intro')).toBe(true);
  });

  it('goes completely quiet when hints are switched off', () => {
    setHintsOff(true);
    expect(maybeHint('done-vanish')).toBe(false);
    expect(hintCount('done-vanish')).toBe(0);
  });

  it('never routes the inline paste error through the bubble', () => {
    expect(HINTS['link-failed'].inline).toBe(true);
    expect(HINTS['link-failed'].cap).toBe(Infinity);
    expect(maybeHint('link-failed')).toBe(false);
  });

  it('offers the matching quest, and stops offering it once it is done', () => {
    expect(hintQuestOffer('done-vanish').quest).toBe('tick');
    recordQuest('tick');
    expect(hintQuestOffer('done-vanish')).toBeNull();
  });

  it('stops offering quests once the whole guide has retired', () => {
    guideDone();
    expect(guideFinished()).toBe(true);
    expect(hintQuestOffer('reminder-truth')).toBeNull();
  });
});

// ── the flags around the edges ───────────────────────────────────────────

describe('the small persistent flags', () => {
  it('counts a day of use once, however many times the app boots', () => {
    expect(recordUseDay()).toBe(1);
    expect(recordUseDay()).toBe(1);
    expect(useDayCount()).toBe(1);
  });

  it('remembers the first Library visit', () => {
    expect(hasLibSeen()).toBe(false);
    markLibSeen();
    expect(hasLibSeen()).toBe(true);
  });

  it('remembers the thing the user just added', () => {
    noteAdded('u123');
    expect(getState().lastAddedId).toBe('u123');
  });

  it('knows when a layer owns the screen', () => {
    expect(anySheetOpen(getState())).toBe(false);
    setState({ addOpen: true });
    expect(anySheetOpen(getState())).toBe(true);
  });
});

describe('the migration', () => {
  it('skips the welcome for someone who met the old tour — and nothing else', async () => {
    localStorage.clear();
    localStorage.setItem(LS('tourSeen'), '1');
    vi.resetModules();
    const fresh = await import('./store5.js?migration-tour');
    expect(fresh.guideWelcomed()).toBe(true);
    expect(fresh.questCount()).toBe(0);          // every quest still to do
    expect(fresh.getState().hintsOff).toBe(false); // every hint still armed
  });

  it('skips the welcome for someone already onboarded', async () => {
    localStorage.clear();
    localStorage.setItem(LS('onboarded'), '1');
    vi.resetModules();
    const fresh = await import('./store5.js?migration-onboarded');
    expect(fresh.guideWelcomed()).toBe(true);
    expect(fresh.questCount()).toBe(0);
  });

  it('does NOT skip the welcome for a genuinely new device', async () => {
    localStorage.clear();
    vi.resetModules();
    const fresh = await import('./store5.js?migration-new');
    expect(fresh.guideWelcomed()).toBe(false);
  });
});
