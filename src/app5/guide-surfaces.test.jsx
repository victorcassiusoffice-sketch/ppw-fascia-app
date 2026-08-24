// Guided onboarding — the SURFACES (2026-08-24).
//
// The engine tests prove the guide's logic. These prove the things the guide
// points AT actually exist and behave, because a spotlight is only as good as
// its anchor: a [data-tour] that is missing does not throw, it silently degrades
// to a full-screen dim with no cut-out and a bubble telling the user to tap
// something they cannot see.
//
// Also guards the eleven permanent product fixes, which have to keep working
// whether or not anyone ever opens the guide.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';

import {
  setState, getState, todayKey,
  addNote, addCustomUrl, addToStack, addDocToToday, addItemToDate,
  addItemsToToday, addItemsToPlan, applyRoutineToDate,
  setNoteField, clearExamples, FREE_STACK_CAP,
} from './store5.js';
import App5 from './App5.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import AddSheet from './screens/AddSheet.jsx';
import { QUEST_IDS } from './coach/quests5.js';
import { resetHintEngine } from './coach/hints5.js';

function reset(patch = {}) {
  localStorage.clear(); sessionStorage.clear();
  resetHintEngine();
  setState({
    screen: 'stack', viewDate: null, coach: null, journalOpen: false, hint: null,
    lastAddedId: null, aiStep: 0, guide: { q: {}, welcomed: 1 }, hints: {}, hintsOff: false,
    onboarded: true, firstRunChoice: true, termsOk: true, signedIn: false, premium: false,
    addOpen: false, aiOpen: false, termsOpen: false, accountOpen: false, completedOpen: false,
    playerItem: null, scheduleTarget: null, repeatId: null, premiumUpsell: null,
    doneByDate: {}, selectedIds: [], calSelKey: null, noteOpen: false, noteText: '',
    customUrl: '', addedCustom: null, routines: [],
    ...patch,
  });
}

beforeEach(() => reset());
afterEach(cleanup);

// ── P1: every add path names the thing it just made ──────────────────────
//
// The guide says "look at the thing you just added". If an add path forgets to
// say WHICH thing, the spotlight lands on a stale row — or on nothing.

describe('every add path records what it added', () => {
  it('addNote', () => {
    setState({ noteText: 'One line for today' });
    const r = addNote();
    expect(r.ok).toBe(true);
    expect(getState().lastAddedId).toBe(r.item.id);
  });

  it('addCustomUrl', () => {
    const r = addCustomUrl('https://www.youtube.com/watch?v=abc12345678');
    expect(r.ok).toBe(true);
    expect(getState().lastAddedId).toBe(r.item.id);
  });

  it('addDocToToday', () => {
    const r = addDocToToday('Plan.pdf', 'f1');
    expect(r.ok).toBe(true);
    expect(getState().lastAddedId).toBe(r.item.id);
  });

  it('addToStack', () => {
    const before = getState().lastAddedId;
    const okd = addToStack({ title: 'From the Library', meta: 'Media' });
    expect(okd).toBe(true);                       // the return shape is unchanged
    const id = getState().lastAddedId;
    expect(id).not.toBe(before);
    expect(getState().deckItems.some((x) => x.id === id)).toBe(true);
  });

  it('addItemToDate', () => {
    const r = addItemToDate({ title: 'Next week' }, '2026-9-1');
    expect(r.ok).toBe(true);
    expect(getState().lastAddedId).toBe(r.item.id);
  });

  it('addItemsToToday names the LAST of a batch', () => {
    reset({ deckItems: [] });
    const r = addItemsToToday([{ title: 'a' }, { title: 'b' }]);
    expect(r.ok).toBe(true);
    const deck = getState().deckItems;
    expect(getState().lastAddedId).toBe(deck[deck.length - 1].id);
  });

  it('addItemsToPlan names the LAST of a batch', () => {
    reset({ deckItems: [] });
    const r = addItemsToPlan([{ title: 'a', _day: 0 }, { title: 'b', _day: 1 }]);
    expect(r.ok).toBe(true);
    expect(getState().lastAddedId).toBe(r.ids[r.ids.length - 1]);
  });

  it('applyRoutineToDate names the LAST of a batch', () => {
    reset({
      deckItems: [], premium: true,
      routines: [{ id: 'r1', name: 'Morning', items: [{ title: 'a', time: '07:00' }, { title: 'b', time: '08:00' }] }],
    });
    const r = applyRoutineToDate('r1', todayKey());
    expect(r.ok).toBe(true);
    const deck = getState().deckItems;
    expect(getState().lastAddedId).toBe(deck[deck.length - 1].id);
  });

  it('a REFUSED add does not name anything', () => {
    reset({ deckItems: [], lastAddedId: null });
    const r = addCustomUrl('not a link at all');
    expect(r.ok).toBe(false);
    expect(getState().lastAddedId).toBeNull();
  });
});

// ── P2: the permanent fixes ──────────────────────────────────────────────

describe('an empty day says it is empty', () => {
  it('does not claim "All done" to someone who has done nothing', () => {
    reset({ deckItems: [], doneByDate: {} });
    render(<App5 />);
    expect(screen.getByText('Nothing on this day yet.')).toBeTruthy();
    expect(screen.getByText(/Add something with the ＋, or ask your AI to plan the whole day\./)).toBeTruthy();
    expect(screen.queryByText('All done for today')).toBeNull();
  });

  it('offers the AI as the way out of a blank page', () => {
    reset({ deckItems: [], doneByDate: {} });
    render(<App5 />);
    fireEvent.click(screen.getByText('Plan with AI'));
    expect(getState().aiOpen).toBe(true);
  });

  it('still says "All done" when the day really is done', () => {
    reset({
      deckItems: [{ id: 'a', title: 'x', time: '09:00', repeat: 'daily' }],
      doneByDate: { [todayKey()]: [{ id: 'a', at: Date.now() }] },
    });
    render(<App5 />);
    expect(screen.getByText('All done for today')).toBeTruthy();
    expect(screen.queryByText('Nothing on this day yet.')).toBeNull();
  });
});

describe('an invalid paste says so, every time', () => {
  it('renders the inline line rather than doing nothing', () => {
    reset({ addOpen: true, customUrl: 'wat' });
    render(<AddSheet />);
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText(/That did not look like something we can add\./)).toBeTruthy();
  });

  it('is NOT one-shot — an error that fires once is worse than none', () => {
    reset({ addOpen: true, customUrl: 'wat' });
    const { rerender } = render(<AddSheet />);
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText(/That did not look like something we can add\./)).toBeTruthy();
    act(() => { setState({ customUrl: 'still not a link' }); });
    rerender(<AddSheet />);
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText(/That did not look like something we can add\./)).toBeTruthy();
  });

  it('does not scold an empty field', () => {
    reset({ addOpen: true, customUrl: '' });
    render(<AddSheet />);
    fireEvent.click(screen.getByText('Add'));
    expect(screen.queryByText(/That did not look like something we can add\./)).toBeNull();
  });
});

describe('Settings tells the truth about reminders', () => {
  it('says plainly that nothing rings when the app is closed', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Nudges appear while the app is open on screen. Nothing rings when it is closed.')).toBeTruthy();
  });

  it('never promises an alarm, a notification or the lock screen', () => {
    const { container } = render(<SettingsScreen />);
    expect(container.textContent).not.toMatch(/lock screen/i);
    expect(container.textContent).not.toMatch(/\bnotification/i);
  });
});

describe('the guide has a permanent home in Settings', () => {
  it('offers the journal and says how far along it is', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Your guide')).toBeTruthy();
    expect(screen.getByText('0 of 8 quests done — replay any of them')).toBeTruthy();
    fireEvent.click(screen.getByText('Your guide'));
    expect(getState().journalOpen).toBe(true);
  });

  it('still offers it after all eight are done — the guide never expires', () => {
    reset({ guide: { q: Object.fromEntries(QUEST_IDS.map((id) => [id, 1])), done: Date.now(), welcomed: 1 } });
    render(<SettingsScreen />);
    expect(screen.getByText('8 of 8 quests done — replay any of them')).toBeTruthy();
  });

  it('can mute every hint', () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByLabelText('Toggle hints'));
    expect(getState().hintsOff).toBe(true);
  });
});

// ── the anchors the guide points at ──────────────────────────────────────

describe('the spotlight anchors exist on the screens that carry them', () => {
  const has = (c, name) => !!c.querySelector('[data-tour="' + name + '"]');

  it('the Stack carries the ones the quests need', () => {
    reset({ lastAddedId: null, deckItems: [{ id: 'a', title: 'hero', time: '07:00', repeat: 'daily' }] });
    const { container } = render(<App5 />);
    for (const name of ['guide', 'completed-disc', 'bell', 'next-up', 'done', 'add', 'stack', 'library', 'calendar', 'settings']) {
      expect(has(container, name), 'missing [data-tour="' + name + '"] on the Stack').toBe(true);
    }
  });

  it('the row controls the hint engine points at', () => {
    // two rows, both playable, so there IS a "rest" row carrying the controls
    reset({ deckItems: [
      { id: 'a', title: 'hero', time: '07:00', repeat: 'daily', url: 'https://example.com/a' },
      { id: 'b', title: 'second', time: '09:00', repeat: 'daily', url: 'https://example.com/b' },
    ] });
    const { container } = render(<App5 />);
    expect(has(container, 'select-circle')).toBe(true);
    expect(has(container, 'auto-box')).toBe(true);
  });

  it('the TODAY chip appears — and is anchored — only on another day', () => {
    reset();
    const first = render(<App5 />);
    expect(has(first.container, 'today-chip')).toBe(false);
    cleanup();
    reset({ viewDate: '2099-1-2' });
    const { container } = render(<App5 />);
    expect(has(container, 'today-chip')).toBe(true);
  });

  it('the row the user just added is the one that gets rung', () => {
    reset({
      deckItems: [
        { id: 'a', title: 'first', time: '07:00', repeat: 'daily' },
        { id: 'b', title: 'mine', time: '09:00', repeat: 'daily' },
      ],
      lastAddedId: 'b',
    });
    const { container } = render(<App5 />);
    const row = container.querySelector('[data-tour="latest-item"]');
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('mine');
    // and the time/repeat anchors ride the SAME row, not the hero
    expect(row.querySelector('[data-tour="item-time"]')).toBeTruthy();
    expect(row.querySelector('[data-tour="item-repeat"]')).toBeTruthy();
  });

  it('falls back to the hero when there is no such row', () => {
    reset({ deckItems: [{ id: 'a', title: 'only one', time: '07:00', repeat: 'daily' }], lastAddedId: null });
    const { container } = render(<App5 />);
    const hero = container.querySelector('[data-tour="next-up"]');
    expect(hero.querySelector('[data-tour="item-time"]')).toBeTruthy();
    expect(hero.querySelector('[data-tour="item-repeat"]')).toBeTruthy();
  });

  it('Settings carries the ones Quests 7 and 8 need', () => {
    const { container } = render(<SettingsScreen />);
    for (const name of ['set-theme', 'set-sounds', 'set-reminders', 'set-install', 'set-guide']) {
      expect(has(container, name), 'missing [data-tour="' + name + '"] in Settings').toBe(true);
    }
  });
});

describe('the free cap counts the cards we put there ourselves', () => {
  it('refuses at the cap, and clearing the examples makes room', () => {
    const mine = Array.from({ length: FREE_STACK_CAP - 4 }, (_, i) => ({ id: 'x' + i, title: 'mine ' + i, time: '09:00', repeat: 'daily' }));
    const examples = Array.from({ length: 4 }, (_, i) => ({ id: 'e' + i, title: 'ours ' + i, time: '08:00', repeat: 'daily', example: true }));
    reset({ deckItems: [...examples, ...mine] });
    expect(getState().deckItems).toHaveLength(FREE_STACK_CAP);
    const refused = addCustomUrl('https://open.spotify.com/track/1');
    expect(refused.upsell).toBe(true);
    clearExamples();
    const now = addCustomUrl('https://open.spotify.com/track/1');
    expect(now.ok).toBe(true);
  });
});
