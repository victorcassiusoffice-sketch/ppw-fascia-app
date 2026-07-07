import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const BASE = 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/live-2026-06-23';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const SCREENS = [
  { id:'today', path:'/today' }, { id:'stack', path:'/protocols' },
  { id:'add', path:'/today?add=1' }, { id:'calendar', path:'/calendar' },
  { id:'settings', path:'/settings' },
];
const report = []; let total = 0;
for (const theme of ['dark','light']) {
  for (const s of SCREENS) {
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript((t) => { try {
      localStorage.setItem('ppw.theme', JSON.stringify(t));
      const d = new Date().toISOString().slice(0,10);
      localStorage.setItem('ppw.userStacks::'+d, JSON.stringify([
        {id:'s1',title:'Morning fascia reset',time:'06:30',type:'routine',durationSec:600},
        {id:'s2',title:'Box-breathing audio',time:'14:30',type:'audio',durationSec:480},
        {id:'s3',title:'Magnesium + Zinc',time:'20:00',type:'supplement'}]));
      localStorage.setItem('ppw.completedToday::'+d, JSON.stringify(['s1']));
      localStorage.setItem('ppw.recurrenceRules', JSON.stringify([{id:'r1',stack:{id:'rr',title:'Morning fascia reset',time:'06:30',type:'routine'},anchorDate:d,freq:'everyday',interval:1,createdAt:0}]));
      localStorage.setItem('ppw.activeRoutines', JSON.stringify({savedZones:['neck','lower_back','hamstrings','calves'],level:'intermediate',lifestyle:'desk',scheduledTime:'07:00'}));
    } catch{} }, theme);
    const resp = await p.goto(`${BASE}${s.path}`, { waitUntil:'networkidle' });
    await p.evaluate((t)=>document.documentElement.setAttribute('data-theme',t), theme);
    await p.waitForTimeout(1000);
    const k = await p.evaluate(()=>document.getElementById('root')?.childElementCount||0);
    const nav = await p.evaluate(()=>{const n=document.querySelector('.botnav');return n?[...n.querySelectorAll('button')].map(b=>(b.querySelector('.navlabel,.stacklabel')?.textContent||'').trim()).filter(Boolean):[];});
    await p.screenshot({ path:`${OUT}/${theme}-${s.id}.png` });
    total += errs.length;
    report.push({theme,screen:s.id,http:resp?.status(),rootKids:k,errors:errs.length,nav,errSample:errs.slice(0,2)});
    console.log(`[${theme}/${s.id}] http=${resp?.status()} rootKids=${k} errors=${errs.length} nav=${JSON.stringify(nav)}`+(errs.length?' :: '+JSON.stringify(errs.slice(0,2)):''));
    await p.close();
  }
}
writeFileSync(`${OUT}/REPORT.json`, JSON.stringify({when:'2026-06-23',base:BASE,totalErrors:total,report},null,2));
console.log('\nLIVE TOTAL CONSOLE ERRORS:', total);
await b.close();
