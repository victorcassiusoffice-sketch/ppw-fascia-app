import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set VITE_BASE_PATH env var to deploy under a subdirectory.
// Default '/' works for root domain. Set to '/app/' for ppwellness.co/app/
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
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
