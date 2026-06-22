// Redesign guards (2026-06-03 dual-theme rebuild).
//
// GATE-1 additions:
//  (1) theme toggle — the new dual-theme controller persists the choice and
//      flips <html data-theme>, which every semantic token keys off.
//  (2) no-feature-lost — a source-presence guard over App.jsx asserting every
//      capability's wiring is still mounted. The redesign is presentation-only;
//      if a future edit drops a feature handler/component, this goes red.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getThemeChoice, resolveTheme, applyTheme, setThemeChoice, useTheme, THEME_KEY,
} from './theme.js';

describe('dual-theme controller (theme toggle)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to dark when nothing is stored', () => {
    expect(getThemeChoice()).toBe('dark');
  });

  it('resolveTheme maps explicit choices straight through', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('setThemeChoice persists the choice AND writes <html data-theme>', () => {
    const resolved = setThemeChoice('light');
    expect(resolved).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    setThemeChoice('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applyTheme reflects a stored choice onto the document', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('useTheme().toggle flips dark↔light and keeps storage + document in sync', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('dark');

    act(() => { result.current.toggle(); });
    expect(result.current.resolved).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => { result.current.toggle(); });
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('useTheme().setChoice supports the three-way Light/Dark/System control', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setChoice('system'); });
    expect(result.current.choice).toBe('system');
    expect(localStorage.getItem(THEME_KEY)).toBe('system');
    // System resolves to a concrete theme written to the document.
    expect(['light', 'dark']).toContain(document.documentElement.getAttribute('data-theme'));
  });
});

describe('no feature lost — App.jsx wiring guard', () => {
  // Phase 2.4 (2026-06-11) — the page components were mechanically extracted
  // from App.jsx into src/pages/ + src/components/. The guard's contract is
  // unchanged (every capability's wiring still mounted); it now scans the
  // whole extracted surface, not just App.jsx.
  const read = (...p) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8');
  const src = [
    read('App.jsx'),
    read('pages', 'Today.jsx'),
    read('pages', 'Protocols.jsx'),
    read('pages', 'Modules.jsx'),
    read('pages', 'Settings.jsx'),
    read('components', 'today', 'MergedStack.jsx'),
    read('components', 'today', 'UserStackBody.jsx'),
    read('components', 'today', 'overlays.jsx'),
    read('components', 'shared.jsx'),
  ].join('\n');
  const chrome = read('chrome.jsx');

  // Each entry is a capability from the redesign brief's "must remain" list,
  // mapped to a string that proves its wiring is still present in source.
  const wiring = {
    'per-date recurrence rules':       'addRecurrenceRule',
    'recurrence scope: this-day':      "handleConfirmRecurringDelete('this-day')",
    'recurrence scope: all occurr.':   "handleConfirmRecurringDelete('all')",
    'recurring badge ↻':               '↻',
    'per-date independence (order)':   'useDateScopedStorage',
    'stacks merge':                    'mergeOnto',
    'unmerge':                         'unmergeItem',
    'dissolve / unstack':              'dissolveMerge',
    'drag reorder + merge drop':       'handleSortableMergeDrop',
    'duplicate':                       'handleDuplicate',
    'one-tap launch (↗)':              'resolveLaunchHref',
    '.ics calendar reminder':          'downloadSlotIcs',
    'in-app notifications schedule':   'scheduleStackNotifications',
    'IF eating window':                'applyIfWindow',
    'affiliate links':                 'affiliateUrlFor',
    'add stack modal':                 '<AddStackModal',
    'add protocol modal':              '<AddProtocolModal',
    'clear day/range modal':           '<ClearCalendarModal',
    'notification overlay':            '<NotificationOverlay',
    'protocols activate':              'setActiveProtocols',
    'audio modules':                   'useActiveModules',
    'routine builder route':           "nav('/welcome')",
    'completion / streak':             'computeCompletionStreak',
    'inline rename':                   '<InlineRename',
    'bulk delete':                     'handleBulkDelete',
    'bulk merge':                      'handleBulkMerge',
    'next-up hero':                    'Next up',
  };

  for (const [feature, needle] of Object.entries(wiring)) {
    it(`keeps: ${feature}`, () => {
      expect(src.includes(needle), `missing wiring for "${feature}" (looked for: ${needle})`).toBe(true);
    });
  }

  it('redesign chrome is mounted: bottom nav + glass logo + theme toggle', () => {
    expect(src.includes('<BottomNav')).toBe(true);
    // 2026-06-12 revamp (Vic ratification: REF contract supersedes legacy
    // rules) — the approved clear-glass logo replaces the inline helix mark.
    expect(src.includes('<GlassLogo')).toBe(true);
    expect(src.includes('<ThemeToggle')).toBe(true);
    // 2026-06-23 whole-app redesign: the Alerts toggle relocated OUT of the nav
    // (a toggle is not a navigation destination) to the Today top bar. The
    // notification prefs + permission gate still live in the app — now in
    // Today.jsx, which is part of `src` here.
    expect(src.includes('useNotificationPrefs')).toBe(true);
    expect(src.includes('requestPermission')).toBe(true);
  });

  it('hamburger drawer retired (no NavDrawer / app-glass wrapper left)', () => {
    expect(src.includes('NavDrawer')).toBe(false);
    expect(src.includes('app-glass')).toBe(false);
  });
});
