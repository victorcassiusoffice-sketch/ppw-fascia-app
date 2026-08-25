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

// GH Pages serves the app from /ppw-fascia-app/, so a bare /assets/... path
// 404s in production. BASE_URL carries the subpath in builds and "/" in dev.
const obImg = (name) => `${import.meta.env.BASE_URL}assets/onboarding/${name}.webp`;
const MONTAGE = [
  { n: 'meditation',  top: '2%',    left: '6%',    r: '-8deg', s: 78, d: 0.15, drift: 6.5 },
  { n: 'stretch',     top: '0%',    right: '8%',   r: '7deg',  s: 70, d: 0.24, drift: 7   },
  { n: 'affirmation', top: '40%',   left: '0%',    r: '-5deg', s: 66, d: 0.33, drift: 7.5 },
  { n: 'prayer',      top: '42%',   right: '0%',   r: '6deg',  s: 70, d: 0.42, drift: 8   },
  { n: 'diet',        bottom: '4%', left: '14%',   r: '5deg',  s: 78, d: 0.51, drift: 8.5 },
  { n: 'course',      bottom: '0%', right: '16%',  r: '-6deg', s: 74, d: 0.6,  drift: 9   },
];

/**
 * The wordmark for whatever colourway is active.
 *
 * If the file is missing it renders NOTHING rather than a broken-image icon — the
 * lesson from the six `mark:` paths that pointed at files which never existed.
 * The word "PPWellness" stays as the alt text, so a screen reader and a failed
 * load both still name the app.
 */
function BrandMark({ size = 'min(170px, 46vw)' }) {
  const S = useStore5();
  const [failed, setFailed] = React.useState(false);
  const src = logoUrl(S);
  if (!src || failed) {
    return (
      <div style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>
        PPWellness
      </div>
    );
  }
  // The source art is OPAQUE — each colourway's wordmark is baked onto that
  // colourway's own base colour (verified: gloft 181,178,173 vs base #C9C8C3,
  // black 29,30,30 vs #1C1E20, and so on). Only the Glass one has transparency.
  // Feathering the outer edge dissolves the plate into whatever sits behind it;
  // the art itself is untouched, and the fade only eats the empty margin around
  // the mark. The real fix is transparent exports per colourway.
  const feather = 'radial-gradient(closest-side, #000 66%, rgba(0,0,0,.5) 86%, transparent 100%)';

  // THE TILE (Vic, 2026-08-11): "it sits LEFT and unstyled. Centred, inside a
  // soft-edge neumorphism square, matching the app's soft design language."
  //
  // Built from the app's OWN tokens rather than hand-rolled shadows:
  // `--intro-shadow` and `--intro-bevel` are the soft skin's dual-light
  // neumorphic pair (10-24px offsets, dark down-right + light up-left, plus an
  // inner bevel) — defined in theme5.js and, like the logo itself was, used
  // nowhere until now. That is what makes this match the language instead of
  // imitating it, and it re-tints with every colourway for free.
  //
  // The tile's face is `--ground`, the same material as the screen behind it,
  // because neumorphism only reads as "pressed out of the surface" when the
  // surface and the ground are the same thing. A card colour here would make it
  // a card sitting on the page, which is the opposite effect.
  return (
    <div style={{
      alignSelf: 'center',
      width: size, aspectRatio: '1 / 1', flex: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 38,
      background: 'var(--ground)',
      boxShadow: 'var(--intro-shadow, var(--elev)), var(--intro-bevel, none)',
    }}>
      <img
        src={src} alt="PPWellness" onError={() => setFailed(true)}
        decoding="async"
        style={{
          display: 'block', width: '80%', height: 'auto',
          maskImage: feather, WebkitMaskImage: feather,
        }}
      />
    </div>
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
        <div style={{ flex: 1, minHeight: 8 }} />

        {/* POSTER STAGE — brand tile centred, six clay lifestyle images cut in around
            it and settle into a slow drifting halo. Decorative: aria-hidden, no
            pointer events, and a failed load removes the image cleanly. */}
        <div style={{ position: 'relative', width: '100%', height: 'min(310px, 36dvh)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {MONTAGE.map((m) => (
            <span key={m.n} aria-hidden="true" style={{ position: 'absolute', top: m.top, bottom: m.bottom, left: m.left, right: m.right, transform: `rotate(${m.r})`, pointerEvents: 'none' }}>
              {/* Static tilt lives on this OUTER span; both animations live on the
                  INNER span. ppwMontageIn holds transform:none via fill both until
                  ppwDrift — later in the comma list — takes the transform over at
                  its delay. That is why the layers are split. */}
              <span data-ob-anim style={{ display: 'block', animation: `ppwMontageIn .7s cubic-bezier(.26,1,.4,1) ${m.d}s both, ppwDrift ${m.drift}s ease-in-out ${(1.6 + m.d).toFixed(2)}s infinite` }}>
                <img src={obImg(m.n)} alt="" decoding="async"
                  onError={(e) => { const s = e.currentTarget.closest('span[aria-hidden]'); if (s) s.style.display = 'none'; }}
                  style={{ display: 'block', width: `min(${m.s}px, 18vw)`, aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 20, border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)' }} />
              </span>
            </span>
          ))}
          <div data-ob-anim style={{ zIndex: 1, animation: 'ppwLogoIn .7s cubic-bezier(.26,1,.4,1) both, ppwLogoFloat 6s ease-in-out 1.8s infinite' }}>
            <BrandMark size="min(140px, 38vw)" />
          </div>
        </div>

        {/* THE CLAIM — Vic's verbatim power line, then the mechanism as three beats. */}
        <h1 data-ob-anim style={{ margin: '18px 0 0', fontSize: 'clamp(24px, 7.4vw, 29px)', fontWeight: 800, letterSpacing: '-.02em', textShadow: 'var(--emboss)', textAlign: 'center', animation: 'ppwRise .45s cubic-bezier(.26,1,.4,1) .05s both' }}>
          The most powerful app for your life.
        </h1>
        <p style={{ margin: '10px 0 0', textAlign: 'center', lineHeight: 1.35 }}>
          <span data-ob-anim style={{ display: 'inline-block', fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--accent)', textShadow: 'var(--emboss)', animation: 'ppwRise .45s cubic-bezier(.26,1,.4,1) .2s both' }}>Your Ideal Lifestyle.</span>
          <br />
          {['Planned.', 'Organised.', 'Brought to you.'].map((w, i) => (
            <span key={w} data-ob-anim style={{ display: 'inline-block', marginRight: i < 2 ? 8 : 0, fontSize: 18, fontWeight: 800, color: 'var(--ink)', textShadow: 'var(--emboss)', animation: `ppwRise .45s cubic-bezier(.26,1,.4,1) ${(0.35 + i * 0.15).toFixed(2)}s both` }}>{w}</span>
          ))}
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
