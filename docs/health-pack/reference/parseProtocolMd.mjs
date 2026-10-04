// parseProtocolMd — REFERENCE implementation of the ppw-protocol v1 format.
//
// The builder should port this into src/app5/ (e.g. protocolsMd5.js) in the
// app's own style. It mirrors parseRoutineMd/parsePlan: the human-readable
// Markdown is for people; the app only trusts the fenced JSON block, and every
// field is whitelisted and normalised on the way in.
//
// Usage: parseProtocolMd(text, { knownIds }) → { ok, protocol, warnings } | { ok:false, reason }

const REPEATS = new Set(['daily', 'weekly', 'once', 'weekdays']);
const KINDS = new Set(['supplement', 'movement', 'habit', 'meal', 'test', 'note', 'voice']);
const ANCHORS = new Set(['wake', 'breakfast', 'lunch', 'dinner', 'bed', 'before_exercise', 'after_meals']);
const EVIDENCE = new Set(['A', 'B', 'C']);

const straighten = (s) => s.replace(/[“”„‟]/g, '"');
function repair(s) {
  // drop trailing commas and // comments outside strings
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { out += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === ',') { let j = i + 1; while (j < s.length && /\s/.test(s[j])) j++; if (s[j] === '}' || s[j] === ']') continue; }
    out += c;
  }
  return out;
}
function tryJson(raw) {
  for (const f of [(x) => x, straighten, (x) => repair(straighten(x))]) {
    try { return JSON.parse(f(raw)); } catch { /* next */ }
  }
  return null;
}

function normRepeat(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (REPEATS.has(s)) return s;
  if (s === 'every_other_day' || s === 'every other day') return '2';
  if (/^\d{1,2}$/.test(s)) { const n = +s; if (n === 1) return 'daily'; if (n >= 2 && n <= 14) return String(n); }
  return null;
}
const normTime = (t) => (typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null);
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

// trusted = a protocol bundled with the app (by id + content hash). Only trusted, doctor-first
// protocols may carry a "supervised" dose above the safe maximum. In an imported file the flag
// becomes `supervisedRequested`: the app must ask "My doctor prescribed this dose" per item.
export function parseProtocolMd(text, { knownIds = null, trusted = false } = {}) {
  const s = String(text || '').replace(/\r\n?/g, '\n');
  const blocks = [];
  const fence = /```[ \t]*(?:json[ \t]+)?ppw-protocol[ \t]*\n([\s\S]*?)```/gi;
  for (let m; (m = fence.exec(s));) blocks.push(m[1]);
  if (!blocks.length) {
    // tolerate a plain ```json fence that carries the marker
    const any = /```[a-z]*[ \t]*\n([\s\S]*?)```/gi;
    for (let m; (m = any.exec(s));) if (/"ppw"\s*:\s*"protocol"/.test(m[1])) blocks.push(m[1]);
  }
  if (!blocks.length) return { ok: false, reason: 'no-block' };
  const data = tryJson(blocks[blocks.length - 1].trim()); // last block wins, like parsePlan
  if (!data) return { ok: false, reason: 'parse' };
  if (data.ppw !== 'protocol' || data.v !== 1 || !Array.isArray(data.items) || !data.items.length) return { ok: false, reason: 'bad-shape' };

  const warnings = [];
  const doctorFirst = data.doctorFirst === true;
  const items = data.items.slice(0, 40).map((it, idx) => {
    if (!it || typeof it !== 'object') return null;
    const title = str(it.title, 120);
    if (!title) { warnings.push(`item ${idx + 1}: no title, skipped`); return null; }
    const kind = KINDS.has(it.kind) ? it.kind : 'habit';
    const repeat = normRepeat(it.repeat) || 'daily';
    if (!normRepeat(it.repeat)) warnings.push(`"${title}": unknown repeat "${it.repeat}", using daily`);
    const nutrients = (Array.isArray(it.nutrients) ? it.nutrients : []).map((n) => {
      const id = str(n && n.id, 60);
      const amount = typeof n?.amount === 'number' && n.amount > 0 && n.amount < 1e6 ? n.amount : null;
      const unit = str(n && n.unit, 20);
      if (!id || amount == null || !unit) { warnings.push(`"${title}": a nutrient line was incomplete and was skipped`); return null; }
      // "other" = an ingredient the app has no id for (a herb, a blend): keep its label name
      if (id === 'other') {
        const name = str(n && n.name, 80);
        if (!name) { warnings.push(`"${title}": an "other" ingredient had no name and was skipped`); return null; }
        return { id, name, amount, unit };
      }
      if (knownIds && !knownIds.has(id)) warnings.push(`"${title}": unknown nutrient/ingredient id "${id}" (kept, shown as tracked only)`);
      return { id, amount, unit };
    }).filter(Boolean);
    if (kind === 'supplement' && !nutrients.length) warnings.push(`"${title}": supplement with no amounts — will be added as a reminder only`);
    return {
      kind, title,
      time: normTime(it.time),
      anchor: ANCHORS.has(it.anchor) ? it.anchor : null,
      offsetMin: int(it.offsetMin, -720, 720),
      repeat,
      durationMin: int(it.durationMin, 1, 600),
      dayOffset: int(it.dayOffset, -365, 365),
      endDayOffset: int(it.endDayOffset, -365, 3650),
      nutrients,
      withFood: typeof it.withFood === 'boolean' ? it.withFood : null,
      // a dose above the safe maximum is only honoured in a bundled, doctor-first protocol
      supervised: trusted && doctorFirst && it.supervised === true,
      supervisedRequested: !trusted && it.supervised === true,
      notes: str(it.notes, 400) || '',
      evidence: EVIDENCE.has(it.evidence) ? it.evidence : null,
      source: typeof it.source === 'string' && /^https?:\/\//.test(it.source) ? it.source : null,
    };
  }).filter(Boolean);
  if (!items.length) return { ok: false, reason: 'bad-shape' };

  const protocol = {
    id: str(data.id, 80) || 'imported-' + Date.now().toString(36),
    title: str(data.title, 80) || 'Imported protocol',
    tagline: str(data.tagline, 160) || '',
    for: str(data.for, 300) || '',
    notFor: (Array.isArray(data.notFor) ? data.notFor : []).map((x) => str(x, 120)).filter(Boolean),
    doctorFirst,
    evidence: EVIDENCE.has(data.evidence) ? data.evidence : null,
    durationWeeks: int(data.durationWeeks, 1, 520),
    reviewAfterWeeks: int(data.reviewAfterWeeks, 1, 520),
    anchorDate: data.anchorDate === 'surgery' ? 'surgery' : 'start',
    version: str(String(data.version ?? '1'), 10),
    items,
    safety: (Array.isArray(data.safety) ? data.safety : []).map((x) => str(x, 300)).filter(Boolean),
    keyStudies: (Array.isArray(data.keyStudies) ? data.keyStudies : []).filter((k) => k && typeof k.url === 'string' && /^https?:\/\//.test(k.url))
      .map((k) => ({ title: str(k.title, 200) || '', year: int(k.year, 1900, 2100), type: str(k.type, 60) || '', finding: str(k.finding, 300) || '', url: k.url })),
    sources: (Array.isArray(data.sources) ? data.sources : []).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)),
  };
  return { ok: true, protocol, warnings };
}

export const PROTOCOL_PARSE_HELP = {
  'no-block': 'This file has no protocol block the app can read. Tap "Ask my AI to convert it" and paste the reply back.',
  parse: 'The protocol block is damaged. Ask your AI to "send the ppw-protocol block again, on its own".',
  'bad-shape': 'The protocol is missing its list of items.',
};
