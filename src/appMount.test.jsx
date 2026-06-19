// App mount smoke test (2026-06-03).
//
// GATE-1 hardening: the unit suite passed while the BROWSER failed to mount,
// because no test actually imported App.jsx (a real missing named export throws
// at module-evaluation time, before any component renders). This test imports
// AND mounts <App/> so the whole module graph is resolved and exercised — if any
// import like `migrateRecurrenceData` is dropped again, this goes red here
// instead of as a white screen in production.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';

describe('App mounts (module graph resolves end-to-end)', () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom doesn't implement scrollTo (DateStrip auto-centres today on mount);
    // real browsers do. Stub so the mount completes under test.
    Element.prototype.scrollTo = vi.fn();
    window.scrollTo = vi.fn();
  });
  afterEach(() => { cleanup(); });

  it('renders /today with the redesign chrome (root is non-empty)', () => {
    // Seed minimal active state so /today has content to render.
    localStorage.setItem('ppw.activeRoutines', JSON.stringify({ savedZones: ['calf-left'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }));

    const { container } = render(
      <MemoryRouter initialEntries={['/today']}>
        <App />
      </MemoryRouter>
    );

    // Mount proof: the persistent bottom nav + the approved glass logo are
    // present, i.e. the App shell actually rendered (not a blank #root).
    // (2026-06-12 revamp: glass logo replaced the legacy helix mark.)
    expect(container.querySelector('.botnav')).toBeTruthy();
    expect(container.querySelector('img[src*="ppw-glass-logo"]')).toBeTruthy();
    // 2026-06-19 restructure: central nested STACK pod (Protocols hub) + the
    // notifications toggle is now a normal bead (.alertbtn), replacing .bell.
    expect(container.querySelector('.botnav .nav-stack')).toBeTruthy();
    expect(container.querySelector('.botnav .alertbtn')).toBeTruthy();
  });

  it('renders the welcome/entry route too (covers the VideoIntro branch)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/welcome']}>
        <App />
      </MemoryRouter>
    );
    expect(container.querySelector('.botnav')).toBeTruthy();
  });
});
