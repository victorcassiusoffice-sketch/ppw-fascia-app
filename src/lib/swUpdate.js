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
// The deployed build, recorded only when it DIFFERS from the one we are running.
// Set even when no service worker is waiting yet — a device pinned to a stale
// build by a stuck cache has a real update available and the user deserves to be
// told, whether or not the SW machinery has managed to stage it.
let _pendingBuild = null;
const _listeners = new Set();

function _emit() {
  const state = {
    updateReady: !!_waitingWorker || !!_pendingBuild,
    version: BUILD,
    serverVersion: _pendingBuild,
  };
  _listeners.forEach((cb) => {
    try { cb(state); } catch { /* a bad listener must not break the others */ }
  });
}

/** Subscribe to update-state changes. Returns an unsubscribe fn. Fires
 *  immediately with the current state so a late-mounting toast catches an
 *  update that was detected before it subscribed. */
export function onUpdateState(cb) {
  _listeners.add(cb);
  try { cb({ updateReady: !!_waitingWorker || !!_pendingBuild, version: BUILD, serverVersion: _pendingBuild }); } catch { /* noop */ }
  return () => _listeners.delete(cb);
}

function _setWaiting(worker) {
  _waitingWorker = worker || null;
  _emit();
}

/**
 * Apply a pending update.
 *
 * BAR FIRST (2026-08-06). This used to be called automatically by the version
 * sentinel the instant it saw a build mismatch, which is why the "new version is
 * ready" bar never appeared for anyone: proved live on 6 Aug — a client parked on
 * the old build swapped bundles silently and the bar was never rendered once.
 * That is also a force-reload mid-session, which the spec forbids.
 *
 * It is now called from exactly two places: the user tapping Update, and the app
 * being backgrounded (where a reload is invisible). Nothing applies an update
 * while someone is looking at the screen.
 */
export function applyUpdate() {
  if (_waitingWorker) {
    _waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    return true;
  }
  // Nothing staged to hand over to — a stuck or blocked SW. The guarded hard
  // reload is the only thing that shifts that, and it is exactly the recovery
  // that fixed the pinned-build incident. It now runs only because the user
  // asked for it, or because the app is in the background.
  return hardReloadOnce();
}

/** Pure helper (unit-tested): a worker is an applyable UPDATE — as opposed to
 *  the very first install — only when it has finished installing AND a SW is
 *  already controlling the page. */
export function isUpdateReady(state, hasController) {
  return state === 'installed' && !!hasController;
}

// ── Version sentinel (2026-06-17) ────────────────────────────────────────────
// The belt-and-suspenders for "device shows a stale build even though the live
// URL is current". A tiny version.json (written at build with the commit SHA)
// is fetched no-store on every check; if the SERVER's build differs from the
// build THIS tab is running, a stuck SW/cache is pinning us — so we nudge the SW
// to update and, if that doesn't budge, do ONE guarded hard reload to pull the
// fresh shell. The reload bypasses the HTTP cache via the SW's no-store nav
// handler, so the new hashed JS loads and the running build matches again.
const VERSION_URL = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.BASE_URL : '/') + 'version.json';
const RELOAD_GUARD_KEY = 'ppw.swReloadedFor';

/** Pure helper (unit-tested): should we do a one-time recovery hard reload?
 *  - never in dev / when the server build is unknown
 *  - only when the server build genuinely differs from what we're running
 *  - only ONCE per distinct server build (sessionStorage loop guard) */
export function shouldHardReload(serverBuild, runningBuild, reloadedFor) {
  if (!serverBuild || runningBuild === 'dev') return false;
  if (serverBuild === runningBuild) return false;
  if (serverBuild === reloadedFor) return false; // already reloaded for this build — don't loop
  return true;
}

/** The one-time guarded recovery reload. Only ever called from applyUpdate(). */
function hardReloadOnce() {
  let reloadedFor = null;
  try { reloadedFor = sessionStorage.getItem(RELOAD_GUARD_KEY); } catch { /* ignore */ }
  if (!shouldHardReload(_pendingBuild, BUILD, reloadedFor)) return false;
  try { sessionStorage.setItem(RELOAD_GUARD_KEY, _pendingBuild); } catch { /* ignore */ }
  if (typeof window !== 'undefined' && window.location) window.location.reload();
  return true;
}

/**
 * Compare the deployed build to the one this tab is running.
 *
 * It used to APPLY what it found — nudge the SW and, failing that, hard reload —
 * which is why nobody ever saw the update bar. It now only RECORDS the mismatch
 * and lets the bar say so; applying is the user's tap or the app being
 * backgrounded. Staying on the old build is allowed. Being uninformed is not.
 */
async function checkVersion(reg) {
  if (BUILD === 'dev') return;                 // dev server has no deployed build to recover to
  if (typeof fetch !== 'function') return;     // unsupported env (jsdom unit tests)
  let serverBuild = null;
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res || !res.ok) return;
    const data = await res.json();
    serverBuild = data && data.build;
  } catch {
    return;                                    // offline / not deployed — keep working, never reload
  }
  if (!serverBuild || serverBuild === BUILD) {
    if (_pendingBuild) { _pendingBuild = null; _emit(); }   // caught up
    return;
  }

  // A newer build is deployed. Record it — this alone lights the bar, even if the
  // SW is stuck and nothing can be staged, because the fact is true either way.
  _pendingBuild = serverBuild;

  // Stage the new worker so the user's tap is instant when it comes. Staging is
  // silent and safe; it is the APPLY that would yank the page, and that no longer
  // happens here.
  try { if (reg) await reg.update(); } catch { /* ignore */ }
  if (reg && reg.waiting) _setWaiting(reg.waiting);
  else _emit();
}

/** For tests: reset module state between cases. */
export function _resetForTest() {
  _waitingWorker = null;
  _pendingBuild = null;
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
      // scope is pinned to BASE_URL so the app controls exactly its own subpath
      // and nothing above it. At the root this is '/' (unchanged); served from
      // ppwellness.co/lifestyle-app/ it confines the SW to that folder, so it
      // can never intercept the marketing site around it.
      reg = await navigator.serviceWorker.register(swUrl, {
        updateViaCache: 'none',
        scope: import.meta.env.BASE_URL || '/',
      });
    } catch (err) {
      console.warn('SW registration failed:', err);
      return null;
    }
    // register() can resolve undefined in environments that block SW (some
    // headless/incognito contexts) — guard so we never read .waiting on it.
    if (!reg) return null;

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
    // Two signals: reg.update() pulls a fresh sw.js (the normal SW path), and
    // checkVersion() compares the deployed build sentinel to the running build,
    // which is what catches a stuck cache that reg.update() alone can't shift.
    // Neither one applies anything any more — they only surface the bar.
    const check = () => { reg.update().catch(() => {}); checkVersion(reg); };
    check();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          check();
        } else if (document.visibilityState === 'hidden' && (_waitingWorker || _pendingBuild)) {
          // THE ONLY automatic apply. Backgrounded with an update pending, so a
          // reload is invisible: the app is simply fresh on return. Covers the
          // stuck-cache case too, since applyUpdate() falls through to the
          // guarded hard reload when there is no worker to hand over to.
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
