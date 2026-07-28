import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Set VITE_BASE_PATH env var to deploy under a subdirectory.
// Default '/' works for root domain + local dev.
//   GitHub Pages (staging) : VITE_BASE_PATH=/ppw-fascia-app/   (set by CI)
//   ppwellness.co (target) : VITE_BASE_PATH=/lifestyle-app/    (npm run build:lifestyle)
const base = process.env.VITE_BASE_PATH || '/';

// Where the build lands. The lifestyle build writes to its own directory so a
// subpath build can never overwrite the GitHub Pages `dist/` that CI publishes.
const outDir = process.env.VITE_OUT_DIR || 'dist';

// Build version — drives the SW cache name so EVERY deploy invalidates the old
// cache (the root cause of returning PWA users being pinned to a stale build).
// Prefer the short git SHA (unique per commit, stable across rebuilds of the
// same commit); fall back to package version + timestamp when git is absent.
function computeBuildVersion() {
  if (process.env.PPW_BUILD_VERSION) return process.env.PPW_BUILD_VERSION;
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (sha) return sha;
  } catch {
    /* git not available (e.g. tarball build) — fall through */
  }
  try {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    return `${pkg.version || '0.0.0'}-${Date.now()}`;
  } catch {
    return `build-${Date.now()}`;
  }
}

const BUILD_VERSION = computeBuildVersion();

// Stamps BUILD_VERSION into the emitted service worker. sw.js lives in public/
// (copied verbatim, so Vite's %ENV% HTML replacement never touches it); this
// plugin rewrites the '__BUILD_VERSION__' token in the built dist/sw.js, and
// serves a stamped copy in dev so the update flow is testable end-to-end.
function ppwSwVersionPlugin() {
  const TOKEN = /__BUILD_VERSION__/g;
  // Resolved from Vite rather than hardcoded to 'dist' — the lifestyle build
  // emits elsewhere, and stamping the wrong directory would ship a service
  // worker still carrying the literal __BUILD_VERSION__ token (no cache
  // invalidation, i.e. returning users pinned to a stale build).
  let resolvedOutDir = outDir;
  return {
    name: 'ppw-sw-version',
    apply: () => true,
    configResolved(cfg) {
      resolvedOutDir = cfg.build?.outDir || outDir;
    },
    // dev: rewrite sw.js on the fly so the dev/preview SW carries a real version
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        // Version sentinel — served fresh so the dev/preview update flow is
        // testable end-to-end (the client probes this no-store).
        if (path.endsWith('/version.json') || path === '/version.json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ build: BUILD_VERSION }));
          return;
        }
        if (!path.endsWith('/sw.js') && path !== '/sw.js') return next();
        const swPath = resolve(process.cwd(), 'public/sw.js');
        if (!existsSync(swPath)) return next();
        const out = readFileSync(swPath, 'utf8').replace(TOKEN, BUILD_VERSION);
        res.setHeader('Content-Type', 'text/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(out);
      });
    },
    // build: replace the token in the copied dist/sw.js + emit the version
    // sentinel the client compares against to detect a new deploy.
    closeBundle() {
      // Guard on dist existing — closeBundle can fire while rollup is unwinding
      // a failed build (no output written); writing then ENOENTs and MASKS the
      // real compile error. Skip silently when there's nothing to stamp.
      const distDir = resolve(process.cwd(), resolvedOutDir);
      if (!existsSync(distDir)) return;
      const swOut = resolve(distDir, 'sw.js');
      if (existsSync(swOut)) {
        const src = readFileSync(swOut, 'utf8');
        writeFileSync(swOut, src.replace(TOKEN, BUILD_VERSION));
      }
      writeFileSync(
        resolve(distDir, 'version.json'),
        JSON.stringify({ build: BUILD_VERSION }) + '\n'
      );
    },
  };
}

export default defineConfig({
  base,
  define: {
    // Exposed to the client so the update toast / logs can name the build.
    __PPW_BUILD__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [react(), ppwSwVersionPlugin()],
  server: { port: 3000, host: true, open: true },
  // P1 (2026-06-02) — vitest config for the add-URL regression guard.
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
  build: {
    outDir,
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'] }
      }
    }
  }
});
