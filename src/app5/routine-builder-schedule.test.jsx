// Authoring a schedule in the Routine builder (2026-10-05, review pass).
//
// The defect these tests pin: the wire format carried `repeat` and `dayOffset`,
// the codec transmitted both, and the receive sheet printed both — but the
// builder, the only place a practitioner creates a routine by hand, had no
// control for either. Every routine built in the app therefore left the phone
// as a flat list of day-0 one-offs, and the only way to author a real six-week
// programme was to hand-write a ```ppw-routine``` block in a .md file and
// import it. The feature exists to send a prescription; it could not carry one.
//
// So these are the practitioner's story end to end: build the programme in the
// builder, save it, tap the share disc, and read the link back through the real
// parser — the schedule that arrives must be the schedule that was entered.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'motion/react';
import LibraryScreen from './screens/LibraryScreen.jsx';
import { setState, getState, applyServerEntitlement, setTab, parseRoutineLink, SHARE_MAX_OFFSET } from './store5.js';

// The Library pulls the bundled protocol manifest on mount regardless of tab.
function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ protocols: [] }) })));
}
function withNavigator(props) {
  for (const [k, v] of Object.entries(props)) {
    Object.defineProperty(navigator, k, { value: v, configurable: true, writable: true });
  }
}

function openBuilder({ routines = [] } = {}) {
  stubFetch();
  applyServerEntitlement({ premium: true });
  setTab('routines');
  setState({ routines });
  render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);
}

// Add one staged stack the way a practitioner does: the Text tile, then Enter.
// (Enter rather than the "Add" button because the builder has two of those —
// the text panel's and the paste-a-link one.)
function stageText(title) {
  // The tile TOGGLES its panel, so only open it when it is not already open.
  if (!screen.queryByLabelText('Text for this routine')) fireEvent.click(screen.getByText('Text'));
  const input = screen.getByLabelText('Text for this routine');
  fireEvent.change(input, { target: { value: title } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

// Open one staged row's schedule, set the two things the wire format carries,
// close it again. Progressive disclosure: only one row is open at a time, so
// the day field and the repeat options are unambiguous while it is.
function schedule(title, { day, repeat }) {
  const row = screen.getByLabelText('Schedule for ' + title);
  fireEvent.click(row);
  if (day !== undefined) {
    fireEvent.change(screen.getByLabelText('Starts on day'), { target: { value: String(day) } });
  }
  if (repeat !== undefined) fireEvent.click(screen.getByText(repeat));
  fireEvent.click(row);
}

function saveRoutine() {
  fireEvent.click(screen.getByText(/Save routine/));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const k of ['share', 'canShare', 'clipboard']) { if (k in navigator) delete navigator[k]; }
});

describe('a practitioner can build a six-week programme and send it', () => {
  it('the schedule entered in the builder is the schedule that arrives', async () => {
    const written = [];
    withNavigator({ clipboard: { writeText: vi.fn(async (t) => { written.push(t); }) } });

    openBuilder();
    fireEvent.click(screen.getByText('Create Routine'));
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Shoulder rehab — weeks 1-6' } });

    // Six weekly blocks, one per week, the shape of a real course of treatment.
    // Week 6 lands on day 35 — past the AI bridge's old 27-day ceiling, which is
    // exactly the programme this feature exists for.
    const weeks = [
      ['Week 1 — pendulum swings', 0],
      ['Week 2 — wall slides', 7],
      ['Week 3 — scapular setting', 14],
      ['Week 4 — band external rotation', 21],
      ['Week 5 — isometric press', 28],
      ['Week 6 — review with the clinic', 35],
    ];
    for (const [title] of weeks) stageText(title);
    for (const [title, day] of weeks) schedule(title, { day, repeat: 'Weekly' });

    saveRoutine();

    // On disk first: `dayOffset` is the public key, and an offset of 0 is
    // omitted rather than stored as noise (store5's naming law).
    const saved = getState().routines[0];
    expect(saved.name).toBe('Shoulder rehab — weeks 1-6');
    expect(saved.items.map((it) => it.dayOffset)).toEqual([undefined, 7, 14, 21, 28, 35]);
    expect(saved.items.map((it) => it.repeat)).toEqual(['weekly', 'weekly', 'weekly', 'weekly', 'weekly', 'weekly']);

    // Then the client's side of the same link, through the real parser.
    fireEvent.click(screen.getByLabelText('Share routine'));
    await waitFor(() => expect(written.length).toBe(1));

    const got = parseRoutineLink(written[0]);
    expect(got.ok).toBe(true);
    expect(got.name).toBe('Shoulder rehab — weeks 1-6');
    expect(got.items.map((it) => it.title)).toEqual(weeks.map(([t]) => t));
    expect(got.items.map((it) => it._day)).toEqual([0, 7, 14, 21, 28, 35]);
    expect(got.items.map((it) => it.repeat)).toEqual(['weekly', 'weekly', 'weekly', 'weekly', 'weekly', 'weekly']);
  });

  it('every repeat the format carries can be chosen, including "every N days"', async () => {
    const written = [];
    withNavigator({ clipboard: { writeText: vi.fn(async (t) => { written.push(t); }) } });

    openBuilder();
    fireEvent.click(screen.getByText('Create Routine'));
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Mixed cadences' } });

    stageText('Breathing');
    stageText('Hip mobility');
    stageText('Heavy carry');
    stageText('Discharge review');

    schedule('Breathing', { repeat: 'Every day' });
    schedule('Hip mobility', { repeat: 'Weekly' });
    // "Every few days" opens the gap stepper — three days is its default, and
    // one tap on More days makes it four.
    const carry = screen.getByLabelText('Schedule for Heavy carry');
    fireEvent.click(carry);
    fireEvent.click(screen.getByText('Every few days'));
    fireEvent.click(screen.getByLabelText('More days'));
    fireEvent.click(carry);
    schedule('Discharge review', { day: 41, repeat: 'Just once' });

    saveRoutine();
    fireEvent.click(screen.getByLabelText('Share routine'));
    await waitFor(() => expect(written.length).toBe(1));

    const got = parseRoutineLink(written[0]);
    expect(got.items.map((it) => it.repeat)).toEqual(['daily', 'weekly', '4', 'once']);
    expect(got.items.map((it) => it._day)).toEqual([0, 0, 0, 41]);
  });

  it('the row says what the recipient will be shown, before it is opened', () => {
    openBuilder();
    fireEvent.click(screen.getByText('Create Routine'));
    stageText('Pendulum swings');

    // Untouched, a staged stack is day 0 / "Just once" — because `repeat`
    // undefined is read as 'once' on BOTH import paths, which is what the
    // receive sheet prints. If the builder said "Every day" here it would be
    // promising a recurrence that never arrives.
    expect(screen.getByText('Day 0 · Just once')).toBeTruthy();

    schedule('Pendulum swings', { day: 7, repeat: 'Every day' });
    expect(screen.getByText('Day 7 · Every day')).toBeTruthy();
  });

  it('the day field stops at the share ceiling instead of wrapping or clamping silently', () => {
    openBuilder();
    fireEvent.click(screen.getByText('Create Routine'));
    stageText('Long horizon');

    const row = screen.getByLabelText('Schedule for Long horizon');
    fireEvent.click(row);
    const day = screen.getByLabelText('Starts on day');

    fireEvent.change(day, { target: { value: '9999' } });
    expect(screen.getByText('Day ' + SHARE_MAX_OFFSET + ' · Just once')).toBeTruthy();
    // At the ceiling the + control is spent, not a no-op that looks live.
    expect(screen.getByLabelText('Later day').disabled).toBe(true);

    fireEvent.change(day, { target: { value: '-4' } });
    expect(screen.getByText('Day 0 · Just once')).toBeTruthy();
    expect(screen.getByLabelText('Earlier day').disabled).toBe(true);
  });

  it('opening a saved routine shows the schedule it was saved with', () => {
    openBuilder({
      routines: [{
        id: 'rt_1',
        name: 'Knee programme',
        items: [
          { title: 'Quad sets', repeat: 'daily' },
          { title: 'Step downs', repeat: 'weekly', dayOffset: 14 },
        ],
      }],
    });

    fireEvent.click(screen.getByText('Knee programme'));
    expect(screen.getByText('Day 0 · Every day')).toBeTruthy();
    expect(screen.getByText('Day 14 · Weekly')).toBeTruthy();
  });
});
