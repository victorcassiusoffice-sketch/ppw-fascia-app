// hints5 — the one-shot contextual hint engine.
//
// The eight quests teach anyone who opens the guide. This catches everyone who
// does not: each trap in the app gets ONE quiet bubble, at the exact moment the
// user walks into it, and then never again.
//
// The engine laws below are the whole design. They exist because a tip system
// with no discipline becomes the thing users learn to dismiss without reading:
//
//  1. DEPTH-1 QUEUE. If a hint is already showing, a second request is dropped
//     — and its flag is NOT burned. It waits for its next natural trigger,
//     rather than being spent on a moment nobody saw.
//  2. COOLDOWN. 20 seconds between hints, so two traps in a row do not become a
//     lecture. The EXEMPT class skips the cooldown, because those hints answer
//     a tap the user just made and would be nonsense arriving later.
//  3. CAPS. Count-based, default 1. A couple of hints earn a second life.
//  4. NEVER OVER ANYTHING. No hint while a sheet, the player, the coach, the
//     journal or the lock screen owns the screen. Hints whose anchor lives
//     INSIDE a sheet are marked `inSheet` and may fire with their own sheet up.
//  5. ONE TAP ANYWHERE dismisses. Auto-dismiss at 8s (6s for exempt).
//  6. A hint whose topic has an unfinished quest offers it, in one line.
//  7. Settings can mute the lot.

import {
  getState, setHint, clearHint, hintCount, burnHint, anySheetOpen, questDone,
} from '../store5.js';
import { isLocked } from '../passcode.js';

// ── registry ─────────────────────────────────────────────────────────────
// anchor  = a [data-tour] key, or null for a centred bubble
// cap     = lifetime firings (Infinity for stateless errors)
// exempt  = skips the cooldown (it answers the user's own tap)
// inSheet = may fire while its own sheet is open
// quest   = the quest id this hint's topic belongs to; adds the offer line
// inline  = rendered by its own screen, NOT by HintBubble (errors are not tips)

export const HINTS = {
  'guide-pulse': {
    anchor: 'guide', cap: 1, pulseOnly: true,
    copy: null,
  },
  'done-vanish': {
    anchor: 'completed-disc', cap: 1, quest: 'tick',
    title: 'Done, not gone.',
    copy: 'Ticked things move in here. Tap the badge any time to see everything you have finished today.',
  },
  'select-circle': {
    anchor: 'select-circle', cap: 1, exempt: true,
    title: 'That circle is for choosing, not finishing.',
    copy: 'It selects cards so you can delete a few at once. To finish something, use the tick on the card itself.',
  },
  'auto-box': {
    anchor: 'auto-box', cap: 1, exempt: true,
    title: 'AUTO plays it for you.',
    copy: 'When this card’s time arrives and the app is open on screen, it starts playing on its own.',
  },
  'link-defaults': {
    anchor: 'latest-item', cap: 1, quest: 'time',
    title: 'Added for 9:00, every day.',
    copy: 'Those are just the starting settings. Tap the time on the card to change when, or the small arrows to change how often.',
  },
  'link-failed': {
    // Stateless, uncapped, and NOT a bubble — an error must never be one-shot,
    // and must appear where the mistake was made. AddSheet renders this inline.
    anchor: null, cap: Infinity, exempt: true, inline: true,
    title: null,
    copy: 'That did not look like something we can add. YouTube, Spotify and most share links work. Plain web pages do too.',
  },
  'add-intro': {
    anchor: 'add-header', cap: 1, inSheet: true, quest: 'add',
    title: 'Two ways to fill your day.',
    copy: 'Talk to your AI writes a whole day for you. Or add things yourself — a note, a link, a document. The Routine, Media and Protocol tiles take you to the Library to pick from; they do not create anything here.',
  },
  'reorder': {
    anchor: null, cap: 1, ghost: true,
    title: 'Times stay where they are.',
    copy: 'Dragging swaps the things between time slots — the slots themselves never move.',
  },
  'bell': {
    anchor: 'set-reminders', cap: 1,
    title: 'The bell brings you here.',
    copy: 'Reminders live in Settings.',
  },
  'today-chip': {
    anchor: 'today-chip', cap: 2, quest: 'tomorrow',
    title: 'You are looking at another day now.',
    copy: null, // built from the viewed date — see hintCopy()
  },
  'reminder-truth': {
    anchor: 'set-reminders', cap: 2, quest: 'reminders',
    title: 'About reminders — the honest version.',
    copy: 'The app can only nudge you while it is open on screen. Closed or locked, it stays quiet. For the few things that must not slip, set your phone’s own alarm as well.',
  },
  'routines-paywall': {
    anchor: 'routines-lock', cap: 1,
    title: 'Routines are the one paid thing here.',
    copy: 'A routine is a whole saved day you can reuse — Premium, $9.99 a month. The rest of the app is free. Nothing to decide now.',
  },
  'supps-intro': {
    anchor: 'supps-top', cap: 1,
    title: 'A shopping list, not a commitment.',
    copy: 'These are supplement sets grouped by protocol. Tick what you want. Buying happens on iHerb, not here — the first item opens the basket there, and the rest follow it in.',
  },
  'free-cap': {
    // NOT a bubble. The refusal already puts a modal on the screen, and a
    // guidance layer cannot open over one (nor should it — two panels arguing
    // about the same refusal). This copy lives in UpsellModal, at the exact
    // point the add was turned down, with its own [Clear the examples].
    anchor: null, cap: Infinity, inline: true,
    title: 'You have hit the free limit.',
    copy: 'Free keeps up to 10 things, and the example cards count. Clearing them frees their slots. Premium removes the limit.',
  },
  'install-nudge': {
    anchor: null, cap: 3,
    buttons: [
      { label: 'Show me how', action: 'settings-install' },
      // "Maybe later" has to mean later, not "in four seconds when you come
      // back to the Stack" — otherwise all three lives burn in one sitting and
      // the nudge becomes the nagging it was written to avoid.
      { label: 'Maybe later', action: 'snooze-install' },
    ],
    title: 'Put it on your home screen.',
    copy: 'Installed, the app opens full screen, loads faster, and is easier to keep open for its nudges. It takes about ten seconds.',
  },
};

export const EXEMPT = Object.keys(HINTS).filter((k) => HINTS[k].exempt);

// ── engine ───────────────────────────────────────────────────────────────

const COOLDOWN_MS = 20000;
let _lastShownAt = 0;
let _dragging = false;

/** The Stack screen tells the engine while a hold-drag is in flight. */
export function setDragging(on) { _dragging = !!on; }

/** Body text that depends on live state. */
export function hintCopy(id, S) {
  const h = HINTS[id];
  if (!h) return null;
  if (id === 'today-chip') {
    const k = (S && S.viewDate) || null;
    let label = 'another day';
    if (k) {
      const p = String(k).split('-');
      const d = new Date(+p[0], +p[1] - 1, +p[2]);
      label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    return 'The stack is showing ' + label + '. Tap TODAY to come back to the present.';
  }
  return h.copy;
}

/** Is the screen clear enough for a hint of this kind? */
function screenIsClear(h, S) {
  if (S.coach || S.journalOpen) return false;
  if (S.playerItem) return false;
  if (_dragging) return false;
  // The lock screen is not store state, so it has to be asked directly. Without
  // this a slot banner behind the keypad could burn a life of the reminders
  // hint — the most important one in the set — where nobody could read it.
  try { if (isLocked()) return false; } catch { /* passcode off */ }
  if (h.inSheet) {
    // Its own sheet may be up — but nothing else may be.
    return !(S.aiOpen || S.termsOpen || S.accountOpen || S.completedOpen || S.premiumUpsell || !S.onboarded);
  }
  return !anySheetOpen(S);
}

/**
 * Ask for a hint. Returns true only if it actually went on screen.
 *
 * Everything that can refuse a hint refuses it BEFORE the flag is burned, so a
 * hint never gets spent on a moment the user could not see.
 */
export function maybeHint(id) {
  const h = HINTS[id];
  if (!h || h.inline) return false;             // inline errors are not routed here
  const S = getState();
  if (S.hintsOff) return false;
  if (hintCount(id) >= h.cap) return false;
  if (S.hint) return false;                     // law 1 — depth-1, drop, do not burn
  if (!screenIsClear(h, S)) return false;
  const now = Date.now();
  if (!h.exempt && _lastShownAt && now - _lastShownAt < COOLDOWN_MS) return false;  // law 2
  _lastShownAt = now;
  burnHint(id);
  setHint(id);
  return true;
}

/** How long this hint sits there before dismissing itself. */
export function hintDwell(id) { return HINTS[id] && HINTS[id].exempt ? 6000 : 8000; }

/** The one-line quest offer, or null. */
export function hintQuestOffer(id) {
  const h = HINTS[id];
  if (!h || !h.quest) return null;
  if (questDone(h.quest)) return null;
  if (getState().guide && getState().guide.done) return null;   // the guide has retired
  return { quest: h.quest, label: 'There is a one-minute quest on this in your guide.' };
}

export function dismissHint() { clearHint(); }

// "Maybe later" parks the install nudge for a week. Stored rather than held in
// memory because the whole point is that it survives closing the app.
const SNOOZE_KEY = 'ppw5.installSnoozeUntil';
export function snoozeInstall(days = 7) {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86400000)); } catch {}
}
export function installSnoozed() {
  try { return +(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; }
}

/** Test seam — the cooldown is module state, not store state. */
export function resetHintEngine() { _lastShownAt = 0; _dragging = false; }
