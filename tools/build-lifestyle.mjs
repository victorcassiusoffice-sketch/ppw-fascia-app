// Build the app for its home at https://www.ppwellness.co/lifestyle-app/.
//
// Why a script instead of an inline env prefix: `VITE_BASE_PATH=… vite build`
// is POSIX-only, and npm runs scripts through cmd.exe on Windows, where it dies
// with "'VITE_BASE_PATH' is not recognized". This runs the same build on any OS.
//
// Why NOT `vite build --mode lifestyle`, the obvious alternative: Vite derives
// `import.meta.env.DEV` from `mode === 'production'`. A custom mode would set
// DEV=true in a shipped build — which would compile the dev-only Premium unlock
// INTO the live bundle and hand the paywall away. Mode stays 'production'; only
// the base path and output directory change.

import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  VITE_BASE_PATH: '/lifestyle-app/',
  VITE_OUT_DIR: 'dist-lifestyle',
};

const r = spawnSync('npx', ['vite', 'build'], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32', // npx resolves via shell on Windows
});

if (r.status !== 0) process.exit(r.status ?? 1);

console.log('\n✓ built dist-lifestyle/ with base /lifestyle-app/');
console.log('  copy to the marketing repo at: public_html/lifestyle-app/');
