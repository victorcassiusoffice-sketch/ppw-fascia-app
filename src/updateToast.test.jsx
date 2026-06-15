// UpdateToast render + wiring test (2026-06-15).
// Proves the toast surfaces when swUpdate reports an update is ready, and that
// tapping "Refresh" calls applyUpdate(). The swUpdate module is mocked so the
// component is tested in isolation from the real SW APIs.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';

let emit;
const applyUpdate = vi.fn();

vi.mock('./lib/swUpdate.js', () => ({
  applyUpdate: (...a) => applyUpdate(...a),
  onUpdateState: (cb) => { emit = cb; return () => { emit = null; }; },
}));

import UpdateToast from './components/UpdateToast.jsx';

describe('UpdateToast', () => {
  beforeEach(() => { applyUpdate.mockClear(); emit = null; });
  afterEach(() => { cleanup(); });

  it('is hidden until an update is ready', () => {
    render(<UpdateToast />);
    expect(screen.queryByText('New version available')).toBeNull();
  });

  it('shows when an update is ready and Refresh calls applyUpdate', () => {
    render(<UpdateToast />);
    // swUpdate signals an update is waiting
    act(() => emit({ updateReady: true, version: 'abc123' }));
    const refresh = screen.getByText('Refresh');
    expect(refresh).toBeTruthy();
    expect(screen.getByText('New version available')).toBeTruthy();
    fireEvent.click(refresh);
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed', () => {
    render(<UpdateToast />);
    act(() => emit({ updateReady: true, version: 'abc123' }));
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('New version available')).toBeNull();
  });
});
