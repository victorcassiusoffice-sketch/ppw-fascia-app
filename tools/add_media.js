#!/usr/bin/env node
/**
 * tools/add_media.js — drop a media.json into the right leaf folder.
 *
 * USAGE
 *   npm run add-media -- --type video  --youtube <id> --title "..." --duration <sec> --zone <code> --level <beginner|intermediate|advanced>
 *   npm run add-media -- --type video  --youtube <id> --title "..." --duration <sec> --lifestyle <code> [--zone <code>|--all] --level <...>
 *   npm run add-media -- --type audio  --youtube <id> --title "..." --duration <sec> --module <slug>
 *
 * EXAMPLES
 *   npm run add-media -- --type video --youtube Uro31OnQ1uw --title "Lower Back Release" --duration 1058 --zone 12_lower_back_left --level beginner
 *   npm run add-media -- --type audio --youtube bYbSr5b_mwM --title "Daytime Stress" --duration 326 --module daytime_stress
 *   npm run add-media -- --type video --youtube wOrF6dagTbE --title "Office Worker Reset" --duration 509 --lifestyle office --all --level beginner
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all')      { out.all = true; continue; }
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) { out[k] = true; }
      else                                       { out[k] = v; i++; }
    }
  }
  return out;
}

function die(msg) {
  console.error('\n  ERROR:', msg, '\n');
  console.error('  See `tools/add_media.js` header for usage.\n');
  process.exit(1);
}

function writeMedia(dir, payload) {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'media.json');
  fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n');
  console.log('  ✓', path.relative(ROOT, target));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const type     = args.type     || 'video';
  const youtube  = args.youtube;
  const title    = args.title;
  const duration = args.duration ? Number(args.duration) : null;

  if (!youtube)  die('--youtube <id> is required');
  if (!title)    die('--title "..." is required');
  if (!duration || !Number.isFinite(duration)) die('--duration <seconds> is required');
  if (!['video', 'audio'].includes(type)) die('--type must be "video" or "audio"');

  const payload = {
    media_type: type,
    youtube_id: youtube,
    title,
    duration_sec: duration,
    level_overrides: null,
  };

  // Module path: /videos/modules/<type>/<slug>/media.json
  if (args.module) {
    const dir = path.join(ROOT, 'public', 'videos', 'modules', type, args.module);
    writeMedia(dir, payload);
    return;
  }

  // Lifestyle path: /videos/lifestyle_protocols/<lifestyle>/<zone|_all>/<level>/media.json
  if (args.lifestyle) {
    const level = args.level;
    if (!level) die('--level <beginner|intermediate|advanced> is required for lifestyle media');
    const zoneSeg = args.all ? '_all' : args.zone;
    if (!zoneSeg) die('--zone <code> or --all is required for lifestyle media');
    const dir = path.join(ROOT, 'public', 'videos', 'lifestyle_protocols', args.lifestyle, zoneSeg, level);
    writeMedia(dir, payload);
    return;
  }

  // Default zone path: /videos/zones/<zone>/<level>/media.json
  if (args.zone) {
    const level = args.level;
    if (!level) die('--level <beginner|intermediate|advanced> is required for zone media');
    const dir = path.join(ROOT, 'public', 'videos', 'zones', args.zone, level);
    writeMedia(dir, payload);
    return;
  }

  die('Provide one of --zone, --lifestyle, or --module to locate the media.');
}

main();
