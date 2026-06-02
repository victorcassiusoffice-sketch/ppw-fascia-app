// P0b (2026-06-02) — Web Push client. App-side only; the off-device SENDER is
// a free Cloudflare Worker cron that is [VIC-SETUP] gated (see report). This
// module: registers/finds the SW, requests permission on a user tap, subscribes
// via PushManager with the VAPID public key, and POSTs the subscription + due
// slot times to the Worker endpoint if configured. If the endpoint is not yet
// set, the subscription is stored locally and we DO NOT claim the user will be
// reminded (no false promise).
//
// iOS caveat: Web Push works on iOS 16.4+ ONLY inside an INSTALLED PWA (Add to
// Home Screen), permission on a user tap. In a plain Safari tab it never fires.
// That's why P0a (.ics) ships first.

import { VAPID_PUBLIC_KEY, PUSH_SYNC_ENDPOINT } from './push-config.js';

const LS_SUB = 'ppw.pushSubscription';

export const INSTALL_HELP = {
  ios: 'On iPhone: open this app in Safari, tap the Share button, then "Add to Home Screen". Open it from the home-screen icon — push reminders only work from the installed app (Apple requirement).',
  android: 'On Android: tap the browser menu (⋮) → "Install app" / "Add to Home screen", then open it from the icon.',
  desktop: 'Click the install icon in the address bar to install, then enable reminders.',
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Installed PWA standalone display detection.
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

export function pushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined';
}

// Snapshot of where the user stands re: push.
export async function getPushState() {
  const state = {
    supported: pushSupported(),
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    standalone: isStandalone(),
    ios: isIOS(),
    subscribed: false,
    senderConfigured: !!PUSH_SYNC_ENDPOINT,
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      state.subscribed = !!sub;
    }
  } catch (_) {}
  return state;
}

async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  // index.html already registers the SW on load; wait for it to be ready.
  try {
    return await navigator.serviceWorker.ready;
  } catch (_) {
    return await navigator.serviceWorker.getRegistration();
  }
}

export async function initPush() {
  // No-op hook for early wiring; SW registration lives in index.html.
  return getPushState();
}

// Subscribe the user. Returns a result object describing exactly what happened
// so the UI can be honest about whether reminders will actually fire.
export async function subscribeToPush(dueTimes = []) {
  if (!pushSupported()) {
    return { ok: false, reason: 'unsupported' };
  }
  if (isIOS() && !isStandalone()) {
    return { ok: false, reason: 'ios-needs-install', help: INSTALL_HELP.ios };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'permission-' + permission };
  }

  const reg = await getRegistration();
  if (!reg) return { ok: false, reason: 'no-sw' };

  let sub;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
  } catch (e) {
    return { ok: false, reason: 'subscribe-failed', error: String(e) };
  }

  const payload = { subscription: sub.toJSON(), dueTimes, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
  try { localStorage.setItem(LS_SUB, JSON.stringify(payload)); } catch (_) {}

  if (!PUSH_SYNC_ENDPOINT) {
    // App-side is ready, but the [VIC-SETUP] Worker isn't live yet. Be honest.
    return { ok: true, reason: 'subscribed-local-only', senderConfigured: false, subscription: sub.toJSON() };
  }

  try {
    const res = await fetch(PUSH_SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: true, reason: 'subscribed-sync-failed', senderConfigured: true, status: res.status };
    return { ok: true, reason: 'subscribed', senderConfigured: true };
  } catch (e) {
    return { ok: true, reason: 'subscribed-sync-error', senderConfigured: true, error: String(e) };
  }
}

// Push the latest due times to the Worker (called when slots change), best-effort.
export async function syncDueTimes(dueTimes = []) {
  if (!PUSH_SYNC_ENDPOINT) return false;
  try {
    const reg = await getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (!sub) return false;
    const payload = { subscription: sub.toJSON(), dueTimes, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
    try { localStorage.setItem(LS_SUB, JSON.stringify(payload)); } catch (_) {}
    const res = await fetch(PUSH_SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}
