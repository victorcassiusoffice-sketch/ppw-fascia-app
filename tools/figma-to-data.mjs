#!/usr/bin/env node
// figma-to-data.mjs — Vic's Figma SVG → canonical HOTSPOTS arrays.
//
// Adapted from PPW Workflow Designer's original (which expected
// `zone__<code>` layer names) to handle Vic's HUMAN-readable layer names
// via an explicit translation table built from his FRONT/BACK layer audit.
//
// Usage:
//   node figma-to-data.mjs assets/figma-exports/front.svg assets/figma-exports/back.svg > tools/zones.generated.js
//
// Frame-coord input is rescaled to the canonical 600x1200 viewBox using the
// SVG's own viewBox attribute (Figma export embeds the frame's pixel size).
//
// Zero deps. Node 18+.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node figma-to-data.mjs front.svg back.svg');
  process.exit(1);
}
const [frontPath, backPath] = args;

// ─── Vic's name → canonical code map ──────────────────────────────────────────
// Decisions confirmed by Vic 2026-05-01:
//   • "Solar Plexus" → DROP (no canonical zone)
//   • "Neck and Trap L/R" → traps-left/right (neck on FRONT page covers neck)
//   • "Scapula L/R" → DROP (Upper Back already covers anatomically)
//   • "Gluteal L" duplicate (right-side, x≈329 in BACK frame) → gluteal-right
//   • Jaws not drawn → DROP from HOTSPOTS
//   • FRONT traps not drawn → keep traps in BACK only
//
// Keys are normalised: lowercased, all whitespace and "-" collapsed/removed.

function norm(s) {
  return String(s || '').toLowerCase().replace(/[\s\-]+/g, '');
}

const FRONT_NAME_MAP = new Map(Object.entries({
  'frontneckl': 'neck-left',
  'frontneckr': 'neck-right',
  'frontshoulderr': 'front-shoulder-right',
  'frontshoulderl': 'front-shoulder-left',
  'insideelbowr': 'elbow-right',
  'insideelbowl': 'elbow-left',
  'kneer': 'knee-right',
  'kneel': 'knee-left',
  'headfront': 'headache',
  'footandtoesr': 'calf-right',
  'footandtoesl': 'calf-left',
  'hipl': 'hip-flexor-left',
  'hipr': 'hip-flexor-right',
  'wristr': 'forearm-right',
  'wristl': 'forearm-left',
  // Drop:
  'solarplexus': null,
}));

const BACK_NAME_MAP = new Map(Object.entries({
  'backofhead': 'headache',
  'neckandtrapl': 'traps-left',
  'neckandtrapr': 'traps-right',
  'upperbackl': 'upper-back-left',
  'upperbackr': 'upper-back-right',
  'lowerbackl': 'lower-back-left',
  'lowerbackr': 'lower-back-right',
  'elbowl': 'elbow-left',
  'elbowr': 'elbow-right',
  'wristl': 'forearm-left',
  'wristr': 'forearm-right',
  'hamstringl': 'hamstrings-left',
  'hamstringr': 'hamstrings-right',
  'backofkneel': 'knee-left',
  'backofkneer': 'knee-right',
  'calftoanklel': 'calf-left',
  'calftoankler': 'calf-right',
  // "Gluteal L" appears twice — left + (typo) right. Disambiguate at extract
  // time by polygon centroid x. See resolveBackName().
  'glutealr': 'gluteal-right',
  // Drop:
  'scapulal': null,
  'scapular': null,
}));

function resolveFrontName(rawName) {
  return FRONT_NAME_MAP.has(norm(rawName)) ? FRONT_NAME_MAP.get(norm(rawName)) : undefined;
}

// For BACK, "Gluteal L" maps to gluteal-left if centroidX < midX, else gluteal-right.
function resolveBackName(rawName, centroidX, midX) {
  const k = norm(rawName);
  if (k === 'gluteall') {
    return centroidX < midX ? 'gluteal-left' : 'gluteal-right';
  }
  return BACK_NAME_MAP.has(k) ? BACK_NAME_MAP.get(k) : undefined;
}

// ─── SVG element scanning ─────────────────────────────────────────────────────

function* elements(svg, tag) {
  const re = new RegExp(`<${tag}\\b([\\s\\S]*?)/?>`, 'gi');
  let m;
  while ((m = re.exec(svg)) !== null) yield m[1];
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function getViewBox(svgText) {
  const m = svgText.match(/viewBox="([^"]+)"/);
  if (!m) return null;
  const [x, y, w, h] = m[1].trim().split(/\s+/).map(Number);
  return { x, y, w, h };
}

// ─── Path → polygon vertex list ───────────────────────────────────────────────
// Supports M/L/H/V/Z + curve commands (C/S/Q/T) by sampling endpoints only.
// For Vic's polygons drawn with the pen tool (clicks, no curves), this is exact.

function pathToPoints(d) {
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
  if (pts.length > 1) {
    const [fx, fy] = pts[0], [lx, ly] = pts[pts.length - 1];
    if (Math.abs(fx - lx) < 0.5 && Math.abs(fy - ly) < 0.5) pts.pop();
  }
  return pts;
}

// ─── Zone extraction ──────────────────────────────────────────────────────────
// Names live in <g id="..." data-name="..."> wrappers OR directly on the
// <polygon>/<path> via id/data-name. Figma exports nest one shape per <g>.

function extractZones(svgText, source, isFront) {
  const vb = getViewBox(svgText);
  if (!vb) {
    console.error(`ERROR ${source}: no viewBox attribute`);
    process.exit(2);
  }
  const sx = 600 / vb.w;
  const sy = 1200 / vb.h;
  const midX = vb.w / 2;

  // Walk every <g>: capture its name, then its first <polygon|path> child.
  const groupRe = /<g\b([^>]*)>([\s\S]*?)<\/g>/g;
  const out = new Map();
  const gluteAccum = []; // for "Gluteal L" duplicate disambiguation in BACK

  function grabPts(inner) {
    let m = inner.match(/<polygon\b([^>]*?)\/?>/i);
    if (m) {
      const pts = attr(m[1], 'points');
      if (pts) return pts.trim().split(/\s+/).map(p => p.split(',').map(Number));
    }
    m = inner.match(/<path\b([^>]*?)\/?>/i);
    if (m) {
      const d = attr(m[1], 'd');
      if (d) return pathToPoints(d);
    }
    return null;
  }

  let mg;
  while ((mg = groupRe.exec(svgText)) !== null) {
    const gAttrs = mg[1], inner = mg[2];
    const name = attr(gAttrs, 'data-name') || attr(gAttrs, 'id');
    if (!name) continue;
    const pts = grabPts(inner);
    if (!pts || pts.length < 3) continue;
    // Centroid in SVG (viewBox) coords
    let acx = 0, acy = 0;
    for (const [x, y] of pts) { acx += x; acy += y; }
    acx /= pts.length; acy /= pts.length;

    let code;
    if (isFront) {
      code = resolveFrontName(name);
    } else {
      code = resolveBackName(name, acx, midX);
    }
    if (code === undefined) {
      console.error(`WARN  ${source}: unrecognised layer "${name}" — skipped.`);
      continue;
    }
    if (code === null) {
      console.error(`SKIP  ${source}: "${name}" intentionally dropped per Vic decision.`);
      continue;
    }

    // Scale to 600x1200
    const scaled = pts.map(([x, y]) => [Math.round(x * sx), Math.round(y * sy)]);
    let cx = 0, cy = 0;
    for (const [x, y] of scaled) { cx += x; cy += y; }
    cx = Math.round(cx / scaled.length);
    cy = Math.round(cy / scaled.length);
    const polygon = scaled.map(([x, y]) => `${x},${y}`).join(' ');
    const rec = { code, cx, cy, polygon, source: name };
    if (out.has(code)) {
      console.error(`WARN  ${source}: duplicate canonical code "${code}" (from "${name}") — last one wins.`);
    }
    out.set(code, rec);
  }

  return [...out.values()];
}

// ─── Emit ─────────────────────────────────────────────────────────────────────

function emit(name, zones) {
  const rows = zones
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(z => `  { code: '${z.code}', cx: ${z.cx}, cy: ${z.cy}, polygon: '${z.polygon}' },`)
    .join('\n');
  return `export const ${name} = [\n${rows}\n];`;
}

const front = extractZones(fs.readFileSync(frontPath, 'utf8'), path.basename(frontPath), true);
const back  = extractZones(fs.readFileSync(backPath,  'utf8'), path.basename(backPath), false);

console.log(`// Generated by tools/figma-to-data.mjs at ${new Date().toISOString()}`);
console.log(`// Source: ${path.basename(frontPath)} (${front.length} zones), ${path.basename(backPath)} (${back.length} zones)`);
console.log(`// DO NOT EDIT BY HAND — re-run the script after editing in Figma.`);
console.log();
console.log(emit('HOTSPOTS_FRONT', front));
console.log();
console.log(emit('HOTSPOTS_BACK', back));
console.log();

console.error(`OK    FRONT: ${front.length} zones, BACK: ${back.length} zones`);
