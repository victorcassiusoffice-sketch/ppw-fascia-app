// Vic's two asks, 2026-08-07: a logo on the sign-up screen, and Gloft as the
// default colourway. Vic, 2026-10: the default colourway is now INDIGO — these
// tests were the lock on gloft, and they are now the lock on indigo. The lock
// itself is the point; which colourway it holds is Vic's call, and this file is
// rewritten whenever he makes a new one, never quietly loosened.
//
// Indigo is not a hue tweak: the soft branch of themeVars never reads `theme` or
// `bg`, so each colourway's own ink + ground ARE the mode — gloft→indigo flips
// the whole app from light to dark. Hence the chrome-colour block at the bottom,
// which is new: the browser chrome was still painting the old #15171C.
//
// The trap all of this sits on: theme art was DATA nobody read. Every colourway
// carried `logo` and `mark` fields; no component consumed either, so eight logo
// files shipped in every build and were never shown, and six `mark` paths pointed
// at files that have never existed in this repo. These tests keep the art wired to
// something real, and keep the default from drifting back.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { SOFT, logoUrl } from './theme5.js';
import { setState, getState } from './store5.js';
import FirstRunChoice from './screens/FirstRunChoice.jsx';

const ASSETS = 'public/assets';

beforeEach(() => {
  localStorage.clear();
  setState({ firstRunChoice: false, onboarded: false, signedIn: false, soft: 'indigo' });
});
afterEach(cleanup);

describe('the default colourway is Indigo', () => {
  // Read from source, not from the running store: another test can setState the
  // colourway, and this must assert what a NEW user actually gets.
  it('a fresh install starts on indigo', () => {
    const src = readFileSync('src/app5/store5.js', 'utf8');
    const defaults = src.match(/skin: 'soft', bg: '\w+', soft: '(\w+)'/);
    expect(defaults?.[1]).toBe('indigo');
  });

  it('indigo is a real, complete colourway and not a typo', () => {
    expect(SOFT.indigo).toBeTruthy();
    expect(SOFT.indigo.name).toBe('Indigo');
    expect(SOFT.indigo.ground).toBeTruthy();
  });

  // The whole point of a default is that it only applies when nothing was chosen.
  // Gloft is the counter-example now that it is no longer the default: the cohort
  // who picked it in Settings between 2026-08-07 and today must keep it, because
  // the indigo flip deliberately ships with NO migration.
  it('a saved preference still beats the default', () => {
    localStorage.setItem('ppw5.soft', 'gloft');
    const src = readFileSync('src/app5/store5.js', 'utf8');
    expect(src).toMatch(/if \(g\('soft'\)\) def\.soft = g\('soft'\);/);
  });
});

describe('the wordmark is on the first screen', () => {
  it('renders the logo, named for a screen reader', () => {
    render(<FirstRunChoice />);
    const img = screen.getByAltText('PPWellness');
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toMatch(/ppw-logo-indigo\.webp$/);
  });

  it('follows the colourway, so the screen looks like the app behind it', () => {
    setState({ soft: 'gloft' });
    render(<FirstRunChoice />);
    expect(screen.getByAltText('PPWellness').getAttribute('src')).toMatch(/ppw-logo-gloft\.webp$/);
  });

  it('still offers all three doors alongside it', () => {
    render(<FirstRunChoice />);
    expect(screen.getByText('Create an account')).toBeTruthy();
    expect(screen.getByText('I already have one')).toBeTruthy();
    expect(screen.getByText('Look around first')).toBeTruthy();
  });

  // Vic, 2026-08-11: "it sits LEFT and unstyled. Centred, inside a soft-edge
  // neumorphism square, matching the app's soft design language."
  it('sits centred in a soft-edge square, not flush left', () => {
    render(<FirstRunChoice />);
    const tile = screen.getByAltText('PPWellness').parentElement;
    expect(tile.style.alignSelf).toBe('center');
    expect(tile.style.aspectRatio).toBe('1 / 1');
    expect(parseInt(tile.style.borderRadius, 10)).toBeGreaterThanOrEqual(24);
  });

  // The tokens are what make it MATCH the language rather than imitate it: they
  // are the soft skin's own dual-light neumorphic pair, and they re-tint per
  // colourway for free. Hand-rolled shadows here would drift the first time a
  // colourway changed.
  it('is built from the app’s own neumorphic tokens, and on the ground material', () => {
    render(<FirstRunChoice />);
    const tile = screen.getByAltText('PPWellness').parentElement;
    expect(tile.style.boxShadow).toContain('--intro-shadow');
    expect(tile.style.boxShadow).toContain('--intro-bevel');
    expect(tile.style.background).toContain('--ground');
  });
});

describe('every artwork path points at a file that exists', () => {
  // The exact fault that made `mark:` dead weight for months.
  it('every colourway logo resolves to a real file', () => {
    for (const [key, c] of Object.entries(SOFT)) {
      if (!c.logo) continue;
      expect(existsSync(`${ASSETS}/${c.logo.replace(/^assets\//, '')}`), `${key}: ${c.logo}`).toBe(true);
    }
  });

  it('no colourway references the ppw-mark art that has never existed', () => {
    const marks = readdirSync(ASSETS).filter((f) => f.startsWith('ppw-mark-'));
    expect(marks).toEqual([]);                                   // still none on disk
    for (const [key, c] of Object.entries(SOFT)) {
      expect(c.mark, `${key} still references missing mark art`).toBeUndefined();
    }
  });

  it('logoUrl falls back rather than returning a broken path', () => {
    expect(logoUrl({ soft: 'no-such-colourway' })).toMatch(/ppw-logo-glass\.webp$/);
    expect(logoUrl(undefined)).toMatch(/ppw-logo-graphite\.webp$/);
  });

  // The reason the .webp files exist at all: the PNG masters are 1.5-4MB each and
  // this is the FIRST screen a new customer loads, quite possibly on mobile data.
  it('the shipped wordmarks are small enough to put on a first screen', () => {
    for (const [key, c] of Object.entries(SOFT)) {
      if (!c.logo) continue;
      const bytes = readFileSync(`${ASSETS}/${c.logo.replace(/^assets\//, '')}`).length;
      expect(bytes, `${key} wordmark is ${Math.round(bytes / 1024)}KB`).toBeLessThan(64 * 1024);
    }
  });
});

// Added with the 2026-10 indigo flip. The browser chrome (the status bar on iOS,
// the task-switcher card on Android, the splash behind an installed PWA) is set by
// static metadata that CANNOT follow a user-selectable colourway, so it is one
// fixed value and it has to be the default's. It was #15171C — the retired
// dark-theme --c-bg-base — which was already wrong for the LIGHT gloft default it
// shipped under, and nothing in the build would ever have caught that.
describe('the browser chrome matches the default colourway', () => {
  const html = readFileSync('index.html', 'utf8');
  const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
  const DEEP = '#0A1428';                                   // SOFT.indigo.deep

  it('is indigo’s own deep colour, not an invented one', () => {
    expect(SOFT.indigo.deep).toBe(DEEP);
  });

  it('all three chrome sites agree', () => {
    expect(html).toContain(`<meta name="theme-color" content="${DEEP}" />`);
    expect(manifest.background_color).toBe(DEEP);
    expect(manifest.theme_color).toBe(DEEP);
  });

  it('no trace of the retired dark-theme base colour is left', () => {
    expect(html).not.toContain('#15171C');
    expect(JSON.stringify(manifest)).not.toContain('#15171C');
  });
});
