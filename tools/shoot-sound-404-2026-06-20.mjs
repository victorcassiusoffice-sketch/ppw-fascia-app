// Proof: (1) the global liquid-drop press-sound fires on a real pointer press on
// the LIVE build (an AudioContext is created + a source started), (2) identify
// the 404 resource. Usage: node tools/shoot-sound-404-2026-06-20.mjs
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const BASE = 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const p = await ctx.newPage();
const failed = [];
p.on('requestfailed', (r) => failed.push(r.url()));
p.on('response', (r) => { if (r.status() === 404) failed.push('404 ' + r.url()); });

// Instrument AudioContext BEFORE app code runs.
await p.addInitScript(() => {
  window.__audio = { contexts: 0, started: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Orig = AC;
    const Wrapped = function (...a) { window.__audio.contexts++; const c = new Orig(...a);
      const oc = c.createOscillator.bind(c);
      c.createOscillator = () => { const o = oc(); const st = o.start.bind(o); o.start = (...x) => { window.__audio.started++; return st(...x); }; return o; };
      return c; };
    Wrapped.prototype = Orig.prototype;
    window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
  }
});
await p.goto(`${BASE}/today?cb=${Date.now()}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
// Real press on the bottom-nav Today bead (sound is gesture-gated on pointerdown).
const tgt = await p.$('nav button');
const box = tgt ? await tgt.boundingBox() : null;
if (box) { await p.mouse.move(box.x + box.width/2, box.y + box.height/2); await p.mouse.down(); await p.waitForTimeout(120); await p.mouse.up(); }
await p.waitForTimeout(300);
const audio = await p.evaluate(() => window.__audio);
console.log('AUDIO after press:', JSON.stringify(audio), audio.contexts > 0 && audio.started > 0 ? '→ liquid-drop FIRED ✓' : '→ no sound ✗');
console.log('FAILED/404 resources:', failed.length ? failed : 'none');
await browser.close();
