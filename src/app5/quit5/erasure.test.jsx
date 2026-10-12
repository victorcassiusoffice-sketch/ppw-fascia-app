// "DELETE MY DATA" HAS TO MEAN THIS DATA TOO.
//
// What the app actually had, read rather than assumed (membership.js
// deleteAccount + screens/AccountSheet.jsx): "Delete my account" calls
// DELETE /api/me/data and signs out. signOut() drops the auth keys — token,
// email, the cached entitlement, the passcode vault — and NOTHING else. The
// confirm step says so in its own words: "The stacks saved on this device stay
// on this device." So the app's only delete path is SERVER-side, by design.
//
// That design is defensible for a day of stretches. It is not defensible for a
// record of how much somebody smokes. Of everything this app holds, the quit
// plan is the one entry that could embarrass or harm its owner if the next
// person to pick up the phone found it, and leaving it behind after the owner
// had asked to be deleted would be exactly the wrong half of the promise to
// keep. So the quit plan goes with the account, the confirm step says that out
// loud, and these tests hold both halves — the deletion, and the sentence.
//
// NOT IN SCOPE, AND FLAGGED RATHER THAN QUIETLY FIXED: the rest of the `ppw5.`
// namespace (stacks, affirmations, prefs, the guide) still survives account
// deletion, as the copy has always said. Widening that is a product decision
// about an existing shipped promise, not a side effect of adding a feature.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { getState, setState, startQuitPlan, clearQuitPlan, logOneSmoked } from '../store5.js';
import { isSignedIn } from '../membership.js';
import AccountSheet from '../screens/AccountSheet.jsx';

const LS = (k) => 'ppw5.' + k;

/** A signed-in owner with a plan and a logged day, as it sits on disk. */
function ownerWithAPlan() {
  localStorage.setItem(LS('authToken'), 'jwt');
  localStorage.setItem(LS('authEmail'), 'buyer@example.com');
  setState({ accountOpen: true, signedIn: true, premium: false });
  startQuitPlan({ from: 20, to: 0, days: 28 });
  logOneSmoked();
}

/** A fetch that accepts the DELETE and answers the entitlement poll. */
function serverAccepts() {
  const spy = vi.fn(async (url, opts) => {
    if (opts?.method === 'DELETE') return new Response(JSON.stringify({ deleted: true }), { status: 200 });
    return new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 });
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  setState({ accountOpen: false, signedIn: false, premium: false });
  clearQuitPlan();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('deleting the account takes the quit plan with it', () => {
  it('leaves nothing about smoking on the device', async () => {
    ownerWithAPlan();
    expect(localStorage.getItem(LS('quit'))).toBeTruthy();
    serverAccepts();

    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/delete my account/i));
    fireEvent.click(screen.getByText(/delete for good/i));

    await waitFor(() => expect(isSignedIn()).toBe(false));
    expect(getState().quitPlan).toBe(null);
    expect(localStorage.getItem(LS('quit'))).toBe(null);
    expect(localStorage.getItem(LS('quitAt'))).toBe(null);
  });

  it('says so before it happens, in the confirm step', () => {
    ownerWithAPlan();
    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/delete my account/i));
    // The existing sentence about device data is still true of the stacks …
    expect(screen.getByText(/stacks saved on this device stay on this device/i)).toBeTruthy();
    // … and the exception is named rather than left for someone to discover.
    expect(screen.getByText(/cutting-down plan is deleted with it/i)).toBeTruthy();
  });

  it('backing out of the delete keeps the plan and the logged day', () => {
    ownerWithAPlan();
    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/delete my account/i));
    fireEvent.click(screen.getByText(/keep it/i));
    expect(getState().quitPlan).toMatchObject({ from: 20, to: 0 });
    expect(localStorage.getItem(LS('quit'))).toBeTruthy();
  });

  it('keeps the plan when the server refuses the delete', async () => {
    ownerWithAPlan();
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      if (opts?.method === 'DELETE') return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
      return new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 });
    }));

    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/delete my account/i));
    fireEvent.click(screen.getByText(/delete for good/i));

    // The account survived, so the plan must too — erasing the person's own
    // record for a delete that never happened would be a data loss with no
    // deletion to show for it.
    await waitFor(() => expect(screen.getByText(/server error|could not delete/i)).toBeTruthy());
    expect(isSignedIn()).toBe(true);
    expect(getState().quitPlan).toMatchObject({ from: 20, to: 0 });
    expect(localStorage.getItem(LS('quit'))).toBeTruthy();
  });

  it('signing out is not a delete — the plan is still there to come back to', () => {
    ownerWithAPlan();
    render(<AccountSheet />);
    fireEvent.click(screen.getByText(/^sign out$/i));
    expect(getState().quitPlan).toMatchObject({ from: 20, to: 0 });
    expect(localStorage.getItem(LS('quit'))).toBeTruthy();
  });
});
