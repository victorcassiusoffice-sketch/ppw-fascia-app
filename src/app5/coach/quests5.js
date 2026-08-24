// quests5 — "Your Guide": eight one-minute quests.
//
// The app's own metaphor is "your day is a stack of things you tick off", so
// the tutorial is one more stack of things you tick off. Each quest is a guided
// do-it-yourself mini-tour on the REAL UI: the spotlight hole is genuinely
// tappable, and a `do` step advances only when the real store event fires. The
// user learns the app by using the app.
//
// Every quest is playable in any order, stoppable at any time (the ✕ pause in
// the bubble), and replayable forever from Settings. None of it is Premium.
//
// STEP SHAPE (see CoachMarks.jsx):
//   { target, title, body, mode:'do'|undefined, before, advanceOn, dormantWhen,
//     buttons, complete }
//   `complete: true` on the LAST step — advanceCoach() records the quest when it
//   moves past it, so completion is recorded in one place instead of eight.
//
// BASELINES. A `do` step asks "did the thing change?", which needs a before
// picture. Each quest is BUILT at the moment it starts (`build(S)`), capturing
// the counts and values it will compare against. That is why QUESTS holds
// builders rather than plain arrays.

import {
  getState, todayKey, tomorrowKey, openCoach, closeJournal, clearExamples,
  goLibrary, openAiBridge, setState, closeAdd, onlyExamplesLeft,
} from '../store5.js';

// ── small helpers ────────────────────────────────────────────────────────
const doneCount = (S) => ((S.doneByDate || {})[todayKey()] || []).length;
const realItems = (S) => (S.deckItems || []).filter((x) => x.example !== true);
const byId = (S, id) => (S.deckItems || []).find((x) => x.id === id) || null;

/**
 * The row a "your new thing" step should point at: whatever the user just
 * added, if it is still there — otherwise the hero card, so the step always has
 * something real to talk about.
 */
export function focusItem(S) {
  const s = S || getState();
  return (s.lastAddedId && byId(s, s.lastAddedId)) || null;
}

// ── the eight ────────────────────────────────────────────────────────────

export const QUESTS = [
  {
    id: 'tick',
    title: 'Tick one off',
    blurb: 'The whole loop: do it, tick it, done.',
    build(S0) {
      const base = doneCount(S0);
      return [
        {
          target: 'next-up',
          mode: 'do',
          before: () => setState({ screen: 'stack', viewDate: null }),
          title: 'Do the thing, then tick it.',
          body: 'The top card is your next thing. Tap the round tick on the card to mark it done.',
          advanceOn: (S) => doneCount(S) > base,
        },
        {
          target: 'completed-disc',
          mode: 'do',
          title: 'Done things do not disappear.',
          body: 'They move in here. The little number is today’s count. Tap the tick to see everything you have finished.',
          advanceOn: (S) => S.completedOpen === true,
        },
        {
          target: null,
          title: 'That is the whole loop.',
          body: 'Do, tick, done. Tomorrow morning the stack rebuilds itself, so you never start from a blank page. Quest complete.',
          buttons: [{ label: 'Done' }],
          complete: true,
        },
      ];
    },
  },

  {
    id: 'add',
    title: 'Add your first thing',
    blurb: 'The ＋ button: a link you like, or a note to yourself.',
    build(S0) {
      const baseReal = realItems(S0).length;
      return [
        {
          target: 'add',
          mode: 'do',
          before: () => setState({ screen: 'stack', viewDate: null }),
          title: 'Add something real.',
          body: 'Tap the plus. A link you like, or a note to yourself — either works.',
          advanceOn: (S) => !!S.addOpen,
        },
        {
          target: 'add-link',
          mode: 'do',
          // While the note composer (and the phone keyboard) is up, the coach
          // gets out of the way entirely rather than sitting on top of the
          // thing the user is typing into. It stays armed underneath.
          dormantWhen: (S) => !!S.noteOpen,
          title: 'Paste a link, or write a note.',
          body: 'Paste a YouTube or Spotify link into the box, or tap Text and write one line you want to see today. The Routine, Media and Protocol tiles do not create things — they take you to the Library.',
          advanceOn: (S) => realItems(S).length > baseReal,
        },
        {
          target: 'latest-item',
          // The sheet has to be out of the way for the user to see the row they
          // just made — the step is about the row, not the sheet.
          before: () => closeAdd(),
          title: 'It landed at 9:00, every day.',
          body: 'New things start at 9:00 in the morning, repeating daily. That is rarely what you want. The next quest shows you how to change it. Quest complete.',
          buttons: [{ label: 'Done' }],
          complete: true,
        },
      ];
    },
  },

  {
    id: 'time',
    title: 'Put a time on it',
    blurb: 'The time is secretly a button. So is the rhythm.',
    build(S0) {
      const it = focusItem(S0);
      const id = it ? it.id : null;
      const baseTime = it ? it.time : null;
      const baseRepeat = it ? it.repeat : null;
      // No id means the step points at the hero card instead, and we compare
      // against whatever is on top of the stack at the time.
      const timeOf = (S) => (id ? (byId(S, id) || {}).time : ((S.deckItems || [])[0] || {}).time);
      const repeatOf = (S) => (id ? (byId(S, id) || {}).repeat : ((S.deckItems || [])[0] || {}).repeat);
      const baseHeroTime = timeOf(S0);
      const baseHeroRepeat = repeatOf(S0);
      return [
        {
          target: 'item-time',
          mode: 'do',
          before: () => setState({ screen: 'stack', viewDate: null }),
          title: 'The time is secretly a button.',
          body: 'It does not look like one, but it is. Tap the time on this card and pick when it should pop up.',
          buttons: [{ label: 'Keep 9:00' }],
          advanceOn: (S) => timeOf(S) !== (id ? baseTime : baseHeroTime),
        },
        {
          target: 'item-repeat',
          mode: 'do',
          title: 'And how often.',
          body: 'The small arrows choose the rhythm — every day, weekly, every few days, just once. Tap them and pick one. Quest complete when you have.',
          advanceOn: (S) => repeatOf(S) !== (id ? baseRepeat : baseHeroRepeat),
          complete: true,
        },
      ];
    },
  },

  {
    id: 'tomorrow',
    title: 'Plan tomorrow',
    blurb: 'Every day has its own stack, and a way back.',
    build() {
      const tk = tomorrowKey();
      return [
        {
          target: 'calendar',
          mode: 'do',
          title: 'Every day has its own stack.',
          body: 'Today is just one page of many. Tap Calendar.',
          advanceOn: (S) => S.screen === 'calendar',
        },
        {
          target: 'cal-tomorrow',
          mode: 'do',
          title: 'Open tomorrow.',
          body: 'Tap tomorrow’s date. A dot on any day means that day already has something on it.',
          advanceOn: (S) => S.calSelKey === tk,
        },
        {
          target: 'open-in-stack',
          mode: 'do',
          title: 'You are standing in tomorrow.',
          body: 'Open it in the Stack.',
          advanceOn: (S) => S.screen === 'stack' && S.viewDate === tk,
        },
        {
          target: 'today-chip',
          mode: 'do',
          title: 'And the way back.',
          // Adding something here is a suggestion, never the gate — a quest
          // that will not move until you invent a task for tomorrow morning is
          // a quest people abandon.
          body: 'The whole screen is showing tomorrow now — the small TODAY chip up top is the way back. Add something for the morning if you like. Tap TODAY when you are ready.',
          advanceOn: (S) => S.screen === 'stack' && !S.viewDate,
          complete: true,
        },
      ];
    },
  },

  {
    id: 'library',
    title: 'Look round the Library',
    blurb: 'Media, Protocols, Supps, Routines — and what each shelf is.',
    build(S0) {
      const baseCount = (S0.deckItems || []).length;
      return [
        {
          target: 'lib-tabs',
          // Never land a first-time visitor on the paywall shelf.
          before: () => goLibrary('media'),
          title: 'Everything lives in the Library.',
          body: 'Media is links you have saved. Protocols are step-by-step plans. Supps is a supplement shopping list. Routines are whole saved days — that shelf is part of Premium; everything in this guide is free.',
          buttons: [{ label: 'Next' }],
        },
        {
          target: 'protocol-add',
          mode: 'do',
          before: () => goLibrary('protocols'),
          title: (S) => (S.premiumUpsell ? 'Your free stack is full.' : 'Try a real protocol.'),
          body: (S) => (S.premiumUpsell
            ? 'Your free stack is full — it holds 10 things, and the examples count. Clear the examples first.'
            : 'Myofascial Recovery is free. Add it to today and it joins your stack. In Media, the small tick means add to today and the calendar disc means pick a day. Quest complete.'),
          buttons: (S) => (S.premiumUpsell && onlyExamplesLeft()
            ? [{ label: 'Clear the examples', action: () => { clearExamples(); setState({ premiumUpsell: null }); }, advance: false }]
            : null),
          advanceOn: (S) => (S.deckItems || []).length > baseCount,
          complete: true,
        },
      ];
    },
  },

  {
    id: 'ai',
    title: 'Let your AI plan a day',
    blurb: 'Describe your day to your own AI, paste the reply back.',
    build(S0) {
      const baseCount = (S0.deckItems || []).length;
      return [
        {
          target: null,
          before: () => openAiBridge(),
          title: 'The biggest trick in the app.',
          body: 'You describe your day to the AI you already use — ChatGPT, Claude or Gemini — and paste its reply back here. The app turns the reply into a planned day. Free, and we never see your chat.',
          buttons: [{ label: 'Next' }],
        },
        {
          target: 'ai-copy',
          mode: 'do',
          title: 'Copy, ask, come back.',
          body: 'Copy this prompt, open your AI wherever you normally use it, and paste in what it writes back. Bring the whole reply — do not trim it, the app reads through the messy bits.',
          // The user genuinely leaves the app here. The quest's place is
          // written to disk when the coach is paused, so coming back an hour
          // later picks up where they left off. There is no failure state: a
          // reply the parser cannot read is handled by the bridge's own help.
          advanceOn: (S) => S.aiStep >= 3,
        },
        {
          target: 'ai-preview',
          mode: 'do',
          title: 'You approve everything.',
          body: 'Untick anything you do not want, then apply. One tap of Undo removes the lot if it went wrong. Quest complete.',
          advanceOn: (S) => (S.deckItems || []).length > baseCount,
          complete: true,
        },
      ];
    },
  },

  {
    id: 'reminders',
    title: 'The truth about reminders',
    blurb: 'What the app can and cannot do when it is closed.',
    build() {
      return [
        {
          target: 'set-reminders',
          before: () => setState({ screen: 'settings' }),
          title: 'Reminders, honestly.',
          body: 'The app can only nudge you while it is open on screen. Nothing rings when your phone is locked or the app is closed. We would rather tell you that plainly than let you miss something that matters. For must-not-slip things, set your phone’s own alarm as well.',
          buttons: [{ label: 'Next' }],
        },
        {
          target: 'set-install',
          title: 'Keep it one tap away.',
          body: 'Install the app to your home screen so it opens instantly, full screen, like any other app. On iPhone: Share, then Add to Home Screen.',
          // No fake detection: on iOS there is no install event to listen for,
          // so the honest option is to say what to do and let the user tell us.
          buttons: (S) => (canInstallNatively()
            ? [{ label: 'Install now', action: () => promptInstall() }, { label: 'I will do it later' }]
            : [{ label: 'I have done it' }, { label: 'I will do it later' }]),
        },
        {
          target: 'set-sounds',
          title: 'Sounds help too.',
          body: 'With sounds on, the app clicks and chimes while you use it. Quiet by design — nothing plays when the app is closed. Quest complete.',
          buttons: [{ label: 'Done' }],
          complete: true,
        },
      ];
    },
  },

  {
    id: 'yours',
    title: 'Make it yours',
    blurb: 'Colourway, text size, easy read.',
    build(S0) {
      const sig = (S) => [S.soft, S.skin, S.bg, S.gelBg, S.glassStyle, S.inkMode, S.a11y && S.a11y.on, S.a11y && S.a11y.zoom].join('|');
      const base = sig(S0);
      return [
        {
          target: 'set-theme',
          mode: 'do',
          before: () => setState({ screen: 'settings' }),
          title: 'Pick your look.',
          body: 'Try a colourway, set the text size, or switch Easy read on for bigger, calmer type. This quest completes the moment you change any one of them.',
          advanceOn: (S) => sig(S) !== base,
          complete: true,
        },
      ];
    },
  },
];

// ── the finale ───────────────────────────────────────────────────────────

export const FINALE_STEPS = [
  {
    target: null,
    title: 'Guide complete.',
    body: 'You have used everything that matters — the stack, adding, times, other days, the Library, your AI, honest reminders and your own look. The guide moves to Settings now; every quest can be replayed there whenever you want. Tomorrow morning your stack rebuilds itself. See you then.',
    buttons: [{ label: 'Done' }],
  },
];

// ── install helpers (no fake detection) ──────────────────────────────────
// The beforeinstallprompt event only exists on Chromium. Everywhere else the
// honest answer is instructions plus the user's own word for it.
let _deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); _deferredPrompt = e; });
  window.addEventListener('appinstalled', () => { _deferredPrompt = null; });
}
export function canInstallNatively() { return !!_deferredPrompt; }
export function promptInstall() {
  if (!_deferredPrompt) return false;
  try { _deferredPrompt.prompt(); } catch {}
  _deferredPrompt = null;
  return true;
}
export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch { return false; }
}

// ── lookups the journal + disc use ───────────────────────────────────────

export const QUEST_IDS = QUESTS.map((q) => q.id);
export function questDef(id) { return QUESTS.find((q) => q.id === id) || null; }
export function questIndex(id) { return QUEST_IDS.indexOf(id); }

/** How many of the eight this device has finished. */
export function doneCountOf(S) {
  const q = (S && S.guide && S.guide.q) || {};
  return QUEST_IDS.filter((id) => !!q[id]).length;
}
/** All eight finished? */
export function allDone(S) { return doneCountOf(S || getState()) >= QUEST_IDS.length; }
/** The first quest still to do, for the disc's "carry on" tap. */
export function firstIncomplete(S) {
  const s = S || getState();
  const q = (s.guide && s.guide.q) || {};
  return QUEST_IDS.find((id) => !q[id]) || null;
}

/**
 * Start (or replay) a quest. Builds the steps fresh so every `do` predicate
 * compares against the state as it is RIGHT NOW, then hands the screen to the
 * controlled coach.
 */
export function startQuest(id, startIndex = 0) {
  const def = questDef(id);
  if (!def) return false;
  const steps = def.build(getState());
  if (!steps || !steps.length) return false;
  closeJournal();
  const i = Math.max(0, Math.min(startIndex, steps.length - 1));
  return openCoach({ steps, questId: id, i });
}

/** The finale, shown once when the eighth quest lands. */
export function startFinale() {
  return openCoach({ steps: FINALE_STEPS, questId: '__finale__', i: 0 });
}
