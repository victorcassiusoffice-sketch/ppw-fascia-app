// Real-render proof for Phase 2: the supplements cabinet and the add/edit sheet.
//
// 710 green tests prove the arithmetic. They prove nothing about whether the
// slot cards render, whether the `avoid` list is actually visible, or whether
// the form question fits on a 390 px screen. jsdom has no layout.
//
// The theme is driven through the store's OWN keys (`ppw5.bg`), not the
// context's `colorScheme`: this app paints from `themeVars(S)` and ignores the
// OS preference, so the Phase 1 "dark" frames were light frames with a dark
// label. `bg: 'grey'` is the light theme; anything else is dark.
//
// Usage:
//   npx vite --port 5235 --strictPort     (in another shell)
//   node tools/shoot-health-phase2.mjs
//
// Exits non-zero on any console error, pageerror, empty root, or missing frame.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '5235';
const BASE = `http://localhost:${PORT}`;
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-health/.shots/health-phase2';
mkdirSync(OUT, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

const errors = [];
const notes = [];

// A cabinet that exercises every branch worth looking at:
//  • two products in one 08:00 slot (iron + calcium → a timing clash tip)
//  • a 21:00 slot, with food
//  • niacin 500 mg with no stated form → the form question, and over its 10 mg
//    supplements-only maximum
//  • St John's wort, which is `avoid` against the seeded SSRI
const HEALTH = {
  _schema: 1,
  profile: {
    wake: null, bed: null, workStart: null, workEnd: null,
    meals: { breakfast: null, lunch: null, dinner: null },
    training: false,
    sex: 'female', age: 41, weightKg: null, diet: null,
    conditions: [], conditionsOther: [],
    medicines: ['ssris_snris'], medicinesOther: [],
    allergies: [], surgery: null, labs: [], foodEstimate: null,
    ageConfirmed: true,
  },
  cabinet: [
    {
      id: 'p-fe', name: 'Gentle Iron 14 mg', servings: 1, time: '08:00', times: null,
      repeat: 'daily', withFood: false, scheduled: true, stillTaking: false, source: 'manual',
      supervised: false, supervisedFor: null,
      perServing: [{ id: 'iron', name: 'Iron', amount: 14, unit: 'mg', form: null }],
    },
    {
      id: 'p-ca', name: 'Calcium + D3', servings: 1, time: '08:00', times: null,
      repeat: 'daily', withFood: false, scheduled: true, stillTaking: false, source: 'manual',
      supervised: false, supervisedFor: null,
      perServing: [
        { id: 'calcium', name: 'Calcium', amount: 500, unit: 'mg', form: null },
        { id: 'vitamin_d', name: 'Vitamin D3', amount: 400, unit: 'IU', form: 'd3' },
      ],
    },
    {
      id: 'p-mg', name: 'Magnesium Glycinate', servings: 2, time: '21:00', times: null,
      repeat: 'daily', withFood: true, scheduled: true, stillTaking: false, source: 'manual',
      supervised: false, supervisedFor: null,
      perServing: [{ id: 'magnesium', name: 'Magnesium', amount: 100, unit: 'mg', form: null }],
    },
    {
      id: 'p-b3', name: 'Niacin 500', servings: 1, time: '08:00', times: null,
      repeat: 'daily', withFood: false, scheduled: true, stillTaking: false, source: 'manual',
      supervised: false, supervisedFor: null,
      perServing: [{ id: 'vitamin_b3', name: 'Niacin', amount: 500, unit: 'mg', form: null }],
    },
    {
      id: 'p-sjw', name: "St John's Wort 300 mg", servings: 1, time: '08:00', times: null,
      repeat: 'daily', withFood: false, scheduled: true, stillTaking: false, source: 'manual',
      supervised: false, supervisedFor: null,
      perServing: [{ id: 'st_johns_wort', name: "St John's wort", amount: 300, unit: 'mg', form: null }],
    },
  ],
  doneSupps: {}, foodLogs: {}, gut: { fermented: {}, plants: {} },
  askDoctor: [], activeProtocols: [], consents: [],
  settings: { trackMacros: false, aiIncludeHealth: false, aiIncludeSupps: false },
};

async function open(theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${theme}] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${theme}] pageerror: ${e.message}`));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([health, bg]) => {
    localStorage.setItem('ppw5.onboarded', '1');
    localStorage.setItem('ppw5.terms', '1');
    localStorage.setItem('ppw5.health', JSON.stringify(health));
    localStorage.setItem('ppw5.skin', 'glass');
    localStorage.setItem('ppw5.bg', bg);
  }, [HEALTH, theme === 'dark' ? 'slate' : 'grey']);
  await page.reload({ waitUntil: 'networkidle' });

  const kids = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
  if (!kids) errors.push(`[${theme}] #root is empty`);

  // Prove the theme actually changed, rather than trusting the label.
  const ink = await page.evaluate(() => getComputedStyle(document.querySelector('[style*="--ink"]') || document.body).getPropertyValue('--ink').trim());
  notes.push(`  (${theme}: --ink = ${ink || 'unset'})`);
  return { ctx, page, ink };
}

/**
 * Tap like a finger: HintBubble dismisses on `pointerdown`, which a bare
 * element.click() never fires — so a scripted click leaves hint bubbles
 * stranded on top of whatever it opened, and the frame lies about the layout.
 */
const tapText = async (page, match) => {
  const box = await page.evaluate((m) => {
    const b = [...document.querySelectorAll('button')].find((e) => {
      const t = e.textContent.trim();
      return m.exact ? t === m.exact : t.startsWith(m.starts);
    });
    if (!b) return null;
    // A real click needs the target ON SCREEN — a bare element.click() does not,
    // which is how a scripted tap can "succeed" against something scrolled out
    // of view and leave the next assertion looking at an unchanged page.
    b.scrollIntoView({ block: 'center' });
    return true;
  }, match);
  if (!box) return false;
  await page.waitForTimeout(250);
  const at = await page.evaluate((m) => {
    const b = [...document.querySelectorAll('button')].find((e) => {
      const t = e.textContent.trim();
      return m.exact ? t === m.exact : t.startsWith(m.starts);
    });
    if (!b) return null;
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.width === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, match);
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  return true;
};

const shoot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  notes.push(name);
};

/** Scroll the first element whose exact text matches, and report whether it exists. */
const scrollTo = (page, text) => page.evaluate((t) => {
  const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === t);
  if (el) { el.scrollIntoView({ block: 'center' }); return true; }
  return false;
}, text);

const inks = {};
for (const theme of ['light', 'dark']) {
  const { ctx, page, ink } = await open(theme);
  inks[theme] = ink;

  // Library → Supps.
  const wentToSupps = await tapText(page, { exact: 'Library' });
  if (!wentToSupps) errors.push(`[${theme}] Library nav button not found`);
  await page.waitForTimeout(500);
  const tapped = await tapText(page, { exact: 'Supps' });
  if (!tapped) errors.push(`[${theme}] Supps tab not found`);
  // The data files load on this screen — wait for the numbers, not a timer.
  await page.waitForFunction(() => document.body.innerText.includes('Morning supplements'), { timeout: 8000 })
    .catch(() => errors.push(`[${theme}] cabinet never rendered a slot (data load failed?)`));
  await page.waitForTimeout(400);
  await shoot(page, `${theme}-1-cabinet-slots`);

  // The avoid list has to be visible, not just present in the DOM.
  const sawAvoid = await scrollTo(page, 'Not scheduled');
  if (!sawAvoid) errors.push(`[${theme}] "Not scheduled" heading missing — the avoid list is not rendering`);
  await page.waitForTimeout(300);
  await shoot(page, `${theme}-2-not-scheduled-avoid`);

  // Open one slot to show the per-product ticks and the timing tip.
  const opened = await tapText(page, { starts: '08:00 · Morning supplements' });
  if (!opened) errors.push(`[${theme}] could not expand the morning slot`);
  await page.waitForTimeout(450);
  const expanded = await page.evaluate(() => document.body.innerText.includes('Niacin 500'));
  if (!expanded) errors.push(`[${theme}] the morning slot did not expand — its products are not listed`);
  // 500 mg niacin against a 10 mg maximum must be visible HERE, not only once
  // the person opens the edit sheet.
  const saysOver = await page.evaluate(() => document.body.innerText.includes('Over a safe maximum')
    && /Niacin.*500 mg a day against a 10 mg maximum/s.test(document.body.innerText));
  if (!saysOver) errors.push(`[${theme}] the cabinet does not say the niacin is over its maximum`);
  await shoot(page, `${theme}-3-slot-expanded`);

  // The edit sheet, on the niacin product — the one with a form question and an
  // over-maximum amount.
  const edited = await tapText(page, { starts: 'Niacin 500' });
  if (!edited) errors.push(`[${theme}] no edit control for the niacin product`);
  await page.waitForTimeout(600);
  const stranded = await page.evaluate(() => document.body.innerText.includes('A shopping list, not a commitment'));
  if (stranded) errors.push(`[${theme}] a hint bubble is stranded on top of the edit sheet`);
  await shoot(page, `${theme}-4-edit-sheet-top`);

  const sawQuestion = await page.evaluate(() => document.body.innerText.includes('Which does the label say?'));
  if (!sawQuestion) errors.push(`[${theme}] the form question did not render for unstated-form niacin`);
  const sawOver = await page.evaluate(() => /over the .* maximum/i.test(document.body.innerText));
  if (!sawOver) errors.push(`[${theme}] no over-maximum warning on 500 mg niacin`);
  await scrollTo(page, 'Which does the label say?');
  await page.waitForTimeout(300);
  await shoot(page, `${theme}-5-form-question-and-over-max`);

  // And the doctor-prescribed question, which is the other place it refuses to
  // guess. Calcium + D3 holds two limited nutrients.
  await tapText(page, { exact: 'Cancel' });
  await page.waitForTimeout(400);
  const editedCa = await tapText(page, { starts: 'Calcium + D3' });
  if (!editedCa) errors.push(`[${theme}] no edit control for the calcium product`);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) => e.getAttribute('aria-label') === 'Doctor prescribed');
    if (b) b.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(250);
  const flipped = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) => e.getAttribute('aria-label') === 'Doctor prescribed');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }).then(async (box) => { if (!box) return false; await page.mouse.click(box.x, box.y); return true; });
  if (!flipped) errors.push(`[${theme}] doctor-prescribed switch not found`);
  await page.waitForTimeout(400);
  const asksWhich = await page.evaluate(() => document.body.innerText.includes('Which one did your doctor prescribe?'));
  if (!asksWhich) errors.push(`[${theme}] two limited nutrients but no "which one" question`);
  await scrollTo(page, 'Which one did your doctor prescribe?');
  await page.waitForTimeout(300);
  await shoot(page, `${theme}-6-which-one-did-your-doctor-prescribe`);

  // Back to the Stack: the derived slot card must be there, named without any
  // health detail (§5.9).
  await tapText(page, { exact: 'Cancel' });
  await page.waitForTimeout(300);
  const wentHome = (await tapText(page, { exact: 'Stack' })) || (await tapText(page, { exact: 'Today' }));
  if (!wentHome) errors.push(`[${theme}] Stack nav button not found`);
  await page.waitForTimeout(600);
  const stackText = await page.evaluate(() => document.body.innerText);
  if (!/supplements/i.test(stackText)) errors.push(`[${theme}] no supplement slot on the Stack`);
  for (const leak of ['Niacin', 'Magnesium', "St John", 'Calcium', 'Iron']) {
    if (stackText.includes(leak)) errors.push(`[${theme}] §5.9: "${leak}" is on the Stack card — slot titles must carry no health detail`);
  }
  await shoot(page, `${theme}-7-stack-with-supplement-slot`);

  await ctx.close();
}

if (inks.light && inks.dark && inks.light === inks.dark) {
  errors.push(`both themes rendered the same --ink (${inks.light}) — the dark frame is not actually dark`);
}

await browser.close();

console.log(`\nshots -> ${OUT}`);
for (const n of notes) console.log(n.startsWith('  ') ? n : '  ' + n + '.png');
if (errors.length) {
  console.log('\nFAILURES:');
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
console.log('\nno console errors, root populated, all frames captured, both themes distinct');
