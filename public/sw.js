/* PPW service worker — minimal app-shell + protocol JSON cache.
   No backend, no auth. Bumps cache name on each release.

   Subpath-aware: derives BASE from the SW's own location so the same
   file works at root ('/') and under a GitHub Pages repo subpath
   (e.g. '/ppw-fascia-app/').
*/
const CACHE_NAME = 'ppw-cache-v0.3.0';

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

self.addEventListener('install', (e) => {
  self.skipWaiting();
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
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
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

  // Network-first for HTML navigation; cache fallback if offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() =>
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

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((all) => {
      for (const client of all) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(BASE + 'today');
    })
  );
});
