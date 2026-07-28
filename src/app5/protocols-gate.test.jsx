// Protocols premium seam (2026-07-24) — the catalog's `register` field flows
// engine → build-time manifest → app, and `monetised` protocols are gated behind
// the existing S.premium system while `free` protocols stay open for everyone.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, waitFor, act } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'motion/react';
import { fetchProtocols } from './protocols5.js';
import { setState, applyServerEntitlement, setTab } from './store5.js';
import LibraryScreen from './screens/LibraryScreen.jsx';

const manifest = {
  _schema: 'ppw.app.protocols',
  count: 2,
  protocols: [
    { id: 'free-1', slug: 'free-one', title: 'Free Recovery Protocol', category: 'recovery', tags: ['fascia'], version: 'v1', register: 'free', url: 'protocols/pdf/free-1.pdf' },
    { id: 'paid-1', slug: 'paid-one', title: 'Premium Testosterone Protocol', category: 'testosterone', tags: ['t'], version: 'v1', register: 'monetised', url: 'protocols/pdf/paid-1.pdf' },
  ],
};

function stubFetch(payload) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })));
}

describe('protocols5.fetchProtocols — register pass-through', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps register faithfully and defaults unknown/absent to free', async () => {
    stubFetch({
      protocols: [
        { id: 'a', title: 'A', url: 'protocols/pdf/a.pdf', register: 'monetised' },
        { id: 'b', title: 'B', url: 'protocols/pdf/b.pdf', register: 'free' },
        { id: 'c', title: 'C', url: 'protocols/pdf/c.pdf' },              // absent → free
        { id: 'd', title: 'D', url: 'protocols/pdf/d.pdf', register: 'weird' }, // unknown → free
      ],
    });
    const { status, list } = await fetchProtocols();
    expect(status).toBe('ready');
    expect(list.map((p) => [p.id, p.register])).toEqual([
      ['a', 'monetised'], ['b', 'free'], ['c', 'free'], ['d', 'free'],
    ]);
  });

  it('reports error status and empty list when the manifest is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    const { status, list } = await fetchProtocols();
    expect(status).toBe('error');
    expect(list).toEqual([]);
  });
});

describe('LibraryScreen Protocols tab — premium gate', () => {
  beforeEach(() => { localStorage.clear(); applyServerEntitlement({ premium: false }); setTab('protocols'); stubFetch(manifest); });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('opens free protocols for everyone but locks monetised ones for non-Premium users', async () => {
    render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);

    // both titles render once the bundled manifest resolves
    await waitFor(() => expect(screen.getByText('Free Recovery Protocol')).toBeTruthy());
    expect(screen.getByText('Premium Testosterone Protocol')).toBeTruthy();

    // free → a real "View protocol" link that opens the PDF
    expect(screen.getByLabelText('View protocol')).toBeTruthy();
    // monetised (not premium) → a lock/unlock control, NOT an open link
    expect(screen.getByLabelText('Unlock Premium Testosterone Protocol')).toBeTruthy();
    expect(screen.queryByText(/^Premium ·/)).toBeTruthy(); // subtitle flips to "Premium ·"

    // server says paid → the monetised protocol now opens like any other
    act(() => applyServerEntitlement({ premium: true }));
    await waitFor(() => expect(screen.getAllByLabelText('View protocol').length).toBe(2));
    expect(screen.queryByLabelText('Unlock Premium Testosterone Protocol')).toBeNull();
  });
});
