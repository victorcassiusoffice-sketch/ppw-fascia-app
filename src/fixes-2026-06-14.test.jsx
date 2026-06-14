// Vic phone-test fixes (2026-06-14): home nav, unmerge icon, mm:ss duration.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import MergedStack from './components/today/MergedStack.jsx';
import DurationField, { secToParts, partsToSec, formatMMSS } from './components/DurationField.jsx';

describe('Fix 1 — home logo reaches the landing, not a redirect back to Today', () => {
  beforeEach(() => {
    localStorage.clear();
    // Active state makes "/" redirect to /today — the exact condition that
    // dead-ended the old `to="/"` logo. The fix points home at /welcome.
    localStorage.setItem('ppw.activeRoutines', JSON.stringify({ savedZones: ['calf-left'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }));
    Element.prototype.scrollTo = vi.fn();
    window.scrollTo = vi.fn();
  });
  afterEach(() => cleanup());

  it('header PPW-home link points to /welcome', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/today']}>
        <App />
      </MemoryRouter>
    );
    const home = container.querySelector('header a[aria-label="PPW home"]');
    expect(home).toBeTruthy();
    expect(home.getAttribute('href')).toBe('/welcome');
  });
});

describe('Fix 2 — merged stack exposes an unmerge control', () => {
  afterEach(() => cleanup());
  const itemsById = new Map([
    ['a', { id: 'a', label: 'Routine A', time: '07:00' }],
    ['b', { id: 'b', label: 'Routine B', time: '08:00' }],
  ]);

  it('renders an unmerge icon-button that dissolves the merge (after confirm)', () => {
    const onDissolve = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <MergedStack
        mergeId="m1"
        merge={{ itemIds: ['a', 'b'], collapsed: true }}
        itemsById={itemsById}
        onSetTitle={() => {}}
        onUnmergeItem={() => {}}
        onDissolve={onDissolve}
        onSetTime={() => {}}
        onToggleCollapsed={() => {}}
        renderTabBody={() => null}
      />
    );
    const btn = screen.getByRole('button', { name: /unmerge stack/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(confirmSpy).toHaveBeenCalled();
    expect(onDissolve).toHaveBeenCalledWith('m1');
    confirmSpy.mockRestore();
  });

  it('does NOT dissolve if the confirm is cancelled', () => {
    const onDissolve = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <MergedStack mergeId="m2" merge={{ itemIds: ['a', 'b'], collapsed: true }} itemsById={itemsById}
        onSetTitle={() => {}} onDissolve={onDissolve} onSetTime={() => {}} onToggleCollapsed={() => {}} renderTabBody={() => null} />
    );
    fireEvent.click(screen.getByRole('button', { name: /unmerge stack/i }));
    expect(onDissolve).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe('Fix 3 — mm:ss duration (stored as seconds, no migration)', () => {
  afterEach(() => cleanup());

  it('secToParts / partsToSec / formatMMSS round-trip existing durations', () => {
    expect(secToParts(0)).toEqual({ mm: 0, ss: 0 });
    expect(secToParts(60)).toEqual({ mm: 1, ss: 0 });
    expect(secToParts(90)).toEqual({ mm: 1, ss: 30 });
    expect(secToParts(605)).toEqual({ mm: 10, ss: 5 });
    expect(partsToSec(1, 30)).toBe(90);
    expect(partsToSec(10, 5)).toBe(605);
    // seconds clamp to 0–59
    expect(partsToSec(0, 75)).toBe(59);
    expect(formatMMSS(90)).toBe('1:30');
    expect(formatMMSS(605)).toBe('10:05');
    // a legacy seconds-only value (e.g. 900) parses straight through
    expect(formatMMSS(900)).toBe('15:00');
  });

  it('editing minutes updates the total seconds', () => {
    const onChangeSec = vi.fn();
    render(<DurationField valueSec={90} onChangeSec={onChangeSec} idPrefix="t" />);
    const min = screen.getByLabelText('Minutes');
    const sec = screen.getByLabelText('Seconds');
    expect(min.value).toBe('1');
    expect(sec.value).toBe('30');
    fireEvent.change(min, { target: { value: '3' } });
    expect(onChangeSec).toHaveBeenLastCalledWith(210); // 3:30
    fireEvent.change(sec, { target: { value: '45' } });
    expect(onChangeSec).toHaveBeenLastCalledWith(105); // 1:45
  });
});
