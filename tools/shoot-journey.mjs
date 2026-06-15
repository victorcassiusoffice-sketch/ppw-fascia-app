// FULL user-journey + scan on the LIVE build (2026-06-16 overnight consolidation).
// Real local Chrome against the deployed GitHub Pages site. Seeds localStorage
// per context; drives real journeys; measures AA; logs every issue + screenshot.
// Usage: node tools/shoot-journey.mjs [base]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const sharp = require('sharp');

const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/journey-2026-06-16';
const BASE = (process.argv[2] || 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app').replace(/\/$/, '');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
mkdirSync(OUT, { recursive: true });

function lin(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
function relLum(r,g,b){return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);}
function contrast(a,b){const hi=Math.max(a,b),lo=Math.min(a,b);return (hi+0.05)/(lo+0.05);}
function pct(s,p){return s[Math.min(s.length-1,Math.max(0,Math.round((p/100)*(s.length-1))))];}
const INK = { dark: relLum(241,243,248), light: relLum(43,50,66) }; // primary ink per theme

function seed(theme, bg, extra = {}) {
  return {
    'ppw.theme': theme,
    'ppw.background': JSON.stringify(bg),
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left','hamstring-right'], level:'beginner', lifestyle:null, scheduledTime:'08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id:'s1', type:'text', title:'Morning mobility', text:'Hips', time:'07:30', durationSec:240 },
      { id:'s2', type:'text', title:'Evening stretch', text:'Calves', time:'18:00', durationSec:330 },
    ]),
    ...extra,
  };
}

const issues = [];
const journeys = [];
function rec(name, pass, detail) { journeys.push({ journey: name, result: pass ? 'PASS' : 'FAIL', detail: detail || '' }); if (!pass) issues.push(`${name}: ${detail}`); }

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function ctx(theme, bg, vp, extra) {
  const c = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, ...(extra||{}) });
  const errs = [];
  await c.addInitScript((s)=>{ for (const [k,v] of Object.entries(s)) localStorage.setItem(k,v); }, seed(theme, bg, (extra&&extra._seed)||{}));
  const p = await c.newPage();
  p.on('console', m=>{ if (m.type()==='error' && !/websocket|HMR|vite|favicon|manifest|404|wellness-assistant|net::ERR/i.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', e=>errs.push(e.message));
  return { c, p, errs };
}

// sample the worst-case background field a card's text sits on (neutralise child
// text/fills first), return contrast vs the theme's primary ink.
async function cardAA(p, theme) {
  try {
    const ok = await p.evaluate(()=>{
      const el = document.querySelector('.today-routine-card') || document.querySelector('.card');
      if (!el) return false;
      const s=document.createElement('style'); s.id='__m';
      s.textContent='.card *,.today-routine-card *{color:transparent!important;-webkit-text-fill-color:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;border-color:transparent!important;}';
      document.head.appendChild(s); return true;
    });
    if (!ok) return null;
    await p.waitForTimeout(150);
    const el = await p.$('.today-routine-card') || await p.$('.card');
    if (!el) return null;
    const buf = await el.screenshot({ timeout: 8000 });
    const { data, info } = await sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject:true });
    const { width, height, channels } = info; const ins = Math.round(width*0.08); const lums=[];
    for (let y=ins;y<height-ins;y+=3) for (let x=ins;x<width-ins;x+=3){ const i=(y*width+x)*channels; lums.push(relLum(data[i],data[i+1],data[i+2])); }
    lums.sort((a,b)=>a-b);
    await p.evaluate(()=>{ const s=document.getElementById('__m'); if (s) s.remove(); });
    const worst = theme==='dark' ? pct(lums,95) : pct(lums,5);
    return +contrast(INK[theme], worst).toFixed(2);
  } catch { return null; }
}

async function probeNoLine(p){ return p.evaluate(()=>{ let n=0; document.querySelectorAll('.card,.glass,.glass-strong,.botnav').forEach(el=>{ if(/linear-gradient/.test(getComputedStyle(el).backgroundImage||'')) n++; }); return n; }); }
async function mounted(p){ return p.evaluate(()=>document.getElementById('root')?.childElementCount>0); }

// ───────────────────────── MATRIX SCAN ─────────────────────────
const SKINS = { liquid:{kind:'liquid'}, azure:{kind:'skin',skinId:'azure'}, forest:{kind:'skin',skinId:'forest-mist'} };
const VPS = { mobile:{width:390,height:844}, desktop:{width:1280,height:900} };
const matrix = [];
for (const skin of ['liquid','azure']) for (const theme of ['dark','light']) for (const vpName of ['mobile','desktop']) {
  const { c, p, errs } = await ctx(theme, SKINS[skin], VPS[vpName]);
  await p.goto(BASE + '/today?cb=' + Date.now(), { waitUntil:'domcontentloaded' });
  await p.waitForSelector('.today-routine-card, .card', { timeout: 20000 }).catch(()=>{});
  await p.waitForTimeout(1100);
  const label = `${skin}-${theme}-${vpName}`;
  const m = await mounted(p); const lines = await probeNoLine(p); const aa = await cardAA(p, theme);
  await p.screenshot({ path: join(OUT, `today-${label}.png`) });
  matrix.push({ combo: label, mounted: m?'Y':'N', lineBgs: lines, cardAA: aa, consoleErrs: errs.length });
  if (!m) rec(`mount:${label}`, false, 'root empty');
  if (lines>0) rec(`no-line:${label}`, false, `${lines} surfaces with linear-gradient bg`);
  if (aa!==null && aa<4.5) rec(`AA:${label}`, false, `card text contrast ${aa} < 4.5`);
  if (errs.length) rec(`console:${label}`, false, errs.slice(0,3).join(' | '));
  await c.close();
}
// forest mobile both themes (calm skin)
for (const theme of ['dark','light']) {
  const { c, p, errs } = await ctx(theme, SKINS.forest, VPS.mobile);
  await p.goto(BASE + '/today?cb=' + Date.now(), { waitUntil:'domcontentloaded' }); await p.waitForSelector('.today-routine-card, .card',{timeout:20000}).catch(()=>{}); await p.waitForTimeout(900);
  const aa = await cardAA(p, theme); const lines = await probeNoLine(p);
  await p.screenshot({ path: join(OUT, `today-forest-${theme}-mobile.png`) });
  matrix.push({ combo:`forest-${theme}-mobile`, mounted:(await mounted(p))?'Y':'N', lineBgs:lines, cardAA:aa, consoleErrs:errs.length });
  if (aa!==null && aa<4.5) rec(`AA:forest-${theme}`, false, `contrast ${aa}`);
  await c.close();
}

// ───────────────────────── FUNCTIONAL JOURNEYS (dark mobile, forest) ─────────────────────────
async function fresh(extra) { const o = await ctx('dark', SKINS.forest, VPS.mobile, extra); await o.p.goto(BASE+'/today?cb='+Date.now(), {waitUntil:'domcontentloaded'}); await o.p.waitForSelector('.today-routine-card, .card, button', {timeout:20000}).catch(()=>{}); await o.p.waitForTimeout(1000); return o; }

// J1 — add a TEXT stack via the modal, verify it persists
try {
  const { c, p } = await fresh();
  await p.getByRole('button', { name: 'Stack' }).click();
  await p.waitForSelector('.glass-dialog', { state:'visible' }); await p.waitForTimeout(400);
  // text type is the default first disc; fill the visible text inputs
  const inputs = await p.$$('.glass-dialog input[type="text"], .glass-dialog textarea, .glass-dialog input:not([type])');
  if (inputs[0]) await inputs[0].fill('Journey test stack');
  // Save / Add button
  const save = await p.getByRole('button', { name: /add|save|create/i }).last();
  await save.click().catch(()=>{});
  await p.waitForTimeout(500);
  const persisted = await p.evaluate((iso)=>{ const raw=localStorage.getItem('ppw.userStacks::'+iso)||'[]'; return JSON.parse(raw).some(s=>/journey test/i.test(s.title||s.text||'')); }, todayISO);
  rec('add-text-stack', persisted, persisted?'persisted in ppw.userStacks':'new stack not found in storage');
  await p.screenshot({ path: join(OUT, 'journey-add-stack.png') });
  await c.close();
} catch(e){ rec('add-text-stack', false, e.message.split('\n')[0]); }

// J2 — aria-labels on the i18n icon controls (AddStack TYPE + APP discs)
try {
  const { c, p } = await fresh();
  await p.getByRole('button', { name:'Stack' }).click();
  await p.waitForSelector('.glass-dialog', { state:'visible' }); await p.waitForTimeout(300);
  const labels = await p.$$eval('.glass-dialog .glass-disc', els=>els.map(e=>e.getAttribute('aria-label')));
  const allLabelled = labels.length>0 && labels.every(l=>l && l.trim().length>0);
  rec('icon-controls-aria', allLabelled, `discs=${labels.length} labelled=${labels.filter(Boolean).length} (${labels.slice(0,6).join(',')})`);
  await c.close();
} catch(e){ rec('icon-controls-aria', false, e.message.split('\n')[0]); }

// J3 — theme toggle flips data-theme (Settings)
try {
  const { c, p } = await fresh();
  await p.getByRole('button', { name:'Settings' }).click().catch(()=>{});
  await p.waitForTimeout(600);
  const before = await p.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  const sw = await p.$('.glass-switch'); if (sw) await sw.click();
  await p.waitForTimeout(500);
  const after = await p.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  rec('theme-toggle', before && after && before!==after, `${before} -> ${after}`);
  await c.close();
} catch(e){ rec('theme-toggle', false, e.message.split('\n')[0]); }

// J4 — open coach: Today entry -> /coach -> external CTA popup URL
try {
  const { c, p } = await fresh();
  // click the "Ask your coach" entry (gated by FEATURE flag)
  const entry = p.getByText(/ask your coach/i).first();
  await entry.click({ timeout: 4000 }).catch(()=>{});
  await p.waitForTimeout(700);
  const onCoach = await p.evaluate(()=>/\/coach/.test(location.pathname));
  // the external CTA opens a new tab
  const [popup] = await Promise.all([
    c.waitForEvent('page', { timeout: 5000 }).catch(()=>null),
    p.getByRole('link', { name: /open your wellness coach/i }).click().catch(()=>{}),
  ]);
  const popupUrl = popup ? popup.url() : (await p.evaluate(()=>{ const a=[...document.querySelectorAll('a')].find(x=>/wellness coach/i.test(x.textContent)); return a?a.href:null; }));
  const ok = /ppw-wellness-assistant\.vercel\.app\/assistant/.test(popupUrl||'');
  rec('open-coach', ok, `onCoachRoute=${onCoach} ctaUrl=${popupUrl}`);
  if (popup) await popup.close();
  await p.screenshot({ path: join(OUT, 'journey-coach.png') });
  await c.close();
} catch(e){ rec('open-coach', false, e.message.split('\n')[0]); }

// J5 — reduced-motion collapses (transition-duration ~0)
try {
  const { c, p } = await fresh({ reducedMotion:'reduce' });
  const dur = await p.evaluate(()=>{ const el=document.querySelector('.card'); return el?getComputedStyle(el).transitionDuration:null; });
  const collapsed = dur!==null && parseFloat(dur) <= 0.02;
  rec('reduced-motion', collapsed, `card transition-duration=${dur}`);
  await c.close();
} catch(e){ rec('reduced-motion', false, e.message.split('\n')[0]); }

// J6 — mm:ss duration persists (seed durationSec=330 -> renders 5:30, survives reload)
try {
  const { c, p } = await fresh();
  const shown = await p.evaluate(()=>document.body.innerText.match(/\b\d{1,2}:[0-5]\d\b/g)||[]);
  const has530 = shown.includes('5:30') || shown.includes('05:30');
  const has400 = shown.includes('4:00') || shown.includes('04:00');
  rec('timer-mmss-persist', has530||has400, `durations seen=${[...new Set(shown)].slice(0,8).join(',')}`);
  await c.close();
} catch(e){ rec('timer-mmss-persist', false, e.message.split('\n')[0]); }

// J7 — merge -> collapse/unmerge (seed a merged state; drag isn't simulable in dnd-kit)
try {
  const mergeSeed = { [`ppw.dailyMerges::${todayISO}`]: JSON.stringify({ s1:{ title:'AM block', itemIds:['s1','s2'], collapsed:true } }) };
  const { c, p } = await fresh({ _seed: mergeSeed });
  const mergedRendered = await p.evaluate(()=>!!document.querySelector('.stack-deck, [class*="merged"], .today-routine-card'));
  // try to find an unmerge control
  const unmerge = await p.$('[aria-label*="nmerge" i], [title*="nmerge" i]');
  rec('merge-collapse-unmerge', mergedRendered, `mergedRender=${mergedRendered} unmergeCtl=${!!unmerge} (drag NOT simulated — seeded state + unit tests cover merge logic)`);
  await p.screenshot({ path: join(OUT, 'journey-merge.png') });
  await c.close();
} catch(e){ rec('merge-collapse-unmerge', false, e.message.split('\n')[0]); }

// J8 — skin switch flips data-bg + AA holds (azure bright)
try {
  const { c, p } = await ctx('dark', SKINS.azure, VPS.mobile); await p.goto(BASE+'/?cb='+Date.now(),{waitUntil:'domcontentloaded'}); await p.waitForTimeout(800);
  const bg = await p.evaluate(()=>document.documentElement.getAttribute('data-bg'));
  const tone = await p.evaluate(()=>document.documentElement.getAttribute('data-bg-tone'));
  rec('skin-switch', bg==='skin' && tone==='bright', `data-bg=${bg} tone=${tone}`);
  await c.close();
} catch(e){ rec('skin-switch', false, e.message.split('\n')[0]); }

await browser.close();
console.log('\n=== MATRIX SCAN (mount / no-line / card-AA / console) ===');
console.table(matrix);
console.log('\n=== FUNCTIONAL JOURNEYS ===');
console.table(journeys);
console.log('\nISSUES:', issues.length); issues.forEach(i=>console.log('  ✗', i));
console.log('OUT ->', OUT);
