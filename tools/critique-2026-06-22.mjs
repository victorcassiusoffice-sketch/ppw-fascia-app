// GATE-V full critique capture (2026-06-22). Every app screen × {mobile 390,
// desktop 1440}, full-page, dark + light(mobile). Probes: console errors,
// horizontal overflow, low-res images, interactive-element density.
// Usage: node tools/critique-2026-06-22.mjs <baseURL> <tag>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';
const TAG = process.argv[3] || 'local';
const OUT = `C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/critique-2026-06-22/${TAG}`;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

const SEED = {
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right', 'lower-back'], level: 'beginner', lifestyle: 'desk', scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 },
    { id: 's2', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
  ]),
};
const SCREENS = ['today', 'protocols', 'modules', 'coach', 'settings'];
const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

async function cap(theme, vpName) {
  const vp = VIEWPORTS[vpName];
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vpName === 'mobile' ? 2 : 1 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, { 'ppw.theme': theme, ...SEED });
  const rows = [];
  for (const screen of SCREENS) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest|sw\.js|ServiceWorker|404|the server responded/i.test(m.text())) errs.push(m.text()); });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${BASE}/${screen}`, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(1100);
    const probe = await p.evaluate(() => {
      const overflowX = document.documentElement.scrollWidth > window.innerWidth + 1;
      const imgs = [...document.images].map((i) => ({ src: (i.currentSrc || i.src || '').split('/').pop(), up: i.naturalWidth ? +(i.clientWidth * devicePixelRatio / i.naturalWidth).toFixed(2) : 0 }))
        .filter((i) => i.up > 1.3);
      const interactive = document.querySelectorAll('a[href],button,[role="button"],input,select,summary').length;
      const tiny = [...document.querySelectorAll('a[href],button,[role="button"]')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 40 || r.height < 40); }).length;
      return { overflowX, lowresImgs: imgs, interactive, tinyTargets: tiny };
    });
    await p.screenshot({ path: join(OUT, `${screen}-${theme}-${vpName}.png`), fullPage: true });
    rows.push({ screen, theme, vp: vpName, ...probe, errCount: errs.length, errs: errs.slice(0, 3) });
    await p.close();
  }
  await ctx.close();
  return rows;
}

const all = [];
all.push(...await cap('dark', 'mobile'));
all.push(...await cap('dark', 'desktop'));
all.push(...await cap('light', 'mobile'));
await browser.close();
console.log(JSON.stringify(all, null, 1));
console.log('OUT ->', OUT);
