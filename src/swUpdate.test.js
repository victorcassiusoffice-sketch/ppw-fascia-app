// Service-worker auto-update logic (2026-06-15).
//
// Guards the version/update flow added to fix returning PWA users being pinned
// to a stale build. Exercises the pure helper plus the registration manager
// against a faked navigator.serviceWorker (jsdom has none).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isUpdateReady,
  shouldHardReload,
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
