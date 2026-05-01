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

// SVG hotspot geometry for the body map (600x1200 viewBox - sacred).
// v3.0 — replaced with Vic's hand-drawn Figma polygons (2026-05-01).
// Source: Figma file C7CyNdQpC5o2OHCeUJyT4K, FRONT + BACK frames.
// Generated by tools/extract-zones.mjs from assets/figma-exports/{front,back}.svg.
// Anatomical L/R flipped to image L/R on FRONT view (model facing viewer).
// Polygons reduced to convex hulls for clean click-hotspot geometry.
// Approved Vic decisions (2026-05-01):
//   - Solar Plexus (FRONT): dropped, no canonical zone
//   - Neck and Trap L/R (BACK): assigned to traps-left/right (neck on FRONT only)
//   - Scapula L/R (BACK): dropped, upper-back covers
//   - Gluteal L duplicate: auto-mapped to gluteal-right by centroid x
//   - Jaw L/R: not drawn, dropped from HOTSPOTS (still in ZONES)

export const HOTSPOTS_FRONT = [
  { code: 'calf-left',             cx: 202, cy: 1149, polygon: '140,1170 192,1128 259,1128 218,1170' },
  { code: 'calf-right',            cx: 390, cy: 1149, polygon: '333,1128 401,1128 453,1170 374,1170' },
  { code: 'elbow-left',            cx: 98,  cy: 438,  polygon: '52,443 72,392 129,392 142,418 129,449 111,467 88,477 61,467' },
  { code: 'elbow-right',           cx: 498, cy: 431,  polygon: '452,436 472,385 529,385 542,410 529,442 511,460 488,470 461,460' },
  { code: 'forearm-left',          cx: 45,  cy: 569,  polygon: '16,594 31,548 74,548 57,587' },
  { code: 'forearm-right',         cx: 541, cy: 559,  polygon: '511,538 555,538 569,584 528,577' },
  { code: 'front-shoulder-left',   cx: 151, cy: 260,  polygon: '104,265 124,215 182,215 195,240 182,271 164,289 140,299 113,289' },
  { code: 'front-shoulder-right',  cx: 424, cy: 247,  polygon: '374,213 415,202 449,213 474,268 449,300 415,289 390,245' },
  { code: 'headache',              cx: 300, cy: 48,   polygon: '233,56 251,32 278,16 313,22 356,32 367,67 367,78 233,78' },
  { code: 'hip-flexor-left',       cx: 224, cy: 566,  polygon: '147,587 174,495 226,495 286,577 286,675' },
  { code: 'hip-flexor-right',      cx: 373, cy: 566,  polygon: '313,577 371,495 421,495 447,587 313,675' },
  { code: 'knee-left',             cx: 210, cy: 830,  polygon: '164,835 184,784 242,784 254,809 242,840 224,859 200,868 173,859' },
  { code: 'knee-right',            cx: 387, cy: 830,  polygon: '340,835 361,784 418,784 431,809 418,840 400,859 377,868 349,859' },
  { code: 'neck-left',             cx: 261, cy: 173,  polygon: '243,141 278,164 278,202 243,185' },
  { code: 'neck-right',            cx: 330, cy: 173,  polygon: '312,163 347,141 347,185 312,202' },
];

export const HOTSPOTS_BACK = [
  { code: 'calf-left',             cx: 218, cy: 1041, polygon: '164,928 267,928 249,1163 193,1146' },
  { code: 'calf-right',            cx: 370, cy: 1044, polygon: '319,932 427,932 396,1147 338,1163' },
  { code: 'elbow-left',            cx: 76,  cy: 449,  polygon: '36,443 58,406 105,406 124,431 115,471 58,504 36,485' },
  { code: 'elbow-right',           cx: 516, cy: 449,  polygon: '468,430 486,406 534,406 556,442 556,485 534,503 477,471' },
  { code: 'forearm-left',          cx: 42,  cy: 582,  polygon: '12,603 20,561 73,561 63,603' },
  { code: 'forearm-right',         cx: 559, cy: 581,  polygon: '528,565 584,565 584,597 538,597' },
  { code: 'gluteal-left',          cx: 233, cy: 584,  polygon: '164,542 237,532 296,556 296,600 274,630 201,630 164,600' },
  { code: 'gluteal-right',         cx: 382, cy: 584,  polygon: '318,556 377,532 453,542 453,600 415,630 340,630 318,600' },
  { code: 'hamstrings-left',       cx: 214, cy: 725,  polygon: '136,645 283,645 258,811 178,799' },
  { code: 'hamstrings-right',      cx: 383, cy: 725,  polygon: '306,645 468,645 422,799 334,811' },
  { code: 'headache',              cx: 304, cy: 75,   polygon: '235,66 256,41 347,41 376,66 355,119 256,119' },
  { code: 'knee-left',             cx: 217, cy: 872,  polygon: '168,894 181,849 267,849 251,894' },
  { code: 'knee-right',            cx: 378, cy: 872,  polygon: '328,849 413,849 427,894 343,894' },
  { code: 'lower-back-left',       cx: 238, cy: 434,  polygon: '193,370 283,370 283,520 193,475' },
  { code: 'lower-back-right',      cx: 365, cy: 434,  polygon: '319,370 410,370 410,475 319,520' },
  { code: 'traps-left',            cx: 258, cy: 176,  polygon: '198,199 234,126 300,126 300,185 258,244' },
  { code: 'traps-right',           cx: 349, cy: 176,  polygon: '306,126 374,126 410,199 349,244 306,185' },
  { code: 'upper-back-left',       cx: 268, cy: 305,  polygon: '238,262 297,262 297,363 238,333' },
  { code: 'upper-back-right',      cx: 335, cy: 305,  polygon: '306,262 364,262 364,333 306,364' },
];

// Resolver kept for backwards-compat with App.jsx caller. Sex param ignored
// (taxonomy is now sex-neutral per Vic Stage 5). View-only routing.
export function getHotspots(view /*, sex (deprecated, ignored) */) {
  return view === 'back' ? HOTSPOTS_BACK : HOTSPOTS_FRONT;
}

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

// Legacy alias for any callers that still import HOTSPOTS.
export const HOTSPOTS = HOTSPOTS_FRONT;

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

// Body figure PNG resolver — v2.1 single-source (gender-neutral).
// Sex param removed per Vic Stage 5; always returns body_<view>.png.
export function bodyFigureFile(view) {
  return view === 'back' ? 'body_back.png' : 'body_front.png';
}
