// Service-worker auto-update logic (2026-06-15).
//
// Guards the version/update flow added to fix returning PWA users being pinned
// to a stale build. Exercises the pure helper plus the registration manager
// against a faked navigator.serviceWorker (jsdom has none).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isUpdateReady,
  shouldHardReload,
  shouldReloadOnTakeover,
  registerServiceWorker,
  onUpdateState,
  applyUpdate,
  _resetForTest,
} from './lib/swUpdate.js';

function makeRegistration({ waiting = null } = {}) {
  const regListeners = {};
  return {
    waiting,
    installing: null,
    update: vi.fn(async () => {}),
    addEventListener: (type, cb) => { (regListeners[type] ||= []).push(cb); },
    _fire: (type, ev) => (regListeners[type] || []).forEach((cb) => cb(ev)),
  };
}

function installFakeSW({ reg, controller = {} }) {
  const containerListeners = {};
  const container = {
    controller,
    register: vi.fn(async () => reg),
    addEventListener: (type, cb) => { (containerListeners[type] ||= []).push(cb); },
    _fire: (type, ev) => (containerListeners[type] || []).forEach((cb) => cb(ev)),
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
  return container;
}

function clearFakeSW() {
  // Remove the fake so the "unsupported" case can be tested.
  if ('serviceWorker' in navigator) {
    delete navigator.serviceWorker;
  }
}

describe('isUpdateReady', () => {
  it('is true only when installed AND a controller already exists', () => {
    expect(isUpdateReady('installed', {})).toBe(true);
    expect(isUpdateReady('installed', null)).toBe(false); // first install, no prior SW
    expect(isUpdateReady('installing', {})).toBe(false);
    expect(isUpdateReady('activated', {})).toBe(false);
  });
});

describe('shouldHardReload (version sentinel)', () => {
  it('reloads once when the deployed build differs from the running build', () => {
    expect(shouldHardReload('newSHA', 'oldSHA', null)).toBe(true);
  });
  it('does NOT reload when builds match', () => {
    expect(shouldHardReload('sameSHA', 'sameSHA', null)).toBe(false);
  });
  it('does NOT reload in dev', () => {
    expect(shouldHardReload('anySHA', 'dev', null)).toBe(false);
  });
  it('does NOT reload when the server build is unknown', () => {
    expect(shouldHardReload(null, 'oldSHA', null)).toBe(false);
    expect(shouldHardReload(undefined, 'oldSHA', null)).toBe(false);
  });
  it('loop-guards: does NOT reload twice for the same target build', () => {
    expect(shouldHardReload('newSHA', 'oldSHA', 'newSHA')).toBe(false);
  });
  it('reloads again if the target build moved on past the one we guarded', () => {
    expect(shouldHardReload('newerSHA', 'oldSHA', 'newSHA')).toBe(true);
  });
});

describe('registerServiceWorker', () => {
  beforeEach(() => { _resetForTest(); });
  afterEach(() => { clearFakeSW(); vi.restoreAllMocks(); });

  it('no-ops (resolves null) when service workers are unsupported', async () => {
    clearFakeSW();
    await expect(registerServiceWorker({ immediate: true })).resolves.toBeNull();
  });

  it('registers with updateViaCache:none and forces an update check', async () => {
    const reg = makeRegistration();
    const container = installFakeSW({ reg });

    await registerServiceWorker({ immediate: true });

    // scope is pinned to BASE_URL (2026-07-28) so that when the app is served
    // from ppwellness.co/lifestyle-app/ its service worker controls that folder
    // and NOT the marketing site around it.
    expect(container.register).toHaveBeenCalledWith(
      expect.stringContaining('sw.js'),
      { updateViaCache: 'none', scope: import.meta.env.BASE_URL || '/' },
    );
    expect(reg.update).toHaveBeenCalled();
  });

  it('surfaces an update that is already waiting at startup', async () => {
    const waiting = { postMessage: vi.fn() };
    const reg = makeRegistration({ waiting });
    installFakeSW({ reg, controller: {} });

    await registerServiceWorker({ immediate: true });
    await flush();   // offered once the version check has answered (2026-10-19)

    const states = [];
    onUpdateState((s) => states.push(s));
    expect(states.at(-1)).toMatchObject({ updateReady: true });

    // applyUpdate tells the waiting worker to take over.
    applyUpdate();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('surfaces an update found mid-session once it finishes installing', async () => {
    const reg = makeRegistration();
    installFakeSW({ reg, controller: {} }); // a SW already controls the page

    await registerServiceWorker({ immediate: true });

    let ready = false;
    onUpdateState((s) => { ready = s.updateReady; });
    expect(ready).toBe(false);

    // Simulate the browser finding + installing a new build.
    const swListeners = {};
    const newWorker = {
      state: 'installing',
      postMessage: vi.fn(),
      addEventListener: (type, cb) => { (swListeners[type] ||= []).push(cb); },
      _fire: (type) => (swListeners[type] || []).forEach((cb) => cb()),
    };
    reg.installing = newWorker;
    reg._fire('updatefound');
    newWorker.state = 'installed';
    reg.waiting = newWorker;
    newWorker._fire('statechange');
    await flush();   // offered once the version check has answered (2026-10-19)

    expect(ready).toBe(true);
  });

  it('does NOT surface on a first install (no prior controller)', async () => {
    const reg = makeRegistration();
    installFakeSW({ reg, controller: null }); // first ever install — nothing controlling yet

    await registerServiceWorker({ immediate: true });

    let ready = false;
    onUpdateState((s) => { ready = s.updateReady; });

    const swListeners = {};
    const newWorker = {
      state: 'installing',
      addEventListener: (type, cb) => { (swListeners[type] ||= []).push(cb); },
      _fire: (type) => (swListeners[type] || []).forEach((cb) => cb()),
    };
    reg.installing = newWorker;
    reg._fire('updatefound');
    newWorker.state = 'installed';
    newWorker._fire('statechange');

    expect(ready).toBe(false);
  });
});

// ── BAR FIRST (2026-08-06) ───────────────────────────────────────────────────
// The version sentinel used to APPLY whatever it found the moment it found it.
// Proved live on 6 Aug: a client parked on the old build swapped bundles silently
// and the "new version is ready" bar was never rendered once — a force-reload
// mid-session, which is exactly what the spec forbids. These guard the fix.

const flush = () => new Promise((r) => setTimeout(r, 20));

function stubVersion(build) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ build }), {
    status: 200, headers: { 'content-type': 'application/json' },
  })));
}

function stubReload() {
  const reload = vi.fn();
  const original = window.location;
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: { ...original, reload } });
  return { reload, restore: () => Object.defineProperty(window, 'location', { configurable: true, writable: true, value: original }) };
}

describe('bar first — nothing applies itself while you are looking at it', () => {
  let loc;
  beforeEach(() => { _resetForTest(); sessionStorage.clear(); loc = stubReload(); });
  afterEach(() => { loc.restore(); vi.unstubAllGlobals(); clearFakeSW(); });

  it('a newer deployed build raises the bar and touches nothing else', async () => {
    const waiting = { postMessage: vi.fn() };
    const reg = makeRegistration({ waiting });
    installFakeSW({ reg });
    stubVersion('a-newer-build');

    let ready = false;
    onUpdateState((s) => { if (s.updateReady) ready = true; });
    await registerServiceWorker({ immediate: true });
    await flush();

    expect(ready).toBe(true);                        // the user is told
    expect(waiting.postMessage).not.toHaveBeenCalled(); // and NOT yanked
    expect(loc.reload).not.toHaveBeenCalled();
  });

  it('tells the user even when the service worker is stuck and nothing is staged', async () => {
    const reg = makeRegistration({ waiting: null }); // nothing to hand over to
    installFakeSW({ reg });
    stubVersion('a-newer-build');

    let ready = false;
    onUpdateState((s) => { if (s.updateReady) ready = true; });
    await registerServiceWorker({ immediate: true });
    await flush();

    expect(ready).toBe(true);
    expect(loc.reload).not.toHaveBeenCalled();   // the old auto-recovery no longer fires here
  });

  it('says nothing when the deployed build is the one already running', async () => {
    const reg = makeRegistration();
    installFakeSW({ reg });
    let version = null;
    onUpdateState((s) => { version = s.version; });
    await registerServiceWorker({ immediate: true });
    stubVersion(version);            // server serves exactly what we run
    await flush();

    let ready = false;
    onUpdateState((s) => { ready = s.updateReady; });
    expect(ready).toBe(false);
  });
});

describe('applying is the user’s tap, or the app going into the background', () => {
  let loc;
  beforeEach(() => { _resetForTest(); sessionStorage.clear(); loc = stubReload(); });
  afterEach(() => { loc.restore(); vi.unstubAllGlobals(); clearFakeSW(); });

  it('the tap hands over to the waiting worker', async () => {
    const waiting = { postMessage: vi.fn() };
    const reg = makeRegistration({ waiting });
    installFakeSW({ reg });
    stubVersion('a-newer-build');
    await registerServiceWorker({ immediate: true });
    await flush();

    applyUpdate();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  // The stuck-cache recovery that fixed the pinned-build incident is NOT gone —
  // it moved behind the tap, so it can never reload someone mid-sentence.
  it('the tap still rescues a stuck cache, once', async () => {
    const reg = makeRegistration({ waiting: null });
    installFakeSW({ reg });
    stubVersion('a-newer-build');
    await registerServiceWorker({ immediate: true });
    await flush();

    expect(applyUpdate()).toBe(true);
    expect(loc.reload).toHaveBeenCalledTimes(1);
    applyUpdate();                                  // loop guard holds
    expect(loc.reload).toHaveBeenCalledTimes(1);
  });

  it('backgrounding applies it silently — the one automatic case', async () => {
    const waiting = { postMessage: vi.fn() };
    const reg = makeRegistration({ waiting });
    installFakeSW({ reg });
    stubVersion('a-newer-build');
    await registerServiceWorker({ immediate: true });
    await flush();

    expect(waiting.postMessage).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
});

// ── A TAKEOVER IS NOT A RELOAD (2026-10-19) ─────────────────────────────────
// astra-tester, live 15f8f03: a first visit reloaded itself 0.5–1.5 s after it
// opened — the + sheet closed, the agreement jumped back to the top, up to a
// second of blank screen. sw.js claims the page as soon as it installs, and
// every takeover reloaded, though the page had just come from the network and
// already ran the deployed build. The first launch after a release did the same
// (and could raise "A new version is ready" for the build on screen). A reload
// is for a tab that is behind.

describe('shouldReloadOnTakeover', () => {
  it('reloads only a tab that runs an older build than the deployed one', () => {
    expect(shouldReloadOnTakeover(true, 'newSHA', 'oldSHA')).toBe(true);
    expect(shouldReloadOnTakeover(false, 'newSHA', 'oldSHA')).toBe(true);
    expect(shouldReloadOnTakeover(true, 'sameSHA', 'sameSHA')).toBe(false);  // first launch after a release
    expect(shouldReloadOnTakeover(false, 'sameSHA', 'sameSHA')).toBe(false); // first visit
  });
  it('without the deployed build: a takeover from an old worker reloads, a first one does not', () => {
    expect(shouldReloadOnTakeover(true, null, 'oldSHA')).toBe(true);
    expect(shouldReloadOnTakeover(false, null, 'oldSHA')).toBe(false);
    expect(shouldReloadOnTakeover(true, 'anySHA', 'dev')).toBe(true);
    expect(shouldReloadOnTakeover(false, 'anySHA', 'dev')).toBe(false);
  });
});

describe('a new service worker taking control', () => {
  let loc;
  beforeEach(() => { _resetForTest(); sessionStorage.clear(); loc = stubReload(); });
  afterEach(() => { loc.restore(); vi.unstubAllGlobals(); clearFakeSW(); });

  const runningBuild = () => { let v = null; const off = onUpdateState((s) => { v = s.version; }); off(); return v; };
  const offline = () => vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
  function installNewWorker(reg) {
    const swListeners = {};
    const nw = {
      state: 'installing',
      postMessage: vi.fn(),
      addEventListener: (type, cb) => { (swListeners[type] ||= []).push(cb); },
      _fire: (type) => (swListeners[type] || []).forEach((cb) => cb()),
    };
    reg.installing = nw;
    reg._fire('updatefound');
    nw.state = 'installed';
    reg.waiting = nw;
    nw._fire('statechange');
    return nw;
  }

  it('a first visit keeps what is on screen', async () => {
    const reg = makeRegistration();
    const container = installFakeSW({ reg, controller: null });
    stubVersion(runningBuild());
    await registerServiceWorker({ immediate: true });
    container._fire('controllerchange');
    await flush();
    expect(loc.reload).not.toHaveBeenCalled();
  });

  it('a first visit keeps what is on screen when the deployed build cannot be read', async () => {
    const reg = makeRegistration();
    const container = installFakeSW({ reg, controller: null });
    offline();
    await registerServiceWorker({ immediate: true });
    container._fire('controllerchange');
    await flush();
    expect(loc.reload).not.toHaveBeenCalled();
  });

  it('the first launch after a release keeps what is on screen and offers no update', async () => {
    // The page came fresh from the network under the old worker; the new one
    // installs and takes over.
    const reg = makeRegistration();
    const container = installFakeSW({ reg, controller: {} });
    stubVersion(runningBuild());
    await registerServiceWorker({ immediate: true });
    await flush();
    let ready = null;
    onUpdateState((s) => { ready = s.updateReady; });
    installNewWorker(reg);
    expect(ready).toBe(false);              // it is the build already on screen
    container._fire('controllerchange');
    await flush();
    expect(loc.reload).not.toHaveBeenCalled();
    expect(ready).toBe(false);
  });

  const answerWith = (build) => new Response(JSON.stringify({ build }), { status: 200, headers: { 'content-type': 'application/json' } });

  it('never flashes the bar for the build on screen when it installs before the version check answers', async () => {
    const reg = makeRegistration();
    installFakeSW({ reg, controller: {} });
    let answer;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { answer = r; })));
    await registerServiceWorker({ immediate: true });
    const seen = [];
    onUpdateState((s) => seen.push(s.updateReady));
    installNewWorker(reg);                  // installed before the version check answered
    await flush();
    answer(answerWith(runningBuild()));
    await flush();
    expect(seen).not.toContain(true);
  });

  it('a worker that installs before the version check answers is offered when the tab is behind', async () => {
    const reg = makeRegistration();
    installFakeSW({ reg, controller: {} });
    let answer;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { answer = r; })));
    await registerServiceWorker({ immediate: true });
    let ready = null;
    onUpdateState((s) => { ready = s.updateReady; });
    installNewWorker(reg);
    await flush();
    expect(ready).toBe(false);              // not yet: the check has not answered
    answer(answerWith('a-newer-build'));
    await flush();
    expect(ready).toBe(true);
  });

  it('a tab behind the deployed build reloads, once', async () => {
    const reg = makeRegistration();
    const container = installFakeSW({ reg, controller: {} });
    stubVersion('a-newer-build');
    await registerServiceWorker({ immediate: true });
    container._fire('controllerchange');
    container._fire('controllerchange');
    await flush();
    expect(loc.reload).toHaveBeenCalledTimes(1);
  });

  it('a takeover from an old worker still reloads when the deployed build cannot be read', async () => {
    const reg = makeRegistration();
    const container = installFakeSW({ reg, controller: {} });
    offline();
    await registerServiceWorker({ immediate: true });
    container._fire('controllerchange');
    await flush();
    expect(loc.reload).toHaveBeenCalledTimes(1);
  });

  it('after a first visit, a release found while the tab stays open still reloads it', async () => {
    const reg = makeRegistration();
    const container = installFakeSW({ reg, controller: null });
    stubVersion(runningBuild());
    await registerServiceWorker({ immediate: true });
    container._fire('controllerchange');    // the first worker takes charge
    await flush();
    expect(loc.reload).not.toHaveBeenCalled();
    stubVersion('a-newer-build');           // a release lands; its worker takes over
    container._fire('controllerchange');
    await flush();
    expect(loc.reload).toHaveBeenCalledTimes(1);
  });
});
