#!/usr/bin/env node
/**
 * Iter 2 Phase 9.1 — sync affiliate registry from PPW Second Brain vault
 * into src/config/affiliates.json at build time.
 *
 * Vault path (canonical, host filesystem):
 *   C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/affiliate-dept/affiliate-registry.json
 *
 * Override via env:
 *   PPW_AFFILIATE_REGISTRY=/absolute/path/to/affiliate-registry.json
 *
 * Behaviour:
 *   - If the vault file is readable, copy its contents into src/config/affiliates.json.
 *   - If the vault file is missing (e.g. CI environment without the vault mount),
 *     leave src/config/affiliates.json untouched and exit 0. The existing
 *     baked-in copy continues to drive the build.
 *
 * No deps. Pure Node.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const targetPath = join(repoRoot, 'src', 'config', 'affiliates.json');

const DEFAULT_VAULT_PATH = 'C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/affiliate-dept/affiliate-registry.json';
const sourcePath = process.env.PPW_AFFILIATE_REGISTRY || DEFAULT_VAULT_PATH;

if (!existsSync(sourcePath)) {
  console.log(`[sync-affiliates] vault file not found at ${sourcePath} — skipping. Build will use existing src/config/affiliates.json.`);
  process.exit(0);
}

let raw;
try {
  raw = readFileSync(sourcePath, 'utf8');
} catch (err) {
  console.warn(`[sync-affiliates] could not read ${sourcePath}: ${err.message}. Skipping.`);
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error(`[sync-affiliates] vault file is not valid JSON: ${err.message}. Aborting build.`);
  process.exit(1);
}

const targetDir = dirname(targetPath);
if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

// Stamp the sync time + provenance so debug is easy.
parsed._note = (parsed._note || '') + ' [synced from vault by tools/sync-affiliates.mjs]';
parsed._synced_at = new Date().toISOString();
parsed._synced_from = sourcePath;

writeFileSync(targetPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
console.log(`[sync-affiliates] wrote ${targetPath} from ${sourcePath}`);
