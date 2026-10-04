#!/usr/bin/env node
/**
 * Build-time health data bake (health-pack Phase 1).
 *
 * Copies the vetted health data from docs/health-pack/data/ into public/health/
 * so the app can fetch it same-origin and lazily. research-raw/ is the audit
 * trail behind the numbers and is deliberately NOT shipped.
 *
 * Emits:
 *   public/health/nutrients.json
 *   public/health/ingredients.json
 *   public/health/rules.json
 *   public/health/protocols/*.md + index.json
 *   public/health/manifest.json   (file -> {version, generatedAt, sha256})
 *
 * The manifest exists so the service worker can key its cache on content: when
 * a data file changes, its sha256 changes, so the cached copy is replaced
 * rather than served stale. Protocol files are hashed here too — Phase 5 marks
 * the 9 standard protocols trusted by id + SHA-256 computed at build time, and
 * this is where that hash comes from.
 *
 * CI-safe: if docs/health-pack/data is absent, leave any existing bundle alone
 * and exit 0, matching sync-protocols.mjs.
 *
 * No deps. Pure Node.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const SRC_DIR = join(repoRoot, 'docs', 'health-pack', 'data');
const OUT_DIR = join(repoRoot, 'public', 'health');

// Shipped as-is. research-raw/ is excluded on purpose: it is the working
// research behind these numbers, kept for audit, not for the client.
const TOP_FILES = ['nutrients.json', 'ingredients.json', 'rules.json'];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function main() {
  if (!existsSync(SRC_DIR)) {
    console.log('[sync-health] no docs/health-pack/data — leaving public/health as is');
    return;
  }

  // Rebuild cleanly so a file deleted upstream does not linger in the bundle.
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(join(OUT_DIR, 'protocols'), { recursive: true });

  const manifest = { generatedAt: new Date().toISOString().slice(0, 10), files: {} };

  for (const f of TOP_FILES) {
    const src = join(SRC_DIR, f);
    if (!existsSync(src)) {
      console.error(`[sync-health] MISSING required file: ${f}`);
      process.exit(1);
    }
    const buf = readFileSync(src);
    let parsed;
    try {
      parsed = JSON.parse(buf.toString('utf8'));
    } catch (e) {
      console.error(`[sync-health] ${f} is not valid JSON: ${e.message}`);
      process.exit(1);
    }
    writeFileSync(join(OUT_DIR, f), buf);
    manifest.files[f] = {
      version: parsed._version ?? null,
      generatedAt: parsed.generatedAt ?? null,
      sha256: sha256(buf),
      bytes: buf.length,
    };
  }

  const protoSrc = join(SRC_DIR, 'protocols');
  let protoCount = 0;
  if (existsSync(protoSrc)) {
    for (const name of readdirSync(protoSrc)) {
      if (!/\.(md|json)$/i.test(name)) continue;
      const buf = readFileSync(join(protoSrc, name));
      writeFileSync(join(OUT_DIR, 'protocols', name), buf);
      // Phase 5 trusts a bundled protocol by id + this hash. Computed here so
      // a hand-edited file in public/ can never pass as a vetted one.
      manifest.files[`protocols/${name}`] = { sha256: sha256(buf), bytes: buf.length };
      protoCount++;
    }
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[sync-health] ${TOP_FILES.length} data files + ${protoCount} protocol files -> public/health/`);
}

main();
