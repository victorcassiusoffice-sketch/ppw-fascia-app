// Two live defects found by the Tier 2 architecture audit (2026-09-19), neither
// of which had any coverage at all.
//
//  1. THE SLOT ENGINE DROPPED STACKS. `stackFor(key).find((x) => x.time === hm)`
//     is singular, and the id it found was then memoised for the rest of the
//     minute. Two stacks sharing a time — a medicine taken with food and the
//     stretch after it — meant only the first in insertion order ever fired. Not
//     late. Never, on any day.
//
//  2. DOCUMENT BLOBS WERE IMMORTAL. files5.js exported saveFile and fileUrl and
//     nothing else, so deleting a Document stack left its file in IndexedDB for
//     good — dead weight, and no way for a user to erase a document.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./files5.js', () => ({
  saveFile: vi.fn(async () => 'f-new'),
  fileUrl: vi.fn(async () => null),
  deleteFile: vi.fn(async () => {}),
}));

async function freshStore() {
  vi.resetModules();
  return await import('./store5.js');
}

const AT_0800 = () => new Date(2026, 8, 19, 8, 0, 5);
const TICK = 20000; // startSlotEngine's setInterval

// vi.mock's factory result is cached across resetModules(), so call history
// survives into the next test unless it is explicitly cleared.
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe('slot engine — two stacks can share a time', () => {
  it('fires the SECOND stack too, instead of dropping it forever', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0800());
    const s = await freshStore();
    s.setState({
      deckItems: [
        { id: 'a', title: 'Take it with food', time: '08:00', repeat: 'daily' },
        { id: 'b', title: 'Shoulder stretch', time: '08:00', repeat: 'daily' },
      ],
      reminders: true, slotPop: null, notePop: null, playerItem: null, doneByDate: {},
    });
    s.startSlotEngine();

    vi.advanceTimersByTime(TICK);
    expect(s.getState().slotPop?.id).toBe('a');

    s.dismissSlotPop();
    vi.advanceTimersByTime(TICK);
    // Before the fix this was null: .find() returned 'a' again and the one-slot
    // memo swallowed it, so 'b' was unreachable.
    expect(s.getState().slotPop?.id).toBe('b');
  });

  it('does not stomp a popup the user has not dealt with yet', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0800());
    const s = await freshStore();
    s.setState({
      deckItems: [
        { id: 'a', title: 'First', time: '08:00', repeat: 'daily' },
        { id: 'b', title: 'Second', time: '08:00', repeat: 'daily' },
      ],
      reminders: true, slotPop: null, notePop: null, playerItem: null, doneByDate: {},
    });
    s.startSlotEngine();

    vi.advanceTimersByTime(TICK);
    expect(s.getState().slotPop?.id).toBe('a');

    vi.advanceTimersByTime(TICK); // still undismissed
    expect(s.getState().slotPop?.id).toBe('a');
  });

  it('never fires the same stack twice inside one minute', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0800());
    const s = await freshStore();
    s.setState({
      deckItems: [{ id: 'solo', title: 'Only one', time: '08:00', repeat: 'daily' }],
      reminders: true, slotPop: null, notePop: null, playerItem: null, doneByDate: {},
    });
    s.startSlotEngine();

    vi.advanceTimersByTime(TICK);
    expect(s.getState().slotPop?.id).toBe('solo');

    s.dismissSlotPop();
    vi.advanceTimersByTime(TICK); // same minute — it already had its turn
    expect(s.getState().slotPop).toBeNull();
  });

  it('stays quiet when nothing is due', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT_0800());
    const s = await freshStore();
    s.setState({
      deckItems: [{ id: 'later', title: 'This evening', time: '19:00', repeat: 'daily' }],
      reminders: true, slotPop: null, notePop: null, playerItem: null, doneByDate: {},
    });
    s.startSlotEngine();
    vi.advanceTimersByTime(TICK);
    expect(s.getState().slotPop).toBeNull();
  });
});

describe('deleting a Document stack frees its file', () => {
  it('erases the blob when the last stack referencing it goes', async () => {
    const s = await freshStore();
    const files = await import('./files5.js');
    s.setState({
      deckItems: [{ id: 'd1', title: 'Scan.pdf', kind: 'doc', fileId: 'f1' }],
      selectedIds: [], doneByDate: {},
    });

    s.deleteItem('d1');

    expect(files.deleteFile).toHaveBeenCalledWith('f1');
  });

  it('keeps the blob while another stack still points at it', async () => {
    const s = await freshStore();
    const files = await import('./files5.js');
    s.setState({
      deckItems: [
        { id: 'd1', title: 'Scan.pdf', kind: 'doc', fileId: 'f1' },
        { id: 'd2', title: 'Scan.pdf', kind: 'doc', fileId: 'f1' },
      ],
      selectedIds: [], doneByDate: {},
    });

    s.deleteItem('d1');

    expect(files.deleteFile).not.toHaveBeenCalled();
  });

  it('does not reach for a file on an ordinary stack', async () => {
    const s = await freshStore();
    const files = await import('./files5.js');
    s.setState({
      deckItems: [{ id: 'x', title: 'Morning walk', time: '07:30' }],
      selectedIds: [], doneByDate: {},
    });

    s.deleteItem('x');

    expect(files.deleteFile).not.toHaveBeenCalled();
    expect(s.getState().deckItems).toHaveLength(0);
  });
});
