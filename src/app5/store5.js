// ─────────────────────────────────────────────────────────────────────────
// store5.js — New Design app state + persistence.
//
// Ports the prototype DCLogic's state model + its localStorage persistence
// (the `ppw5.` key namespace — deliberately separate from the current app's
// `ppw.` keys, so the New Design runs on its own data and the old app is never
// touched). Faithful ports of starterDeck / itemOnDate / stackFor / date math.
//
// Exposed as a tiny external store (useSyncExternalStore) so any app5 screen
// subscribes with useStore5(). Grows one slice at a time as screens are ported.
// ─────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';
import { cachedPremium, fetchEntitlement, isSignedIn, signOut as membershipSignOut } from './membership.js';

const LS = (k) => 'ppw5.' + k;

// ── curated starter deck (verbatim from the prototype) ──
function starterDeck() {
  const yt = (xid, time, id, title, meta) => ({
    id: xid, time, title, meta, thumb: 'yt', repeat: 'daily',
    url: 'https://www.youtube.com/watch?v=' + id,
    embed: 'https://www.youtube.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0',
    thumbUrl: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg',
  });
  return [
    yt('d1', '07:30', 'v7AYKMP6rOE', 'Yoga For Complete Beginners', 'YouTube · Basic Yoga · 20 min'),
    yt('d2', '12:30', 'O-6f5wQXSu8', 'Guided Meditation for Calm', 'YouTube · Meditation · 10 min'),
    yt('d3', '17:00', 'UBMk30rjy0o', 'Full Body Workout, No Equipment', 'YouTube · Fitness · 20 min'),
    { id: 'd4', title: 'I did enough today. I am consistent.', meta: 'Text · Still', time: '21:00', kind: 'note', noteAnim: 'still', noteSpeed: 'med', noteDur: '5', repeat: 'daily' },
  ];
}

// ── initial state (subset in use so far; grows as screens are ported) ──
function initialState() {
  const def = {
    screen: 'stack',
    // theme
    skin: 'soft', bg: 'grey', soft: 'graphite', gelBg: 'zen', intensity: null, customBgUrl: null,
    glassStyle: 'frosted', inkMode: 'light',
    // routines (premium): [{ id, name, items: [snapshot…] }]
    routines: [],
    a11y: { on: false, zoom: 1 },
    // membership
    premium: false, premiumUpsell: null, orbTipSeen: false,
    // stack data
    deckItems: starterDeck(),
    doneByDate: {},
    suppSel: {},
    importedProtos: [],
    // media library (verbatim starters from the prototype)
    mediaItems: [
      { id: 'm1', title: 'Deep Tissue Soundscape', meta: 'Spotify · 20 min', thumb: 'sp', note: true, url: 'https://open.spotify.com' },
      { id: 'm2', title: 'Yoga For Complete Beginners', meta: 'YouTube · Basic Yoga · 20 min', thumb: 'yt', url: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', embed: 'https://www.youtube.com/embed/v7AYKMP6rOE?autoplay=1&playsinline=1&rel=0', thumbUrl: 'https://i.ytimg.com/vi/v7AYKMP6rOE/hqdefault.jpg' },
      { id: 'm3', title: 'Wim Hof Guided Breathing', meta: 'YouTube · Breathwork · 11 min', thumb: 'yt', url: 'https://www.youtube.com/watch?v=tybOi4hjZFQ', embed: 'https://www.youtube.com/embed/tybOi4hjZFQ?autoplay=1&playsinline=1&rel=0', thumbUrl: 'https://i.ytimg.com/vi/tybOi4hjZFQ/hqdefault.jpg' },
    ],
    // library tab
    stackTab: 'routines',
    // add sheet
    addOpen: false, customUrl: '', addedCustom: null,
    // library "Add to Stack" calendar picker
    scheduleTarget: null,
    // protocols from the GitHub manifest (item 1)
    protocols: [], protocolsStatus: 'idle',
    // note / affirmation composer
    noteOpen: false, noteText: '', noteAnim: 'still', noteSpeed: 'med', noteTime: '09:00', noteDur: '5',
    // calendar → stack (per-date view; null = today)
    viewDate: null,
    // in-app media viewer (null = closed)
    playerItem: null,
    // completed-today sheet
    completedOpen: false,
    // runtime popups: slot reminder banner + full-screen note (affirmation)
    slotPop: null, notePop: null, eatingNow: false, autoplay: false,
    // general prefs
    sounds: true,
    // repeat picker (repeatId = item being edited, null = closed)
    repeatId: null,
    // terms & health disclaimer overlay
    termsOpen: false,
    // onboarding (first run: onboarded=false → wizard over the app)
    onboarded: false, obStep: 0, termsOk: false,
    obLifestyle: ['Office & desk-bound'], obAnchors: [], obInterests: ['Meditation'],
    obLevels: { Yoga: 5, Fitness: 5, Meditation: 5, Breathwork: 5, 'Cold exposure': 5 },
    obCustom: '', obBody: ['Stress'],
    obModules: { Routines: true, Media: true, Protocols: true, Supplements: false },
    discreet: true, dayT: { wake: '07:00', bed: '22:30', ws: '09:00', we: '17:00' },
    fastOn: false, eatOpen: '12:00', eatClose: '20:00',
    reminders: true,
    integrations: { spotify: false, youtube: true },
    courseLinks: [], courseLabel: '', courseUrl: '',
    obCreators: [], creatorInput: '',
    // selection / interaction
    selectedIds: [],
    // completed
    completed: [], completedDate: null,
  };
  try {
    const g = (k) => localStorage.getItem(LS(k));
    const gj = (k) => { try { return JSON.parse(g(k) || 'null'); } catch { return null; } };
    if (g('bg') && g('bg') !== 'custom') def.bg = g('bg');
    if (g('soft')) def.soft = g('soft');
    if (g('skin')) def.skin = g('skin');
    if (g('gelBg') && g('gelBg') !== 'custom') def.gelBg = g('gelBg');
    if (g('intensity')) def.intensity = g('intensity');
    // PREMIUM (G3, 2026-07-28): NOT hydrated from a bare localStorage flag any
    // more. `ppw5.premium` used to be the whole paywall — set it to '1' in
    // DevTools and everything unlocked. It is now only a mirror of the last
    // server answer; cachedPremium() re-checks that the user is still signed in,
    // that the value came from a verified /api/me/entitlement read, that it isn't
    // stale, and that the paid period hasn't lapsed. Only the server grants Premium.
    def.premium = cachedPremium();
    if (g('orbTip') === '1') def.orbTipSeen = true;
    if (g('onboarded') === '1') def.onboarded = true;
    if (g('terms') === '1') def.termsOk = true;
    if (g('reminders')) def.reminders = g('reminders') === '1';
    if (g('sounds') === '0') def.sounds = false;
    if (g('autoplay') === '1') def.autoplay = true;
    if (g('glassStyle')) def.glassStyle = g('glassStyle');
    if (g('inkMode')) def.inkMode = g('inkMode');
    const rt = gj('routines'); if (Array.isArray(rt)) def.routines = rt;
    const ay = gj('a11y'); if (ay && typeof ay === 'object') def.a11y = { on: !!ay.on, zoom: (+ay.zoom >= .85 && +ay.zoom <= 1.4) ? +ay.zoom : 1 };
    const cs = gj('courses'); if (Array.isArray(cs)) def.courseLinks = cs;
    const ig = gj('integrations'); if (ig && typeof ig === 'object') def.integrations = ig;
    const pf = gj('prefs');
    if (pf && typeof pf === 'object') {
      if (Array.isArray(pf.l)) def.obLifestyle = pf.l;
      if (Array.isArray(pf.b)) def.obBody = pf.b;
      if (Array.isArray(pf.i)) def.obInterests = pf.i;
      if (typeof pf.c === 'string') def.obCustom = pf.c;
      if (pf.lv && typeof pf.lv === 'object') def.obLevels = { ...def.obLevels, ...pf.lv };
      if (Array.isArray(pf.a)) def.obAnchors = pf.a;
      if (Array.isArray(pf.cr)) def.obCreators = pf.cr;
    }
    const pf2 = gj('prefs2');
    if (pf2 && typeof pf2 === 'object') {
      if (typeof pf2.d === 'boolean') def.discreet = pf2.d;
      if (pf2.t && pf2.t.wake) def.dayT = pf2.t;
      if (pf2.f) { def.fastOn = !!pf2.f.on; if (pf2.f.o) def.eatOpen = pf2.f.o; if (pf2.f.c) def.eatClose = pf2.f.c; }
    }
    // stacks live in one consolidated blob; legacy per-key blobs load as fallback
    const st = gj('stacks') || {};
    const di = Array.isArray(st.d) ? st.d : gj('deckItems'); if (Array.isArray(di) && di.length) def.deckItems = di;
    const db = (st.db && typeof st.db === 'object') ? st.db : gj('doneByDate'); if (db && typeof db === 'object') def.doneByDate = db;
    const ss = (st.ss && typeof st.ss === 'object') ? st.ss : gj('suppSel'); if (ss && typeof ss === 'object') def.suppSel = ss;
    const ip = Array.isArray(st.ip) ? st.ip : gj('importedProtos'); if (Array.isArray(ip)) def.importedProtos = ip;
  } catch { /* private mode / storage off → defaults */ }
  return def;
}

// ── external store plumbing ──
let state = initialState();
const listeners = new Set();
function emit() { for (const l of listeners) l(); }
function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return state; }

// merge + notify (React-setState-like). Accepts object or updater fn.
export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  emit();
}
export function getState() { return state; }

export function save(k, v) { try { localStorage.setItem(LS(k), String(v)); } catch {} }

// consolidated, debounced stacks write; completed-history pruned to 60 days
let _saveT = null;
function writeStacks() {
  try {
    const today = todayKey();
    const db = {};
    Object.keys(state.doneByDate).forEach((k) => {
      const d = dayDiff(today, k);
      if (d <= 60 && d > -400) db[k] = state.doneByDate[k];
    });
    localStorage.setItem(LS('stacks'), JSON.stringify({
      d: state.deckItems.filter((x) => !x.local), db, ss: state.suppSel, ip: state.importedProtos,
    }));
    ['deckItems', 'doneByDate', 'suppSel', 'importedProtos'].forEach((k) => localStorage.removeItem(LS(k)));
  } catch {}
}
export function saveStacks() {
  if (_saveT) clearTimeout(_saveT);
  _saveT = setTimeout(() => { _saveT = null; writeStacks(); }, 200);
}

// ── date math + recurrence (verbatim from the prototype) ──
export function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
export function keyToDate(k) { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
export function dayDiff(aKey, bKey) { return Math.round((keyToDate(aKey) - keyToDate(bKey)) / 86400000); }
export function itemOnDate(it, key) {
  if (!it.anchor) return true; // legacy items — every day
  const d = dayDiff(key, it.anchor);
  const r = it.repeat === undefined ? 'daily' : it.repeat;
  if (r === 'once') return d === 0;
  if (d < 0) return false;
  if (r === 'daily') return true;
  if (r === 'weekly') return d % 7 === 0;
  const n = parseInt(r, 10);
  return n > 1 ? d % n === 0 : true;
}
// items scheduled on `key`, excluding those already marked done that day.
export function stackFor(key) {
  const done = (state.doneByDate[key] || []).map((x) => x.id);
  return state.deckItems.filter((it) => itemOnDate(it, key) && done.indexOf(it.id) === -1);
}

// ── stack operations ──
export function overLimit() { return !state.premium && state.deckItems.length >= 10; }

export function markDone(id, key = todayKey()) {
  const it = state.deckItems.find((x) => x.id === id);
  if (!it) return;
  const prev = state.doneByDate[key] || [];
  if (prev.some((x) => x.id === id)) return;
  setState({ doneByDate: { ...state.doneByDate, [key]: [...prev, { id, at: Date.now() }] } });
  saveStacks();
}
export function undoDone(id, key = todayKey()) {
  const prev = state.doneByDate[key] || [];
  setState({ doneByDate: { ...state.doneByDate, [key]: prev.filter((x) => x.id !== id) } });
  saveStacks();
}
export function setItemTime(id, time) {
  setState({ deckItems: state.deckItems.map((it) => it.id === id ? { ...it, time } : it) });
  saveStacks();
}
export function deleteItem(id) {
  setState({ deckItems: state.deckItems.filter((it) => it.id !== id), selectedIds: state.selectedIds.filter((x) => x !== id) });
  saveStacks();
}
export function reorderDeck(orderedIds) {
  const byId = Object.fromEntries(state.deckItems.map((it) => [it.id, it]));
  setState({ deckItems: orderedIds.map((id) => byId[id]).filter(Boolean) });
  saveStacks();
}
// per-item autoplay tickbox — when set, the slot engine opens the item at its
// time without a Play press (Vic #1).
export function toggleAuto(id) {
  setState({ deckItems: state.deckItems.map((it) => it.id === id ? { ...it, auto: !it.auto } : it) });
  saveStacks();
}
// no-time stacks (Vic #3, "Always Next Up first"): time:null → the item queues
// at the very top as Next Up, ahead of all timed items, in deck order.
export function setNoTime(id, on) {
  setState({ deckItems: state.deckItems.map((it) => it.id === id ? { ...it, time: on ? null : (it._lastTime || '09:00'), _lastTime: on ? (it.time || '09:00') : it._lastTime } : it) });
  saveStacks();
}
// day-ordered view: no-time items first (deck order), then timed sorted by time.
const _toMin = (t) => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export function orderedStackFor(key) {
  const items = stackFor(key);
  const noTime = items.filter((x) => !x.time);
  const timed = items.filter((x) => !!x.time).sort((a, b) => _toMin(a.time) - _toMin(b.time));
  return [...noTime, ...timed];
}
// drag reorder, times-stay-with-positions (Vic #2): the day's sorted times are
// fixed slots; dragging re-assigns which TIMED stack occupies which slot.
// orderedTimedIds = the timed items' ids in their new visual order.
export function reorderTimed(key, orderedTimedIds) {
  const timed = stackFor(key).filter((x) => !!x.time);
  const slots = timed.map((x) => x.time).sort((a, b) => _toMin(a) - _toMin(b));
  const timeById = {};
  orderedTimedIds.forEach((id, i) => { if (slots[i] !== undefined) timeById[id] = slots[i]; });
  setState({ deckItems: state.deckItems.map((it) => timeById[it.id] !== undefined ? { ...it, time: timeById[it.id] } : it) });
  saveStacks();
}

// ── routines (Vic #5, premium): named bundles of stacks, applied to a day ──
export function saveRoutines(list) {
  setState({ routines: list });
  try { localStorage.setItem(LS('routines'), JSON.stringify(list)); } catch {}
}
export function createRoutine(name, items) {
  // G1 (2026-07-28): the store enforces this, not just the UI. LibraryScreen hides
  // the builder from free users, but hiding a button is not a paywall — anything
  // that can reach this function (a stale view, a future caller, the console) was
  // able to create routines for free until this guard existed.
  if (!state.premium) {
    setState({ premiumUpsell: 'Routines are part of Premium — bundle stacks and drop them onto any day in one tap.' });
    return null;
  }
  const r = { id: 'rt' + Date.now().toString(36), name: String(name).trim(), items };
  saveRoutines([...state.routines, r]);
  return r;
}
export function deleteRoutine(id) { saveRoutines(state.routines.filter((r) => r.id !== id)); }
// edit a saved routine in place (Vic 1c)
export function updateRoutine(id, patch) {
  saveRoutines(state.routines.map((r) => r.id === id ? { ...r, ...patch } : r));
}

// ── stack selection + bulk delete (Vic 4/4b) ──
export function toggleSelect(id) {
  const sel = state.selectedIds.includes(id) ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id];
  setState({ selectedIds: sel });
}
export function selectAll(ids) { setState({ selectedIds: [...new Set([...state.selectedIds, ...ids])] }); }
export function clearSelection() { setState({ selectedIds: [] }); }
export function deleteSelected() {
  const sel = new Set(state.selectedIds);
  if (!sel.size) return;
  setState({ deckItems: state.deckItems.filter((it) => !sel.has(it.id)), selectedIds: [] });
  saveStacks();
}
// ── Protocols from the build-time bundled manifest (Vic item 1) ──
// Upsell copy shown when a non-Premium user taps a `monetised` protocol. Free
// protocols never hit this — they open for everyone as a lead magnet.
export const PREMIUM_PROTOCOL_UPSELL = 'This protocol is part of Premium. Unlock to open the full PDF and add it to any day.';
let _protocolsLoaded = false;
export async function loadProtocols() {
  if (_protocolsLoaded) return;
  _protocolsLoaded = true;
  setState({ protocolsStatus: 'loading' });
  const { fetchProtocols } = await import('./protocols5.js');
  const { status, list } = await fetchProtocols();
  setState({ protocols: list, protocolsStatus: status });
}

// ── Library "Add to Stack" via calendar picker (Vic item 2) ──
// scheduleTarget: { type: 'item', item } | { type: 'routine', id } | null
export function openSchedule(target) { setState({ scheduleTarget: target }); }
export function closeSchedule() { setState({ scheduleTarget: null }); }
// schedule one item snapshot onto an arbitrary date (repeat once, anchored)
export function addItemToDate(snapshot, dateKey, time = '09:00') {
  if (!state.premium && state.deckItems.length + 1 > 10) {
    setState({ premiumUpsell: 'You have reached the free limit of 10 stacks. Go Premium for unlimited stacks.' });
    return { upsell: true };
  }
  const { id, anchor, repeat, ...rest } = snapshot;
  const item = { ...rest, id: 'sc' + Date.now().toString(36), time: snapshot.time || time, anchor: dateKey, repeat: 'once' };
  setState({ deckItems: [...state.deckItems, item] });
  saveStacks();
  return { ok: true, item };
}

// add a Document stack to today (file already saved to IndexedDB → fileId)
export function addDocToToday(name, fileId) {
  if (overLimit()) { setState({ premiumUpsell: 'You have reached the free limit of 10 stacks. Go Premium for unlimited stacks.' }); return { upsell: true }; }
  const item = { id: 'doc' + Date.now().toString(36), title: name, meta: 'Document', thumb: 'doc', kind: 'doc', fileId, time: '09:00', repeat: 'daily' };
  setState({ deckItems: [...state.deckItems, item], addedCustom: item });
  saveStacks();
  return { ok: true, item };
}

// ── routine sharing via Markdown (Vic 2026-07-06) ──
// Human-readable MD with a fenced `ppw-routine` JSON block as the lossless
// machine payload. Import looks for the block first; the prose is for people.
export function routineToMd(r) {
  const lines = [
    `# ${r.name}`,
    '',
    `PPW Routine · ${r.items.length} stack${r.items.length === 1 ? '' : 's'} · shared from the PPW Fascia App`,
    '',
    'To use it: open the app → ＋ Add → **Import routine** → pick this file.',
    '',
    '## Stacks',
    '',
    ...r.items.map((it, i) => {
      const head = `${i + 1}. **${it.title}**${it.meta ? ` — ${it.meta}` : ''}${it.time ? ` · ${it.time}` : ''}`;
      return it.url ? head + `\n   ${it.url}` : head;
    }),
    '',
    '```ppw-routine',
    JSON.stringify({ ppw: 'routine', v: 1, name: r.name, items: r.items }, null, 2),
    '```',
    '',
  ];
  return lines.join('\n');
}
// SECURITY (2026-07-28): only absolute http(s) URLs may ever reach an <a href>
// or an <iframe src>. Item urls arrive from THREE untrusted places — an imported
// .md routine (someone else's file), a pasted share link, and (soon) an
// AI-generated plan — and are rendered raw in App5.jsx / MediaViewer.jsx. A
// `javascript:` or `data:` url there executes on tap. Strict allow-list: the
// string must literally begin with http:// or https://, so javascript:, data:,
// vbscript:, blob:, and protocol-relative //evil.com are all rejected.
export function safeUrl(u) {
  if (typeof u !== 'string') return undefined;
  const s = u.trim();
  if (!/^https?:\/\//i.test(s)) return undefined;
  try { new URL(s); } catch { return undefined; }
  return s.slice(0, 500);
}

export function parseRoutineMd(text) {
  try {
    const m = /```ppw-routine\s*([\s\S]*?)```/.exec(String(text));
    if (!m) return { ok: false, reason: 'no-block' };
    const data = JSON.parse(m[1]);
    if (data.ppw !== 'routine' || !Array.isArray(data.items) || !data.items.length) return { ok: false, reason: 'bad-shape' };
    // sanitise: only known fields survive the import
    const items = data.items.map((it) => ({
      title: String(it.title || 'Stack').slice(0, 120),
      meta: it.meta ? String(it.meta).slice(0, 120) : undefined,
      thumb: typeof it.thumb === 'string' ? it.thumb.slice(0, 8) : undefined,
      url: safeUrl(it.url),
      embed: safeUrl(it.embed),
      thumbUrl: safeUrl(it.thumbUrl),
      kind: it.kind === 'note' ? 'note' : undefined,
      time: /^\d{1,2}:\d{2}$/.test(it.time || '') ? it.time : undefined,
    }));
    return { ok: true, name: String(data.name || 'Shared routine').slice(0, 60), items };
  } catch {
    return { ok: false, reason: 'parse' };
  }
}
// bulk-add imported stacks to TODAY (repeat once, staggered from 09:00 when
// untimed). Free tier: respects the 10-stack cap → upsell.
export function addItemsToToday(items) {
  if (!state.premium && state.deckItems.length + items.length > 10) {
    setState({ premiumUpsell: 'You have reached the free limit of 10 stacks. Go Premium for unlimited stacks.' });
    return { upsell: true };
  }
  const key = todayKey();
  const base = 9 * 60;
  const added = items.map((item, i) => ({
    ...item,
    id: 'im' + Date.now().toString(36) + i,
    time: item.time || (String(Math.floor((base + i * 30) / 60)).padStart(2, '0') + ':' + String((base + i * 30) % 60).padStart(2, '0')),
    anchor: key, repeat: 'once',
  }));
  setState({ deckItems: [...state.deckItems, ...added] });
  saveStacks();
  return { ok: true, count: added.length };
}
// add every stack in the routine to the given date at once (repeat: once,
// anchored to that day). Items keep their saved times, staggered from 09:00
// in 30-min steps when they don't have one.
export function applyRoutineToDate(routineId, dateKey) {
  const r = state.routines.find((x) => x.id === routineId);
  if (!r) return { ok: false };
  if (!state.premium) { setState({ premiumUpsell: 'Routines are part of Premium — bundle stacks and drop them onto any day in one tap.' }); return { upsell: true }; }
  const base = 9 * 60;
  const added = r.items.map((item, i) => {
    const { id, anchor, repeat, ...rest } = item;
    const t = item.time || (String(Math.floor((base + i * 30) / 60)).padStart(2, '0') + ':' + String((base + i * 30) % 60).padStart(2, '0'));
    return { ...rest, id: 'ra' + Date.now().toString(36) + i, time: t, anchor: dateKey, repeat: 'once' };
  });
  setState({ deckItems: [...state.deckItems, ...added] });
  saveStacks();
  return { ok: true, count: added.length };
}

// ── add flows ──
export function parseYouTubeId(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
// build a stack-item SNAPSHOT (no id/time) from a pasted share link — shared
// by the main ＋ Add and the Routine builder.
export function itemFromUrl(url) {
  // Reject anything that isn't an absolute http(s) link before it can be stored
  // and later rendered into an <a href> (see safeUrl).
  const raw = safeUrl(url);
  if (!raw) return null;
  const yt = parseYouTubeId(raw);
  if (yt) return { title: 'YouTube video', meta: 'YouTube', thumb: 'yt', url: raw, embed: 'https://www.youtube.com/embed/' + yt + '?autoplay=1&playsinline=1&rel=0', thumbUrl: 'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg' };
  if (/spotify\.com|open\.spotify/.test(raw)) return { title: 'Spotify', meta: 'Spotify', thumb: 'sp', url: raw };
  let host = raw; try { host = new URL(raw).hostname.replace(/^www\./, ''); } catch {}
  return { title: host, meta: 'Link', thumb: 'au', url: raw };
}
// add a pasted share link to today's stack. Returns { ok } or { upsell }.
export function addCustomUrl(url) {
  const snap = itemFromUrl(url);
  if (!snap) return { ok: false };
  if (overLimit()) {
    setState({ premiumUpsell: 'You have reached the free limit of 10 stacks. Go Premium for unlimited stacks.' });
    return { upsell: true };
  }
  const item = { ...snap, id: 'u' + Date.now().toString(36), time: '09:00', repeat: 'daily' };
  setState({ deckItems: [...state.deckItems, item], addedCustom: item, customUrl: '' });
  saveStacks();
  return { ok: true, item };
}
// add a library item into today's stack (free-tier cap → upsell). Returns bool added.
export function addToStack(libItem, time = '09:00') {
  if (overLimit()) { setState({ premiumUpsell: 'You have reached the free limit of 10 stacks. Go Premium for unlimited stacks.' }); return false; }
  const id = 'l' + Date.now().toString(36);
  const { note, ...rest } = libItem;
  setState({ deckItems: [...state.deckItems, { ...rest, id, time, repeat: 'daily' }] });
  saveStacks();
  return true;
}
export function setTab(tab) { setState({ stackTab: tab }); }
// in-app media viewer
export function openPlayer(item) { if (item) setState({ playerItem: item }); }
export function closePlayer() { setState({ playerItem: null }); }

// ── runtime slot engine (ported from the prototype's _slotTimer, 20s tick) ──
// Fires when a slot's time arrives: notes → full-screen affirmation popup
// (auto-dismiss per its duration); media with autoplay → opens the player;
// otherwise (reminders on) → the slot reminder banner. Also announces the
// fasting window opening/closing.
let _noteTimer = null;
export function showNotePop(note) {
  if (_noteTimer) clearTimeout(_noteTimer);
  setState({ notePop: note });
  if (note.dur !== 'stay') {
    const ms = (note.dur === '15' ? 15 : 5) * 1000;
    _noteTimer = setTimeout(() => setState({ notePop: null }), ms);
  }
}
export function closeNotePop() { if (_noteTimer) clearTimeout(_noteTimer); setState({ notePop: null }); }
export function dismissSlotPop() { setState({ slotPop: null }); }

let _slotTimer = null, _lastFire = null, _lastFast = null;
export function startSlotEngine() {
  if (_slotTimer) return () => {};
  _slotTimer = setInterval(() => {
    const S = state;
    const now = new Date();
    const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const key = todayKey();
    if (S.fastOn && S.reminders) {
      if (hm === S.eatOpen && _lastFast !== key + '|open') { _lastFast = key + '|open'; setState({ slotPop: { id: null, title: 'Eating window open', time: hm, hasUrl: false } }); return; }
      if (hm === S.eatClose && _lastFast !== key + '|close') { _lastFast = key + '|close'; setState({ slotPop: { id: null, title: 'Eating window closed · fasting begins', time: hm, hasUrl: false } }); return; }
    }
    const eating = S.fastOn ? (hm >= S.eatOpen && hm < S.eatClose) : false;
    if (eating !== S.eatingNow) setState({ eatingNow: eating });
    const item = stackFor(key).find((x) => x.time === hm);
    if (!item) return;
    const fireKey = key + '|' + item.id + '|' + hm;
    if (_lastFire === fireKey) return;
    _lastFire = fireKey;
    if (item.kind === 'note') { showNotePop({ text: item.title, anim: item.noteAnim, speed: item.noteSpeed, dur: item.noteDur }); return; }
    if (item.url && (S.autoplay || item.auto)) { setState({ playerItem: item, slotPop: null }); return; }
    if (S.reminders) { setState({ slotPop: { id: item.id, title: item.title, time: item.time, hasUrl: !!(item.url || item.embed) } }); }
  }, 20000);
  return () => { clearInterval(_slotTimer); _slotTimer = null; };
}

// note popup animation css (verbatim mapping from the prototype)
export function noteAnimCss(anim, sp) {
  const d = { slow: { flash: '1.4s', pulse: '2.6s', marquee: '14s' }, med: { flash: '.8s', pulse: '1.6s', marquee: '9s' }, fast: { flash: '.4s', pulse: '.9s', marquee: '5s' } }[sp || 'med'];
  if (anim === 'flash') return 'ppwNoteFlash ' + d.flash + ' steps(1,end) infinite';
  if (anim === 'pulse') return 'ppwNotePulse ' + d.pulse + ' ease-in-out infinite';
  if (anim === 'marquee') return 'ppwNoteMarquee ' + d.marquee + ' linear infinite';
  return 'none';
}
// completed-today sheet
export function openCompleted() { setState({ completedOpen: true }); }
export function closeCompleted() { setState({ completedOpen: false }); }
// repeat picker — set an item's recurrence (stamps an anchor so weekly/every-N works)
export function openRepeat(id) { setState({ repeatId: id }); }
export function closeRepeat() { setState({ repeatId: null }); }
export function setRepeat(id, value) {
  setState({ deckItems: state.deckItems.map((it) => it.id === id
    ? { ...it, repeat: value, anchor: it.anchor || todayKey() }
    : it) });
  saveStacks();
}
export function openTerms() { setState({ termsOpen: true }); }
export function closeTerms() { setState({ termsOpen: false }); }

// ── onboarding ──
export function savePrefsNow() {
  const S = state;
  save('prefs', JSON.stringify({ l: S.obLifestyle, b: S.obBody, i: S.obInterests, c: S.obCustom, lv: S.obLevels, a: S.obAnchors, cr: S.obCreators }));
}
export function finishOnboarding() {
  const S = state;
  save('onboarded', 1);
  save('terms', S.termsOk ? 1 : 0);
  save('reminders', S.reminders ? 1 : 0);
  save('integrations', JSON.stringify(S.integrations));
  save('courses', JSON.stringify(S.courseLinks));
  savePrefsNow();
  save('prefs2', JSON.stringify({ d: S.discreet, t: S.dayT, f: { on: S.fastOn, o: S.eatOpen, c: S.eatClose } }));
  setState({ onboarded: true, obStep: 0, screen: 'stack' });
}
// toggle a value in a string-array field (chip select)
export function toggleInList(key, label) {
  const arr = state[key] || [];
  setState({ [key]: arr.includes(label) ? arr.filter((x) => x !== label) : arr.concat(label) });
}
export function repeatLabel(repeat) {
  const r = repeat === undefined ? 'daily' : repeat;
  if (r === 'daily') return 'Every day';
  if (r === 'weekly') return 'Weekly';
  if (r === 'once') return 'Just once';
  const n = parseInt(r, 10);
  return n > 1 ? `Every ${n} days` : 'Every day';
}
// today's completed entries joined with their item (title/time), newest first
export function completedToday(key = todayKey()) {
  const done = state.doneByDate[key] || [];
  return done.map((d) => {
    const it = state.deckItems.find((x) => x.id === d.id) || {};
    return { id: d.id, at: d.at, title: it.title || 'Item', time: it.time || '' };
  }).sort((a, b) => (b.at || 0) - (a.at || 0));
}
// open a specific date's stack (null / today → clear viewDate)
export function openStackForDate(key) {
  const isToday = !key || key === todayKey();
  setState({ viewDate: isToday ? null : key, screen: 'stack' });
}
export function backToToday() { setState({ viewDate: null }); }
// all items scheduled on `key` (incl. done — for calendar preview). done flag attached.
export function itemsForDate(key) {
  const done = (state.doneByDate[key] || []).map((x) => x.id);
  return state.deckItems.filter((it) => itemOnDate(it, key)).map((it) => ({ ...it, done: done.indexOf(it.id) !== -1 }));
}
export function openAdd() { setState({ addOpen: true }); }
export function closeAdd() { setState({ addOpen: false, addedCustom: null, noteOpen: false }); }

// note / affirmation composer
export function openNoteComposer() { setState({ noteOpen: true }); }
export function setNoteField(patch) { setState(patch); }
export function addNote() {
  const text = String(state.noteText || '').trim();
  if (!text) return { ok: false };
  if (overLimit()) { setState({ premiumUpsell: 'You have reached the free limit of 10 stacks. Go Premium for unlimited stacks.' }); return { upsell: true }; }
  const anim = state.noteAnim || 'still';
  const animLabel = anim.charAt(0).toUpperCase() + anim.slice(1);
  const item = {
    id: 'n' + Date.now().toString(36), title: text, meta: 'Text · ' + animLabel,
    time: state.noteTime || '09:00', kind: 'note', noteAnim: anim, noteSpeed: state.noteSpeed || 'med',
    noteDur: state.noteDur || '5', repeat: 'daily',
  };
  setState({ deckItems: [...state.deckItems, item], noteOpen: false, addOpen: false, noteText: '' });
  saveStacks();
  return { ok: true, item };
}
export function setCustomUrl(v) { setState({ customUrl: v }); }
export function goLibrary(tab) { setState({ addOpen: false, addedCustom: null, screen: 'library', ...(tab ? { stackTab: tab } : {}) }); }
export function setUpsell(reason) { setState({ premiumUpsell: reason }); }
export function clearUpsell() { setState({ premiumUpsell: null }); }

// theme setters
export function setTheme(patch) {
  Object.entries(patch).forEach(([k, v]) => save(k, v));
  setState(patch);
}
// ── membership (server-verified) ──────────────────────────────────────────────
// There is no setPremium(true) any more. Premium is whatever the backend last
// said it was; the only way into that state is a real, verified purchase.

/** Apply a verified answer from /api/me/entitlement. */
export function applyServerEntitlement(ent) {
  setState({ premium: !!(ent && ent.premium) });
  return !!(ent && ent.premium);
}

/**
 * Ask the server what this user is entitled to and unlock accordingly. Safe to
 * call on boot, on app-resume and after sign-in. Signed-out users are free-tier
 * with no network call at all. If the request fails (offline, server down) the
 * cached value stands — we never lock a paying member out over a dropped request.
 */
export async function syncEntitlement() {
  if (!isSignedIn()) { setState({ premium: cachedPremium() }); return false; }
  try {
    return applyServerEntitlement(await fetchEntitlement());
  } catch {
    setState({ premium: cachedPremium() });
    return state.premium;
  }
}

export function signOutMembership() {
  membershipSignOut();
  setState({ premium: false });
}
// general prefs (prototype key encodings)
export function setSounds(on) { save('sounds', on ? '1' : '0'); setState({ sounds: !!on }); }
export function setReminders(on) { save('reminders', on ? '1' : '0'); setState({ reminders: !!on }); }
export function setAutoplay(on) { save('autoplay', on ? '1' : '0'); setState({ autoplay: !!on }); }
// vision / a11y — easy-read (bold + full-strength dim) and zoom (.85–1.4)
export function setA11y(patch) {
  const a = { on: !!(patch.on !== undefined ? patch.on : state.a11y.on), zoom: patch.zoom !== undefined ? patch.zoom : state.a11y.zoom };
  a.zoom = Math.round(Math.min(1.4, Math.max(.85, a.zoom)) * 100) / 100;
  save('a11y', JSON.stringify(a));
  setState({ a11y: a });
}

// ── React hook ──
export function useStore5() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
