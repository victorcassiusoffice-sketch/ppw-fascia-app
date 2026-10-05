// The room around the phone (2026-10).
//
// The app draws itself inside a 430px-wide phone frame and paints whatever is
// left of the viewport behind it. Below 980px that surround was the literal
// `#83878B` — a mid-grey chosen when the reasoning was "on mobile the frame
// covers the viewport anyway". It does, at 430px and under. Between 431 and
// 979px — tablet portrait, split-screen, a narrowed desktop window — the frame
// stays capped at 430px and 40px-rounded, so the grey is plainly on screen; and
// once Indigo became the default the app went dark, so it sat in a grey box.
//
// jsdom has no layout and cannot tell us how wide anything is. What it CAN
// prove is the thing that actually fixes it: the surround names the colourway's
// own ground, and the token it names is defined on the same element so it
// resolves instead of silently painting nothing.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { setState } from './store5.js';
import { SOFT } from './theme5.js';
import App5 from './App5.jsx';

// jsdom has no layout, and the stack screen scrolls itself into view on mount.
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  window.history.replaceState({}, '', '/');
  setState({
    pendingShare: null, shareError: null,
    screen: 'stack', viewDate: null, coach: null, journalOpen: false, hint: null,
    guide: { q: {}, welcomed: 1 }, hints: {}, hintsOff: true,
    onboarded: true, firstRunChoice: true, termsOk: true, signedIn: false, premium: false,
    addOpen: false, aiOpen: false, termsOpen: false, accountOpen: false, completedOpen: false,
    playerItem: null, scheduleTarget: null, repeatId: null, premiumUpsell: null,
  });
});
afterEach(cleanup);

// jsdom's matchMedia never matches, so App5 renders the narrow tree — which is
// exactly the one that used to carry the grey.
const shell = async () => {
  let container;
  await act(async () => { ({ container } = render(<App5 />)); });
  return container.firstChild;
};

describe('the space around the phone', () => {
  it('is painted with the app’s own ground, not a flat grey', async () => {
    const el = await shell();
    expect(el.style.background).toContain('--ground');
    expect(el.style.background).not.toContain('#83878B');
  });

  // A `var()` with nothing behind it paints nothing. The tokens have always
  // been on the frame; the surround sits OUTSIDE the frame, so it needs its own
  // copy or the fix is cosmetic in the source and invisible on screen.
  it('defines the token it names, so it resolves on screen', async () => {
    const el = await shell();
    expect(el.style.getPropertyValue('--ground')).toBeTruthy();
    expect(el.style.getPropertyValue('--ink')).toBeTruthy();
  });

  // The real promise: this is not "indigo instead of grey", it is "the room
  // matches the app". Someone who picks Crimson in Settings gets a crimson
  // room, with no further work from anybody.
  it('follows whichever colourway the user chose', async () => {
    setState({ soft: 'crimson' });
    expect((await shell()).style.getPropertyValue('--ground')).toBe(SOFT.crimson.ground);
    cleanup();
    setState({ soft: 'indigo' });
    expect((await shell()).style.getPropertyValue('--ground')).toBe(SOFT.indigo.ground);
  });

  // A blanket scan rather than a check on one line, because the grey could come
  // back anywhere — another surround, a skeleton, a placeholder. This file is
  // the single exclusion: it has to name the colour in order to forbid it, so
  // App5.jsx's comment deliberately describes it instead of quoting it.
  it('leaves no trace of the hardcoded grey anywhere in the app', () => {
    const SELF = 'src/app5/indigo-surround.test.jsx';
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
    const hits = walk('src')
      .filter((f) => f !== SELF && /\.(js|jsx|ts|tsx|css|html)$/.test(f))
      .filter((f) => /83878B/i.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  // The change spreads ~30 custom properties onto an element that previously
  // had one declaration, and it is the app's outermost node. If that broke
  // anything, nothing below it would render.
  it('still mounts the whole app, with nothing shouting in the console', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await shell();
    expect(screen.getByLabelText('Add a stack')).toBeTruthy();
    expect(err).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    err.mockRestore(); warn.mockRestore();
  });
});
