#!/usr/bin/env node
// extract-zones.mjs — Vic's Figma SVG → canonical HOTSPOTS arrays.
//
// SVG paths are anonymous (Figma stripped IDs). We zip them by INDEX to the
// layer-name list captured from the earlier Figma metadata enumeration —
// verified that Figma SVG export emits paths in the same order as the
// node-id enumeration (paths 0-10 of FRONT match perfectly by bbox).
//
// FRONT view is mirrored (model facing us): Vic's anatomical "L" = image
// right = canonical "right". The L/R flip is applied per zone.
// BACK view is not mirrored (model facing away): Vic's "L" = canonical "left".
//
// Usage:
//   node tools/extract-zones.mjs > tools/zones.generated.js

import fs from 'node:fs';
import path from 'node:path';

const FE = 'assets/figma-exports';
const FRONT_SVG = fs.readFileSync(path.join(FE, 'front.svg'), 'utf8');
const BACK_SVG  = fs.readFileSync(path.join(FE, 'back.svg'),  'utf8');

// ─── Layer→canonical-code mapping (in metadata enumeration order) ────────────
// One row per Figma path, in the order Figma exports them.
// `code: null` = drop per Vic's approved decisions.
//
// FRONT view: Vic's L = image R = canonical RIGHT (anatomical→viewer mirror)
// BACK view:  Vic's L = image L = canonical LEFT (no mirror)

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
  { name: 'Solar Plexus',         code: null },          // DROP per Vic
];

const BACK_ORDER = [
  { name: 'Back of Head',         code: 'headache' },
  { name: 'Neck and Trap L',      code: 'traps-left' },
  { name: 'Neck and Trap R',      code: 'traps-right' },
  { name: 'Scapula L',            code: null },          // DROP per Vic
  { name: 'Scapula R',            code: null },          // DROP per Vic
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
  { name: 'Gluteal L (true left)',  code: 'gluteal-left' },   // first dup, x=119
  { name: 'Gluteal L (typo right)', code: 'gluteal-right' },  // second dup, x=329
];

// ─── Vertex extraction (vertex-only — discard Bezier control points) ─────────

function pathToVertices(d) {
  const tokens = d.match(/[MLHVZCSQTAmlhvzcsqta]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const pts = [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = null;
  const num = () => +tokens[i++];
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MLHVZCSQTAmlhvzcsqta]/.test(t)) { cmd = t; i++; continue; }
    if (cmd === 'M' || cmd === 'L') {
      x = num(); y = num(); pts.push([x, y]);
      if (cmd === 'M') { sx = x; sy = y; cmd = 'L'; }
    } else if (cmd === 'm' || cmd === 'l') {
      x += num(); y += num(); pts.push([x, y]);
      if (cmd === 'm') { sx = x; sy = y; cmd = 'l'; }
    } else if (cmd === 'H') { x = num(); pts.push([x, y]); }
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
  // Drop trailing duplicate vertex (closed path)
  if (pts.length > 1) {
    const [fx, fy] = pts[0];
    const [lx, ly] = pts[pts.length - 1];
    if (Math.abs(fx - lx) < 0.5 && Math.abs(fy - ly) < 0.5) pts.pop();
  }
  // Dedupe consecutive duplicates (e.g. M x y M x y from re-issuing M)
  const dedup = [];
  for (const p of pts) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.abs(p[0] - last[0]) > 0.5 || Math.abs(p[1] - last[1]) > 0.5) {
      dedup.push(p);
    }
  }
  return dedup;
}

// ─── Convex hull (Andrew's monotone chain) ───────────────────────────────────
// Some Figma paths have multiple subpaths (M restarts) producing zigzag vertex
// lists. Convex hull gives a clean polygon covering the same area — perfect
// for click-hotspot use.

function convexHull(pts) {
  if (pts.length < 3) return pts.slice();
  const cross = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const sorted = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

// ─── SVG <path> extraction ────────────────────────────────────────────────────
// Skip the body PNG fill rectangles — only count <path d="..."/> elements.

function svgPaths(svgText) {
  const re = /<path\b[^>]*?\bd="([^"]+)"/gi;
  const out = [];
  let m;
  while ((m = re.exec(svgText)) !== null) out.push(m[1]);
  return out;
}

function getViewBox(svgText) {
  const m = svgText.match(/viewBox="([^"]+)"/);
  if (!m) return null;
  const [x, y, w, h] = m[1].trim().split(/\s+/).map(Number);
  return { x, y, w, h };
}

// ─── Build HOTSPOTS array ─────────────────────────────────────────────────────

function buildHotspots(svgText, order, label) {
  const vb = getViewBox(svgText);
  const paths = svgPaths(svgText);
  console.error(`${label}: viewBox ${vb.w}x${vb.h}, ${paths.length} svg paths, ${order.length} layer slots`);
  if (paths.length !== order.length) {
    console.error(`ERR  ${label}: path count (${paths.length}) != order length (${order.length})`);
  }
  const sx = 600 / vb.w;
  const sy = 1200 / vb.h;
  const rows = [];
  for (let i = 0; i < paths.length; i++) {
    const slot = order[i] || { name: `(unmapped path ${i})`, code: undefined };
    const verts = pathToVertices(paths[i]);
    if (verts.length < 3) {
      console.error(`WARN ${label}[${i}] "${slot.name}" -> ${verts.length} vertices, skipping`);
      continue;
    }
    if (slot.code === null) {
      console.error(`SKIP ${label}[${i}] "${slot.name}" — dropped per Vic`);
      continue;
    }
    if (slot.code === undefined) {
      console.error(`WARN ${label}[${i}] "${slot.name}" — no canonical code`);
      continue;
    }
    // Use convex hull to get a clean polygon (esp. for multi-subpath paths)
    const hull = convexHull(verts);
    const scaled = hull.map(([x, y]) => [Math.round(x * sx), Math.round(y * sy)]);
    let cx = 0, cy = 0;
    for (const [x, y] of scaled) { cx += x; cy += y; }
    cx = Math.round(cx / scaled.length);
    cy = Math.round(cy / scaled.length);
    const polygon = scaled.map(([x, y]) => `${x},${y}`).join(' ');
    rows.push({ code: slot.code, cx, cy, polygon, source: slot.name });
    console.error(`  [${i}] "${slot.name}" -> ${slot.code}  cx=${cx} cy=${cy}  (${scaled.length} verts)`);
  }
  return rows;
}

function emitArray(name, rows) {
  const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code));
  const lines = sorted.map(r => `  { code: '${r.code}', cx: ${r.cx}, cy: ${r.cy}, polygon: '${r.polygon}' },  // ${r.source}`);
  return `export const ${name} = [\n${lines.join('\n')}\n];`;
}

const front = buildHotspots(FRONT_SVG, FRONT_ORDER, 'FRONT');
const back  = buildHotspots(BACK_SVG,  BACK_ORDER,  'BACK');

const header = `// Generated by tools/extract-zones.mjs at ${new Date().toISOString()}
// Source: assets/figma-exports/front.svg (${front.length} zones), assets/figma-exports/back.svg (${back.length} zones)
// Vic's hand-drawn polygons in Figma file C7CyNdQpC5o2OHCeUJyT4K.
// All coords rescaled to canonical 600x1200 viewBox.
// Anatomical L/R flipped to image L/R on FRONT view (model facing viewer).
// Polygons reduced to convex hulls for clean click-hotspot geometry.
// DO NOT EDIT BY HAND - re-run script after editing in Figma.
`;

console.log(header);
console.log(emitArray('HOTSPOTS_FRONT', front));
console.log();
console.log(emitArray('HOTSPOTS_BACK', back));

console.error(`\nOK   FRONT: ${front.length} zones, BACK: ${back.length} zones`);

