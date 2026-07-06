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

  // 2026-07-06 CUTOVER: the New Design (App5) is the whole app on every route
  // (Vic: "change everything to be exactly the same as the new"). Mount proof
  // asserts the New Design chrome: the nav dock with its raised Add button, the
  // Stack header Notifications disc, and the Calendar nav label.
  it('renders /today with the New Design chrome (root is non-empty)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/today']}>
        <App />
      </MemoryRouter>
    );
    expect(container.childElementCount).toBeGreaterThan(0);
    expect(container.querySelector('button[aria-label="Add a stack"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Notifications"]')).toBeTruthy();
    expect(container.textContent).toContain('Calendar');
  });

  it('renders the welcome/entry route too (every route is the New Design)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/welcome']}>
        <App />
      </MemoryRouter>
    );
    expect(container.querySelector('button[aria-label="Add a stack"]')).toBeTruthy();
  });
});
