// Soft v1 colourway sweep (2026-06-17, STAGED) — captures the /soft-lab review
// page across all 5 palettes (mobile), plus a Firm + Crisp-edges variant.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const BASE = 'http://localhost:' + (process.argv[2] || '4318');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-wt-soft1/screenshots/soft-v1-2026-06-17';
const SKINS = ['Slate', 'Frost', 'Cream', 'Honey', 'Sage'];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));

async function clickByText(label) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button.soft-btn')].find((x) => x.textContent.trim().startsWith(t));
    if (b) b.click();
  }, label);
  await page.waitForTimeout(350);
}

await page.goto(BASE + '/soft-lab', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

for (const skin of SKINS) {
  await clickByText(skin);
  const probe = await page.evaluate(() => {
    const html = document.documentElement;
    const cs = getComputedStyle(html);
    const accent = document.querySelector('.soft-btn.is-accent');
    return {
      theme: html.getAttribute('data-theme'),
      so4skin: html.getAttribute('data-soft-skin'),
      bg: getComputedStyle(document.body).backgroundColor || cs.getPropertyValue('--col-bg'),
      accentBtnColor: accent ? getComputedStyle(accent).color : null,
      accentBtnBg: accent ? getComputedStyle(accent).backgroundColor : null,
      root: document.getElementById('root')?.childElementCount ?? -1,
    };
  });
  await page.screenshot({ path: join(OUT, `soft-${skin.toLowerCase()}.png`) });
  console.log(`soft-${skin.toLowerCase()}`, JSON.stringify({ ...probe, errs: errs.length }));
}

// Crisp-edges + Firm variant on Cream (a11y view).
await clickByText('Cream');
await clickByText('Firm');
await clickByText('Crisp');
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'soft-cream-firm-crisp.png') });
console.log('soft-cream-firm-crisp captured', JSON.stringify({ errs: errs.length }));

writeFileSync(join(OUT, 'errs.json'), JSON.stringify(errs, null, 2));
await browser.close();
console.log('OUT ->', OUT);
