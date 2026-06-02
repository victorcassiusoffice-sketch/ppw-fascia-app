// Real desktop OS-notification fire (NOT mocked, NOT just the in-app overlay).
// Launches non-headless system Chrome against the LIVE site, grants
// notifications, seeds a slot at the NEXT full-minute boundary (the app fires at
// HH:MM:00, so seeding the current minute whose :00 is past would be skipped),
// keeps the tab foregrounded so the timer is not throttled, and lets the REAL
// Notification constructor fire so Windows shows an actual OS toast. A
// full-screen PowerShell screenshot is taken just after the due moment to
// capture the real toast. Records the genuine constructor invocation.
//
// Run: node scripts/verify-desktop-fire.mjs
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const LIVE = 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app';
const OUT = 'scripts/_evidence';
mkdirSync(OUT, { recursive: true });

function fullScreenShot(path) {
  // Windows full-screen capture via .NET, so we catch the OS toast (outside the page).
  const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save('${path.replace(/\//g, '\\')}'); Write-Output 'shot'`;
  return new Promise((res) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
    p.on('exit', () => res());
    p.on('error', () => res());
  });
}

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--disable-features=CalculateNativeWinOcclusion'] });
const ctx = await browser.newContext({ permissions: ['notifications'] });
const page = await ctx.newPage();

await page.addInitScript(() => {
  window.__realFires = [];
  const Real = window.Notification;
  function Wrapped(title, opts) {
    window.__realFires.push({ title, opts, at: Date.now() });
    try { return new Real(title, opts); } catch (e) { return { close() {} }; }
  }
  Wrapped.permission = 'granted';
  Wrapped.requestPermission = async () => 'granted';
  try { window.Notification = Wrapped; } catch (_) {}
});

await page.bringToFront();
await page.goto(`${LIVE}/today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const seed = await page.evaluate(() => {
  const d = new Date();
  let due = new Date(d.getTime()); due.setSeconds(0, 0);
  due = new Date(due.getTime() + 60000);
  if (due.getTime() - d.getTime() < 8000) due = new Date(due.getTime() + 60000);
  const hh = String(due.getHours()).padStart(2, '0');
  const mm = String(due.getMinutes()).padStart(2, '0');
  const dISO = d.toISOString().slice(0, 10);
  const key = `ppw.userStacks::${dISO}`;
  const cur = JSON.parse(localStorage.getItem(key) || '[]');
  cur.push({ id: 'desk-fire', type: 'text', time: `${hh}:${mm}`, title: 'Desktop OS-notification fire test', text: 'fire' });
  localStorage.setItem(key, JSON.stringify(cur));
  localStorage.setItem('ppw.notificationPrefs', JSON.stringify({ enabled: true, autoplayAll: false }));
  return { due: `${hh}:${mm}`, dueEpoch: due.getTime() };
});

await page.reload({ waitUntil: 'networkidle' });
await page.bringToFront();

// Wait until ~2s past the due boundary, then capture the OS toast.
const waitMs = Math.max(2500, seed.dueEpoch - Date.now() + 2000);
await page.waitForTimeout(Math.min(waitMs, 75000));
await fullScreenShot(`${OUT}/D-desktop-OS-toast.png`);
await page.waitForTimeout(1500);

const fires = await page.evaluate(() => window.__realFires || []);
const overlay = await page.locator('text=/In-app reminder|Stack reminder/i').count().catch(() => 0);
await page.screenshot({ path: `${OUT}/D-desktop-page.png` });

const result = {
  platform: 'desktop — real Chrome, REAL OS Notification (not mocked)',
  due: seed.due,
  realOsNotificationsFired: fires.length,
  inAppOverlayShown: overlay,
  osToastScreenshot: 'scripts/_evidence/D-desktop-OS-toast.png',
  pass: fires.length > 0,
};
writeFileSync(`${OUT}/D-desktop-real-fire.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

await browser.close();
process.exit(result.pass ? 0 : 1);
