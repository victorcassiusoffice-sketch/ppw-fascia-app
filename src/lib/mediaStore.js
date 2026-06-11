// IndexedDB wrapper for uploaded media (Phase 2 — 2026-05-23).
// Stores Blob objects keyed by id. Used by user-created stacks (image/video/audio
// uploads) so localStorage isn't bloated past its ~5 MB cap.

const DB_NAME = 'ppw-media-store';
const DB_VERSION = 1;
const STORE = 'files';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}

export async function putMedia(id, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMedia(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

export async function deleteMedia(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// React-friendly: returns an object URL for the blob; caller should
// URL.revokeObjectURL when no longer needed.
export async function getMediaUrl(id) {
  const blob = await getMedia(id);
  return blob ? URL.createObjectURL(blob) : null;
}

// Probe a File for its media duration (in seconds) without storing it.
// Returns null on unsupported types.
export function probeDuration(file) {
  return new Promise((resolve) => {
    if (!file || !file.type) { resolve(null); return; }
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    if (!isVideo && !isAudio) { resolve(null); return; }
    const url = URL.createObjectURL(file);
    const el = document.createElement(isVideo ? 'video' : 'audio');
    el.preload = 'metadata';
    el.muted = true;
    const cleanup = () => { URL.revokeObjectURL(url); el.remove(); };
    el.onloadedmetadata = () => {
      const d = isFinite(el.duration) ? Math.round(el.duration) : null;
      cleanup();
      resolve(d);
    };
    el.onerror = () => { cleanup(); resolve(null); };
    el.src = url;
  });
}

// Probe a remote URL (direct video/audio link) for duration.
export function probeUrlDuration(url, type) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const el = document.createElement(type === 'audio' ? 'audio' : 'video');
    el.crossOrigin = 'anonymous';
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => {
      const d = isFinite(el.duration) ? Math.round(el.duration) : null;
      el.remove();
      resolve(d);
    };
    el.onerror = () => { el.remove(); resolve(null); };
    el.src = url;
  });
}

// YouTube URL → id parser. Handles youtu.be/, /watch?v=, /shorts/, /embed/.
export function parseYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/.+[?&]v=)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Canonical watch URL for a YouTube id. Used by the one-tap "open" launch
// button so a short youtu.be link opens the ACTUAL video (not the homepage).
// Optionally seeds a start offset (?t=<sec>s) when the slot trims the clip.
export function youtubeWatchUrl(id, startSec) {
  if (!id) return null;
  const t = Number(startSec) > 0 ? `&t=${Math.floor(Number(startSec))}s` : '';
  return `https://www.youtube.com/watch?v=${id}${t}`;
}

// Normalise ANY YouTube URL form (youtu.be / m.youtube.com / youtube.com/watch
// ?v= / shorts / embed) to a canonical watch URL that reliably opens the video.
// Non-YouTube URLs are returned verbatim — we never drop the path/query.
export function normalizeYouTubeWatchUrl(url) {
  if (!url) return url;
  const id = parseYouTubeId(url);
  return id ? youtubeWatchUrl(id) : url;
}

// Resolve the href the "open" launch button should hit for a stored stack.
// Prefers a canonical YouTube watch URL (fixes the homepage-redirect bug),
// otherwise opens the EXACT stored url verbatim. Returns null if neither.
export function resolveLaunchHref(stack) {
  if (!stack) return null;
  if (stack.youtubeId) return youtubeWatchUrl(stack.youtubeId, stack.startAtSec);
  if (stack.url) return normalizeYouTubeWatchUrl(stack.url);
  return null;
}

// Fetch YouTube oembed metadata (title + thumbnail). No auth needed.
export async function fetchYouTubeOEmbed(url) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { mode: 'cors' });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

/* ── Refinement 2 (Apps row, 2026-06-11) — Spotify link metadata ──
   PUBLIC oEmbed endpoint only: no API key, no SDK, no playback, no spend.
   Lazy (fires only when the user pastes a Spotify link in Add Stack),
   cached in localStorage so a repeat paste never refetches, and
   offline-SILENT (null → the UI falls back to an app glyph chip). */
const OEMBED_CACHE_KEY = 'ppw.oembedCache';

export function isSpotifyUrl(url) {
  return /open\.spotify\.com\/(intl-[a-z-]+\/)?(track|episode|playlist|album|show)\//i.test(url || '');
}

export async function fetchSpotifyOEmbed(url) {
  if (!isSpotifyUrl(url)) return null;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(OEMBED_CACHE_KEY) || '{}') || {}; } catch (_) {}
  if (cache[url]) return cache[url];
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { mode: 'cors' });
    if (!r.ok) return null;
    const meta = await r.json();
    const slim = { title: meta.title || '', thumbnail_url: meta.thumbnail_url || null };
    try {
      // Keep the cache bounded (last ~40 links).
      const keys = Object.keys(cache);
      if (keys.length > 40) delete cache[keys[0]];
      cache[url] = slim;
      localStorage.setItem(OEMBED_CACHE_KEY, JSON.stringify(cache));
    } catch (_) {}
    return slim;
  } catch (_) { return null; }
}

/* Thumbnail for a stored user stack (REF-06): prefers the additively-stored
   `thumbnailUrl` (oEmbed result at save time); YouTube ids derive a static
   CDN thumb with NO network round-trip at save. Null → caller renders the
   app glyph chip fallback. */
export function stackThumbnailUrl(stack) {
  if (!stack) return null;
  if (stack.thumbnailUrl) return stack.thumbnailUrl;
  if (stack.youtubeId) return `https://i.ytimg.com/vi/${stack.youtubeId}/mqdefault.jpg`;
  return null;
}
