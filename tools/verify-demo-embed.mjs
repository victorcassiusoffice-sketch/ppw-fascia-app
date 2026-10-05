// verify-demo-embed — proves the ppwellness.co embed in a REAL browser.
//
// WHY A SCRIPT AND NOT JUST THE VITEST FILE. src/app5/demo-embed.test.jsx proves
// the behaviour in jsdom, which has no iframes, no second origin and no painting.
// The thing being handed to a web builder is an HTML SNIPPET, and the questions
// that only a browser can answer are: does the app mount inside a cross-origin
// iframe at all, does it come up as the demo rather than the code door, and does
// it leave the visitor's storage alone. This answers those three.
//
// It is also the render gate (skills/render_verification_gate.md): a clean build
// is not proof that anything renders. `#root` must have children and the console
// must be silent.
//
// HOW IT IS CROSS-ORIGIN. Two local servers on two ports — two origins, the same
// relationship ppwellness.co has with app.ppwellness.co. Port A serves a page
// carrying the exact snippet from the handover; port B serves `dist/`. The parent
// cannot read into the frame, so the assertions are made through Playwright's
// own frame handle, which is how a browser-side check has to be written.
//
// Playwright is borrowed from the Designer repo by createRequire, the convention
// every tools/shoot-*.mjs in this repo already uses — this repo has no browser
// dependency of its own and does not gain one here.
//
// Usage:  npx vite build  &&  node tools/verify-demo-embed.mjs
// Exit 0 = every check passed. Exit 1 = a named check failed.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const DIST = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
// Shots of the framed demo, for a human to eyeball the proportions a numeric
// check cannot judge (skills/design-visual-critique-gate.md).
const SHOTS = new URL('../docs/demo-embed-2026-10-05/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORT_SITE = 8731;   // stands in for ppwellness.co
const PORT_APP = 8732;    // stands in for app.ppwellness.co
const APP = `http://127.0.0.1:${PORT_APP}`;
const SITE = `http://localhost:${PORT_SITE}`;   // a DIFFERENT origin from APP

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.webm': 'video/webm',
};

/** THE SNIPPET UNDER TEST — keep identical to the one in the handover. */
const SNIPPET = (src) => `<iframe
  src="${src}"
  title="PPWellness Lifestyle App - interactive demo"
  loading="lazy"
  width="430" height="932"
  allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
  referrerpolicy="no-referrer-when-downgrade"
  style="display:block;margin:0 auto;width:100%;max-width:430px;aspect-ratio:430/932;height:auto;border:0;border-radius:40px"
></iframe>`;

const parentPage = (src) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Try the app</title></head>
<body style="margin:0;padding:40px 16px;font-family:system-ui;background:#F5EBD7">
<h1 style="text-align:center;font-size:20px">Try the Lifestyle App</h1>
${SNIPPET(src)}
<p style="text-align:center"><a href="${src}" target="_blank" rel="noopener">Open it in a new tab</a></p>
</body></html>`;

function serveDist() {
  return createServer(async (req, res) => {
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = normalize(path === '/' ? 'index.html' : path.replace(/^\/+/, ''));
    try {
      const body = await readFile(join(DIST, rel));
      res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      // SPA fallback, the way GitHub Pages serves 404.html.
      try {
        const body = await readFile(join(DIST, 'index.html'));
        res.writeHead(200, { 'Content-Type': TYPES['.html'] });
        res.end(body);
      } catch { res.writeHead(404); res.end('not found'); }
    }
  });
}

function serveSite() {
  return createServer((req, res) => {
    const demo = !(req.url || '').includes('nodemo');
    res.writeHead(200, { 'Content-Type': TYPES['.html'] });
    res.end(parentPage(demo ? `${APP}/?demo=1` : `${APP}/`));
  });
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const listen = (server, port) => new Promise((res, rej) => {
  server.once('error', rej); server.listen(port, res);
});

/**
 * The app's frame, once it has navigated.
 *
 * Polled rather than read once: the snippet carries `loading="lazy"`, so the
 * parent's `load` event can fire before the browser has started fetching the
 * iframe at all. Scrolled into view first, for the same reason.
 */
async function appFrame(page) {
  try { await page.evaluate(() => document.querySelector('iframe')?.scrollIntoView()); } catch {}
  for (let i = 0; i < 100; i++) {
    const f = page.frames().find((fr) => fr.url().startsWith(APP));
    if (f) return f;
    await page.waitForTimeout(100);
  }
  console.log('   frames seen:', page.frames().map((f) => f.url() || '<blank>').join(' , '));
  return null;
}

/** Wait for the app inside the frame to have actually painted. */
async function waitForMount(frame) {
  await frame.waitForFunction(() => {
    const r = document.getElementById('root');
    return !!r && r.childElementCount > 0;
  }, null, { timeout: 20000 });
}

const site = serveSite();
const app = serveDist();
let browser;
try {
  await mkdir(SHOTS, { recursive: true });
  await listen(site, PORT_SITE);
  await listen(app, PORT_APP);

  browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });

  // ── 1. the demo, framed on another origin ────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto(SITE, { waitUntil: 'load' });
    const frame = await appFrame(page);
    check('the app is framed from a different origin', !!frame, frame ? frame.url() : 'no frame found');
    if (!frame) throw new Error('the iframe never navigated');
    await waitForMount(frame);

    const seen = await frame.evaluate(() => ({
      rootKids: document.getElementById('root').childElementCount,
      // The code door asks for exactly this, by label.
      codeField: !!document.querySelector('#ppw-access-code'),
      marker: (document.querySelector('[role="note"]') || {}).textContent || null,
      markerLabel: (document.querySelector('[role="note"]') || {}).ariaLabel || null,
      // Something to look at: the starter affirmation is deck-only.
      furnished: document.body.innerText.includes('I did enough today'),
      // The wizard's consent tick-box and the first-run choice.
      wizard: /Already have an account|I agree to the Terms/i.test(document.body.innerText),
      storage: (() => { try { return Object.keys(localStorage).length; } catch { return -1; } })(),
    }));

    check('it mounts — #root has children', seen.rootKids > 0, `${seen.rootKids} children`);
    check('no access code is asked for', seen.codeField === false);
    check('the Demo marker is on the frame', seen.marker === 'Demo', String(seen.marker));
    check('the marker tells a screen reader nothing is saved',
      /nothing here is saved/i.test(seen.markerLabel || ''), String(seen.markerLabel));
    check('the day is furnished', seen.furnished === true);
    check('no wizard, no first-run choice', seen.wizard === false);
    check('the console is silent', errors.length === 0, errors.slice(0, 3).join(' | '));

    // Shot BEFORE the tap below: tapping a stack opens the media player over the
    // day, and a screenshot of that is a picture of a player, not of the embed.
    await page.waitForTimeout(1400);           // the screen-in animation is 380ms
    await page.screenshot({ path: join(SHOTS, 'embed-desktop.png'), fullPage: false });

    // Drive it the way a prospect would, then look at the device again.
    const ticked = await frame.evaluate(() => {
      const card = [...document.querySelectorAll('[data-dragidx]')][0];
      if (card) { card.click(); return true; }
      return false;
    });
    await page.waitForTimeout(700);     // the stacks write is debounced 200ms
    const after = await frame.evaluate(() => {
      try { return Object.keys(localStorage).filter((k) => k.startsWith('ppw5.')); } catch { return ['<denied>']; }
    });
    check('a prospect tapping about writes nothing to the device',
      after.length === 0, `tapped=${ticked} keys=[${after.join(', ')}]`);

    await ctx.close();
  }

  // ── 2. the same build, framed WITHOUT the parameter ───────────────────────
  // The control. If this also opened the app, the demo door would be a hole.
  {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } });
    const page = await ctx.newPage();
    await page.goto(`${SITE}/?nodemo=1`, { waitUntil: 'load' });
    const frame = await appFrame(page);
    await waitForMount(frame);
    const seen = await frame.evaluate(() => ({
      codeField: !!document.querySelector('#ppw-access-code'),
      marker: !!document.querySelector('[role="note"]'),
    }));
    check('without the parameter the code door is there', seen.codeField === true);
    check('without the parameter there is no Demo marker', seen.marker === false);
    await ctx.close();
  }

  // ── 3. phone width, because that is how ppwellness.co is read ─────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: 'load' });
    const frame = await appFrame(page);
    await waitForMount(frame);
    const box = await (await page.$('iframe')).boundingBox();
    const seen = await frame.evaluate(() => ({
      marker: (document.querySelector('[role="note"]') || {}).textContent || null,
      // Nothing may spill sideways inside the frame.
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }));
    check('the frame fits a phone-width page', box.width <= 390 && box.width > 300,
      `${Math.round(box.width)}x${Math.round(box.height)}`);
    check('the Demo marker survives phone width', seen.marker === 'Demo');
    check('nothing overflows sideways inside the frame', seen.overflowX === false);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(SHOTS, 'embed-phone.png'), fullPage: false });
    await ctx.close();
  }
} catch (e) {
  check('the run completed', false, e && e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  site.close(); app.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
