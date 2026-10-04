// Parses every bundled protocol with the reference parser and checks ids + limits.
// Run: node reference/check-protocols.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { parseProtocolMd } from './parseProtocolMd.mjs';
const here = new URL('..', import.meta.url).pathname;
const nutrients = JSON.parse(readFileSync(here + 'data/nutrients.json', 'utf8')).nutrients;
const ingredients = JSON.parse(readFileSync(here + 'data/ingredients.json', 'utf8')).ingredients;
const known = new Set([...nutrients.map((n) => n.id), ...ingredients.map((i) => i.id)]);
const byId = Object.fromEntries(nutrients.map((n) => [n.id, n]));
const conv = { 'mg>µg': 1000, 'µg>mg': 0.001, 'g>mg': 1000, 'mg>g': 0.001 };
let bad = 0;
for (const f of readdirSync(here + 'data/protocols').filter((x) => x.endsWith('.md'))) {
  const r = parseProtocolMd(readFileSync(here + 'data/protocols/' + f, 'utf8'), { knownIds: known, trusted: true });
  if (!r.ok) { console.log('FAIL', f, r.reason); bad++; continue; }
  // worst case: every recurring item lands on the same day → sum per nutrient, cautious limits
  const day = {};
  for (const it of r.protocol.items) for (const n of it.nutrients) {
    const nut = byId[n.id]; if (!nut) continue;
    const u = n.unit.replace('mcg', 'µg'); const amt = u === nut.unit ? n.amount : n.amount * (conv[u + '>' + nut.unit] ?? NaN);
    if (it.supervised) continue;
    day[n.id] = (day[n.id] || 0) + amt;
  }
  for (const [id, amt] of Object.entries(day)) {
    const lim = byId[id].limit; if (!lim.value || !lim.warn) continue;
    const vals = [lim.value, ...Object.values(lim.byForm || {}), ...(lim.byAge || []).map((a) => a.value)];
    const lowest = Math.min(...vals);
    if (!(amt <= lowest)) { console.log('OVER LIMIT (daily sum)', f, id, amt, '>', lowest); bad++; }
  }
  console.log('ok ', f.padEnd(32), String(r.protocol.items.length).padStart(2), 'items', r.warnings.length ? '| warnings: ' + r.warnings.join('; ') : '');
}
// a few malformed inputs must fail cleanly, never throw
for (const [name, txt] of [['empty', ''], ['no block', '# Hi\nJust text'], ['bad json', '```ppw-protocol\n{"ppw":"protocol",\n```'],
  ['curly quotes + trailing comma', '```ppw-protocol\n{“ppw”:“protocol”,“v”:1,“items”:[{“title”:“Walk”,“repeat”:“daily”},]}\n```']]) {
  const r = parseProtocolMd(txt, { knownIds: known });
  console.log('edge', name.padEnd(30), r.ok ? 'ok (' + r.protocol.items.length + ' item)' : 'rejected: ' + r.reason);
}
process.exit(bad ? 1 : 0);
