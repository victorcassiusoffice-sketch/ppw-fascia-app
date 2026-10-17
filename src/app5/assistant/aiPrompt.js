// aiPrompt — the prompt the user pastes into THEIR OWN AI.
//
// PPW pays nothing: the user's ChatGPT / Claude / Gemini does the thinking, and
// the reply comes back as a ```ppw-routine block the app imports.
//
// The intake is deliberately OPEN (Vic 2026-08-31): instead of a rigid
// 5-question form, STEP 1 invites the user to say ANYTHING, in ANY order, as
// vaguely as they like — and STEP 2 tasks the AI with making sense of the mess
// and structuring it into stacks. Only the OUTPUT half (STEP 3 + the block +
// the FORMAT RULES) is strict, because the parser reads it literally.
//
// v5 adds the one thing the open intake lost: a plan cannot be timed sensibly
// without knowing when the person sleeps and when they work. STEP 2 now names
// three things the AI must establish first — sleep, work hours, and whatever is
// already fixed by someone else — asked as sentences, not as a form, so the open
// feel survives. (store5.js:133 declares dayT.ws/we for work hours; no screen has
// ever written them, so asking is the only way to learn them today.)
//
// v6 (Vic, 2026-10-17): "take the feedback on ALL the stacks and organise them,
// and find videos that go with each stack." Two changes, both in the contract:
//   • ORGANISE. The "redo my day" mode no longer throws the day away and
//     starts again. Every stack the AI is shown carries a short ref (s1, s2 …);
//     the AI opens by asking how each one is going, and sends the WHOLE list
//     back with the ref kept on everything it keeps or changes. The app diffs
//     that against the real stacks (planDiff.js) and shows each change for the
//     user to approve — a stack keeps its id, its video, its history.
//   • VIDEOS. Each stack may carry up to three video SUGGESTIONS. They are
//     checked against YouTube (verifyVideo.js) and offered to the user to pick
//     from; nothing is attached on its own any more.
//
// Two rules drive that output wording, both learned from testing the parser
// against real AI output:
//   • The four repeat tokens are shown as a copy-me list — "every day" was
//     silently becoming a one-off.
//   • Times must be shown padded ("07:30"), because "7am"/"7:30" drift.
// URLs are BANNED outright: models fabricate 11-char YouTube ids. As of v4 that
// ban is genuinely enforced — parsePlanDoc drops url/embed/thumbUrl rather than
// trusting safeUrl, which only ever checked the scheme, so an invented https
// embed used to reach a live iframe.

import { FREE_STACK_CAP } from '../store5.js';

// How much of the existing day the AI is allowed to see. The user picks this in
// the sheet before the prompt is built, and that choice IS the consent — nothing
// is echoed unless they asked for it.
//   FRESH   nothing echoed. The day is empty, or they never asked.
//   AROUND  echoed as fixed. "Keep all of it, fit new things around it."
//   REBUILD echoed WITH REFS, for organising. "Here is how each one is going —
//           change, move, drop and add." (The key keeps its old name so stored
//           state and tests that name it stay valid; the behaviour is the
//           organise flow described in the header.)
export const PLAN_MODE = { FRESH: 'fresh', AROUND: 'around', REBUILD: 'rebuild' };

// Redaction is by KIND, never by wording. A note's title IS the user's private
// affirmation and a document's title is a filename, so neither is ever sent —
// only the fact that the slot is taken. Doing it by kind means a future kind
// (a medication) is excluded the day it exists, not the day someone remembers
// to update a sentence.
const PRIVATE_KINDS = { note: 'a note to myself', doc: 'a document', med: 'something I take' };
export const isPrivateKind = (it) => !!(it && PRIVATE_KINDS[it.kind]);
/** The stacks an organise pass is allowed to change. Private ones are pinned. */
export const replaceableItems = (items) => (Array.isArray(items) ? items : []).filter((it) => !isPrivateKind(it));

const REPEAT_WORD = { daily: 'every day', weekly: 'weekly', once: 'once' };
const repeatWord = (r) => REPEAT_WORD[r] || (r ? `every ${r} days` : 'once');
const byTime = (a, b) => String(a.time || '99:99').localeCompare(String(b.time || '99:99'))
  || String(a.title || '').localeCompare(String(b.title || ''));
const titleOf = (it) => String(it.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
const planLine = (it) => `  ${it.time || 'anytime'}  ${PRIVATE_KINDS[it.kind] || titleOf(it)}  ·  ${repeatWord(it.repeat)}`;
const hasMedia = (it) => !!(it && (it.url || it.embed));

/**
 * The refs an organise prompt hands out: s1, s2 … in the order the AI sees the
 * stacks (by time). The same function builds the prompt and reads the reply, so
 * the two can only disagree if the Stack itself changed in between — which is
 * why the sheet also REMEMBERS the map it sent (store5 setAiRefs) and prefers
 * that over a recomputation.
 * → { map: { s1: id, … }, list: [{ ref, it }] }
 */
export function refMapFor(items) {
  const list = replaceableItems(items).slice(0, 40).sort(byTime).map((it, i) => ({ ref: 's' + (i + 1), it }));
  const map = {};
  for (const { ref, it } of list) map[ref] = it.id;
  return { map, list };
}

// Mirrors the shipped defaults in store5.js (:129-133). Kept here so buildPrompt
// can tell "the user chose this" apart from "nobody has ever set it".
const DEFAULT_WAKE = '07:00';
const DEFAULT_BED = '22:30';
const DEFAULT_BODY = ['Stress'];
const DEFAULT_INTERESTS = ['Meditation'];
const isDefaultList = (a, d) => a.length === d.length && a.every((v, i) => v === d[i]);

export const PROMPT_VERSION = 6;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "Saturday 17 October" — built by hand so it is English on every phone. */
export function todayWords(now) {
  const d = now instanceof Date ? now : new Date();
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

// STEP 1 when there is nothing to organise: an open door.
const STEP1_OPEN = `STEP 1 — Open the conversation, then STOP and wait for my reply. In ONE short,
friendly message, invite me to tell you anything at all — something like:

"Tell me whatever's on your mind about your days — what you'd like to change, what
you already do, your goals, your rough timings, the lot. Any order, as much or as
little as you like, and it's completely fine to be vague or all over the place.
I'll make sense of it and turn it into a simple plan."

Do NOT ask a numbered questionnaire. Do NOT write any plan yet. Just open the door
and let me talk.`;

// STEP 1 when organising: the user's feedback on each stack IS the intake.
const STEP1_ORGANISE = `STEP 1 — Start by showing me my stacks from the list above as a short, friendly
list, in plain words (not the refs), and ask how each one is going: what I enjoy,
what I keep skipping, what I would change, and anything I would like to add. Then
STOP and wait for my reply.

Do NOT ask a numbered questionnaire. Do NOT write any plan yet. Let me talk about
them in any order, as much or as little as I like.`;

const STEP2_AND_FORMAT = `STEP 2 — Take whatever I give you — however scattered, vague, or out of order — and
quietly turn it into a realistic plan. Read between the lines: pull out the
activities I mention, put sensible times on them, and decide how often each should
repeat. Fill small gaps yourself with reasonable defaults instead of interrogating
me. Start small. Use my own words for the names. Stay inside the item and day
limits I gave you above.

Before you write the plan, make sure you know these three things. Ask only for the
ones I have not already told you, in ONE short message, as ordinary sentences —
never as a numbered form:
  - when I usually wake up and go to bed;
  - what hours I work, and which days;
  - anything already fixed by someone else: a shift, the school run, a class, an
    appointment, or something I have to take at a set time.
Then build everything around those. Nothing lands while I am asleep or at work
unless I told you it could, and anything that needs to sit with a meal goes inside
the hours I actually eat.

STEP 3 — Reply with a short plain-English summary (5 lines max), then ONE code
block, and NOTHING after it. Do not repeat this example back to me. Do not add
a second block.

\`\`\`ppw-routine
{"ppw":"routine","v":3,"name":"My week","items":[
{"title":"Morning walk","meta":"20 min, outside","time":"07:30","dayOffset":0,"repeat":"daily"},
{"title":"Box breathing","meta":"5 min","time":"13:00","dayOffset":0,"repeat":"daily","videos":[{"q":"box breathing 5 minutes guided"}]},
{"title":"Long session","meta":"45 min","time":"18:00","dayOffset":1,"repeat":"weekly"},
{"title":"I did enough today.","kind":"note","time":"21:30","dayOffset":0,"repeat":"daily"}
]}
\`\`\`

FORMAT RULES — the app reads this block literally.
- Valid JSON. Straight quotes only ("). No smart quotes, no trailing commas,
  no comments, no line breaks inside a value.
- Allowed keys per item, nothing else: ref, title, meta, time, dayOffset, repeat, kind, videos.
- Every item MUST have a title. Never send a bare string in the list.
- ref: ONLY when I gave you a list of my stacks with refs (s1, s2 …). Copy the ref
  exactly onto every stack from that list that you keep or change. Never invent a
  ref, and never give a new stack one.
- title: under 120 characters. meta: optional one-line detail.
- time: exactly five characters, "HH:MM", 24-hour, leading zero.
  Write "07:30" — never "7:30", "7am", "7:30 am" or "07:30:00".
  Leave time out entirely if it can happen anytime.
- dayOffset: whole number. 0 = today, 1 = tomorrow. Never a date, never "Day 2".
- repeat: copy ONE of these four exactly —
      "daily"      "weekly"      "once"      "N"   (where N is "2" to "14")
  Write "daily", never "every day". Write "3", never "every 3 days".
  If you are unsure, use "daily".
- kind: only for a short written reminder that should appear on screen —
  set "kind":"note" and put the words in title.
- videos: OPTIONAL, up to 3 per stack, and only where watching something genuinely
  helps — a stretch, a breathing drill, a technique, a workout. Send each as
      {"q":"a youtube search I should run","yt":"11-char-id"}
  Give "q" ALWAYS. Give "yt" ONLY if you are genuinely confident the id is real
  (for example you have just found it with a web search); if you are not certain,
  send "q" on its own. A wrong id is worse than no id.
  I check every id against YouTube before it is shown, I take the title and the
  channel from YouTube rather than from you, and anything that fails the check
  becomes a search instead. They are suggestions: I choose which one, if any,
  goes with the stack.
- Leave videos off a stack that already has one (marked "has a video" above).
- NEVER write any other link, URL, image address or embed. Only the videos field.
- Send the block whole, in one piece, as the last thing in your reply.

SAFETY: this is general wellbeing organisation, not medical advice. If I mention
pain, injury, medication, pregnancy or a diagnosed condition, say plainly that I
should check with a qualified professional, and keep the plan gentle.
Only suggest a video for ordinary movement, stretching, breathing, meditation or
sleep routine. Never suggest one for treating a condition, for a named diagnosis,
for medication, or for a diet meant to manage an illness.`;

const BASE_PROMPT = `You are my warm, easy-going day-planning assistant for an app called PPWellness Lifestyle App.

${STEP1_OPEN}

${STEP2_AND_FORMAT}`;

const ORGANISE_PROMPT = `You are my warm, easy-going day-planning assistant for an app called PPWellness Lifestyle App.

${STEP1_ORGANISE}

${STEP2_AND_FORMAT}`;

/**
 * buildPrompt(state) — prepends the user's real context + REAL headroom.
 *
 * The free cap is FREE_STACK_CAP items TOTAL (store5 overLimit), and a fresh
 * install already ships starter items — so telling the AI "plan 10 things"
 * guarantees the upsell wall on first use. Always compute the number from live
 * state, and from the shared constant so a cap change lands here too (W12).
 */
export function buildPrompt(S, mode = PLAN_MODE.FRESH) {
  const all = (S && Array.isArray(S.deckItems)) ? S.deckItems : [];
  const premium = !!(S && S.premium);
  const organising = mode === PLAN_MODE.REBUILD && replaceableItems(all).length > 0;
  // An organise pass can drop any stack it was shown, so those slots may come
  // free — only the pinned private ones certainly still count against the cap.
  // Charging the user for stacks the AI may remove made "redo my whole day" ask
  // for a SMALLER plan than the day it was replacing.
  const used = mode === PLAN_MODE.REBUILD ? all.length - replaceableItems(all).length : all.length;
  // Floor at 0, not 1. Math.max(1, …) told a user sitting at the cap there was
  // "room for 1 more thing"; they did the whole round trip out to their AI and
  // Apply refused on return (addItemsToPlan checks used + adds > cap).
  const headroom = premium ? 60 : Math.max(0, FREE_STACK_CAP - used);
  const days = premium ? 7 : (headroom >= 6 ? 2 : 1);

  const bits = [];
  // TODAY, by name (2026-10-17). dayOffset counts days from today, and nothing
  // ever told the AI what today IS — so "move my HIIT to Mondays" could only be
  // a guess at how many days away Monday is. In English, like the rest of the
  // prompt, whatever the phone's own language.
  bits.push(`Today is ${todayWords(S && S.now)}.`);
  // Only facts the user actually gave us. dayT/obBody/obInterests ship with
  // defaults (store5.js:129-133) and NO app5 screen sets them, so sending them
  // unconditionally told every user's AI, in the user's own voice, that they wake
  // at 07:00, want to work on "Stress" and enjoy "Meditation". Three invented
  // facts. If it is still the default, say nothing and let the AI ask.
  if (S && S.dayT && S.dayT.wake && S.dayT.bed && !(S.dayT.wake === DEFAULT_WAKE && S.dayT.bed === DEFAULT_BED)) {
    bits.push(`I'm usually up at ${S.dayT.wake} and in bed by ${S.dayT.bed}.`);
  }
  if (S && Array.isArray(S.obBody) && S.obBody.length && !isDefaultList(S.obBody, DEFAULT_BODY)) {
    bits.push(`I want to work on: ${S.obBody.slice(0, 5).join(', ')}.`);
  }
  if (S && Array.isArray(S.obInterests) && S.obInterests.length && !isDefaultList(S.obInterests, DEFAULT_INTERESTS)) {
    bits.push(`I enjoy: ${S.obInterests.slice(0, 5).join(', ')}.`);
  }
  // The fasting window IS user-set, and it constrains when anything food-adjacent
  // can go. It was the one real schedule fact we were throwing away.
  if (S && S.fastOn && S.eatOpen && S.eatClose) {
    bits.push(`I eat between ${S.eatOpen} and ${S.eatClose} and fast outside that, so keep anything food-related inside that window.`);
  }
  if (headroom === 0) {
    // Nothing will fit. Say so, rather than asking for a plan the app must refuse.
    bits.push('My app is completely full right now, so do not send me a plan block yet — help me work out what to drop first.');
  } else {
    bits.push(
      `My app has room for ${headroom} more thing${headroom === 1 ? '' : 's'} in total, so plan ` +
      `${days === 1 ? 'today only' : days === 2 ? 'today and tomorrow' : `today and the next ${days - 1} days`} ` +
      `and send me at most ${headroom} item${headroom === 1 ? '' : 's'}.`
    );
  }

  return `Some context about me: ${bits.join(' ')}\n\n${planEcho(S, mode)}${organising ? ORGANISE_PROMPT : BASE_PROMPT}`;
}

/**
 * planEcho(S, mode) — what the AI is told about the day that already exists.
 *
 * Without this the AI is blind: it can only invent new things and bolt them on,
 * which is why asking it to "reorganise my week" used to return a second set of
 * stacks next to the first. Empty string unless the user chose a mode that needs
 * it, so the default behaviour is unchanged and nothing leaves by accident.
 */
export function planEcho(S, mode) {
  const all = (S && Array.isArray(S.deckItems)) ? S.deckItems : [];
  if (!all.length || mode === PLAN_MODE.FRESH || !mode) return '';

  const open = all.filter((it) => !isPrivateKind(it)).slice(0, 40).sort(byTime);
  const shut = all.filter(isPrivateKind).slice(0, 20).sort(byTime);

  if (mode === PLAN_MODE.AROUND) {
    const lines = [...open, ...shut].sort(byTime).map(planLine);
    return [
      'WHAT IS ALREADY IN MY DAY — all of it stays exactly as it is:',
      ...lines,
      '',
      'Do not repeat any of those back to me, and do not put anything on top of',
      'those times. Send me ONLY the new things, arranged around what is above.',
      '', '',
    ].join('\n');
  }

  // REBUILD = organise. Every stack the AI may touch gets a ref.
  const { list } = refMapFor(all);
  const out = [
    'MY STACKS RIGHT NOW — each one has a ref (s1, s2 …) so you can tell me what happens to it:',
    ...list.map(({ ref, it }) => `  ${ref}  ${it.time || 'anytime'}  ${titleOf(it)}  ·  ${repeatWord(it.repeat)}${hasMedia(it) ? '  ·  has a video' : ''}`),
  ];
  if (shut.length) {
    out.push(
      '',
      'These are private and they stay exactly where they are. Plan around them,',
      'do not send them back, and do not try to guess what they say:',
      ...shut.map(planLine),
    );
  }
  out.push(
    '',
    'You are organising my stacks with me. When you send the plan, send the WHOLE list',
    'back in one block: keep the ref on every stack you keep or change (same wording',
    'if it still works), move what belongs at a different time, change what needs',
    'changing, add what is missing (no ref), and leave out what is not earning its',
    'place. A stack from my list that you leave out is removed. I will see every',
    'change and approve it before anything happens.',
    '', '',
  );
  return out.join('\n');
}

export { BASE_PROMPT, ORGANISE_PROMPT };
