// SUPPS DISCLAIMERS IN THE DEMO EMBED (27 Oct 2026, V-SUPPS-DISCLAIMERS-1027).
//
// The clinics page frames the app as `?demo=1`, and PREMIUM_OPEN opens every
// tab there too, so a prospect can reach the Supps shelf. This file boots the
// store AS the demo (the URL is set before the hoisted imports, the way
// demo-embed.test.jsx does it) and renders the whole app, so the warnings are
// checked on the screens a prospect actually meets:
//
//   · the Library's Supps tab — the notice, and the label on every row
//   · the Stack — a supplement added to the day keeps "Not checked yet" on its
//     card and on the Next up hero, and the hero's play button (which opens
//     iHerb) says so
//
// No access code appears anywhere in this file: the demo has no door.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
  try { window.history.replaceState({}, '', '/?demo=1'); } catch { /* no jsdom history */ }
});

import { render, cleanup, act } from '@testing-library/react';
import { isDemo } from './demo.js';
import App5 from './App5.jsx';
import { setState } from './store5.js';
import { allSupps, suppToStackItem, buyUrl } from '../lib/suppsAffiliates.js';
import { NOT_CHECKED, COMMISSION_LINE } from './screens/SuppNotes.jsx';

const labels = (root = document) => [...root.querySelectorAll('[data-supp-unchecked]')];
const describedBy = (el) => document.getElementById(el.getAttribute('aria-describedby') || '');

beforeEach(() => {
  window.history.replaceState({}, '', '/?demo=1');
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 })));
  // only the transient layers, as demo-embed.test.jsx does
  setState({
    viewDate: null, coach: null, journalOpen: false, hint: null,
    addOpen: false, aiOpen: false, termsOpen: false, accountOpen: false,
    completedOpen: false, playerItem: null, scheduleTarget: null, repeatId: null,
    editId: null, premiumUpsell: null, selectedIds: [],
    pendingShare: null, shareError: null, shareHidden: false,
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('the demo embed', () => {
  it('is booted as the demo', () => {
    expect(isDemo()).toBe(true);
  });

  it('opens the Supps tab on the notice, with every row labelled', async () => {
    setState({ screen: 'library', stackTab: 'supps' });
    await act(async () => { render(<App5 />); });
    const n = document.querySelector('[data-supps-notice]');
    expect(n).toBeTruthy();
    expect(n.querySelector('h2').textContent).toBe(NOT_CHECKED);
    expect(n.textContent).toContain('This is not medical advice.');
    const rows = document.querySelectorAll('[role="checkbox"][aria-label^="Select "]').length;
    expect(rows).toBe(8);
    expect(labels()).toHaveLength(rows);
  });

  it('keeps the label on a supplement added to the day, and the hero says its play button opens iHerb', async () => {
    const vitD = allSupps().find((s) => s.id === 'vitamin-d3-k2');
    const zinc = allSupps().find((s) => s.id === 'zinc-picolinate');
    setState({
      screen: 'stack',
      doneByDate: {},
      deckItems: [
        { ...suppToStackItem(vitD, 'testosterone-optimisation-v1'), id: 'sx1', time: '06:00', repeat: 'daily' },
        { ...suppToStackItem(zinc, 'testosterone-optimisation-v1'), id: 'sx2', time: '07:00', repeat: 'daily' },
        { id: 'vx1', title: 'A stretch video', meta: 'YouTube', url: 'https://www.youtube.com/watch?v=yLDAHd_C7G0', time: '08:00', repeat: 'daily' },
      ],
    });
    await act(async () => { render(<App5 />); });

    const hero = document.querySelector('[data-tour="next-up"]');
    expect(hero.getAttribute('data-item-id')).toBe('sx1');
    expect(labels(hero)).toHaveLength(1);
    const play = hero.querySelector('a[aria-label="Play now"]');
    expect(play.getAttribute('href')).toBe(buyUrl(vitD));
    expect(describedBy(play).textContent).toBe(`The play button opens iHerb, outside the app. PPW does not sell this product. ${COMMISSION_LINE}`);

    const suppCard = document.querySelector('[data-item-id="sx2"]:not([data-tour="next-up"])');
    expect(labels(suppCard)).toHaveLength(1);
    expect(labels(suppCard)[0].textContent).toBe(NOT_CHECKED);

    const videoCard = document.querySelector('[data-item-id="vx1"]');
    expect(labels(videoCard)).toHaveLength(0);
    expect(videoCard.textContent).not.toMatch(/commission/i);
  });
});
