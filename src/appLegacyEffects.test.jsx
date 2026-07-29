// W10 (2026-07-29) — the retired app's effects must not run under the New Design.
//
// `NEW_DESIGN_ONLY` short-circuits RENDERING, not module loading: App.jsx still
// statically imports the whole retired tree, so every legacy side-effect it sets
// up in a `useEffect` above the early return keeps executing in production.
// `initAssistantSync()` was exactly that — a device-bridge poll writing into the
// dead `ppw.*` keys on every launch and every foreground. It did no visible harm
// only because `device_tokens = 0` (nobody has ever paired); pairing one device
// would have re-armed it silently.
//
// This test is the guard: it fails if any legacy effect is ever hoisted back
// above the `NEW_DESIGN_ONLY` return.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./lib/assistantSync.js', () => ({ initAssistantSync: vi.fn(() => () => {}) }));
vi.mock('./lib/softTactile.js', () => ({ installGlobalPressSound: vi.fn(() => () => {}) }));

import App from './App.jsx';
import { initAssistantSync } from './lib/assistantSync.js';
import { installGlobalPressSound } from './lib/softTactile.js';

describe('legacy effects stay off under NEW_DESIGN_ONLY', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // jsdom doesn't implement scrollTo (DateStrip auto-centres today on mount).
    Element.prototype.scrollTo = vi.fn();
    window.scrollTo = vi.fn();
  });
  afterEach(() => { cleanup(); });

  it('does not start the legacy assistant device-bridge sync', () => {
    render(
      <MemoryRouter initialEntries={['/today']}>
        <App />
      </MemoryRouter>
    );
    expect(initAssistantSync).not.toHaveBeenCalled();
  });

  it('does not install the legacy global press-sound (App5 owns sound)', () => {
    render(
      <MemoryRouter initialEntries={['/today']}>
        <App />
      </MemoryRouter>
    );
    expect(installGlobalPressSound).not.toHaveBeenCalled();
  });
});
