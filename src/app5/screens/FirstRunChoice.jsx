// FirstRunChoice — the first thing a brand-new visitor sees.
//
// THE GAP THIS FILLS (proven on the live build 11ec509, clean browser, no
// session): the ONLY account words on the first screen were "Sign in", "Next",
// and "Already have an account? Sign in". No "Sign up", no "Create account", no
// "Get started" anywhere. Both controls said SIGN IN, and one of them opened by
// asking whether you already had an account — telling a new customer this path is
// not for them while offering no path that is. It did not merely omit sign-up; it
// excluded the new user, and it is losing sales now.
//
// So the app opens with a straight choice, in the words each visitor recognises.
//
// The third option is deliberate and is NOT a hedge: the app has always worked
// without an account, and says so in its own copy ("The app is free without an
// account"). Forcing a sign-up wall in front of a free app would trade one
// exclusion for another. New customer, returning customer, and "let me look
// first" are three real people; all three get a door.

import React from 'react';
import { useStore5, openAccount, finishFirstRunChoice } from '../store5.js';
import { logoUrl } from '../theme5.js';

const CARD = { border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)' };

/**
 * The wordmark for whatever colourway is active.
 *
 * If the file is missing it renders NOTHING rather than a broken-image icon — the
 * lesson from the six `mark:` paths that pointed at files which never existed.
 * The word "PPWellness" stays as the alt text, so a screen reader and a failed
 * load both still name the app.
 */
function BrandMark() {
  const S = useStore5();
  const [failed, setFailed] = React.useState(false);
  const src = logoUrl(S);
  if (!src || failed) {
    return (
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>
        PPWellness
      </div>
    );
  }
  // The source art is OPAQUE — each colourway's wordmark is baked onto that
  // colourway's own base colour (verified: gloft 181,178,173 vs base #C9C8C3,
  // black 29,30,30 vs #1C1E20, and so on). Only the Glass one has transparency.
  // The ground behind it is a radial GRADIENT, so a flat plate of the base colour
  // lands as a visible rectangle wherever the gradient is lighter or darker than
  // that one value. Feathering the outer edge dissolves the seam; the art itself
  // is untouched, and the fade only ever eats the empty margin around the mark.
  // The real fix is transparent exports per colourway — noted for Vic.
  const feather = 'radial-gradient(closest-side, #000 68%, rgba(0,0,0,.55) 86%, transparent 100%)';
  return (
    <img
      src={src} alt="PPWellness" onError={() => setFailed(true)}
      decoding="async"
      style={{
        display: 'block', width: 'min(196px, 56%)', height: 'auto', marginLeft: -6,
        maskImage: feather, WebkitMaskImage: feather,
      }}
    />
  );
}

export default function FirstRunChoice() {
  const S = useStore5();

  // Signing in from here dismisses the choice: a returning customer who has just
  // proved who they are must never be shown "Create an account" again.
  React.useEffect(() => {
    if (S.signedIn && !S.firstRunChoice) finishFirstRunChoice();
  }, [S.signedIn, S.firstRunChoice]);

  if (S.firstRunChoice || S.onboarded) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 41, display: 'flex', flexDirection: 'column', background: 'var(--ground)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '32px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* THE BRAND MOMENT (Vic, 2026-08-07).
            This screen opened with a 10px uppercase "PPWellness" and then a large
            hole where the flex spacer pushed the buttons down — the emptiness Vic
            saw. Each colourway has always carried its own wordmark; nothing in the
            app read it, so eight logo files shipped in every build and were never
            once shown. The wordmark now fills that space, and it changes with the
            theme, so the first screen looks like the app the person is about to use.
            Spacers above and below centre it rather than leaving it stranded. */}
        <div style={{ flex: 1, minHeight: 12 }} />

        <BrandMark />

        <h1 style={{ margin: '18px 0 0', fontSize: 29, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>
          Your day, as a stack
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.6, color: 'var(--dim)' }}>
          Plan the things you mean to do, and tick them off as the day goes.
        </p>

        <div style={{ flex: 1.4, minHeight: 20 }} />

        <button onClick={() => openAccount('create')}
          style={{ width: '100%', minHeight: 56, borderRadius: 18, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 16, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>
          Create an account
        </button>

        <button onClick={() => openAccount('signin')}
          style={{ marginTop: 10, width: '100%', minHeight: 56, borderRadius: 18, ...CARD, color: 'var(--ink)', fontWeight: 600, fontSize: 15.5, textShadow: 'var(--emboss)' }}>
          I already have one
        </button>

        <button onClick={finishFirstRunChoice}
          style={{ marginTop: 14, width: '100%', minHeight: 44, background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600 }}>
          Look around first
        </button>

        <p style={{ margin: '14px 2px 0', fontSize: 11.5, lineHeight: 1.55, color: 'var(--dim)', textAlign: 'center' }}>
          The app is free to use without an account. An account saves your membership
          and lets you sign in on another phone.
        </p>
      </div>
    </div>
  );
}
