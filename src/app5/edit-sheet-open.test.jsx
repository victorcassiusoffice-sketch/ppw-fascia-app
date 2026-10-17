// P0 (tester pass 1, 2026-10-17): opening ANY stack for editing blanked the app.
//
// EditStackSheet is always mounted and renders null while closed. A useState sat
// below its `if (!it) return null`, so the first open rendered one more hook than
// the closed render before it and React threw #310 ("Rendered more hooks than
// during the previous render"). Nothing above it catches a render error, so the
// whole app went to an empty page: tapping a Text item, or the pencil on any card.
//
// These tests drive the sheet exactly the way the app does — mounted closed
// first, then opened through the store — which is the one order the old tests
// never used (they mounted it already open).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';
import { setState, getState, openEditItem, closeEditItem } from './store5.js';
import EditStackSheet from './screens/EditStackSheet.jsx';

const NOTE = { id: 'n1', title: 'I did enough today.', meta: 'Text · Still', time: '21:00', kind: 'note', noteAnim: 'still', noteSpeed: 'med', noteDur: '5', repeat: 'daily' };
const VIDEO = { id: 'v1', title: 'Full-body stretch', meta: 'YouTube', time: '07:30', thumb: 'yt', repeat: 'daily', url: 'https://www.youtube.com/watch?v=yLDAHd_C7G0' };
const PLAIN = { id: 'p1', title: 'Take your supplements', meta: 'Supplement', time: '08:00', kind: 'supp', repeat: 'daily' };

beforeEach(() => {
  localStorage.clear();
  setState({ deckItems: [NOTE, VIDEO, PLAIN], editId: null });
});
afterEach(() => { cleanup(); setState({ editId: null }); });

describe('the edit sheet opens without taking the app down', () => {
  it('a Text item opens after the sheet was mounted closed', () => {
    render(<EditStackSheet />);
    expect(screen.queryByText('Edit stack')).toBeNull();
    act(() => openEditItem('n1'));
    expect(screen.getByText('Edit stack')).toBeTruthy();
    expect(screen.getByLabelText('Text content').value).toBe('I did enough today.');
  });

  it('a video item and a plain item open the same way', () => {
    render(<EditStackSheet />);
    act(() => openEditItem('v1'));
    expect(screen.getByLabelText('Stack name').value).toBe('Full-body stretch');
    act(() => closeEditItem());
    expect(screen.queryByText('Edit stack')).toBeNull();
    act(() => openEditItem('p1'));
    expect(screen.getByLabelText('Stack name').value).toBe('Take your supplements');
  });

  it('opens, closes and opens again many times', () => {
    render(<EditStackSheet />);
    for (let i = 0; i < 4; i++) {
      act(() => openEditItem(i % 2 ? 'n1' : 'v1'));
      expect(screen.getByText('Edit stack')).toBeTruthy();
      act(() => closeEditItem());
      expect(getState().editId).toBeNull();
    }
  });
});
