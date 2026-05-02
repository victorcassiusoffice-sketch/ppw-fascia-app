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

// SVG hotspot geometry for the body map.
// v3.1 — viewBox restored to Vic's Figma frame dims so the rendered figure
// matches Figma proportions instead of being letterboxed in a 1:2 box.
//   FRONT: 432 × 1113  (1:2.576 — matches Figma frame)
//   BACK:  436 × 1203  (1:2.760 — matches Figma frame)
// Polygons (and cx/cy label anchors) rescaled from the prior 600×1200 grid
// using independent x/y factors so they sit at the same fractional positions:
//   FRONT  x *= 432/600 = 0.72       y *= 1113/1200 = 0.9275
//   BACK   x *= 436/600 ≈ 0.72667    y *= 1203/1200 = 1.0025
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

// SVG viewBox dimensions per view — match Vic's Figma frames so the rendered
// figure has the same proportions Vic designed against. Consumed by App.jsx
// for the SVG `viewBox` attribute and the container's aspect-ratio.
export const BODY_VIEWBOX = {
  front: { w: 432, h: 1113 },
  back:  { w: 436, h: 1203 },
};

export const HOTSPOTS_FRONT = [
  { code: 'calf-left',               cx: 145.4, cy: 1065.7, polygon: '100.8,1085.2 138.2,1046.2 186.5,1046.2 157,1085.2' },
  { code: 'calf-right',              cx: 280.8, cy: 1065.7, polygon: '239.8,1046.2 288.7,1046.2 326.2,1085.2 269.3,1085.2' },
  { code: 'elbow-left',              cx:  70.6, cy:  406.2, polygon: '37.4,410.9 51.8,363.6 92.9,363.6 102.2,387.7 92.9,416.4 79.9,433.1 63.4,442.4 43.9,433.1' },
  { code: 'elbow-right',             cx: 358.6, cy:  399.8, polygon: '325.4,404.4 339.8,357.1 380.9,357.1 390.2,380.3 380.9,410 367.9,426.6 351.4,435.9 331.9,426.6' },
  { code: 'forearm-left',            cx:  32.4, cy:  527.7, polygon: '11.5,550.9 22.3,508.3 53.3,508.3 41,544.4' },
  { code: 'forearm-right',           cx: 389.5, cy:  518.5, polygon: '367.9,499 399.6,499 409.7,541.7 380.2,535.2' },
  { code: 'front-shoulder-left',     cx: 108.7, cy:  241.2, polygon: '74.9,245.8 89.3,199.4 131,199.4 140.4,222.6 131,251.4 118.1,268 100.8,277.3 81.4,268' },
  { code: 'front-shoulder-right',    cx: 305.3, cy:  229.1, polygon: '269.3,197.6 298.8,187.4 323.3,197.6 341.3,248.6 323.3,278.2 298.8,268 280.8,227.2' },
  { code: 'headache',                cx:   216, cy:   44.5, polygon: '167.8,51.9 180.7,29.7 200.2,14.8 225.4,20.4 256.3,29.7 264.2,62.1 264.2,72.3 167.8,72.3' },
  { code: 'hip-flexor-left',         cx: 161.3, cy:    525, polygon: '105.8,544.4 125.3,459.1 162.7,459.1 205.9,535.2 205.9,626.1' },
  { code: 'hip-flexor-right',        cx: 268.6, cy:    525, polygon: '225.4,535.2 267.1,459.1 303.1,459.1 321.8,544.4 225.4,626.1' },
  { code: 'knee-left',               cx: 151.2, cy:  769.8, polygon: '118.1,774.5 132.5,727.2 174.2,727.2 182.9,750.3 174.2,779.1 161.3,796.7 144,805.1 124.6,796.7' },
  { code: 'knee-right',              cx: 278.6, cy:  769.8, polygon: '244.8,774.5 259.9,727.2 301,727.2 310.3,750.3 301,779.1 288,796.7 271.4,805.1 251.3,796.7' },
  { code: 'neck-left',               cx: 187.9, cy:  160.5, polygon: '175,130.8 200.2,152.1 200.2,187.4 175,171.6' },
  { code: 'neck-right',              cx: 237.6, cy:  160.5, polygon: '224.6,151.2 249.8,130.8 249.8,171.6 224.6,187.4' },
];

export const HOTSPOTS_BACK = [
  { code: 'calf-left',               cx: 158.4, cy: 1043.6, polygon: '119.2,930.3 194,930.3 180.9,1165.9 140.2,1148.9' },
  { code: 'calf-right',              cx: 268.9, cy: 1046.6, polygon: '231.8,934.3 310.3,934.3 287.8,1149.9 245.6,1165.9' },
  { code: 'elbow-left',              cx:  55.2, cy:  450.1, polygon: '26.2,444.1 42.1,407 76.3,407 90.1,432.1 83.6,472.2 42.1,505.3 26.2,486.2' },
  { code: 'elbow-right',             cx:   375, cy:  450.1, polygon: '340.1,431.1 353.2,407 388,407 404,443.1 404,486.2 388,504.3 346.6,472.2' },
  { code: 'forearm-left',            cx:  30.5, cy:  583.5, polygon: '8.7,604.5 14.5,562.4 53,562.4 45.8,604.5' },
  { code: 'forearm-right',           cx: 406.2, cy:  582.5, polygon: '383.7,566.4 424.4,566.4 424.4,598.5 390.9,598.5' },
  { code: 'gluteal-left',            cx: 169.3, cy:  585.5, polygon: '119.2,543.4 172.2,533.3 215.1,557.4 215.1,601.5 199.1,631.6 146.1,631.6 119.2,601.5' },
  { code: 'gluteal-right',           cx: 277.6, cy:  585.5, polygon: '231.1,557.4 274,533.3 329.2,543.4 329.2,601.5 301.6,631.6 247.1,631.6 231.1,601.5' },
  { code: 'hamstrings-left',         cx: 155.5, cy:  726.8, polygon: '98.8,646.6 205.6,646.6 187.5,813 129.3,801' },
  { code: 'hamstrings-right',        cx: 278.3, cy:  726.8, polygon: '222.4,646.6 340.1,646.6 306.7,801 242.7,813' },
  { code: 'headache',                cx: 220.9, cy:   75.2, polygon: '170.8,66.2 186,41.1 252.2,41.1 273.2,66.2 258,119.3 186,119.3' },
  { code: 'knee-left',               cx: 157.7, cy:  874.2, polygon: '122.1,896.2 131.5,851.1 194,851.1 182.4,896.2' },
  { code: 'knee-right',              cx: 274.7, cy:  874.2, polygon: '238.3,851.1 300.1,851.1 310.3,896.2 249.2,896.2' },
  { code: 'lower-back-left',         cx: 172.9, cy:  435.1, polygon: '140.2,370.9 205.6,370.9 205.6,521.3 140.2,476.2' },
  { code: 'lower-back-right',        cx: 265.2, cy:  435.1, polygon: '231.8,370.9 297.9,370.9 297.9,476.2 231.8,521.3' },
  { code: 'traps-left',              cx: 187.5, cy:  176.4, polygon: '143.9,199.5 170,126.3 218,126.3 218,185.5 187.5,244.6' },
  { code: 'traps-right',             cx: 253.6, cy:  176.4, polygon: '222.4,126.3 271.8,126.3 297.9,199.5 253.6,244.6 222.4,185.5' },
  { code: 'upper-back-left',         cx: 194.7, cy:  305.8, polygon: '172.9,262.7 215.8,262.7 215.8,363.9 172.9,333.8' },
  { code: 'upper-back-right',        cx: 243.4, cy:  305.8, polygon: '222.4,262.7 264.5,262.7 264.5,333.8 222.4,364.9' },
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
