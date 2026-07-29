// parsePlan — tolerant EXTRACTION of a plan block from whatever the user pasted.
//
// The user copies our prompt into their own AI (ChatGPT / Claude / Gemini), then
// pastes the reply back. Real replies are messy: extra prose, a ```json label
// instead of ```ppw-routine, curly quotes, trailing commas, a truncated block,
// or — very commonly — no fence at all because ChatGPT's Copy button strips it.
//
// This module ONLY finds and JSON-parses the candidate. It never decides what a
// field means: store5.parsePlanDoc() still whitelists every key afterwards.

const MAX_SCAN = 1_000_000;
const MAX_MARKERS = 24;
const ZERO_WIDTH = /[​-‍⁠﻿]/g;

// Never slice the HEAD — the plan block is at the END of an AI reply.
function preclean(s) {
  s = String(s || '');
  if (s.length > MAX_SCAN) s = s.slice(s.length - MAX_SCAN);
  return s.replace(/\r\n?/g, '\n').replace(ZERO_WIDTH, '').replace(/ /g, ' ');
}

// Only DOUBLE quotes are straightened. Curly apostrophes/dashes are legal inside
// JSON strings — rewriting them would corrupt the user's own words.
const straightenDoubles = (s) => s.replace(/[“”„‟]/g, '"');

// Structural repairs applied ONLY outside string literals (trailing commas, // comments).
function repairStructure(s) {
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === ',') {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] === '}' || s[j] === ']') continue; // trailing comma → drop
    }
    out += c;
  }
  return out;
}

// Walk from an opening brace to its matching close, string-aware.
function braceSlice(s, from) {
  let depth = 0, inStr = false, esc = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { if (inStr) esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return { text: s.slice(from, i + 1), truncated: false }; }
  }
  return { text: s.slice(from), truncated: true };
}

function tryParse(raw) {
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const a = straightenDoubles(raw);
  try { return JSON.parse(a); } catch { /* fall through */ }
  try { return JSON.parse(repairStructure(a)); } catch { /* give up */ }
  return null;
}

const looksLikePlan = (o) => o && typeof o === 'object' && o.ppw === 'routine' && Array.isArray(o.items);

/**
 * extractPlanCandidates(text)
 *   → { ok:true, data, tier, alternates }
 *   → { ok:false, reason:'no-block'|'parse'|'truncated'|'bad-shape' }
 *
 * Candidates are SCORED, not "last one wins": most items → latest in the reply →
 * cleanest tier. If more than one DISTINCT plan parses, `alternates` is non-empty
 * and the preview asks which one — never guess silently.
 */
export function extractPlanCandidates(text) {
  const s = preclean(text);
  if (!s.trim()) return { ok: false, reason: 'no-block' };

  const cands = [];
  const push = (raw, tier, idx, truncated) => cands.push({ raw, tier, idx, truncated });

  // TIER 1 — a proper ```ppw-routine fence (also "```json ppw-routine")
  const t1 = /```[ \t]*(?:json[ \t]+)?ppw-routine(?:[ \t]+json)?[ \t]*\r?\n?([\s\S]*?)(?:```|$)/gi;
  for (let m; (m = t1.exec(s));) push(m[1], 1, m.index, m[0].slice(-3) !== '```');

  // TIER 2 — ANY fenced block whose body carries the marker (Gemini's ```json)
  const t2 = /```[a-z0-9_-]*[ \t]*\r?\n?([\s\S]*?)(?:```|$)/gi;
  for (let m; (m = t2.exec(s));) {
    if (/"ppw"\s*:\s*"routine"/.test(m[1])) push(m[1], 2, m.index, m[0].slice(-3) !== '```');
  }

  // TIER 3 — BARE JSON, no fence. ChatGPT's Copy button strips fences, so this is
  // the highest-frequency real case, not an edge case.
  const marker = /"ppw"\s*:\s*"routine"/g;
  let seen = 0;
  for (let m; (m = marker.exec(s)) && seen < MAX_MARKERS; seen++) {
    let open = -1, depth = 0;
    for (let i = m.index; i >= 0; i--) {
      const c = s[i];
      if (c === '}') depth++;
      else if (c === '{') { if (depth === 0) { open = i; break; } depth--; }
    }
    if (open === -1) continue;
    const sl = braceSlice(s, open);
    push(sl.text, 3, open, sl.truncated);
  }

  if (!cands.length) return { ok: false, reason: 'no-block' };

  const good = [], keys = new Set();
  let sawTruncated = false, sawShape = false;
  for (const c of cands) {
    const data = tryParse(c.raw.trim());
    if (looksLikePlan(data)) {
      const k = JSON.stringify(data);
      if (!keys.has(k)) { keys.add(k); good.push({ data, tier: c.tier, idx: c.idx }); }
    } else {
      if (data && typeof data === 'object' && data.ppw === 'routine') sawShape = true;
      if (c.truncated) sawTruncated = true;
    }
  }

  if (!good.length) {
    if (sawShape) return { ok: false, reason: 'bad-shape' };
    if (sawTruncated) return { ok: false, reason: 'truncated' };
    return { ok: false, reason: /\{[\s\S]*"ppw"/.test(s) ? 'parse' : 'no-block' };
  }

  good.sort((a, b) => (b.data.items.length - a.data.items.length) || (b.idx - a.idx) || (a.tier - b.tier));
  return { ok: true, data: good[0].data, tier: good[0].tier, alternates: good.slice(1) };
}

// Human-readable reason for the paste box.
export const PARSE_HELP = {
  'no-block': 'I couldn’t find a plan in that. Copy your AI’s whole reply — including the block of code at the end — and paste it again.',
  'parse': 'That looks like a plan but I couldn’t read it. Ask your AI to “send the plan block again, on its own”.',
  'truncated': 'The plan looks cut off. Ask your AI to “send the whole block again” and copy all of it.',
  'bad-shape': 'That plan is missing its list of items. Ask your AI to send it again using the format from the prompt.',
};
