import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, Link, useLocation, Navigate, useParams } from 'react-router-dom';
import {
  ZONES, LIFESTYLES, LIFESTYLE_ZONES, TESTS_BY_GROUP,
  migrateZoneCodes,
  zoneVideoPath, testVideoPath, testAnswerVideoPath, DEFAULT_CLIP_SECONDS,
  zoneMediaPath, lifestyleAllMediaPath, moduleMediaPath, loadMedia,
  FASCIA_CHAINS, ZONE_TO_CHAIN, resolveRoutineZones,
  chainOverlayUrl, dominantChainForZones,
} from './data.js';
import { getBodyView, zoneCentroid } from './bodyZones.js';
import { useActiveProtocols, useActiveModules, useActiveRoutines, useCompletedToday, useLocalStorage, useDateScopedStorage, useDailyHidden, useDailyDuplicates, useDailyMerges, useDailyTitles, useFastingPrefs, useUserStacks, useIfPrefs, useNotificationPrefs, useAutoplayPatterns, useRecurrenceRules, useRecurrenceOverrides, migrateRecurrenceData, todayISO } from './state.js';
import { recurringStacksForDate, makeRule } from './recurrence.js';
import { getMediaUrl, parseYouTubeId, resolveLaunchHref } from './lib/mediaStore.js';
import { isSupplementItem, isAccessoryItem, affiliateUrlFor, applyIfWindow, scheduleIfNotifications, clearIfNotifications } from './lib/tags.js';
import AddStackModal from './AddStackModal.jsx';
import { listProtocols, fetchProtocol, mergeDailyItems, isMockActive } from './protocols.js';
import { iherbUrl, amazonUkUrl, iherbCartAllUrl } from './affiliate.js';
import { LS_KEYS, APP_VERSION, USE_MOCK_DATA, NOTIFICATION_LEAD_TIME_MIN } from './config.js';
import MediaPlayer, { DirectMediaPlayer } from './MediaPlayer.jsx';
import SortableList from './SortableList.jsx';
import { getPermissionState, requestPermission, scheduleNotifications, scheduleStackNotifications, clearAllScheduled } from './notifications.js';
import { useScrollFadeIn } from './useScrollFadeIn.js';
import { downloadSlotIcs } from './lib/ics.js';
import { ensurePersistentStorage } from './lib/storagePersist.js';
import { getPushState, subscribeToPush, INSTALL_HELP } from './lib/push.js';
import { LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion } from './motion.js';
import { screenTransition, reduced } from './lib/motion';
import { GlassLogo, ThemeToggle, BottomNav } from './chrome.jsx';
import { useTheme } from './theme.js';
import { initAssistantSync } from './lib/assistantSync.js';
import UpdateToast from './components/UpdateToast.jsx';

import TodayView from './pages/Today.jsx';
import { ProtocolsList, ProtocolDetail } from './pages/Protocols.jsx';
import ModulesList from './pages/Modules.jsx';
import SettingsView from './pages/Settings.jsx';
import CoachView from './pages/Coach.jsx';
import SoftLab from './pages/SoftLab.jsx'; // STAGED (feat/soft-v1) — review only, not deployed
import AppBackground from './components/AppBackground.jsx';

/* ────────────────────────────────────────────
   BodyMap — see src/bodyZones.js for the architecture comment.
   The body image and the polygon zones BOTH come from the same per-view
   Figma SVG (public/assets/body_zones/body_zones_{front,back}.svg) so they
   live in the same coordinate space and can't drift out of alignment.
   ──────────────────────────────────────────── */

// Short label rendered inside selected hotspot polygons. Abbreviates long
// names so they fit narrow zones. v2.1 taxonomy (kebab-case, no ITB,
// single knee zone per side).
const ZONE_LABEL_OVERRIDES = {
  'headache':              'Head',
  'jaw-left':              'Jaw L',
  'jaw-right':             'Jaw R',
  'scapula-left':          'Scap L',
  'scapula-right':         'Scap R',
  'solar-plexus':          'S.Plex',
  'traps-left':            'Trap L',
  'traps-right':           'Trap R',
  'upper-back-left':       'Up.Bk L',
  'upper-back-right':      'Up.Bk R',
  'front-shoulder-left':   'F.Sh L',
  'front-shoulder-right':  'F.Sh R',
  'forearm-left':          'F.Arm L',
  'forearm-right':         'F.Arm R',
  'lower-back-left':       'L.Bk L',
  'lower-back-right':      'L.Bk R',
  'hip-flexor-left':       'Hip.F L',
  'hip-flexor-right':      'Hip.F R',
  'gluteal-left':          'Glut L',
  'gluteal-right':         'Glut R',
  'hamstrings-left':       'Ham L',
  'hamstrings-right':      'Ham R',
  'knee-left':             'Knee L',
  'knee-right':            'Knee R',
  'calf-left':             'Calf L',
  'calf-right':            'Calf R',
  'foot-left':             'Foot L',
  'foot-right':            'Foot R',
};

function zoneShortLabel(code, zonesList) {
  if (ZONE_LABEL_OVERRIDES[code]) return ZONE_LABEL_OVERRIDES[code];
  const z = zonesList.find(x => x.code === code);
  if (!z) return code;
  const side = z.side === 'left' ? ' L' : z.side === 'right' ? ' R' : '';
  return z.label + side;
}

/* ────────────────────────────────────────────
   Shared session state (lifted to App)
   ──────────────────────────────────────────── */
const initialSession = {
  mode: null,
  lifestyle: null,
  level: null,
  selected: {},
  stack: [],
};

/* Motion unification (2026-06-15) — every route now enters with the ONE shared
   `screenTransition` primitive (rise SHIFT.screen + fade over DUR.slow on
   EASE.standard; reduced motion → instant fade). The old tab-direction lateral
   slide was retired: it gave bottom-nav routes a different character from the
   onboarding/wizard routes, which is exactly the "page transitions aren't the
   same" mismatch Vic flagged. One primitive = one motion language. */

export default function App() {
  const [session, setSession] = useState(initialSession);
  const location = useLocation();

  // D2 (2026-06-11) — pull Assistant plan ops on launch + on every return to
  // foreground. Silent no-op when unpaired or offline (assistantSync handles it).
  useEffect(() => initAssistantSync(), []);

  const [activeProtocols] = useActiveProtocols();
  const [activeModules] = useActiveModules();
  const [activeRoutines] = useActiveRoutines();
  const hasActiveState =
    activeProtocols.length > 0 ||
    activeModules.length > 0 ||
    (activeRoutines.savedZones?.length || 0) > 0;

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen text-ink">
        {/* REF-03 liquid refraction filter (2026-06-15; ANIMATED 2026-06-19, Vic
            "make the liquid motion visible"). Consumed by `.liquid-refract::after`
            on signature glass. The fractal-noise field now slowly CHURNS (SMIL
            <animate> on baseFrequency) so the refracted light FLOWS like liquid —
            a slow 14s loop, tiny amplitude, on small filtered regions (cards/nav)
            so it stays cheap. Element filter (not backdrop) → works on iOS Safari.
            Churn is omitted under prefers-reduced-motion (the CSS flow drift is
            disabled there too). */}
        <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="ppw-liquid-glass" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.016" numOctaves="2" seed="11" result="n">
              {!reduced() && (
                <animate
                  attributeName="baseFrequency"
                  dur="14s"
                  values="0.011 0.016; 0.014 0.020; 0.010 0.014; 0.011 0.016"
                  keyTimes="0; 0.4; 0.72; 1"
                  calcMode="spline"
                  keySplines="0.45 0 0.55 1; 0.45 0 0.55 1; 0.45 0 0.55 1"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            <feGaussianBlur in="n" stdDeviation="1.1" result="nb" />
            <feDisplacementMap in="SourceGraphic" in2="nb" scale="13" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        {/* Refinement 2 (REF-01/04/05): user-selectable ground behind the
            glass — replaces the old fixed bg-art web. */}
        <AppBackground />

        <Header />

        {/* Enter-only keyed route transition. (AnimatePresence mode="wait" is
            avoided here: a held exit can block the next route from mounting on
            SPA navigation — the new screen must always appear immediately.)
            Consumes the shared `screenTransition` primitive so EVERY route —
            tab and wizard alike — enters identically (rise SHIFT.screen + fade,
            DUR.slow, EASE.standard; reduced motion handled inside the variant).
            The ONE thing that moves on navigation. */}
        <m.div
          key={location.pathname}
          variants={screenTransition}
          initial="hidden"
          animate="show"
          style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
        >
          <Routes location={location}>
            <Route path="/"           element={hasActiveState ? <Navigate to="/today" replace /> : <VideoIntro><Entry session={session} setSession={setSession} /></VideoIntro>} />
            <Route path="/welcome"    element={<VideoIntro><Entry session={session} setSession={setSession} /></VideoIntro>} />
            <Route path="/lifestyle"  element={<LifestyleSelect session={session} setSession={setSession} />} />
            <Route path="/level"      element={<LevelSelect session={session} setSession={setSession} />} />
            <Route path="/body"       element={<BodyMap session={session} setSession={setSession} />} />
            <Route path="/tests"      element={<TestEngine session={session} setSession={setSession} />} />
            <Route path="/summary"    element={<Summary session={session} setSession={setSession} />} />
            <Route path="/session"    element={<SessionPlayer session={session} />} />

            <Route path="/today"          element={<TodayView />} />
            <Route path="/protocols"      element={<ProtocolsList />} />
            <Route path="/protocol/:id"   element={<ProtocolDetail />} />
            <Route path="/modules"        element={<ModulesList />} />
            <Route path="/coach"          element={<CoachView />} />
            <Route path="/settings"       element={<SettingsView />} />
            {/* STAGED — feat/soft-v1 review only, not deployed */}
            <Route path="/soft-lab"       element={<SoftLab />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </m.div>

        <BottomNav />
        <UpdateToast />
      </div>
    </LazyMotion>
  );
}

/* ────────── header — spare: DNA-helix mark (home) + theme toggle.
   Wordmark + hamburger drawer retired (Vic explicit changes #2 + drawer→
   bottom-nav). Routine builder stays reachable via the Today empty state,
   the Today overflow ⋮ menu, and Settings → Personalised routine. ────────── */
function Header() {
  // Liquid-glass (board 05): the header is a static glass film — content
  // scrolls under it and blurs out through a fading mask. Static surface →
  // backdrop-filter allowed (perf law).
  return (
    <header
      className="px-5 py-3 flex items-center justify-between sticky top-0 z-40"
      style={{
        background: 'linear-gradient(180deg, rgb(var(--c-bg-base) / 0.82) 60%, rgb(var(--c-bg-base) / 0))',
        WebkitBackdropFilter: 'blur(var(--glass-blur-1))',
        backdropFilter: 'blur(var(--glass-blur-1))',
        WebkitMaskImage: 'linear-gradient(180deg, #000 70%, transparent)',
        maskImage: 'linear-gradient(180deg, #000 70%, transparent)',
      }}
    >
      {/* Fix 2026-06-14 (Vic): the logo must reach the homepage/landing. "/"
          redirects straight back to /today once the user has any active state
          (hasActiveState), so it dead-ended. Point home at /welcome, which
          always renders the Session-Builder landing — a reliable way back. */}
      <Link to="/welcome" aria-label="PPW home"><GlassLogo size={34} /></Link>
      <ThemeToggle />
    </header>
  );
}

/* ────────── Glass splash (2026-06-12 revamp) ──────────
   Replaces the legacy video intro (dead placeholder asset, purged per Vic's
   revamp order): the approved clear-glass logo SHIMMER variant over the
   user's background, ~1.6s then fades into the app. Reduced motion skips
   straight to content. Tap anywhere to skip. */
function VideoIntro({ children }) {
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState(() => (prefersReduced ? 'done' : 'showing'));
  const timerRef = useRef(null);
  const skipToContent = useCallback(() => { clearTimeout(timerRef.current); setPhase('done'); }, []);
  useEffect(() => {
    if (phase !== 'showing') return undefined;
    timerRef.current = setTimeout(() => setPhase('fading'), 1600);
    return () => clearTimeout(timerRef.current);
  }, [phase]);
  const handleFadeEnd = useCallback(() => { if (phase === 'fading') setPhase('done'); }, [phase]);
  if (phase === 'done') return children;
  return (
    <div className="relative min-h-screen">
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${phase === 'fading' ? 'opacity-0' : 'opacity-100'}`}
        style={{ background: 'rgb(var(--c-bg-base) / 0.55)', backdropFilter: 'blur(var(--glass-blur-2))', WebkitBackdropFilter: 'blur(var(--glass-blur-2))' }}
        onTransitionEnd={handleFadeEnd}
        onClick={skipToContent}
        role="presentation"
      >
        <GlassLogo size={150} shimmer title="Peak Performance Wellness" />
      </div>
      <div className="opacity-0">{children}</div>
    </div>
  );
}

/* ────────── Progress bar ────────── */
function ProgressBar({ current, total }) {
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;
  return (
    <div className="w-full h-1 bg-cream/5 rounded-full overflow-hidden mb-6">
      <div className="h-full bg-accent transition-all duration-500 ease-out rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Screen 1 — Entry
   ═══════════════════════════════════════════ */

function Entry({ session, setSession }) {
  const nav = useNavigate();
  const pick = (mode) => { setSession({ ...initialSession, mode }); nav(mode === 'lifestyle' ? '/lifestyle' : '/level'); };
  return (
    <main className="px-6 py-14 md:py-24 max-w-5xl mx-auto">
      <div className="mb-10 fade-in is-visible">
        <div className="eyebrow mb-5">Session Builder</div>
        <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mb-5">
          Unlock<br/>your body<span className="text-accent">.</span>
        </h1>
        <p className="text-muted max-w-xl text-lg leading-relaxed">Science-backed fascia protocols personalised to your body, your pain, your lifestyle.</p>
      </div>

      {/* 2026-06-12 revamp: legacy stock fascia imagery purged — the hero is
          a clear glass pane over the user's background, carrying the
          approved glass logo (REF-01/02 language). */}
      <div
        className="glass-strong liquid-refract relative mb-12 overflow-hidden fade-in is-visible flex items-center justify-between gap-6 p-6 md:p-8"
        style={{ borderRadius: 'var(--r-24)', minHeight: 150 }}
      >
        <div>
          <div className="eyebrow mb-1">The fascia network</div>
          <div className="font-display text-lg md:text-2xl leading-tight">Your body's living connective architecture.</div>
        </div>
        <GlassLogo size={84} title="" />
      </div>

      <div className="grid md:grid-cols-2 gap-5 fade-in fade-in-stagger is-visible">
        <button onClick={() => pick('zone')} className="card protocol-tile p-10 text-left group transition-all duration-300">
          <div className="eyebrow mb-4">01</div>
          <div className="font-display text-2xl md:text-3xl mb-3 leading-tight">Select by Body Zone</div>
          <div className="text-muted text-sm leading-relaxed">Tap the body where it hurts. Build your own stack.</div>
          <div className="text-accent text-sm mt-6 inline-flex items-center gap-1 group-hover:gap-2 transition-all">Get started <span aria-hidden="true">→</span></div>
        </button>
        <button onClick={() => pick('lifestyle')} className="card protocol-tile p-10 text-left group transition-all duration-300">
          <div className="eyebrow mb-4">02</div>
          <div className="font-display text-2xl md:text-3xl mb-3 leading-tight">Select by Lifestyle</div>
          <div className="text-muted text-sm leading-relaxed">Pick your daily work. We preset the zones for you.</div>
          <div className="text-accent text-sm mt-6 inline-flex items-center gap-1 group-hover:gap-2 transition-all">Get started <span aria-hidden="true">→</span></div>
        </button>
      </div>
      <div className="mt-8">
        <Link to="/protocols" className="text-accent text-sm underline underline-offset-4">Or browse evidence-based protocols →</Link>
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════
   Screen 2 — Lifestyle Select
   ═══════════════════════════════════════════ */
function LifestyleSelect({ session, setSession }) {
  const nav = useNavigate();
  const pick = (code) => {
    const preset = {};
    (LIFESTYLE_ZONES[code] || []).forEach(z => { preset[z] = 1; });
    setSession({ ...session, lifestyle: code, selected: preset });
    nav('/level');
  };
  return (
    <main className="px-6 py-10 max-w-5xl mx-auto">
      <Link to="/welcome" className="text-muted text-sm mb-4 inline-block hover:text-accent">← Back</Link>
      <h2 className="font-display text-3xl md:text-4xl mb-2">Your lifestyle</h2>
      <p className="text-muted mb-8">What does your average day look like?</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {LIFESTYLES.map(l => (
          <button key={l.code} onClick={() => pick(l.code)} className="card p-6 text-center transition-all duration-200 hover:scale-[1.03]">
            <div className="text-4xl mb-3">{l.icon}</div>
            <div className="font-display text-sm md:text-base">{l.label}</div>
          </button>
        ))}
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════
   Screen 3 — Level Select
   ═══════════════════════════════════════════ */
function LevelSelect({ session, setSession }) {
  const nav = useNavigate();
  const pick = (level) => { setSession({ ...session, level }); nav('/body'); };
  const levels = [
    { code: 'beginner',     title: 'Beginner',     sub: 'Easing in, no history of practice.', icon: '○' },
    { code: 'intermediate', title: 'Intermediate', sub: 'Moderately mobile, consistent routine.', icon: '◐' },
    { code: 'advanced',     title: 'Advanced',     sub: 'Strong mobility base, pushing depth.', icon: '●' },
  ];
  return (
    <main className="px-6 py-10 max-w-4xl mx-auto">
      <Link to={session.mode === 'lifestyle' ? '/lifestyle' : '/welcome'} className="text-muted text-sm mb-4 inline-block hover:text-accent">← Back</Link>
      <h2 className="font-display text-3xl md:text-4xl mb-2">Flexibility level</h2>
      <p className="text-muted mb-8">This sets which video variations load for each zone.</p>
      <div className="grid md:grid-cols-3 gap-5">
        {levels.map(l => (
          <button key={l.code} onClick={() => pick(l.code)} className="card p-8 text-left transition-all duration-200 hover:scale-[1.02]">
            <div className="text-2xl mb-3 text-accent">{l.icon}</div>
            <div className="font-display text-2xl mb-2">{l.title}</div>
            <div className="text-muted text-sm">{l.sub}</div>
          </button>
        ))}
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════
   Screen 4 — Body Map
   ═══════════════════════════════════════════ */
function BodyMap({ session, setSession }) {
  const nav = useNavigate();
  const [selected, setSelected] = useState(session.selected || {});
  const [painFor, setPainFor] = useState(null);
  const [view, setView] = useState('front');
  const [, setActiveRoutines] = useActiveRoutines();

  // v2.1: sex toggle removed (gender-neutral figure per Vic Stage 5).
  // Body view is the single source of truth — bodyZones.js parses the
  // per-view Figma SVG (body image + tagged polygons in same coord space)
  // and exposes geometry. No PNG-path fallback any more — the body lives
  // INSIDE the SVG as a base64-embedded pattern fill.
  const bodyView = useMemo(() => getBodyView(view), [view]);
  const { viewBox: vb, defs: bodyDefs, patternId, polygons } = bodyView;

  // Dominant fascia chain implied by the user's selection — drives
  // the gold overlay PNG (rendered below the hotspots, above the silhouette).
  // If Sub-Chat 3's PNG isn't in public/assets/body_zones/ yet, the <img>
  // 404s and onError hides it cleanly.
  const dominantChain = useMemo(
    () => dominantChainForZones(Object.keys(selected)),
    [selected]
  );
  const overlaySrc = dominantChain ? chainOverlayUrl(dominantChain, view) : null;
  const [overlayOk, setOverlayOk] = useState(true);
  useEffect(() => { setOverlayOk(true); }, [overlaySrc]);

  const toggle = (code) => {
    if (selected[code]) {
      const { [code]: _, ...rest } = selected;
      setSelected(rest);
    } else {
      setPainFor(code);
    }
  };
  const setPain = (lvl) => { setSelected({ ...selected, [painFor]: lvl }); setPainFor(null); };

  const totalZones = Object.keys(selected).length;
  const totalMins = useMemo(() => {
    const base = Object.entries(selected).reduce((s, [, p]) => s + (p === 3 ? 2 : 1) * DEFAULT_CLIP_SECONDS, 0);
    return Math.round(base / 60);
  }, [selected]);

  const cont = () => { setSession({ ...session, selected }); nav('/tests'); };
  const saveAsRoutine = () => {
    setActiveRoutines((r) => ({
      ...r,
      savedZones: Object.keys(selected),
      level: session.level || 'beginner',
      lifestyle: session.lifestyle || null,
    }));
    setSession({ ...session, selected });
    nav('/today');
  };

  return (
    <main className="px-4 md:px-6 py-4 md:py-6 max-w-6xl mx-auto">
      <Link to="/level" className="text-muted text-sm mb-3 inline-block hover:text-accent">← Back</Link>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl md:text-3xl">Tap your body</h2>
          <p className="text-muted text-sm">Select zones, then rate pain 1–3.</p>
        </div>
        <div className="text-right">
          <div className="text-accent text-2xl font-display">{totalZones}</div>
          <div className="text-muted text-xs uppercase tracking-wider">zones · ~{totalMins} min</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        <div className="mx-auto w-full" style={{ maxWidth: 400 }}>
          {/* v2.1: gender-neutral figure (sex toggle removed Stage 5).
              FRONT/BACK toggle + Select-all/Clear-all action button. */}
          <div className="flex justify-center items-center gap-2 mb-3 flex-wrap">
            <button onClick={() => setView('front')} className={`px-4 py-1.5 rounded-full text-xs font-display tracking-wider transition-all ${view === 'front' ? 'bg-accent text-bg' : 'bg-cream/5 text-muted hover:text-cream'}`}>FRONT</button>
            <button onClick={() => setView('back')}  className={`px-4 py-1.5 rounded-full text-xs font-display tracking-wider transition-all ${view === 'back'  ? 'bg-accent text-bg' : 'bg-cream/5 text-muted hover:text-cream'}`}>BACK</button>
            <button
              onClick={() => {
                if (Object.keys(selected).length > 0) {
                  setSelected({});
                } else {
                  // Select every zone in the current view, default pain rating 1
                  const next = {};
                  for (const p of polygons) next[p.code] = 1;
                  setSelected(next);
                }
              }}
              className="px-4 py-1.5 rounded-full text-xs font-display tracking-wider transition-all border border-accent/60 text-accent hover:bg-accent/10 hover:border-accent"
              aria-label={Object.keys(selected).length > 0 ? 'Clear all selected zones' : 'Select all zones in current view'}
            >
              {Object.keys(selected).length > 0 ? '× CLEAR ALL' : '✓ SELECT ALL'}
            </button>
          </div>
          <div className="relative" style={{ aspectRatio: `${vb.w} / ${vb.h}` }}>
            {/* Single SVG canvas — body image (as base64-embedded pattern fill)
                + polygon hotspots + chain overlay, all in the SAME coordinate
                space (front 432×1113, back 436×1203). The body image and the
                polygon geometry both come from the same per-view SVG generated
                from Vic's Figma source by tools/build-zone-svgs.mjs, so the
                polygons sit on the anatomy by construction. */}
            <svg
              viewBox={`0 0 ${vb.w} ${vb.h}`}
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Combined defs: body pattern (from Figma SVG) + selection glow.
                  The body pattern is injected via dangerouslySetInnerHTML
                  because it contains a base64 PNG that React would otherwise
                  attempt to JSX-parse. Pattern ids are namespaced per view
                  (frontBodyPattern / backBodyPattern) by build-zone-svgs.mjs
                  so both views can coexist. */}
              <defs dangerouslySetInnerHTML={{ __html: bodyDefs }} />
              <defs>
                <filter id="hotspotGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
                  <feFlood floodColor="#E8772E" floodOpacity="0.65" />
                  <feComposite in2="blur" operator="in" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* LAYER 1 — Figma-source body image, rendered as a pattern fill
                  on a viewBox-spanning rect. No PNG fetch, no figure-bounds
                  measurement, no transform — the body is inside the SVG. */}
              <rect
                width={vb.w}
                height={vb.h}
                fill={`url(#${patternId})`}
                opacity={totalZones > 0 ? 0.85 : 1}
                style={{ pointerEvents: 'none', transition: 'opacity 0.4s ease' }}
              />

              {/* Fascia-chain overlay PNG — rendered via foreignObject for
                  mixBlendMode + onError support. Aligned with body at full extent. */}
              {overlaySrc && overlayOk && (
                <foreignObject
                  x={0} y={0} width={vb.w} height={vb.h}
                  style={{ pointerEvents: 'none' }}
                >
                  <img
                    src={overlaySrc}
                    alt={`fascia chain ${dominantChain}`}
                    style={{ width: '100%', height: '100%', opacity: 0.75, mixBlendMode: 'screen', userSelect: 'none' }}
                    draggable="false"
                    onError={() => setOverlayOk(false)}
                  />
                </foreignObject>
              )}

              {/* LAYER 2+3 — one <g class="hotspot"> per zone. The hit-target
                  path comes verbatim from the Figma SVG (same `d` attribute),
                  so click geometry sits on Vic's anatomy by construction.
                  Wrapper :hover/.is-selected → label visibility CSS lives in
                  index.css so labels surface only on tap/hover. */}
              {polygons.map(({ code, d }) => {
                const z = ZONES.find(x => x.code === code);
                const isSelected = !!selected[code];
                const ariaLabel = z ? `${z.label}${z.side !== 'both' ? ' ' + z.side : ''}` : code;
                const label = zoneShortLabel(code, ZONES);
                const [cx, cy] = zoneCentroid(view, code);
                return (
                  <g key={`zone-${code}`} className={'hotspot' + (isSelected ? ' is-selected' : '')}>
                    {isSelected && (
                      <path
                        className="hotspot-feedback"
                        d={d}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                    <path
                      className={'hotspot-hit' + (isSelected ? ' is-selected' : '')}
                      d={d}
                      data-zone={code}
                      role="button"
                      tabIndex={0}
                      aria-label={ariaLabel}
                      aria-pressed={isSelected}
                      onClick={() => toggle(code)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggle(code);
                        }
                      }}
                    />
                    <text className="hotspot-label" x={cx} y={cy} style={{ pointerEvents: 'none' }}>
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="flex-1 min-w-[260px] w-full md:w-auto">
          <div className="card p-5 mb-5 max-h-[50vh] overflow-y-auto">
            <div className="text-xs text-muted uppercase tracking-wider mb-3">Selected zones</div>
            {totalZones === 0 && <div className="text-muted text-sm">Tap the body to begin.</div>}
            {Object.entries(selected).map(([code, pain]) => {
              const z = ZONES.find(x => x.code === code);
              return (
                <div key={code} className="flex items-center justify-between py-2 border-b border-cream/5 last:border-0">
                  <div>
                    <div className="font-display text-sm">{z.label}</div>
                    <div className="text-muted text-xs">{z.side} · pain {pain}{pain === 3 ? ' (×2)' : ''}</div>
                  </div>
                  <button onClick={() => toggle(code)} className="text-muted text-xs hover:text-red-400 transition-colors">✕</button>
                </div>
              );
            })}
          </div>

          <button disabled={totalZones === 0} onClick={cont} className="btn-accent w-full text-center">Continue to tests →</button>
          <button disabled={totalZones === 0} onClick={saveAsRoutine} className="btn-ghost w-full text-center mt-3">Save as my daily routine ◆</button>
        </div>
      </div>

      {painFor && (
        <div className="fixed inset-0 ppw-scrim flex items-center justify-center z-50 p-4" onClick={() => setPainFor(null)}>
          <div className="card p-6 md:p-8 w-full max-w-[340px] animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="text-xs text-muted uppercase tracking-widest mb-2">Pain level</div>
            <div className="font-display text-xl mb-5">
              {ZONES.find(z => z.code === painFor)?.label}
              <span className="text-muted text-sm ml-2">{ZONES.find(z => z.code === painFor)?.side}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setPain(n)} className="card py-5 font-display text-2xl transition-all hover:border-accent hover:scale-105">
                  {n}{n === 3 && <div className="text-xs text-accent mt-1">×2</div>}
                </button>
              ))}
            </div>
            <p className="text-muted text-xs mt-4 text-center">3 = video plays twice in your stack</p>
          </div>
        </div>
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════
   Screen 5 — Test Engine (with Skip Tests)
   ═══════════════════════════════════════════ */
function TestEngine({ session, setSession }) {
  const nav = useNavigate();
  const zoneCodes = Object.keys(session.selected);

  const testQueue = useMemo(() => {
    const q = [];
    const seenGroups = new Set();
    for (const code of zoneCodes) {
      const z = ZONES.find(x => x.code === code);
      if (!z || seenGroups.has(z.group)) continue;
      seenGroups.add(z.group);
      const count = TESTS_BY_GROUP[z.group] || 0;
      for (let i = 1; i <= count; i++) q.push({ group: z.group, label: z.label, testNumber: i });
    }
    return q;
  }, [session]);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const current = testQueue[idx];

  useEffect(() => {
    if (testQueue.length === 0) {
      const stack = buildStack(session, []);
      setSession(prev => ({ ...prev, stack }));
      nav('/summary');
    }
  }, [testQueue.length]);

  const skipAll = () => {
    const stack = buildStack(session, []);
    setSession(prev => ({ ...prev, stack }));
    nav('/summary');
  };

  if (testQueue.length === 0) return null;

  const answer = (a) => {
    const next = [...answers, { ...current, answer: a }];
    setAnswers(next);
    if (idx + 1 < testQueue.length) setIdx(idx + 1);
    else {
      const stack = buildStack(session, next);
      setSession(prev => ({ ...prev, stack }));
      nav('/summary');
    }
  };

  return (
    <main className="px-6 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Link to="/body" className="text-muted text-sm inline-block hover:text-accent">← Back to body map</Link>
        <button onClick={skipAll} className="text-xs uppercase tracking-widest text-accent border border-accent/40 rounded-full px-4 py-1.5 hover:bg-accent hover:text-bg transition-colors">Skip tests →</button>
      </div>
      <ProgressBar current={idx} total={testQueue.length} />
      <div className="text-xs text-muted uppercase tracking-widest mb-2">Test {idx + 1} of {testQueue.length} · all tests are optional</div>
      <h2 className="font-display text-2xl md:text-3xl mb-6">{current.label} · Test {current.testNumber}</h2>

      <div className="card p-3 md:p-4 mb-6">
        <MediaPlayer
          mediaPath={`/videos/tests/${current.group}/test_${String(current.testNumber).padStart(2,'0')}/media.json`}
          fallbackMp4={testVideoPath(current.group, current.testNumber)}
          autoplay
        />
      </div>

      <div className="text-center">
        <div className="font-display text-xl md:text-2xl mb-5">Does this hurt?</div>
        <div className="flex gap-4 justify-center">
          <button onClick={() => answer('yes')} className="btn-accent px-10">YES</button>
          <button onClick={() => answer('no')}  className="px-10 py-3.5 rounded-full font-bold bg-cream/5 border border-cream/10 hover:border-cream/30 transition-colors">NO</button>
        </div>
      </div>
    </main>
  );
}

/* ────────── Stack builder ────────── */
function buildStack(session, answers) {
  // Each item gets a stable `id` so SortableList (dnd-kit) can track it
  // across reorders. Format: type-zoneCodeOrGroup-N where N is a counter.
  const stack = [];
  let counter = 0;
  const nextId = (prefix) => `${prefix}-${counter++}`;
  for (const [code, pain] of Object.entries(session.selected)) {
    const z = ZONES.find(x => x.code === code);
    const item = {
      id: nextId(`zone-${code}`),
      type: 'zone',
      zoneCode: code,
      label: z.label,
      side: z.side,
      level: session.level,
      mediaPath: zoneMediaPath(code, session.level, session.lifestyle),
      videoPath: zoneVideoPath(code, session.level, session.lifestyle),
      duration: DEFAULT_CLIP_SECONDS,
      repeat: pain === 3 ? 2 : 1,
    };
    stack.push(item);
    if (pain === 3) stack.push({ ...item, id: nextId(`zone-${code}`), marker: '×2' });
  }
  for (const a of answers) {
    stack.push({
      id: nextId(`test-${a.group}-${a.testNumber}-${a.answer}`),
      type: 'test',
      zoneGroup: a.group,
      label: `${a.label} · Test ${a.testNumber} (${a.answer.toUpperCase()})`,
      side: '—',
      level: session.level,
      mediaPath: `/videos/tests/${a.group}/test_${String(a.testNumber).padStart(2,'0')}/${a.answer}/media.json`,
      videoPath: testAnswerVideoPath(a.group, a.testNumber, a.answer),
      duration: DEFAULT_CLIP_SECONDS,
      repeat: 1,
    });
  }
  return stack;
}

/* ═══════════════════════════════════════════
   Screen 6 — Summary
   ═══════════════════════════════════════════ */
function Summary({ session, setSession }) {
  const nav = useNavigate();
  const totalSecs = session.stack.reduce((s, i) => s + i.duration, 0);
  const lifestyleLabel = session.lifestyle ? LIFESTYLES.find(l => l.code === session.lifestyle)?.label : null;

  // Defensive: items missing an id (e.g. legacy session) get one assigned in-place
  const items = useMemo(() => session.stack.map((it, i) =>
    it.id ? it : { ...it, id: `legacy-${i}-${it.zoneCode || it.zoneGroup || 'x'}` }
  ), [session.stack]);

  const handleReorder = (newItems) => {
    setSession((s) => ({ ...s, stack: newItems }));
  };

  return (
    <main className="px-6 py-8 max-w-3xl mx-auto">
      <Link to="/body" className="text-muted text-sm mb-3 inline-block hover:text-accent">← Edit zones</Link>
      <h2 className="font-display text-3xl md:text-4xl mb-2">Your stack</h2>
      <p className="text-muted mb-6">
        {items.length} items · ~{Math.round(totalSecs / 60)} min
        {lifestyleLabel && <span className="text-accent"> · {lifestyleLabel}</span>}
        <span> · {session.level}</span>
      </p>
      <p className="text-muted text-xs mb-4 flex items-center gap-2">
        <span className="text-accent">≡</span>
        <span>Long-press the handle to drag and reorder.</span>
      </p>

      <div className="mb-8">
        <SortableList items={items} onReorder={handleReorder} className="space-y-2">
          {(it, dragHandleProps, i, isDragging) => (
            <div className={`card p-4 flex items-center gap-3 ${isDragging ? 'border-accent' : ''}`}>
              <button
                {...dragHandleProps}
                className="drag-handle font-display text-muted hover:text-accent w-11 h-11 flex items-center justify-center text-2xl shrink-0 -ml-1"
                title="Drag to reorder"
              >≡</button>
              <div className="font-display text-accent text-lg w-8 text-center shrink-0">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm md:text-base truncate">
                  {it.label}{it.marker && <span className="text-accent text-xs ml-2 font-bold">{it.marker}</span>}
                </div>
                <div className="text-muted text-xs truncate">{it.side} · {it.level} · {it.type}</div>
              </div>
              <div className="text-muted text-sm shrink-0">{Math.round(it.duration)}s</div>
            </div>
          )}
        </SortableList>
      </div>

      <button onClick={() => nav('/session')} className="btn-accent w-full text-center">Start Session →</button>
    </main>
  );
}

/* ═══════════════════════════════════════════
   Screen 7 — Session Player
   ═══════════════════════════════════════════ */
function SessionPlayer({ session }) {
  const [i, setI] = useState(0);
  const it = session.stack[i];
  if (!it) return (
    <main className="px-6 py-20 text-center max-w-2xl mx-auto">
      <div className="text-6xl mb-6 opacity-60">✓</div>
      <h2 className="font-display text-4xl mb-3">Session complete<span className="text-accent">.</span></h2>
      <p className="text-muted mb-8">Your fascia will thank you.</p>
      <Link to="/today" className="btn-accent inline-block">Back to today</Link>
    </main>
  );
  const pct = ((i + 1) / session.stack.length) * 100;
  return (
    <main className="px-6 py-6 md:py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-muted uppercase tracking-widest">{i + 1} / {session.stack.length}</div>
        <div className="text-xs text-muted">{Math.round(pct)}%</div>
      </div>
      <div className="w-full h-1 bg-cream/5 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-accent transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <h2 className="font-display text-2xl md:text-3xl mb-1">{it.label}</h2>
      <p className="text-muted text-sm mb-4">
        {it.side} · {it.level}
        {it.marker && <span className="text-accent font-bold ml-2">{it.marker}</span>}
      </p>
      <div className="card p-2 md:p-3 mb-6">
        <MediaPlayer mediaPath={it.mediaPath} fallbackMp4={it.videoPath} autoplay onEnded={() => setI(i + 1)} />
      </div>
      <div className="flex gap-3">
        <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="card px-5 py-3 text-sm disabled:opacity-30 transition-opacity">← Prev</button>
        <button onClick={() => setI(i + 1)} className="btn-accent flex-1 text-center">{i + 1 < session.stack.length ? 'Next →' : 'Finish →'}</button>
      </div>
    </main>
  );
}
