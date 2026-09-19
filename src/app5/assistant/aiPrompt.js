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

// Mirrors the shipped defaults in store5.js (:129-133). Kept here so buildPrompt
// can tell "the user chose this" apart from "nobody has ever set it".
const DEFAULT_WAKE = '07:00';
const DEFAULT_BED = '22:30';
const DEFAULT_BODY = ['Stress'];
const DEFAULT_INTERESTS = ['Meditation'];
const isDefaultList = (a, d) => a.length === d.length && a.every((v, i) => v === d[i]);

export const PROMPT_VERSION = 5;

const BASE_PROMPT = `You are my warm, easy-going day-planning assistant for an app called PPWellness Lifestyle App.

STEP 1 — Open the conversation, then STOP and wait for my reply. In ONE short,
friendly message, invite me to tell you anything at all — something like:

"Tell me whatever's on your mind about your days — what you'd like to change, what
you already do, your goals, your rough timings, the lot. Any order, as much or as
little as you like, and it's completely fine to be vague or all over the place.
I'll make sense of it and turn it into a simple plan."

Do NOT ask a numbered questionnaire. Do NOT write any plan yet. Just open the door
and let me talk.

STEP 2 — Take whatever I give you — however scattered, vague, or out of order — and
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
{"ppw":"routine","v":2,"name":"My week","items":[
{"title":"Morning walk","meta":"20 min, outside","time":"07:30","dayOffset":0,"repeat":"daily"},
{"title":"Box breathing","meta":"5 min","time":"13:00","dayOffset":0,"repeat":"daily"},
{"title":"Long session","meta":"45 min","time":"18:00","dayOffset":1,"repeat":"weekly"},
{"title":"I did enough today.","kind":"note","time":"21:30","dayOffset":0,"repeat":"daily"}
]}
\`\`\`

FORMAT RULES — the app reads this block literally.
- Valid JSON. Straight quotes only ("). No smart quotes, no trailing commas,
  no comments, no line breaks inside a value.
- Allowed keys per item, nothing else: title, meta, time, dayOffset, repeat, kind.
- Every item MUST have a title. Never send a bare string in the list.
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
- NEVER include links, URLs, video IDs, image addresses or embeds. Not one.
  I add my own videos inside the app. Any link you write is deleted on import.
- Send the block whole, in one piece, as the last thing in your reply.

SAFETY: this is general wellbeing organisation, not medical advice. If I mention
pain, injury, medication, pregnancy or a diagnosed condition, say plainly that I
should check with a qualified professional, and keep the plan gentle.`;

/**
 * buildPrompt(state) — prepends the user's real context + REAL headroom.
 *
 * The free cap is FREE_STACK_CAP items TOTAL (store5 overLimit), and a fresh
 * install already ships starter items — so telling the AI "plan 10 things"
 * guarantees the upsell wall on first use. Always compute the number from live
 * state, and from the shared constant so a cap change lands here too (W12).
 */
export function buildPrompt(S) {
  const used = (S && Array.isArray(S.deckItems)) ? S.deckItems.length : 0;
  const premium = !!(S && S.premium);
  // Floor at 0, not 1. Math.max(1, …) told a user sitting at the cap there was
  // "room for 1 more thing"; they did the whole round trip out to their AI and
  // Apply refused on return (addItemsToPlan checks used + adds > cap).
  const headroom = premium ? 60 : Math.max(0, FREE_STACK_CAP - used);
  const days = premium ? 7 : (headroom >= 6 ? 2 : 1);

  const bits = [];
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

  return `Some context about me: ${bits.join(' ')}\n\n${BASE_PROMPT}`;
}

export { BASE_PROMPT };
