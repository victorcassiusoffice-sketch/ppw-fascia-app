// ─────────────────────────────────────────────────────────────────────────
// App5 — New Design (Claude Design "PPW Fascia App") native React port.
//
// Mounted at /v2 while the port is in progress, so the current live app is
// untouched. Faithful translation of the prototype's <x-dc> template + DCLogic
// into React, wired to store5 (its own `ppw5.` data) + theme5 (its skin engine).
//
// Ported so far: app shell (ground/glow/scrim + theme vars), NAV DOCK, and the
// STACK screen (daily view — new name for the old "Today"). Other screens render
// a faithful placeholder until each is ported (nav still works; nothing breaks).
// ─────────────────────────────────────────────────────────────────────────

import React from 'react';
import { themeVars, parseVars, THUMBS } from './theme5.js';
import SettingsScreen from './screens/SettingsScreen.jsx';
import LibraryScreen from './screens/LibraryScreen.jsx';
import AddSheet from './screens/AddSheet.jsx';
import UpsellModal from './screens/UpsellModal.jsx';
import {
  useStore5, getState, setState, save,
  stackFor, todayKey, markDone, setItemTime, deleteItem, overLimit,
  openAdd,
} from './store5.js';

// ── small inline-SVG icon helpers (match the prototype's line icons) ──
const svg = (p, extra = {}) => (
  <svg width={extra.w || 21} height={extra.h || 21} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={extra.sw || 1.6} strokeLinecap="round" strokeLinejoin="round">{p}</svg>
);
const IStack = svg(<><path d="M5 7.5 12 4l7 3.5-7 3.5-7-3.5z" /><path d="M5 12l7 3.5 7-3.5" /><path d="M5 16.5 12 20l7-3.5" /></>);
const ILibrary = svg(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>);
const ICalendar = svg(<><rect x="4" y="6" width="16" height="14" rx="3" /><path d="M8 4v4M16 4v4M4 11h16" /></>);
const ISettings = svg(<><path d="M5 8h6M17 8h2M5 16h2M13 16h6" /><circle cx="14" cy="8" r="2.2" /><circle cx="10" cy="16" r="2.2" /></>);
const ICheck = svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, { sw: 1.8 });
const IBell = svg(<><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5H4.5L6 16z" /><path d="M10 20a2 2 0 0 0 4 0" /></>);
const IDrop = svg(<path d="M12 3s6 6.3 6 10.3a6 6 0 0 1-12 0C6 9.3 12 3 12 3z" />);
const INote = svg(<><path d="M5 4h14v11l-4 5H5z" /><path d="M15 20v-5h4M8.5 9h7M8.5 12.5h4" /></>);
const IPlay = <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>;
const ITrash = svg(<path d="M4 7h16M10 4h4M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />, { sw: 1.7 });
const ISnooze = svg(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></>, { sw: 1.7, w: 16, h: 16 });

// time "HH:MM" → minutes for ordering
const toMin = (t) => { const [h, m] = String(t || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

// ── NAV DOCK ──
function NavDock({ screen, onNav, onAdd }) {
  const items = [
    { key: 'stack', label: 'Stack', icon: IStack },
    { key: 'library', label: 'Library', icon: ILibrary },
    { key: null, label: '+', icon: null },
    { key: 'calendar', label: 'Calendar', icon: ICalendar },
    { key: 'settings', label: 'Settings', icon: ISettings },
  ];
  const idx = ['stack', 'library', null, 'calendar', 'settings'].indexOf(screen);
  const inkLeft = idx >= 0 ? `calc(${idx} * 20%)` : '0';
  return (
    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 20, height: 68, borderRadius: 24, background: 'var(--surface-strong)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', display: 'flex', alignItems: 'stretch' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: 9, bottom: 9, left: inkLeft, width: '20%', padding: '0 7px', opacity: idx >= 0 ? 1 : 0, transition: 'left .55s cubic-bezier(.3,1.45,.32,1), opacity .3s ease', pointerEvents: 'none' }}>
        <div style={{ height: '100%', borderRadius: 16, background: 'var(--disc)', border: '1px solid var(--rim)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.55), 0 8px 18px -10px rgba(20,26,36,.35)' }} />
      </div>
      {items.map((it, i) => it.key === null ? (
        <div key="add" style={{ flex: 1, position: 'relative' }}>
          <button onClick={onAdd} aria-label="Add a stack" style={{ position: 'absolute', left: '50%', top: -22, transform: 'translateX(-50%)', width: 56, height: 56, borderRadius: 999, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      ) : (
        <button key={it.key} onClick={() => onNav(it.key)} aria-label={it.label} style={{ position: 'relative', flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: screen === it.key ? 'var(--ink)' : 'var(--dim)', transition: 'color .25s' }}>
          {it.icon}
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.02em' }}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── glass round icon button (header discs) ──
function Disc({ children, onClick, label, badge }) {
  return (
    <button onClick={onClick} aria-label={label} style={{ position: 'relative', width: 46, height: 46, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', color: 'var(--ink)' }}>
      {children}
      {badge != null && (
        <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
      )}
    </button>
  );
}

// ── STACK (daily) screen ──
function StackScreen() {
  const S = useStore5();
  const key = todayKey();
  const deck = [...stackFor(key)].sort((a, b) => toMin(a.time) - toMin(b.time));
  const next = deck[0] || null;
  const rest = deck.slice(1);
  const completedCount = (S.doneByDate[key] || []).length;

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  const cardIcon = (it) => {
    if (it.kind === 'note') return <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: 'var(--disc)', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>{INote}</div>;
    if (it.thumb) {
      const bg = it.thumbUrl ? `url(${it.thumbUrl})` : (THUMBS[it.thumb] || THUMBS.yt);
      return <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: bg, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.9)' }}>{!it.thumbUrl && IPlay}</div>;
    }
    return <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 999, background: 'var(--disc)', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>{IDrop}</div>;
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '28px 20px 140px', animation: 'ppwRise .5s cubic-bezier(.26,1,.4,1)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>{dateLabel}</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>Stack</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Disc label="Completed today" badge={completedCount || null}>{ICheck}</Disc>
          <Disc label="Notifications">{IBell}</Disc>
        </div>
      </div>

      {/* NEXT UP hero */}
      {next ? (
        <div style={{ position: 'relative', marginTop: 24, borderRadius: 28, padding: '22px 22px 20px', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwRise .45s cubic-bezier(.3,1.2,.4,1) both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Next up</div>
            <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1, textShadow: 'var(--emboss)' }}>{next.time}</span>
              <input type="time" value={next.time} onChange={(e) => setItemTime(next.id, e.target.value)} aria-label="Edit next slot time" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, padding: 0, opacity: 0, border: 'none', cursor: 'pointer' }} />
            </label>
          </div>
          <div style={{ marginTop: 12, fontSize: 23, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{next.title}</div>
          <div style={{ marginTop: 5, fontSize: 14, color: 'var(--dim)' }}>{next.meta}</div>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
            {next.url && (
              <a href={next.url} target="_blank" rel="noopener noreferrer" aria-label="Play now" style={{ height: 48, width: 52, flex: 'none', borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IPlay}</a>
            )}
            <button onClick={() => markDone(next.id)} style={{ flex: 1, height: 48, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 15, textShadow: 'var(--label-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{ICheck} Done</button>
            <button onClick={() => setItemTime(next.id, addMinutes(next.time, 15))} aria-label="Snooze" style={{ height: 48, padding: '0 16px', borderRadius: 16, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 7 }}>{ISnooze} Snooze</button>
            <button onClick={() => deleteItem(next.id)} aria-label="Delete this slot" style={{ height: 48, width: 48, flex: 'none', borderRadius: 16, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ITrash}</button>
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', marginTop: 24, borderRadius: 28, padding: '28px 22px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, color: 'var(--accent)' }}>{ICheck}<span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>All done for today</span></div>
          <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--dim)' }}>Your stack resets tomorrow morning.</div>
        </div>
      )}

      {/* deck (rest of today) */}
      <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>{rest.length ? 'Later today' : ''}</div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rest.map((it) => (
          <div key={it.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', minHeight: 68, borderRadius: 26, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
            {cardIcon(it)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{it.title}</div>
              <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.meta}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flex: 'none' }}>
              <input type="time" value={it.time} onChange={(e) => setItemTime(it.id, e.target.value)} aria-label="Edit slot time" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)', background: 'transparent', border: 'none', outline: 'none', textAlign: 'right', padding: 0, width: 84, cursor: 'pointer' }} />
              <button onClick={() => markDone(it.id)} aria-label="Mark done" style={{ width: 26, height: 26, borderRadius: 999, border: '1.5px solid var(--acc-rim)', background: 'transparent', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>{ICheck}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function addMinutes(t, mins) {
  const total = (toMin(t) + mins) % (24 * 60);
  const h = Math.floor(total / 60), m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// ── placeholder for not-yet-ported screens (keeps nav working) ──
function Placeholder({ name }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{ borderRadius: 28, padding: '28px 26px', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', maxWidth: 300 }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>{name}</div>
        <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.5, color: 'var(--dim)' }}>This screen is being ported into the New Design build. The Stack screen is live — tap it in the nav.</div>
      </div>
    </div>
  );
}

// ── APP SHELL ──
export default function App5() {
  const S = useStore5();
  const vars = parseVars(themeVars(S));
  const nav = (screen) => setState({ screen });

  let body;
  if (S.screen === 'stack') body = <StackScreen />;
  else if (S.screen === 'library') body = <LibraryScreen />;
  else if (S.screen === 'calendar') body = <Placeholder name="Calendar" />;
  else if (S.screen === 'settings') body = <SettingsScreen />;
  else body = <StackScreen />;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#83878B' }}>
      <div style={{ position: 'relative', width: 'min(430px, 100vw)', height: 'min(932px, 100dvh)', overflow: 'hidden', borderRadius: 'clamp(0px, calc((100vw - 429px) * 99), 40px)', boxShadow: '0 40px 120px -30px rgba(20,26,36,.55)', fontFamily: "'Nunito', system-ui, sans-serif", fontWeight: 500, color: 'var(--ink, #23262C)', ...vars }}>
        {/* ground */}
        <div style={{ position: 'absolute', inset: 0, background: 'var(--ground)', transition: 'background .4s ease' }} />
        {/* luminous blobs the glass refracts */}
        <div style={{ position: 'absolute', width: 360, height: 360, left: -90, top: -70, borderRadius: 999, background: 'var(--glow-1)', filter: 'blur(30px)', pointerEvents: 'none', opacity: 'var(--glow-op, 1)' }} />
        <div style={{ position: 'absolute', width: 320, height: 320, right: -80, top: '34%', borderRadius: 999, background: 'var(--glow-2)', filter: 'blur(36px)', pointerEvents: 'none', opacity: 'var(--glow-op, 1)' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, left: '8%', bottom: -90, borderRadius: 999, background: 'var(--glow-3)', filter: 'blur(34px)', pointerEvents: 'none', opacity: 'var(--glow-op, 1)' }} />
        {/* legibility scrim */}
        <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />
        {/* active screen */}
        {body}
        {/* nav dock */}
        <NavDock screen={S.screen} onNav={nav} onAdd={openAdd} />
        {/* overlays */}
        <AddSheet />
        <UpsellModal />
      </div>
    </div>
  );
}
