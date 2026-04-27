// Protocol fetch + caching layer.
// Pulls from PROTOCOLS_JSON_URL or falls back to /mock-protocol.json when USE_MOCK_DATA is true.

import { PROTOCOLS_JSON_URL, USE_MOCK_DATA, LS_KEYS } from './config.js';

const memCache = new Map();

function useMockOverride() {
  try {
    const v = localStorage.getItem(LS_KEYS.USE_MOCK_OVERRIDE);
    if (v === 'true')  return true;
    if (v === 'false') return false;
  } catch (_) {}
  return null; // no override — use compile-time default
}

export function isMockActive() {
  const o = useMockOverride();
  return o == null ? USE_MOCK_DATA : o;
}

/* List of protocols available — for now: just mock-protocol when in mock mode,
   or a directory listing fetched from the GitHub raw endpoint. */
export async function listProtocols() {
  if (isMockActive()) {
    const p = await fetchProtocol('testosterone_standard_v1');
    return p ? [p] : [];
  }
  try {
    const r = await fetch(`${PROTOCOLS_JSON_URL}index.json`, { cache: 'no-cache' });
    if (!r.ok) return [];
    const idx = await r.json();
    const out = [];
    for (const id of idx.protocol_ids || []) {
      const p = await fetchProtocol(id);
      if (p) out.push(p);
    }
    return out;
  } catch (_) { return []; }
}

export async function fetchProtocol(protocolId) {
  if (memCache.has(protocolId)) return memCache.get(protocolId);
  let url;
  if (isMockActive()) {
    url = `${import.meta.env.BASE_URL || '/'}mock-protocol.json`;
  } else {
    url = `${PROTOCOLS_JSON_URL}${protocolId}.json`;
  }
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    const json = await r.json();
    memCache.set(protocolId, json);
    return json;
  } catch (_) {
    return null;
  }
}

/* ─── Daily timeline merging ─── */
// Returns a flat sorted list of items from all sources tagged with their kind.
//   kind: 'protocol' | 'routine' | 'audio'
//   id:   stable id used for done-tracking
export function mergeDailyItems({ protocols, activeRoutines, activeModuleEntries }) {
  const items = [];

  // 1. Protocol daily_plan items
  for (const p of protocols) {
    if (!p?.sections?.daily_plan) continue;
    for (const e of p.sections.daily_plan) {
      items.push({
        kind: 'protocol',
        id: `proto::${p.protocol_id}::${e.time}::${e.category}`,
        time: e.time,
        category: e.category,
        label: e.label,
        duration_min: e.duration_min || 0,
        notes: e.notes,
        media_ref: e.media_ref || e.fascia_routine?.media_ref || null,
        fascia_routine: e.fascia_routine || null,
        protocol_id: p.protocol_id,
        protocol_topic: p.topic,
      });
    }
  }

  // 2. Body-zone routines (one consolidated entry, if any zones saved)
  if (activeRoutines?.savedZones?.length) {
    items.push({
      kind: 'routine',
      id: `routine::saved::${activeRoutines.scheduledTime}`,
      time: activeRoutines.scheduledTime || '08:00',
      category: 'fascia_routine',
      label: `My zones — ${activeRoutines.savedZones.length} zone${activeRoutines.savedZones.length === 1 ? '' : 's'} (${activeRoutines.level})`,
      duration_min: activeRoutines.savedZones.length * 5,
      zones: activeRoutines.savedZones,
      level: activeRoutines.level,
      lifestyle: activeRoutines.lifestyle,
    });
  }

  // 3. Audio modules
  for (const m of activeModuleEntries || []) {
    items.push({
      kind: 'audio',
      id: `audio::${m.slug}`,
      time: m.scheduledTime || '14:30',
      category: 'meditation',
      label: m.media?.title || m.slug,
      duration_min: Math.round((m.media?.duration_sec || 300) / 60),
      media_ref: m.media || null,
      slug: m.slug,
    });
  }

  // Sort by time ascending
  items.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  return items;
}
