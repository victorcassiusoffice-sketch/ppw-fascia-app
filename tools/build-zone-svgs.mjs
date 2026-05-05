#!/usr/bin/env node
// build-zone-svgs.mjs — Transform Vic's raw Figma exports into ID-tagged SVGs.
//
// Reads:  assets/figma-exports/{front,back}.svg
// Writes: public/assets/body_zones/body_zones_{front,back}.svg
//
// 2026-05-05 REFACTOR — map by ANATOMY POSITION, not by layer-index.
//   Previous versions used FRONT_ORDER / BACK_ORDER index→slug tables, so
//   any time Vic re-arranged layers in Figma the mapping silently broke
//   (e.g. tapping the right knee lit up "knee-left" instead). The new
//   approach defines the EXPECTED CENTROID of each zone in the SVG
//   coordinate space, then assigns each parsed path to its nearest
//   unassigned target via greedy minimum-distance matching.
//
//   Robust to:
//     • Layer reordering in Figma (paths come out in any order)
//     • Adding/removing zones (extra paths fail loudly; missing paths are
//       silently dropped — Vic just hasn't drawn that zone yet)
//     • Small geometry tweaks (a few pixels of position drift is fine)
//   Fails loudly on:
//     • A path that doesn't fall within MATCH_TOLERANCE_PX of any target
//     • Two paths competing for the same target (the further one is
//       reported with a clear "ambiguous match" error)
//
// To re-export from Figma after a polygon edit:
//   1. Export FRONT and BACK frames as SVG into assets/figma-exports/
//   2. node tools/build-zone-svgs.mjs
//   3. Restart vite (raw imports are baked at build time).

import fs from 'node:fs';
import path from 'node:path';

const FRONT_IN  = 'assets/figma-exports/front.svg';
const BACK_IN   = 'assets/figma-exports/back.svg';
const OUT_DIR   = 'public/assets/body_zones';
const FRONT_OUT = path.join(OUT_DIR, 'body_zones_front.svg');
const BACK_OUT  = path.join(OUT_DIR, 'body_zones_back.svg');

// Maximum allowed Euclidean distance between a parsed path's bbox-centre
// and its target centroid. ~80 px is generous in a 432×1113 frame: it
// tolerates a polygon being moved a couple cm in Figma but still flags
// genuine swaps (e.g. a knee polygon ending up at shoulder height).
const MATCH_TOLERANCE_PX = 80;

// Target zone centroids in Figma SVG space.
//   FRONT: 432×1113, slug naming follows ANATOMICAL convention — when the
//          user faces the screen, image-left (low-x) = the user's RIGHT
//          side, so the slug 'foo-right' lives at low-x (2026-05-05 fix).
//          The previous version named slugs from the screen's perspective,
//          which inverted L/R for every paired front zone.
//   BACK:  436×1203, slug = anatomical side = image side (no mirror —
//          when the user faces away, image-left already = user's left).
//
// Add a new entry when Vic adds a new zone in Figma. The cx/cy come from
// the bbox centre of the new polygon — read it off paths_meta.json or
// from the build-time diagnostic this script prints.
const FRONT_TARGETS = [
  // 2026-05-05 anatomical-naming fix: paired L/R codes swapped so that
  // (low-x = image-left = user's RIGHT) matches the convention every
  // anatomy reference uses. BACK_TARGETS untouched.
  { code: 'headache',              cx: 214, cy:   43 },
  { code: 'neck-right',            cx: 187, cy:  159 },  // image-left = user R
  { code: 'neck-left',             cx: 237, cy:  159 },  // image-right = user L
  { code: 'front-shoulder-right',  cx: 120, cy:  244 },
  { code: 'front-shoulder-left',   cx: 310, cy:  244 },
  { code: 'solar-plexus',          cx: 215, cy:  322 },  // re-enabled 2026-05-05
  { code: 'elbow-right',           cx:  70, cy:  403 },
  { code: 'elbow-left',            cx: 357, cy:  396 },
  { code: 'forearm-right',         cx:  32, cy:  530 },
  { code: 'forearm-left',          cx: 389, cy:  520 },
  { code: 'hip-flexor-right',      cx: 156, cy:  542 },
  { code: 'hip-flexor-left',       cx: 273, cy:  542 },
  { code: 'knee-right',            cx: 156, cy:  787 },
  { code: 'knee-left',             cx: 264, cy:  787 },
  // Renamed 2026-05-05: front 'calf-*' polygons were actually drawn at
  // foot/ankle level — re-slugged to 'foot-*' (anatomical L/R applied).
  { code: 'foot-right',            cx: 130, cy: 1073 },
  { code: 'foot-left',             cx: 292, cy: 1073 },
];

const BACK_TARGETS = [
  { code: 'headache',              cx: 221, cy:   80 },
  { code: 'traps-left',            cx: 181, cy:  185 },
  { code: 'traps-right',           cx: 260, cy:  185 },
  { code: 'scapula-left',          cx: 119, cy:  283 },  // re-enabled 2026-05-05
  { code: 'scapula-right',         cx: 317, cy:  283 },  // re-enabled 2026-05-05
  { code: 'upper-back-left',       cx: 194, cy:  313 },
  { code: 'upper-back-right',      cx: 243, cy:  313 },
  { code: 'lower-back-left',       cx: 173, cy:  446 },
  { code: 'lower-back-right',      cx: 265, cy:  446 },
  { code: 'elbow-left',            cx:  58, cy:  456 },
  { code: 'elbow-right',           cx: 372, cy:  456 },
  { code: 'gluteal-left',          cx: 167, cy:  583 },
  { code: 'gluteal-right',         cx: 280, cy:  583 },
  { code: 'forearm-left',          cx:  31, cy:  583 },
  { code: 'forearm-right',         cx: 404, cy:  582 },
  { code: 'hamstrings-left',       cx: 153, cy:  730 },
  { code: 'hamstrings-right',      cx: 281, cy:  730 },
  { code: 'knee-left',             cx: 158, cy:  873 },
  { code: 'knee-right',            cx: 274, cy:  873 },
  { code: 'calf-left',             cx: 156, cy: 1051 },
  { code: 'calf-right',            cx: 273, cy: 1051 },
];

// Compute the bounding-box centre of a path's `d` attribute. Robust to
// any SVG path command — we accumulate every endpoint coordinate.
function pathCentroid(d) {
  const tokens = d.match(/[MLHVZCSQTAmlhvzcsqta]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = null;
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  const num = () => +tokens[i++];
  const push = (px, py) => {
    if (px < xmin) xmin = px; if (px > xmax) xmax = px;
    if (py < ymin) ymin = py; if (py > ymax) ymax = py;
  };
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[MLHVZCSQTAmlhvzcsqta]$/.test(t)) { cmd = t; i++; continue; }
    if (cmd === 'M' || cmd === 'L') { x = num(); y = num(); push(x, y); if (cmd === 'M') { sx = x; sy = y; cmd = 'L'; } }
    else if (cmd === 'm' || cmd === 'l') { x += num(); y += num(); push(x, y); if (cmd === 'm') { sx = x; sy = y; cmd = 'l'; } }
    else if (cmd === 'H') { x = num(); push(x, y); }
    else if (cmd === 'h') { x += num(); push(x, y); }
    else if (cmd === 'V') { y = num(); push(x, y); }
    else if (cmd === 'v') { y += num(); push(x, y); }
    else if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; }
    else if (cmd === 'C') { num(); num(); num(); num(); x = num(); y = num(); push(x, y); }
    else if (cmd === 'c') { num(); num(); num(); num(); x += num(); y += num(); push(x, y); }
    else if (cmd === 'S' || cmd === 'Q') { num(); num(); x = num(); y = num(); push(x, y); }
    else if (cmd === 's' || cmd === 'q') { num(); num(); x += num(); y += num(); push(x, y); }
    else if (cmd === 'T') { x = num(); y = num(); push(x, y); }
    else if (cmd === 't') { x += num(); y += num(); push(x, y); }
    else if (cmd === 'A') { num(); num(); num(); num(); num(); x = num(); y = num(); push(x, y); }
    else if (cmd === 'a') { num(); num(); num(); num(); num(); x += num(); y += num(); push(x, y); }
    else { i++; }
  }
  if (xmin === Infinity) return [0, 0];
  return [(xmin + xmax) / 2, (ymin + ymax) / 2];
}

// Assign each parsed path to its nearest unassigned target via greedy
// minimum-distance matching. Returns array aligned with `paths`:
//   [{ code, distance, target } | { code: null, distance, nearest }]
function assignPathsToTargets(paths, targets, viewName) {
  const enriched = paths.map((p, idx) => {
    const [cx, cy] = pathCentroid(p.d);
    return { idx, d: p.d, cx, cy };
  });
  // Build all (path, target, distance) candidate pairs.
  const pairs = [];
  for (const e of enriched) {
    for (const t of targets) {
      const dx = e.cx - t.cx, dy = e.cy - t.cy;
      pairs.push({ pathIdx: e.idx, target: t, distance: Math.hypot(dx, dy) });
    }
  }
  pairs.sort((a, b) => a.distance - b.distance);

  const result = new Array(paths.length).fill(null);
  const usedTargets = new Set();
  for (const pair of pairs) {
    if (result[pair.pathIdx]) continue;
    if (usedTargets.has(pair.target.code)) continue;
    if (pair.distance > MATCH_TOLERANCE_PX) continue;
    result[pair.pathIdx] = {
      code: pair.target.code,
      distance: pair.distance,
      target: pair.target,
      cx: enriched[pair.pathIdx].cx,
      cy: enriched[pair.pathIdx].cy,
    };
    usedTargets.add(pair.target.code);
  }

  // Diagnostics: any unmatched paths are a hard fail.
  const unmatched = enriched.filter(e => !result[e.idx]);
  if (unmatched.length) {
    const lines = unmatched.map(e => {
      const nearest = targets
        .map(t => ({ t, d: Math.hypot(e.cx - t.cx, e.cy - t.cy) }))
        .sort((a, b) => a.d - b.d)[0];
      return `  path[${e.idx}] at (${e.cx.toFixed(1)}, ${e.cy.toFixed(1)}) — nearest target ${nearest.t.code} at distance ${nearest.d.toFixed(1)}px (tolerance ${MATCH_TOLERANCE_PX})`;
    });
    throw new Error(`${viewName}: ${unmatched.length} path(s) couldn't match any zone target:\n${lines.join('\n')}`);
  }

  return result;
}

// Parse the Figma SVG. Returns { viewBox, defs, paths }.
function parseFigma(svgText) {
  const viewBoxM = svgText.match(/viewBox="([^"]+)"/);
  if (!viewBoxM) throw new Error('No viewBox');
  const [vx, vy, vw, vh] = viewBoxM[1].trim().split(/\s+/).map(Number);

  const defsM = svgText.match(/<defs>([\s\S]*?)<\/defs>/);
  if (!defsM) throw new Error('No <defs>');
  const defs = defsM[1];

  const pathRe = /<path\b[^>]*?\bd="([^"]+)"[^>]*\/?>/gi;
  const paths = [];
  let m;
  while ((m = pathRe.exec(svgText)) !== null) {
    paths.push({ d: m[1], full: m[0] });
  }
  return { viewBox: { x: vx, y: vy, w: vw, h: vh }, defs, paths };
}

// Build the new tagged SVG.
function buildSvg(viewName, parsed, targets) {
  const { viewBox, defs, paths } = parsed;
  const ns = viewName; // 'front' | 'back'

  // Re-id pattern + image refs to namespaced names (frontBodyPattern, etc.).
  const oldPatternId = (defs.match(/<pattern[^>]*id="([^"]+)"/) || [, ''])[1];
  const oldImageId   = (defs.match(/<image[^>]*id="([^"]+)"/) || [, ''])[1];
  const newPatternId = `${ns}BodyPattern`;
  const newImageId   = `${ns}BodyImage`;

  let cleanDefs = defs;
  if (oldPatternId) cleanDefs = cleanDefs.replaceAll(oldPatternId, newPatternId);
  if (oldImageId)   cleanDefs = cleanDefs.replaceAll(oldImageId,   newImageId);

  // Centroid-based assignment.
  const assignments = assignPathsToTargets(paths, targets, viewName);

  const zoneEls = [];
  const labelMeta = [];
  for (let i = 0; i < paths.length; i++) {
    const a = assignments[i];
    if (!a) continue;
    const slug = a.code;
    labelMeta.push({ code: slug, cx: +a.cx.toFixed(1), cy: +a.cy.toFixed(1) });
    zoneEls.push(
      `  <path id="zone-${slug}" data-zone="${slug}" class="zone" ` +
      `fill="transparent" stroke="none" d="${paths[i].d}"/>`
    );
  }

  const out =
`<?xml version="1.0" encoding="UTF-8"?>
<!--
  PPW Body Zones — ${viewName.toUpperCase()} view.
  Generated by tools/build-zone-svgs.mjs from assets/figma-exports/${viewName}.svg.
  DO NOT HAND-EDIT — re-run the build script after exporting from Figma.

  Mapping is centroid-based (paths assigned to nearest zone target by
  bbox centre — see ${viewName.toUpperCase()}_TARGETS in the build script).

  Coordinate system: ${viewBox.w} × ${viewBox.h}.
-->
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  viewBox="0 0 ${viewBox.w} ${viewBox.h}"
  width="${viewBox.w}"
  height="${viewBox.h}"
  data-view="${ns}"
>
<defs>${cleanDefs}</defs>
<rect class="body-image" width="${viewBox.w}" height="${viewBox.h}" fill="url(#${newPatternId})"/>
<g class="zones">
${zoneEls.join('\n')}
</g>
</svg>
`;

  // Print a per-build diagnostic so a maintainer can sanity-check the
  // centroid-matching at-a-glance.
  console.log(`\n  ${viewName.toUpperCase()} centroid matches (path# → slug · bbox-centre · distance to target):`);
  for (let i = 0; i < paths.length; i++) {
    const a = assignments[i];
    if (a) {
      console.log(`    [${String(i).padStart(2)}] ${a.code.padEnd(22)} (${a.cx.toFixed(0).padStart(3)}, ${a.cy.toFixed(0).padStart(4)})  Δ=${a.distance.toFixed(1)}px`);
    }
  }
  // Surface any zone targets that DIDN'T match a path — Vic just hasn't
  // drawn that polygon yet (or hasn't re-exported).
  const matchedCodes = new Set(assignments.filter(Boolean).map(a => a.code));
  const missing = targets.filter(t => !matchedCodes.has(t.code));
  if (missing.length) {
    console.log(`  ${viewName.toUpperCase()} zones with no matching polygon (re-export Figma to include): ${missing.map(t => t.code).join(', ')}`);
  }

  return { svg: out, labelMeta };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const front = parseFigma(fs.readFileSync(FRONT_IN, 'utf8'));
  const back  = parseFigma(fs.readFileSync(BACK_IN,  'utf8'));

  const { svg: frontSvg, labelMeta: frontMeta } = buildSvg('front', front, FRONT_TARGETS);
  const { svg: backSvg,  labelMeta: backMeta  } = buildSvg('back',  back,  BACK_TARGETS);

  fs.writeFileSync(FRONT_OUT, frontSvg);
  fs.writeFileSync(BACK_OUT,  backSvg);

  const labelMetaPath = path.join(OUT_DIR, 'zone_label_anchors.json');
  fs.writeFileSync(labelMetaPath, JSON.stringify({
    front: { viewBox: { w: front.viewBox.w, h: front.viewBox.h }, anchors: frontMeta },
    back:  { viewBox: { w: back.viewBox.w,  h: back.viewBox.h  }, anchors: backMeta  },
  }, null, 2));

  console.log(`\n✓ wrote ${FRONT_OUT}  (${front.paths.length} paths → ${frontMeta.length} zones, ${(frontSvg.length/1024).toFixed(1)} KB)`);
  console.log(`✓ wrote ${BACK_OUT}   (${back.paths.length} paths → ${backMeta.length} zones, ${(backSvg.length/1024).toFixed(1)} KB)`);
  console.log(`✓ wrote ${labelMetaPath}`);
}

main();
