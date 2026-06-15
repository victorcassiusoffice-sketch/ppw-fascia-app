import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Set VITE_BASE_PATH env var to deploy under a subdirectory.
// Default '/' works for root domain. Set to '/app/' for ppwellness.co/app/
const base = process.env.VITE_BASE_PATH || '/';

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
  return {
    name: 'ppw-sw-version',
    apply: () => true,
    // dev: rewrite sw.js on the fly so the dev/preview SW carries a real version
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (!path.endsWith('/sw.js') && path !== '/sw.js') return next();
        const swPath = resolve(process.cwd(), 'public/sw.js');
        if (!existsSync(swPath)) return next();
        const out = readFileSync(swPath, 'utf8').replace(TOKEN, BUILD_VERSION);
        res.setHeader('Content-Type', 'text/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(out);
      });
    },
    // build: replace the token in the copied dist/sw.js
    closeBundle() {
      const swOut = resolve(process.cwd(), 'dist/sw.js');
      if (!existsSync(swOut)) return;
      const src = readFileSync(swOut, 'utf8');
      writeFileSync(swOut, src.replace(TOKEN, BUILD_VERSION));
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
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'] }
      }
    }
  }
});
