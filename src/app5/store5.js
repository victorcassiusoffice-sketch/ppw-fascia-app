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
    { id: 'd4', title: 'I did enough today. I am consistent.', meta: 'Affirmation · Still', time: '21:00', kind: 'note', noteAnim: 'still', noteSpeed: 'med', noteDur: '5', repeat: 'daily' },
  ];
}

// ── initial state (subset in use so far; grows as screens are ported) ──
function initialState() {
  const def = {
    screen: 'stack',
    // theme
    skin: 'soft', bg: 'grey', soft: 'graphite', gelBg: 'zen', intensity: null, customBgUrl: null,
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
    // note / affirmation composer
    noteOpen: false, noteText: '', noteAnim: 'still', noteSpeed: 'med', noteTime: '09:00', noteDur: '5',
    // calendar → stack (per-date view; null = today)
    viewDate: null,
    // in-app media viewer (null = closed)
    playerItem: null,
    // completed-today sheet
    completedOpen: false,
    // repeat picker (repeatId = item being edited, null = closed)
    repeatId: null,
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
    if (g('premium') === '1') def.premium = true;
    if (g('orbTip') === '1') def.orbTipSeen = true;
    const ay = gj('a11y'); if (ay && typeof ay === 'object') def.a11y = { on: !!ay.on, zoom: (+ay.zoom >= .85 && +ay.zoom <= 1.4) ? +ay.zoom : 1 };
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

// ── add flows ──
export function parseYouTubeId(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
// build a stack item from a pasted share link. Returns { ok } or { upsell }.
export function addCustomUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return { ok: false };
  if (overLimit()) {
    setState({ premiumUpsell: 'You have reached the free limit of 10 stacks. Go Premium for unlimited stacks.' });
    return { upsell: true };
  }
  const id = 'u' + Date.now().toString(36);
  const time = '09:00';
  let item;
  const yt = parseYouTubeId(raw);
  if (yt) {
    item = { id, time, title: 'YouTube video', meta: 'YouTube', thumb: 'yt', repeat: 'daily', url: raw, embed: 'https://www.youtube.com/embed/' + yt + '?autoplay=1&playsinline=1&rel=0', thumbUrl: 'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg' };
  } else if (/spotify\.com|open\.spotify/.test(raw)) {
    item = { id, time, title: 'Spotify', meta: 'Spotify', thumb: 'sp', repeat: 'daily', url: raw };
  } else {
    let host = raw; try { host = new URL(raw).hostname.replace(/^www\./, ''); } catch {}
    item = { id, time, title: host, meta: 'Link', thumb: 'au', repeat: 'daily', url: raw };
  }
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
    id: 'n' + Date.now().toString(36), title: text, meta: 'Affirmation · ' + animLabel,
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
export function setPremium(on) { save('premium', on ? '1' : '0'); setState({ premium: !!on }); }

// ── React hook ──
export function useStore5() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
