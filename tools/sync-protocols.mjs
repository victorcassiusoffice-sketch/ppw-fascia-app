#!/usr/bin/env node
/**
 * Build-time Protocol PDF bake (Vic item 1).
 *
 * Reads the PRIVATE ppw-protocols repo's manifest + PDFs from a LOCAL clone and
 * bundles ONLY the cleared subset into this app's public/ folder. No PAT is ever
 * embedded in the app; the private repo is read at BUILD time only (Option A in
 * ppw-protocols/ACCESS-MODEL-DECISION.md). The client later fetches the app's
 * OWN same-origin app-manifest.json — never the private repo.
 *
 * Source (local clone; override with env PPW_PROTOCOLS_DIR):
 *   C:/Users/Victor/Documents/PPW-Code/ppw-protocols
 *
 * SHIP RULE (all must hold):
 *   - app_eligible === true            (manifest's app-distribution clearance)
 *   - status is an APPROVED value      (free/approved/published/live)
 *   - NOT status "review" / draft / sample / do_not_publish
 *   - filename NOT in HARD_EXCLUDE     (testosterone-optimisation-v1.pdf — fabricated)
 *   - the PDF exists on disk
 *
 * Emits:
 *   public/protocols/pdf/<filename>.pdf         (bundled cleared PDFs)
 *   public/protocols/app-manifest.json          (app-facing subset the client reads)
 *
 * CI-safe: if the source clone is absent, leave any existing bundle untouched
 * and exit 0 (the build still succeeds; the app shows its empty state).
 *
 * No deps. Pure Node.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const SRC_DIR = process.env.PPW_PROTOCOLS_DIR || 'C:/Users/Victor/Documents/PPW-Code/ppw-protocols';
const OUT_DIR = join(repoRoot, 'public', 'protocols');
const OUT_PDF = join(OUT_DIR, 'pdf');
const OUT_MANIFEST = join(OUT_DIR, 'app-manifest.json');

const APPROVED = new Set(['free', 'approved', 'published', 'live']);
const HARD_EXCLUDE = new Set(['testosterone-optimisation-v1.pdf']);

const log = (m) => console.log('[sync-protocols] ' + m);

function isApproved(p) {
  const s = String(p.status || '').toLowerCase();
  if (!APPROVED.has(s)) return false;
  if (/review|draft|sample|do_not_publish|hold/.test(s)) return false;
  return true;
}

function writeEmptyManifest(reason) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_MANIFEST, JSON.stringify({ _schema: 'ppw.app.protocols', generatedAt: '', count: 0, note: reason, protocols: [] }, null, 2));
}

const manifestPath = join(SRC_DIR, 'manifest.json');
if (!existsSync(manifestPath)) {
  // CI without the private clone: don't clobber an existing bundle; if none, write empty.
  if (!existsSync(OUT_MANIFEST)) writeEmptyManifest('source clone not present at build');
  log('source manifest not found at ' + manifestPath + ' — leaving existing bundle, exit 0');
  process.exit(0);
}

let manifest;
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
catch (e) { log('manifest parse failed: ' + e.message + ' — writing empty bundle'); writeEmptyManifest('source manifest unreadable'); process.exit(0); }

const all = Array.isArray(manifest.protocols) ? manifest.protocols : [];
const shipped = [];
const excluded = [];

for (const p of all) {
  const filename = String(p.filename || '');
  const reasons = [];
  if (p.app_eligible !== true) reasons.push('app_eligible=' + p.app_eligible);
  if (!isApproved(p)) reasons.push('status=' + p.status);
  if (HARD_EXCLUDE.has(filename)) reasons.push('hard-excluded');
  const srcPdf = join(SRC_DIR, 'protocols', filename);
  if (!existsSync(srcPdf)) reasons.push('pdf-missing');
  if (reasons.length) { excluded.push({ id: p.id, filename, why: reasons.join(', ') }); continue; }
  // `register` (catalog: 'free' | 'monetised') is the monetisation signal — a
  // free protocol opens for everyone (lead magnet), a monetised one is gated
  // behind Premium in the app. Carry it through so the client can honour it;
  // anything not explicitly 'monetised' is treated as free (fail-open to visible).
  const register = String(p.register || 'free').toLowerCase() === 'monetised' ? 'monetised' : 'free';
  shipped.push({
    id: p.id, slug: p.slug || p.id, title: p.title, filename,
    category: p.category || '', tags: Array.isArray(p.tags) ? p.tags : [],
    version: p.version || '1', register, url: 'protocols/pdf/' + filename,
  });
}

// rewrite the bundled pdf dir from scratch so a de-approved item is removed on rebuild
rmSync(OUT_PDF, { recursive: true, force: true });
mkdirSync(OUT_PDF, { recursive: true });
for (const p of shipped) copyFileSync(join(SRC_DIR, 'protocols', p.filename), join(OUT_PDF, p.filename));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_MANIFEST, JSON.stringify({
  _schema: 'ppw.app.protocols', generatedAt: manifest.generated_at_utc || '',
  source: (manifest.repo && manifest.repo.name) || 'ppw-protocols',
  count: shipped.length, protocols: shipped,
}, null, 2));

log(`shipped ${shipped.length}/${all.length} protocol(s)`);
if (shipped.length) shipped.forEach((p) => log('  + ' + p.filename));
log(`excluded ${excluded.length}: ` + excluded.map((e) => e.filename + ' (' + e.why + ')').join('; '));
if (!shipped.length) log('NOTE: zero cleared for app today — both app_eligible items are status=review (GATE-2 pending). App shows its empty state until Vic approves.');
