// Interaction-proof captures (forensic-audit P2.9): states stills can't show.
//  1. REF-04/05 — Add-Stack select→expand morph (sheet open).
//  2. REF-07 — deck select-to-front (card lifted + expanded).
//  3. REF-09 — theme toggle knob states (dark + after tap → light).
// Usage: node tools/shoot-proofs.mjs <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || '.shots/proofs';
const BASE = process.argv[3] || 'http://localhost:3000';
const todayISO = new Date().toISOString().slice(0, 10);
const SEED = {
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'knee-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 'seed-1', type: 'text', title: 'Morning mobility flow', text: 'Cat-camel x10', time: '07:30', durationSec: 600 },
    { id: 'seed-3', type: 'link', title: 'Hip mobility follow-along', url: 'https://youtu.be/dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ', appKind: 'youtube', time: '12:00', durationSec: 900 },
  ]),
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
// reducedMotion explicit: headless defaults can report `reduce`, which makes
// the splash (correctly) skip itself — proofs need the animated path.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
await ctx.addInitScript(({ seed }) => {
  try { localStorage.setItem('ppw.theme', 'dark'); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {}
}, { seed: SEED });
const page = await ctx.newPage();

// 0 — Glass-logo shimmer splash (2026-06-12 revamp): catch it mid-display.
await page.goto(BASE + '/welcome', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, 'PROOF-splash-glass-logo.png') });

// 1 — Add-Stack expand morph (open state).
await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('button[title="Add a custom stack"]');
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, 'PROOF-ref04-addstack-expanded.png') });
await page.keyboard.press('Escape');
await page.click('button[aria-label="Close"]').catch(() => {});
await page.waitForTimeout(400);

// 2 — Deck select-to-front: expand the YouTube stack row.
await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const toggles = page.locator('button[aria-label="Toggle details"]');
await toggles.nth(1).click();
await page.waitForTimeout(700);
await page.screenshot({ path: join(OUT, 'PROOF-ref07-deck-select-front.png') });

// 3 — Theme toggle knob states.
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: join(OUT, 'PROOF-ref09-toggle-dark.png') });
await page.click('.glass-switch.lg');
await page.waitForTimeout(700);
await page.screenshot({ path: join(OUT, 'PROOF-ref09-toggle-light.png') });

await browser.close();
console.log('proofs ->', OUT);
