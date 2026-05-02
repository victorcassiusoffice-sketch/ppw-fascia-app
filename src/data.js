// Single source of truth for the folder-driven logic.
// Everything here maps to the public/videos/** tree.
// If you add a folder on disk, add its code here and the app picks it up.
//
// v2.1 taxonomy (2026-04-29 — Stage 5 corrections from Vic's live phone test):
//   • Sex toggle removed — single gender-neutral figure
//   • ITB removed (release technique, not a pain location)
//   • Knee consolidated to single zone L/R (inside/outside/back differentiated in /tests)
//   • Lower-back, gluteal, hamstrings polygons re-anchored to correct anatomy
//   • Front-shoulder, hip-flexor, upper-back, traps polygons audited + adjusted
// 14 zone-groups → 27 zone codes. Kebab-case, no NN_ prefix.

export const ZONES = [
  // Group A — Head & cervicothoracic
  { code: 'headache',              label: 'Headache',     group: 'headache',       side: 'both'  },
  { code: 'jaw-left',              label: 'Jaw',          group: 'jaw',            side: 'left'  },
  { code: 'jaw-right',             label: 'Jaw',          group: 'jaw',            side: 'right' },
  { code: 'neck-left',             label: 'Neck',         group: 'neck',           side: 'left'  },
  { code: 'neck-right',            label: 'Neck',         group: 'neck',           side: 'right' },
  { code: 'traps-left',            label: 'Traps',        group: 'traps',          side: 'left'  },
  { code: 'traps-right',           label: 'Traps',        group: 'traps',          side: 'right' },
  { code: 'upper-back-left',       label: 'Upper Back',   group: 'upper-back',     side: 'left'  },
  { code: 'upper-back-right',      label: 'Upper Back',   group: 'upper-back',     side: 'right' },

  // Group B — Arm
  { code: 'front-shoulder-left',   label: 'Front Shoulder', group: 'front-shoulder', side: 'left'  },
  { code: 'front-shoulder-right',  label: 'Front Shoulder', group: 'front-shoulder', side: 'right' },
  { code: 'elbow-left',            label: 'Elbow',        group: 'elbow',          side: 'left'  },
  { code: 'elbow-right',           label: 'Elbow',        group: 'elbow',          side: 'right' },
  { code: 'forearm-left',          label: 'Forearm',      group: 'forearm',        side: 'left'  },
  { code: 'forearm-right',         label: 'Forearm',      group: 'forearm',        side: 'right' },

  // Group C — Trunk
  { code: 'lower-back-left',       label: 'Lower Back',   group: 'lower-back',     side: 'left'  },
  { code: 'lower-back-right',      label: 'Lower Back',   group: 'lower-back',     side: 'right' },

  // Group D — Hip & thigh
  { code: 'hip-flexor-left',       label: 'Hip Flexor',   group: 'hip-flexor',     side: 'left'  },
  { code: 'hip-flexor-right',      label: 'Hip Flexor',   group: 'hip-flexor',     side: 'right' },
  { code: 'gluteal-left',          label: 'Gluteal',      group: 'gluteal',        side: 'left'  },
  { code: 'gluteal-right',         label: 'Gluteal',      group: 'gluteal',        side: 'right' },
  { code: 'hamstrings-left',       label: 'Hamstrings',   group: 'hamstrings',     side: 'left'  },
  { code: 'hamstrings-right',      label: 'Hamstrings',   group: 'hamstrings',     side: 'right' },

  // Group E — Knee & lower leg (knee inside/outside/back differentiated in /tests)
  { code: 'knee-left',             label: 'Knee',         group: 'knee',           side: 'left'  },
  { code: 'knee-right',            label: 'Knee',         group: 'knee',           side: 'right' },
  { code: 'calf-left',             label: 'Calf',         group: 'calf',           side: 'left'  },
  { code: 'calf-right',            label: 'Calf',         group: 'calf',           side: 'right' },
];

// Number of tests per zone-group. Each test has a yes/no branch.
// knee = 3 tests (inside/outside/back differentiation per Vic).
export const TESTS_BY_GROUP = {
  'headache':       1,
  'jaw':            1,
  'neck':           2,
  'traps':          1,
  'upper-back':     1,
  'front-shoulder': 2,
  'elbow':          2,
  'forearm':        1,
  'lower-back':     3,
  'hip-flexor':     2,
  'gluteal':        2,
  'hamstrings':     1,
  'knee':           3,
  'calf':           2,
};

export const LIFESTYLES = [
  { code: 'plumber',       label: 'Plumber',         icon: '🔧' },
  { code: 'electrician',   label: 'Electrician',     icon: '⚡' },
  { code: 'builder',       label: 'Builder',         icon: '🏗️' },
  { code: 'cyclist',       label: 'Cyclist',         icon: '🚴' },
  { code: 'racket_sports', label: 'Racket Sports',   icon: '🎾' },
  { code: 'jujitsu',       label: 'Jiu-Jitsu',       icon: '🥋' },
  { code: 'office',        label: 'Office',          icon: '💻' },
  { code: 'standing_long', label: 'Standing Long',   icon: '🧍' },
  { code: 'lifting_boxes', label: 'Lifting Boxes',   icon: '📦' },
  { code: 'driving',       label: 'Driving',         icon: '🚗' },
];

// Which zones a lifestyle pre-selects. v2.1 — drops ITB, consolidates knee.
export const LIFESTYLE_ZONES = {
  plumber:       ['front-shoulder-left','front-shoulder-right','lower-back-left','lower-back-right','knee-left','knee-right'],
  electrician:   ['neck-left','neck-right','front-shoulder-left','front-shoulder-right','forearm-left','forearm-right'],
  builder:       ['lower-back-left','lower-back-right','front-shoulder-left','front-shoulder-right','hip-flexor-left','hip-flexor-right'],
  cyclist:       ['hip-flexor-left','hip-flexor-right','hamstrings-left','hamstrings-right','lower-back-left','lower-back-right'],
  racket_sports: ['front-shoulder-left','front-shoulder-right','elbow-left','elbow-right','forearm-left','forearm-right'],
  jujitsu:       ['neck-left','neck-right','front-shoulder-left','front-shoulder-right','hip-flexor-left','hip-flexor-right','lower-back-left','lower-back-right','gluteal-left','gluteal-right'],
  office:        ['headache','neck-left','neck-right','traps-left','traps-right','front-shoulder-left','front-shoulder-right','lower-back-left','lower-back-right'],
  standing_long: ['hip-flexor-left','hip-flexor-right','knee-left','knee-right','calf-left','calf-right','lower-back-left','lower-back-right'],
  lifting_boxes: ['lower-back-left','lower-back-right','hip-flexor-left','hip-flexor-right','gluteal-left','gluteal-right','front-shoulder-left','front-shoulder-right','hamstrings-left','hamstrings-right'],
  driving:       ['neck-left','neck-right','lower-back-left','lower-back-right','hip-flexor-left','hip-flexor-right','gluteal-left','gluteal-right'],
};

// Body-map polygon geometry now lives in src/bodyZones.js (which loads
// public/assets/body_zones/body_zones_{front,back}.svg — the per-view
// Figma exports that contain BOTH the body image and the polygon hit
// targets in the same coordinate space).
//
// Removed in 2026-05-02 permanent fix:
//   - HOTSPOTS_FRONT / HOTSPOTS_BACK arrays  (geometry now read from SVG)
//   - getHotspots()                          (use getBodyView() from bodyZones.js)
//   - BODY_VIEWBOX                           (viewBox comes from the SVG)
//
// Source: Figma file C7CyNdQpC5o2OHCeUJyT4K, FRONT + BACK frames.
// Build:  node tools/build-zone-svgs.mjs (after re-exporting from Figma).
// Approved Vic decisions (2026-05-01):
//   - Solar Plexus (FRONT): dropped, no canonical zone
//   - Neck and Trap L/R (BACK): assigned to traps-left/right (neck on FRONT only)
//   - Scapula L/R (BACK): dropped, upper-back covers
//   - Gluteal L duplicate (BACK): second occurrence remapped to gluteal-right
//   - Jaw L/R: not drawn in Figma, dropped from polygons (still in ZONES)

// Backwards-compat shim — translate legacy codes (NN_ from v1, kebab v2 with
// dropped/consolidated zones) into the v2.1 taxonomy. Empty array = dropped.
export const OLD_TO_NEW = {
  // v1 NN_ codes
  '01_head_both':         ['headache'],
  '02_neck_left':         ['neck-left'],          '02_neck_right':         ['neck-right'],
  '03_shoulder_left':     ['front-shoulder-left'], '03_shoulder_right':    ['front-shoulder-right'],
  '04_upper_arm_left':    [],                     '04_upper_arm_right':    [],
  '05_forearm_left':      ['forearm-left'],       '05_forearm_right':      ['forearm-right'],
  '06_hip_left':          ['hip-flexor-left','gluteal-left'],
  '06_hip_right':         ['hip-flexor-right','gluteal-right'],
  '07_thigh_left':        ['hip-flexor-left','hamstrings-left'],
  '07_thigh_right':       ['hip-flexor-right','hamstrings-right'],
  '08_ankle_left':        ['calf-left'],          '08_ankle_right':        ['calf-right'],
  '09_chest_left':        [],                     '09_chest_right':        [],
  '10_lower_arm_left':    ['forearm-left'],       '10_lower_arm_right':    ['forearm-right'],
  '11_lateral_arm_left':  [],                     '11_lateral_arm_right':  [],
  '12_lower_back_left':   ['lower-back-left'],    '12_lower_back_right':   ['lower-back-right'],
  '13_knee_left':         ['knee-left'],          '13_knee_right':         ['knee-right'],
  '14_foot_left':         ['calf-left'],          '14_foot_right':         ['calf-right'],
  '15_itband_left':       [],                     '15_itband_right':       [],   // Stage 5 drop
  // v2 kebab codes that got dropped/consolidated in v2.1
  'it-band-left':         [],                     'it-band-right':         [],
  'knee-inside-left':     ['knee-left'],          'knee-inside-right':     ['knee-right'],
  'knee-outside-left':    ['knee-left'],          'knee-outside-right':    ['knee-right'],
  'knee-back-left':       ['knee-left'],          'knee-back-right':       ['knee-right'],
};

export function migrateZoneCodes(input) {
  const arr = Array.isArray(input) ? input : [input];
  const out = [];
  const seen = new Set();
  for (const c of arr) {
    if (c == null) continue;
    if (Object.prototype.hasOwnProperty.call(OLD_TO_NEW, c)) {
      for (const nc of OLD_TO_NEW[c]) {
        if (!seen.has(nc)) { seen.add(nc); out.push(nc); }
      }
    } else {
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
  }
  return out;
}

export const DEFAULT_CLIP_SECONDS = 60;

const baseUrl = () => (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';

export function zoneVideoPath(zoneCode, level, lifestyle) {
  const b = baseUrl();
  if (lifestyle) {
    return `${b}videos/lifestyle_protocols/${lifestyle}/${zoneCode}/${level}/video.mp4`;
  }
  return `${b}videos/zones/${zoneCode}/${level}/video.mp4`;
}

export function testVideoPath(zoneGroup, testNumber) {
  const nn = String(testNumber).padStart(2, '0');
  return `${baseUrl()}videos/tests/${zoneGroup}/test_${nn}/test.mp4`;
}

export function testAnswerVideoPath(zoneGroup, testNumber, answer) {
  const nn = String(testNumber).padStart(2, '0');
  return `${baseUrl()}videos/tests/${zoneGroup}/test_${nn}/${answer}/test.mp4`;
}

export function zoneMediaPath(zoneCode, level, lifestyle) {
  const b = baseUrl();
  if (lifestyle) {
    return `${b}videos/lifestyle_protocols/${lifestyle}/${zoneCode}/${level}/media.json`;
  }
  return `${b}videos/zones/${zoneCode}/${level}/media.json`;
}

export function lifestyleAllMediaPath(lifestyle, level) {
  return `${baseUrl()}videos/lifestyle_protocols/${lifestyle}/_all/${level}/media.json`;
}

export function moduleMediaPath(type, slug) {
  return `${baseUrl()}videos/modules/${type}/${slug}/media.json`;
}

export async function loadMedia(path) {
  try {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !j.youtube_id) return null;
    return j;
  } catch (_) {
    return null;
  }
}

// Fascia chain mapping — v2.1 (ITB dropped, knee consolidated).
export const FASCIA_CHAINS = {
  superficial_back_line:  ['headache','traps-left','traps-right','upper-back-left','upper-back-right','lower-back-left','lower-back-right','gluteal-left','gluteal-right','hamstrings-left','hamstrings-right','knee-left','knee-right','calf-left','calf-right'],
  superficial_front_line: ['neck-left','neck-right','front-shoulder-left','front-shoulder-right','hip-flexor-left','hip-flexor-right','knee-left','knee-right'],
  lateral_line:           ['neck-left','neck-right','knee-left','knee-right','calf-left','calf-right'],
  spiral_line:            ['upper-back-left','upper-back-right','calf-left','calf-right'],
  deep_front_line:        ['jaw-left','jaw-right','neck-left','neck-right','hip-flexor-left','hip-flexor-right','calf-left','calf-right'],
  arm_lines_front:        ['front-shoulder-left','front-shoulder-right','elbow-left','elbow-right','forearm-left','forearm-right'],
  arm_lines_back:         ['traps-left','traps-right','upper-back-left','upper-back-right','elbow-left','elbow-right','forearm-left','forearm-right'],
  functional_lines:       ['front-shoulder-left','gluteal-right','front-shoulder-right','gluteal-left'],
};

export const ZONE_TO_CHAIN = (() => {
  const m = {};
  for (const [chain, zones] of Object.entries(FASCIA_CHAINS)) {
    for (const z of zones) {
      if (!m[z]) m[z] = [];
      m[z].push(chain);
    }
  }
  return m;
})();

export function resolveRoutineZones(fascia_routine) {
  if (!fascia_routine) return [];
  if (fascia_routine.zones && fascia_routine.zones.length) return fascia_routine.zones;
  if (fascia_routine.body_zone_chain && FASCIA_CHAINS[fascia_routine.body_zone_chain]) {
    return FASCIA_CHAINS[fascia_routine.body_zone_chain];
  }
  return [];
}

export const CHAIN_OVERLAY_FILES = {};

export function chainOverlayUrl(chain, view = 'front') {
  if (!chain) return null;
  const override = CHAIN_OVERLAY_FILES[chain];
  const filename = (override && override[view]) || `${chain}_${view}.png`;
  const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
  return `${base}assets/body_zones/${filename}`;
}

export function dominantChainForZones(zoneCodes) {
  if (!zoneCodes || !zoneCodes.length) return null;
  const counts = {};
  for (const code of zoneCodes) {
    const chains = ZONE_TO_CHAIN[code] || [];
    for (const c of chains) counts[c] = (counts[c] || 0) + 1;
  }
  let best = null, bestScore = 0;
  for (const [chain, n] of Object.entries(counts)) {
    if (n > bestScore) { best = chain; bestScore = n; }
  }
  return best;
}

// Removed bodyFigureFile() in 2026-05-02 permanent fix — the body image
// is now baked into public/assets/body_zones/body_zones_{front,back}.svg
// alongside the polygon zones. See src/bodyZones.js.
