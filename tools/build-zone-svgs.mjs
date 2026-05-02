#!/usr/bin/env node
// build-zone-svgs.mjs — Transform Vic's raw Figma exports into ID-tagged SVGs.
//
// Reads:  assets/figma-exports/{front,back}.svg
// Writes: public/assets/body_zones/body_zones_{front,back}.svg
//
// The output SVGs preserve Figma's coordinate space exactly (front 432×1113,
// back 436×1203) and contain BOTH the body image (as a pattern fill) and the
// polygon zones in the SAME `<svg>`. Each polygon gets:
//   id="zone-{slug}"  data-zone="{slug}"  class="zone"
// matching the canonical zone codes from src/data.js ZONES.
//
// Path-index → zone-slug mapping comes from FRONT_ORDER / BACK_ORDER below
// (mirrors tools/extract-zones.mjs — that file remains the historical record).
//
// Pattern IDs are namespaced (frontBodyPattern / backBodyPattern) so both
// SVGs can coexist in the same DOM without `url(#...)` collisions.
//
// Run after re-exporting from Figma:
//   node tools/build-zone-svgs.mjs

import fs from 'node:fs';
import path from 'node:path';

const FRONT_IN  = 'assets/figma-exports/front.svg';
const BACK_IN   = 'assets/figma-exports/back.svg';
const OUT_DIR   = 'public/assets/body_zones';
const FRONT_OUT = path.join(OUT_DIR, 'body_zones_front.svg');
const BACK_OUT  = path.join(OUT_DIR, 'body_zones_back.svg');

// Path index → canonical zone slug. null = drop (per Vic 2026-05-01 decisions).
// FRONT view is mirrored (model facing viewer): Vic's "L" = image-right.
// BACK view is not mirrored: Vic's "L" = image-left.
const FRONT_ORDER = [
  { name: 'Front Neck L',         code: 'neck-right' },
  { name: 'Front Neck R',         code: 'neck-left' },
  { name: 'Front Shoulder - R',   code: 'front-shoulder-left' },
  { name: 'Inside Elbow - R',     code: 'elbow-left' },
  { name: 'Inside Elbow - L',     code: 'elbow-right' },
  { name: 'Knee -R',              code: 'knee-left' },
  { name: 'Knee - L',             code: 'knee-right' },
  { name: 'Front Shoulder - L',   code: 'front-shoulder-right' },
  { name: 'Head Front',           code: 'headache' },
  { name: 'Foot and Toes -R',     code: 'calf-left' },
  { name: 'Foot and Toes L',      code: 'calf-right' },
  { name: 'Hip L',                code: 'hip-flexor-right' },
  { name: 'Hip R',                code: 'hip-flexor-left' },
  { name: 'Wrist R',              code: 'forearm-left' },
  { name: 'Wrist L',              code: 'forearm-right' },
  { name: 'Solar Plexus',         code: null },
];

const BACK_ORDER = [
  { name: 'Back of Head',         code: 'headache' },
  { name: 'Neck and Trap L',      code: 'traps-left' },
  { name: 'Neck and Trap R',      code: 'traps-right' },
  { name: 'Scapula L',            code: null },
  { name: 'Scapula R',            code: null },
  { name: 'Upper Back L',         code: 'upper-back-left' },
  { name: 'Lower Back L',         code: 'lower-back-left' },
  { name: 'Hamstring L',          code: 'hamstrings-left' },
  { name: 'Calf to ankle L',      code: 'calf-left' },
  { name: 'Calf to ankle R',      code: 'calf-right' },
  { name: 'Hamstring R',          code: 'hamstrings-right' },
  { name: 'Lower Back R',         code: 'lower-back-right' },
  { name: 'Upper back R',         code: 'upper-back-right' },
  { name: 'Elbow L',              code: 'elbow-left' },
  { name: 'Elbow R',              code: 'elbow-right' },
  { name: 'Wrist L',              code: 'forearm-left' },
  { name: 'Back of Knee L',       code: 'knee-left' },
  { name: 'Back of Knee R',       code: 'knee-right' },
  { name: 'Wrist R',              code: 'forearm-right' },
  { name: 'Gluteal L (true left)',  code: 'gluteal-left' },
  { name: 'Gluteal L (typo right)', code: 'gluteal-right' },
];

// Compute centroid of a path's d-attribute by parsing M/L/H/V vertices only.
// Used purely for the optional <text> label `cx`/`cy` anchors emitted into the
// SVG so consumers can position labels without re-parsing.
function pathCentroid(d) {
  const tokens = d.match(/[MLHVZCSQTAmlhvzcsqta]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const pts = [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = null;
  const num = () => +tokens[i++];
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MLHVZCSQTAmlhvzcsqta]/.test(t)) { cmd = t; i++; continue; }
    if (cmd === 'M' || cmd === 'L') { x = num(); y = num(); pts.push([x, y]); if (cmd === 'M') { sx = x; sy = y; cmd = 'L'; } }
    else if (cmd === 'm' || cmd === 'l') { x += num(); y += num(); pts.push([x, y]); if (cmd === 'm') { sx = x; sy = y; cmd = 'l'; } }
    else if (cmd === 'H') { x = num(); pts.push([x, y]); }
    else if (cmd === 'h') { x += num(); pts.push([x, y]); }
    else if (cmd === 'V') { y = num(); pts.push([x, y]); }
    else if (cmd === 'v') { y += num(); pts.push([x, y]); }
    else if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; }
    else if (cmd === 'C') { num(); num(); num(); num(); x = num(); y = num(); pts.push([x, y]); }
    else if (cmd === 'c') { num(); num(); num(); num(); x += num(); y += num(); pts.push([x, y]); }
    else if (cmd === 'S' || cmd === 'Q') { num(); num(); x = num(); y = num(); pts.push([x, y]); }
    else if (cmd === 's' || cmd === 'q') { num(); num(); x += num(); y += num(); pts.push([x, y]); }
    else if (cmd === 'T') { x = num(); y = num(); pts.push([x, y]); }
    else if (cmd === 't') { x += num(); y += num(); pts.push([x, y]); }
    else if (cmd === 'A') { num(); num(); num(); num(); num(); x = num(); y = num(); pts.push([x, y]); }
    else if (cmd === 'a') { num(); num(); num(); num(); num(); x += num(); y += num(); pts.push([x, y]); }
    else { i++; }
  }
  if (!pts.length) return [0, 0];
  // Bbox centre — robust for irregular shapes.
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const [px, py] of pts) {
    if (px < xmin) xmin = px; if (px > xmax) xmax = px;
    if (py < ymin) ymin = py; if (py > ymax) ymax = py;
  }
  return [(xmin + xmax) / 2, (ymin + ymax) / 2];
}

// Parse the Figma SVG. Returns { viewBox, defs, paths }.
//   defs = inner content of <defs> (pattern + image)
//   paths = ordered list of { d, full } where `full` is the original tag.
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
//   viewName = 'front' | 'back' (used to namespace pattern ids)
//   parsed   = parseFigma() result
//   order    = FRONT_ORDER | BACK_ORDER
function buildSvg(viewName, parsed, order) {
  const { viewBox, defs, paths } = parsed;
  if (paths.length !== order.length) {
    throw new Error(`${viewName}: path count ${paths.length} != order length ${order.length}`);
  }
  const ns = viewName; // 'front' | 'back'

  // Re-id pattern + image refs to namespaced names (frontBodyPattern, etc.).
  // Original ids look like `pattern0_2_2` and `image0_2_2`. Match-and-replace
  // both within the defs block AND in any <use href> inside.
  const oldPatternId = (defs.match(/<pattern[^>]*id="([^"]+)"/) || [, ''])[1];
  const oldImageId   = (defs.match(/<image[^>]*id="([^"]+)"/) || [, ''])[1];
  const newPatternId = `${ns}BodyPattern`;
  const newImageId   = `${ns}BodyImage`;

  let cleanDefs = defs;
  if (oldPatternId) {
    cleanDefs = cleanDefs.replaceAll(oldPatternId, newPatternId);
  }
  if (oldImageId) {
    cleanDefs = cleanDefs.replaceAll(oldImageId, newImageId);
  }

  // Build polygon block — each path tagged with id + data-zone, fill set to
  // transparent so app CSS controls hover/selected appearance.
  const zoneEls = [];
  const labelMeta = []; // { code, cx, cy } emitted in JSON for app convenience
  for (let i = 0; i < paths.length; i++) {
    const { d } = paths[i];
    const slug = order[i].code;
    if (!slug) continue; // dropped per Vic
    const [cx, cy] = pathCentroid(d);
    labelMeta.push({ code: slug, cx: +cx.toFixed(1), cy: +cy.toFixed(1) });
    zoneEls.push(
      `  <path id="zone-${slug}" data-zone="${slug}" class="zone" ` +
      `fill="transparent" stroke="none" d="${d}"/>`
    );
  }

  // Final SVG. We deliberately drop Figma's white background rect (so the app
  // page background shows through the figure outside the body silhouette).
  const out =
`<?xml version="1.0" encoding="UTF-8"?>
<!--
  PPW Body Zones — ${viewName.toUpperCase()} view.
  Generated by tools/build-zone-svgs.mjs from assets/figma-exports/${viewName}.svg.
  DO NOT HAND-EDIT — re-run the build script after exporting from Figma.

  Coordinate system: ${viewBox.w} × ${viewBox.h} (Figma frame size — the body
  image and polygon zones share this exact space, so click targets sit on the
  anatomy by construction).
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
  return { svg: out, labelMeta };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const front = parseFigma(fs.readFileSync(FRONT_IN, 'utf8'));
  const back  = parseFigma(fs.readFileSync(BACK_IN,  'utf8'));

  const { svg: frontSvg, labelMeta: frontMeta } = buildSvg('front', front, FRONT_ORDER);
  const { svg: backSvg,  labelMeta: backMeta  } = buildSvg('back',  back,  BACK_ORDER);

  fs.writeFileSync(FRONT_OUT, frontSvg);
  fs.writeFileSync(BACK_OUT,  backSvg);

  // Emit a small JSON of label anchors for the app to consume.
  const labelMetaPath = path.join(OUT_DIR, 'zone_label_anchors.json');
  fs.writeFileSync(labelMetaPath, JSON.stringify({
    front: { viewBox: { w: front.viewBox.w, h: front.viewBox.h }, anchors: frontMeta },
    back:  { viewBox: { w: back.viewBox.w,  h: back.viewBox.h  }, anchors: backMeta  },
  }, null, 2));

  console.log(`✓ wrote ${FRONT_OUT}  (${front.paths.length} paths → ${frontMeta.length} zones, ${(frontSvg.length/1024).toFixed(1)} KB)`);
  console.log(`✓ wrote ${BACK_OUT}   (${back.paths.length} paths → ${backMeta.length} zones, ${(backSvg.length/1024).toFixed(1)} KB)`);
  console.log(`✓ wrote ${labelMetaPath}`);
}

main();
