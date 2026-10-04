// Real-render proof for Phase 1 of the health build.
//
// A green vitest run proves the engine's arithmetic. It proves nothing about
// whether the Settings → Health card actually renders, whether the age gate is
// reachable, or whether the delete confirmation says what it should. jsdom has
// no layout; this is real Chromium against the real dev server.
//
// Shoots at 390 px (phone) in both themes, and walks the age gate so the
// screenshots show the states a person actually meets.
//
// Usage:
//   npx vite --port 5234 --strictPort     (in another shell)
//   node tools/shoot-health-phase1.mjs
//
// Exits non-zero on any console error, pageerror, or empty root.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '5234';
const BASE = `http://localhost:${PORT}`;
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-health/.shots/health-phase1';
mkdirSync(OUT, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

const errors = [];
const notes = [];

async function openSettings(theme) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${theme}] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${theme}] pageerror: ${e.message}`));

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Skip onboarding so Settings is reachable, exactly as a returning user sees it.
  await page.evaluate(() => {
    localStorage.setItem('ppw5.onboarded', '1');
    localStorage.setItem('ppw5.terms', '1');
    localStorage.removeItem('ppw5.health');
  });
  await page.reload({ waitUntil: 'networkidle' });

  const rootKids = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
  if (!rootKids) errors.push(`[${theme}] #root is empty`);

  // Navigate to Settings via the store, so this does not depend on nav pixels.
  await page.evaluate(() => {
    const ev = new CustomEvent('ppw-goto', { detail: 'settings' });
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(400);

  // Fall back to tapping the Settings control if the event is not wired.
  const onSettings = await page.evaluate(() => document.body.innerText.includes('Appearance') || document.body.innerText.includes('Membership'));
  if (!onSettings) {
    const btn = page.locator('[aria-label*="Settings" i], button:has-text("Settings")').first();
    if (await btn.count()) { await btn.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400); }
  }
  return { ctx, page };
}

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  notes.push(name);
}

for (const theme of ['light', 'dark']) {
  const { ctx, page } = await openSettings(theme);

  // Scroll to the Health section.
  const found = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')];
    const h = els.find((e) => e.children.length === 0 && e.textContent.trim() === 'Health');
    if (h) { h.scrollIntoView({ block: 'center' }); return true; }
    return false;
  });
  if (!found) errors.push(`[${theme}] Health section not found in Settings`);
  await page.waitForTimeout(500);
  await shoot(page, `${theme}-1-health-card-age-gate`);

  // Answer the age gate, then shoot the unlocked rows.
  const yes = page.locator('button:has-text("Yes, I am 18 or over")').first();
  if (await yes.count()) {
    await yes.click();
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')];
      const h = els.find((e) => e.children.length === 0 && e.textContent.trim() === 'Health');
      if (h) h.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(300);
    await shoot(page, `${theme}-2-health-card-unlocked`);
  } else {
    errors.push(`[${theme}] age gate button not found`);
  }

  // Delete confirmation — the wording matters, so it gets its own frame.
  const del = page.locator('button:has-text("Delete my health data")').first();
  if (await del.count()) {
    await del.click();
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')];
      const h = els.find((e) => e.children.length === 0 && e.textContent.includes('Delete your health data?'));
      if (h) h.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(300);
    await shoot(page, `${theme}-3-delete-confirm`);
  } else {
    errors.push(`[${theme}] delete row not found`);
  }

  await ctx.close();
}

await browser.close();

console.log(`\nshots -> ${OUT}`);
for (const n of notes) console.log('  ' + n + '.png');
if (errors.length) {
  console.log('\nFAILURES:');
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
console.log('\nno console errors, root populated, all frames captured');
