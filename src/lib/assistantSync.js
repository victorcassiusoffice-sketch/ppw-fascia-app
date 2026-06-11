// Assistant → App sync client (D2, 2026-06-11).
//
// The PPW Wellness Assistant is a SEPARATE paid service (own Vercel app + Neon DB
// + Anthropic key). It writes a per-user log of "plan operations" server-side; this
// app pulls those ops on launch/focus and applies them into the SAME localStorage
// shapes the app already uses (user stacks, recurrence rules, IF prefs, saved
// zones). Offline-first is preserved: no network → silent no-op; next focus catches
// up. No health data ever crosses the bridge — only schedule content.
//
// Contract (frozen by D1 — see 09-Fascia-App/assistant-write-back/ARCHITECTURE):
//   GET  {URL}/api/plan/patches?since=<seq>   (device token)  → { ops, nextSeq, planSchema }
//   POST {URL}/api/plan/ack  { ops:[{id,status}] }            (device token)
//   POST {URL}/api/device/exchange  { code, label }           (public) → { token, scope }
// Each op row: { id:'op_<uuid>', seq, op, payload, created_at }.
// App-side ids for assistant items are namespaced `assistant::<op_id>`.
//
// `applyPlanOp(op, storage)` is PURE/deterministic over a localStorage-like store
// (so it is unit-testable against the real LS shapes). The orchestration functions
// (syncNow / pairDevice / …) are the impure, browser-only layer on top.

import { LS_KEYS, WELLNESS_ASSISTANT_URL } from '../config.js';
import { makeRule } from '../recurrence.js';

export const ASSISTANT_NS = 'assistant::';
const SYNC_KEY = LS_KEYS.ASSISTANT_SYNC;
const APPLIED_EVENT = 'ppw:assistant-applied';

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ZONE_RE = /^[A-Z0-9-]{1,12}$/;

/* ─── storage helpers (work over any localStorage-like object) ─── */

function defaultStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; }
  catch (_) { return null; }
}
function readJSON(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (_) { return fallback; }
}
function writeJSON(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch (_) { /* quota / disabled — ignore */ }
}
// Enumerate every per-date user-stack bucket key (`ppw.userStacks::<ISO>`).
function userStackKeys(storage) {
  const prefix = LS_KEYS.USER_STACKS + '::';
  const out = [];
  try {
    if (typeof storage.length === 'number' && typeof storage.key === 'function') {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.indexOf(prefix) === 0) out.push(k);
      }
    }
  } catch (_) { /* ignore */ }
  return out;
}

function todayISOorNull() {
  try { return new Date().toISOString().slice(0, 10); } catch (_) { return null; }
}
function nowISOorNull() {
  try { return new Date().toISOString(); } catch (_) { return null; }
}
function isRealDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Assistant recurrence freq → app recurrence engine freq. The app engine
// (src/recurrence.js) supports everyday | weekly | everyN only; it has no
// weekday/weekend filter, so weekdays/weekends degrade to a daily occurrence
// (documented limitation — closest non-destructive mapping).
function mapFreq(freq) {
  switch (String(freq || '').toLowerCase()) {
    case 'weekly': return 'weekly';
    case 'everyday':
    case 'weekdays':
    case 'weekends':
    default: return 'everyday';
  }
}

// Build the app Stack shape from a validated add_stack/schedule_routine payload.
// Assistant ops never carry media/links, so everything renders as a text
// reminder (app render type 'text'); the original assistant type is retained
// on `assistantType` for traceability.
function buildStack(opId, payload) {
  const title = String(payload.title).trim();
  const note = payload.note ? String(payload.note).trim() : '';
  const stack = {
    id: ASSISTANT_NS + opId,
    type: 'text',
    assistantType: payload.type || 'text',
    time: HHMM_RE.test(payload.time || '') ? payload.time : '08:00',
    durationSec: Number.isFinite(payload.durationSec) && payload.durationSec > 0 ? Math.floor(payload.durationSec) : 0,
    startAtSec: 0,
    endAtSec: null,
    title,
    text: note ? `${title}\n${note}` : title,
    source: 'assistant',
    assistantOpId: opId,
  };
  if (note) stack.note = note;
  if (payload.protocolRef) stack.protocolRef = String(payload.protocolRef);
  return stack;
}

/* ─── pure op appliers (per type) ─── */

function applyAddStack(opId, payload, storage) {
  if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) {
    return { applied: false, reason: 'invalid_title' };
  }
  const stack = buildStack(opId, payload);
  const recurring = payload.recurrence != null;

  if (recurring) {
    const freq = payload.recurrence && payload.recurrence.freq;
    if (!freq) return { applied: false, reason: 'invalid_recurrence' };
    const rules = readJSON(storage, LS_KEYS.RECURRENCE_RULES, []);
    const list = Array.isArray(rules) ? rules : [];
    if (list.some(r => r && r.id === stack.id)) return { applied: false, reason: 'duplicate' };
    const anchorDate = isRealDate(payload.date) ? payload.date : todayISOorNull();
    if (!anchorDate) return { applied: false, reason: 'no_anchor_date' };
    const rule = makeRule({ id: stack.id, stack, anchorDate, freq: mapFreq(freq), createdAt: 0 });
    writeJSON(storage, LS_KEYS.RECURRENCE_RULES, [...list, rule]);
    return { applied: true };
  }

  // one-off → ppw.userStacks::<date>
  const date = isRealDate(payload.date) ? payload.date : todayISOorNull();
  if (!date) return { applied: false, reason: 'no_date' };
  const key = LS_KEYS.USER_STACKS + '::' + date;
  const stacks = readJSON(storage, key, []);
  const list = Array.isArray(stacks) ? stacks : [];
  if (list.some(s => s && s.id === stack.id)) return { applied: false, reason: 'duplicate' };
  writeJSON(storage, key, [...list, stack]);
  return { applied: true };
}

function applyScheduleRoutine(opId, payload, storage) {
  if (!payload || payload.recurrence == null || !(payload.recurrence.freq)) {
    return { applied: false, reason: 'invalid_recurrence' };
  }
  return applyAddStack(opId, payload, storage);
}

function applySetFastingWindow(_opId, payload, storage) {
  if (!payload || !HHMM_RE.test(payload.windowStart || '') || !HHMM_RE.test(payload.windowEnd || '')) {
    return { applied: false, reason: 'invalid_window' };
  }
  const prefs = readJSON(storage, LS_KEYS.IF_PREFS, { enabled: false, windowStart: '12:00', windowEnd: '20:00' });
  const next = {
    ...prefs,
    enabled: payload.enabled === false ? false : true,
    windowStart: payload.windowStart,
    windowEnd: payload.windowEnd,
  };
  writeJSON(storage, LS_KEYS.IF_PREFS, next);
  return { applied: true };
}

function applyTickCondition(_opId, payload, storage) {
  const raw = Array.isArray(payload && payload.zoneCodes) ? payload.zoneCodes : [];
  const codes = [...new Set(raw.map(z => String(z).trim().toUpperCase()).filter(z => ZONE_RE.test(z)))];
  if (codes.length === 0) return { applied: false, reason: 'no_zones' };
  const action = String((payload && payload.action) || 'add').toLowerCase();
  if (action !== 'add' && action !== 'remove') return { applied: false, reason: 'invalid_action' };
  const routines = readJSON(storage, LS_KEYS.ACTIVE_ROUTINES, { savedZones: [], level: 'beginner', lifestyle: null, scheduledTime: '08:00' });
  const have = Array.isArray(routines.savedZones) ? routines.savedZones : [];
  const next = action === 'add'
    ? [...new Set([...have, ...codes])]
    : have.filter(z => !codes.includes(z));
  writeJSON(storage, LS_KEYS.ACTIVE_ROUTINES, { ...routines, savedZones: next });
  return { applied: true };
}

// Find an assistant stack by its namespaced id across one-off buckets + rules.
// Returns a small descriptor or null.
function findAssistantStack(assistantId, storage) {
  for (const key of userStackKeys(storage)) {
    const list = readJSON(storage, key, []);
    if (Array.isArray(list)) {
      const idx = list.findIndex(s => s && s.id === assistantId);
      if (idx >= 0) return { where: 'userStacks', key, idx, list };
    }
  }
  const rules = readJSON(storage, LS_KEYS.RECURRENCE_RULES, []);
  if (Array.isArray(rules)) {
    const idx = rules.findIndex(r => r && r.id === assistantId);
    if (idx >= 0) return { where: 'rules', key: LS_KEYS.RECURRENCE_RULES, idx, list: rules };
  }
  return null;
}

function applySetReminder(_opId, payload, storage) {
  const stackRef = payload && typeof payload.stackRef === 'string' ? payload.stackRef.trim() : '';
  if (!stackRef) return { applied: false, reason: 'invalid_ref' };
  const assistantId = ASSISTANT_NS + stackRef;
  const found = findAssistantStack(assistantId, storage);
  if (!found) return { applied: false, reason: 'target_not_found' };
  const remind = payload.remind === false ? false : true;
  if (found.where === 'userStacks') {
    const next = found.list.slice();
    next[found.idx] = { ...next[found.idx], remind };
    writeJSON(storage, found.key, next);
  } else {
    const next = found.list.slice();
    next[found.idx] = { ...next[found.idx], stack: { ...next[found.idx].stack, remind } };
    writeJSON(storage, found.key, next);
  }
  return { applied: true };
}

function applyRemoveItem(_opId, payload, storage) {
  const stackRef = payload && typeof payload.stackRef === 'string' ? payload.stackRef.trim() : '';
  if (!stackRef) return { applied: false, reason: 'invalid_ref' };
  const assistantId = ASSISTANT_NS + stackRef;
  const found = findAssistantStack(assistantId, storage);
  if (!found) return { applied: false, reason: 'target_not_found' };
  const next = found.list.filter((_, i) => i !== found.idx);
  writeJSON(storage, found.key, next);
  return { applied: true };
}

const APPLIERS = {
  add_stack: applyAddStack,
  schedule_routine: applyScheduleRoutine,
  set_fasting_window: applySetFastingWindow,
  tick_condition: applyTickCondition,
  set_reminder: applySetReminder,
  remove_item: applyRemoveItem,
};

/**
 * Apply ONE plan op into the existing localStorage shapes.
 * Pure/deterministic over `storage` (a localStorage-like object).
 * Returns { applied: boolean, reason?: string }. Never throws.
 *
 * @param {{ id?:string, op?:string, payload?:object }} op  one row from /api/plan/patches
 * @param {Storage} [storage]  defaults to window.localStorage
 */
export function applyPlanOp(op, storage = defaultStorage()) {
  if (!storage) return { applied: false, reason: 'no_storage' };
  if (!op || typeof op !== 'object') return { applied: false, reason: 'malformed' };
  const opId = typeof op.id === 'string' && op.id ? op.id : null;
  const fn = APPLIERS[op.op];
  if (!fn) return { applied: false, reason: 'unknown_op' };
  // set_reminder / remove_item reference another op via payload.stackRef and do
  // not need their own id; the create ops require one (it becomes the item id).
  if ((op.op === 'add_stack' || op.op === 'schedule_routine') && !opId) {
    return { applied: false, reason: 'missing_op_id' };
  }
  try {
    return fn(opId, op.payload || {}, storage);
  } catch (_) {
    return { applied: false, reason: 'apply_error' };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Orchestration (impure, browser-only). Everything below silently no-ops when
   unpaired or offline.
   ═══════════════════════════════════════════════════════════════════════════ */

function baseUrl() {
  const u = (WELLNESS_ASSISTANT_URL || '').replace(/\/+$/, '');
  return u || null;
}
function readSync() {
  const s = defaultStorage();
  const v = s ? readJSON(s, SYNC_KEY, null) : null;
  return v && typeof v === 'object'
    ? { token: v.token || null, cursor: Number(v.cursor) || 0, lastSyncAt: v.lastSyncAt || null, ackQueue: Array.isArray(v.ackQueue) ? v.ackQueue : [] }
    : { token: null, cursor: 0, lastSyncAt: null, ackQueue: [] };
}
function writeSync(next) {
  const s = defaultStorage();
  if (s) writeJSON(s, SYNC_KEY, next);
}
function notifyApplied(count) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(APPLIED_EVENT, { detail: { count } }));
    }
  } catch (_) { /* ignore */ }
}

/** @returns {{ paired:boolean, lastSyncAt:string|null }} */
export function getPairingState() {
  const s = readSync();
  return { paired: !!s.token, lastSyncAt: s.lastSyncAt };
}
export function isPaired() {
  return !!readSync().token;
}

/** Exchange a 6-char pairing code for a long-lived read-only device token. */
export async function pairDevice(code) {
  const url = baseUrl();
  if (!url) return { ok: false, reason: 'no_base_url' };
  const trimmed = String(code || '').trim();
  if (!trimmed) return { ok: false, reason: 'empty_code' };
  let res;
  try {
    res = await fetch(`${url}/api/device/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed, label: 'PPW App' }),
    });
  } catch (_) {
    return { ok: false, reason: 'offline' };
  }
  if (!res.ok) return { ok: false, reason: res.status === 400 || res.status === 404 ? 'bad_code' : 'http_' + res.status };
  let data;
  try { data = await res.json(); } catch (_) { return { ok: false, reason: 'bad_response' }; }
  if (!data || !data.token) return { ok: false, reason: 'bad_response' };
  const s = readSync();
  writeSync({ ...s, token: data.token, cursor: 0, ackQueue: [] });
  const r = await syncNow();
  return { ok: true, applied: r.applied || 0 };
}

/**
 * Disconnect this device. The app only holds a read-only device token; the
 * server-side revoke route is SESSION-gated (the user revokes from the
 * assistant app/admin), so disconnect here clears the local token + cursor +
 * ack queue, which stops all sync immediately.
 */
export function unpairDevice() {
  writeSync({ token: null, cursor: 0, lastSyncAt: null, ackQueue: [] });
  return { ok: true };
}

/** Queue an ack (e.g. when the user locally deletes an assistant-created row). */
export function queueAck(opId, status) {
  if (!opId) return;
  const s = readSync();
  if (!s.token) return; // unpaired → nothing to report
  const ackQueue = [...s.ackQueue, { id: String(opId), status: status === 'applied' ? 'applied' : 'deleted' }];
  writeSync({ ...s, ackQueue });
  // best-effort immediate flush; failure keeps the queue for the next sync.
  flushAcks();
}

/** POST any queued acks; drop the ones the server accepted. */
export async function flushAcks() {
  const url = baseUrl();
  const s = readSync();
  if (!url || !s.token || s.ackQueue.length === 0) return { ok: false, reason: 'noop' };
  const batch = s.ackQueue.slice(0, 1000);
  try {
    const res = await fetch(`${url}/api/plan/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` },
      body: JSON.stringify({ ops: batch }),
    });
    if (!res.ok) return { ok: false, reason: 'http_' + res.status };
  } catch (_) {
    return { ok: false, reason: 'offline' };
  }
  const after = readSync();
  writeSync({ ...after, ackQueue: after.ackQueue.slice(batch.length) });
  return { ok: true, acked: batch.length };
}

/** Pull patches since the cursor, apply them, advance the cursor, flush acks. */
export async function syncNow() {
  const url = baseUrl();
  const s = readSync();
  if (!url || !s.token) return { ok: false, reason: 'unpaired' };
  let res;
  try {
    res = await fetch(`${url}/api/plan/patches?since=${s.cursor || 0}`, {
      headers: { Authorization: `Bearer ${s.token}` },
    });
  } catch (_) {
    return { ok: false, reason: 'offline' };
  }
  if (res.status === 401) { unpairDevice(); return { ok: false, reason: 'revoked' }; }
  if (!res.ok) return { ok: false, reason: 'http_' + res.status };
  let data;
  try { data = await res.json(); } catch (_) { return { ok: false, reason: 'bad_response' }; }
  const ops = Array.isArray(data && data.ops) ? data.ops : [];
  const storage = defaultStorage();
  const appliedIds = [];
  for (const op of ops) {
    const r = applyPlanOp(op, storage);
    if (r.applied && op && op.id) appliedIds.push(op.id);
  }
  const after = readSync();
  const nextCursor = typeof data.nextSeq === 'number' ? data.nextSeq : after.cursor;
  const ackQueue = [...after.ackQueue, ...appliedIds.map(id => ({ id, status: 'applied' }))];
  writeSync({ ...after, cursor: nextCursor, lastSyncAt: nowISOorNull(), ackQueue });
  if (appliedIds.length) notifyApplied(appliedIds.length);
  await flushAcks();
  return { ok: true, applied: appliedIds.length, pulled: ops.length };
}

/**
 * Wire the sync triggers: one pull on launch + one on every return-to-foreground
 * (visibilitychange → visible). Returns a teardown fn. No-op outside a browser
 * or when unpaired.
 */
export function initAssistantSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  syncNow();
  const onVisibility = () => { if (document.visibilityState === 'visible') syncNow(); };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}
