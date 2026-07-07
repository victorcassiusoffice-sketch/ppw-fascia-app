#!/usr/bin/env node
/**
 * Build-time Supps-affiliate manifest sync (Vic item 4).
 *
 * Reads the PRIVATE ppw-affiliates repo's manifest.json from a LOCAL clone and
 * copies it into src/config/supps-affiliates.json so the app consumes it as a
 * plain import — NO PAT in the client, no runtime private-repo access (same
 * no-PAT pattern as the protocol-PDF bake). The `affiliate_live` flag inside the
 * manifest drives the commission copy; nothing here decides money.
 *
 * Source (default, local clone on Vic's host):
 *   C:/Users/Victor/Documents/PPW-Code/ppw-affiliates/manifest.json
 * Env override: PPW_AFFILIATES_MANIFEST
 * Target: src/config/supps-affiliates.json
 *
 * CI-safe: if the source clone is absent, log + exit 0 leaving the committed
 * seed copy in place (the build still succeeds).
 *
 * No deps. Pure Node.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const targetPath = join(repoRoot, 'src', 'config', 'supps-affiliates.json');

const DEFAULT_SRC = 'C:/Users/Victor/Documents/PPW-Code/ppw-affiliates/manifest.json';
const sourcePath = process.env.PPW_AFFILIATES_MANIFEST || DEFAULT_SRC;
const log = (m) => console.log('[sync-supps-affiliates] ' + m);

if (!existsSync(sourcePath)) {
  log(`source manifest not found at ${sourcePath} — keeping committed seed at src/config/supps-affiliates.json, exit 0`);
  process.exit(0);
}

let data;
try { data = JSON.parse(readFileSync(sourcePath, 'utf8')); }
catch (e) { log('manifest parse failed: ' + e.message + ' — keeping seed, exit 0'); process.exit(0); }

// stamp provenance; keep the manifest shape intact (app reads program/supplements/by_protocol)
data._synced_at = data.generated_at_utc || '';
data._synced_from = (data.repo && data.repo.name) || 'ppw-affiliates';

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(targetPath, JSON.stringify(data, null, 2));

const n = Array.isArray(data.supplements) ? data.supplements.length : 0;
const pub = (data.counts && data.counts.publishable_now) ?? 0;
const live = !!(data.program && data.program.iherb && data.program.iherb.affiliate_live);
log(`synced ${n} supplement(s); publishable_now=${pub}; affiliate_live=${live}`);
if (!live) log('affiliate_live=false → app shows pre-signup disclosure, no cash-commission claim (correct until gate G-A1).');
