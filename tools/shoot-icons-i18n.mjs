// Words → icons (multilingual) verification (2026-06-16). Real local Chrome.
// Proves the converted controls render on-style + carry locale-portable
// accessible names, with 0 console errors. Usage: node tools/shoot-icons-i18n.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/icons-i18n-2026-06-16';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
const SEED = {
  'ppw.theme': 'dark',
  'ppw.background': JSON.stringify({ kind: 'liquid' }),
  'ppw.useMockOverride': 'true', // read bundled mock-protocol.json so /protocols renders
};
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const errs = [];
const result = { themes: {} };

async function openAddStack(page) {
  // The toolbar "Stack" primary button (title="Add a custom stack").
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /add a custom stack/i.test(x.getAttribute('title') || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(450);
}

async function run(theme, bg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, { ...SEED, 'ppw.theme': theme, 'ppw.background': JSON.stringify({ kind: bg }) });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(`[${theme}] ` + m.text()); });
  page.on('pageerror', (e) => errs.push(`[${theme}] ` + e.message));

  // ── Add Stack → Apps icon-only selector ──
  await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await openAddStack(page);

  const apps = await page.evaluate(() => {
    const labels = ['YouTube', 'Spotify', 'Custom'];
    const byName = labels.map(name => {
      const btn = [...document.querySelectorAll('button[aria-label]')].find(b => b.getAttribute('aria-label') === name);
      return btn ? {
        name,
        hasSvg: !!btn.querySelector('svg'),
        isGlassDisc: btn.className.includes('glass-disc'),
        hasVisibleText: (btn.textContent || '').trim().length > 0,
        title: btn.getAttribute('title') || '',
      } : { name, missing: true };
    });
    // any leftover emoji glyph in the apps area?
    const appsArea = [...document.querySelectorAll('div')].find(d => /^Apps$/i.test((d.firstChild && d.firstChild.textContent) || ''));
    return { byName, mountOk: document.getElementById('root')?.childElementCount > 0 };
  });
  result.themes[theme] = { apps };
  // screenshot the modal sheet
  const sheet = await page.$('.glass-dialog');
  if (sheet) await sheet.screenshot({ path: join(OUT, `addstack-apps-${theme}.png`) });
  await page.screenshot({ path: join(OUT, `addstack-full-${theme}.png`) });

  // ── Settings → theme "Auto" chip (icon + label) ──
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const auto = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /follow the device theme/i.test(b.getAttribute('title') || ''));
    if (!btn) return { missing: true };
    return {
      hasSvg: !!btn.querySelector('svg'),
      text: (btn.textContent || '').trim(),
      hasCrosshairGlyph: (btn.textContent || '').includes('⌖'),
    };
  });
  result.themes[theme].auto = auto;
  const appearanceCard = await page.$('main .card');
  if (appearanceCard) await appearanceCard.screenshot({ path: join(OUT, `settings-theme-${theme}.png`) });

  // ── Protocol detail → iHerb cart icon button ──
  await page.goto(BASE + '/protocols', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const wentDetail = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/protocol/"]');
    if (a) { a.click(); return true; }
    return false;
  });
  let iherb = { reached: wentDetail };
  if (wentDetail) {
    await page.waitForTimeout(900);
    iherb = await page.evaluate(() => {
      const cart = [...document.querySelectorAll('a')].filter(a => /iherb/i.test(a.className) || /iHerb/i.test(a.textContent || ''));
      return {
        reached: true,
        cartButtons: cart.length,
        anyEmojiCart: cart.some(a => (a.textContent || '').includes('🛒')),
        firstHasSvg: cart[0] ? !!cart[0].querySelector('svg') : null,
        firstText: cart[0] ? (cart[0].textContent || '').trim() : null,
      };
    });
    const cartBtn = await page.$('a.btn-iherb-all, a.btn-iherb');
    if (cartBtn) await cartBtn.screenshot({ path: join(OUT, `protocol-iherb-${theme}.png`) });
    await page.screenshot({ path: join(OUT, `protocol-full-${theme}.png`), fullPage: false });
  }
  result.themes[theme].iherb = iherb;

  await ctx.close();
}

await run('dark', 'liquid');
await run('light', 'grey');
await browser.close();

result.consoleErrors = errs.length;
result.errSample = errs.slice(0, 6);
console.log(JSON.stringify(result, null, 2));
console.log('OUT ->', OUT);
