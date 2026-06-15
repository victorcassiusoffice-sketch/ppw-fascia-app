// Service-worker update manager (2026-06-15).
//
// Problem this fixes: an installed PWA / old service worker kept showing a
// days-old cached UI even though GitHub Pages served the latest build. The SW
// never reliably updated and there was no "new version" path on the client.
//
// What this does, from a user's point of view:
//   1. Registers the SW with updateViaCache:'none' so the sw.js SCRIPT is always
//      fetched fresh from the network (never the HTTP cache) — this is what lets
//      a hard-stuck old cache-first SW be replaced at all.
//   2. Forces an update check on load, and again every time the app returns to
//      the foreground (a long-lived installed PWA otherwise only re-checks ~once
//      a day).
//   3. When a new build has installed and is waiting, surfaces a tasteful glass
//      toast ("New version — Refresh"). The user can apply it instantly, OR it
//      auto-applies the moment they background the app (a backgrounded reload is
//      invisible), OR it applies naturally on the next cold launch. Either way
//      they never stay on a stale build, and an active user is never yanked.
//   4. Reloads the page exactly once when the new SW takes control
//      (controllerchange), guarded against reload loops.
//
// The SW side (public/sw.js) deliberately does NOT skipWaiting() on install —
// it waits for the SKIP_WAITING message posted by applyUpdate() below.

const BUILD = typeof __PPW_BUILD__ !== 'undefined' ? __PPW_BUILD__ : 'dev';

let _waitingWorker = null;
const _listeners = new Set();

function _emit() {
  const state = { updateReady: !!_waitingWorker, version: BUILD };
  _listeners.forEach((cb) => {
    try { cb(state); } catch { /* a bad listener must not break the others */ }
  });
}

/** Subscribe to update-state changes. Returns an unsubscribe fn. Fires
 *  immediately with the current state so a late-mounting toast catches an
 *  update that was detected before it subscribed. */
export function onUpdateState(cb) {
  _listeners.add(cb);
  try { cb({ updateReady: !!_waitingWorker, version: BUILD }); } catch { /* noop */ }
  return () => _listeners.delete(cb);
}

function _setWaiting(worker) {
  _waitingWorker = worker || null;
  _emit();
}

/** Apply a pending update: tell the waiting SW to take over. The resulting
 *  controllerchange triggers the one-time reload. No-op if nothing is waiting. */
export function applyUpdate() {
  if (_waitingWorker) {
    _waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }
}

/** Pure helper (unit-tested): a worker is an applyable UPDATE — as opposed to
 *  the very first install — only when it has finished installing AND a SW is
 *  already controlling the page. */
export function isUpdateReady(state, hasController) {
  return state === 'installed' && !!hasController;
}

/** For tests: reset module state between cases. */
export function _resetForTest() {
  _waitingWorker = null;
  _listeners.clear();
}

export function registerServiceWorker({ immediate = false } = {}) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  // Reload exactly once when the new SW takes control. The module-level guard
  // stops a reload loop if controllerchange fires more than once.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    if (typeof window !== 'undefined') window.location.reload();
  });

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  const start = async () => {
    let reg;
    try {
      // updateViaCache:'none' — fetch the SW script itself from the network on
      // every check, never the HTTP cache. Without this a stale sw.js can be
      // served from cache and the new SW never installs (the stuck case).
      reg = await navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' });
    } catch (err) {
      console.warn('SW registration failed:', err);
      return null;
    }

    // A build may have installed and parked in `waiting` while the app was
    // closed — surface it right away.
    if (reg.waiting && navigator.serviceWorker.controller) {
      _setWaiting(reg.waiting);
    }

    // A new build started installing during this session.
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (isUpdateReady(nw.state, navigator.serviceWorker.controller)) {
          _setWaiting(reg.waiting || nw);
        }
      });
    });

    // Force a check now and whenever the app comes back to the foreground.
    const check = () => { reg.update().catch(() => {}); };
    check();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          check();
        } else if (document.visibilityState === 'hidden' && _waitingWorker) {
          // Backgrounded with an update pending — apply it silently so the app
          // is fresh on return, without interrupting the session they just left.
          applyUpdate();
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', check);
    }

    return reg;
  };

  if (immediate || (typeof document !== 'undefined' && document.readyState === 'complete')) {
    return start();
  }
  return new Promise((resolve) => {
    window.addEventListener('load', () => resolve(start()), { once: true });
  });
}
