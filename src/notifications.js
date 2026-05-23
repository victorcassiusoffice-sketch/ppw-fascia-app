// Local notifications scheduler — no backend.
// Iter 2 Phase 7 (2026-05-24) — scheduler now fires AT stack time and calls
// an `onFire` callback so the caller can render an in-app overlay with
// Open / Skip / Autoplay. Native Notification still fires for OS-level
// reminder. The Iter-1 lead-time scheduler is preserved as
// scheduleNotifications (legacy) for back-compat.

import { NOTIFICATION_LEAD_TIME_MIN, LS_KEYS } from './config.js';

let scheduledTimers = [];

export function getPermissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    const r = await Notification.requestPermission();
    try { localStorage.setItem(LS_KEYS.NOTIFICATIONS_OPTIN, r); } catch (_) {}
    return r;
  } catch (_) { return 'denied'; }
}

export function clearAllScheduled() {
  scheduledTimers.forEach(clearTimeout);
  scheduledTimers = [];
}

function timeStrToTodayDate(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// Legacy lead-time scheduler — kept for Phase 6.5's gate while Phase 7
// transitions. New callers should use scheduleStackNotifications.
export function scheduleNotifications(items, opts = {}) {
  clearAllScheduled();
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 0;

  const lead = (opts.leadMin ?? NOTIFICATION_LEAD_TIME_MIN) * 60_000;
  const now = Date.now();
  let count = 0;

  for (const item of items) {
    if (!item.time) continue;
    const t = timeStrToTodayDate(item.time).getTime() - lead;
    const delay = t - now;
    if (delay < 0) continue;

    const timer = setTimeout(() => {
      try {
        const tag = item.id || `${item.kind}-${item.time}`;
        new Notification('PPW · ' + (item.label || 'Reminder'), {
          body: `${item.time} — ${item.category}${item.duration_min ? ` · ${item.duration_min} min` : ''}`,
          tag,
          icon: `${import.meta.env.BASE_URL || '/'}assets/body_map.png`,
        });
      } catch (_) {}
    }, delay);
    scheduledTimers.push(timer);
    count++;
  }
  return count;
}

// Iter 2 Phase 7.1 / 7.2 — stack-time scheduler. Fires AT each stack's
// HH:MM today, dispatching:
//   (a) native Notification (OS reminder),
//   (b) `onFire(item)` so the caller can render an in-app overlay.
// Caller is responsible for autoplay branching at fire time (see
// TodayView's NotificationOverlay flow).
export function scheduleStackNotifications(items, opts = {}) {
  clearAllScheduled();
  const onFire = opts.onFire || (() => {});
  const now = Date.now();
  let count = 0;

  for (const item of items) {
    if (!item.time) continue;
    const t = timeStrToTodayDate(item.time).getTime();
    const delay = t - now;
    if (delay < 0) continue;

    const timer = setTimeout(() => {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const tag = item.id || `${item.kind}-${item.time}`;
          new Notification('PPW · ' + (item.label || 'Reminder'), {
            body: `${item.time} — Open / Skip / Autoplay`,
            tag,
            icon: `${import.meta.env.BASE_URL || '/'}assets/body_map.png`,
          });
        }
      } catch (_) {}
      try { onFire(item); } catch (_) {}
    }, delay);
    scheduledTimers.push(timer);
    count++;
  }
  return count;
}
