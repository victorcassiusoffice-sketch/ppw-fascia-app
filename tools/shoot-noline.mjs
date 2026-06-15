// Verify the hard diagonal sheen LINE is gone from ALL large glass surfaces
// (cards/panels/dock/hero/Settings Connect card) — 2026-06-16 Vic follow-up.
// Real local Chrome. Liquid + Forest skins, both themes. Usage: node tools/shoot-noline.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/noline-2026-06-16';
const BASE = process.env.NOLINE_BASE || 'http://localhost:4173';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

function seed(theme, bg) {
  return {
    'ppw.theme': theme,
    'ppw.background': JSON.stringify(bg),
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 },
      { id: 's2', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
    ]),
  };
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];
const report = [];

async function ctxFor(theme, bg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(theme, bg));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(`${m.text()}`); });
  p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p };
}

// A "card own background-image must contain NO linear-gradient" probe: the soft
// fill is pure radial-gradients; the old hard-stop streak was a linear-gradient.
async function probeNoLinear(p) {
  return p.evaluate(() => {
    const out = { checked: 0, withLinear: 0, sample: null };
    const sels = ['.card', '.glass', '.glass-strong', '.botnav'];
    document.querySelectorAll(sels.join(',')).forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage || '';
      out.checked++;
      if (/linear-gradient/.test(bg)) { out.withLinear++; if (!out.sample) out.sample = bg.slice(0, 90); }
    });
    return out;
  });
}

for (const [bgLabel, bg] of [['liquid', { kind: 'liquid' }], ['forest', { kind: 'skin', skinId: 'forest-mist' }]]) {
  for (const theme of ['dark', 'light']) {
    const { ctx, p } = await ctxFor(theme, bg);
    await p.goto(BASE + '/today', { waitUntil: 'networkidle' });
    await p.waitForTimeout(900);
    await p.screenshot({ path: join(OUT, `today-${bgLabel}-${theme}.png`) });
    const todayProbe = await probeNoLinear(p);

    await p.goto(BASE + '/settings', { waitUntil: 'networkidle' });
    await p.waitForTimeout(700);
    await p.screenshot({ path: join(OUT, `settings-${bgLabel}-${theme}.png`), fullPage: true });
    const setProbe = await probeNoLinear(p);

    report.push({
      combo: `${bgLabel}-${theme}`,
      today_cards: todayProbe.checked, today_withLinearBg: todayProbe.withLinear,
      settings_cards: setProbe.checked, settings_withLinearBg: setProbe.withLinear,
    });
    await ctx.close();
  }
}

await browser.close();
console.log('\n=== NO-HARD-LINE PROBE (card/glass/dock own background-image must have 0 linear-gradient) ===');
console.table(report);
console.log('console errors:', errs.length, errs.slice(0, 6));
console.log('OUT ->', OUT);
