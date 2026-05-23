// Phase 3 (2026-05-23) — tag detection helpers + IF auto-arranger.
// Items don't carry an explicit `tags` array today — we infer from `category`,
// `label`, and `userStack.type`. Keep the heuristic permissive so a fresh
// protocol JSON can opt-in by naming its category accordingly.

import affiliates from '../config/affiliates.json';

const FOOD_HINTS = [
  'food', 'meal', 'breakfast', 'lunch', 'dinner', 'snack',
  'eat', 'break_fast', 'break-fast', 'eating', 'nutrition'
];

const SUPPLEMENT_HINTS = [
  'supplement', 'dose', 'pill', 'capsule', 'powder', 'tincture',
  'magnesium', 'vitamin', 'creatine', 'ashwagandha', 'omega', 'protein',
  'collagen', 'electrolyte'
];

const ACCESSORY_HINTS = [
  'glasses', 'blue-light', 'blue light', 'mat', 'roller', 'massager',
  'ball', 'strap', 'band', 'foam-roller'
];

function lowerMatch(item, hints) {
  const blob = [item.category || '', item.label || '', item.notes || '']
    .join(' ')
    .toLowerCase();
  return hints.some(h => blob.includes(h));
}

export function isFoodItem(it) {
  if (!it) return false;
  if (Array.isArray(it.tags) && it.tags.includes('food')) return true;
  return lowerMatch(it, FOOD_HINTS);
}

export function isSupplementItem(it) {
  if (!it) return false;
  if (Array.isArray(it.tags) && it.tags.includes('supplement')) return true;
  return lowerMatch(it, SUPPLEMENT_HINTS);
}

export function isAccessoryItem(it) {
  if (!it) return false;
  if (Array.isArray(it.tags) && it.tags.includes('accessory')) return true;
  return lowerMatch(it, ACCESSORY_HINTS);
}

// Iter 2 Phase 9.2 — detect user country passively from navigator.language.
// Returns a lowercase ISO country code (e.g. "mu", "us", "gb") or null.
// No geolocation prompt; no IP lookup; no auto-route — scaffold only.
export function detectCountryCode() {
  try {
    if (typeof navigator === 'undefined') return null;
    const lang = navigator.language || (navigator.languages && navigator.languages[0]);
    if (!lang) return null;
    const parts = lang.split('-');
    if (parts.length < 2) return null;
    return parts[1].toLowerCase();
  } catch (_) { return null; }
}

// Iter 2 Phase 9.2 — local log of every routing decision. Capped at 200
// entries. Surfaces in DevTools (localStorage.affiliateRouteLog) for Vic
// audit. No PII; just slug + country + chosen URL.
function logAffiliateRoute(entry) {
  try {
    const raw = localStorage.getItem('affiliateRouteLog');
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ ...entry, at: new Date().toISOString() });
    while (arr.length > 200) arr.shift();
    localStorage.setItem('affiliateRouteLog', JSON.stringify(arr));
  } catch (_) {}
}

// Resolve a single entry in the registry. Supports two shapes:
//   "magnesium-glycinate": "https://...                         (legacy string)
//   "magnesium-glycinate": { default: "...", mu: "...", us: "..." } (v2 object)
function resolveCountryUrl(entry, country) {
  if (entry == null) return null;
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object') {
    if (country && entry[country]) return entry[country];
    return entry.default || null;
  }
  return null;
}

// Match an item's label/category against affiliate keys (kebab-case slugs).
// Iter 2 Phase 9 — country-aware lookup + route logging.
export function affiliateUrlFor(it) {
  if (!it) return null;
  const blob = [(it.label || ''), (it.category || ''), (it.notes || '')]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, '-');
  const country = detectCountryCode();
  const groups = ['supplements', 'accessories'];
  for (const g of groups) {
    const entries = affiliates[g] || {};
    for (const [slug, entry] of Object.entries(entries)) {
      if (slug.startsWith('_')) continue;
      if (typeof entry !== 'string' && typeof entry !== 'object') continue;
      if (blob.includes(slug)) {
        const url = resolveCountryUrl(entry, country);
        logAffiliateRoute({ slug, group: g, country, url });
        return url;
      }
    }
  }
  return null;
}

// Phase 3.1 — IF auto-arranger. Returns a new items array where food items
// outside the eating window are moved inside, preserving relative order.
export function applyIfWindow(items, ifPrefs) {
  if (!ifPrefs || !ifPrefs.enabled) return items;
  const { windowStart, windowEnd } = ifPrefs;
  if (!windowStart || !windowEnd) return items;

  const insideWindow = (t) => {
    if (!t) return true;
    return t >= windowStart && t <= windowEnd;
  };

  const foodItems = items.filter(it => isFoodItem(it));
  const outside = foodItems.filter(it => !insideWindow(it.time));
  if (outside.length === 0) return items;

  // Distribute "outside" food items evenly across the window. Preserve their
  // original relative order. Skip times already taken inside the window.
  const [sH, sM] = windowStart.split(':').map(Number);
  const [eH, eM] = windowEnd.split(':').map(Number);
  const startMin = sH * 60 + sM;
  const endMin   = eH * 60 + eM;
  const span     = Math.max(0, endMin - startMin);

  const takenInside = new Set(foodItems.filter(it => insideWindow(it.time)).map(it => it.time));

  const newTimeFor = (i, total) => {
    if (total <= 1) return windowStart;
    const offset = Math.round((i * span) / (total - 1));
    const total_min = startMin + offset;
    const hh = String(Math.floor(total_min / 60)).padStart(2, '0');
    const mm = String(total_min % 60).padStart(2, '0');
    let t = `${hh}:${mm}`;
    // Bump by 1 min if taken.
    while (takenInside.has(t)) {
      const [th, tm] = t.split(':').map(Number);
      const bumped = th * 60 + tm + 1;
      if (bumped > endMin) break;
      const bh = String(Math.floor(bumped / 60)).padStart(2, '0');
      const bm = String(bumped % 60).padStart(2, '0');
      t = `${bh}:${bm}`;
    }
    takenInside.add(t);
    return t;
  };

  const newTimes = {};
  outside.forEach((it, i) => { newTimes[it.id] = newTimeFor(i, outside.length); });

  return items.map(it => (newTimes[it.id] ? { ...it, time: newTimes[it.id], ifShifted: true } : it));
}

// Phase 3.1 — IF notification scheduler. Schedules:
//   - Window OPEN
//   - 15 min pre-CLOSE warning
//   - Window CLOSE
// Caller passes ifPrefs + permission state. Returns the count scheduled.
let ifTimers = [];
export function clearIfNotifications() {
  ifTimers.forEach(clearTimeout);
  ifTimers = [];
}

function timeStrToTodayDate(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function scheduleIfNotifications(ifPrefs) {
  clearIfNotifications();
  if (!ifPrefs || !ifPrefs.enabled) return 0;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 0;
  const { windowStart, windowEnd } = ifPrefs;
  if (!windowStart || !windowEnd) return 0;

  const now = Date.now();
  const open  = timeStrToTodayDate(windowStart).getTime();
  const close = timeStrToTodayDate(windowEnd).getTime();
  const preClose = close - 15 * 60 * 1000;

  const fire = (when, title, body) => {
    const delay = when - now;
    if (delay <= 0) return false;
    const t = setTimeout(() => {
      try {
        new Notification(title, { body, tag: 'ppw-if-' + when });
      } catch (_) {}
    }, delay);
    ifTimers.push(t);
    return true;
  };

  let n = 0;
  if (fire(open,     'PPW · Eating window open',     'Eating window starts now.')) n++;
  if (fire(preClose, 'PPW · Eating window closing',  'Eating window closes in 15 min.')) n++;
  if (fire(close,    'PPW · Eating window closed',   'Window closed.')) n++;
  return n;
}
