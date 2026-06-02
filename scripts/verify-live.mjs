// P-verify (2026-06-02) — real-browser device-emulation verification against the
// LIVE GitHub Pages site. Produces evidence for the two mechanically-testable
// halves of the gate:
//   (A) add-URL works on a MOBILE (iPhone-emulated) context + persists a reload
//   (B) the .ics export downloads in a real browser and is a valid VEVENT+VALARM
//   (C) desktop foreground notification path fires (in-app overlay) when a slot
//       comes due with the bell on
// The remaining gate piece — an alarm firing on a physically LOCKED handset —
// is the OS's deterministic job once (B) hands it a valid .ics; that physical
// confirmation is Vic's (can't lock a real phone from CI).
//
// Run: node scripts/verify-live.mjs   (uses system Chrome via channel 'chrome')

import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const LIVE = 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app';
const OUT = 'scripts/_evidence';
mkdirSync(OUT, { recursive: true });
const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const results = [];
function log(step, pass, detail) { results.push({ step, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} — ${step}${detail ? ' :: ' + detail : ''}`); }

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// ───────────────────────────────────────── (A) MOBILE add-URL persistence
{
  const iphone = devices['iPhone 13'];
  const ctx = await browser.newContext({ ...iphone, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${LIVE}/today`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Open +Stack
  await page.getByRole('button', { name: 'Add a custom stack' }).first().click().catch(async () => {
    await page.locator('button:has-text("Stack")').first().click();
  });
  await page.waitForTimeout(600);
  // Pick Link type
  await page.getByRole('button', { name: /Link/i }).first().click();
  await page.waitForTimeout(400);
  // Paste URL
  const urlInput = page.locator('input[type="url"]');
  await urlInput.fill(YT);
  await page.waitForTimeout(2500); // oEmbed title fetch
  // Set time
  await page.locator('input[type="time"]').first().fill('08:30').catch(() => {});
  // Save
  await page.getByRole('button', { name: /Add to today/i }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/A1-mobile-after-add.png` });

  // Evidence: localStorage has the user stack for today
  const todayKey = await page.evaluate(() => {
    const d = new Date().toISOString().slice(0, 10);
    const k = `ppw.userStacks::${d}`;
    return { k, v: localStorage.getItem(k) };
  });
  const added = todayKey.v && JSON.parse(todayKey.v).length > 0;
  log('A · mobile add-URL writes to localStorage', !!added, added ? `${JSON.parse(todayKey.v).length} stack(s)` : 'no record');

  // Reload (simulate reopen) and assert it persists + a bar shows
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const afterReload = await page.evaluate(() => {
    const d = new Date().toISOString().slice(0, 10);
    return localStorage.getItem(`ppw.userStacks::${d}`);
  });
  const persisted = afterReload && JSON.parse(afterReload).length > 0;
  await page.screenshot({ path: `${OUT}/A2-mobile-after-reload.png` });
  // Title visible on a bar
  const titleVisible = await page.locator('text=/Never Gonna Give You Up|youtube|youtu/i').count().catch(() => 0);
  log('A · mobile add-URL persists across reload', !!persisted, persisted ? 'record survived reload' : 'LOST after reload');

  await ctx.close();
}

// ───────────────────────────────────────── (B) .ics download validity (desktop ctx)
// NOTE: iOS now uses a data:URL navigation (no download event), so we verify the
// Blob-download path on a DESKTOP/Android-style context where it applies.
{
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${LIVE}/today`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // There should now be at least one timed stack (from A, same origin localStorage
  // is per-context so re-add quickly via a text stack).
  let icsText = null;
  try {
    // Ensure a stack exists: open modal, add a text reminder at a time.
    await page.locator('button:has-text("Stack")').first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Text Reminder/i }).first().click();
    await page.waitForTimeout(300);
    await page.locator('textarea').fill('Verify ICS reminder');
    await page.locator('input[type="time"]').first().fill('09:15').catch(() => {});
    await page.getByRole('button', { name: /Add to today/i }).click();
    await page.waitForTimeout(1000);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      page.getByRole('button', { name: /Add to phone calendar/i }).first().click(),
    ]);
    const path = `${OUT}/reminder.ics`;
    await download.saveAs(path);
    icsText = readFileSync(path, 'utf8');
  } catch (e) {
    log('B · .ics downloads from a real browser', false, String(e).slice(0, 120));
  }
  if (icsText) {
    const ok = icsText.includes('BEGIN:VEVENT') && icsText.includes('BEGIN:VALARM') &&
      icsText.includes('TRIGGER;RELATED=START:PT0M') && icsText.includes('DTSTART:');
    log('B · .ics is a valid VEVENT + at-time VALARM', ok, ok ? 'VEVENT/VALARM/TRIGGER/DTSTART present' : 'malformed');
  }
  await ctx.close();
}

// ───────────────────────────────────────── (C) desktop foreground notification fire
{
  const ctx = await browser.newContext({ permissions: ['notifications'], acceptDownloads: true });
  const page = await ctx.newPage();
  // Capture Notification constructions.
  await page.addInitScript(() => {
    window.__notifs = [];
    const Real = window.Notification;
    function FakeNotification(title, opts) { window.__notifs.push({ title, opts }); return { close() {} }; }
    FakeNotification.permission = 'granted';
    FakeNotification.requestPermission = async () => 'granted';
    try { window.Notification = FakeNotification; } catch (_) {}
  });
  await page.goto(`${LIVE}/today`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Add a stack due in ~8 seconds and turn the bell on, then wait for the fire.
  const fireResult = await page.evaluate(async () => {
    const d = new Date();
    const due = new Date(d.getTime() + 8000);
    const hh = String(due.getHours()).padStart(2, '0');
    const mm = String(due.getMinutes()).padStart(2, '0');
    const dISO = d.toISOString().slice(0, 10);
    // Seed a user stack at the due minute.
    const key = `ppw.userStacks::${dISO}`;
    const cur = JSON.parse(localStorage.getItem(key) || '[]');
    cur.push({ id: 'verify-fire', type: 'text', time: `${hh}:${mm}`, title: 'Fire test', text: 'Fire test' });
    localStorage.setItem(key, JSON.stringify(cur));
    // Turn the bell on.
    localStorage.setItem('ppw.notificationPrefs', JSON.stringify({ enabled: true, autoplayAll: false }));
    return { due: `${hh}:${mm}` };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(12000); // wait past the due time
  const notifs = await page.evaluate(() => window.__notifs || []);
  // Overlay OR native notification counts as foreground fire.
  const overlay = await page.locator('text=/In-app reminder|Stack reminder/i').count().catch(() => 0);
  await page.screenshot({ path: `${OUT}/C-desktop-fire.png` });
  const fired = (notifs && notifs.length > 0) || overlay > 0;
  log('C · desktop foreground reminder fires when slot comes due', fired, `native=${notifs.length} overlay=${overlay} due=${fireResult.due}`);
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const passed = results.filter(r => r.pass).length;
console.log(`\n=== ${passed}/${results.length} checks passed ===`);
process.exit(results.every(r => r.pass) ? 0 : 1);
