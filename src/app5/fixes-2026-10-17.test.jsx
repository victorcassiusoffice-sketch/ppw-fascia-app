// Tester pass 1 + Vic's phone, 2026-10-17. One guard per fix.
//
// The two LAYOUT fixes in this batch (the text-size zoom moved off the frame so
// the nav dock and its + stay on the screen; the Stack header wrapping its
// controls onto their own row instead of running the date under "Sign in") are
// about boxes on a real screen, which jsdom does not lay out. They are proven
// in a real Chrome at 320/360/390/1280 px, with and without the zoom — see the
// evidence folder named in the commit. What jsdom CAN hold still is below.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act, fireEvent } from '@testing-library/react';
import { setState, getState, itemHref, addCustomUrl, openAdd, openPlayer } from './store5.js';
import MediaViewer from './screens/MediaViewer.jsx';
import AddSheet from './screens/AddSheet.jsx';
import AiBridgeSheet, { AI_APPS } from './assistant/AiBridgeSheet.jsx';

const LS = (k) => 'ppw5.' + k;

beforeEach(() => {
  localStorage.clear();
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  setState({ addOpen: false, addedCustom: null, playerItem: null, aiOpen: false, screen: 'library', flashId: null, viewDate: null, customUrl: '' });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// ── P1: a protocol on the Stack had no way to open ─────────────────────────
describe('itemHref — where a stack\'s Open goes', () => {
  const here = window.location.origin;
  it('passes a full https link through', () => {
    expect(itemHref({ url: 'https://www.youtube.com/watch?v=yLDAHd_C7G0' })).toBe('https://www.youtube.com/watch?v=yLDAHd_C7G0');
  });
  it('resolves a bundled protocol path against this site', () => {
    expect(itemHref({ kind: 'pdf', url: '/protocols/pdf/myofascial-recovery-v1.pdf' })).toBe(here + '/protocols/pdf/myofascial-recovery-v1.pdf');
  });
  it('refuses anything that leaves this site or runs code', () => {
    for (const url of ['//evil.example/x.pdf', '/\\evil.example/x.pdf', 'javascript:alert(1)', 'data:text/html,hi', 'protocols/x.pdf', '', null, 42]) {
      expect(itemHref({ url })).toBeUndefined();
    }
    expect(itemHref(null)).toBeUndefined();
  });
});

describe('the viewer opens a protocol', () => {
  it('shows "Open protocol" pointing at the PDF, and no play triangle', () => {
    act(() => openPlayer({ id: 'p1', kind: 'pdf', thumb: 'doc', title: 'Myofascial Recovery Protocol', meta: 'Protocol · v1', url: '/protocols/pdf/myofascial-recovery-v1.pdf' }));
    render(<MediaViewer />);
    const open = screen.getByText('Open protocol ↗');
    expect(open.getAttribute('href')).toBe(window.location.origin + '/protocols/pdf/myofascial-recovery-v1.pdf');
    expect(open.getAttribute('target')).toBe('_blank');
  });
  it('closes on Escape', () => {
    act(() => openPlayer({ id: 'v1', title: 'A video', url: 'https://www.youtube.com/watch?v=yLDAHd_C7G0' }));
    render(<MediaViewer />);
    expect(screen.getByText('Open ↗')).toBeTruthy();
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(getState().playerItem).toBeNull();
  });
});

// ── P2: the Add sheet's "added" line, View, and a way out ──────────────────
describe('after Add, the user sees it and View goes to it', () => {
  it('View on Stack opens today\'s Stack with the new card lit', () => {
    act(() => openAdd());
    render(<AddSheet />);
    let res;
    act(() => { res = addCustomUrl('https://open.spotify.com/playlist/37i9dQZF1DWZqd5JICZI0u'); });
    expect(res.ok).toBe(true);
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/added to today's stack/);
    act(() => { fireEvent.click(screen.getByText('View on Stack')); });
    const S = getState();
    expect(S.screen).toBe('stack');
    expect(S.addOpen).toBe(false);
    expect(S.viewDate).toBeNull();
    expect(S.flashId).toBe(res.item.id);
  });
  it('closes with Escape and with its own close button', () => {
    act(() => openAdd());
    render(<AddSheet />);
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(getState().addOpen).toBe(false);
    act(() => openAdd());
    act(() => { fireEvent.click(screen.getByLabelText('Close')); });
    expect(getState().addOpen).toBe(false);
  });
});

// ── P2: Talk to your AI — numbered steps, and a way out to the AI ──────────
describe('Talk to your AI', () => {
  it('numbers its four steps', () => {
    act(() => setState({ aiOpen: true }));
    render(<AiBridgeSheet />);
    const ol = screen.getByText('Send the prompt to your AI app').closest('ol');
    expect(ol.style.listStyle).toBe('decimal');
  });
  it('offers ChatGPT, Claude and Gemini once the prompt is copied', () => {
    act(() => setState({ aiOpen: true }));
    render(<AiBridgeSheet />);
    act(() => { fireEvent.click(screen.getByText('I’ve already got a reply →')); });
    for (const a of AI_APPS) {
      const link = screen.getByText(a.name + ' ↗');
      expect(link.getAttribute('href')).toBe(a.url);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(/^https:\/\//.test(a.url)).toBe(true);
    }
  });
});

// ── P2: the Library soundscape was Spotify's home page ──────────────────────
describe('the soundscape opens a real playlist', () => {
  it('ships the playlist on the shelf', () => {
    const m1 = getState().mediaItems.find((m) => m.id === 'm1');
    expect(m1.url).toBe('https://open.spotify.com/playlist/37i9dQZF1DX4PP3DA4J0N8');
  });
  it('repairs a copy already on someone\'s Stack, and nothing else', async () => {
    localStorage.setItem(LS('stacks'), JSON.stringify({
      d: [
        { id: 'l1', time: '09:00', title: 'Deep Tissue Soundscape', meta: 'Spotify · 20 min', thumb: 'sp', url: 'https://open.spotify.com', repeat: 'daily' },
        { id: 'u2', time: '10:00', title: 'My own Spotify', meta: 'Spotify', thumb: 'sp', url: 'https://open.spotify.com', repeat: 'daily' },
      ],
      db: {}, ss: {}, ip: [],
    }));
    vi.resetModules();
    const fresh = await import('./store5.js');
    const [a, b] = fresh.getState().deckItems;
    expect(a.url).toBe('https://open.spotify.com/playlist/37i9dQZF1DX4PP3DA4J0N8');
    expect(b.url).toBe('https://open.spotify.com');   // the user's own item is left alone
  });
});
