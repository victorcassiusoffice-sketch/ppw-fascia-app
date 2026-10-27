// SUPPS DISCLAIMERS (27 Oct 2026).
//
// Victor, asked whether the ten supplements nobody has checked against the
// research yet should be hidden: "We maximise on disclaimers for this."
// (V-SUPPS-DISCLAIMERS-1027.) So nothing is hidden, and this file holds the four
// promises that decision makes:
//
//   1. The Supps tab opens on a notice that is always shown and never folds:
//      not checked yet, information only, not medical advice, speak to a doctor
//      or pharmacist first.
//   2. Every supplement PPW has not cleared wears "Not checked yet" — on its row
//      and on its detail view — and the label follows the manifest, so an item
//      cleared in ppw-affiliates loses it with no code change.
//   3. Every button or link that opens a shop says it opens iHerb, outside the
//      app, and that PPW does not sell the product. The commission sentence is
//      there only because the links carry a referral code (rcode); a link with
//      none says nothing about commission.
//   4. Signed out, signed in and in the demo, the shelf says the same thing.
//
// No access code is used or read anywhere in this file: the Library and the
// viewer render on their own, without the door.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'motion/react';
import * as store from './store5.js';
import LibraryScreen from './screens/LibraryScreen.jsx';
import MediaViewer from './screens/MediaViewer.jsx';
import SuppsSection from './screens/SuppsSection.jsx';
import { NOT_CHECKED, COMMISSION_LINE, DOCTOR_LEAD, DOCTOR_CASES } from './screens/SuppNotes.jsx';
import { isSignedIn } from './membership.js';
import { isDemo } from './demo.js';
import {
  allSupps, suppsGroupedByProtocol, suppUnchecked, suppForItem, linkCarriesReferral, linksCarryReferral,
  suppToStackItem, buyUrl, shopName,
} from '../lib/suppsAffiliates.js';

const at = (url) => window.history.replaceState({}, '', url);
const notice = () => document.querySelector('[data-supps-notice]');
const labels = (root = document) => [...root.querySelectorAll('[data-supp-unchecked]')];
const shopButton = () => [...document.querySelectorAll('button')].find((b) => /^(Tick what you want\.|Shop \d+ on iHerb)$/.test(b.textContent.trim()));
const describedBy = (el) => document.getElementById(el.getAttribute('aria-describedby') || '');

// The exact words, once, so a wording change fails here rather than drifting.
const LEAVE_BUTTON = 'This button opens iHerb, outside the app. PPW does not sell these products.';
const LEAVE_LIST = 'Each link opens iHerb, outside the app. PPW does not sell these products.';
const LEAVE_ONE = 'This link opens iHerb, outside the app. PPW does not sell this product.';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  at('/');
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  store.setState({ playerItem: null, scheduleTarget: null, stackTab: 'supps', screen: 'library' });
});
afterEach(() => { cleanup(); at('/'); vi.restoreAllMocks(); });

// ── the data this build ships ───────────────────────────────────────────────
describe('the manifest this build ships', () => {
  it('holds ten supplements and PPW has cleared none of them', () => {
    const all = allSupps();
    expect(all).toHaveLength(10);
    expect(all.every((s) => s.publishable === false)).toBe(true);
    expect(all.every(suppUnchecked)).toBe(true);
  });

  it('every shop link carries the iHerb referral code, by its parameter name', () => {
    for (const s of allSupps()) {
      const u = new URL(buyUrl(s));
      expect(shopName(buyUrl(s)), s.id).toBe('iHerb');
      expect(u.searchParams.has('rcode'), s.id).toBe(true);
      expect(linkCarriesReferral(buyUrl(s)), s.id).toBe(true);
    }
  });
});

// ── 1. the notice ───────────────────────────────────────────────────────────
describe('1 · the notice at the top of the Supps tab', () => {
  it('says all of it, in plain sentences', () => {
    render(<SuppsSection />);
    const n = notice();
    expect(n).toBeTruthy();
    expect(n.getAttribute('role')).toBe('note');
    expect(n.querySelector('h2').textContent).toBe(NOT_CHECKED);
    const t = n.textContent;
    expect(t).toContain('PPW has not yet checked these supplements against the research.');
    expect(t).toContain('They are listed for information only. This is not medical advice.');
    expect(t).toContain(DOCTOR_LEAD);
    const cases = [...n.querySelectorAll('li')].map((li) => li.textContent);
    expect(cases).toEqual(DOCTOR_CASES);
    expect(cases).toEqual(['take medicines or hormone treatment', 'are pregnant or breastfeeding', 'are under 18', 'have a health condition']);
  });

  it('is always open: nothing in it folds, and it sits above the first group', () => {
    render(<SuppsSection />);
    const n = notice();
    expect(n.querySelector('button, details, summary, [aria-expanded]')).toBeNull();
    const firstGroup = [...document.querySelectorAll('div')].find((d) => d.textContent === 'Testosterone Optimisation');
    expect(firstGroup).toBeTruthy();
    expect(n.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // and above the first supplement row
    const firstRow = document.querySelector('[role="checkbox"]');
    expect(n.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('stays when a search hides every row', () => {
    render(<SuppsSection query="no such supplement" />);
    expect(document.querySelectorAll('[role="checkbox"]')).toHaveLength(0);
    expect(notice()).toBeTruthy();
    expect(notice().textContent).toContain('This is not medical advice.');
  });

  it('keeps the older "not medical advice" expander as well', () => {
    render(<SuppsSection />);
    fireEvent.click([...document.querySelectorAll('button')].find((b) => /please read before buying/.test(b.textContent)));
    expect(document.body.textContent).toContain('not medical advice, not a diagnosis or treatment');
  });

  it('is on the Supps tab of the real Library screen', () => {
    store.setTab('supps');
    render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);
    expect(notice()).toBeTruthy();
    expect(notice().textContent).toContain('PPW has not yet checked these supplements against the research.');
  });
});

// ── 2. the label ────────────────────────────────────────────────────────────
describe('2 · "Not checked yet" on every supplement PPW has not cleared', () => {
  it('is on every row of the shelf, inside that row', () => {
    render(<SuppsSection />);
    const boxes = [...document.querySelectorAll('[role="checkbox"]')];
    // six supplements, two of them under both protocols
    const rows = suppsGroupedByProtocol().reduce((n, g) => n + g.supps.length, 0);
    expect(boxes).toHaveLength(rows);
    expect(rows).toBe(8);
    for (const box of boxes) {
      const row = box.parentElement;
      const l = labels(row);
      expect(l, box.getAttribute('aria-label')).toHaveLength(1);
      expect(l[0].textContent).toBe(NOT_CHECKED);
    }
    expect(labels()).toHaveLength(rows);
  });

  it('is on the detail view of a supplement added to a day', () => {
    const s = allSupps().find((x) => x.id === 'magnesium-glycinate');
    act(() => store.openPlayer({ ...suppToStackItem(s, 'testosterone_standard_v1'), id: 'sc1', time: '08:00' }));
    render(<MediaViewer />);
    const l = labels();
    expect(l).toHaveLength(1);
    expect(l[0].textContent).toBe(NOT_CHECKED);
  });
});

// The label is read from the manifest, never hard-coded: these swap the
// manifest for a fixture and load the shelf again.
describe('2b · the label follows the data', () => {
  afterEach(() => { vi.doUnmock('../config/supps-affiliates.json'); vi.resetModules(); });

  const row = (id, publishable, evidence, url = `https://www.iherb.com/pr/_/${id.length}?rcode=TESTCODE`) => ({
    id, name: 'Supp ' + id, brand: 'Brand', in_stock: true, publishable, evidence_status: evidence, protocol_ids: ['p1'], iherb_affiliate_url: url,
  });
  async function shelfWith(supplements) {
    vi.resetModules();
    vi.doMock('../config/supps-affiliates.json', () => ({
      default: {
        program: { iherb: { affiliate_live: false, affiliate_param: 'AFFILIATE_PARAM_TBD' }, iherb_multi_add_cart_supported: false },
        by_protocol: { p1: supplements.map((s) => s.id) },
        supplements,
      },
    }));
    const Shelf = (await import('./screens/SuppsSection.jsx')).default;
    return render(<Shelf />);
  }
  const labelOn = (name) => labels(document.querySelector(`[aria-label="Select ${name}"]`).parentElement).length;

  it('a cleared supplement (publishable, evidence approved) carries no label; every other one does', async () => {
    await shelfWith([
      row('a', true, 'approved'),
      row('b', false, 'needs_evidence_review'),
      row('c', false, 'approved'), // approved but not publishable yet: still held
      row('d', true, 'needs_evidence_review'), // a flag out of step: fail closed
    ]);
    expect(labelOn('Supp a')).toBe(0);
    expect(labelOn('Supp b')).toBe(1);
    expect(labelOn('Supp c')).toBe(1);
    expect(labelOn('Supp d')).toBe(1);
    // and the notice names only the marked ones
    expect(notice().querySelector('h2').textContent).toBe('Some are not checked yet');
    expect(notice().textContent).toContain('PPW has not yet checked the supplements marked “Not checked yet” against the research.');
  });

  it('with every supplement cleared there are no labels, and the notice never says otherwise', async () => {
    await shelfWith([row('a', true, 'approved'), row('b', true, 'approved')]);
    expect(labels()).toHaveLength(0);
    const t = notice().textContent;
    expect(notice().querySelector('h2').textContent).toBe('Please read');
    expect(t).not.toMatch(/not yet checked/);
    expect(t).toContain('These supplements are listed for information only. This is not medical advice.');
    expect(t).toContain(DOCTOR_LEAD);
  });

  it('a link with no referral code says nothing about commission, anywhere on the shelf', async () => {
    await shelfWith([row('a', false, 'needs_evidence_review', 'https://www.iherb.com/pr/_/1?utm_source=ppwellness&utm_medium=affiliate')]);
    expect(describedBy(shopButton()).textContent).toBe(LEAVE_BUTTON);
    fireEvent.click([...document.querySelectorAll('button')].find((b) => /please read before buying/.test(b.textContent)));
    expect(document.body.textContent).not.toMatch(/commission/i);
    expect(document.body.textContent).toContain('These links go to iHerb. PPW does not sell these products.');
  });
});

// ── 3. the shop button and links ────────────────────────────────────────────
describe('3 · every shop button and link says where it goes', () => {
  it('the Shop button carries the leave-the-app line and, because of the rcode, the commission line', () => {
    render(<SuppsSection />);
    const note = describedBy(shopButton());
    expect(note).toBeTruthy();
    expect(note.querySelector('[data-leave-app]').textContent).toBe(LEAVE_BUTTON);
    expect(note.querySelector('[data-commission]').textContent).toBe(COMMISSION_LINE);
    expect(note.textContent).toBe(`${LEAVE_BUTTON} ${COMMISSION_LINE}`);
    // the cash claim stays gated on affiliate_live (false)
    expect(document.body.textContent).not.toContain('PPW earns a small commission');
  });

  it('the line is there before anything is ticked, and after', () => {
    render(<SuppsSection />);
    expect(describedBy(shopButton()).textContent).toBe(`${LEAVE_BUTTON} ${COMMISSION_LINE}`);
    fireEvent.click(screen.getByLabelText('Select Boron'));
    expect(shopButton().textContent).toMatch(/Shop 1 on iHerb/);
    expect(describedBy(shopButton()).textContent).toBe(`${LEAVE_BUTTON} ${COMMISSION_LINE}`);
  });

  it('each "Add these too" link carries the line, and its label', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<SuppsSection />);
    fireEvent.click(screen.getByLabelText('Select Boron'));
    fireEvent.click(screen.getByLabelText('Select Magnesium Glycinate'));
    fireEvent.click(screen.getByLabelText('Select NMN (Uthever)'));
    fireEvent.click(shopButton());
    const links = [...document.querySelectorAll('a[href*="iherb.com"]')];
    expect(links).toHaveLength(2); // the first one opened in a new tab
    for (const a of links) {
      const note = describedBy(a);
      expect(note.textContent).toBe(`${LEAVE_LIST} ${COMMISSION_LINE}`);
      expect(labels(a)).toHaveLength(1);
    }
  });

  it('the detail view\'s Open link says it leaves the app for iHerb', () => {
    const s = allSupps().find((x) => x.id === 'boron');
    act(() => store.openPlayer({ ...suppToStackItem(s, 'testosterone-optimisation-v1'), id: 'sc2', time: '08:00' }));
    render(<MediaViewer />);
    const open = screen.getByText('Open ↗');
    expect(open.getAttribute('href')).toBe(buyUrl(s));
    expect(describedBy(open).textContent).toBe(`${LEAVE_ONE} ${COMMISSION_LINE}`);
  });

  it('a routine shared by link keeps the url but not the id, and is still recognised', () => {
    const s = allSupps().find((x) => x.id === 'boron');
    const shared = { id: 'r1', title: s.name, meta: 'Supplement', url: buyUrl(s) }; // no kind, no suppId
    expect(suppForItem(shared)).toBe(s);
    act(() => store.openPlayer(shared));
    render(<MediaViewer />);
    expect(labels()).toHaveLength(1);
    expect(describedBy(screen.getByText('Open ↗')).textContent).toBe(`${LEAVE_ONE} ${COMMISSION_LINE}`);
  });

  it('a link that is not one of PPW\'s gets no label and no PPW commission line', () => {
    for (const url of ['https://www.youtube.com/watch?v=yLDAHd_C7G0', 'https://www.iherb.com/pr/_/83555?rcode=SOMEONEELSE']) {
      cleanup();
      act(() => store.openPlayer({ id: 'x', title: 'Their link', meta: 'Link', url }));
      render(<MediaViewer />);
      expect(labels(), url).toHaveLength(0);
      expect(document.querySelector('[data-shop-note]'), url).toBeNull();
      expect(document.body.textContent, url).not.toMatch(/commission/i);
    }
  });
});

describe('3b · what counts as a referral code', () => {
  it('reads the parameter names that pay a referrer, and nothing else', () => {
    expect(linkCarriesReferral('https://www.iherb.com/pr/_/1?rcode=ABC')).toBe(true);
    expect(linkCarriesReferral('https://www.iherb.com/pr/_/1?pcode=ABC')).toBe(true);
    expect(linkCarriesReferral('https://www.amazon.co.uk/dp/B0?tag=shop-21')).toBe(true);
    expect(linkCarriesReferral('https://www.awin1.com/cread.php?awinmid=1&p=x')).toBe(true);
    expect(linkCarriesReferral('https://www.iherb.com/pr/_/1?utm_source=ppwellness&utm_medium=affiliate')).toBe(false);
    expect(linkCarriesReferral('https://www.amazon.co.uk/dp/B0?ref=sr_1_1')).toBe(false);
    expect(linkCarriesReferral('https://www.iherb.com/pr/_/1?rcode=')).toBe(false);
    expect(linkCarriesReferral('not a url')).toBe(false);
    expect(linkCarriesReferral('')).toBe(false);
    // the placeholder for the future cash parameter is not a parameter
    expect(linkCarriesReferral('https://www.iherb.com/pr/_/1?AFFILIATE_PARAM_TBD=1')).toBe(false);
    expect(linksCarryReferral(['https://www.youtube.com/', 'https://www.iherb.com/pr/_/1?rcode=ABC'])).toBe(true);
    expect(linksCarryReferral([])).toBe(false);
  });
});

// ── 4. signed in, and the demo ──────────────────────────────────────────────
describe('4 · the same shelf signed out, signed in, and in the demo', () => {
  const library = () => render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);
  const sameShelf = () => {
    expect(notice()).toBeTruthy();
    expect(notice().querySelector('h2').textContent).toBe(NOT_CHECKED);
    expect(labels()).toHaveLength(document.querySelectorAll('[role="checkbox"]').length);
    expect(labels().length).toBe(8);
    expect(describedBy(shopButton()).textContent).toBe(`${LEAVE_BUTTON} ${COMMISSION_LINE}`);
  };

  it('signed out', () => {
    expect(isSignedIn()).toBe(false);
    store.setTab('supps');
    library();
    sameShelf();
  });

  it('signed in', () => {
    localStorage.setItem('ppw5.authToken', 'jwt');
    localStorage.setItem('ppw5.authEmail', 'member@example.com');
    expect(isSignedIn()).toBe(true);
    store.setTab('supps');
    library();
    sameShelf();
  });

  it('in the demo (?demo=1)', () => {
    at('/?demo=1');
    expect(isDemo()).toBe(true);
    store.setTab('supps');
    library();
    sameShelf();
  });
});
