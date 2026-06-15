/* PPW service worker — minimal app-shell + protocol JSON cache.
   No backend, no auth. Cache name is derived from the build version so it
   changes on EVERY deploy.

   Subpath-aware: derives BASE from the SW's own location so the same
   file works at root ('/') and under a GitHub Pages repo subpath
   (e.g. '/ppw-fascia-app/').
*/
// BUILD_VERSION is replaced at build time by the ppw-sw-version Vite plugin
// (vite.config.js) with the short git commit SHA — e.g. 'a1b2c3d'. Because the
// token is the literal '__BUILD_VERSION__' in source, the dev server and any
// un-built copy still run; the placeholder simply becomes part of the dev cache
// name. Every production deploy gets a NEW SHA -> NEW CACHE_NAME -> the activate
// handler purges every old cache, so returning visitors are never pinned to a
// stale cached shell. (2026-06-15: SW auto-update fix.)
const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = 'ppw-cache-' + BUILD_VERSION;

// BASE includes the leading and trailing slash. Examples:
//   served at /sw.js                -> BASE = '/'
//   served at /ppw-fascia-app/sw.js -> BASE = '/ppw-fascia-app/'
const BASE = self.location.pathname.replace(/sw\.js$/, '');

const SHELL = [
  BASE,
  BASE + 'today',
  BASE + 'protocols',
  BASE + 'modules',
  BASE + 'settings',
  BASE + 'manifest.json',
  BASE + 'assets/body_front.png',
  BASE + 'assets/body_back.png',
  BASE + 'assets/body_map.png',
  BASE + 'mock-protocol.json',
];

// NOTE: we intentionally do NOT call skipWaiting() here. A freshly-installed SW
// stays in `waiting` so the client can surface a tasteful "new version" prompt
// (src/lib/swUpdate.js) and apply it on the user's terms — on tap, when the app
// is backgrounded, or on the next cold launch. The client triggers activation by
// posting SKIP_WAITING (handled below). This avoids yanking a reload out from
// under an active user while still guaranteeing they never stay on a stale build.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL).catch((err) => {
        // Some shell entries may not exist yet — log + continue
        console.warn('SW shell precache partial:', err);
      })
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      // Take control of all open clients immediately on activation so the new
      // SW governs them without waiting for a navigation — paired with the
      // client's controllerchange reload, this is the moment the page refreshes.
      .then(() => self.clients.claim())
  );
});

// The client posts this once it decides to apply a pending update (user tapped
// "Refresh", the app was backgrounded, etc.). Calling skipWaiting() promotes this
// waiting SW to active -> fires `controllerchange` on every client -> they reload.
self.addEventListener('message', (e) => {
  const data = e.data;
  if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Don't intercept YouTube / Google Fonts — let the network handle them
  if (
    url.host.includes('youtube.com') ||
    url.host.includes('youtube-nocookie.com') ||
    url.host.includes('googleapis.com') ||
    url.host.includes('gstatic.com')
  ) {
    return;
  }

  // Network-first for HTML navigation: always re-check the network so the app
  // shell is the latest build, refresh the cached copy for offline, and fall
  // back to cache only when the network is unreachable.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(BASE, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(BASE + 'today').then((m) => m || caches.match(BASE))
        )
    );
    return;
  }

  // Cache-first for static assets + JSON protocol files
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache same-origin GET 200 responses
        if (req.method === 'GET' && res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// P0b (2026-06-02) — Web Push handler. iOS REQUIRES showNotification on every
// push or it silently revokes the subscription, so we always show one. Payload
// (JSON) shape: { title, body, url }. Falls back to sensible defaults.
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {
    try { data = { body: e.data && e.data.text() }; } catch (_) {}
  }
  const title = data.title || 'PPW · Reminder';
  const options = {
    body: data.body || 'Time for your next stack.',
    icon: BASE + 'assets/icon-192.png',
    badge: BASE + 'assets/icon-192.png',
    tag: data.tag || 'ppw-push',
    data: { url: data.url || (BASE + 'today') },
    requireInteraction: false,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || (BASE + 'today');
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((all) => {
      for (const client of all) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
