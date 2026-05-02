import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, Link, useLocation, Navigate, useParams } from 'react-router-dom';
import {
  ZONES, LIFESTYLES, LIFESTYLE_ZONES, HOTSPOTS_FRONT, HOTSPOTS_BACK, TESTS_BY_GROUP,
  getHotspots, bodyFigureFile, migrateZoneCodes, BODY_VIEWBOX,
  zoneVideoPath, testVideoPath, testAnswerVideoPath, DEFAULT_CLIP_SECONDS,
  zoneMediaPath, lifestyleAllMediaPath, moduleMediaPath, loadMedia,
  FASCIA_CHAINS, ZONE_TO_CHAIN, resolveRoutineZones,
  chainOverlayUrl, dominantChainForZones,
} from './data.js';
import { useActiveProtocols, useActiveModules, useActiveRoutines, useCompletedToday, useLocalStorage } from './state.js';
import { listProtocols, fetchProtocol, mergeDailyItems, isMockActive } from './protocols.js';
import { iherbUrl, amazonUkUrl, iherbCartAllUrl } from './affiliate.js';
import { LS_KEYS, APP_VERSION, USE_MOCK_DATA, NOTIFICATION_LEAD_TIME_MIN } from './config.js';
import MediaPlayer, { DirectMediaPlayer } from './MediaPlayer.jsx';
import SortableList from './SortableList.jsx';
import { getPermissionState, requestPermission, scheduleNotifications, clearAllScheduled } from './notifications.js';

const KNOWN_AUDIO_MODULES = [
  { slug: 'daytime_stress', label: 'Daytime Stress & Mind Clearing', defaultTime: '14:30' },
];

/* ────────────────────────────────────────────
   BodyMap visual constants (Sub-Chat 6 alignment fix)
   ──────────────────────────────────────────── */

// PNG figure-bounds → viewBox affine transform.
// Source PNGs are 1024×1024 with a translucent A-pose figure that does NOT
// fill the canvas (Sub-Chat 3 left margin around it). Measured opaque-pixel
// bounds map onto the polygon grid's body extent (x∈[98,502], y∈[76,1198])
// via an `<image>` rendered with preserveAspectRatio="none".
//   Front PNG figure: x[341,689] y[64,988]  → asym 4.6%  (invisible at low op)
//   Back  PNG figure: x[373,667] y[72,1023] → asym 16.5% (figure narrower
//     in source so horizontal stretch is wider; acceptable on back view).
// If either PNG is regenerated, re-measure opaque bounds and update.
const BODY_IMAGE_TRANSFORMS = {
  front: { x: -297.87, y:  -1.71, width: 1188.78, height: 1243.43 },
  back:  { x: -414.56, y:  -8.95, width: 1407.13, height: 1208.13 },
};

// Hand-authored full-body silhouette path on the 600×1200 viewBox.
// Smooth Bezier curves connecting the major anatomical landmarks of the
// hotspot grid — head, shoulders, arms, torso, hips, thighs, calves, feet.
// Stroked-only at very low opacity (see .body-silhouette in index.css).
const BODY_SILHOUETTE_PATH = [
  'M 300 80',
  'Q 358 82 360 118',
  'Q 358 178 340 180',
  'L 350 210',
  'Q 380 225 408 260',
  'L 470 310',
  'Q 500 400 490 520',
  'Q 480 610 460 650',
  'Q 440 680 420 665',
  'L 380 605',
  'L 380 640',
  'Q 380 820 378 950',
  'L 360 1015',
  'L 350 1130',
  'Q 358 1188 320 1198',
  'L 280 1198',
  'Q 242 1188 250 1130',
  'L 240 1015',
  'L 222 950',
  'Q 220 820 220 640',
  'L 220 605',
  'L 180 665',
  'Q 160 680 140 650',
  'Q 120 610 110 520',
  'Q 100 400 130 310',
  'L 192 260',
  'Q 220 225 250 210',
  'L 260 180',
  'Q 242 178 240 118',
  'Q 242 82 300 80',
  'Z',
].join(' ');

// Short label rendered inside selected hotspot polygons. Abbreviates long
// names so they fit narrow zones. v2.1 taxonomy (kebab-case, no ITB,
// single knee zone per side).
const ZONE_LABEL_OVERRIDES = {
  'headache':              'Head',
  'jaw-left':              'Jaw L',
  'jaw-right':             'Jaw R',
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
    <header className="px-5 py-4 flex items-center justify-between border-b border-cream/5 sticky top-0 z-40 bg-bg/90 backdrop-blur-lg">
      <Link to="/" className="font-display text-xl tracking-tight">
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
    { to: '/welcome',   label: 'Build a Session', icon: '◆' },
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
function Entry({ session, setSession }) {
  const nav = useNavigate();
  const pick = (mode) => { setSession({ ...initialSession, mode }); nav(mode === 'lifestyle' ? '/lifestyle' : '/level'); };
  return (
    <main className="px-6 py-12 md:py-20 max-w-5xl mx-auto">
      <div className="mb-14">
        <div className="text-xs text-accent uppercase tracking-[0.2em] mb-4">Session Builder</div>
        <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mb-4">
          Unlock<br/>your body<span className="text-accent">.</span>
        </h1>
        <p className="text-muted max-w-xl text-lg">Science-backed fascia protocols personalised to your body, your pain, your lifestyle.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <button onClick={() => pick('zone')} className="card p-10 text-left group transition-all duration-300 hover:scale-[1.01]">
          <div className="text-xs text-accent uppercase tracking-widest mb-4 font-display">01</div>
          <div className="font-display text-2xl md:text-3xl mb-3">Select by Body Zone</div>
          <div className="text-muted text-sm">Tap the body where it hurts. Build your own stack.</div>
          <div className="text-accent text-sm mt-6 opacity-0 group-hover:opacity-100 transition-opacity">Get started →</div>
        </button>
        <button onClick={() => pick('lifestyle')} className="card p-10 text-left group transition-all duration-300 hover:scale-[1.01]">
          <div className="text-xs text-accent uppercase tracking-widest mb-4 font-display">02</div>
          <div className="font-display text-2xl md:text-3xl mb-3">Select by Lifestyle</div>
          <div className="text-muted text-sm">Pick your daily work. We preset the zones for you.</div>
          <div className="text-accent text-sm mt-6 opacity-0 group-hover:opacity-100 transition-opacity">Get started →</div>
        </button>
      </div>
      <div className="mt-10">
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
  // Hotspots resolve from view alone.
  const hotspots = useMemo(() => getHotspots(view), [view]);
  // Subpath-aware: in dev BASE_URL is '/', on GitHub Pages it's '/<repo>/'
  const baseUrl = (import.meta.env && import.meta.env.BASE_URL) || '/';
  // Three-stage fallback: new path → legacy path → silhouette path only.
  const primaryBodyImg  = `${baseUrl}assets/body_zones/${bodyFigureFile(view)}`;
  const fallbackBodyImg = `${baseUrl}assets/body_${view}.png`;
  const [bodyImgState, setBodyImgState] = useState('primary'); // 'primary' | 'fallback' | 'none'
  useEffect(() => { setBodyImgState('primary'); }, [view]);
  const currentBodyImg =
    bodyImgState === 'primary'  ? primaryBodyImg  :
    bodyImgState === 'fallback' ? fallbackBodyImg :
    null;

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
                  for (const h of hotspots) next[h.code] = 1;
                  setSelected(next);
                }
              }}
              className="px-4 py-1.5 rounded-full text-xs font-display tracking-wider transition-all border border-accent/60 text-accent hover:bg-accent/10 hover:border-accent"
              aria-label={Object.keys(selected).length > 0 ? 'Clear all selected zones' : 'Select all zones in current view'}
            >
              {Object.keys(selected).length > 0 ? '× CLEAR ALL' : '✓ SELECT ALL'}
            </button>
          </div>
          {(() => {
            const vb = BODY_VIEWBOX[view] || BODY_VIEWBOX.front;
            return (
          <div className="relative" style={{ aspectRatio: `${vb.w} / ${vb.h}` }}>
            {/* Single SVG canvas — Figma-source body PNG + polygon hotspots + chain overlay.
                viewBox matches Vic's Figma frame (FRONT 432×1113 / BACK 436×1203) so
                polygons sit exactly on the Figma-source anatomy. */}
            <svg
              viewBox={`0 0 ${vb.w} ${vb.h}`}
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Filter defs — gold glow for selected hotspots */}
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

              {/* LAYER 1 — Figma-source body PNG. Rendered at full viewBox extent
                  (no transform hack) since the PNG is rasterised from front.svg /
                  back.svg at the SAME native frame size as the polygon coords. */}
              {currentBodyImg && (
                <image
                  href={currentBodyImg}
                  x={0} y={0} width={vb.w} height={vb.h}
                  preserveAspectRatio="xMidYMid meet"
                  opacity={totalZones > 0 ? 0.85 : 1}
                  style={{ pointerEvents: 'none', transition: 'opacity 0.4s ease' }}
                  onError={() => setBodyImgState(s => s === 'primary' ? 'fallback' : 'none')}
                />
              )}

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

              {/* LAYER 2+3 — one <g class="hotspot"> per zone, containing hit
                  polygon + (when selected) feedback polygon and label. Wrapper
                  group enables :hover/.is-selected → label CSS so labels show
                  only on tap/hover instead of overlapping when many zones are
                  selected at once. */}
              {hotspots.map(h => {
                const z = ZONES.find(x => x.code === h.code);
                const isSelected = !!selected[h.code];
                const ariaLabel = z ? `${z.label}${z.side !== 'both' ? ' ' + z.side : ''}` : h.code;
                const label = zoneShortLabel(h.code, ZONES);
                return (
                  <g key={`zone-${h.code}`} className={'hotspot' + (isSelected ? ' is-selected' : '')}>
                    {isSelected && (
                      <polygon
                        className="hotspot-feedback"
                        points={h.polygon}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                    <polygon
                      className={'hotspot-hit' + (isSelected ? ' is-selected' : '')}
                      points={h.polygon}
                      data-zone={h.code}
                      role="button"
                      tabIndex={0}
                      aria-label={ariaLabel}
                      aria-pressed={isSelected}
                      onClick={() => toggle(h.code)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggle(h.code);
                        }
                      }}
                    />
                    <text className="hotspot-label" x={h.cx} y={h.cy} style={{ pointerEvents: 'none' }}>
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
            );
          })()}
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
   NEW — /today
   ═══════════════════════════════════════════ */
function TodayView() {
  const [activeProtocols] = useActiveProtocols();
  const [activeModules] = useActiveModules();
  const [activeRoutines] = useActiveRoutines();
  const { isDone, toggle, completed } = useCompletedToday();
  const [dailyOrder, setDailyOrder] = useLocalStorage(LS_KEYS.DAILY_ORDER, []);

  const [protocols, setProtocols] = useState([]);
  const [moduleEntries, setModuleEntries] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(activeProtocols.map(id => fetchProtocol(id))).then(arr => {
      if (cancelled) return;
      setProtocols(arr.filter(Boolean));
    });
    return () => { cancelled = true; };
  }, [activeProtocols]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(activeModules.map(async slug => {
      const known = KNOWN_AUDIO_MODULES.find(m => m.slug === slug);
      const media = await loadMedia(moduleMediaPath('audio', slug));
      return { slug, media, scheduledTime: known?.defaultTime || '14:30' };
    })).then(arr => { if (!cancelled) setModuleEntries(arr); });
    return () => { cancelled = true; };
  }, [activeModules]);

  const baseItems = useMemo(
    () => mergeDailyItems({ protocols, activeRoutines, activeModuleEntries: moduleEntries }),
    [protocols, activeRoutines, moduleEntries]
  );

  // Apply user-defined order: known ids first (in saved order), unknown ids
  // appended at end. Keeps notification times intact (drag is display-only).
  const items = useMemo(() => {
    if (!dailyOrder || dailyOrder.length === 0) return baseItems;
    const byId = new Map(baseItems.map(it => [it.id, it]));
    const ordered = [];
    for (const id of dailyOrder) {
      if (byId.has(id)) {
        ordered.push(byId.get(id));
        byId.delete(id);
      }
    }
    for (const it of baseItems) if (byId.has(it.id)) ordered.push(it);
    return ordered;
  }, [baseItems, dailyOrder]);

  const handleReorder = (newItems) => {
    setDailyOrder(newItems.map(it => it.id));
  };

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      scheduleNotifications(items);
    }
    return () => clearAllScheduled();
  }, [items]);

  const todayDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const completedCount = items.filter(it => completed.includes(it.id)).length;
  const empty = items.length === 0;

  return (
    <main className="px-5 py-6 max-w-3xl mx-auto pb-24">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-xs text-accent uppercase tracking-[0.25em]">Today</div>
        <div className="text-xs text-muted">{completedCount}/{items.length} done</div>
      </div>
      <h1 className="font-display text-3xl md:text-4xl mb-6">{todayDate}</h1>

      {empty && (
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4 opacity-40">○</div>
          <div className="font-display text-xl mb-2">Nothing scheduled yet.</div>
          <p className="text-muted text-sm mb-6">Activate a protocol, save a body-zone routine, or pick an audio module — they will all show up here.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/protocols" className="btn-accent">Browse protocols</Link>
            <Link to="/welcome" className="btn-ghost">Build a session</Link>
            <Link to="/modules" className="btn-ghost">Audio modules</Link>
          </div>
        </div>
      )}

      {!empty && (
        <p className="text-muted text-xs mb-3 flex items-center gap-2">
          <span className="text-accent">≡</span>
          <span>Long-press the handle to drag and reorder. Notification times stay scheduled to the clock.</span>
        </p>
      )}

      <SortableList items={items} onReorder={handleReorder} className="space-y-2.5">
        {(it, dragHandleProps, _i, isDragging) => {
          const done = isDone(it.id);
          const isOpen = expanded === it.id;
          return (
            <div className={`card overflow-hidden transition-all ${done ? 'timeline-done opacity-80' : ''} ${isDragging ? 'border-accent' : ''}`}>
              <div className="flex items-center gap-2 p-4">
                <button
                  {...dragHandleProps}
                  className="drag-handle font-display text-muted hover:text-accent w-11 h-11 flex items-center justify-center text-2xl shrink-0 -ml-2"
                  title="Drag to reorder"
                >≡</button>
                <button onClick={() => setExpanded(isOpen ? null : it.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                  <span className={`timeline-dot timeline-${it.kind === 'protocol' ? 'protocol' : it.kind === 'audio' ? 'audio' : 'routine'}`}>
                    {it.kind === 'protocol' ? '●' : it.kind === 'audio' ? '🎧' : '◆'}
                  </span>
                  <span className="font-display text-accent text-sm w-12 shrink-0">{it.time}</span>
                  <span className="timeline-label flex-1 min-w-0 truncate text-sm">{it.label}</span>
                  {it.duration_min ? <span className="text-muted text-xs shrink-0">{it.duration_min} min</span> : null}
                  <span className="text-muted text-xs">{isOpen ? '▴' : '▾'}</span>
                </button>
              </div>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-cream/5">
                  {it.notes && <p className="text-muted text-sm pt-3">{it.notes}</p>}
                  {it.kind === 'routine' && (
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
                      <DirectMediaPlayer media={it.media_ref} />
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
                    className={`w-full text-center py-2.5 rounded-full text-sm font-bold transition-all ${done ? 'bg-cream/10 text-muted' : 'bg-accent text-bg'}`}
                  >
                    {done ? '✓ Done — tap to undo' : 'Mark done'}
                  </button>
                </div>
              )}
            </div>
          );
        }}
      </SortableList>
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
    <main className="px-5 py-6 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="text-muted text-sm inline-block hover:text-accent mb-3">← Today</Link>
      <h1 className="font-display text-3xl md:text-4xl mb-2">Protocols</h1>
      <p className="text-muted mb-6">Evidence-based, agent-generated. Tap to view, activate to merge into your day.</p>

      {list == null && <div className="text-muted text-sm">Loading…</div>}
      {list && list.length === 0 && (
        <div className="card p-6">
          <div className="font-display text-lg mb-2">No protocols available yet.</div>
          <p className="text-muted text-sm">{isMockActive() ? 'Mock data is enabled but the mock file is unreachable.' : 'The remote protocol repo is empty. Flip mock mode on in Settings.'}</p>
        </div>
      )}

      <div className="space-y-3">
        {list && list.map(p => {
          const isActive = activeProtocols.includes(p.protocol_id);
          return (
            <div key={p.protocol_id} className={`card p-5 ${isActive ? 'border-accent' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-accent uppercase tracking-widest mb-1">{p.variant} · {p.kind}</div>
                  <div className="font-display text-xl mb-1">{p.topic}</div>
                  <div className="text-muted text-xs">{p.studies_used} studies · {p.sections.daily_plan?.length || 0} daily items</div>
                </div>
                <button onClick={() => toggle(p.protocol_id)} className={`px-4 py-2 rounded-full text-sm font-bold shrink-0 ${isActive ? 'bg-cream/10 text-cream border border-accent' : 'btn-accent'}`}>
                  {isActive ? '✓ Active' : 'Activate'}
                </button>
              </div>
              <Link to={`/protocol/${p.protocol_id}`} className="text-accent text-sm underline underline-offset-4 mt-4 inline-block">View full protocol →</Link>
            </div>
          );
        })}
      </div>
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
    <main className="px-5 py-6 max-w-3xl mx-auto pb-16">
      <Link to="/protocols" className="text-muted text-sm inline-block hover:text-accent mb-3">← Protocols</Link>
      <div className="text-xs text-accent uppercase tracking-widest mb-1">{p.variant} · {p.kind} · v{p.schema_version}</div>
      <h1 className="font-display text-3xl md:text-4xl mb-2">{p.topic}</h1>
      <p className="text-muted mb-5">{p.studies_used} studies · generated {new Date(p.generated_at).toLocaleDateString()}</p>
      <button onClick={toggle} className={isActive ? 'btn-ghost mb-8' : 'btn-accent mb-8'}>{isActive ? '✓ Active — deactivate' : 'Activate this protocol'}</button>

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
            <ul className="space-y-1 text-sm">{p.sections.nutrition.eat.map((x, i) => <li key={i}>· {x}</li>)}</ul>
          </div>
          <div className="card p-4">
            <div className="text-xs text-muted uppercase tracking-widest mb-2">Avoid</div>
            <ul className="space-y-1 text-sm">{p.sections.nutrition.avoid.map((x, i) => <li key={i}>· {x}</li>)}</ul>
          </div>
        </div>
        <div className="card p-4 mt-3">
          <div className="text-xs text-accent uppercase tracking-widest mb-2">Eating windows</div>
          <ul className="space-y-1 text-sm">{p.sections.nutrition.windows.map((x, i) => <li key={i}>· {x}</li>)}</ul>
        </div>
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

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl md:text-2xl mb-3">{title}</h2>
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
    <main className="px-5 py-6 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="text-muted text-sm inline-block hover:text-accent mb-3">← Today</Link>
      <h1 className="font-display text-3xl md:text-4xl mb-2">Audio & Modules</h1>
      <p className="text-muted mb-6">Meditative, passive, screen-off-friendly. Add to your daily routine.</p>

      <div className="space-y-3">
        {KNOWN_AUDIO_MODULES.map(m => {
          const media = resolved[m.slug];
          const isActive = activeModules.includes(m.slug);
          return (
            <div key={m.slug} className={`card p-5 ${isActive ? 'border-accent' : ''}`}>
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

/* ═══════════════════════════════════════════
   NEW — /settings
   ═══════════════════════════════════════════ */
function SettingsView() {
  const [perm, setPerm] = useState(getPermissionState());
  const [mockOverride, setMockOverride] = useLocalStorage(LS_KEYS.USE_MOCK_OVERRIDE, USE_MOCK_DATA ? 'true' : 'false');
  const [activeProtocols, setActiveProtocols] = useActiveProtocols();
  const [activeModules, setActiveModules] = useActiveModules();
  const [activeRoutines, setActiveRoutines] = useActiveRoutines();

  const askPerm = async () => { const r = await requestPermission(); setPerm(r); };
  const clearAll = () => {
    setActiveProtocols([]);
    setActiveModules([]);
    setActiveRoutines({ savedZones: [], level: 'beginner', lifestyle: null, scheduledTime: '08:00' });
  };

  return (
    <main className="px-5 py-6 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="text-muted text-sm inline-block hover:text-accent mb-3">← Today</Link>
      <h1 className="font-display text-3xl md:text-4xl mb-6">Settings</h1>

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
