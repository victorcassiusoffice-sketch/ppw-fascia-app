// Protocols premium seam (2026-07-24) — the catalog's `register` field flows
// engine → build-time manifest → app, and `monetised` protocols are gated behind
// the existing S.premium system while `free` protocols stay open for everyone.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── THE PAID BUILD, ON DEMAND (2026-10-05) ──────────────────────────────────
// The shipped build is OPEN: PREMIUM_OPEN in membership.js is true, so the B2B
// pivot leaves nothing gated and no refusal can happen. Any test below that
// describes a REFUSAL is therefore describing the PAID build, and calls
// paidBuild() first — which flips the switch back through this getter and proves
// that gate still bites. Every other test in this file runs the app as it ships.
vi.mock('./membership.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get PREMIUM_OPEN() { return globalThis.__ppwPaidBuild !== true; },
}));
/** Put the paywall back, for one test. Cleared before every test. */
const paidBuild = () => { globalThis.__ppwPaidBuild = true; };

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
  // A monetised protocol can only be locked on the paid build — see paidBuild().
  beforeEach(() => { paidBuild(); localStorage.clear(); applyServerEntitlement({ premium: false }); setTab('protocols'); stubFetch(manifest); });
  afterEach(() => { delete globalThis.__ppwPaidBuild; vi.unstubAllGlobals(); cleanup(); });

  // The lock AFFORDANCE changed on 2026-10-08. It used to be an "Unlock <title>"
  // button in accent paint, which promised a purchase was one tap away; with the
  // storefront gone it is a quiet padlock that states the limit instead. The GATE
  // is unchanged, and that is what this test is really about: a monetised protocol
  // does not open, and the moment the server says paid, it does.
  it('opens free protocols for everyone but locks monetised ones for non-Premium users', async () => {
    render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);

    // both titles render once the bundled manifest resolves
    await waitFor(() => expect(screen.getByText('Free Recovery Protocol')).toBeTruthy());
    expect(screen.getByText('Premium Testosterone Protocol')).toBeTruthy();

    // free → a real "View protocol" link that opens the PDF
    expect(screen.getByLabelText('View protocol')).toBeTruthy();
    // monetised (not premium) → a padlock that explains, NOT an open link...
    expect(screen.getByLabelText('Why Premium Testosterone Protocol is locked')).toBeTruthy();
    // ...and nothing anywhere on the row offering to sell it
    expect(screen.queryByLabelText(/^Unlock /)).toBeNull();
    expect(screen.getByText(/^Locked ·/)).toBeTruthy(); // subtitle flips to "Locked ·"
    expect(screen.queryByText(/^Premium ·/)).toBeNull();

    // server says paid → the monetised protocol now opens like any other
    act(() => applyServerEntitlement({ premium: true }));
    await waitFor(() => expect(screen.getAllByLabelText('View protocol').length).toBe(2));
    expect(screen.queryByLabelText('Why Premium Testosterone Protocol is locked')).toBeNull();
  });
});
