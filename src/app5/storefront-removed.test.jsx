// THE STOREFRONT IS GONE (Vic, 2026-10-08: "We need to remove the go premium").
//
// The app is behind an access code with a confidentiality agreement now. Nobody
// reaching it is a shopper, so there is nothing to sell them — and a build that
// still carries a price, a checkout button and a "Free plan" label is a build
// where one careless edit puts the shop window back.
//
// This file is the fence. It covers two different things, deliberately:
//
//   1. WHAT A PERSON SEES. Rendered assertions: no price, no checkout control,
//      no tier label, and a membership card that tells the truth to each of the
//      three people who can read it — a guest, a signed-in non-payer, and the
//      one real Gumroad subscriber from 2026-07-31.
//
//   2. WHAT IS IN THE TREE. Source scans, because `PREMIUM_OPEN` only makes the
//      selling UI UNREACHABLE. Unreachable is not removed: the next person to
//      touch a gate could render it again without noticing, and the review that
//      caught it would have to be a human one. A grep that fails the build is
//      cheaper. Comments count — a price left in a comment is how the price
//      comes back.
//
// Its twin is premium-gates.test.jsx, which forces PREMIUM_OPEN false and proves
// the paid TIER can still return. Removing the shop is not removing the tier:
// there is a live subscription out there, so applyServerEntitlement /
// fetchEntitlement / cachedPremium / premiumPaid all stay, and so does the
// refusal notice a flipped switch would need.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ── THE PAID BUILD, ON DEMAND ───────────────────────────────────────────────
// Same getter the sibling test files use. A test that needs a REFUSAL to look at
// flips the switch back; everything else runs the app exactly as it ships. Both
// builds are checked for a storefront, because "it is unreachable anyway" is the
// claim this file exists to stop anyone making.
vi.mock('./membership.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get PREMIUM_OPEN() { return globalThis.__ppwPaidBuild !== true; },
}));
const paidBuild = () => { globalThis.__ppwPaidBuild = true; };

import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'motion/react';
import { setState, getState, applyServerEntitlement, setTab } from './store5.js';
import MembershipCard from './screens/MembershipCard.jsx';
import LibraryScreen from './screens/LibraryScreen.jsx';

/** The refusal notice, by its honest name. Dynamic so a missing file fails THIS
 *  test rather than collapsing the whole file at collection time. */
const gateNotice = async () => (await import('./screens/GateNotice.jsx')).default;

const LS = (k) => 'ppw5.' + k;

// ── the source scan ─────────────────────────────────────────────────────────
/** Every shipped source file under src/ — tests excluded, since this very file
 *  has to be allowed to write the price strings it is banning. */
function srcFiles(dir = resolve(process.cwd(), 'src')) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { out.push(...srcFiles(p)); continue; }
    if (!/\.(js|jsx|css)$/.test(name)) continue;
    if (/\.test\.(js|jsx)$/.test(name)) continue;
    out.push(p);
  }
  return out;
}
/**
 * A file's CODE, with comments stripped.
 *
 * Comments are excluded deliberately. The files below now carry comments that say
 * what the storefront was and why it went — including the price it quoted and the
 * words on its button — and a scan that counted those would force every one of
 * them to be written in euphemism. A comment renders nothing and runs nothing;
 * what matters is that no live string can reach a screen.
 *
 * `(?<!:)//` so `https://` does not truncate its own line and hide a literal
 * sitting after it. A price inside a regex literal or after a quoted `//` would
 * slip past this — accepted, and the rendered assertions below are the backstop.
 */
const code = (f) => readFileSync(f, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
/** Repo-relative, so a failure names the file rather than Vic's home directory. */
const rel = (f) => f.replace(resolve(process.cwd()) + '\\', '').replace(/\\/g, '/');
const offenders = (re) => srcFiles().filter((f) => re.test(code(f))).map(rel);

function paidSessionOnDisk() {
  localStorage.setItem(LS('authToken'), 'jwt');
  localStorage.setItem(LS('authEmail'), 'buyer@example.com');
  localStorage.setItem(LS('ent'), JSON.stringify({
    premium: true, entitlement: 'paid', currentPeriodEnd: null,
    userId: 'usr_1', checkedAt: Date.now(), verified: true,
  }));
}
function signedInNonPayer() {
  localStorage.setItem(LS('authToken'), 'jwt');
  localStorage.setItem(LS('authEmail'), 'guest@example.com');
  setState({ signedIn: true, premiumPaid: false });
}

beforeEach(() => {
  delete globalThis.__ppwPaidBuild;
  localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
  setState({
    signedIn: false, premium: true, premiumPaid: false, premiumUpsell: null, capRefusal: null,
    routines: [], deckItems: [], protocols: [], mediaItems: [], onboarded: true, accountOpen: false,
    accountMode: 'signin', justCreated: false, stackTab: 'media',
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete globalThis.__ppwPaidBuild; });

// ── 1. the tree carries no shop ─────────────────────────────────────────────
describe('nothing in the shipped source quotes a price', () => {
  it('has no price string left in any live code path', () => {
    expect(offenders(/\$\s?(9\.99|47\.94|59\.88|4\.99)/)).toEqual([]);
  });

  it('has no "Go Premium", "Unlock Routines" or "Enable Premium" call to action', () => {
    expect(offenders(/go premium|unlock routines|enable premium/i)).toEqual([]);
  });

  // ADDED after the first pass of this file missed three of them: a rendered
  // assertion only catches the screen it renders. "the free plan" was still in a
  // cap refusal in two sheets and in the admin note on the membership card — one
  // of which a customer could never see, and one of which Vic sees every time he
  // opens his own account. All three named a tier in a shop that is gone, and on
  // the open build the admin one had become plainly false.
  it('calls nobody a "free plan", in any copy on any screen', () => {
    expect(offenders(/free plan/i)).toEqual([]);
  });

  it('keeps the Gumroad product id out of every screen — membership.js holds it as a record', () => {
    expect(offenders(/\bGUMROAD_URL\b/).filter((f) => f !== 'src/app5/membership.js')).toEqual([]);
  });
});

// `importActual`, not `import`: this block is about what the FILE exports, and the
// mock at the top of this file would answer for it. It also has to be the key set
// rather than property access — vitest's mock proxy throws on an export that does
// not exist, which would pass for the wrong reason.
describe('membership.js keeps the entitlement and drops the till', () => {
  const real = () => vi.importActual('./membership.js');

  it('exports no price constant for anything to render', async () => {
    const keys = Object.keys(await real());
    expect(keys).not.toContain('PREM_PRICE');
    expect(keys).not.toContain('PREM_PRICE_NOTE');
    expect(keys).not.toContain('PREM_PRICE_FULL');
  });

  it('exports no checkout link builder and no purchase poller', async () => {
    const keys = Object.keys(await real());
    expect(keys).not.toContain('checkoutUrl');
    expect(keys).not.toContain('pollForPremium');
  });

  // The 2026-07-31 sale is real and still billing. Everything that reads the
  // server's verdict stays, or that customer silently loses what they pay for.
  it('still reads, caches and applies a server-verified entitlement', async () => {
    const m = await real();
    expect(m.fetchEntitlement).toBeTypeOf('function');
    expect(m.cachedPremium).toBeTypeOf('function');
    expect(m.readEntitlementCache).toBeTypeOf('function');
    expect(typeof m.PREMIUM_OPEN).toBe('boolean');
    // Kept on purpose: the one record of where the live product is.
    expect(m.GUMROAD_URL).toMatch(/^https:\/\/ppwellness\.gumroad\.com\//);
  });
});

// ── 2. the membership card ──────────────────────────────────────────────────
describe('the membership card tells each person the truth', () => {
  // `/buy|go premium/`, not a flat `/premium/`: the dev-only local unlock names
  // the tier, and it is a developer switch Vite compiles out of the production
  // build (import.meta.env.DEV), not a shop window. Banning the word everywhere
  // would fail on a control no customer can reach.
  it('shows a guest a sign-in, with nothing for sale', () => {
    render(<MembershipCard />);
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
    expect(screen.queryByText(/buy premium|go premium/i)).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('shows a signed-in non-payer their account, claiming no tier either way', () => {
    signedInNonPayer();
    render(<MembershipCard />);
    expect(screen.getByText(/everything is unlocked/i)).toBeTruthy();
    expect(screen.queryByText(/premium · active/i)).toBeNull();
    expect(screen.queryByText(/free plan/i)).toBeNull();
  });

  it('still calls the real subscriber a subscriber', () => {
    paidSessionOnDisk();
    setState({ signedIn: true, premiumPaid: true });
    render(<MembershipCard />);
    // Their receipt, not a sell: this is the thing they actually bought.
    expect(screen.getByText(/premium · active/i)).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('offers no checkout control to a signed-in non-payer', () => {
    signedInNonPayer();
    render(<MembershipCard />);
    expect(screen.queryByText(/checkout/i)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  // THE ONE THAT MATTERS. On the open build the checkout is merely unreachable;
  // this says it is not there at all, which is what Vic asked for.
  it('offers no checkout control even with the paid tier switched back on', () => {
    paidBuild();
    signedInNonPayer();
    setState({ premium: false });
    render(<MembershipCard />);
    expect(screen.queryByText(/checkout/i)).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByText(/free plan/i)).toBeNull();
  });

  it('answers "Check membership" without naming a plan the person is missing', async () => {
    paidBuild();
    signedInNonPayer();
    setState({ premium: false });
    render(<MembershipCard />);
    fireEvent.click(screen.getByText(/check membership/i));
    await screen.findByText(/no payment/i);
    expect(screen.queryByText(/free plan/i)).toBeNull();
  });
});

// ── 3. the refusal notice ───────────────────────────────────────────────────
describe('the gate notice explains a refusal and sells nothing', () => {
  it('renders nothing on the open build, even when something sets a reason', async () => {
    const GateNotice = await gateNotice();
    setState({ premiumUpsell: 'Routines are part of Premium.' });
    render(<GateNotice />);
    expect(document.body.textContent.trim()).toBe('');
  });

  it('on the paid build it states the reason, with no price and no purchase', async () => {
    const GateNotice = await gateNotice();
    paidBuild();
    setState({ premium: false, premiumUpsell: 'Routines are part of Premium — bundle stacks and drop them onto any day in one tap.' });
    render(<GateNotice />);

    expect(screen.getByText(/bundle stacks/i)).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/premium feature/i)).toBeNull();
    // The feature list was a sales pitch, not an explanation.
    expect(screen.queryByText(/unlimited stacks \(free is capped/i)).toBeNull();
  });

  // Kept because it is a way OUT of a refusal that costs nothing, which is the
  // opposite of a sell.
  it('keeps the clear-the-examples remedy when freeing slots would actually help', async () => {
    const GateNotice = await gateNotice();
    paidBuild();
    const s = await import('./store5.js');
    s.setState({
      premium: false, onboarded: true, accountOpen: false, doneByDate: {},
      deckItems: Array.from({ length: 4 }, (_, i) => ({ id: 'ex' + i, title: 'Example ' + i, example: true })),
    });
    s.addItemsToToday(Array.from({ length: 7 }, (_, i) => ({ title: 'Prescribed ' + i })));

    render(<GateNotice />);
    expect(screen.getByText('Clear the examples')).toBeTruthy();
    fireEvent.click(screen.getByText('Clear the examples'));
    expect(s.getState().deckItems).toHaveLength(0);
  });

  // Proof the machinery that returns is really here, not just the constant.
  it('is what a refused free user actually meets when the tier comes back', async () => {
    const GateNotice = await gateNotice();
    paidBuild();
    const s = await import('./store5.js');
    s.applyServerEntitlement({ premium: false });
    s.setState({ onboarded: true, accountOpen: false });

    expect(s.createRoutine('Sneaky', [{ id: 'x' }])).toBeNull();
    render(<GateNotice />);
    expect(screen.getByText(/routines/i)).toBeTruthy();
  });
});

// ── 4. the Library ──────────────────────────────────────────────────────────
describe('the Library shelves offer nothing for sale', () => {
  const library = () => render(<LazyMotion features={domAnimation}><LibraryScreen /></LazyMotion>);

  it('shows the routine builder to anyone on the open build', () => {
    setState({ stackTab: 'routines' });
    library();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByLabelText(/unlock/i)).toBeNull();
  });

  it('puts no price pill and no unlock button on the Routines shelf, even on the paid build', () => {
    paidBuild();
    applyServerEntitlement({ premium: false });
    setState({ stackTab: 'routines' });
    library();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByText(/·\s*\/mo/)).toBeNull();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });

  it('marks a protocol that is not on the account without offering to sell it', () => {
    paidBuild();
    applyServerEntitlement({ premium: false });
    setTab('protocols');
    setState({
      protocolsStatus: 'ready',
      protocols: [{ id: 'paid-1', title: 'Testosterone Protocol', category: 'testosterone', register: 'monetised', url: 'protocols/pdf/paid-1.pdf' }],
    });
    library();

    expect(screen.getByText('Testosterone Protocol')).toBeTruthy();
    // No open link, because it genuinely is not on this account...
    expect(screen.queryByLabelText('View protocol')).toBeNull();
    // ...and no "Unlock" button, because there is nothing to unlock it with.
    expect(screen.queryByLabelText(/^Unlock /)).toBeNull();
    expect(screen.queryByText(/^Premium ·/)).toBeNull();
  });
});

// ── 5. the coach ────────────────────────────────────────────────────────────
describe('the guide never quotes a price or sells a shelf', () => {
  it('has no hint whose copy mentions a price or a tier upgrade', async () => {
    const { HINTS } = await import('./coach/hints5.js');
    const bad = Object.entries(HINTS)
      .filter(([, h]) => /\$|premium/i.test(String(h.copy || '') + String(h.title || '')))
      .map(([id]) => id);
    expect(bad).toEqual([]);
  });

  it('has no hint anchored to a control that no longer exists', async () => {
    const { HINTS } = await import('./coach/hints5.js');
    expect(HINTS['routines-paywall']).toBeUndefined();
    expect(offenders(/routines-lock/)).toEqual([]);
  });
});
