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
import { useActiveProtocols, useActiveModules, useActiveRoutines, useCompletedToday, useLocalStorage, useDateScopedStorage, useDailyHidden, useDailyDuplicates, useDailyMerges, useDailyTitles, useFastingPrefs, useUserStacks, useIfPrefs, useNotificationPrefs, useAutoplayPatterns, todayISO } from './state.js';
import { getMediaUrl, parseYouTubeId } from './lib/mediaStore.js';
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

const KNOWN_AUDIO_MODULES = [
  { slug: 'daytime_stress', label: 'Daytime Stress & Mind Clearing', defaultTime: '14:30' },
];

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

export default function App() {
  const [session, setSession] = useState(initialSession);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const [activeProtocols] = useActiveProtocols();
  const [activeModules] = useActiveModules();
  const [activeRoutines] = useActiveRoutines();
  const hasActiveState =
    activeProtocols.length > 0 ||
    activeModules.length > 0 ||
    (activeRoutines.savedZones?.length || 0) > 0;

  return (
    <div className="min-h-screen text-ink">
      <Header onMenu={() => setDrawerOpen(true)} />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div key={location.pathname} className="animate-fadeIn">
        <Routes>
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
          <Route path="/settings"       element={<SettingsView />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

/* ────────── header ────────── */
function Header({ onMenu }) {
  return (
    <header className="px-5 py-4 flex items-center justify-between border-b border-cream/5 sticky top-0 z-40 bg-bg/80 backdrop-blur-lg">
      <Link to="/" className="font-display text-xl tracking-tight inline-flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-accent shadow-[0_0_12px_rgba(220,169,87,0.7)]" aria-hidden="true" />
        PPW<span className="text-accent">.</span>
      </Link>
      <div className="text-xs text-muted uppercase tracking-[0.2em] hidden sm:block">Peak Performance Wellness</div>
      <button onClick={onMenu} aria-label="Menu" className="card px-3 py-2 text-sm hover:border-accent transition-colors">☰</button>
    </header>
  );
}

function NavDrawer({ open, onClose }) {
  const items = [
    { to: '/today',     label: 'Today',           icon: '◐' },
    { to: '/protocols', label: 'Protocols',       icon: '●' },
    { to: '/modules',   label: 'Audio & Modules', icon: '🎧' },
    { to: '/welcome',   label: 'Create our Personalised Release Routine', icon: '◆' },
    { to: '/settings',  label: 'Settings',        icon: '⚙' },
  ];
  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-[280px] max-w-[85vw] bg-bg border-l border-cream/10 p-6 transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="font-display text-xl">Menu</div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-accent text-2xl leading-none">×</button>
        </div>
        <nav className="flex flex-col gap-2">
          {items.map(it => (
            <Link key={it.to} to={it.to} onClick={onClose} className="card px-4 py-3 flex items-center gap-3 hover:border-accent transition-all">
              <span className="text-accent text-lg w-6 text-center">{it.icon}</span>
              <span className="font-display text-sm">{it.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-10 text-xs text-muted">PPW · v{APP_VERSION}</div>
      </aside>
    </>
  );
}

/* ────────── Video Intro ────────── */
function VideoIntro({ children }) {
  const [phase, setPhase] = useState('loading');
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const skipToContent = useCallback(() => { clearTimeout(timerRef.current); setPhase('done'); }, []);
  const handleCanPlay = useCallback(() => {
    if (phase === 'loading') {
      setPhase('playing');
      timerRef.current = setTimeout(() => setPhase('fading'), 4000);
    }
  }, [phase]);
  const handleError = useCallback(() => skipToContent(), [skipToContent]);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const handleFadeEnd = useCallback(() => { if (phase === 'fading') setPhase('done'); }, [phase]);
  if (phase === 'done') return children;
  return (
    <div className="relative min-h-screen">
      <div
        className={`fixed inset-0 z-50 bg-bg flex items-center justify-center transition-opacity duration-700 ${phase === 'fading' ? 'opacity-0' : 'opacity-100'}`}
        onTransitionEnd={handleFadeEnd}
      >
        {phase === 'loading' && <div className="text-muted text-sm animate-pulse">Loading...</div>}
        <video
          ref={videoRef}
          src={`${import.meta.env.BASE_URL || '/'}assets/intro_loop.mp4`}
          autoPlay muted loop playsInline
          className={`w-full h-full object-cover ${phase === 'loading' ? 'opacity-0' : 'opacity-100'}`}
          onCanPlay={handleCanPlay}
          onError={handleError}
        />
        {phase === 'playing' && (
          <button onClick={skipToContent} className="absolute bottom-8 right-8 text-xs text-muted/70 hover:text-cream uppercase tracking-widest transition-colors">Skip</button>
        )}
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
// Wave-2 — cinematic science divider. Register B (bioluminescent cyan on deep
// black) is correct here: this is embedded content imagery, NOT surface chrome.
// Uses `fade-in is-visible` (both classes) so it paints immediately even where
// the scroll-reveal hook isn't wired — avoids an invisible band.
function ScienceDivider({ src, label, aspect = '16 / 3' }) {
  return (
    <div className="relative my-10 rounded-xl overflow-hidden fade-in is-visible" style={{ aspectRatio: aspect }}>
      <img
        src={`${import.meta.env.BASE_URL}images/science/${src}`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="w-full h-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(10,22,40,0.88) 0%, rgba(10,22,40,0.18) 48%, rgba(10,22,40,0.88) 100%)' }}
      />
      {label && (
        <div className="absolute inset-0 flex items-center px-5">
          <span className="eyebrow">{label}</span>
        </div>
      )}
    </div>
  );
}

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

      {/* Wave-2 — cinematic fascia hero (Register B: embedded science art). */}
      <div className="relative mb-12 rounded-3xl overflow-hidden fade-in is-visible" style={{ aspectRatio: '16 / 7' }}>
        <img
          src={`${import.meta.env.BASE_URL}images/science/fascia-hero.webp`}
          alt=""
          aria-hidden="true"
          className="science-hero-img w-full h-full object-cover"
          style={{ objectPosition: 'center' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(10,22,40,0.08) 0%, rgba(10,22,40,0.30) 55%, rgba(10,22,40,0.72) 100%)' }}
        />
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
          <div className="eyebrow mb-1">The fascia network</div>
          <div className="font-display text-lg md:text-2xl text-cream leading-tight">Your body's living connective architecture.</div>
        </div>
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
      <ScienceDivider src="microtubule-divider.webp" label="Cellular mechanotransduction" aspect="16 / 2.6" />

      <div className="mt-2">
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
                  <feFlood floodColor="#f5b845" floodOpacity="0.65" />
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
        <div className="fixed inset-0 bg-bg/85 flex items-center justify-center z-50 p-4" onClick={() => setPainFor(null)}>
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

/* ═══════════════════════════════════════════
   M9 — InlineRename
   Tap a title → input → save on blur/Enter. Used by every routine card and
   every merged-stack header. Vic spec: rename ANY routine stack title.
   ═══════════════════════════════════════════ */
function InlineRename({ value, placeholder, onSave, className = '', inputClassName = '', titleClassName = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter')   { onSave(draft); setEditing(false); }
          if (e.key === 'Escape')  { setDraft(value || ''); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        className={'bg-cream/5 border border-accent/60 rounded-md px-2 py-1 text-cream focus:outline-none focus:border-accent ' + inputClassName}
        aria-label="Rename"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={'text-left hover:underline underline-offset-4 decoration-dotted decoration-accent/50 truncate ' + className + ' ' + titleClassName}
      title="Tap to rename"
    >
      {value
        ? <span>{value}</span>
        : <span className="text-muted italic">{placeholder || 'Tap to name…'}</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════
   M14 — MergedStack (compact-by-default, expandable)
   ───────────────────────────────────────────
   Parent card grouping multiple routines as TABS. Stays the SAME COMPACT
   SIZE regardless of how many routines are merged — count badge + tab dots
   only. Tap to expand → tabs visible + active tab body. Tap collapse → back
   to compact.
     - TIME LIVES ON THE STACK (single time chip; per-tab time hidden)
     - editable title (default blank → "Name this stack…" placeholder)
     - drop target: whole stack accepts a dropped routine to add a tab
     - video auto-play: if every tab is a video routine, the active video
       cascades into the next on `onEnded` per `merge.playOrder`
   ═══════════════════════════════════════════ */
function MergedStack({
  mergeId,
  merge,
  itemsById,
  isDragOver,
  onSetTitle, onUnmergeItem, onDissolve,
  onSetTime, onToggleCollapsed,
  renderTabBody,
  onDelete, onDuplicate, onAddToCalendar,
  // Iter 2 Phase 5 — selection + tab-mode props (all optional for back-compat).
  selectionChecked, onToggleSelection, selectionAriaLabel,
  onSetActiveTab,
}) {
  const ids = (merge.itemIds || []).filter(id => itemsById.has(id));
  const children = ids.map(id => itemsById.get(id));

  const collapsed = merge.collapsed !== false;

  // Phase 1.2 (2026-05-23) — stack time is the EARLIEST of children's times,
  // unless the user has explicitly set merge.time. Duration is the LONGEST.
  const earliestChildTime = useMemo(() => {
    const times = children.map(c => c.time).filter(Boolean);
    if (times.length === 0) return '';
    return times.reduce((a, b) => (a.localeCompare(b) <= 0 ? a : b));
  }, [children]);
  const stackTime = merge.time || earliestChildTime || '';
  const totalDurationMin = useMemo(() => {
    const ds = children.map(c => c.duration_min || 0);
    return ds.length ? Math.max(...ds) : 0;
  }, [children]);

  const [editingTime, setEditingTime] = useState(false);

  // Iter 2 Phase 5.3 — tabbed mode for multi-select merges.
  const mode = merge.mode || 'parallel';
  const activeTabId = merge.activeTabId || (ids[0] || null);
  const activeChild = children.find(c => c.id === activeTabId) || children[0];

  return (
    <div
      className={
        'card today-routine-card overflow-hidden transition-all relative '
        + (isDragOver ? 'border-accent ring-2 ring-accent/60 ' : '')
        + (selectionChecked ? 'ring-2 ring-accent/40 ' : '')
      }
      style={{ boxShadow: '0 0 0 1px rgba(245,184,69,0.22) inset' }}
    >
      {isDragOver && <DragMergePlusOverlay />}
      {/* COMPACT HEADER — always visible */}
      <div className="flex items-center gap-2 p-4">
        {onToggleSelection ? (
          <Tickbox
            checked={!!selectionChecked}
            onChange={onToggleSelection}
            ariaLabel={selectionAriaLabel || `Select stack: ${merge.title || 'merged stack'}`}
            kindClass="timeline-routine"
          />
        ) : (
          <span className="text-accent shrink-0 text-xl leading-none" aria-hidden>▤</span>
        )}
        {editingTime ? (
          <input
            type="time"
            autoFocus
            defaultValue={stackTime}
            onBlur={(e) => { onSetTime(mergeId, e.target.value); setEditingTime(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter')   { onSetTime(mergeId, e.currentTarget.value); setEditingTime(false); }
              if (e.key === 'Escape')  { setEditingTime(false); }
            }}
            className="font-display text-accent text-sm bg-cream/5 border border-accent rounded px-2 py-1 w-[88px] shrink-0 focus:outline-none"
            aria-label="Edit stack time"
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingTime(true); }}
            className="today-time-chip shrink-0"
            title="Tap to edit stack time"
            aria-label={`Edit stack time, currently ${stackTime}`}
          >{stackTime || '—:—'}</button>
        )}
        <div className="flex-1 min-w-0">
          <InlineRename
            value={merge.title}
            placeholder="Name this stack…"
            onSave={(v) => onSetTitle(mergeId, v)}
            titleClassName="font-display text-base block"
          />
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-accent/85 font-bold">{children.length} parallel</span>
            {totalDurationMin > 0 && (
              <span className="text-[10px] uppercase tracking-widest text-muted">{totalDurationMin} min total</span>
            )}
          </div>
        </div>
        {/* Patch 2 (2026-05-29) — inline duplicate/delete icons retired for
            cleaner rows. Both actions now live in the sticky bulk toolbar:
            select the stack (tickbox) → Duplicate (single-select) / Delete. */}
        {/* P0a (2026-06-02) — add merged stack to phone calendar. */}
        {stackTime && onAddToCalendar && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddToCalendar(mergeId, merge.title || 'Stack', stackTime, totalDurationMin || 15); }}
            className="text-muted hover:text-accent w-9 h-9 flex items-center justify-center shrink-0 transition-colors"
            aria-label="Add stack to phone calendar"
            title="Add to phone calendar (reliable lock-screen reminder)"
          ><IconCalendar /></button>
        )}
        <button
          type="button"
          onClick={() => onToggleCollapsed(mergeId, !collapsed)}
          className="text-muted text-base hover:text-accent w-9 h-9 flex items-center justify-center shrink-0"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand stack' : 'Collapse stack'}
          title={collapsed ? 'Tap to expand' : 'Tap to collapse'}
        >{collapsed ? '▾' : '▴'}</button>
      </div>

      {/* EXPANDED — tabbed view (Iter 2 Phase 5.3) OR parallel-play (M14 default) */}
      {!collapsed && mode === 'tabs' && (
        <>
          <div className="border-t border-cream/5">
            <div className="flex gap-1 overflow-x-auto px-3 pt-3 pb-2" role="tablist" aria-label="Stack tabs">
              {children.map(child => {
                const active = child.id === (activeChild?.id);
                return (
                  <button
                    key={child.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSetActiveTab && onSetActiveTab(mergeId, child.id)}
                    className={'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ' + (active ? 'bg-accent text-bg' : 'bg-cream/5 text-muted hover:text-cream')}
                    title={child.label}
                  >
                    {(child.label || '').slice(0, 24)}
                  </button>
                );
              })}
            </div>
            {activeChild && (
              <div className="p-3">
                <div className="card p-3 bg-cream/[0.02]">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <div className="font-display text-sm truncate" title={activeChild.label}>{activeChild.label}</div>
                    {activeChild.duration_min ? (
                      <span className="text-muted text-[10px] shrink-0">{activeChild.duration_min} min</span>
                    ) : null}
                  </div>
                  {renderTabBody(activeChild, mergeId)}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-cream/5 text-[11px] text-muted">
            <span>Tabbed stack · tap a tab to switch · drag another routine onto this card to add a tab.</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Unstack? Routines return as separate cards.')) onDissolve(mergeId);
              }}
              className="text-muted hover:text-accent px-2 py-1 rounded shrink-0"
              title="Unstack"
            >Unstack</button>
          </div>
        </>
      )}
      {!collapsed && mode !== 'tabs' && (
        <>
          <div className="border-t border-cream/5 p-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(children.length, 2)}, minmax(0, 1fr))` }}>
              {children.map(child => (
                <div key={child.id} className="card p-3 bg-cream/[0.02]">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <div className="font-display text-sm truncate" title={child.label}>{child.label}</div>
                    {child.duration_min ? (
                      <span className="text-muted text-[10px] shrink-0">{child.duration_min} min</span>
                    ) : null}
                  </div>
                  {renderTabBody(child, mergeId)}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-cream/5 text-[11px] text-muted">
            <span>Children play in parallel · drag another routine onto this card to add a child.</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Unstack? Routines return as separate cards.')) onDissolve(mergeId);
              }}
              className="text-muted hover:text-accent px-2 py-1 rounded shrink-0"
              title="Unstack"
            >Unstack</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Phase 1.3 — Lucide-style inline icons (no new dep) ─── */
function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconLink2() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function IconMusic() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
function IconMessageSquare() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconShoppingCart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

/* ─── Iter 2 Phase 5.1 — Tickbox + kind-dot pill ───
   Replaces the kind dot in the row between drag handle and time chip.
   Kind dot survives as a small coloured pill BEHIND the checkbox so
   category remains visible at a glance. 18×18 box, 24×24 tap target. */
function Tickbox({ checked, onChange, ariaLabel, kindClass }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className="relative w-6 h-6 shrink-0 flex items-center justify-center"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {kindClass && (
        <span
          className={`absolute inset-0 m-auto w-[22px] h-[22px] rounded-full opacity-40 ${kindClass}`}
          aria-hidden="true"
        />
      )}
      <span
        className="relative inline-block"
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: '1.5px solid #232C3B',
          backgroundColor: checked ? '#FFBB58' : '#F5EBD7',
          transition: 'background-color 120ms ease',
        }}
      >
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#232C3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </button>
  );
}

/* ─── Iter 2 Phase 6.5 — Bell icon for notifications toggle ─── */
function IconBell({ filled }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconBookOpen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
/* Iter 2 patch 1 — calendar icon for the Clear button. */
function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/* ─── Iter 2 patch 1 — Master tickbox for the toolbar ───
   State machine (Gmail-style):
     - empty  (size === 0)        → tap selects all visible
     - mixed  (0 < size < visible) → tap clears (indeterminate marker)
     - full   (size === visible)   → tap clears
   Visual mirrors the per-row Tickbox: navy border, cream fill, gold tick
   when "full"; dash glyph when "mixed". */
function MasterTickbox({ selectedCount, visibleCount, onToggle }) {
  const state = visibleCount === 0
    ? 'empty'
    : selectedCount === 0
      ? 'empty'
      : selectedCount >= visibleCount
        ? 'full'
        : 'mixed';
  const filled = state === 'full' || state === 'mixed';
  const label = state === 'full'
    ? 'Unselect all'
    : state === 'mixed'
      ? 'Clear selection (' + selectedCount + ' selected)'
      : 'Select all on this day';
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(state); }}
      className="w-9 h-9 shrink-0 flex items-center justify-center"
      role="checkbox"
      aria-checked={state === 'full' ? 'true' : state === 'mixed' ? 'mixed' : 'false'}
      aria-label={label}
      title={label}
    >
      <span
        className="relative inline-block"
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: '1.5px solid #232C3B',
          backgroundColor: filled ? '#FFBB58' : '#F5EBD7',
          transition: 'background-color 120ms ease',
        }}
      >
        {state === 'full' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#232C3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {state === 'mixed' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#232C3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        )}
      </span>
    </button>
  );
}

/* ─── Iter 2 patch 1 — ClearCalendarModal ───
   Pops from tapping the Clear button in the sticky toolbar.
   Two modes:
     - 'day'   single tap → one ISO date string.
     - 'range' first tap = start, second tap = end. Re-tap start before
                 end re-anchors the start.
   Confirm fires onConfirm({ mode, day, start, end }). Modal closes;
   caller wipes per-date storage for each impacted date.
   Visual: month grid (Mon-Sun), prev/next arrows. Selected day(s) lit
   in gold; range fill is a faint gold band; today carries a navy chip. */
function ClearCalendarModal({ open, onClose, onConfirm }) {
  const today = todayISO();
  const initialMonth = useMemo(() => {
    const d = new Date(today + 'T12:00:00');
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [today]);

  const [mode, setMode] = useState('day');
  const [day, setDay] = useState(null);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [{ y, m }, setMonth] = useState(initialMonth);

  // Reset when opening.
  useEffect(() => {
    if (open) {
      setMode('day');
      setDay(null);
      setStart(null);
      setEnd(null);
      setMonth(initialMonth);
    }
  }, [open, initialMonth]);

  const monthLabel = useMemo(() => {
    const d = new Date(y, m, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [y, m]);

  const grid = useMemo(() => {
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    // Mon=0..Sun=6 offset.
    const dayOfWeek = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < dayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(y, m, d);
      const iso = date.toISOString().slice(0, 10);
      cells.push({ d, iso });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [y, m]);

  const prevMonth = () => {
    const d = new Date(y, m - 1, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const nextMonth = () => {
    const d = new Date(y, m + 1, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  const pick = (iso) => {
    if (!iso) return;
    if (mode === 'day') {
      setDay(iso);
      return;
    }
    // range mode
    if (!start || (start && end)) {
      setStart(iso);
      setEnd(null);
      return;
    }
    // start set, no end yet
    if (iso < start) {
      // re-anchor
      setStart(iso);
      return;
    }
    setEnd(iso);
  };

  const inRange = (iso) => {
    if (mode !== 'range') return false;
    if (!start || !end) return false;
    return iso >= start && iso <= end;
  };
  const isStart = (iso) => mode === 'range' && start === iso;
  const isEnd   = (iso) => mode === 'range' && end === iso;
  const isDay   = (iso) => mode === 'day' && day === iso;

  const canConfirm = (mode === 'day' && day) || (mode === 'range' && start && end);

  const summary = mode === 'day'
    ? (day ? `Clear stacks for ${day}` : 'Pick a day')
    : (start && end ? `Clear stacks for ${start} → ${end}` : start ? 'Pick an end day' : 'Pick a start day');

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[55] bg-bg/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="card w-full max-w-md max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: '#0a1628', border: '1px solid rgba(255,187,88,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-cream/10">
          <div className="font-display text-lg">Clear stacks</div>
          <button onClick={onClose} className="text-muted hover:text-accent text-2xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="flex gap-1 p-3 border-b border-cream/10">
          <button
            type="button"
            onClick={() => { setMode('day'); setStart(null); setEnd(null); }}
            className={'flex-1 py-2 rounded-full text-xs font-bold transition-all ' + (mode === 'day' ? 'btn-accent' : 'bg-cream/5 text-muted')}
          >Single day</button>
          <button
            type="button"
            onClick={() => { setMode('range'); setDay(null); }}
            className={'flex-1 py-2 rounded-full text-xs font-bold transition-all ' + (mode === 'range' ? 'btn-accent' : 'bg-cream/5 text-muted')}
          >Date range</button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-cream/10">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center text-muted hover:text-accent" aria-label="Previous month">‹</button>
          <div className="font-display text-sm uppercase tracking-widest">{monthLabel}</div>
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center text-muted hover:text-accent" aria-label="Next month">›</button>
        </div>

        <div className="px-3 pt-2">
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-widest text-muted text-center mb-1">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => {
              if (!cell) return <div key={'gap-' + i} />;
              const isT = cell.iso === today;
              const sel = isDay(cell.iso) || isStart(cell.iso) || isEnd(cell.iso);
              const inR = inRange(cell.iso);
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => pick(cell.iso)}
                  className="aspect-square rounded-md flex items-center justify-center text-sm font-display transition-all"
                  style={{
                    backgroundColor: sel
                      ? '#FFBB58'
                      : inR
                        ? 'rgba(255,187,88,0.18)'
                        : isT
                          ? '#232C3B'
                          : 'transparent',
                    color: sel ? '#232C3B' : isT ? '#F5EBD7' : 'rgba(245,235,215,0.8)',
                    border: '1px solid ' + (sel ? '#FFBB58' : isT ? 'rgba(255,187,88,0.6)' : 'transparent'),
                  }}
                  title={cell.iso}
                >
                  {cell.d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-cream/10 space-y-3">
          <div className="text-xs text-muted text-center">{summary}</div>
          <p className="text-[10px] text-muted leading-relaxed">
            Clearing hides every stack on the chosen day(s) — your protocols, modules, and saved zones stay active on other days.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button
              type="button"
              onClick={() => {
                if (!canConfirm) return;
                onConfirm({ mode, day, start, end });
              }}
              disabled={!canConfirm}
              className="btn-accent flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >Clear</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Iter 2 Phase 7.2 — Notification Overlay (FOREGROUND-ONLY) ───
   IMPORTANT (P0a 2026-06-02): this overlay is an IN-SESSION enhancement only.
   It is driven by an in-page setTimeout (scheduleStackNotifications) which is
   FROZEN when the tab is backgrounded or the phone is locked, and does not
   exist on iOS at all. It must NOT be presented as "the phone will remind you".
   For a reliable lock-screen reminder with the app closed, the user adds the
   slot to their phone calendar (the IconCalendar action on each row → .ics) or,
   on an installed PWA, opts into Web Push (P0b). This overlay only fires while
   the app is open and in the foreground.
   Renders when a stack timer fires. Modal takes focus until user picks
   Open / Skip / Autoplay. Autoplay switch flips to ON triggers a secondary
   prompt asking whether to opt this stack+time pattern into "all future
   calendars" (Phase 7.3). */
function NotificationOverlay({ item, onOpen, onSkip, onAutoplay }) {
  const [askingFuture, setAskingFuture] = useState(false);
  if (!item) return null;
  const handleAutoplayClick = () => setAskingFuture(true);
  if (askingFuture) {
    return (
      <div className="fixed inset-0 z-[60] bg-bg/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div
          className="card w-full max-w-sm p-5"
          style={{ backgroundColor: '#0a1628', border: '1px solid #FFBB58' }}
        >
          <div className="font-display text-lg mb-2">Autoplay this stack</div>
          <p className="text-muted text-sm mb-5">
            Is this for all future calendars? If yes, this stack at <span className="text-accent">{item.time}</span> will autoplay on future days too.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { onAutoplay({ allFuture: true }); setAskingFuture(false); }}
              className="btn-accent w-full"
            >Yes — all future</button>
            <button
              type="button"
              onClick={() => { onAutoplay({ allFuture: false }); setAskingFuture(false); }}
              className="btn-ghost w-full"
            >Just this one</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[60] bg-bg/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Stack reminder">
      <div
        className="card w-full max-w-sm p-5"
        style={{ backgroundColor: '#0a1628', border: '1px solid #FFBB58' }}
      >
        <div className="text-xs uppercase tracking-widest text-accent mb-1">{item.time} · In-app reminder</div>
        <div className="font-display text-xl mb-1 leading-tight">{item.label}</div>
        {item.duration_min ? (
          <div className="text-muted text-xs mb-4">{item.duration_min} min</div>
        ) : <div className="mb-4" />}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="w-full py-3 rounded-full font-bold transition-all"
            style={{ backgroundColor: '#232C3B', color: '#F5EBD7' }}
          >Open</button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-3 rounded-full font-bold transition-all"
            style={{ backgroundColor: '#F5EBD7', color: '#232C3B' }}
          >Skip</button>
          <button
            type="button"
            onClick={handleAutoplayClick}
            className="w-full py-2 rounded-full text-xs font-bold border border-accent/40 text-accent hover:bg-accent/10 transition-all"
          >Autoplay this stack now</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Iter 2 Phase 6.4 — Add Protocol modal ───
   Lists every locally-available protocol from protocols.js LOCAL_CATALOG.
   Tap a row → activate (push id into activeProtocols). Existing TodayView
   useEffect re-fetches the protocol and merges its daily_plan into today.
   Already-active protocols render disabled with "✓ Active" badge. */
function AddProtocolModal({ open, onClose, onActivate }) {
  const [list, setList] = useState(null);
  const [activeProtocols] = useActiveProtocols();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listProtocols().then(arr => { if (!cancelled) setList(arr || []); });
    return () => { cancelled = true; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="card w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#0a1628' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream/10">
          <div className="font-display text-xl">Add Protocol</div>
          <button onClick={onClose} className="text-muted hover:text-accent text-2xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="p-4 space-y-2">
          {list == null && <div className="text-muted text-sm animate-pulse text-center py-6">Loading protocols…</div>}
          {list && list.length === 0 && (
            <div className="text-muted text-sm text-center py-6">No protocols available. Check Settings → Data source.</div>
          )}
          {list && list.map(p => {
            const isActive = activeProtocols.includes(p.protocol_id);
            const n = p.sections?.daily_plan?.length || 0;
            return (
              <button
                key={p.protocol_id}
                type="button"
                onClick={() => !isActive && onActivate(p)}
                disabled={isActive}
                className={'w-full text-left card p-4 transition-all ' + (isActive ? 'opacity-60 cursor-not-allowed' : 'hover:border-accent')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base leading-tight truncate">{p.topic}</div>
                    <div className="text-muted text-xs mt-1">{n} daily item{n === 1 ? '' : 's'} · {p.variant || ''}</div>
                  </div>
                  {isActive ? (
                    <span className="text-xs text-accent shrink-0">✓ Active</span>
                  ) : (
                    <span className="text-xs text-accent shrink-0">Add →</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Iter 2 Phase 5.5 — Drag-to-merge gold (+) overlay ───
   Renders centred over a card while its drag-over candidate state is set
   by SortableList (mergeDragOverId). pointer-events:none so it never
   intercepts drag. */
function DragMergePlusOverlay() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ pointerEvents: 'none', zIndex: 20 }}
      aria-hidden="true"
    >
      <span
        className="rounded-full flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          backgroundColor: 'rgba(255, 187, 88, 0.92)',
          boxShadow: '0 8px 28px -6px rgba(255,187,88,0.7)',
          color: '#0E0E10',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Phase 2 (2026-05-23) — UserStackBody
   Renders an inline player for a user-created stack inside the expanded
   card body. Calls onEnded when media playback completes so the parent
   can auto-advance to the next stack.
   ═══════════════════════════════════════════ */
function UserStackBody({ stack, onEnded, onPatch }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [editFields, setEditFields] = useState(false);

  useEffect(() => {
    let revoked = false;
    let url = null;
    (async () => {
      if (stack.mediaStoreId) {
        url = await getMediaUrl(stack.mediaStoreId);
        if (!revoked) setBlobUrl(url);
      }
    })();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [stack.mediaStoreId]);

  const startSec = Number(stack.startAtSec) || 0;
  const endSec = stack.endAtSec != null ? Number(stack.endAtSec) : null;

  // Auto-honour endAt for HTML5 media — pause + onEnded when timeUpdate hits endSec.
  const handleTimeUpdate = useCallback((e) => {
    if (endSec == null) return;
    const t = e.target.currentTime;
    if (t >= endSec) {
      try { e.target.pause(); } catch (_) {}
      if (onEnded) onEnded();
    }
  }, [endSec, onEnded]);

  const handleLoaded = useCallback((e) => {
    if (startSec > 0) {
      try { e.target.currentTime = startSec; } catch (_) {}
    }
  }, [startSec]);

  let player = null;
  if (stack.type === 'link') {
    if (stack.youtubeId) {
      const src = `https://www.youtube-nocookie.com/embed/${stack.youtubeId}?rel=0&modestbranding=1&playsinline=1&start=${startSec}${endSec != null ? `&end=${endSec}` : ''}`;
      player = (
        <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
          <iframe src={src} title={stack.title || 'Stack video'} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="w-full h-full" loading="lazy" />
        </div>
      );
    } else if (stack.url) {
      // Direct media URL or general embed.
      const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(stack.url);
      const isAudio = /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(stack.url);
      if (isVideo) {
        player = <video src={stack.url} controls playsInline className="w-full rounded-xl bg-black" onLoadedMetadata={handleLoaded} onTimeUpdate={handleTimeUpdate} onEnded={onEnded} />;
      } else if (isAudio) {
        player = <audio src={stack.url} controls className="w-full" onLoadedMetadata={handleLoaded} onTimeUpdate={handleTimeUpdate} onEnded={onEnded} />;
      } else {
        player = <a href={stack.url} target="_blank" rel="noopener" className="text-accent underline underline-offset-4 break-all">{stack.url}</a>;
      }
    }
  } else if (stack.type === 'image' && blobUrl) {
    player = <img src={blobUrl} alt={stack.title || ''} className="w-full rounded-xl" />;
  } else if (stack.type === 'video' && blobUrl) {
    player = <video src={blobUrl} controls playsInline className="w-full rounded-xl bg-black" onLoadedMetadata={handleLoaded} onTimeUpdate={handleTimeUpdate} onEnded={onEnded} />;
  } else if (stack.type === 'audio' && blobUrl) {
    player = <audio src={blobUrl} controls className="w-full" onLoadedMetadata={handleLoaded} onTimeUpdate={handleTimeUpdate} onEnded={onEnded} />;
  } else if (stack.type === 'text') {
    player = (
      <div className="card p-4 bg-cream/5">
        <p className="text-cream whitespace-pre-wrap">{stack.text}</p>
        <div className="text-muted text-[10px] mt-2 uppercase tracking-widest">Stays until next stack opens</div>
      </div>
    );
  } else if ((stack.type === 'image' || stack.type === 'video' || stack.type === 'audio') && !blobUrl) {
    player = <div className="text-muted text-sm">Loading media…</div>;
  }

  return (
    <div className="space-y-3">
      {player}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setEditFields(v => !v)}
          className="text-xs text-muted hover:text-accent underline underline-offset-4"
        >
          {editFields ? 'Hide fields' : 'Edit stack fields'}
        </button>
        {stack.durationSec ? <span className="text-[10px] text-muted">{stack.durationSec}s</span> : null}
      </div>
      {editFields && (
        <div className="card p-3 bg-cream/[0.02] space-y-2">
          <label className="grid grid-cols-2 gap-2 items-center text-xs">
            <span className="text-muted uppercase tracking-widest">Duration (sec)</span>
            <input type="number" min="0" value={stack.durationSec || 0} onChange={(e) => onPatch({ durationSec: Number(e.target.value) || 0 })} className="bg-cream/5 border border-cream/15 rounded px-2 py-1 text-cream focus:outline-none focus:border-accent" />
          </label>
          {(stack.type === 'link' || stack.type === 'video' || stack.type === 'audio') && (
            <>
              <label className="grid grid-cols-2 gap-2 items-center text-xs">
                <span className="text-muted uppercase tracking-widest">Start at (sec)</span>
                <input type="number" min="0" value={stack.startAtSec || 0} onChange={(e) => onPatch({ startAtSec: Number(e.target.value) || 0 })} className="bg-cream/5 border border-cream/15 rounded px-2 py-1 text-cream focus:outline-none focus:border-accent" />
              </label>
              <label className="grid grid-cols-2 gap-2 items-center text-xs">
                <span className="text-muted uppercase tracking-widest">End at (sec)</span>
                <input type="number" min="0" value={stack.endAtSec == null ? '' : stack.endAtSec} placeholder="(optional)" onChange={(e) => onPatch({ endAtSec: e.target.value === '' ? null : Number(e.target.value) })} className="bg-cream/5 border border-cream/15 rounded px-2 py-1 text-cream focus:outline-none focus:border-accent" />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Phase 1.4 (2026-05-23) — DateStrip
   Horizontal scrollable date list: previous 7 days through next 30 days.
   Today is highlighted with navy #232C3B (brand ink). The user-selected
   date is highlighted with an accent ring + accent text.
   ═══════════════════════════════════════════ */
const DateStrip = React.forwardRef(function DateStrip({ selectedDate, onSelect }, jumpRef) {
  const today = todayISO();
  const stripRef = useRef(null);
  const todayRef = useRef(null);
  // Iter 2 Phase 6.2 — expose jumpToToday() to parent via imperative ref.
  React.useImperativeHandle(jumpRef, () => ({
    jumpToToday: () => {
      if (todayRef.current && stripRef.current) {
        const node = todayRef.current;
        const parent = stripRef.current;
        const left = node.offsetLeft - parent.clientWidth / 2 + node.clientWidth / 2;
        parent.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      }
      onSelect(today);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  }), [today, onSelect]);

  const days = useMemo(() => {
    const out = [];
    const base = new Date(today + 'T12:00:00');
    for (let i = -7; i <= 30; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        iso,
        weekday: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
        day: d.getDate(),
        month: d.toLocaleDateString(undefined, { month: 'short' }),
      });
    }
    return out;
  }, [today]);

  useEffect(() => {
    if (todayRef.current && stripRef.current) {
      const node = todayRef.current;
      const parent = stripRef.current;
      const left = node.offsetLeft - parent.clientWidth / 2 + node.clientWidth / 2;
      parent.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
    }
  }, []);

  return (
    <div
      ref={stripRef}
      className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-thin"
      style={{ scrollSnapType: 'x mandatory' }}
      role="tablist"
      aria-label="Date navigation"
    >
      {days.map(d => {
        const isToday = d.iso === today;
        const isSelected = d.iso === selectedDate;
        const baseClasses = 'shrink-0 flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[56px] transition-all';
        const styleClasses = isToday
          ? 'text-cream'
          : isSelected
            ? 'text-accent border border-accent bg-cream/5'
            : 'text-muted hover:text-cream border border-cream/10';
        const inlineStyle = isToday
          ? { backgroundColor: '#232C3B', boxShadow: isSelected ? '0 0 0 2px #f5b845' : undefined }
          : {};
        return (
          <button
            key={d.iso}
            ref={isToday ? todayRef : null}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(d.iso)}
            className={`${baseClasses} ${styleClasses}`}
            style={{ ...inlineStyle, scrollSnapAlign: 'center' }}
            title={d.iso}
          >
            <span className="text-[10px] uppercase tracking-widest font-bold">{d.weekday}</span>
            <span className="font-display text-lg leading-none mt-0.5">{d.day}</span>
            <span className="text-[9px] uppercase mt-0.5 opacity-70">{d.month}</span>
          </button>
        );
      })}
    </div>
  );
});

/* ═══════════════════════════════════════════
   NEW — /today
   ═══════════════════════════════════════════ */
// Daily completion ring — gold progress arc + count. Reads already-computed
// counts (no new persisted state). Reduced-motion users still get the static arc.
function CompletionRing({ done, total }) {
  const pct = total > 0 ? done / total : 0;
  const r = 11;
  const circ = 2 * Math.PI * r;
  const allDone = total > 0 && done === total;
  return (
    <div className="flex items-center gap-1.5 shrink-0" title={`${done} of ${total} done`} aria-label={`${done} of ${total} done`}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(245,235,215,0.14)" strokeWidth="3" />
        <circle
          cx="14" cy="14" r={r} fill="none"
          stroke="#FFBB58" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <span className="text-xs text-muted tracking-wide tabular-nums">{done}/{total}{allDone ? ' ✓' : ''}</span>
    </div>
  );
}

// Consecutive-day completion streak, read from the existing
// ppw.completedToday::<DATE> storage (no new persisted state, no backend).
// A day counts toward the streak if it has >=1 completed item. Anchored to
// today, or yesterday when today is still empty, so a fresh morning doesn't
// read 0 before the first tick of the day.
function isoMinusDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function computeCompletionStreak() {
  if (typeof localStorage === 'undefined') return 0;
  const prefix = LS_KEYS.COMPLETED_TODAY + '::';
  const doneDays = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || k.indexOf(prefix) !== 0) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || 'null');
      if (Array.isArray(arr) && arr.length > 0) doneDays.add(k.slice(prefix.length));
    } catch (_) { /* skip malformed */ }
  }
  const today = todayISO();
  let anchor = doneDays.has(today) ? today : isoMinusDays(today, 1);
  let streak = 0;
  while (doneDays.has(anchor)) { streak++; anchor = isoMinusDays(anchor, 1); }
  return streak;
}

// Gold flame chip — surfaces the active streak. Hidden when streak < 1 so a
// fresh user never sees a discouraging zero.
function StreakChip({ count }) {
  if (!count || count < 1) return null;
  return (
    <div
      className="inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-1 transition-transform"
      style={{ backgroundColor: 'rgba(255,187,88,0.10)', border: '1px solid rgba(255,187,88,0.30)', minHeight: 28 }}
      title={`${count}-day streak`}
      aria-label={`${count} day streak`}
    >
      <svg width="11" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#FFBB58"
          d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"
        />
      </svg>
      <span className="text-xs font-bold tabular-nums" style={{ color: '#FFBB58' }}>{count}</span>
    </div>
  );
}

function TodayView() {
  // Phase 1.4 (2026-05-23) — selected date drives every per-date state hook.
  const [selectedDate, setSelectedDate] = useState(() => todayISO());

  const [activeProtocols, setActiveProtocols] = useActiveProtocols();
  const [activeModules, setActiveModules] = useActiveModules();
  const [activeRoutines, setActiveRoutines] = useActiveRoutines();
  const { isDone, toggle, completed } = useCompletedToday(selectedDate);
  const [dailyOrder, setDailyOrder] = useDateScopedStorage(LS_KEYS.DAILY_ORDER, selectedDate, []);
  const [timeOverrides, setTimeOverrides] = useDateScopedStorage(LS_KEYS.DAILY_TIMES, selectedDate, {});
  const { isHidden, hide, hideMany, unhideAll, hiddenIds } = useDailyHidden(selectedDate);
  const { duplicates, addDuplicate, removeDuplicate, updateDuplicateTime, clearDuplicates } = useDailyDuplicates(selectedDate);
  const {
    merges,
    mergeOnto, unmergeItem, dissolveMerge,
    setMergeTitle, setActiveTab, pruneMissing,
    setMergeTime, setPlayOrder, setCollapsed,
    setMergeMode, dissolveAll,
  } = useDailyMerges(selectedDate);
  // Phase 2 (2026-05-23) — user-created stacks per-date.
  const { stacks: userStacks, addStack: addUserStack, updateStack: updateUserStack, removeStack: removeUserStack, clearStacks: clearUserStacks } = useUserStacks(selectedDate);
  const [addModalOpen, setAddModalOpen] = useState(false);
  // Iter 2 Phase 6.4 — Add Protocol modal + transient toast.
  const [addProtocolOpen, setAddProtocolOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // Iter 2 Phase 6.2 — imperative ref into DateStrip for the Today jump.
  const dateStripRef = useRef(null);
  // Iter 2 Phase 6.5 / 7.0 — notification prefs (bell icon + scheduling gate).
  const [notifPrefs, setNotifPrefs] = useNotificationPrefs();
  const [autoplayPatterns, setAutoplayPatterns] = useAutoplayPatterns();
  // Iter 2 Phase 7.2 — currently-firing stack (drives in-app overlay).
  const [firedItem, setFiredItem] = useState(null);
  // Phase 3.1 (2026-05-23) — IF prefs (eating window + auto-arrange + notifications).
  const [ifPrefs] = useIfPrefs();
  // M9: rename any routine stack title (single OR merged).
  const { getTitle, setTitle: setItemTitle } = useDailyTitles();
  // M14 — visual feedback target during the drag-handle gesture.
  // Set when SortableList tells us the dragged card's centre overlaps a target.
  const [mergeDragOverId, setMergeDragOverId] = useState(null);

  const [protocols, setProtocols] = useState([]);
  const [moduleEntries, setModuleEntries] = useState([]);
  const [expanded, setExpanded] = useState(null);
  // id of item whose time picker is currently open
  const [editingTimeId, setEditingTimeId] = useState(null);
  // Iter 2 Phase 5 — multi-select state. Tickbox in every row toggles ids
  // into this Set; Merge/Delete operate on the full set then clear.
  // Patch 1 (2026-05-24): Merge/Delete promoted to the top sticky toolbar;
  // floating SelectionActionBar removed. Master tickbox added with Gmail
  // empty/mixed/full semantics.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);
  const toggleSelected = useCallback((id) => {
    setSelectedIds(cur => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  // Patch 1 — Clear calendar modal.
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(activeProtocols.map(id => fetchProtocol(id))).then(arr => {
      if (cancelled) return;
      setProtocols(arr.filter(Boolean));
      // M14 — sentinel: mark hydrated only AFTER the async fetch resolved.
      setHasProtocolsHydrated(true);
    });
    return () => { cancelled = true; };
  }, [activeProtocols]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(activeModules.map(async slug => {
      const known = KNOWN_AUDIO_MODULES.find(m => m.slug === slug);
      const media = await loadMedia(moduleMediaPath('audio', slug));
      return { slug, media, scheduledTime: known?.defaultTime || '14:30' };
    })).then(arr => {
      if (cancelled) return;
      setModuleEntries(arr);
      // M14 — sentinel: mark hydrated only AFTER the async fetch resolved.
      setHasModulesHydrated(true);
    });
    return () => { cancelled = true; };
  }, [activeModules]);

  const baseItems = useMemo(
    () => mergeDailyItems({ protocols, activeRoutines, activeModuleEntries: moduleEntries }),
    [protocols, activeRoutines, moduleEntries]
  );

  // Phase 2 (2026-05-23) — user-created stacks projected into the items list.
  const userStackItems = useMemo(() => {
    return userStacks.map(s => ({
      kind: 'user',
      id: s.id,
      isUserStack: true,
      userStack: s,
      time: s.time,
      category: 'user_' + s.type,
      label: s.title || s.text || s.url || '(Untitled)',
      duration_min: Math.max(0, Math.ceil((s.durationSec || 0) / 60)),
      notes: null,
    }));
  }, [userStacks]);

  // Resolve duplicate snapshots into "live" items. A duplicate carries its own
  // instanceId so deleting it never affects siblings. We rehydrate display
  // fields (label, kind, etc.) from the duplicate's own snapshot since the
  // source item may have been hidden or edited since it was created.
  const duplicateItems = useMemo(() => {
    return duplicates.map(d => ({
      kind: d.kind || 'duplicate',
      id: d.instanceId,                // unique stable id used everywhere
      isDuplicate: true,
      sourceId: d.sourceId,
      time: d.time,
      category: d.category,
      label: d.label,
      duration_min: d.duration_min || 0,
      notes: d.notes,
      media_ref: d.media_ref || null,
      fascia_routine: d.fascia_routine || null,
      zones: d.zones || null,
      level: d.level || null,
      lifestyle: d.lifestyle || null,
    }));
  }, [duplicates]);

  // Apply user-defined order, hidden filter, time overrides, and append
  // per-day duplicates. Hidden filter is applied LAST so duplicates of hidden
  // sources still show.
  const items = useMemo(() => {
    const applyOverride = (it) => timeOverrides[it.id] ? { ...it, time: timeOverrides[it.id] } : it;
    const all = [...baseItems, ...duplicateItems, ...userStackItems];
    let ordered;
    if (!dailyOrder || dailyOrder.length === 0) {
      ordered = all.map(applyOverride);
    } else {
      const byId = new Map(all.map(it => [it.id, it]));
      ordered = [];
      for (const id of dailyOrder) {
        if (byId.has(id)) {
          ordered.push(applyOverride(byId.get(id)));
          byId.delete(id);
        }
      }
      for (const it of all) if (byId.has(it.id)) ordered.push(applyOverride(it));
    }
    // N15: hide individual items without affecting siblings.
    const filtered = ordered.filter(it => !hiddenIds.includes(it.id));
    // Phase 1.1 fix (2026-05-23): only sort by time when the user has NOT
    // manually reordered. Sorting always would clobber dailyOrder on every
    // memo recompute — the "stacks snap back" bug Vic flagged.
    if (!dailyOrder || dailyOrder.length === 0) {
      filtered.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    }
    // Phase 3.1 — IF auto-arranger: move food items inside the eating window.
    return applyIfWindow(filtered, ifPrefs);
  }, [baseItems, duplicateItems, userStackItems, dailyOrder, timeOverrides, hiddenIds, ifPrefs]);

  // Lookup table for tab body rendering inside MergedStack.
  const itemsById = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  // M14 — Fully-loaded sentinel.
  // The M9 v1 caveat: on reload, the FIRST `pruneMissing` could fire before
  // every async data source had hydrated, occasionally wiping merges.
  // Sentinel flips true ONLY after protocols, moduleEntries, and duplicates
  // have ALL resolved at least once (i.e. all hydrators have fired).
  // pruneMissing is gated until then. Single-shot guard.
  const loadedSentinelRef = useRef(false);
  const [hasProtocolsHydrated, setHasProtocolsHydrated] = useState(false);
  const [hasModulesHydrated, setHasModulesHydrated] = useState(false);
  const [hasDuplicatesHydrated, setHasDuplicatesHydrated] = useState(false);

  // M14 fixed — protocols/modules hydration is set inside the .then() of
  // their respective fetch useEffects (above). duplicates comes from
  // useLocalStorage which hydrates synchronously, so we mark it on mount.
  useEffect(() => { setHasDuplicatesHydrated(true); }, []);
  // If the user has zero active protocols/modules, the fetch effect's .then()
  // still resolves immediately with [] — but we set a fallback timer here in
  // case .then never fires (e.g. cancelled before resolve).
  useEffect(() => {
    const t = setTimeout(() => {
      setHasProtocolsHydrated(true);
      setHasModulesHydrated(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loadedSentinelRef.current) return;
    if (hasProtocolsHydrated && hasModulesHydrated && hasDuplicatesHydrated) {
      loadedSentinelRef.current = true;
    }
  }, [hasProtocolsHydrated, hasModulesHydrated, hasDuplicatesHydrated]);

  useEffect(() => {
    if (!loadedSentinelRef.current) return;       // gate prune until hydrated
    if (!items) return;
    pruneMissing(items.map(it => it.id));
  }, [items, pruneMissing, hasProtocolsHydrated, hasModulesHydrated, hasDuplicatesHydrated]);

  // For the top-level list, each merge appears as ONE row anchored to its
  // first member's id. Other merge members are hidden from the top list
  // (they show as tabs inside the stack).
  const mergeLeadByItemId = useMemo(() => {
    const lead = new Map();
    const hidden = new Set();
    for (const [mid, m] of Object.entries(merges)) {
      const ids = (m.itemIds || []).filter(id => itemsById.has(id));
      if (ids.length < 2) continue;
      lead.set(ids[0], mid);
      for (let i = 1; i < ids.length; i++) hidden.add(ids[i]);
    }
    return { lead, hidden };
  }, [merges, itemsById]);

  const visibleItems = useMemo(
    () => items.filter(it => !mergeLeadByItemId.hidden.has(it.id)),
    [items, mergeLeadByItemId]
  );

  const handleReorder = (newItems) => {
    setDailyOrder(newItems.map(it => it.id));
  };

  // Renamed title (if any) > source label.
  const titleFor = useCallback((it) => getTitle(it.id, it.label), [getTitle]);

  // Shared body renderer — used for top-level cards (when expanded) AND for
  // merged-stack tab content. `inMerge` adds a "remove from stack" button.
  // Phase 2 (2026-05-23) — auto-advance: when a stack's media ends, expand
  // the next visible item so the user sees the next stack inline.
  const advanceToNext = useCallback((currentId) => {
    const idx = items.findIndex(x => x.id === currentId);
    if (idx < 0 || idx + 1 >= items.length) return;
    const next = items[idx + 1];
    setExpanded(next.id);
  }, [items]);

  const renderItemBody = (it, inMerge) => {
    const done = isDone(it.id);
    return (
      <div className={(inMerge ? '' : 'px-4 pb-4') + ' space-y-3 ' + (inMerge ? '' : 'border-t border-cream/5')}>
        {it.isUserStack && it.userStack && (
          <div className="pt-3">
            <UserStackBody
              stack={it.userStack}
              onEnded={() => advanceToNext(it.id)}
              onPatch={(patch) => updateUserStack(it.id, patch)}
            />
          </div>
        )}
        {it.notes && <p className="text-muted text-sm pt-3">{it.notes}</p>}
        {it.kind === 'routine' && it.zones && (
          <div className="pt-3">
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Saved zones</div>
            <div className="flex flex-wrap gap-2">
              {it.zones.map(z => (
                <span key={z} className="text-xs px-2 py-1 rounded-full bg-cream/5 border border-cream/10">
                  {ZONES.find(x => x.code === z)?.label || z}
                </span>
              ))}
            </div>
          </div>
        )}
        {it.media_ref && (
          <div className="pt-2">
            <DirectMediaPlayer media={it.media_ref} autoplay={inMerge} />
          </div>
        )}
        {it.fascia_routine && it.fascia_routine.body_zone_chain && (
          <div className="text-xs text-muted">
            Targets fascia chain: <span className="text-accent">{it.fascia_routine.body_zone_chain.replace(/_/g, ' ')}</span>
            {' '}({resolveRoutineZones(it.fascia_routine).length} zones)
          </div>
        )}
        <button
          onClick={() => toggle(it.id)}
          className={'w-full text-center py-2.5 rounded-full text-sm font-bold transition-all ' + (done ? 'bg-cream/10 text-muted' : 'bg-accent text-bg')}
        >
          {done ? '✓ Done — tap to undo' : 'Mark done'}
        </button>
        <button
          onClick={() => handleDuplicate(it)}
          className="w-full text-center py-2 rounded-full text-xs font-bold border border-accent/40 text-accent hover:bg-accent/5 transition-colors"
          title="Add a copy 4 hours later — drag to reorder, tap time to edit"
        >
          + Duplicate (later today)
        </button>
        {inMerge && (
          <button
            onClick={() => {
              if (window.confirm('Remove this tab from the merged stack? It returns to the main list.')) {
                unmergeItem(it.id);
              }
            }}
            className="w-full text-center py-2 rounded-full text-xs font-bold border border-accent/30 text-accent/80 hover:text-accent transition-colors"
          >
            Remove from stack
          </button>
        )}
        <button
          onClick={() => {
            if (window.confirm('Remove just this item from today? Other items in your stack stay.')) {
              handleRemoveItem(it);
            }
          }}
          className="w-full text-center py-2 rounded-full text-xs font-bold border border-cream/10 text-muted hover:text-accent hover:border-accent transition-colors"
        >
          Remove from daily plan
        </button>
      </div>
    );
  };

  // Phase 1.2 (2026-05-23) — drag-merge inherits the EARLIER start time
  // of the two cards (Vic spec: "Merged stack inherits the EARLIER start
  // time and TOTAL duration is the longer of the two — they play in
  // parallel, side by side"). Replaces M14's "destination time wins" rule.
  const handleSortableMergeDrop = useCallback((activeId, overId) => {
    if (!activeId || !overId || activeId === overId) return;
    const draggedItem = itemsById.get(activeId);
    const targetItem  = itemsById.get(overId);
    if (!draggedItem || !targetItem) return;
    const a = draggedItem.time || null;
    const b = targetItem.time || null;
    const earlier = (a && b) ? (a.localeCompare(b) <= 0 ? a : b) : (a || b || null);
    mergeOnto(activeId, overId, { time: earlier });
  }, [itemsById, mergeOnto]);

  const handleSortableDragOverChange = useCallback((info) => {
    if (info && info.isMergeZone) {
      setMergeDragOverId(info.overId);
    } else {
      setMergeDragOverId(null);
    }
  }, []);

  // Persist a new time for an item. Routine items are special-cased so the
  // change also updates the routine settings the rest of the app reads from.
  // Duplicates store their own time on the duplicate record (per-instance).
  const handleTimeChange = useCallback((it, newTime) => {
    if (!newTime) return;
    if (it.isDuplicate) {
      updateDuplicateTime(it.id, newTime);
      return;
    }
    if (it.kind === 'routine') {
      setActiveRoutines(prev => ({ ...prev, scheduledTime: newTime }));
    }
    setTimeOverrides(prev => ({ ...prev, [it.id]: newTime }));
  }, [setActiveRoutines, setTimeOverrides, updateDuplicateTime]);

  // N15: remove a SINGLE item from today's plan, leaving its siblings intact.
  // Protocols/modules/routines stay active in localStorage; we just hide the
  // individual id from the rolling "Today" view. Duplicates are removed from
  // the duplicates list directly. Bulk-clear is the explicit "Remove stack"
  // button, never a side effect.
  const handleRemoveItem = useCallback((it) => {
    if (it.isUserStack) {
      removeUserStack(it.id);
    } else if (it.isDuplicate) {
      removeDuplicate(it.id);
    } else {
      hide(it.id);
    }
    setDailyOrder(cur => (cur || []).filter(id => id !== it.id));
    setTimeOverrides(cur => {
      if (!cur || !(it.id in cur)) return cur;
      const next = { ...cur };
      delete next[it.id];
      return next;
    });
    setExpanded(prev => prev === it.id ? null : prev);
  }, [hide, removeDuplicate, removeUserStack, setDailyOrder, setTimeOverrides]);

  // N19: duplicate a routine card. Default time = source time + 4h, capped at
  // 23:59. Snapshot the display fields so the duplicate survives the source
  // being hidden later. New per-instance ID — totally independent.
  const handleDuplicate = useCallback((it) => {
    const [hh, mm] = (it.time || '08:00').split(':').map(Number);
    const total = (hh * 60 + mm + 4 * 60);
    const capped = Math.min(total, 23 * 60 + 59);
    const newH = String(Math.floor(capped / 60)).padStart(2, '0');
    const newM = String(capped % 60).padStart(2, '0');
    const newTime = `${newH}:${newM}`;
    const instanceId = `dup::${it.id}::${Date.now()}::${Math.floor(Math.random() * 9999)}`;
    addDuplicate({
      instanceId,
      sourceId: it.id,
      kind: it.kind,
      time: newTime,
      category: it.category,
      label: it.label,
      duration_min: it.duration_min || 0,
      notes: it.notes,
      media_ref: it.media_ref || null,
      fascia_routine: it.fascia_routine || null,
      zones: it.zones || null,
      level: it.level || null,
      lifestyle: it.lifestyle || null,
    });
  }, [addDuplicate]);

  // Wipe the whole stack — used when every item is ticked. Mirrors the
  // "Reset everything" action in Settings, but stays inline. Also clears
  // per-day hide + duplicate state so a fresh activation starts clean.
  const handleRemoveStack = useCallback(() => {
    setActiveProtocols([]);
    setActiveModules([]);
    setActiveRoutines(prev => ({ ...prev, savedZones: [] }));
    setDailyOrder([]);
    setTimeOverrides({});
    unhideAll();
    clearDuplicates();
    setExpanded(null);
  }, [setActiveProtocols, setActiveModules, setActiveRoutines, setDailyOrder, setTimeOverrides, unhideAll, clearDuplicates]);

  // Iter 2 Phase 5.3 — multi-select Merge. Take all selected ids, treat the
  // earliest-time card as the LEAD (target), and merge the rest onto it with
  // mode='tabs' so the expanded stack shows a tab strip instead of parallel-
  // play. Lead stack's time + duration become the merged defaults. Clears
  // selection on completion.
  const handleBulkMerge = useCallback(() => {
    if (selectedIds.size < 2) return;
    const ids = Array.from(selectedIds);
    const visible = ids
      .map(id => itemsById.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    if (visible.length < 2) { clearSelection(); return; }
    const lead = visible[0];
    const rest = visible.slice(1);
    // First merge creates the stack with tabs mode + lead time inherited.
    // Subsequent merges append into the existing stack (mode preserved).
    rest.forEach((it, i) => {
      const opts = i === 0 ? { time: lead.time || null, mode: 'tabs' } : {};
      mergeOnto(it.id, lead.id, opts);
    });
    clearSelection();
  }, [selectedIds, itemsById, mergeOnto, clearSelection]);

  // Iter 2 Phase 5.4 — multi-select Delete. Single confirmation modal then
  // hide() each. Per Vic Protocol HARD STOP: ALWAYS confirm. Clears selection.
  // Iter 2 Phase 6.4 — activate a protocol from the modal. Existing
  // TodayView useEffect on [activeProtocols] will re-fetch + merge its
  // daily_plan into items. Toast confirms count after re-hydration.
  const handleActivateProtocol = useCallback((p) => {
    setActiveProtocols(cur => cur.includes(p.protocol_id) ? cur : [...cur, p.protocol_id]);
    const n = p.sections?.daily_plan?.length || 0;
    setToast({ tone: 'ok', text: `${p.topic} added — ${n} stack${n === 1 ? '' : 's'} created today` });
    setAddProtocolOpen(false);
    setTimeout(() => setToast(null), 3500);
  }, [setActiveProtocols]);

  // Iter 2 Phase 6.5 / 7.0 — notifications toggle. First tap requests
  // Notification.permission. If granted -> enabled=true and the existing
  // scheduleNotifications useEffect handles per-stack timers. If denied,
  // show a brief banner explaining the user must enable in browser settings.
  // When toggled OFF, manual expand only — schedulers are cleared by the
  // existing useEffect cleanup when items deps change.
  const handleToggleNotifications = useCallback(async () => {
    if (notifPrefs.enabled) {
      setNotifPrefs(p => ({ ...p, enabled: false }));
      setToast({ tone: 'ok', text: 'Notifications off — routines stay manual.' });
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (typeof Notification === 'undefined') {
      setToast({ tone: 'warn', text: 'This browser does not support notifications.' });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await requestPermission();
    }
    if (perm === 'granted') {
      setNotifPrefs(p => ({ ...p, enabled: true }));
      setToast({ tone: 'ok', text: 'Notifications on. Reminders fire at each stack time.' });
      setTimeout(() => setToast(null), 3000);
    } else {
      setToast({ tone: 'warn', text: 'Notifications require permission. Open browser settings to enable.' });
      setTimeout(() => setToast(null), 4500);
    }
  }, [notifPrefs.enabled, setNotifPrefs]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size < 1) return;
    const n = selectedIds.size;
    const msg = `Delete ${n} stack${n === 1 ? '' : 's'} for this day?\n\nThis won't remove the protocol routine, just hide it from this day.`;
    if (!window.confirm(msg)) return;
    const ids = Array.from(selectedIds);
    ids.forEach(id => {
      // Patch 2 (2026-05-29) — merge-aware: a selected stack (lead item id)
      // removes ALL its children + dissolves, matching the old inline stack
      // delete icon. A plain item just hides itself.
      const leadMergeId = mergeLeadByItemId.lead.get(id);
      if (leadMergeId) {
        const m = merges[leadMergeId];
        (m?.itemIds || []).forEach(cid => {
          const child = itemsById.get(cid);
          if (child) handleRemoveItem(child);
        });
        dissolveMerge(leadMergeId);
      } else {
        const it = itemsById.get(id);
        if (it) handleRemoveItem(it);
      }
    });
    clearSelection();
  }, [selectedIds, itemsById, handleRemoveItem, clearSelection, mergeLeadByItemId, merges, dissolveMerge]);

  // Patch 2 (2026-05-29) — single-select Duplicate in the bulk toolbar, so the
  // inline per-stack duplicate icon can be retired for cleaner rows. Mirrors the
  // old inline behavior: a merged stack duplicates each child (+4h); a single
  // item duplicates itself.
  const handleBulkDuplicate = useCallback(() => {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    const leadMergeId = mergeLeadByItemId.lead.get(id);
    if (leadMergeId) {
      const m = merges[leadMergeId];
      (m?.itemIds || []).forEach(cid => {
        const child = itemsById.get(cid);
        if (child) handleDuplicate(child);
      });
    } else {
      const it = itemsById.get(id);
      if (it) handleDuplicate(it);
    }
    clearSelection();
  }, [selectedIds, mergeLeadByItemId, merges, itemsById, handleDuplicate, clearSelection]);

  // Patch 1 — master tickbox: select-all-visible / clear depending on state.
  const handleMasterToggle = useCallback((state) => {
    if (state === 'empty') {
      setSelectedIds(new Set(visibleItems.map(it => it.id)));
    } else {
      clearSelection();
    }
  }, [visibleItems, clearSelection]);

  // Patch 1 — Clear handler. Wipes per-date storage for the picked day or
  // every date in the picked range. Underlying protocols/modules/routines
  // stay active globally; only that date's view of them is hidden.
  // - For selectedDate: use the React hooks so state updates synchronously.
  // - For OTHER dates: write directly to localStorage; hooks re-read on
  //   the next navigation to that date.
  const handleClearConfirm = useCallback(({ mode, day, start, end }) => {
    const dates = [];
    if (mode === 'day' && day) {
      dates.push(day);
    } else if (mode === 'range' && start && end) {
      const a = new Date(start + 'T12:00:00');
      const b = new Date(end   + 'T12:00:00');
      const d = new Date(a);
      while (d <= b) {
        dates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }
    if (dates.length === 0) { setClearOpen(false); return; }

    // Hide-list = every date-independent id currently visible. Protocols /
    // audio / routines use stable, date-independent ids; user stacks and
    // duplicates are date-scoped and get wiped via the userStacks /
    // duplicates lanes instead.
    const dateIndependentIds = items
      .filter(it => !it.isUserStack && !it.isDuplicate)
      .map(it => it.id);

    const safeWrite = (key, value) => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    };

    for (const dt of dates) {
      if (dt === selectedDate) {
        hideMany(dateIndependentIds);
        clearDuplicates();
        clearUserStacks();
        dissolveAll();
        setDailyOrder([]);
        setTimeOverrides({});
        setExpanded(null);
        clearSelection();
      } else {
        safeWrite(`ppw.dailyHidden::${dt}`,     dateIndependentIds);
        safeWrite(`ppw.dailyDuplicates::${dt}`, []);
        safeWrite(`ppw.dailyMerges::${dt}`,     {});
        safeWrite(`ppw.userStacks::${dt}`,      []);
        safeWrite(`ppw.dailyOrder::${dt}`,      []);
        safeWrite(`ppw.dailyTimes::${dt}`,      {});
      }
    }

    setClearOpen(false);
    const summary = mode === 'day' ? day : `${start} → ${end}`;
    setToast({ tone: 'ok', text: `Cleared stacks for ${summary} (${dates.length} day${dates.length === 1 ? '' : 's'}).` });
    setTimeout(() => setToast(null), 3500);
  }, [items, selectedDate, hideMany, clearDuplicates, clearUserStacks, dissolveAll, setDailyOrder, setTimeOverrides, clearSelection]);

  // P1 (2026-06-02) — ask the browser to make storage persistent so iOS / under
  // pressure can't silently evict saved routines (the likely "added then gone
  // on mobile" cause). Best-effort, one-time on mount. If it can't be granted
  // (e.g. not installed yet) we surface a one-time hint.
  useEffect(() => {
    let on = true;
    ensurePersistentStorage().then((r) => {
      if (!on) return;
      if (r.supported && !r.persisted) {
        // Don't nag — only hint once per device that installing protects data.
        try {
          if (!localStorage.getItem('ppw.persistHintShown')) {
            localStorage.setItem('ppw.persistHintShown', '1');
          }
        } catch (_) {}
      }
    });
    return () => { on = false; };
  }, []);

  // Iter 2 Phase 7.1 — schedule stack-time fires when the bell is ON AND
  // the user is viewing today. Past days never fire; future days never
  // fire (selectedDate !== todayISO). Native Notification + onFire run
  // inside scheduleStackNotifications.
  useEffect(() => {
    if (!notifPrefs.enabled) return;
    if (selectedDate !== todayISO()) return;
    scheduleStackNotifications(items, {
      onFire: (item) => {
        const key = `${item.id}__${item.time}`;
        const autoplayOptedIn = !!(autoplayPatterns && autoplayPatterns[key]);
        if (autoplayOptedIn || notifPrefs.autoplayAll) {
          // Auto-expand inline — no overlay.
          setExpanded(item.id);
        } else {
          setFiredItem(item);
        }
      },
    });
    return () => clearAllScheduled();
  }, [items, notifPrefs.enabled, notifPrefs.autoplayAll, autoplayPatterns, selectedDate]);

  // Phase 3.1 — schedule IF window open / pre-close / close notifications.
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      scheduleIfNotifications(ifPrefs);
    }
    return () => clearIfNotifications();
  }, [ifPrefs]);

  // Phase 1.4 — heading reflects the selected date, not always "today".
  const headingDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const completedCount = items.filter(it => completed.includes(it.id)).length;
  const empty = items.length === 0;
  const allDone = !empty && completedCount === items.length;
  // Streak recomputes whenever today's completion set changes (toggle a tick).
  const streak = useMemo(() => computeCompletionStreak(), [completed, selectedDate]);

  return (
    <main className="px-5 pt-2 pb-24 max-w-3xl mx-auto">
      {/* Iter 2 Phase 6 — sticky top bar (title · date strip · action row).
          Lives below the global Header (z-40); uses z-30. Brand-pack navy
          background + 1px gold separator. Negative-x margin extends to viewport
          edges so the bar feels full-bleed inside the main column. */}
      <div
        className="sticky z-30 -mx-5 px-5 pt-2 pb-2"
        style={{
          top: 60,
          backgroundColor: '#0E0E10',
          borderBottom: '1px solid #FFBB58',
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="font-display lowercase truncate"
              style={{ fontSize: 14, color: 'rgba(245,235,215,0.78)' }}
            >{headingDate}</span>
            <button
              type="button"
              onClick={() => dateStripRef.current?.jumpToToday()}
              className="shrink-0"
              style={{
                width: 50,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#232C3B',
                color: '#F5EBD7',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: selectedDate === todayISO() ? '1px solid #FFBB58' : '1px solid transparent',
              }}
              aria-label="Jump to today"
              title="Jump to today"
            >Today</button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StreakChip count={streak} />
            {items.length > 0 && <CompletionRing done={completedCount} total={items.length} />}
          </div>
        </div>
        <DateStrip ref={dateStripRef} selectedDate={selectedDate} onSelect={setSelectedDate} />
        {/* Patch 1 (2026-05-24) — action row restructure.
            Row 1: master tickbox + Stack/Protocol pills + Clear pill + Bell (right).
            Row 2 (only when any tickbox is on): Merge / Delete pills, count chip, "deselect all" link.
            SelectionActionBar floating bar removed; bulk controls live in the sticky toolbar (Gmail-inbox pattern per Vic 2026-05-24). */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <MasterTickbox
            selectedCount={selectedIds.size}
            visibleCount={visibleItems.length}
            onToggle={handleMasterToggle}
          />
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{ backgroundColor: '#232C3B', color: '#F5EBD7', border: '1px solid rgba(255,187,88,0.4)' }}
            title="Add a custom stack"
          >
            <IconPlus />
            <span>Stack</span>
          </button>
          <button
            type="button"
            onClick={() => setAddProtocolOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{ backgroundColor: '#232C3B', color: '#F5EBD7', border: '1px solid rgba(255,187,88,0.4)' }}
            title="Add a science protocol from your library"
          >
            <IconBookOpen />
            <span>Protocol</span>
          </button>
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{ backgroundColor: 'transparent', color: '#F5EBD7', border: '1px solid rgba(245,235,215,0.25)' }}
            title="Clear stacks for a day or range"
          >
            <IconCalendar />
            <span>Clear</span>
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleToggleNotifications}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{
              backgroundColor: notifPrefs.enabled ? 'rgba(255,187,88,0.18)' : 'transparent',
              color: notifPrefs.enabled ? '#FFBB58' : 'rgba(245,235,215,0.65)',
              border: '1px solid ' + (notifPrefs.enabled ? '#FFBB58' : 'rgba(245,235,215,0.2)'),
            }}
            aria-label={notifPrefs.enabled ? 'Notifications on — tap to disable' : 'Notifications off — tap to enable'}
            aria-pressed={notifPrefs.enabled}
            title={notifPrefs.enabled ? 'Notifications on' : 'Notifications off'}
          >
            <IconBell filled={notifPrefs.enabled} />
          </button>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-cream/5 flex-wrap">
            <button
              type="button"
              onClick={handleBulkMerge}
              disabled={selectedIds.size < 2}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: selectedIds.size >= 2 ? '#FFBB58' : 'transparent',
                color: selectedIds.size >= 2 ? '#232C3B' : '#F5EBD7',
                border: '1px solid #FFBB58',
              }}
              title={selectedIds.size >= 2 ? 'Merge selected into one tabbed stack' : 'Select 2 or more to merge'}
            >
              <span>Merge ({selectedIds.size})</span>
            </button>
            {selectedIds.size === 1 && (
              <button
                type="button"
                onClick={handleBulkDuplicate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{ backgroundColor: 'transparent', color: '#F5EBD7', border: '1px solid rgba(255,187,88,0.6)' }}
                title="Duplicate the selected stack (adds a copy 4h later)"
              >
                <IconCopy />
                <span>Duplicate</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{ backgroundColor: 'transparent', color: '#F5EBD7', border: '1px solid #F5EBD7' }}
              title="Delete selected stacks from this day"
            >
              <IconTrash />
              <span>Delete</span>
            </button>
            <div className="flex-1" />
            <span className="text-[11px] text-cream/80 font-bold">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={clearSelection}
              className="w-7 h-7 flex items-center justify-center text-cream/70 hover:text-cream"
              aria-label="Clear selection"
              title="Clear selection"
            >×</button>
          </div>
        )}
      </div>

      {toast && (
        <div
          className={'mt-3 text-xs px-3 py-2 rounded-lg border ' + (toast.tone === 'ok' ? 'bg-accent/10 text-accent border-accent/30' : 'bg-cream/5 text-cream border-cream/15')}
          role="status"
        >
          {toast.text}
        </div>
      )}


      {empty && (
        <div className="card p-10 text-center fade-in is-visible">
          <img
            src={`${import.meta.env.BASE_URL}images/science/dna-helix.webp`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            width="116"
            height="116"
            className="mx-auto mb-4 rounded-2xl"
            style={{ objectFit: 'cover', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.75)' }}
          />
          <div className="font-display slot-empty-title text-2xl mb-2">Nothing scheduled yet.</div>
          <p className="text-muted text-sm mb-6 max-w-sm mx-auto leading-relaxed">Activate a protocol, save a body-zone routine, or pick an audio module — they will all show up here.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/protocols" className="btn-accent">Browse protocols</Link>
            <Link to="/welcome" className="btn-ghost">Create our Personalised Release Routine</Link>
            <Link to="/modules" className="btn-ghost">Audio modules</Link>
          </div>
        </div>
      )}

      {!empty && (
        <p className="text-muted text-xs mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-accent">≡</span>
          <span>Drag handle to reorder. Drop on another routine to merge them into a stack.</span>
          <span>Tap any title to rename.</span>
        </p>
      )}

      <SortableList
        items={visibleItems}
        onReorder={handleReorder}
        onMergeDrop={handleSortableMergeDrop}
        onDragOverChange={handleSortableDragOverChange}
        className="space-y-3 fade-in fade-in-stagger is-visible"
      >
        {(it, dragHandleProps, _i, isDragging) => {
          // M9 — render the parent MergedStack instead of a plain card when
          // this item is the LEAD member of a merge.
          const leadMergeId = mergeLeadByItemId.lead.get(it.id);
          if (leadMergeId) {
            const m = merges[leadMergeId];
            const mergeIsDragOver = mergeDragOverId === it.id;
            return (
              <div className={mergeIsDragOver ? 'merge-target-pulse' : ''}>
                <div className="flex items-stretch gap-2">
                  <button
                    {...dragHandleProps}
                    className="drag-handle font-display text-muted hover:text-accent w-11 self-stretch flex items-center justify-center text-2xl shrink-0"
                    title="Drag to reorder · drop on another routine to merge"
                  >≡</button>
                  <div className="flex-1 min-w-0">
                    <MergedStack
                      mergeId={leadMergeId}
                      merge={m}
                      itemsById={itemsById}
                      isDragOver={mergeIsDragOver}
                      onSetTitle={setMergeTitle}
                      onUnmergeItem={unmergeItem}
                      onDissolve={dissolveMerge}
                      onSetTime={setMergeTime}
                      onToggleCollapsed={setCollapsed}
                      onAddToCalendar={(mid, title, time, durationMin) => {
                        const ok = downloadSlotIcs({
                          itemId: `merge-${mid}`,
                          title: title || 'Stack',
                          dateISO: selectedDate,
                          time,
                          durationMin,
                          description: 'Merged stack',
                        });
                        setToast({ tone: ok ? 'ok' : 'err', text: ok ? 'Calendar reminder downloaded — open it to add the alarm.' : 'Could not create calendar file.' });
                        setTimeout(() => setToast(null), 3500);
                      }}
                      onSetActiveTab={setActiveTab}
                      selectionChecked={isSelected(it.id)}
                      onToggleSelection={() => toggleSelected(it.id)}
                      selectionAriaLabel={`Select stack: ${m.title || titleFor(it)}`}
                      renderTabBody={(tabItem) => renderItemBody(tabItem, true)}
                    />
                  </div>
                </div>
              </div>
            );
          }
          const done = isDone(it.id);
          const isOpen = expanded === it.id;
          const isEditingTime = editingTimeId === it.id;
          const isDragOver = mergeDragOverId === it.id;
          const customTitle = titleFor(it);
          const kindClass = `timeline-${it.kind === 'protocol' ? 'protocol' : it.kind === 'audio' ? 'audio' : 'routine'}`;
          return (
            <div
              className={`card today-routine-card overflow-hidden transition-all relative ${done ? 'timeline-done opacity-80' : ''} ${isOpen ? 'is-open' : ''} ${isDragging ? 'border-accent is-dragging' : ''} ${isDragOver ? 'merge-target-pulse ring-2 ring-accent/60 border-accent' : ''} ${isSelected(it.id) ? 'ring-2 ring-accent/40' : ''}`}
            >
              {isDragOver && <DragMergePlusOverlay />}
              <div className="flex items-center gap-2 p-4">
                <button
                  {...dragHandleProps}
                  className="drag-handle font-display text-muted hover:text-accent w-11 h-11 flex items-center justify-center text-2xl shrink-0 -ml-2"
                  title="Drag to reorder · drop on another routine to merge"
                >≡</button>
                <Tickbox
                  checked={isSelected(it.id)}
                  onChange={() => toggleSelected(it.id)}
                  ariaLabel={`Select stack: ${customTitle || it.label}`}
                  kindClass={kindClass}
                />
                {isEditingTime ? (
                  <input
                    type="time"
                    autoFocus
                    defaultValue={it.time}
                    onBlur={(e) => { handleTimeChange(it, e.target.value); setEditingTimeId(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { handleTimeChange(it, e.currentTarget.value); setEditingTimeId(null); }
                      if (e.key === 'Escape') { setEditingTimeId(null); }
                    }}
                    onChange={(e) => handleTimeChange(it, e.target.value)}
                    className="font-display text-accent text-sm bg-cream/5 border border-accent rounded px-2 py-1 w-[88px] shrink-0 focus:outline-none"
                    aria-label="Edit time"
                  />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingTimeId(it.id); }}
                    className="today-time-chip shrink-0"
                    title="Tap to edit time"
                    aria-label={`Edit time, currently ${it.time}`}
                  >{it.time}</button>
                )}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <InlineRename
                    value={customTitle === it.label ? '' : customTitle}
                    placeholder={it.label}
                    onSave={(v) => setItemTitle(it.id, v)}
                    titleClassName="timeline-label flex-1 min-w-0 text-sm"
                  />
                  {it.duration_min ? <span className="text-muted text-xs shrink-0">{it.duration_min} min</span> : null}
                  {/* Phase 3.2 (2026-05-23) — affiliate cart icon for supplement/accessory items */}
                  {(isSupplementItem(it) || isAccessoryItem(it)) && (
                    <a
                      href={affiliateUrlFor(it) || '#'}
                      target="_blank"
                      rel="noopener nofollow sponsored"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = affiliateUrlFor(it);
                        if (!url || url.startsWith('TODO_')) {
                          e.preventDefault();
                          window.alert('Affiliate link not yet configured — Vic to fill in src/config/affiliates.json.');
                        }
                      }}
                      className="text-muted hover:text-accent w-8 h-8 flex items-center justify-center shrink-0 transition-colors"
                      aria-label="Buy this product"
                      title="Buy via affiliate link"
                    ><IconShoppingCart /></a>
                  )}
                  {/* P0a (2026-06-02) — add this slot to the phone's own calendar.
                      The phone Calendar/Clock then fires a reliable lock-screen
                      alarm at slot time with the app fully closed. */}
                  {it.time && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ok = downloadSlotIcs({
                          itemId: it.id,
                          title: customTitle || it.label || 'Reminder',
                          dateISO: selectedDate,
                          time: it.time,
                          durationMin: it.duration_min || 15,
                          description: `${it.category || ''}${it.duration_min ? ` · ${it.duration_min} min` : ''}`.trim(),
                        });
                        setToast({ tone: ok ? 'ok' : 'err', text: ok ? 'Calendar reminder downloaded — open it to add the alarm.' : 'Could not create calendar file.' });
                        setTimeout(() => setToast(null), 3500);
                      }}
                      className="text-muted hover:text-accent w-8 h-8 flex items-center justify-center shrink-0 transition-colors"
                      aria-label="Add to phone calendar"
                      title="Add to phone calendar (reliable lock-screen reminder)"
                    ><IconCalendar /></button>
                  )}
                  {/* Phase 1.3 (2026-05-23) — inline duplicate + delete icons */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(it); }}
                    className="text-muted hover:text-accent w-8 h-8 flex items-center justify-center shrink-0 transition-colors"
                    aria-label="Duplicate stack"
                    title="Duplicate"
                  ><IconCopy /></button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this stack?')) handleRemoveItem(it);
                    }}
                    className="text-muted hover:text-red-400 w-8 h-8 flex items-center justify-center shrink-0 transition-colors"
                    aria-label="Delete stack"
                    title="Delete"
                  ><IconTrash /></button>
                  <button onClick={() => setExpanded(isOpen ? null : it.id)} className="text-muted text-xs px-1 py-1 shrink-0" aria-label="Toggle details">
                    {isOpen ? '▴' : '▾'}
                  </button>
                </div>
              </div>

              {isOpen && renderItemBody(it, false)}
            </div>
          );
        }}
      </SortableList>

      {allDone && (
        <div className="mt-6 card p-5 text-center border-accent">
          <div className="font-display text-lg mb-1">All ticked off ✓</div>
          <p className="text-muted text-xs mb-4">Wipe the stack to start fresh — protocols, audio, and saved zones all clear.</p>
          <button
            onClick={() => {
              if (window.confirm('Remove the whole stack? This deactivates all your protocols, audio modules, and saved zones.')) {
                handleRemoveStack();
              }
            }}
            className="btn-accent w-full"
          >
            Remove stack
          </button>
        </div>
      )}

      {/* +Add Stack + +Add Protocol moved to top action bar (Iter 2 Phase 6.3). */}

      <AddStackModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={(stack) => {
          addUserStack(stack);
          // P1 (2026-06-02) — explicit success confirmation so mobile users
          // see the add landed (the "did it save?" uncertainty was a repro lead).
          setToast({ tone: 'ok', text: `Saved ✓ ${stack.title ? '— ' + String(stack.title).slice(0, 40) : ''}` });
          setTimeout(() => setToast(null), 3000);
        }}
        defaultTime={(items[items.length - 1]?.time) || '08:00'}
      />

      <AddProtocolModal
        open={addProtocolOpen}
        onClose={() => setAddProtocolOpen(false)}
        onActivate={handleActivateProtocol}
      />

      {/* Patch 1 (2026-05-24) — floating SelectionActionBar removed; Merge/Delete now live in the sticky toolbar. */}

      <ClearCalendarModal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleClearConfirm}
      />

      <NotificationOverlay
        item={firedItem}
        onOpen={() => {
          if (firedItem) setExpanded(firedItem.id);
          setFiredItem(null);
        }}
        onSkip={() => setFiredItem(null)}
        onAutoplay={({ allFuture }) => {
          if (firedItem) {
            if (allFuture) {
              const key = `${firedItem.id}__${firedItem.time}`;
              setAutoplayPatterns(prev => ({ ...prev, [key]: true }));
            }
            setExpanded(firedItem.id);
          }
          setFiredItem(null);
        }}
      />
    </main>
  );
}

/* ═══════════════════════════════════════════
   NEW — /protocols
   ═══════════════════════════════════════════ */
function ProtocolsList() {
  const [list, setList] = useState(null);
  const [activeProtocols, setActiveProtocols] = useActiveProtocols();
  useEffect(() => { listProtocols().then(setList); }, []);

  const toggle = (id) => {
    setActiveProtocols((cur) => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      requestPermission();
    }
  };

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="text-muted text-sm inline-block hover:text-accent mb-4 transition-colors">← Today</Link>
      <div className="eyebrow mb-3">Library</div>
      <h1 className="font-display text-4xl md:text-5xl mb-3 leading-[1.02]">Protocols</h1>
      <p className="text-muted mb-6 max-w-xl leading-relaxed">Evidence-based, agent-generated. Tap to view, activate to merge into your day.</p>

      {/* Wave-2 — cinematic science banner. Register B (bioluminescent cyan on
          deep black) is correct here: this is embedded content imagery, not
          surface chrome. */}
      <div className="relative mb-8 rounded-2xl overflow-hidden fade-in is-visible" style={{ aspectRatio: '16 / 6' }}>
        <img
          src={`${import.meta.env.BASE_URL}images/science/muscle-divider.webp`}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(10,22,40,0.05) 0%, rgba(10,22,40,0.55) 100%)' }}
        />
      </div>

      {list == null && (
        <>
          <span className="sr-only" role="status">Loading protocols…</span>
          <div className="space-y-4" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-3 w-24 rounded bg-cream/10 mb-3" />
                <div className="h-6 w-2/3 rounded bg-cream/10 mb-3" />
                <div className="h-3 w-32 rounded bg-cream/5" />
              </div>
            ))}
          </div>
        </>
      )}
      {list && list.length === 0 && (
        <div className="card p-8 text-center fade-in is-visible">
          <div className="empty-orb" aria-hidden="true" />
          <div className="font-display text-lg mb-2">No protocols available yet.</div>
          <p className="text-muted text-sm">{isMockActive() ? 'Mock data is enabled but the mock file is unreachable.' : 'The remote protocol repo is empty. Flip mock mode on in Settings.'}</p>
        </div>
      )}

      <div className="space-y-4 fade-in fade-in-stagger is-visible">
        {list && list.map(p => {
          const isActive = activeProtocols.includes(p.protocol_id);
          return (
            <div key={p.protocol_id} className={`card protocol-tile p-6 ${isActive ? 'border-accent' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="eyebrow mb-2">{p.variant} · {p.kind}</div>
                  <div className="font-display text-2xl mb-2 leading-tight">{p.topic}</div>
                  <div className="text-muted text-xs tracking-wide">{p.studies_used} studies · {p.sections.daily_plan?.length || 0} daily items</div>
                </div>
                <button onClick={() => toggle(p.protocol_id)} className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${isActive ? 'bg-cream/8 text-cream border border-accent' : 'btn-accent'}`}>
                  {isActive ? '✓ Active' : 'Activate'}
                </button>
              </div>
              <Link to={`/protocol/${p.protocol_id}`} className="text-accent text-sm font-medium mt-5 inline-flex items-center gap-1 hover:gap-2 transition-all">View full protocol <span aria-hidden="true">→</span></Link>
            </div>
          );
        })}
      </div>

      {/* Wave-2 — closing science divider (ecm-mesh, Register B). Completes the
          5-asset science set; only shown once protocols have loaded. */}
      {list && list.length > 0 && (
        <ScienceDivider src="ecm-mesh.webp" label="Extracellular matrix" aspect="16 / 3" />
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════
   NEW — /protocol/:id
   ═══════════════════════════════════════════ */
function ProtocolDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [activeProtocols, setActiveProtocols] = useActiveProtocols();
  useEffect(() => { fetchProtocol(id).then(setP); }, [id]);

  if (!p) return <main className="px-5 py-10 max-w-3xl mx-auto"><div className="text-muted text-sm">Loading…</div></main>;

  const isActive = activeProtocols.includes(p.protocol_id);
  const toggle = () => setActiveProtocols(cur => cur.includes(p.protocol_id) ? cur.filter(x => x !== p.protocol_id) : [...cur, p.protocol_id]);

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto pb-16">
      <Link to="/protocols" className="text-muted text-sm inline-block hover:text-accent mb-4 transition-colors">← Protocols</Link>
      <div className="eyebrow mb-3">{p.variant} · {p.kind} · v{p.schema_version}</div>
      <h1 className="font-display text-4xl md:text-5xl mb-3 leading-[1.02]">{p.topic}</h1>
      <p className="text-muted mb-6 max-w-xl leading-relaxed">{p.studies_used} studies · generated {new Date(p.generated_at).toLocaleDateString()}</p>
      <button onClick={toggle} className={isActive ? 'btn-ghost mb-10' : 'btn-accent mb-10'}>{isActive ? '✓ Active — deactivate' : 'Activate this protocol'}</button>

      {(p.topic || '').toLowerCase().includes('fasting') && <FastingControls />}

      <Section title="The Crisis">
        <p className="text-cream/80">{p.sections.crisis.body_md}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {p.sections.crisis.stats.map((s, i) => (
            <div key={i} className="card p-4 text-center">
              <div className="font-display text-2xl text-accent">{s.value}</div>
              <div className="text-xs text-muted mt-1">{s.caption}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The Science"><p className="text-cream/80">{p.sections.science.body_md}</p></Section>
      <Section title="The Enemies"><p className="text-cream/80">{p.sections.enemies.body_md}</p></Section>

      <Section title="Supplements">
        {iherbCartAllUrl(p.sections.supplements, p.topic) && (
          <a
            className="btn-iherb-all mb-4"
            href={iherbCartAllUrl(p.sections.supplements, p.topic)}
            target="_blank"
            rel="noopener nofollow sponsored"
          >
            🛒 Add all {p.sections.supplements.filter(s => s.iherb_sku).length} to iHerb cart
          </a>
        )}
        <div className="space-y-2">
          {p.sections.supplements.map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 sm:justify-start">
                    <div className="font-display text-lg">{s.name}</div>
                    <div className="text-xs text-muted">{s.brand}</div>
                  </div>
                  <div className="text-accent text-sm">{s.dose} · {s.timing}</div>
                  <p className="text-cream/70 text-sm mt-2">{s.rationale}</p>
                </div>
                <div className="supplement-actions">
                  <a
                    className="btn-iherb"
                    href={iherbUrl(s, p.topic)}
                    target="_blank"
                    rel="noopener nofollow sponsored"
                    aria-label={`Buy ${s.name} on iHerb`}
                  >
                    🛒 Buy on iHerb
                  </a>
                  <a
                    className="btn-amazon"
                    href={amazonUkUrl(s, p.topic)}
                    target="_blank"
                    rel="noopener nofollow sponsored"
                    aria-label={`Buy ${s.name} on Amazon UK`}
                  >
                    Amazon UK
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted text-xs mt-3 leading-relaxed">
          Affiliate disclosure: PPWellness earns a commission on qualifying purchases through these links at no extra cost to you. iHerb code QCI0747 also gives you a discount.
        </p>
      </Section>

      <Section title="Nutrition">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="text-xs text-accent uppercase tracking-widest mb-2">Eat</div>
            <ul className="space-y-1 text-sm">{(p.sections.nutrition.eat || []).map((x, i) => (<li key={i}>· {typeof x === 'string' ? x : (<span><span className="text-cream">{x.name}</span>{x.mechanism ? <span className="text-muted"> — {x.mechanism}</span> : null}</span>)}</li>))}</ul>
          </div>
          <div className="card p-4">
            <div className="text-xs text-muted uppercase tracking-widest mb-2">Avoid</div>
            <ul className="space-y-1 text-sm">{(p.sections.nutrition.avoid || []).map((x, i) => (<li key={i}>· {typeof x === 'string' ? x : (<span><span className="text-cream">{x.name}</span>{x.mechanism ? <span className="text-muted"> — {x.mechanism}</span> : null}</span>)}</li>))}</ul>
          </div>
        </div>
        {p.sections.nutrition.windows && p.sections.nutrition.windows.length > 0 && (
          <div className="card p-4 mt-3">
            <div className="text-xs text-accent uppercase tracking-widest mb-2">Eating windows</div>
            <ul className="space-y-1 text-sm">{p.sections.nutrition.windows.map((x, i) => (<li key={i}>· {typeof x === 'string' ? x : (<span><span className="text-cream">{x.name || x.label}</span>{x.mechanism ? <span className="text-muted"> — {x.mechanism}</span> : null}</span>)}</li>))}</ul>
          </div>
        )}
        {p.sections.nutrition.special_notes && (
          <div className="card p-4 mt-3">
            <div className="text-xs text-accent uppercase tracking-widest mb-2">Notes</div>
            <p className="text-cream/80 text-sm">{typeof p.sections.nutrition.special_notes === 'string' ? p.sections.nutrition.special_notes : JSON.stringify(p.sections.nutrition.special_notes)}</p>
          </div>
        )}
      </Section>

      <Section title="Daily Plan">
        <div className="space-y-2">
          {p.sections.daily_plan.map((e, i) => (
            <div key={i} className="card p-3 flex gap-3">
              <span className="font-display text-accent text-sm w-12 shrink-0">{e.time}</span>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm">{e.label}</div>
                <div className="text-muted text-xs">{e.category}{e.duration_min ? ` · ${e.duration_min} min` : ''}</div>
                {e.fascia_routine?.media_ref && (<div className="text-xs text-accent mt-1">🎬 {e.fascia_routine.media_ref.title}</div>)}
                {e.media_ref && (<div className="text-xs text-accent mt-1">{e.media_ref.media_type === 'audio' ? '🎧' : '🎬'} {e.media_ref.title}</div>)}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Biomarkers">
        <div className="space-y-2">
          {p.sections.biomarkers.map((b, i) => (
            <div key={i} className="card p-4 flex justify-between items-baseline">
              <div>
                <div className="font-display text-sm">{b.name}</div>
                <div className="text-muted text-xs">{b.test} · {b.frequency}</div>
              </div>
              <div className="text-accent text-sm">{b.target_range}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Timeline">
        <div className="space-y-2">
          {p.sections.timeline.map((t, i) => (
            <div key={i} className="card p-4">
              <div className="font-display text-accent text-sm">{t.phase}</div>
              <div className="text-cream/80 text-sm mb-2">{t.focus}</div>
              <ul className="text-xs text-muted space-y-1">{t.milestones.map((m, j) => <li key={j}>· {m}</li>)}</ul>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

/* ═══════════════════════════════════════════
   N14 — Fasting interactive controls
   ═══════════════════════════════════════════ */
function FastingControls() {
  const [prefs, setPrefs] = useFastingPrefs();
  const { addDuplicate } = useDailyDuplicates();
  const [perm, setPerm] = useState(getPermissionState());
  const [now, setNow] = useState(Date.now());
  const [banner, setBanner] = useState(null);

  // Live tick — once per second so the countdown updates smoothly.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const WINDOWS = [
    { key: '16:8', label: '16:8',  fastH: 16, eatH: 8 },
    { key: '18:6', label: '18:6',  fastH: 18, eatH: 6 },
    { key: '20:4', label: '20:4',  fastH: 20, eatH: 4 },
    { key: '24h',  label: '24h',   fastH: 24, eatH: 0 },
    { key: '48h',  label: '48h',   fastH: 48, eatH: 0 },
    { key: '72h',  label: '72h',   fastH: 72, eatH: 0 },
    { key: '7day', label: '7-day', fastH: 168, eatH: 0 },
  ];
  const fastWindow = WINDOWS.find(w => w.key === prefs.windowKey) || WINDOWS[0];
  const startMs = prefs.startISO ? new Date(prefs.startISO).getTime() : null;
  const endMs   = startMs ? startMs + fastWindow.fastH * 3600000 : null;
  const halfMs  = startMs && endMs ? startMs + (endMs - startMs) / 2 : null;
  const oneHourBeforeMs = endMs ? endMs - 3600000 : null;

  const fmtCountdown = (ms) => {
    if (ms == null || ms <= 0) return '00:00:00';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h >= 24) {
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return `${d}d ${String(rh).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Phase machine: idle / pre-fast / fasting / complete.
  let phase = 'idle';
  let countdownLabel = 'Pick a window and start';
  let countdownValue = '—';
  if (startMs && endMs) {
    if (now < startMs) {
      phase = 'pre-fast';
      countdownLabel = 'Fast starts in';
      countdownValue = fmtCountdown(startMs - now);
    } else if (now >= startMs && now < endMs) {
      phase = 'fasting';
      countdownLabel = 'Break-fast in';
      countdownValue = fmtCountdown(endMs - now);
    } else {
      phase = 'complete';
      countdownLabel = 'Fast complete — eat well';
      countdownValue = '00:00:00';
    }
  }

  const startNow = () => {
    setPrefs(p => ({ ...p, startISO: new Date().toISOString() }));
    const breakAt = new Date(Date.now() + fastWindow.fastH * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setBanner({ tone: 'ok', text: 'Fast started · ' + fastWindow.label + ' window · break-fast at ' + breakAt });
  };
  const startTonightAt8 = () => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    setPrefs(p => ({ ...p, startISO: d.toISOString() }));
    setBanner({ tone: 'ok', text: 'Fast scheduled for ' + d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) });
  };
  const setCustomStart = (e) => {
    const v = e.target.value;
    if (!v) return;
    const d = new Date(v);
    setPrefs(p => ({ ...p, startISO: d.toISOString() }));
  };
  const cancelFast = () => {
    setPrefs(p => ({ ...p, startISO: null }));
    setBanner(null);
  };

  // Notification scheduling — same setTimeout approach as the daily
  // notifications module. Service worker handles click events already.
  const scheduledRef = useRef([]);
  const clearScheduled = () => { scheduledRef.current.forEach(clearTimeout); scheduledRef.current = []; };
  useEffect(() => () => clearScheduled(), []);

  const scheduleAll = async () => {
    let p = perm;
    if (p !== 'granted') {
      p = await requestPermission();
      setPerm(p);
    }
    clearScheduled();
    if (p !== 'granted') {
      setBanner({ tone: 'warn', text: 'Notifications blocked — using in-app banners instead.' });
      return;
    }
    if (!startMs || !endMs) {
      setBanner({ tone: 'warn', text: 'Set a start time first.' });
      return;
    }
    const fire = (when, title, body) => {
      const delay = when - Date.now();
      if (delay <= 0) return false;
      const t = setTimeout(() => {
        try {
          new Notification(title, { body: body, tag: 'ppw-fast-' + when, icon: (import.meta.env.BASE_URL || '/') + 'assets/body_map.png' });
        } catch (_) {}
      }, delay);
      scheduledRef.current.push(t);
      return true;
    };
    let n = 0;
    if (fire(startMs, 'PPW · Fast starting', fastWindow.label + ' window — see you on the other side.')) n++;
    if (halfMs && fire(halfMs, 'PPW · Halfway there', 'Halfway through your ' + fastWindow.label + ' fast. Hydrate, salt, walk.')) n++;
    if (oneHourBeforeMs && fire(oneHourBeforeMs, 'PPW · 1 hour to break-fast', 'Prep your meal — protein-forward, real food.')) n++;
    if (fire(endMs, 'PPW · Break-fast time', 'Eat slowly, chew well. You earned it.')) n++;
    setBanner({ tone: 'ok', text: n + ' notification' + (n === 1 ? '' : 's') + ' scheduled.' });
  };

  const addToPlan = () => {
    if (!startMs || !endMs) {
      setBanner({ tone: 'warn', text: 'Set a start time first.' });
      return;
    }
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);
    const startTimeStr = String(startDate.getHours()).padStart(2, '0') + ':' + String(startDate.getMinutes()).padStart(2, '0');
    const endTimeStr   = String(endDate.getHours()).padStart(2, '0')   + ':' + String(endDate.getMinutes()).padStart(2, '0');
    const stamp = Date.now();
    addDuplicate({
      instanceId: 'dup::fasting-start::' + stamp,
      sourceId: 'fasting-protocol-block',
      kind: 'fasting',
      time: startTimeStr,
      category: 'fasting_window',
      label: 'Fast start — ' + fastWindow.label,
      duration_min: 0,
      notes: 'Begin ' + fastWindow.label + ' fast. Water, electrolytes, black coffee/tea OK.',
    });
    addDuplicate({
      instanceId: 'dup::fasting-end::' + (stamp + 1),
      sourceId: 'fasting-protocol-block',
      kind: 'fasting',
      time: endTimeStr,
      category: 'break_fast',
      label: 'Break-fast — ' + fastWindow.label,
      duration_min: 0,
      notes: 'Open your eating window. Protein-forward, real food.',
    });
    setPrefs(p => ({ ...p, addToPlan: true }));
    setBanner({ tone: 'ok', text: "Added to today's plan — check the Today screen." });
  };

  // Default value for the datetime-local input.
  const dtLocalValue = (() => {
    const d = startMs ? new Date(startMs) : new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  })();

  const phaseColour = phase === 'fasting' ? 'text-accent' : phase === 'complete' ? 'text-cream' : 'text-muted';

  return (
    <Section title="Live fasting timer">
      <div className="card p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-muted mb-2">Window</div>
        <div className="flex flex-wrap gap-2 mb-5">
          {WINDOWS.map(w => (
            <button
              key={w.key}
              onClick={() => setPrefs(p => ({ ...p, windowKey: w.key }))}
              className={'px-4 py-2 rounded-full text-xs font-bold transition-all ' + (prefs.windowKey === w.key ? 'btn-accent' : 'btn-ghost')}
            >{w.label}</button>
          ))}
        </div>

        <div className="text-xs uppercase tracking-widest text-muted mb-2">Start</div>
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <button onClick={startNow} className="btn-accent flex-1 text-sm py-2.5">Start now</button>
          <button onClick={startTonightAt8} className="btn-ghost flex-1 text-sm py-2.5">Start tonight 8pm</button>
        </div>
        <label className="block text-xs text-muted mb-2">Or pick a custom start time:</label>
        <input
          type="datetime-local"
          value={dtLocalValue}
          onChange={setCustomStart}
          className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
          aria-label="Fast start time"
        />
      </div>

      <div className="card p-5 mb-4 text-center">
        <div className={'text-xs uppercase tracking-widest mb-2 ' + phaseColour}>{countdownLabel}</div>
        <div className="font-display text-4xl md:text-5xl text-accent mb-2 tabular-nums">{countdownValue}</div>
        {startMs && endMs && (
          <div className="text-xs text-muted">
            {new Date(startMs).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
            {' → '}
            {new Date(endMs).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        {startMs && (
          <button onClick={cancelFast} className="text-xs text-muted hover:text-accent mt-3 underline underline-offset-4">Cancel fast</button>
        )}
      </div>

      <div className="card p-5">
        <div className="font-display mb-1">Notifications & plan</div>
        <p className="text-muted text-xs mb-4">
          Schedule reminders for fast start, halfway, 1h before break-fast, and break-fast.
          Permission state: <span className="text-accent">{perm}</span>.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={scheduleAll} className="btn-accent flex-1 text-sm py-2.5">Schedule notifications</button>
          <button onClick={addToPlan} className="btn-ghost flex-1 text-sm py-2.5">Add to today's plan</button>
        </div>
        {banner && (
          <div className={'mt-3 text-xs px-3 py-2 rounded-lg ' + (banner.tone === 'ok' ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-cream/5 text-cream border border-cream/10')}>
            {banner.text}
          </div>
        )}
      </div>
    </Section>
  );
}

function Section({ title, children }) {
  const ref = useScrollFadeIn();
  return (
    <section ref={ref} className="mb-10 fade-in">
      <h2 className="font-display text-2xl md:text-3xl mb-4 leading-tight">{title}</h2>
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════
   NEW — /modules
   ═══════════════════════════════════════════ */
function ModulesList() {
  const [activeModules, setActiveModules] = useActiveModules();
  const [resolved, setResolved] = useState({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(KNOWN_AUDIO_MODULES.map(async m => [m.slug, await loadMedia(moduleMediaPath('audio', m.slug))]))
      .then(arr => { if (!cancelled) setResolved(Object.fromEntries(arr)); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (slug) => {
    setActiveModules(cur => cur.includes(slug) ? cur.filter(x => x !== slug) : [...cur, slug]);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') requestPermission();
  };

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="text-muted text-sm inline-block hover:text-accent mb-4 transition-colors">← Today</Link>
      <div className="eyebrow mb-3">Listen</div>
      <h1 className="font-display text-4xl md:text-5xl mb-3 leading-[1.02]">Audio &amp; Modules</h1>
      <p className="text-muted mb-8 max-w-xl leading-relaxed">Meditative, passive, screen-off-friendly. Add to your daily routine.</p>

      <div className="space-y-4 fade-in fade-in-stagger is-visible">
        {KNOWN_AUDIO_MODULES.map(m => {
          const media = resolved[m.slug];
          const isActive = activeModules.includes(m.slug);
          return (
            <div key={m.slug} className={`card protocol-tile p-6 ${isActive ? 'border-accent' : ''}`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-accent uppercase tracking-widest mb-1">🎧 audio · default {m.defaultTime}</div>
                  <div className="font-display text-lg">{media?.title || m.label}</div>
                  {media && <div className="text-muted text-xs">{Math.round(media.duration_sec / 60)} min</div>}
                </div>
                <button onClick={() => toggle(m.slug)} className={`px-4 py-2 rounded-full text-sm font-bold shrink-0 ${isActive ? 'bg-cream/10 text-cream border border-accent' : 'btn-accent'}`}>
                  {isActive ? '✓ Active' : 'Add to my routine'}
                </button>
              </div>
              {media && <DirectMediaPlayer media={media} />}
            </div>
          );
        })}
      </div>
    </main>
  );
}

/* P0b (2026-06-02) — "Reliable reminders" card. Explains the two delivery
   paths that ACTUALLY fire on a locked phone (calendar .ics + Web Push on an
   installed PWA) vs the in-app overlay which is foreground-only. */
function ReliableRemindersCard() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { let on = true; getPushState().then(s => { if (on) setState(s); }); return () => { on = false; }; }, []);

  const refresh = async () => setState(await getPushState());

  const enablePush = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await subscribeToPush();
      if (!r.ok && r.reason === 'ios-needs-install') {
        setMsg({ tone: 'warn', text: r.help });
      } else if (!r.ok) {
        setMsg({ tone: 'warn', text: 'Could not enable push (' + r.reason + ').' });
      } else if (r.reason === 'subscribed-local-only' || r.senderConfigured === false) {
        setMsg({ tone: 'warn', text: 'Subscribed on this device. The push SENDER is not live yet (one-time setup pending) — until then use "Add to phone calendar" for guaranteed lock-screen alerts.' });
      } else {
        setMsg({ tone: 'ok', text: 'Lock-screen push enabled on this device.' });
      }
    } finally {
      setBusy(false);
      refresh();
    }
  };

  if (!state) return null;
  const iosNeedsInstall = state.ios && !state.standalone;

  return (
    <Section title="Reminders that actually fire">
      <div className="card p-5 space-y-4">
        <div>
          <div className="font-display">1 · Add to phone calendar (most reliable)</div>
          <div className="text-muted text-xs mt-1">
            Tap the calendar icon on any timed stack to add it to your phone's own
            Calendar. The phone then alarms on the lock screen at the slot time —
            app fully closed, works on iPhone, Android and desktop, no install needed.
          </div>
        </div>

        <div className="border-t border-cream/10 pt-4">
          <div className="font-display">2 · Lock-screen push (installed app)</div>
          <div className="text-muted text-xs mt-1">
            {iosNeedsInstall
              ? INSTALL_HELP.ios
              : state.standalone
                ? 'Installed. Enable push to get reminders pushed to this device even when the app is closed.'
                : 'Install the app to your home screen first, then enable push for closed-app reminders.'}
          </div>
          {!iosNeedsInstall && state.supported && (
            <button onClick={enablePush} disabled={busy || state.subscribed} className="btn-accent mt-3 w-full">
              {state.subscribed ? '✓ Push enabled on this device' : busy ? 'Enabling…' : 'Enable lock-screen push'}
            </button>
          )}
          {!state.supported && (
            <div className="text-muted text-xs mt-3">This browser does not support Web Push.</div>
          )}
          {msg && (
            <div className="text-xs mt-3" style={{ color: msg.tone === 'ok' ? '#7CCB8E' : '#F5C56B' }}>{msg.text}</div>
          )}
          {!state.senderConfigured && (
            <div className="text-muted text-[11px] mt-3 leading-relaxed">
              Note: the off-device push sender (a free background service) is a
              one-time setup that's still pending. Until it's live, path 1
              (calendar) is the guaranteed option.
            </div>
          )}
        </div>

        <div className="border-t border-cream/10 pt-4">
          <div className="text-muted text-[11px] leading-relaxed">
            The in-app pop-up reminder only appears while the app is open in the
            foreground — it can't wake a locked phone. Use path 1 or 2 above for
            reminders that fire when the app is closed.
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   NEW — /settings
   ═══════════════════════════════════════════ */
function SettingsView() {
  const [perm, setPerm] = useState(getPermissionState());
  const [mockOverride, setMockOverride] = useLocalStorage(LS_KEYS.USE_MOCK_OVERRIDE, USE_MOCK_DATA ? 'true' : 'false');
  const [activeProtocols, setActiveProtocols] = useActiveProtocols();
  const [activeModules, setActiveModules] = useActiveModules();
  const [activeRoutines, setActiveRoutines] = useActiveRoutines();
  // Phase 3.1 (2026-05-23) — IF (Intermittent Fasting) eating-window prefs.
  const [ifPrefs, setIfPrefs] = useIfPrefs();

  const askPerm = async () => { const r = await requestPermission(); setPerm(r); };
  const clearAll = () => {
    setActiveProtocols([]);
    setActiveModules([]);
    setActiveRoutines({ savedZones: [], level: 'beginner', lifestyle: null, scheduledTime: '08:00' });
  };

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="text-muted text-sm inline-block hover:text-accent mb-4 transition-colors">← Today</Link>
      <div className="eyebrow mb-3">Configure</div>
      <h1 className="font-display text-4xl md:text-5xl mb-8 leading-[1.02]">Settings</h1>

      <Section title="Notifications">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display">Daily reminders</div>
              <div className="text-muted text-xs">Fires {NOTIFICATION_LEAD_TIME_MIN} min before each scheduled item.</div>
            </div>
            <div className="text-xs text-accent">{perm}</div>
          </div>
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button onClick={askPerm} className="btn-accent mt-4 w-full">Enable notifications</button>
          )}
          {perm === 'unsupported' && <div className="text-muted text-xs mt-3">This browser does not support notifications.</div>}
          <div className="text-muted text-[11px] mt-3 leading-relaxed">In-app reminders only fire while the app is open. For lock-screen reminders with the app closed, see "Reminders that actually fire" below.</div>
        </div>
      </Section>

      <ReliableRemindersCard />

      <Section title="Intermittent Fasting">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="font-display">Auto-arrange food into eating window</div>
              <div className="text-muted text-xs mt-1">When enabled, food items outside the window move inside automatically. Notifications fire at open · 15 min pre-close · close.</div>
            </div>
            <button
              onClick={() => setIfPrefs(p => ({ ...p, enabled: !p.enabled }))}
              className={`px-4 py-2 rounded-full text-sm font-bold shrink-0 ${ifPrefs.enabled ? 'btn-accent' : 'btn-ghost'}`}
              aria-pressed={ifPrefs.enabled}
            >
              {ifPrefs.enabled ? '✓ On' : 'Off'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted uppercase tracking-widest mb-1 block">Window opens</span>
              <input
                type="time"
                value={ifPrefs.windowStart}
                onChange={(e) => setIfPrefs(p => ({ ...p, windowStart: e.target.value }))}
                className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted uppercase tracking-widest mb-1 block">Window closes</span>
              <input
                type="time"
                value={ifPrefs.windowEnd}
                onChange={(e) => setIfPrefs(p => ({ ...p, windowEnd: e.target.value }))}
                className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
              />
            </label>
          </div>
        </div>
      </Section>

      <Section title="Data source">
        <div className="card p-5">
          <div className="font-display mb-2">Use mock protocol data</div>
          <div className="text-muted text-xs mb-4">Off = pull from the GitHub protocol repo. On = read /mock-protocol.json bundled with the app.</div>
          <div className="flex gap-2">
            <button onClick={() => setMockOverride('true')}  className={`flex-1 py-2.5 rounded-full text-sm font-bold ${mockOverride === 'true'  ? 'btn-accent' : 'btn-ghost'}`}>Mock</button>
            <button onClick={() => setMockOverride('false')} className={`flex-1 py-2.5 rounded-full text-sm font-bold ${mockOverride === 'false' ? 'btn-accent' : 'btn-ghost'}`}>Live</button>
          </div>
        </div>
      </Section>

      <Section title="Active state">
        <div className="card p-5 space-y-2 text-sm">
          <div>Protocols: <span className="text-accent">{activeProtocols.length}</span></div>
          <div>Audio modules: <span className="text-accent">{activeModules.length}</span></div>
          <div>Saved zones: <span className="text-accent">{activeRoutines.savedZones?.length || 0}</span></div>
          <button onClick={clearAll} className="btn-ghost w-full mt-4">Clear all activations</button>
        </div>
      </Section>

      <Section title="About">
        <div className="card p-5 text-sm space-y-1.5">
          <div>Version: <span className="text-accent">{APP_VERSION}</span></div>
          <div className="text-muted text-xs pt-2">Peak Performance Wellness · ppwellness.co</div>
        </div>
      </Section>
    </main>
  );
}
