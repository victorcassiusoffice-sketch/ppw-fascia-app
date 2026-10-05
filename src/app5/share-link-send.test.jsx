// Sending a routine (2026-10-05) — the tap on the share disc in the Library.
//
// The fault this pins: for three months the share disc produced a `.md` FILE.
// A practitioner sent it to a client over WhatsApp, the client tapped the
// attachment, and nothing happened — on iOS there is no mechanism at all for a
// web app to claim a document type, and Chromium's `file_handlers` is desktop
// and installed-only. The hand-over looked finished at the sending end and was
// a dead end at the receiving end, which is the worst shape a bug can have.
//
// So the disc now sends a LINK, and these tests are about what actually leaves
// the phone: a url the recipient can tap, delivered by the share sheet or the
// clipboard, and a file ONLY when the programme will not fit in one url. The
// file rail is still here and still tested — it is the oversize fallback, not
// the default.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'motion/react';
import { readFileSync } from 'node:fs';
import LibraryScreen from './screens/LibraryScreen.jsx';
import { setState, applyServerEntitlement, setTab, parseRoutineLink } from './store5.js';

const PROGRAMME = {
  id: 'rt_1',
  name: 'Shoulder rehab — weeks 1-6',
  items: [
    { title: 'Pendulum swings', meta: '2 min each arm', time: '08:00', repeat: 'daily' },
    { title: 'Wall slides', meta: '3 x 10', time: '13:00', repeat: 'daily' },
    { title: 'Scapular setting', time: '08:30', repeat: 'daily' },
    { title: 'Band external rotation', time: '18:00', repeat: 'daily', dayOffset: 7 },
    { title: 'Isometric press', time: '18:30', repeat: 'weekly', dayOffset: 14 },
    { title: 'Review with the clinic', time: '10:00', repeat: 'weekly', dayOffset: 21 },
  ],
};

// 60 stacks is PLAN_MAX_ITEMS, the sender's own ceiling, and at any realistic
// density it does not fit in LINK_MAX_URL. This is the oversize case.
const HUGE = {
  id: 'rt_big',
  name: 'Full year programme',
  items: Array.from({ length: 60 }, (_, i) => ({
    title: `Mobility and strength block ${i + 1} — the long title a real practitioner writes`,
    meta: 'Follow along · 12 min · keep the ribs down',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXc' + (i % 10),
    time: '08:00',
    repeat: 'daily',
    dayOffset: i,
  })),
};

// The Library pulls the bundled protocol manifest on mount regardless of tab.
function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ protocols: [] }) })));
}

// navigator in jsdom has neither share nor clipboard, so each test installs
// exactly the device it is describing and nothing more.
function withNavigator(props) {
  for (const [k, v] of Object.entries(props)) {
    Object.defineProperty(navigator, k, { value: v, configurable: true, writable: true });
  }
}
function stripNavigator(keys) {
  for (const k of keys) {
    if (k in navigator) delete navigator[k];
  }
}

function openLibraryWith(routine) {
  stubFetch();
  applyServerEntitlement({ premium: true });
  setTab('routines');
  setState({ routines: [routine] });
  render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);
  return screen.getByLabelText('Share routine');
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  stripNavigator(['share', 'canShare', 'clipboard']);
});

describe('the share disc sends a link', () => {
  it('hands the share sheet a url, not a file, and that url is the whole programme', async () => {
    const calls = [];
    withNavigator({ share: vi.fn(async (payload) => { calls.push(payload); }) });

    fireEvent.click(openLibraryWith(PROGRAMME));
    await waitFor(() => expect(calls.length).toBe(1));

    const payload = calls[0];
    expect(payload.files).toBeUndefined();          // Level 1, not the old {files} call
    expect(payload.title).toBe(PROGRAMME.name);
    expect(typeof payload.url).toBe('string');

    // The recipient's side of the same link, read back through the real parser.
    const got = parseRoutineLink(payload.url);
    expect(got.ok).toBe(true);
    expect(got.name).toBe(PROGRAMME.name);
    expect(got.items.map((it) => it.title)).toEqual(PROGRAMME.items.map((it) => it.title));
    expect(got.items.map((it) => it.time)).toEqual(['08:00', '13:00', '08:30', '18:00', '18:30', '10:00']);
    expect(got.items.map((it) => it.repeat)).toEqual(['daily', 'daily', 'daily', 'daily', 'weekly', 'weekly']);
    expect(got.items.map((it) => it._day)).toEqual([0, 0, 0, 7, 14, 21]);
  });

  it('copies the same url when the device has no share sheet, and says so', async () => {
    const written = [];
    withNavigator({ clipboard: { writeText: vi.fn(async (t) => { written.push(t); }) } });

    fireEvent.click(openLibraryWith(PROGRAMME));
    await waitFor(() => expect(written.length).toBe(1));

    expect(parseRoutineLink(written[0]).name).toBe(PROGRAMME.name);
    // A silent clipboard write reads as a broken button, so the toast is part
    // of the delivery, not decoration.
    expect(await screen.findByText(/Link copied/)).toBeTruthy();
  });

  it('falls through to the clipboard when the sender cancels the native sheet', async () => {
    const written = [];
    withNavigator({
      share: vi.fn(async () => { throw new DOMException('Share canceled', 'AbortError'); }),
      clipboard: { writeText: vi.fn(async (t) => { written.push(t); }) },
    });

    fireEvent.click(openLibraryWith(PROGRAMME));
    await waitFor(() => expect(written.length).toBe(1));
    expect(parseRoutineLink(written[0]).ok).toBe(true);
  });

  it('shows the link itself when the share sheet AND the clipboard both refuse', async () => {
    withNavigator({
      share: vi.fn(async () => { throw new Error('no'); }),
      clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) },
    });

    fireEvent.click(openLibraryWith(PROGRAMME));

    const field = await screen.findByLabelText('Routine share link');
    expect(parseRoutineLink(field.value).ok).toBe(true);
  });
});

describe('a programme too long for a link still travels, as a file', () => {
  it('never offers a url, produces the .md whose payload parses, and says why', async () => {
    const calls = [];
    withNavigator({
      canShare: vi.fn(() => true),
      share: vi.fn(async (payload) => { calls.push(payload); }),
      clipboard: { writeText: vi.fn(async () => { throw new Error('should not be reached'); }) },
    });

    fireEvent.click(openLibraryWith(HUGE));
    await waitFor(() => expect(calls.length).toBe(1));

    const payload = calls[0];
    expect(payload.url).toBeUndefined();              // no half a link, ever
    expect(payload.files.length).toBe(1);
    expect(payload.files[0].name).toMatch(/\.ppw-routine\.md$/);

    const md = await payload.files[0].text();
    const fenced = md.match(/```ppw-routine\n([\s\S]*?)\n```/);
    expect(fenced).toBeTruthy();
    const parsed = JSON.parse(fenced[1]);
    expect(parsed.ppw).toBe('routine');
    expect(parsed.items.length).toBe(60);
    expect(parsed.items[21].dayOffset).toBe(21);      // the schedule is still in the file

    // The sender gets told the rail changed under them — otherwise they think
    // they sent a link and the client never gets one.
    expect(await screen.findByText(/too long for a link/)).toBeTruthy();
  });

  it('takes the file rail over the stack ceiling too, and sends every stack', async () => {
    // The case the URL budget never caught (2026-10-05 review): 61 short daily
    // cues fit in one link with thousands of characters to spare, so the link
    // was built, shared, and decoded on the client's phone as 60 — "Link
    // copied" at one end, "60 stacks" at the other, and nobody told. Over the
    // ceiling the sender now refuses the link and hands over the file, which
    // has no item cap and keeps all 61.
    const calls = [];
    withNavigator({
      canShare: vi.fn(() => true),
      share: vi.fn(async (payload) => { calls.push(payload); }),
      clipboard: { writeText: vi.fn(async () => { throw new Error('should not be reached'); }) },
    });

    fireEvent.click(openLibraryWith({
      id: 'rt_cues',
      name: 'Daily cues — twelve weeks',
      items: Array.from({ length: 61 }, (_, i) => ({ title: 'Day ' + (i + 1) + ' cue' })),
    }));
    await waitFor(() => expect(calls.length).toBe(1));

    expect(calls[0].url).toBeUndefined();
    const md = await calls[0].files[0].text();
    const parsed = JSON.parse(md.match(/```ppw-routine\n([\s\S]*?)\n```/)[1]);
    expect(parsed.items.length).toBe(61);
    expect(parsed.items[60].title).toBe('Day 61 cue');
    expect(await screen.findByText(/too long for a link/)).toBeTruthy();
  });
});

describe('the onboarding pitch teaches the rail that exists', () => {
  // Read from source rather than from a render: the chip row only appears after
  // the intro's 2.97s build show has finished, and what matters here is simply
  // that the words a new user is taught match the mechanism that ships.
  it('the share chip promises a link, not a file', () => {
    const src = readFileSync('src/app5/screens/OnboardingScreen.jsx', 'utf8');
    const chip = src.match(/\{ k: 'share',[^\n]*\}/);
    expect(chip).toBeTruthy();
    expect(chip[0]).toMatch(/link/i);
    expect(chip[0]).not.toMatch(/file/i);
  });
});
