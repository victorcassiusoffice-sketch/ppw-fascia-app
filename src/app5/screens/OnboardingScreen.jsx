// OnboardingScreen — first run, rebuilt 2026-07-28 (Vic 2c/2d).
//
// WAS: a 6-step wizard collecting lifestyle chips, anchors, interests, 1-10
// level sliders, body goals, discreet mode, fasting windows, modules and
// reminders — before the user had seen a single screen of the app.
//
// NOW: 3 screens. Explain what a Stack IS, offer the free "plan it with your own
// AI" path, keep the legally-required terms gate, and get out of the way. The
// rest is taught in place by the coach marks, and every setting that was cut
// still lives in Settings.
//
// Nothing collected here is lost: the store keeps its defaults for the cut prefs
// (obLifestyle/obBody/obInterests/dayT/fasting/modules), so any feature reading
// them behaves exactly as before — the user just isn't interrogated up front.

import React from 'react';
import { useStore5, setState, finishOnboarding, openTerms, openAiBridge, openAccount } from '../store5.js';
import { sfx } from '../sfx5.js';
import { readEmail } from '../membership.js';

// TWO steps, not three (2026-08-24). The middle screen — "Two ways to fill it"
// — was a page of reading about buttons the user could not see yet, placed
// before they had touched anything. It now happens on the real UI, in Quest 2
// and the `add-intro` hint, where the buttons are actually there. What is left
// is the one thing worth saying up front and the one thing legally required.
const STEPS = 2;
const CONSENT = STEPS - 1;

const H1 = { margin: '18px 0 0', fontSize: 27, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' };
const SUB = { margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: 'var(--dim)' };
const CARD = { border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)' };

// A miniature stack card that actually ticks. It was non-interactive, which
// meant the very first thing the app showed a new user was a picture of the app
// rather than the app — and the core verb went untouched until they were three
// screens deeper. Ticking one of these does nothing but strike it through, so
// there is nothing to get wrong and nothing to undo.
//
// The optional `img` prop puts a clay lifestyle image in the disc for the
// build-itself show. It is a prop on THIS card, not a rebuilt variant, so the
// tick toggle, aria and sfx stay single-source.
function DemoCard({ time, title, meta, accent, img }) {
  const [ticked, setTicked] = React.useState(false);
  return (
    <button
      onClick={() => { setTicked((t) => !t); sfx('drop'); }}
      aria-pressed={ticked}
      aria-label={ticked ? `${title} — ticked off, tap to undo` : `${title} — tap to tick it off`}
      style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, ...CARD, borderColor: (ticked || accent) ? 'var(--acc-rim)' : 'var(--rim)', opacity: ticked ? .62 : 1, transition: 'opacity .3s, border-color .3s' }}>
      <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 999, overflow: 'hidden', background: (ticked || accent) ? 'var(--acc-surf)' : 'var(--disc)', border: `1px solid ${(ticked || accent) ? 'var(--acc-rim)' : 'var(--rim)'}`, color: (ticked || accent) ? 'var(--acc-ink)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .3s cubic-bezier(.3,1.3,.4,1)' }}>
        {ticked
          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'ppwRise .32s cubic-bezier(.3,1.4,.4,1) both' }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          : img
            // filter: --art-tone (2026-10-05) — closes "one screen, two apps".
            // These six clay webps were rendered when Gloft, a light warm
            // colourway, was the default; their channel means are L 0.70-0.76
            // and R−B +20..+27. The default is now Indigo (ground L
            // 0.022-0.126) and the payoff frame below them was re-shot from the
            // running app in Indigo at L 0.087, R−B −56 — so six cream-gold
            // discs sat at 5-6x the luminance of their own backdrop, inches
            // above a cold navy screenshot. The treatment is a per-colourway
            // token rather than re-toned bytes because the same files serve all
            // eight skins: Gloft, Ivory, Silver and Crimson get `none` and keep
            // the art as drawn. See theme5.js artTone.
            ? <img src={img} alt="" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none'; }}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 999, filter: 'var(--art-tone)' }} />
            : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3s6 6.3 6 10.3a6 6 0 0 1-12 0C6 9.3 12 3 12 3z" /></svg>}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, textShadow: 'var(--emboss)', textDecoration: ticked ? 'line-through' : 'none' }}>{title}</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: 'var(--dim)' }}>{meta}</span>
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)', flex: 'none' }}>{time}</span>
    </button>
  );
}

// The six cards the show lands, in time order — Vic's own examples. Same six
// clay webps the FirstRunChoice montage loads, so every image is a cache hit.
// BASE_URL-templated because GH Pages serves from the /ppw-fascia-app/ subpath;
// a bare /assets/... path 404s there.
const obImg = (name) => `${import.meta.env.BASE_URL}assets/onboarding/${name}.webp`;
const SHOW_CARDS = [
  { n: 'meditation',  time: '07:00', title: 'Anxiety meditation', meta: 'Audio · 10 min' },
  { n: 'stretch',     time: '07:30', title: 'Stretching video',   meta: 'Online fitness · follow along' },
  { n: 'affirmation', time: '08:00', title: 'Affirmation video',  meta: '2 min, before the mirror' },
  { n: 'prayer',      time: '13:00', title: 'Prayer',             meta: 'Text or audio' },
  { n: 'diet',        time: '13:30', title: 'Dietary reminder',   meta: 'Eat before you scroll' },
  { n: 'course',      time: '18:00', title: 'Online course',      meta: 'The one you’re studying' },
];

// The mandatory facts, one bite each. `img` uses an asset from
// public/assets/onboarding; `icon` draws an accent glyph disc.
// Honesty: the AUTO line is anchored to "in the app" — autoplay is the slot
// engine, which only runs while the app is open, and the copy must never
// suggest otherwise.
const INFO_CHIPS = [
  // stack-real, not the clay stack-hero (2026-10-05): the sentence is "This is a
  // Stack", and what sat next to it was an abstract clay render of something
  // that is not a Stack. stack-real is a shot of the app's own LATER TODAY list,
  // in Indigo, by tools/shoot-intro-assets.mjs — so the one fact the app asserts
  // about itself is illustrated by itself. stack-hero.webp is left on disk
  // rather than deleted; nothing references it now.
  { k: 'stack', img: 'stack-real', title: 'This is a Stack.', body: 'Your day, in order — do it, tick it, done.' },
  { k: 'link',  icon: 'link',  title: 'Anything a link or file can carry.', body: 'Videos, audio, PDFs, courses — organised, at the times you choose.' },
  { k: 'auto',  icon: 'play',  title: 'It can even play itself.', body: 'Turn AUTO on and a card starts on its own when its time arrives in the app.' },
  // SHARE (reworded 2026-10-05): this chip taught the mechanism verbatim, and
  // the mechanism has changed — a routine now travels as a link, because a file
  // tapped inside a messenger cannot open this app on any phone. Leaving the old
  // words would have sent recipients hunting for an import they no longer need.
  { k: 'share', icon: 'share', title: 'Not just for you.', body: 'Build routines for others — send anyone a link, and it opens straight in their app.' },
];

// Accent glyphs for the chips that have no clay image. Same 24-box stroke
// style as every icon in the app.
const CHIP_ICONS = {
  link: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>,
  play: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" /></svg>,
  share: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="12" r="2.6" /><circle cx="17.5" cy="5.5" r="2.6" /><circle cx="17.5" cy="18.5" r="2.6" /><path d="M8.4 10.8l6.8-4M8.4 13.2l6.8 4" /></svg>,
};

export default function OnboardingScreen() {
  const S = useStore5();

  // RETURNING USER (2026-08-04). Setup used to be a wall: this screen covers
  // everything, so the app's only "Sign in" button sat underneath it, unreachable.
  // Someone who already had an account had to complete setup again just to get to
  // the button that would have restored it. Sign-in is now offered here, and once
  // it lands we jump past the two teaching screens to the one thing still legally
  // required — the consent tick.
  //
  // It is not yet a full skip: the server records ENTITLEMENT only, so nothing on
  // the account says "this person already agreed". That is the server-side profile
  // (onboarded / termsAcceptedAt), which is a backend change, not this file.
  //
  // NARROWED TO A GENUINELY RETURNING ACCOUNT (2026-10-05, review pass). This
  // fired on `S.signedIn` alone — and account CREATION sets the same flag as a
  // returning sign-in (applyServerEntitlement -> signedIn: isSignedIn()). So the
  // accent CTA on the very first screen the app shows, FirstRunChoice's "Create
  // an account", sent a brand-new person straight to the consent tick, past the
  // whole second pitch screen: the six cards landing, the payoff shot of the real
  // Stack screen, and the four info chips that are the only place the app ever
  // explains what a Stack, a link-card, AUTO and sharing are. The welcome tour
  // then opened with "the screen beneath them was a picture of this one" — about
  // a screen they had never been shown. A new account is exactly who the pitch is
  // written for; the skip is for someone who has already read it on another phone.
  //
  // Two signals, because neither is enough alone:
  //   accountMode === 'create' — the DOOR. openAccount('create') writes it before
  //     the sign-in starts, so it is already in the store on whichever render
  //     brings `signedIn`, in any ordering of the two writes.
  //   justCreated — the SERVER's own isNewAccount verdict, which is all there is
  //     for a magic link tapped in an email with no door pressed on this device.
  //
  // Sampled once per session and then HELD: a new-account holder who later opens
  // the sign-in sheet out of curiosity flips accountMode, and that must not
  // retroactively yank them off the pitch they are in the middle of reading.
  const doorRef = React.useRef(null);
  React.useEffect(() => {
    if (!S.signedIn) { doorRef.current = null; return; }
    if (doorRef.current === null) {
      doorRef.current = (S.justCreated || S.accountMode === 'create') ? 'new' : 'returning';
    }
    if (doorRef.current === 'new') return;            // a new account keeps the pitch
    if ((S.obStep || 0) < CONSENT) setState({ obStep: CONSENT });
  }, [S.signedIn, S.justCreated, S.accountMode]);

  // A dimmed CTA that does nothing when tapped reads as a broken app, not as a
  // locked door — people tapped it repeatedly and never looked up at the tick.
  // Now the tap answers: the checkbox row pulses once, and a line under the
  // buttons says why they are dim.
  //
  // ABOVE the `onboarded` bail deliberately: this screen unmounts itself the
  // instant setup finishes, and a hook below that early return changes the hook
  // count on that render — React #300, a blank screen at the exact moment the
  // user finishes signing up. The tests were green; only a real browser caught it.
  const [pulse, setPulse] = React.useState(false);

  // The build-itself show. prefers-reduced-motion initialises FINISHED — full
  // stack, final line, captions — zero travel (JS branch; CSS [data-ob-anim]
  // backstop covers a mistimed mount).
  const reduceMotion = React.useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const [landed, setLanded] = React.useState(reduceMotion ? 6 : 0);
  const [assembled, setAssembled] = React.useState(reduceMotion);
  const [payoffFailed, setPayoffFailed] = React.useState(false);

  // StrictMode-safe: cleanup clears the interval; dev double-mount cannot leak.
  // S.onboarded is in the guard because these hooks sit ABOVE the onboarded bail (the React #300 law above) — an onboarded user's obStep is 0, so without it the interval would spin forever.
  //
  // !S.firstRunChoice JOINED THE GUARD 2026-10-05, and it is the fix, not a
  // tidy-up. FirstRunChoice sits at z-41 over this screen's z-40 until the
  // visitor picks one of its three doors — but the interval started at MOUNT,
  // so the whole show (6 × 420ms + a 450ms settle = 2.97s) played out behind
  // that screen and was already finished by the time anyone could see it. The
  // pitch the app opens with was being shown to nobody. The repo's own shoot
  // script had written the symptom down as if it were the design: "the show has
  // been running behind the first-run choice since mount".
  React.useEffect(() => {
    if (S.onboarded || !S.firstRunChoice || (S.obStep || 0) !== 0 || assembled) return undefined;
    const iv = setInterval(() => setLanded((n) => (n >= 6 ? n : n + 1)), 420);
    return () => clearInterval(iv);
  }, [S.onboarded, S.firstRunChoice, S.obStep, assembled]);

  React.useEffect(() => {
    if (landed === 6 && !assembled) {
      const t = setTimeout(() => setAssembled(true), 450);
      return () => clearTimeout(t);
    }
  }, [landed, assembled]);

  // SKIP — one guarded handler. Capture + stopPropagation means the tap that
  // skips can never also tick a card; a second deliberate tap ticks.
  const skipShow = (e) => { e.stopPropagation(); e.preventDefault(); setLanded(6); setAssembled(true); };

  // THE INFO CAROUSEL (Vic, 2026-08-25). The mandatory facts under the show
  // were four stacked paragraphs — "too much text, jumbled". Same information,
  // now four bite-sized cards in a scroll-snap row that walks itself: each one
  // an image or icon plus two short lines, one card in view at a time. The
  // first touch hands the wheel to the user for good — an auto-carousel that
  // fights a thumb is worse than no carousel.
  const [chip, setChip] = React.useState(0);
  const chipRowRef = React.useRef(null);
  const chipTouched = React.useRef(false);
  // Same `!S.firstRunChoice` clause as the show above, for the same reason: a
  // reduced-motion visitor starts `assembled`, so without it this carousel
  // would walk its four facts past a screen the user cannot see yet.
  React.useEffect(() => {
    if (S.onboarded || !S.firstRunChoice || (S.obStep || 0) !== 0 || !assembled || reduceMotion) return undefined;
    const iv = setInterval(() => {
      if (chipTouched.current) return;
      setChip((c) => (c + 1) % INFO_CHIPS.length);
    }, 2800);
    return () => clearInterval(iv);
  }, [S.onboarded, S.firstRunChoice, S.obStep, assembled, reduceMotion]);
  React.useEffect(() => {
    const row = chipRowRef.current;
    if (!row || !row.children[chip]) return;
    row.scrollTo({ left: Math.max(0, row.children[chip].offsetLeft - 14), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [chip, reduceMotion]);

  if (S.onboarded) return null;

  const step = S.obStep || 0;
  const setStep = (n) => setState({ obStep: n });
  const nudgeConsent = () => { setPulse(false); requestAnimationFrame(() => setPulse(true)); setTimeout(() => setPulse(false), 700); };
  const canNext = step !== CONSENT || S.termsOk;   // terms gate stays on the final screen

  const next = () => {
    if (step < STEPS - 1) { setStep(step + 1); return; }
    if (!S.termsOk) return;
    finishOnboarding();
  };

  /**
   * F3 (UX pass 2026-08-11) — the AI path used to be a ONE-WAY DOOR.
   *
   * This called finishOnboarding() BEFORE opening the AI sheet, so the choice
   * screen was destroyed the instant you picked. Inside the AI flow "← Back" only
   * looped between its own steps and the sole exit dropped you into the feature
   * tour, so anyone who changed their mind could never reach "Start with an empty
   * day" again — the alternative was simply gone.
   *
   * Onboarding now finishes when the user actually ARRIVES somewhere: either they
   * apply a plan (AiBridgeSheet) or they choose the empty day. Until then this
   * screen stays underneath, so closing the AI sheet returns to the choice.
   */
  const startWithAi = () => {
    if (!S.termsOk) { setStep(CONSENT); return; }   // consent first, always
    openAiBridge();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', background: 'var(--ground)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />

      {/* dots + back */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 20px 0' }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} aria-label="Back"
          style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', visibility: step > 0 ? 'visible' : 'hidden' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div style={{ display: 'flex', gap: 7 }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, background: i === step ? 'var(--accent)' : 'var(--hairline)', transition: 'all .3s cubic-bezier(.3,1.3,.4,1)' }} />
          ))}
        </div>
        <div style={{ width: 44 }} />
      </div>

      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '10px 24px 24px', display: 'flex', flexDirection: 'column' }}>

        {/* ── 1 · THE PITCH — the stack builds itself ── */}
        {step === 0 && (
          <div data-ob-anim style={{ animation: 'ppwScreenIn .6s cubic-bezier(.26,1,.4,1)' }}>
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Your Ideal Lifestyle</div>
            <h1 style={{ ...H1, fontWeight: 700 }}>Watch your Stack build itself.</h1>

            {/* SWAP LINE — names each routine as it lands; resolves to the payoff.
                minHeight reserves the row so swaps never shift layout. */}
            <p style={{ margin: '12px 0 0', minHeight: 26, fontSize: 17, fontWeight: 800 }} aria-hidden="true">
              {assembled ? (
                <span key="final" data-ob-anim style={{ display: 'inline-block', animation: 'ppwRise .32s cubic-bezier(.3,1.4,.4,1) both' }}>
                  <span style={{ color: 'var(--dim)' }}>= </span>
                  <span style={{ color: 'var(--accent)' }}>Your Ideal Lifestyle.</span>
                </span>
              ) : landed > 0 ? (
                <span key={landed} data-ob-anim style={{ display: 'inline-block', animation: 'ppwRise .32s cubic-bezier(.3,1.4,.4,1) both' }}>
                  <span style={{ color: 'var(--dim)' }}>＋ </span>
                  <span style={{ color: 'var(--accent)' }}>{SHOW_CARDS[landed - 1].title}</span>
                </span>
              ) : null}
            </p>

            {/* THE STACK — six DemoCards fly in, alternating drift, time order.
                aria-live announces landings; onClickCapture skips until assembled. */}
            <div aria-live="polite"
              onClickCapture={!assembled ? skipShow : undefined}
              style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {SHOW_CARDS.slice(0, landed).map((c, i) => (
                <div key={c.n} data-ob-anim
                  style={{ '--fly-x': i % 2 ? '48px' : '-48px', '--fly-r': i % 2 ? '6deg' : '-6deg', animation: 'ppwStackLand .52s cubic-bezier(.3,1,.4,1) both' }}>
                  <DemoCard time={c.time} title={c.title} meta={c.meta} img={obImg(c.n)} />
                </div>
              ))}
            </div>

            {assembled && (
              <div data-ob-anim style={{ animation: 'ppwRise .32s cubic-bezier(.3,1.4,.4,1) both' }}>

                {/* THE PAYOFF (2026-10-05). Six demo cards tick, and then the
                    pitch ended — it showed what the app DOES and never once
                    showed the app. This is the real Stack screen, shot in Indigo
                    at phone size by tools/shoot-intro-assets.mjs, so the promise
                    and the product are the same picture.

                    A peek, not a full screen: cropped to the live card and the
                    top of the day's list. A full-height 390x844 render would add
                    about 450px to a column that already scrolls, pushing the
                    four info chips — which carry the facts this screen exists to
                    make — that much further from the thumb. Hiding the whole
                    FRAME on error, not just the <img>, so a missing file leaves
                    no empty box.

                    THE FRAME NO LONGER STARTS AT THE TOP OF THE SCREEN
                    (2026-10-05, review pass). It used to, and the header band it
                    caught carried two things a static picture must never carry:
                    the date — the shipped file read "MONDAY 5 OCTOBER", the day
                    of the shoot, wrong from the next morning on and unable ever
                    to correct itself — and the signed-out accent "Sign in" pill,
                    a control that cannot be pressed because it is pixels, shown
                    to viewers who are signed in (reachable: Back from the consent
                    screen). The crop now starts below the band and the shoot
                    script PROVES both are outside every frame. */}
                {!payoffFailed && (
                  <figure style={{ margin: '14px 0 0' }}>
                    {/* Narrower than the column on purpose. Full-bleed it reads
                        as another card in the stack above it — a screenshot of
                        the app, inside the app, at the same width as the app's
                        own cards. Inset and centred, it reads as what it is: a
                        picture of a different screen. It also keeps the cost of
                        the payoff to about 215px in a column that already has to
                        scroll, so the four info chips below are no further out
                        of reach than they already were. */}
                    <div style={{ width: 210, maxWidth: '62%', margin: '0 auto', borderRadius: 18, overflow: 'hidden', ...CARD }}>
                      {/* 210 wide and 195/232, not 240 and 13/10. Dropping the
                          header made the window start lower, so it had to reach
                          further down to hold anything but the one hero card —
                          the caption is a claim about a DAY — and the frame is
                          drawn narrower to pay back some of that height: 247px
                          of column against the old 185.

                          MEASURED, because the comment above this one asserts a
                          fold that was already lost: on a 390x844 phone with the
                          six cards landed, this frame sits at y 716-963 and the
                          first info chip at 1036-1139. The chips are BELOW the
                          fold and were before this change too (the old frame put
                          them at about 974) — the six-card show alone is taller
                          than the viewport. This pass costs 62px more scrolling;
                          it does not newly push the chips under. Shrinking the
                          whole step-0 column is a real problem and a separate
                          one.

                          The ratio must equal the file's own pixel ratio or
                          objectFit:cover silently crops the art;
                          intro-assets.test.js fails if the two ever disagree. */}
                      <img src={obImg('stack-done')} alt="The Stack screen: the first routine of the day on a card, with the rest of the day listed below" decoding="async"
                        onError={() => setPayoffFailed(true)}
                        style={{ display: 'block', width: '100%', aspectRatio: '195 / 232', objectFit: 'cover', objectPosition: 'center top' }} />
                    </div>
                    <figcaption style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.45, color: 'var(--dim)', textAlign: 'center' }}>
                      And this is yours, by tonight.
                    </figcaption>
                  </figure>
                )}

                <p style={{ margin: '12px 0 0', fontSize: 13.5, fontWeight: 700, color: 'var(--accent)', textAlign: 'center', textShadow: 'var(--emboss)' }}>
                  Your turn — tap a card to tick it off!
                </p>

                {/* The mandatory facts as a self-walking scroll-snap row — one
                    card in view at a time, image or icon first, two short lines.
                    Swipeable by hand; the first touch stops the auto-walk. */}
                <div
                  ref={chipRowRef}
                  onPointerDown={() => { chipTouched.current = true; }}
                  onScroll={(e) => {
                    // keep the dots honest when the user swipes by hand
                    const row = e.currentTarget;
                    const kids = [...row.children];
                    let best = 0, bestD = Infinity;
                    kids.forEach((k, i) => { const d = Math.abs(k.offsetLeft - 14 - row.scrollLeft); if (d < bestD) { bestD = d; best = i; } });
                    if (chipTouched.current) setChip(best);
                  }}
                  style={{ marginTop: 12, display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', margin: '12px -24px 0', padding: '2px 24px 6px' }}>
                  {INFO_CHIPS.map((c) => (
                    <div key={c.k} style={{ flex: 'none', width: 'calc(100% - 44px)', scrollSnapAlign: 'center', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 20, ...CARD }}>
                      {c.img ? (
                        <img src={obImg(c.img)} alt="" decoding="async" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                          style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, objectFit: 'cover', border: '1px solid var(--rim)' }} />
                      ) : (
                        <span style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--acc-glow)' }}>
                          {CHIP_ICONS[c.icon]}
                        </span>
                      )}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, textShadow: 'var(--emboss)' }}>{c.title}</span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 12, lineHeight: 1.45, color: 'var(--dim)' }}>{c.body}</span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* dots — where the walk is, tappable to jump */}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {INFO_CHIPS.map((c, i) => (
                    <button key={c.k} onClick={() => { chipTouched.current = true; setChip(i); }} aria-label={'Info ' + (i + 1) + ' of ' + INFO_CHIPS.length}
                      style={{ width: i === chip ? 18 : 7, height: 7, padding: 0, borderRadius: 999, border: 'none', background: i === chip ? 'var(--accent)' : 'var(--hairline)', transition: 'all .3s cubic-bezier(.3,1.3,.4,1)' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 2 · CONSENT (legally required gate) ── */}
        {step === CONSENT && (
          <div style={{ animation: 'ppwScreenIn .6s cubic-bezier(.26,1,.4,1)' }}>
            <h1 style={H1}>Before you start</h1>
            <p style={SUB}>One quick thing, then you’re in.</p>

            <div style={{ marginTop: 20, padding: '16px 18px', borderRadius: 20, ...CARD }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--dim)' }}>
                PPW organises and schedules the content <em>you</em> choose. It is not medical advice, and it
                doesn’t host or sell any content. Your stacks stay on your device.
              </p>
              {/* F9 (a11y): this carried no state at all, so a screen-reader user
                  could not tell agreed from not-agreed on a LEGAL gate. */}
              <button onClick={() => setState({ termsOk: !S.termsOk })}
                role="checkbox" aria-checked={!!S.termsOk} aria-label="I agree to the Terms and Health Disclaimer"
                style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', gap: 11, minHeight: 44, background: 'none', border: 'none', padding: 0, color: 'var(--ink)', textAlign: 'left', cursor: 'pointer', animation: pulse ? 'ppwRise .34s cubic-bezier(.3,1.5,.4,1) 2' : undefined }}>
                <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 9, border: `1px solid ${S.termsOk ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: S.termsOk ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)' }}>
                  {S.termsOk && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>I agree to the Terms &amp; Health Disclaimer</span>
              </button>
              <button onClick={openTerms} style={{ marginTop: 8, background: 'none', border: 'none', padding: '4px 0', minHeight: 34, color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>Read the full terms</button>
            </div>

            <button onClick={() => (S.termsOk ? startWithAi() : nudgeConsent())} aria-disabled={!S.termsOk}
              style={{ marginTop: 18, width: '100%', height: 52, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)', opacity: S.termsOk ? 1 : .45 }}>
              Start by talking to my AI
            </button>
            {!S.termsOk && (
              <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)', textAlign: 'center' }}>
                Tick the box above to continue — it is the legal bit.
              </p>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* primary CTA */}
        <button onClick={() => (canNext ? next() : nudgeConsent())} aria-disabled={!canNext}
          style={{ position: 'relative', marginTop: 20, width: '100%', height: 54, borderRadius: 18, border: `1px solid ${step === CONSENT ? 'var(--rim)' : 'var(--acc-rim)'}`, background: step === CONSENT ? 'var(--surface)' : 'var(--acc-surf)', color: step === CONSENT ? 'var(--ink)' : 'var(--acc-ink)', fontWeight: 600, fontSize: 16, textShadow: step === CONSENT ? 'var(--emboss)' : 'var(--label-shadow)', boxShadow: step === CONSENT ? 'var(--elev)' : 'var(--acc-glow)', opacity: canNext ? 1 : .45, transition: 'opacity .25s' }}>
          {step === CONSENT ? 'Start with an empty day' : 'Build mine'}
        </button>

        {/* A door for BOTH kinds of visitor.
            This line used to read "Already have an account? Sign in" — the only
            account control on the screen, phrased as a question that tells a new
            customer the path is not for them, while offering no path that is. */}
        {S.signedIn ? (
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12.5, color: 'var(--dim)' }}>
            Signed in as <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{readEmail() || 'your account'}</span>
          </div>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <button onClick={() => openAccount('create')} data-tour="signup-onboarding"
              style={{ minHeight: 44, padding: '0 10px', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13.5, fontWeight: 700 }}>
              Create an account
            </button>
            <span style={{ color: 'var(--dim)', fontSize: 13 }}>·</span>
            <button onClick={() => openAccount('signin')} data-tour="signin-onboarding"
              style={{ minHeight: 44, padding: '0 10px', background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600 }}>
              I already have one
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
