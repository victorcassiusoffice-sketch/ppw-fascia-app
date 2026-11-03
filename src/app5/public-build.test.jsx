// THE PUBLIC BUILD (2026-11-03, Victor: "lifestyle public", "lifestyle option 1").
//
// The access-code door and the confidentiality tick came off. The app is free
// and public: anyone can open it, a client arriving on a practitioner's `#r=`
// link meets the programme straight after the first-run doors, and nothing on
// this device decides who may be here. What PPW licenses is the practitioner's
// Studio, and that is the SERVER's verdict (store5 `practitioner`), proven in
// studio.test.jsx. This file proves the door is gone and nothing else moved:
// the `#r=` boot pass, a v1 AND a v2 link, and the `?demo=1` embed.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { render, cleanup, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import App5 from './App5.jsx';
import { setState, getState, clearPendingShare } from './store5.js';

// Every test here mounts the WHOLE App5 cold. Under the full suite's parallel
// load that first mount has taken 5.6 s on Victor's laptop, which is over the
// default 5 s and reads as a failure that is not one. Three times the budget.
vi.setConfig({ testTimeout: 15000 });

const LS = (k) => 'ppw5.' + k;
const at = (href) => window.history.replaceState({}, '', href);

// Built by hand, not through routineToLink, so a change to the wire format
// fails these tests instead of being quietly followed by them.
function payload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** A link exactly as the 2026-10-05 build wrote it: no author, no goal, no version. */
const V1 = {
  p: 'ppwr', v: 1, n: 'Shoulder rehab — weeks 1-6',
  i: [
    { t: 'Pendulum swings', m: '2 min each arm', u: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', h: '08:00', r: 'daily' },
    { t: 'Wall slides', h: '08:20', r: 'daily' },
  ],
};
/** The same programme as this build writes it. */
const V2 = { ...V1, v: 2, a: 'Victor Cassius Bhatoolaul', g: 'Right shoulder after the fall', rv: '2' };

function appReady() {
  setState({
    pendingShare: null, shareError: null, shareHidden: false,
    screen: 'stack', viewDate: null, coach: null, journalOpen: false, hint: null,
    guide: { q: {}, welcomed: 1 }, hints: {}, hintsOff: true,
    onboarded: true, firstRunChoice: true, termsOk: true, signedIn: false,
    addOpen: false, aiOpen: false, termsOpen: false, accountOpen: false,
    completedOpen: false, playerItem: null, scheduleTarget: null, repeatId: null,
    editId: null, premiumUpsell: null, routines: [], selectedIds: [],
    practitioner: false, studioOpen: false,
  });
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  at('/');
  appReady();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 })));
});
afterEach(() => { cleanup(); clearPendingShare(); vi.unstubAllGlobals(); at('/'); });

// ── 1. no door ──────────────────────────────────────────────────────────────
describe('the public build has no door', () => {
  it('opens straight into the app on an ordinary load, asking for nothing', async () => {
    await act(async () => { render(<App5 />); });
    expect(screen.queryByLabelText(/access code/i)).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /confidential/i })).toBeNull();
    expect(screen.queryByText(/enter your access code/i)).toBeNull();
    // The app itself is on screen, and a public visitor can sign in if they want.
    expect(screen.getByRole('button', { name: 'Add a stack' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy();
    // Nothing was granted and nothing was asked to be agreed to.
    expect(localStorage.getItem('ppw5.access')).toBeNull();
    expect(localStorage.getItem('ppw5.nda')).toBeNull();
  });

  it('has no door left in the tree — the files are gone and nothing imports them', () => {
    const app5 = resolve(process.cwd(), 'src', 'app5');
    for (const gone of ['access.js', 'nda.js', 'access-codes.json', join('screens', 'AccessGate.jsx')]) {
      expect(existsSync(join(app5, gone)), gone).toBe(false);
    }
    // No shipped source may import the door back in.
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (/\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name)) files.push(p);
      }
    };
    walk(resolve(process.cwd(), 'src'));
    const offenders = files.filter((f) => /from\s+['"][^'"]*(\/access\.js|\/nda\.js|AccessGate\.jsx)['"]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

// ── 2. the boot pass on a fresh install ─────────────────────────────────────
describe('a programme arriving by link on the public build', () => {
  it('a v1 link opens the programme with no code in between', async () => {
    at('/#r=' + payload(V1));
    await act(async () => { render(<App5 />); });
    expect(window.location.hash).toBe('');           // read and stripped on boot
    expect(getState().pendingShare).toBeTruthy();
    expect(getState().pendingShare.items.length).toBe(2);
    expect(screen.queryByLabelText(/access code/i)).toBeNull();
    expect(screen.getByText('Shoulder rehab — weeks 1-6')).toBeTruthy();
    expect(screen.getByText('Save to my Routines')).toBeTruthy();
    // A v1 link carries no author line, and the sheet prints none.
    expect(document.querySelector('[data-share-meta]')).toBeNull();
  });

  it('a v2 link opens the same way and says who sent it', async () => {
    at('/#r=' + payload(V2));
    await act(async () => { render(<App5 />); });
    expect(window.location.hash).toBe('');
    expect(screen.getByText('Shoulder rehab — weeks 1-6')).toBeTruthy();
    const meta = document.querySelector('[data-share-meta]');
    expect(meta).toBeTruthy();
    expect(meta.textContent).toContain('From Victor Cassius Bhatoolaul');
    expect(meta.textContent).toContain('version 2');
    expect(meta.textContent).toContain('For Right shoulder after the fall');
    expect(getState().pendingShare.author).toBe('Victor Cassius Bhatoolaul');
  });

  it('keeps the held programme through a reload (the mirror), without any door to lose it in', async () => {
    at('/#r=' + payload(V2));
    await act(async () => { render(<App5 />); });
    const mirror = JSON.parse(localStorage.getItem(LS('pendingShare')));
    expect(mirror.name).toBe('Shoulder rehab — weeks 1-6');
    expect(mirror.author).toBe('Victor Cassius Bhatoolaul');
    expect(mirror.version).toBe('2');
  });
});

// ── 3. the embed ────────────────────────────────────────────────────────────
describe('?demo=1 still works on the public build', () => {
  it('is a demo: the marker is up, there is no sign-in, and no door', async () => {
    at('/?demo=1');
    await act(async () => { render(<App5 />); });
    expect(screen.getByRole('note').textContent).toBe('Demo');
    expect(screen.queryByRole('button', { name: /^sign in$/i })).toBeNull();
    expect(screen.queryByLabelText(/access code/i)).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
