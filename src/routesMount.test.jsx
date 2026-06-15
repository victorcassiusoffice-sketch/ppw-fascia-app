// Route-level mount smoke tests (2026-06-11 liquid-glass redesign).
//
// Phase 2.4 extracted TodayView / ProtocolsList / ProtocolDetail / ModulesList /
// SettingsView out of App.jsx into src/pages/. A missing import in any page file
// is a RUNTIME ReferenceError that only fires when that route renders — the
// App-mount test alone can't see it. This renders EVERY route so the redesign
// can never white-screen a single screen silently (render-gate law).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';

const ROUTES = ['/today', '/protocols', '/modules', '/coach', '/settings', '/welcome'];

describe('every route mounts after the pages extraction', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollTo = vi.fn();
    window.scrollTo = vi.fn();
  });
  afterEach(() => { cleanup(); });

  for (const route of ROUTES) {
    it(`renders ${route} with a non-empty tree`, () => {
      const { container } = render(
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      );
      expect(container.childElementCount).toBeGreaterThan(0);
      expect(container.querySelector('.botnav')).toBeTruthy();
    });
  }
});
