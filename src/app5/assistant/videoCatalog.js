// videoCatalog — "PPW picks": a short list of checked YouTube videos the app can
// recommend for a stack with no AI round trip at all (Vic, 2026-10-17: "find
// appropriate videos on YouTube which associate with the stack as a
// recommended button where they can click … and then it can add it").
//
// WHY A LIST AND NOT A LIVE SEARCH. Searching YouTube from inside the app needs
// a YouTube Data API key, and a key in a browser bundle is a key published to
// the world — so live search needs a small server route (a separate, Vic-gated
// job). Until then the Recommended sheet offers three things that need nothing:
// the user's own AI's suggestions (checked against YouTube), these picks, and a
// one-tap YouTube search the user brings a link back from.
//
// EVERY ID BELOW WAS ASKED OF YOUTUBE, NOT WRITTEN FROM MEMORY. verifyVideo.js
// says why at length: an 11-character id that looks real can be invented, and
// the worst case is an id that plays something other than its title. Each was
// checked with YouTube's oEmbed endpoint on 2026-10-17 (HTTP 200), and `title`
// and `author` are YouTube's own words, copied. Changing an id here means asking
// YouTube again (tools: curl the oEmbed URL in verifyVideo.js).
//
// Content rules, the same as the starter deck's: no yoga (out of the app since
// 2026-10-12), nothing that treats a named condition, credible sources first.

export const PPW_PICKS = [];

// Topic words. A stack matches a topic when its title or detail line uses one of
// these words (or phrases); the picks for the matched topics are offered.
export const TOPIC_WORDS = {
  stretch: ['stretch', 'stretches', 'stretching', 'flexibility', 'loosen', 'limber', 'cool down'],
  back: ['back', 'lower back', 'spine', 'lumbar'],
  neck: ['neck', 'shoulder', 'shoulders', 'desk', 'posture', 'upper back', 'office'],
  hips: ['hip', 'hips', 'mobility', 'glute', 'glutes'],
  foam: ['foam', 'roller', 'rolling', 'myofascial', 'fascia', 'release', 'self massage', 'massage', 'trigger point'],
  breath: ['breath', 'breathe', 'breathing', 'breathwork', 'inhale', 'exhale', 'box breathing'],
  meditation: ['meditate', 'meditation', 'mindfulness', 'mindful', 'calm', 'relax', 'relaxation', 'focus', 'stress'],
  sleep: ['sleep', 'bedtime', 'bed', 'wind down', 'body scan', 'night', 'evening routine'],
  walk: ['walk', 'walking', 'steps', 'stroll'],
  strength: ['strength', 'bodyweight', 'squat', 'squats', 'push up', 'pushup', 'push ups', 'lunge', 'lunges', 'muscle', 'workout', 'toning'],
  hiit: ['hiit', 'interval', 'intervals', 'tabata', 'cardio', 'sweat', 'fat burn'],
  core: ['core', 'abs', 'plank', 'abdominal'],
};

const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** The topics a stack is about, best match first. */
export function topicsFor(item) {
  const text = ' ' + words([item && item.title, item && item.meta].filter(Boolean).join(' ')) + ' ';
  const hits = [];
  for (const [topic, list] of Object.entries(TOPIC_WORDS)) {
    let n = 0;
    for (const w of list) if (text.includes(' ' + w + ' ')) n += w.includes(' ') ? 2 : 1;
    if (n) hits.push({ topic, n });
  }
  return hits.sort((a, b) => b.n - a.n).map((h) => h.topic);
}

/**
 * Up to `n` picks for a stack, by its best topics. Nothing is offered for a
 * stack the list knows nothing about — a wrong recommendation is worse than an
 * honest "search YouTube for it".
 */
export function picksFor(item, n = 3, list = PPW_PICKS) {
  const topics = topicsFor(item);
  const out = [];
  for (const t of topics) {
    for (const p of list) {
      if (p.topic === t && !out.includes(p)) out.push(p);
      if (out.length >= n) return out;
    }
  }
  return out;
}

/** What to search YouTube for, when the user wants to look themselves. */
export function searchWordsFor(item) {
  const q = String((item && (item.recQ || item.title)) || '').trim();
  return q.slice(0, 100);
}
