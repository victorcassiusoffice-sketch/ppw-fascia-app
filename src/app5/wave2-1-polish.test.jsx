// Wave 2.1 — what Vic's first five minutes on the real flow surfaced (2026-08-06).
//
// Every one of these was found by a founder using his own app, which is the whole
// argument for guarding them: they are the failures that survive a green test suite.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { setState, getState, finishOnboarding } from './store5.js';
import MembershipCard from './screens/MembershipCard.jsx';
import UpsellModal from './screens/UpsellModal.jsx';

const LS = (k) => 'ppw5.' + k;

/** Seed the exact cache a verified server read leaves behind. */
function seedSession({ role = 'member', entitlement = 'paid', premium = true, periodEnd = null } = {}) {
  localStorage.setItem(LS('authToken'), 'jwt');
  localStorage.setItem(LS('authEmail'), 'buyer@example.com');
  localStorage.setItem(LS('ent'), JSON.stringify({
    premium, entitlement, role, currentPeriodEnd: periodEnd,
    userId: 'usr_1', checkedAt: Date.now(), verified: true,
  }));
  setState({ signedIn: true, premium });
}

function stubEntitlement(body) {
  const spy = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  setState({ signedIn: false, premium: false, justCreated: false, accountOpen: false, accountMode: 'signin', premiumUpsell: null, onboarded: true, termsOk: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

// ── 1 ────────────────────────────────────────────────────────────────────────
describe('"Check membership" always answers', () => {
  // Vic tapped this and NOTHING happened. The message was being set — this card's
  // Premium branch simply never rendered it, so on a Premium account the button
  // was a no-op. He read the app as broken, which was the correct reading.
  it('says so out loud on a Premium account', async () => {
    seedSession({ entitlement: 'paid', periodEnd: '2026-09-03T00:00:00Z' });
    stubEntitlement({ premium: true, entitlement: 'paid', role: 'member', currentPeriodEnd: '2026-09-03T00:00:00Z', userId: 'usr_1' });
    render(<MembershipCard />);
    fireEvent.click(screen.getByText(/check membership/i));
    await waitFor(() => expect(screen.getByText(/checked — premium, active until/i)).toBeTruthy());
  });

  it('says so out loud on a Free account too', async () => {
    seedSession({ role: 'member', entitlement: 'none', premium: false });
    stubEntitlement({ premium: false, entitlement: 'none', role: 'member', userId: 'usr_1' });
    render(<MembershipCard />);
    fireEvent.click(screen.getByText(/check membership/i));
    await waitFor(() => expect(screen.getByText(/checked — you are on the free plan/i)).toBeTruthy());
  });

  it('shows it is working while it works', async () => {
    seedSession({ entitlement: 'paid' });
    let release;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { release = () => r(new Response(JSON.stringify({ premium: true, entitlement: 'paid', role: 'member' }), { status: 200 })); })));
    render(<MembershipCard />);
    fireEvent.click(screen.getByText(/check membership/i));
    await waitFor(() => expect(screen.getByText(/checking…/i)).toBeTruthy());
    release();
  });
});

// ── 2 ────────────────────────────────────────────────────────────────────────
describe('the founder’s own Premium is named as staff access', () => {
  // ADMIN_EMAILS promotes an address to role:admin/paid on every login, and the
  // entitlement endpoint computes premium from role. Vic's account is on that
  // list, so his view showed Premium with no payment — indistinguishable from a
  // billing bug, to the one person testing billing. The backend already returns
  // `role`, so this needed no backend change.
  it('says Premium is on because of the staff list, not a payment', () => {
    seedSession({ role: 'admin', entitlement: 'none', premium: true });
    render(<MembershipCard />);
    expect(screen.getByText(/premium \(admin account\)/i)).toBeTruthy();
    expect(screen.getByText(/not because a payment was found/i)).toBeTruthy();
  });

  it('stays quiet for a real paying customer', () => {
    seedSession({ role: 'member', entitlement: 'paid', premium: true });
    render(<MembershipCard />);
    expect(screen.queryByText(/admin account/i)).toBeNull();
  });

  it('stays quiet for an admin who has genuinely paid', () => {
    seedSession({ role: 'admin', entitlement: 'paid', premium: true });
    render(<MembershipCard />);
    expect(screen.queryByText(/admin account/i)).toBeNull();
  });
});

// ── 3 ────────────────────────────────────────────────────────────────────────
describe('a wrong password says so where you can see it', () => {
  // The message existed and was right. It rendered at the FOOT of a scrolling
  // card, below the buttons and the notes — off the bottom of Vic's phone. An
  // error the user cannot see is an error that does not exist.
  it('puts the error directly under the password field, above the button', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 })));
    const { container } = render(<MembershipCard />);
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/don.t match/i);

    // Position, not just presence: it must sit between the field and the button.
    const nodes = [...container.querySelectorAll('*')];
    const field = screen.getByLabelText(/^password$/i);
    const button = screen.getByRole('button', { name: /^sign in$/i });
    expect(nodes.indexOf(field)).toBeLessThan(nodes.indexOf(alert));
    expect(nodes.indexOf(alert)).toBeLessThan(nodes.indexOf(button));
  });

  it('marks the field itself as wrong', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 })));
    render(<MembershipCard />);
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/^password$/i).style.borderColor).toMatch(/c05|bad/);
  });
});

// ── 4 ────────────────────────────────────────────────────────────────────────
describe('the Premium panel is readable', () => {
  // It was the only surface in the app painted in solid accent with white body
  // text. Accent is a rim and a glow, never opaque paint (liquid-glass law).
  it('is the same glass card as its siblings, not a slab of accent paint', () => {
    seedSession({ entitlement: 'paid' });
    const { container } = render(<MembershipCard />);
    const card = container.firstChild;
    expect(card.style.background).toContain('var(--surface)');
    expect(card.style.background).not.toContain('acc-surf');
    expect(card.style.boxShadow).toContain('acc-glow'); // premium still reads as premium
  });

  it('writes in the app’s ordinary ink, not white-on-orange', () => {
    seedSession({ entitlement: 'paid' });
    render(<MembershipCard />);
    const email = screen.getByText('buyer@example.com');
    expect(email.style.color).toBe('var(--dim)');
  });
});

// ── 6 ────────────────────────────────────────────────────────────────────────
describe('one thing at a time after signing in', () => {
  // Vic met the account sheet, the terms screen and the Premium upsell in the
  // same few seconds.
  it('holds the upsell back while setup is unfinished', () => {
    setState({ onboarded: false, premiumUpsell: 'Routines are Premium.' });
    render(<UpsellModal />);
    expect(screen.queryByText(/premium feature/i)).toBeNull();
  });

  it('holds the upsell back while the account screen is open', () => {
    setState({ onboarded: true, accountOpen: true, premiumUpsell: 'Routines are Premium.' });
    render(<UpsellModal />);
    expect(screen.queryByText(/premium feature/i)).toBeNull();
  });

  it('does not DROP it — it arrives on the next beat', () => {
    setState({ onboarded: true, accountOpen: true, premiumUpsell: 'Routines are Premium.' });
    const { rerender } = render(<UpsellModal />);
    expect(screen.queryByText(/premium feature/i)).toBeNull();
    setState({ accountOpen: false });
    rerender(<UpsellModal />);
    expect(screen.getByText(/premium feature/i)).toBeTruthy();
    expect(getState().premiumUpsell).toBeTruthy();
  });

  it('the account moment waits for the consent screen to be done', () => {
    setState({ onboarded: false, justCreated: true, accountOpen: false, termsOk: true });
    expect(getState().accountOpen).toBe(false);   // held back during setup
    finishOnboarding();
    expect(getState().accountOpen).toBe(true);    // and lands once setup is finished
  });
});
