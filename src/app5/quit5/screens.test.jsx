// THE QUIT SURFACE, ON SCREEN.
//
// surface.test.js proves the store slice and the derived item. This file is
// about the part only a rendered screen can be wrong about, and all four of
// these have gone wrong in this repo before on other features:
//
//   1. THE REMINDER IS ACTUALLY MOUNTED ON THE STACK. A card nothing renders is
//      the whole of Vic's ask ("then it reminds them there allowance per, day")
//      left unbuilt, and a store test cannot tell the difference.
//   2. THE THREE HONESTY LINES ARE ON SCREEN. plan.js can prove the WORDS
//      exist; only a render can prove anybody is shown them. HELP_LINE is the
//      one that points at a pharmacist or doctor and names nicotine
//      replacement; METHOD_NOTE is the one that stops the app implying
//      tapering is the recommended route.
//   3. GOING OVER STAYS NEUTRAL IN THE PIXELS. The engine guarantees the
//      arithmetic and the wording; a screen can still undo both with a red
//      number or a broken streak. `status.over` is a layout flag, not a cue to
//      paint a failure.
//   4. SETUP IS THREE TAPS. Defaults that already make a sensible plan, so the
//      person opens the sheet and presses one button.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// `?demo=1` BEFORE the hoisted imports: initialState() reads the URL on import,
// and this is how the Stack screen can be rendered at all without a partner
// code or the first-run doors in the way. Nothing in a demo load is written to
// the device (surface.test.js pins that), so a plan set up here lives only in
// this process.
vi.hoisted(() => {
  try { window.history.replaceState({}, '', '/?demo=1'); } catch { /* no jsdom history */ }
});

import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import App5 from '../App5.jsx';
import QuitCard from './QuitCard.jsx';
import QuitSetupSheet from './QuitSetupSheet.jsx';
import SettingsScreen from '../screens/SettingsScreen.jsx';
import { DISCLAIMER, HELP_LINE, METHOD_NOTE } from './plan.js';
import {
  getState, setState, startQuitPlan, clearQuitPlan, logOneSmoked, quitStatus, QUIT_SLOT_TITLE,
  dateKeyFromOffset,
} from '../store5.js';

/** Everything a card renders, as a person would read it. */
const words = (el) => el.textContent.replace(/\s+/g, ' ');

/** Any element in this tree painted with the app's error colour. */
function errorColoured(root) {
  return [...root.querySelectorAll('*')].filter((n) => /--bad|\bred\b|#f00/i.test(n.style.color || ''));
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollTo = () => {};
  window.scrollTo = () => {};
  setState({ viewDate: null, quitOpen: false, screen: 'stack', reminders: true });
  clearQuitPlan();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('the reminder on the Stack', () => {
  it('is not there before a plan exists', () => {
    const { container } = render(<QuitCard />);
    expect(container.firstChild).toBe(null);
  });

  it('says what today allows and how many are left', () => {
    startQuitPlan({ from: 8, to: 0, days: 8 });
    logOneSmoked();
    logOneSmoked();
    const { container } = render(<QuitCard />);
    expect(words(container)).toMatch(/6 left of today/);
    expect(words(container)).toMatch(/Day 1 of 8/);
  });

  it('is mounted on the Stack screen itself, not just available to be', async () => {
    startQuitPlan({ from: 12, to: 0, days: 14 });
    await act(async () => { render(<App5 />); });
    // The discreet title, and the day's own numbers next to it.
    expect(screen.getByText(QUIT_SLOT_TITLE)).toBeTruthy();
    expect(screen.getByText(/12 left of today/)).toBeTruthy();
  });

  // The render gate: a green build and a passing unit test are not proof a
  // screen mounts. This app has white-screened once already, and the card is
  // being added to the one screen every customer opens first.
  it('mounts the whole app with a plan on it, and nothing shouts in the console', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    startQuitPlan({ from: 20, to: 0, days: 28 });
    const { container } = await act(async () => render(<App5 />));
    expect(container.querySelector('div')).toBeTruthy();
    expect(screen.getByText(/20 left of today/)).toBeTruthy();
    expect(err).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    err.mockRestore(); warn.mockRestore();
  });

  it('goes from the Stack the moment the plan is deleted', async () => {
    startQuitPlan({ from: 12, to: 0, days: 14 });
    await act(async () => { render(<App5 />); });
    expect(screen.getByText(QUIT_SLOT_TITLE)).toBeTruthy();

    await act(async () => { clearQuitPlan(); });
    expect(screen.queryByText(QUIT_SLOT_TITLE)).toBeNull();
    expect(screen.queryByText(/left of today/)).toBeNull();
  });

  it('says nothing on a day before the plan began', () => {
    startQuitPlan({ from: 8, to: 0, days: 8 });
    // The Stack can be opened on any date from the Calendar. A day the plan
    // never covered must not show an allowance the person could read as one
    // they had and overspent. dateKeyFromOffset, not a typed date: the app's
    // keys are unpadded ('2026-10-4') and a literal would prove nothing.
    setState({ viewDate: dateKeyFromOffset(-1) });
    const { container, unmount } = render(<QuitCard />);
    expect(container.firstChild).toBe(null);
    unmount();

    setState({ viewDate: dateKeyFromOffset(0) });   // the day it started
    const { container: today } = render(<QuitCard />);
    expect(today.firstChild).not.toBe(null);
  });

  it('shows the three honesty lines where the person actually reads them', () => {
    startQuitPlan({ from: 8, to: 0, days: 8 });
    const { container } = render(<QuitCard />);
    const t = words(container);
    expect(t).toContain(DISCLAIMER);
    expect(t).toContain(METHOD_NOTE);
    expect(t).toContain(HELP_LINE);
  });
});

describe('logging one, on the card', () => {
  it('takes one off with a single tap, and says the new number', () => {
    startQuitPlan({ from: 8, to: 0, days: 8 });
    const { container } = render(<QuitCard />);
    expect(words(container)).toMatch(/8 left of today/);

    fireEvent.click(screen.getByRole('button', { name: /log one/i }));
    expect(words(container)).toMatch(/7 left of today/);
    expect(quitStatus().smoked).toBe(1);
  });

  it('gives the tap that was an accident straight back', () => {
    startQuitPlan({ from: 8, to: 0, days: 8 });
    const { container } = render(<QuitCard />);
    fireEvent.click(screen.getByRole('button', { name: /log one/i }));
    fireEvent.click(screen.getByRole('button', { name: /take one back/i }));
    expect(words(container)).toMatch(/8 left of today/);
    expect(quitStatus().smoked).toBe(0);
  });

  it('is a one-handed target — the app own 48px floor, outdoors, in the moment', () => {
    startQuitPlan({ from: 8, to: 0, days: 8 });
    render(<QuitCard />);
    const log = screen.getByRole('button', { name: /log one/i });
    expect(parseFloat(log.style.minHeight)).toBeGreaterThanOrEqual(48);
  });

  it('reports a day over the number without painting it as a failure', () => {
    startQuitPlan({ from: 2, to: 0, days: 6 });
    const { container } = render(<QuitCard />);
    fireEvent.click(screen.getByRole('button', { name: /log one/i }));
    fireEvent.click(screen.getByRole('button', { name: /log one/i }));
    fireEvent.click(screen.getByRole('button', { name: /log one/i }));

    const t = words(container);
    expect(quitStatus().over).toBe(true);
    expect(t).toMatch(/1 more than today/);
    expect(t).toMatch(/unchanged/);          // tomorrow has not moved, said out loud
    expect(t).not.toMatch(/fail|streak|sorry|slip|lapse|relapse|should/i);
    // And nothing on the card is painted with the error colour.
    expect(errorColoured(container)).toHaveLength(0);
    // Still here tomorrow: logging over does not take the card away.
    expect(screen.getByRole('button', { name: /log one/i })).toBeTruthy();
  });
});

describe('setting the plan up', () => {
  it('is not on screen until it is asked for', () => {
    const { container } = render(<QuitSetupSheet />);
    expect(container.firstChild).toBe(null);
  });

  it('opens already filled in, so it takes one more tap to start', () => {
    setState({ quitOpen: true });
    render(<QuitSetupSheet />);
    expect(Number(screen.getByLabelText(/how many a day now/i).value)).toBeGreaterThan(0);
    expect(screen.getByLabelText(/heading for/i).value).toBe('0');
    expect(Number(screen.getByLabelText(/how many days/i).value)).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: /start the plan/i }));
    expect(getState().quitPlan).toBeTruthy();
    expect(getState().quitOpen).toBe(false);
    expect(quitStatus().allowance).toBeGreaterThan(0);
  });

  it('takes the numbers the person typed', () => {
    setState({ quitOpen: true });
    render(<QuitSetupSheet />);
    fireEvent.change(screen.getByLabelText(/how many a day now/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/heading for/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/how many days/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /start the plan/i }));

    expect(getState().quitPlan).toMatchObject({ from: 15, to: 5, days: 10 });
    expect(quitStatus().allowance).toBe(15);
  });

  it('says in plain words why a plan it cannot build was refused, and keeps the sheet up', () => {
    setState({ quitOpen: true });
    render(<QuitSetupSheet />);
    fireEvent.change(screen.getByLabelText(/how many a day now/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/heading for/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /start the plan/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/higher than/i);
    expect(getState().quitPlan).toBe(null);
    expect(getState().quitOpen).toBe(true);
  });

  it('shows the three honesty lines before anyone commits to anything', () => {
    setState({ quitOpen: true });
    const { container } = render(<QuitSetupSheet />);
    const t = words(container);
    expect(t).toContain(DISCLAIMER);
    expect(t).toContain(METHOD_NOTE);
    expect(t).toContain(HELP_LINE);
  });

  it('ends the plan only through a control that says that is what it does', () => {
    startQuitPlan({ from: 8, to: 0, days: 8 });
    logOneSmoked();
    setState({ quitOpen: true });
    render(<QuitSetupSheet />);

    // Tapping the backdrop is not a decision — the 2026-10-05 lesson, where a
    // stray tap on a dim backdrop destroyed a six-week prescription.
    fireEvent.click(screen.getByLabelText(/close/i));
    expect(getState().quitPlan).toBeTruthy();
    expect(quitStatus().smoked).toBe(1);

    // Nor is one tap on a quiet grey line. Deleting takes every logged day with
    // it, so it says so and then asks again. (act(), because this reopen comes
    // from outside React and the external store has to flush before the query.)
    act(() => { setState({ quitOpen: true }); });
    fireEvent.click(screen.getByRole('button', { name: /delete this plan/i }));
    expect(getState().quitPlan).toBeTruthy();
    expect(screen.getByText(/deletes every day you have logged/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^delete it$/i }));
    expect(getState().quitPlan).toBe(null);
    // Deliberately NOT asserting the localStorage key here: this file boots
    // under ?demo=1 (see the hoisted block at the top), where nothing is ever
    // written, so that assertion would pass whatever the delete did. The disk
    // is proven in surface.test.js, on a real load.
  });

  it('is reachable from Settings, next to the other daily rhythm', () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByRole('button', { name: /cutting down/i }));
    expect(getState().quitOpen).toBe(true);
  });
});
