// The lock screen keypad (2026-08-06).
//
// The first version read the entered digits out of a closure, so taps landing in
// the same frame overwrote each other: press 4-8-2-1 quickly and the screen had
// "1". Found by driving the keypad in a real browser. On a phone it would have
// shown up as an occasional "wrong passcode" for the RIGHT passcode — a fault
// nobody can reproduce on demand and everybody blames on themselves.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';

const unlockPasscode = vi.fn(async () => 'the-session');
let lockedNow = true;
let notify = null;

// Partial mock: the real module stays in place (membership.js reads isEnabled /
// passcodeToken from it), and only the three things this screen drives are faked.
vi.mock('./passcode.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    unlockPasscode: (...a) => unlockPasscode(...a),
    isLocked: () => lockedNow,
    onPasscodeState: (cb) => { notify = cb; cb({ enabled: true, locked: lockedNow }); return () => { notify = null; }; },
  };
});

import LockScreen from './screens/LockScreen.jsx';

const tap = (d) => fireEvent.click(screen.getByLabelText(d));

beforeEach(() => { cleanup(); unlockPasscode.mockClear(); lockedNow = true; });

describe('the keypad', () => {
  it('sends all four digits even when they are tapped in one burst', async () => {
    render(<LockScreen />);
    // No awaits between taps — this is the exact case that used to lose digits.
    tap('4'); tap('8'); tap('2'); tap('1');
    await waitFor(() => expect(unlockPasscode).toHaveBeenCalled());
    expect(unlockPasscode).toHaveBeenCalledWith('4821');
  });

  it('does not try until four digits are in', () => {
    render(<LockScreen />);
    tap('4'); tap('8'); tap('2');
    expect(unlockPasscode).not.toHaveBeenCalled();
  });

  it('delete takes the last digit back off', async () => {
    render(<LockScreen />);
    tap('4'); tap('8'); tap('9'); tap('Delete'); tap('2'); tap('1');
    await waitFor(() => expect(unlockPasscode).toHaveBeenCalled());
    expect(unlockPasscode).toHaveBeenCalledWith('4821');
  });

  it('a wrong passcode says so and clears the dots to try again', async () => {
    unlockPasscode.mockRejectedValueOnce(new Error('Wrong passcode. 9 tries left before you have to sign in again.'));
    render(<LockScreen />);
    tap('1'); tap('2'); tap('3'); tap('4');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/9 tries left/);

    // and the next attempt starts clean rather than appending to the failed one
    tap('4'); tap('8'); tap('2'); tap('1');
    await waitFor(() => expect(unlockPasscode).toHaveBeenCalledTimes(2));
    expect(unlockPasscode).toHaveBeenLastCalledWith('4821');
  });
});

describe('what the lock screen is honest about', () => {
  it('says plainly what the passcode is worth', () => {
    render(<LockScreen />);
    expect(screen.getByText(/not a bank vault/i)).toBeTruthy();
  });

  it('offers a way back in for someone who has forgotten it', () => {
    render(<LockScreen />);
    expect(screen.getByText(/forgotten it\? sign in instead/i)).toBeTruthy();
  });

  it('renders nothing at all when there is no lock', () => {
    lockedNow = false;
    const { container } = render(<LockScreen />);
    expect(container.firstChild).toBeNull();
  });
});
