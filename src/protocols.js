// Protocol fetch + caching layer.
// Pulls from PROTOCOLS_JSON_URL or falls back to public/*.json when USE_MOCK_DATA is true.
// In mock mode the catalog below is the source of truth — every protocol_id maps
// to a JSON file bundled in the app's `public/` directory.

import { PROTOCOLS_JSON_URL, USE_MOCK_DATA, LS_KEYS } from './config.js';
import { migrateZoneCodes } from './data.js';

const memCache = new Map();

// Local catalog of bundled protocols. Each entry maps a protocol_id to a path
// under public/ — so the file is fetched relative to BASE_URL (works at root
// or under a Pages subpath like /ppw-fascia-app/).
const LOCAL_CATALOG = [
  { protocol_id: 'testosterone_standard_v1',     file: 'mock-protocol.json' },
  { protocol_id: 'fasting-standard-protocol',    file: 'protocols/fasting_standard.json' },
  { protocol_id: 'fasting-vegan-protocol',       file: 'protocols/fasting_vegan.json' },
  { protocol_id: 'autoimmune-standard-protocol', file: 'protocols/autoimmune_standard.json' },
  { protocol_id: 'autoimmune-vegan-protocol',    file: 'protocols/autoimmune_vegan.json' },
];

function localCatalogFile(protocolId) {
  const e = LOCAL_CATALOG.find(c => c.protocol_id === protocolId);
  return e ? e.file : null;
}

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

/* List of protocols available. In mock mode this iterates over the LOCAL_CATALOG
   so all bundled protocols (testosterone, fasting std/vegan, autoimmune std/vegan)
   appear as cards on the Protocols screen. In live mode it tries the remote
   index.json. */
export async function listProtocols() {
  if (isMockActive()) {
    const out = [];
    for (const entry of LOCAL_CATALOG) {
      const p = await fetchProtocol(entry.protocol_id);
      if (p) out.push(p);
    }
    return out;
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
  const base = import.meta.env.BASE_URL || '/';
  let url;
  if (isMockActive()) {
    const file = localCatalogFile(protocolId);
    if (!file) return null;
    url = `${base}${file}`;
  } else {
    // Even in live mode, prefer the bundled catalog if we recognise the id —
    // gives us offline-friendly behaviour without round-tripping GitHub.
    const file = localCatalogFile(protocolId);
    url = file ? `${base}${file}` : `${PROTOCOLS_JSON_URL}${protocolId}.json`;
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
    p.sections.daily_plan.forEach((e, idx) => {
      items.push({
        kind: 'protocol',
        // Stable id — independent of time so user-editable times don't break done-tracking.
        id: `proto::${p.protocol_id}::${idx}::${e.category}`,
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
    });
  }

  // 2. Body-zone routines (one consolidated entry, if any zones saved)
  // v2 backwards-compat: migrate any legacy NN_name_side codes lingering in
  // localStorage to the new kebab-case taxonomy on read. No-op on new codes.
  if (activeRoutines?.savedZones?.length) {
    const migratedZones = migrateZoneCodes(activeRoutines.savedZones);
    items.push({
      kind: 'routine',
      // Stable id — time stays editable without breaking done-tracking.
      id: `routine::saved`,
      time: activeRoutines.scheduledTime || '08:00',
      category: 'fascia_routine',
      label: `My zones — ${migratedZones.length} zone${migratedZones.length === 1 ? '' : 's'} (${activeRoutines.level})`,
      duration_min: migratedZones.length * 5,
      zones: migratedZones,
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
