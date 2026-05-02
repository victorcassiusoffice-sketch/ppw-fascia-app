// bodyZones.js — Single source of truth for body-map geometry.
//
// PERMANENT-FIX ARCHITECTURE (2026-05-02). This replaces the
// previous PNG-figure + separate polygon-array approach, which kept
// drifting because the polygons were authored in Figma against a
// body in a slightly different position/scale than the rasterised PNG.
//
// HOW THIS CAN'T FAIL ANY MORE:
//   • Vic draws everything in Figma (PPW Body Zones, file C7CyNdQpC5o2OHCeUJyT4K)
//   • `node tools/build-zone-svgs.mjs` exports the FRONT and BACK frames
//     each as a single SVG containing BOTH the body image (as a `<pattern>`
//     fill referencing an embedded base64 PNG) AND the polygon zones — all
//     in the same coordinate system (front 432×1113, back 436×1203).
//   • Each polygon is tagged with id="zone-{slug}" / data-zone="{slug}".
//   • This module imports those SVGs as raw strings (Vite ?raw), parses
//     them once at module load, and exposes:
//       getBodyView('front' | 'back') → { viewBox, defs, patternId, polygons }
//   • The React component embeds `defs` via dangerouslySetInnerHTML and
//     renders each polygon as a React `<path>` element so it controls
//     click/hover/selection state — but the GEOMETRY comes straight from
//     Figma, so polygons sit on the anatomy by construction.
//
// To re-export from Figma after a polygon edit:
//   1. Export FRONT and BACK frames as SVG into assets/figma-exports/
//   2. node tools/build-zone-svgs.mjs
//   3. Restart vite (raw imports are baked at build time).

import frontSvg from '../public/assets/body_zones/body_zones_front.svg?raw';
import backSvg  from '../public/assets/body_zones/body_zones_back.svg?raw';

/**
 * Extract from a generated body-zones SVG everything the React component
 * needs to re-render it inline:
 *   - viewBox dimensions
 *   - the namespaced pattern id (so the component's <rect fill> can reference it)
 *   - the inner HTML of the <defs> block (pattern + base64 image),
 *     emitted via dangerouslySetInnerHTML
 *   - the ordered polygon list: { code, d } where `code` is the canonical
 *     zone slug from data.js ZONES.
 *
 * Throws on any parse failure — the SVGs are build-time artifacts, so a
 * shape mismatch should fail loudly during dev rather than silently
 * mis-rendering in production.
 */
function parseBodySvg(svgText, viewName) {
  const viewBoxM = svgText.match(/viewBox="([^"]+)"/);
  if (!viewBoxM) throw new Error(`bodyZones[${viewName}]: missing viewBox`);
  const [, , w, h] = viewBoxM[1].trim().split(/\s+/).map(Number);

  const defsM = svgText.match(/<defs>([\s\S]*?)<\/defs>/);
  if (!defsM) throw new Error(`bodyZones[${viewName}]: missing <defs>`);
  const defs = defsM[1];

  const patternIdM = defs.match(/<pattern[^>]*id="([^"]+)"/);
  if (!patternIdM) throw new Error(`bodyZones[${viewName}]: no pattern id in defs`);
  const patternId = patternIdM[1];

  // Match <path id="zone-{slug}" data-zone="{slug}" class="zone" ... d="..."/>
  // (attribute order is fixed by build-zone-svgs.mjs, but this regex tolerates
  // attribute reordering should the script change.)
  const polygons = [];
  const re = /<path\b[^>]*\bdata-zone="([^"]+)"[^>]*\bd="([^"]+)"[^>]*\/?>/gi;
  let m;
  while ((m = re.exec(svgText)) !== null) {
    polygons.push({ code: m[1], d: m[2] });
  }
  // Fallback ordering — try the inverse attribute order if the first regex
  // missed (id before data-zone in some attribute orderings).
  if (polygons.length === 0) {
    const re2 = /<path\b[^>]*\bd="([^"]+)"[^>]*\bdata-zone="([^"]+)"[^>]*\/?>/gi;
    let m2;
    while ((m2 = re2.exec(svgText)) !== null) {
      polygons.push({ code: m2[2], d: m2[1] });
    }
  }
  if (polygons.length === 0) {
    throw new Error(`bodyZones[${viewName}]: no <path data-zone> entries found`);
  }
  return { viewBox: { w, h }, defs, patternId, polygons };
}

const FRONT = parseBodySvg(frontSvg, 'front');
const BACK  = parseBodySvg(backSvg,  'back');

export function getBodyView(view) {
  return view === 'back' ? BACK : FRONT;
}

// Compute bbox-centre for a path's d attribute. Used to position labels
// above selected polygons. Memoised by zone code per view.
const _centroidCache = new WeakMap(); // map view-object → Map<code, [cx,cy]>

function bboxCentre(d) {
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
    if (/[MLHVZCSQTAmlhvzcsqta]/.test(t)) { cmd = t; i++; continue; }
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
  return [(xmin + xmax) / 2, (ymin + ymax) / 2];
}

export function zoneCentroid(view, code) {
  const v = getBodyView(view);
  let cache = _centroidCache.get(v);
  if (!cache) { cache = new Map(); _centroidCache.set(v, cache); }
  if (cache.has(code)) return cache.get(code);
  const p = v.polygons.find(x => x.code === code);
  const c = p ? bboxCentre(p.d) : [0, 0];
  cache.set(code, c);
  return c;
}
