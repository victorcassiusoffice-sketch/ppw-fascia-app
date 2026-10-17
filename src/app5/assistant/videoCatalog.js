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

export const PPW_PICKS = [
  { yt: "COO2S7lPBzA", topic: "stretch", title: "10 Minute Total Body Stretch! [Daily Flexibility Routine for Beginners]", author: "Tone and Tighten" },
  { yt: "t_YEUWe6Yn8", topic: "stretch", title: "10 Min Full Body Stretch Routine for Beginners", author: "Jeffrey Peng MD" },
  { yt: "vDt6ZKuMDwE", topic: "back", title: "12-Minute Low Back Pain Exercise Routine [Real-Time]", author: "Veritas Health" },
  { yt: "WQ6p2ZDhCS8", topic: "back", title: "Back Stretches for Lower Back Pain (15-Minute Daily Morning Routine)", author: "Doctor O'Donovan" },
  { yt: "u3Ocw5UIpYs", topic: "neck", title: "Real Time Neck Pain Stretches - Ask Doctor Jo", author: "AskDoctorJo" },
  { yt: "FRNtLrMf-1A", topic: "neck", title: "Relieve Neck Pain & Tension at Your Desk - Daily Physio Routine", author: "Michelle Kenway" },
  { yt: "qHzJavfNAO0", topic: "hips", title: "9 Hip Stretches for Tight Hips | Doctor and Physio led guide", author: "Doctor O'Donovan" },
  { yt: "GIuiGVYr7ho", topic: "hips", title: "How To Stretch Tight Hips - 7-Minute Hip Opener Routine For Beginners", author: "Tone and Tighten" },
  { yt: "TvTNfKMreMM", topic: "foam", title: "How to Foam Roll (Massage) Entire Body with Good Form & Technique.", author: "Bob & Brad" },
  { yt: "c0JRlrKJXPg", topic: "foam", title: "The 8 BEST Foam Rolling Exercises (10-Minute Full Body Foam Roll Routine)", author: "nourishmovelove" },
  { yt: "G25IR0c-Hj8", topic: "breath", title: "Box Breathing for Stress - CHI Health", author: "CHI Health" },
  { yt: "J7JKQA-F2dg", topic: "breath", title: "Breathwork for Beginners | Melissa Young, MD", author: "Cleveland Clinic" },
  { yt: "QHkXvPq2pQE", topic: "meditation", title: "Reset: Decompress Your Body and Mind", author: "Headspace" },
  { yt: "G7oWBw-79MI", topic: "meditation", title: "10-Minute Breath & Sound Mindfulness Meditation with Dr. Elise Bialylew", author: "Mindful in May" },
  { yt: "Nosw9iGaTY4", topic: "sleep", title: "A Body Scan Meditation to Prepare Mind and Body for Sleep", author: "Mindful" },
  { yt: "MZOp8jlkshQ", topic: "sleep", title: "Wind Down in 5 Minutes: Noting Meditation with Kessonga for Deep Sleep & Mental Calm", author: "Headspace" },
  { yt: "X3q5e1pV4pc", topic: "walk", title: "1.0 Mile Happy Walk | Walk at Home | Walking Workout | over 100M Views", author: "Walk at Home" },
  { yt: "C7-xW9mRNiI", topic: "strength", title: "20-Minute Bodyweight Workout for Beginners (No Repeats)", author: "nourishmovelove" },
  { yt: "uhpo1amlLZo", topic: "hiit", title: "10-Minute Low Impact HIIT Workout (No Equipment, All Standing)", author: "nourishmovelove" },
  { yt: "b_TTLmmQmXU", topic: "core", title: "Core Workout For Beginners - 10-Minute Follow Along", author: "Tone and Tighten" },
];

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
  // Not 'workout': it is in half the titles there are ("HIIT workout"), and
  // matched there it put strength videos ahead of the HIIT ones.
  strength: ['strength', 'bodyweight', 'squat', 'squats', 'push up', 'pushup', 'push ups', 'lunge', 'lunges', 'muscle', 'toning'],
  hiit: ['hiit', 'interval', 'intervals', 'tabata', 'cardio', 'sweat', 'fat burn'],
  core: ['core', 'abs', 'plank', 'abdominal'],
};

const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
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
