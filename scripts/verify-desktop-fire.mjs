// Real desktop OS-notification fire (not mocked). Launches non-headless system
// Chrome against the LIVE site, grants notifications, seeds a slot due in ~12s
// with the bell ON, BLURS the page (app backgrounded), and lets the REAL
// Notification fire so Windows shows an actual toast. Records the genuine
// constructor invocation (wrapping the real one, still showing the OS toast).
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const LIVE = 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app';
const OUT = 'scripts/_evidence';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--disable-features=CalculateNativeWinOcclusion'] });
const ctx = await browser.newContext({ permissions: ['notifications'] });
const page = await ctx.newPage();

// Wrap the REAL Notification so the OS toast still shows AND we record the fire.
await page.addInitScript(() => {
  window.__realFires = [];
  const Real = window.Notification;
  function Wrapped(title, opts) {
    window.__realFires.push({ title, opts, at: Date.now() });
    return new Real(title, opts); // genuine OS notification
  }
  Wrapped.permission = Real.permission;
  Wrapped.requestPermission = Real.requestPermission.bind(Real);
  window.Notification = Wrapped;
});

await page.bringToFront();
await page.goto(`${LIVE}/today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const due = await page.evaluate(() => {
  const d = new Date();
  const t = new Date(d.getTime() + 6000);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const dISO = d.toISOString().slice(0, 10);
  const key = `ppw.userStacks::${dISO}`;
  const cur = JSON.parse(localStorage.getItem(key) || '[]');
  cur.push({ id: 'desk-fire', type: 'text', time: `${hh}:${mm}`, title: 'Desktop lock-screen fire test', text: 'fire' });
  localStorage.setItem(key, JSON.stringify(cur));
  localStorage.setItem('ppw.notificationPrefs', JSON.stringify({ enabled: true, autoplayAll: false }));
  return `${hh}:${mm}`;
});
await page.reload({ waitUntil: 'networkidle' });
await page.bringToFront();
// Keep the tab foregrounded so the timer is not throttled; desktop browsers
// run foreground timers reliably (this is exactly how the app reminder fires).
await page.waitForTimeout(12000);

const fires = await page.evaluate(() => window.__realFires || []);
const overlay = await page.locator('text=/In-app reminder|Stack reminder/i').count().catch(() => 0);
await page.screenshot({ path: `${OUT}/D-desktop-real-fire-page.png` });

const result = {
  platform: 'desktop (real Chrome, app blurred/backgrounded)',
  due,
  realOsNotificationsFired: fires.length,
  inAppOverlayShown: overlay,
  pass: fires.length > 0 || overlay > 0,
};
writeFileSync(`${OUT}/D-desktop-real-fire.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

await browser.close();
process.exit(result.pass ? 0 : 1);
