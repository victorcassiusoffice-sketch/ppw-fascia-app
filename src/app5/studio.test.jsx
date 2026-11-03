// The therapist's Studio (2026-11-03, plan step 4).
//
// A licensed practitioner puts their name on a routine and hands it to a client
// as a link, a QR code or a printed card. The two claims that matter most are
// the negatives: a client account, a signed-out visitor and the demo can NOT
// open the Studio (not by the button, not by the store, not by forcing the
// flag), and nothing on it is a price. The positives run through the real
// screens: the Library's button, the sheet, the clipboard, uqr's SVG, and the
// window the card prints from.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'motion/react';
import * as store from './store5.js';
import LibraryScreen from './screens/LibraryScreen.jsx';
import StudioSheet, { qrSvgFor, cardHtml, QR_MAX_CHARS } from './screens/StudioSheet.jsx';

const LS = (k) => 'ppw5.' + k;
const at = (href) => window.history.replaceState({}, '', href);
const PRICE = /\$\s?\d|\bRs\b|\bMUR\b|per month|\/mo\b|checkout|buy now/i;

function decode(url) {
  const b64 = url.slice(url.indexOf('#r=') + 3).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

const ITEMS = [
  { title: 'Pendulum swings', meta: '2 min each arm', url: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', thumb: 'yt', time: '08:00', repeat: 'daily' },
  { title: 'Wall slides', time: '08:20', repeat: 'daily' },
];

const library = () => render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);

function signedIn(email = 'therapist@example.com') {
  localStorage.setItem(LS('authToken'), 'jwt');
  localStorage.setItem(LS('authEmail'), email);
}
/** The three people who can read this screen. */
const asVisitor = () => { store.signOutMembership(); };
const asClient = () => { signedIn('client@example.com'); store.applyServerEntitlement({ premium: true, practitioner: false }); };
const asPractitioner = () => { signedIn(); store.applyServerEntitlement({ premium: true, practitioner: true }); };

let writeText;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  at('/');
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  store.setState({
    onboarded: true, firstRunChoice: true, termsOk: true,
    deckItems: [], doneByDate: {}, routines: [], selectedIds: [],
    premium: true, premiumPaid: false, premiumUpsell: null, capRefusal: null,
    practitioner: false, studioOpen: false, signedIn: false,
    pendingShare: null, shareError: null, shareHidden: false,
    stackTab: 'routines', screen: 'library', viewDate: null,
    addOpen: false, aiOpen: false, accountOpen: false, termsOpen: false,
    playerItem: null, scheduleTarget: null, repeatId: null, editId: null,
    coach: null, hint: null, journalOpen: false, hintsOff: true,
    guide: { q: {}, welcomed: 1 }, protocols: [], protocolsStatus: 'ready',
  });
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); store.closeStudio(); });

// ── 1. who cannot open it ───────────────────────────────────────────────────
describe('the Studio is refused to everyone but a licensed practitioner', () => {
  it('a signed-out visitor: no button, the store refuses, the sheet paints nothing even when forced', () => {
    asVisitor();
    library();
    expect(screen.queryByLabelText('Open Studio')).toBeNull();
    expect(screen.getByText('Create Routine')).toBeTruthy();     // the public app is all theirs
    expect(store.openStudio()).toBe(false);
    expect(store.getState().studioOpen).toBe(false);
    cleanup();
    store.setState({ studioOpen: true });                            // forced by hand
    render(<StudioSheet />);
    expect(document.body.textContent.trim()).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a client account (signed in, no licence): the same three refusals', () => {
    asClient();
    expect(store.getState().signedIn).toBe(true);
    library();
    expect(screen.queryByLabelText('Open Studio')).toBeNull();
    expect(store.openStudio()).toBe(false);
    cleanup();
    store.setState({ studioOpen: true });
    render(<StudioSheet />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the demo in the website iframe: never a practitioner', async () => {
    at('/?demo=1');
    signedIn();
    localStorage.setItem(LS('ent'), JSON.stringify({ premium: true, entitlement: 'practitioner', practitioner: true, checkedAt: Date.now(), verified: true }));
    vi.resetModules();
    const s = await import('./store5.js');
    expect(s.getState().practitioner).toBe(false);
    expect(s.openStudio()).toBe(false);
    vi.resetModules();
    at('/');
  });

  it('a licence revoked while the sheet is open takes it down', () => {
    asPractitioner();
    expect(store.openStudio()).toBe(true);
    render(<StudioSheet />);
    expect(screen.getByRole('dialog', { name: 'Studio' })).toBeTruthy();
    act(() => { store.applyServerEntitlement({ premium: false, practitioner: false }); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.getState().studioOpen).toBe(false);
  });
});

// ── 2. what a practitioner can do ───────────────────────────────────────────
describe('a licensed practitioner in the Studio', () => {
  beforeEach(() => {
    asPractitioner();
    store.createRoutine('Shoulder rehab — weeks 1-6', store.routineItemsForSave(ITEMS));
  });

  it('finds the Studio on the Routines shelf and opens it', () => {
    library();
    const btn = screen.getByLabelText('Open Studio');
    fireEvent.click(btn);
    expect(store.getState().studioOpen).toBe(true);
  });

  it('puts their name on the device, picks a routine, and copies a v2 link carrying it', async () => {
    store.openStudio();
    render(<StudioSheet />);
    fireEvent.change(screen.getByLabelText('Your name on routines'), { target: { value: 'Victor Cassius Bhatoolaul' } });
    expect(JSON.parse(localStorage.getItem(LS('studio'))).name).toBe('Victor Cassius Bhatoolaul');
    expect(store.studioName()).toBe('Victor Cassius Bhatoolaul');

    fireEvent.click(screen.getByLabelText('Pick Shoulder rehab — weeks 1-6'));
    fireEvent.change(screen.getByLabelText('What it addresses'), { target: { value: 'Right shoulder after the fall' } });
    fireEvent.click(screen.getByLabelText('Next version'));          // 1 → 2
    expect(screen.getByLabelText('Version').value).toBe('2');

    await act(async () => { fireEvent.click(screen.getByText('Copy link')); });
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = writeText.mock.calls[0][0];
    expect(url).toMatch(/#r=/);
    const wire = decode(url);
    expect(wire.v).toBe(2);
    expect(wire.a).toBe('Victor Cassius Bhatoolaul');
    expect(wire.g).toBe('Right shoulder after the fall');
    expect(wire.rv).toBe('2');
    expect(wire.i[0].u).toBe('https://www.youtube.com/watch?v=v7AYKMP6rOE');
    expect(screen.getByText('Link copied')).toBeTruthy();

    // The details were saved onto the routine itself, so the Library's own
    // share button sends the same three fields from now on.
    const saved = store.getState().routines[0];
    expect(saved).toMatchObject({ author: 'Victor Cassius Bhatoolaul', goal: 'Right shoulder after the fall', version: '2' });
    const res = store.parseRoutineLink(store.routineToLink(saved));
    expect(res.author).toBe('Victor Cassius Bhatoolaul');
  });

  it('shows a QR code drawn on this device (uqr), on a white ground', () => {
    store.openStudio();
    render(<StudioSheet />);
    fireEvent.change(screen.getByLabelText('Your name on routines'), { target: { value: 'Victor' } });
    fireEvent.click(screen.getByLabelText('Pick Shoulder rehab — weeks 1-6'));
    fireEvent.click(screen.getByText('Show QR code'));
    const box = document.querySelector('[data-studio-qr]');
    expect(box).toBeTruthy();
    expect(box.querySelector('svg')).toBeTruthy();
    expect(box.style.background).toBe('rgb(255, 255, 255)');
    expect(screen.getByRole('img', { name: /QR code for Shoulder rehab/ })).toBeTruthy();
    // No QR web service: the only request stub was never called.
    expect(globalThis.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Hide QR code'));
    expect(document.querySelector('[data-studio-qr]')).toBeNull();
  });

  it('prints a card: the name, the routine, the link and the QR, in a window of its own', () => {
    const written = [];
    const fake = { document: { open: vi.fn(), write: vi.fn((h) => written.push(h)), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => fake));
    store.openStudio();
    render(<StudioSheet />);
    fireEvent.change(screen.getByLabelText('Your name on routines'), { target: { value: 'Victor Cassius Bhatoolaul' } });
    fireEvent.click(screen.getByLabelText('Pick Shoulder rehab — weeks 1-6'));
    fireEvent.change(screen.getByLabelText('What it addresses'), { target: { value: 'Right shoulder' } });
    fireEvent.click(screen.getByText('Print card'));
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(fake.print).toHaveBeenCalled();
    const html = written.join('');
    expect(html).toContain('From Victor Cassius Bhatoolaul');
    expect(html).toContain('Shoulder rehab — weeks 1-6');
    expect(html).toContain('<strong>For:</strong> Right shoulder');
    expect(html).toContain('#r=');
    expect(html).toContain('<svg');
    expect(html).toContain('Save to my Routines');
    expect(html).not.toMatch(PRICE);
  });

  it('says so, instead of nothing, when the print window is blocked', () => {
    vi.stubGlobal('open', vi.fn(() => null));
    store.openStudio();
    render(<StudioSheet />);
    fireEvent.click(screen.getByLabelText('Pick Shoulder rehab — weeks 1-6'));
    fireEvent.click(screen.getByText('Print card'));
    expect(screen.getByRole('status').textContent).toMatch(/blocked the print window/i);
  });

  it('shows no price anywhere on the Studio, and the app sells nothing on it', () => {
    store.openStudio();
    render(<StudioSheet />);
    fireEvent.click(screen.getByLabelText('Pick Shoulder rehab — weeks 1-6'));
    fireEvent.click(screen.getByText('Show QR code'));
    expect(document.body.textContent).not.toMatch(PRICE);
    expect(document.body.textContent).toMatch(/free for your clients/i);
  });

  it('closes on Done, on the X and on the backdrop, and the licence is untouched', () => {
    store.openStudio();
    render(<StudioSheet />);
    fireEvent.click(screen.getByText('Done'));
    expect(store.getState().studioOpen).toBe(false);
    expect(store.getState().practitioner).toBe(true);
    act(() => { store.openStudio(); });
    fireEvent.click(screen.getByLabelText('Close Studio'));
    expect(store.getState().studioOpen).toBe(false);
    act(() => { store.openStudio(); });
    // The backdrop: the dim layer behind the dialog, first child of the wrapper.
    fireEvent.click(screen.getByRole('dialog', { name: 'Studio' }).parentElement.firstChild);
    expect(store.getState().studioOpen).toBe(false);
  });
});

// ── 3. the QR and the card, as functions ────────────────────────────────────
describe('qrSvgFor and cardHtml', () => {
  it('draws an SVG for a link and refuses one too long for a QR code', () => {
    const svg = qrSvgFor('https://app.ppwellness.co/#r=abc');
    expect(svg).toMatch(/^<svg/);
    expect(qrSvgFor('x'.repeat(QR_MAX_CHARS + 1))).toBeNull();
    expect(qrSvgFor(null)).toBeNull();
  });
  it('escapes what a practitioner typed, so a name cannot script the card', () => {
    const html = cardHtml({ practitioner: '<script>alert(1)</script>', routine: { name: 'A & B', items: [{ title: '<b>x</b>' }], goal: '"q"', version: '1' }, link: 'https://app.ppwellness.co/#r=abc', svg: null });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('too long for a QR code');
    expect(html).not.toMatch(PRICE);
  });
});
