// planDiff — what an ORGANISE reply would do to the user's own stacks.
//
// Vic, 2026-10-17: "take the prompt once they give the feedback on all the
// stacks, which organises well." The old "redo my whole day" deleted every stack
// the AI had been shown and added whatever came back, so a stack the user had
// put a video on, ticked for a fortnight or set to play by itself came back as a
// stranger with none of that — and the user saw a list of new things, never what
// had actually changed. This module turns a reply into a list of CHANGES the
// user can read and approve one by one:
//
//   changes  a stack the AI kept and changed: same id, only the changed fields
//   keeps    a stack the AI kept as it was
//   adds     something new
//   removes  a stack the AI left out (the prompt tells it that means "drop it")
//
// Matching, in order of trust:
//   1. the ref the prompt handed out (s1, s2 …) — exact, and each stack once;
//   2. the same title (case, accents and punctuation ignored), for a model that
//      dropped the ref — exact match only, never "close enough", because
//      merging two different stacks is worse than one extra card;
//   3. anything left is new.
//
// Pure: no store, no React. Every field it writes is one the store's
// applyPlanDiff whitelists (ORGANISE_FIELDS in store5.js).

import { todayKey, dayDiff, dateKeyFromOffset, keyToDate } from '../daykey.js';

/** Titles compared as words: case, accents and punctuation ignored. */
export const normTitle = (s) => String(s || '')
  .toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Days from today until a stack starts, the way the planner counts (0 = today).
 * A stack that started in the past is simply running, which is 0 — the AI is
 * told "0 = today", so a daily stack it leaves at 0 must not be read as a move.
 */
export function startOffset(it, today = todayKey()) {
  if (!it || !it.anchor) return 0;
  const d = dayDiff(it.anchor, today);
  return d > 0 ? d : 0;
}

const repeatOf = (it) => (it && it.repeat !== undefined ? it.repeat : 'daily');

function patchFor(cur, p) {
  const patch = {}, fields = [];
  const title = String(p.title || '').trim();
  // Case, spacing and punctuation are not a rename: the user's own spelling stays.
  if (title && normTitle(title) !== normTitle(cur.title)) {
    patch.title = title; fields.push({ key: 'title', from: cur.title || '', to: title });
  }
  // Only what the model actually SENT is a change. A field it left out is not
  // "make it empty" — that is how every untouched stack would have lost its
  // detail line, its time or its repeat to a default.
  if (p._metaGiven && (p.meta || '') !== (cur.meta || '')) {
    patch.meta = p.meta || ''; fields.push({ key: 'meta', from: cur.meta || '', to: p.meta || '' });
  }
  if (p._timeGiven && p.time && p.time !== cur.time) {
    patch.time = p.time; fields.push({ key: 'time', from: cur.time || '', to: p.time });
  }
  if (p._repeatGiven && p._repeat && p._repeat !== repeatOf(cur)) {
    patch.repeat = p._repeat; fields.push({ key: 'repeat', from: repeatOf(cur), to: p._repeat });
  }
  if (p._dayGiven) {
    const want = Math.max(0, Math.floor(p._day || 0));
    const have = startOffset(cur);
    if (want !== have) {
      patch.anchor = dateKeyFromOffset(want);
      fields.push({ key: 'day', from: have, to: want });
    }
  }
  // A stack with no start date shows EVERY day whatever its repeat says
  // (itemOnDate: legacy items), so a repeat change on one needs a start too, or
  // "make it weekly" would change the label and nothing else.
  if (patch.repeat !== undefined && !cur.anchor && patch.anchor === undefined) {
    patch.anchor = dateKeyFromOffset(p._dayGiven ? Math.max(0, Math.floor(p._day || 0)) : 0);
  }
  return { patch, fields };
}

/**
 * diffPlan(current, planned, refMap)
 *   current  the stacks the AI was shown (replaceableItems of the deck)
 *   planned  parsePlanDoc(...).items
 *   refMap   { s1: stackId, … } — the map the prompt was built with
 * → { changes, keeps, adds, removes }. Every entry of the first three carries
 *   `index`, its position in `planned`, so the preview can line up the videos
 *   the model suggested for it.
 */
export function diffPlan(current, planned, refMap = {}) {
  const cur = Array.isArray(current) ? current.filter(Boolean) : [];
  const plan = Array.isArray(planned) ? planned : [];
  const pool = new Map(cur.map((it) => [it.id, it]));
  const used = new Set();
  const pairs = new Array(plan.length).fill(null);

  // 1 — refs
  plan.forEach((p, i) => {
    const id = p && p._ref && refMap ? refMap[p._ref] : null;
    if (id && pool.has(id) && !used.has(id)) { used.add(id); pairs[i] = id; }
  });
  // 2 — the same title, for a model that dropped the ref
  plan.forEach((p, i) => {
    if (pairs[i] || !p) return;
    const t = normTitle(p.title);
    if (!t) return;
    const hit = cur.find((it) => !used.has(it.id) && normTitle(it.title) === t);
    if (hit) { used.add(hit.id); pairs[i] = hit.id; }
  });

  const changes = [], keeps = [], adds = [];
  plan.forEach((p, i) => {
    if (!p) return;
    const id = pairs[i];
    if (!id) { adds.push({ index: i, item: p }); return; }
    const before = pool.get(id);
    const { patch, fields } = patchFor(before, p);
    if (fields.length) changes.push({ index: i, id, before, patch, fields, item: p });
    else keeps.push({ index: i, id, before, item: p });
  });
  const removes = cur.filter((it) => !used.has(it.id));
  return { changes, keeps, adds, removes };
}

// ── words for the preview ───────────────────────────────────────────────────
const REPEAT_WORDS = { daily: 'every day', weekly: 'weekly', once: 'once' };
export const repeatWords = (r) => REPEAT_WORDS[r] || (r ? `every ${r} days` : 'once');

function dayWords(n, now = new Date()) {
  if (!n) return 'today';
  if (n === 1) return 'tomorrow';
  return keyToDate(dateKeyFromOffset(n, now)).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

/** One change, in plain words: "07:30 → 18:00", "every day → weekly", … */
export function describeField(f) {
  if (!f) return '';
  if (f.key === 'time') return `${f.from || 'anytime'} → ${f.to}`;
  if (f.key === 'repeat') return `${repeatWords(f.from)} → ${repeatWords(f.to)}`;
  if (f.key === 'title') return `new name: ${f.to}`;
  if (f.key === 'meta') return f.to ? `detail: ${f.to}` : 'detail removed';
  if (f.key === 'day') return `starts ${dayWords(f.to)}`;
  return '';
}
