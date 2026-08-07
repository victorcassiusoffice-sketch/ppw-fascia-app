// Build display-size wordmarks from the full-resolution source art.
//
// WHY THIS EXISTS. The per-colourway logos in public/assets are 1152x928 (crimson
// 2304x1856) and 1.5-4MB each. That is right for masters and wrong for the first
// screen a new customer ever loads, quite possibly on mobile data: wiring the art
// up as-is would have put ~1.5MB in front of every visitor before they had decided
// whether they wanted the app at all.
//
// The PNGs stay exactly as they are — nothing is overwritten or deleted. This
// writes a .webp sibling for each, 384px wide (2x its render size). PNG suits flat
// graphics; these are photographic neumorphic renders with gradients and grain,
// which is the case WebP is built for — hence roughly 400x, not 4x.
//
// Uses sharp, already present in node_modules as a transitive dependency; no new
// package was installed for this. Re-run after replacing any source art:
//   node tools/make-logo-webp.mjs

import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';

const DIR = 'public/assets';
const WIDTH = 384;

const sources = readdirSync(DIR).filter((f) => /^ppw-logo-.*\.png$/.test(f)).sort();
if (!sources.length) {
  console.error(`No ppw-logo-*.png found in ${DIR}`);
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
let before = 0;
let after = 0;

console.log(['file', 'source px', 'png', 'webp', 'saving'].join('\t'));
for (const file of sources) {
  const out = file.replace(/\.png$/, '.webp');
  const src = `${DIR}/${file}`;
  const meta = await sharp(src).metadata();
  await sharp(src)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: 86, effort: 6 })
    .toFile(`${DIR}/${out}`);

  const a = statSync(src).size;
  const b = statSync(`${DIR}/${out}`).size;
  before += a;
  after += b;
  console.log([out, `${meta.width}x${meta.height}`, kb(a), kb(b), `${Math.round(a / b)}x`].join('\t'));
}
console.log(`\nTOTAL  ${kb(before)} → ${kb(after)}  (${Math.round(before / after)}x smaller)`);
