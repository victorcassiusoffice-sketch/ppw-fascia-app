// Single source of truth for the folder-driven logic.
// Everything here maps to the public/videos/** tree.
// If you add a folder on disk, add its code here and the app picks it up.
//
// v2 taxonomy (2026-04-29) — see NEW_ZONE_MAP.md for full plan.
// 17 zone-groups → 33 zone codes. Kebab-case, no NN_ prefix.

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
  { code: 'it-band-left',          label: 'IT Band',      group: 'it-band',        side: 'left'  },
  { code: 'it-band-right',         label: 'IT Band',      group: 'it-band',        side: 'right' },
  { code: 'hamstrings-left',       label: 'Hamstrings',   group: 'hamstrings',     side: 'left'  },
  { code: 'hamstrings-right',      label: 'Hamstrings',   group: 'hamstrings',     side: 'right' },

  // Group E — Knee & lower leg
  { code: 'knee-inside-left',      label: 'Knee — Inside',  group: 'knee-inside',  side: 'left'  },
  { code: 'knee-inside-right',     label: 'Knee — Inside',  group: 'knee-inside',  side: 'right' },
  { code: 'knee-outside-left',     label: 'Knee — Outside', group: 'knee-outside', side: 'left'  },
  { code: 'knee-outside-right',    label: 'Knee — Outside', group: 'knee-outside', side: 'right' },
  { code: 'knee-back-left',        label: 'Knee — Back',    group: 'knee-back',    side: 'left'  },
  { code: 'knee-back-right',       label: 'Knee — Back',    group: 'knee-back',    side: 'right' },
  { code: 'calf-left',             label: 'Calf',           group: 'calf',         side: 'left'  },
  { code: 'calf-right',            label: 'Calf',           group: 'calf',         side: 'right' },
];

// Number of tests per zone-group. Each test has a yes/no branch.
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
  'it-band':        2,
  'hamstrings':     1,
  'knee-inside':    1,
  'knee-outside':   1,
  'knee-back':      1,
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

// Which zones a lifestyle pre-selects (sensible defaults; folders still drive playback).
// v2 — kebab-case codes.
export const LIFESTYLE_ZONES = {
  plumber:       ['front-shoulder-left','front-shoulder-right','lower-back-left','lower-back-right','knee-inside-left','knee-inside-right'],
  electrician:   ['neck-left','neck-right','front-shoulder-left','front-shoulder-right','forearm-left','forearm-right'],
  builder:       ['lower-back-left','lower-back-right','front-shoulder-left','front-shoulder-right','hip-flexor-left','hip-flexor-right'],
  cyclist:       ['hip-flexor-left','hip-flexor-right','hamstrings-left','hamstrings-right','lower-back-left','lower-back-right','it-band-left','it-band-right'],
  racket_sports: ['front-shoulder-left','front-shoulder-right','elbow-left','elbow-right','forearm-left','forearm-right'],
  jujitsu:       ['neck-left','neck-right','front-shoulder-left','front-shoulder-right','hip-flexor-left','hip-flexor-right','lower-back-left','lower-back-right','gluteal-left','gluteal-right'],
  office:        ['headache','neck-left','neck-right','traps-left','traps-right','front-shoulder-left','front-shoulder-right','lower-back-left','lower-back-right'],
  standing_long: ['hip-flexor-left','hip-flexor-right','knee-inside-left','knee-inside-right','calf-left','calf-right','lower-back-left','lower-back-right'],
  lifting_boxes: ['lower-back-left','lower-back-right','hip-flexor-left','hip-flexor-right','gluteal-left','gluteal-right','front-shoulder-left','front-shoulder-right','hamstrings-left','hamstrings-right'],
  driving:       ['neck-left','neck-right','lower-back-left','lower-back-right','hip-flexor-left','hip-flexor-right','gluteal-left','gluteal-right'],
};

// SVG hotspot geometry for the body map (600x1200 viewBox - sacred).
// v2: 33-code taxonomy + per-sex override sets.
// Coordinates from NEW_ZONE_MAP.md §6. Left/right = viewer's perspective.
//
// Structure:
//   { shared: [...all 33 polygons, calibrated to male PNG],
//     female: [...polygon overrides for front-shoulder, hip-flexor, gluteal, lower-back] }
//
// Use getHotspots(view, sex) to resolve.

const FRONT_SHARED = [
  { code: 'headache',              cx: 300, cy: 110, polygon: '262,82 320,76 348,90 358,118 340,140 300,148 260,140 242,118 252,90' },
  { code: 'jaw-left',              cx: 270, cy: 170, polygon: '258,148 290,148 295,168 290,188 270,200 252,188 250,168' },
  { code: 'jaw-right',             cx: 330, cy: 170, polygon: '310,148 342,148 350,168 348,188 330,200 310,188 305,168' },
  { code: 'neck-left',             cx: 275, cy: 220, polygon: '258,200 290,200 295,222 290,245 275,255 258,245 252,222' },
  { code: 'neck-right',            cx: 325, cy: 220, polygon: '310,200 342,200 348,222 342,245 325,255 310,245 305,222' },
  { code: 'traps-left',            cx: 240, cy: 265, polygon: '210,250 268,248 280,260 270,278 250,290 225,290 212,278 205,265' },
  { code: 'traps-right',           cx: 360, cy: 265, polygon: '332,248 390,250 395,265 388,278 375,290 350,290 332,278 320,260' },
  { code: 'front-shoulder-left',   cx: 200, cy: 285, polygon: '170,260 230,255 246,275 240,300 220,318 195,320 170,308 158,290' },
  { code: 'front-shoulder-right',  cx: 400, cy: 285, polygon: '370,255 430,260 442,290 430,308 405,320 380,318 360,300 354,275' },
  { code: 'elbow-left',            cx: 145, cy: 475, polygon: '120,455 165,450 175,475 168,498 145,508 122,500 110,478' },
  { code: 'elbow-right',           cx: 455, cy: 475, polygon: '435,450 480,455 490,478 478,500 455,508 432,498 425,475' },
  { code: 'forearm-left',          cx: 125, cy: 600, polygon: '108,508 165,505 172,580 168,665 150,705 122,710 95,690 90,610 95,520' },
  { code: 'forearm-right',         cx: 475, cy: 600, polygon: '435,505 492,508 510,520 505,610 500,690 478,710 450,705 432,665 428,580' },
  { code: 'hip-flexor-left',       cx: 265, cy: 600, polygon: '230,560 296,560 298,605 285,635 268,650 245,648 225,625 220,580' },
  { code: 'hip-flexor-right',      cx: 335, cy: 600, polygon: '304,560 370,560 380,580 375,625 355,648 332,650 315,635 302,605' },
  { code: 'it-band-left',          cx: 220, cy: 850, polygon: '205,720 240,718 248,800 245,890 240,955 218,955 200,890 195,810' },
  { code: 'it-band-right',         cx: 380, cy: 850, polygon: '360,718 395,720 405,810 400,890 382,955 360,955 355,890 352,800' },
  { code: 'knee-inside-left',      cx: 282, cy: 985, polygon: '268,960 296,960 298,985 296,1010 282,1025 270,1015 265,990' },
  { code: 'knee-inside-right',     cx: 318, cy: 985, polygon: '304,960 332,960 335,990 330,1015 318,1025 304,1010 302,985' },
  { code: 'knee-outside-left',     cx: 240, cy: 985, polygon: '218,960 252,955 258,985 252,1010 235,1025 218,1015 210,990' },
  { code: 'knee-outside-right',    cx: 360, cy: 985, polygon: '348,955 382,960 390,990 382,1015 365,1010 348,1025 342,985' },
  { code: 'calf-left',             cx: 270, cy: 1140, polygon: '255,1108 295,1108 296,1130 294,1155 275,1170 295,1170 296,1188 280,1198 255,1198 240,1188 245,1170 258,1158 252,1135' },
  { code: 'calf-right',            cx: 330, cy: 1140, polygon: '305,1108 345,1108 348,1135 342,1158 355,1170 304,1170 304,1188 320,1198 345,1198 360,1188 355,1170 325,1170 306,1155' },
];

// Female overrides (front view) - wider pelvis, shoulder centroids shifted laterally.
const FRONT_FEMALE = [
  { code: 'front-shoulder-left',   cx: 175, cy: 290, polygon: '145,265 205,260 225,280 220,305 200,323 175,325 150,313 138,295' },
  { code: 'front-shoulder-right',  cx: 425, cy: 290, polygon: '395,260 455,265 462,295 450,313 425,325 400,323 380,305 375,280' },
  { code: 'hip-flexor-left',       cx: 255, cy: 605, polygon: '218,565 290,565 292,610 278,640 258,654 235,652 215,628 210,585' },
  { code: 'hip-flexor-right',      cx: 345, cy: 605, polygon: '310,565 382,565 390,585 385,628 365,652 342,654 322,640 308,610' },
];

export const HOTSPOTS_FRONT = {
  shared: FRONT_SHARED,
  female: FRONT_FEMALE,
};

const BACK_SHARED = [
  { code: 'headache',              cx: 300, cy: 110, polygon: '262,82 320,76 348,90 358,118 340,140 300,148 260,140 242,118 252,90' },
  { code: 'jaw-left',              cx: 270, cy: 170, polygon: '258,148 290,148 295,168 290,188 270,200 252,188 250,168' },
  { code: 'jaw-right',             cx: 330, cy: 170, polygon: '310,148 342,148 350,168 348,188 330,200 310,188 305,168' },
  { code: 'neck-left',             cx: 275, cy: 220, polygon: '258,200 290,200 295,222 290,245 275,255 258,245 252,222' },
  { code: 'neck-right',            cx: 325, cy: 220, polygon: '310,200 342,200 348,222 342,245 325,255 310,245 305,222' },
  { code: 'traps-left',            cx: 240, cy: 265, polygon: '210,250 268,248 280,260 270,278 250,290 225,290 212,278 205,265' },
  { code: 'traps-right',           cx: 360, cy: 265, polygon: '332,248 390,250 395,265 388,278 375,290 350,290 332,278 320,260' },
  { code: 'upper-back-left',       cx: 255, cy: 350, polygon: '215,310 296,310 296,355 296,400 270,415 240,412 218,395 212,360' },
  { code: 'upper-back-right',      cx: 345, cy: 350, polygon: '304,310 385,310 388,360 382,395 360,412 332,415 304,400 304,355' },
  { code: 'elbow-left',            cx: 145, cy: 475, polygon: '120,455 165,450 175,475 168,498 145,508 122,500 110,478' },
  { code: 'elbow-right',           cx: 455, cy: 475, polygon: '435,450 480,455 490,478 478,500 455,508 432,498 425,475' },
  { code: 'forearm-left',          cx: 125, cy: 600, polygon: '108,508 165,505 172,580 168,665 150,705 122,710 95,690 90,610 95,520' },
  { code: 'forearm-right',         cx: 475, cy: 600, polygon: '435,505 492,508 510,520 505,610 500,690 478,710 450,705 432,665 428,580' },
  { code: 'lower-back-left',       cx: 265, cy: 560, polygon: '220,510 295,510 295,565 295,610 270,628 235,625 215,600 215,540' },
  { code: 'lower-back-right',      cx: 335, cy: 560, polygon: '304,510 380,510 385,540 385,600 365,625 335,628 304,610 304,565' },
  { code: 'gluteal-left',          cx: 265, cy: 690, polygon: '220,640 296,635 298,690 280,725 255,738 232,728 218,705 215,665' },
  { code: 'gluteal-right',         cx: 335, cy: 690, polygon: '304,635 380,640 385,665 382,705 368,728 345,738 320,725 304,690' },
  { code: 'it-band-left',          cx: 220, cy: 850, polygon: '205,740 240,738 248,820 245,890 240,955 218,955 200,890 195,820' },
  { code: 'it-band-right',         cx: 380, cy: 850, polygon: '360,738 395,740 405,820 400,890 382,955 360,955 355,890 352,820' },
  { code: 'hamstrings-left',       cx: 265, cy: 860, polygon: '228,740 295,740 298,820 295,890 290,945 268,955 232,952 222,895 220,820' },
  { code: 'hamstrings-right',      cx: 335, cy: 860, polygon: '304,740 372,740 378,820 378,895 368,952 332,955 310,945 305,890 304,820' },
  { code: 'knee-back-left',        cx: 282, cy: 985, polygon: '255,960 296,960 298,985 296,1015 282,1030 264,1018 252,990' },
  { code: 'knee-back-right',       cx: 318, cy: 985, polygon: '304,960 345,960 348,990 336,1018 318,1030 304,1015 302,985' },
  { code: 'knee-outside-left',     cx: 240, cy: 985, polygon: '218,960 252,955 258,985 252,1010 235,1025 218,1015 210,990' },
  { code: 'knee-outside-right',    cx: 360, cy: 985, polygon: '348,955 382,960 390,990 382,1015 365,1010 348,1025 342,985' },
  { code: 'calf-left',             cx: 270, cy: 1080, polygon: '245,1030 295,1030 298,1075 296,1115 280,1145 295,1170 296,1188 280,1198 255,1198 240,1188 245,1170 258,1145 240,1115 240,1075' },
  { code: 'calf-right',            cx: 330, cy: 1080, polygon: '305,1030 355,1030 360,1075 358,1115 342,1145 355,1170 360,1188 345,1198 320,1198 304,1188 304,1170 320,1145 304,1115 304,1075' },
];

// Female overrides (back view) - wider pelvis on lower-back + gluteal,
// lumbar lordosis sits slightly higher.
const BACK_FEMALE = [
  { code: 'lower-back-left',       cx: 265, cy: 545, polygon: '218,495 295,495 295,550 295,595 270,615 233,612 213,585 213,525' },
  { code: 'lower-back-right',      cx: 335, cy: 545, polygon: '304,495 382,495 387,525 387,585 367,612 335,615 304,595 304,550' },
  { code: 'gluteal-left',          cx: 255, cy: 695, polygon: '208,640 296,635 298,695 280,732 248,745 222,734 208,710 205,668' },
  { code: 'gluteal-right',         cx: 345, cy: 695, polygon: '304,635 392,640 395,668 392,710 378,734 352,745 320,732 304,695' },
];

export const HOTSPOTS_BACK = {
  shared: BACK_SHARED,
  female: BACK_FEMALE,
};

// Resolve the hotspot list for a given view + sex.
// Female overrides REPLACE shared entries by zone code; everything else
// falls through. Unknown sex falls back to shared (= male calibration).
export function getHotspots(view, sex) {
  const set = view === 'back' ? HOTSPOTS_BACK : HOTSPOTS_FRONT;
  const shared = set.shared;
  const overrides = sex === 'female' ? set.female : null;
  if (!overrides || overrides.length === 0) return shared;
  const map = new Map(overrides.map(h => [h.code, h]));
  return shared.map(h => map.get(h.code) || h);
}

// Backwards-compat shim - translate old NN_name_side codes saved in user
// localStorage to new kebab-case codes. Empty array = deprecated, drop.
export const OLD_TO_NEW = {
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
  '13_knee_left':         ['knee-inside-left','knee-outside-left','knee-back-left'],
  '13_knee_right':        ['knee-inside-right','knee-outside-right','knee-back-right'],
  '14_foot_left':         ['calf-left'],          '14_foot_right':         ['calf-right'],
  '15_itband_left':       ['it-band-left'],       '15_itband_right':       ['it-band-right'],
};

// Translate a single legacy code or an array of legacy codes into the new taxonomy.
export function migrateZoneCodes(input) {
  const arr = Array.isArray(input) ? input : [input];
  const out = [];
  const seen = new Set();
  for (const c of arr) {
    if (c == null) continue;
    if (OLD_TO_NEW[c]) {
      for (const nc of OLD_TO_NEW[c]) {
        if (!seen.has(nc)) { seen.add(nc); out.push(nc); }
      }
    } else {
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
  }
  return out;
}

// Legacy alias - flat front-shared array. Old code may import HOTSPOTS directly.
export const HOTSPOTS = FRONT_SHARED;

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

// Fascia chain mapping - v2 taxonomy.
export const FASCIA_CHAINS = {
  superficial_back_line:  ['headache','traps-left','traps-right','upper-back-left','upper-back-right','lower-back-left','lower-back-right','gluteal-left','gluteal-right','hamstrings-left','hamstrings-right','knee-back-left','knee-back-right','calf-left','calf-right'],
  superficial_front_line: ['neck-left','neck-right','front-shoulder-left','front-shoulder-right','hip-flexor-left','hip-flexor-right','knee-inside-left','knee-inside-right'],
  lateral_line:           ['neck-left','neck-right','it-band-left','it-band-right','knee-outside-left','knee-outside-right','calf-left','calf-right'],
  spiral_line:            ['upper-back-left','upper-back-right','it-band-left','it-band-right','calf-left','calf-right'],
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

// Body figure PNG resolver - picks male vs female silhouette based on user setting.
export function bodyFigureFile(view, sex) {
  if (sex === 'female') {
    return view === 'back' ? 'female_back.png' : 'female_front.png';
  }
  return view === 'back' ? 'body_back.png' : 'body_front.png';
}
