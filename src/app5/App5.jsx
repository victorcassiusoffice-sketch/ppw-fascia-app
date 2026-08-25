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
import './app5.css'; // the prototype's keyframes — required for all ppw* animations
import { themeVars, parseVars, THUMBS, logoUrl } from './theme5.js';
import SettingsScreen from './screens/SettingsScreen.jsx';
import LibraryScreen from './screens/LibraryScreen.jsx';
import { InstallBanner } from './screens/InstallAppCard.jsx';
import AddSheet from './screens/AddSheet.jsx';
import UpsellModal from './screens/UpsellModal.jsx';
import CalendarScreen from './screens/CalendarScreen.jsx';
import MediaViewer from './screens/MediaViewer.jsx';
import CompletedSheet from './screens/CompletedSheet.jsx';
import RepeatSheet from './screens/RepeatSheet.jsx';
import TermsScreen from './screens/TermsScreen.jsx';
import OnboardingScreen from './screens/OnboardingScreen.jsx';
import { NotePopup, SlotReminder } from './screens/Popups.jsx';
import SchedulePicker from './screens/SchedulePicker.jsx';
import AiBridgeSheet from './assistant/AiBridgeSheet.jsx';
import CoachMarks, { hasSeenTour } from './coach/CoachMarks.jsx';
import {
  useStore5, getState, setState, save,
  stackFor, todayKey, markDone, setItemTime, deleteItem, overLimit,
  openAdd, backToToday, openPlayer, openCompleted, openAccount, openRepeat, repeatLabel,
  startSlotEngine, orderedStackFor, reorderTimed, reorderDeck, toggleAuto,
  toggleSelect, selectAll, clearSelection, deleteSelected, safeUrl,
  onlyExamplesLeft, clearExamples,
  syncEntitlement, applyServerEntitlement, syncProfile,
  openAiBridge, recordUseDay, guideWelcomed, markGuideWelcomed, anySheetOpen, stashCoachPosition,
  guideFocusItem,
} from './store5.js';
import GuideDisc from './screens/GuideDisc.jsx';
import CompletedRing from './screens/CompletedRing.jsx';
import QuestJournalSheet from './screens/QuestJournalSheet.jsx';
import HintBubble from './coach/HintBubble.jsx';
import { WELCOME_STEPS } from './coach/welcomeSteps.js';
import { allDone, startFinale } from './coach/quests5.js';
import { maybeHint, setDragging } from './coach/hints5.js';
import useHintWatcher from './coach/useHintWatcher.js';
import { completeSignIn, isSignedIn, readEmail, ensureFreshSession, consumeNewAccount } from './membership.js';
import AccountSheet from './screens/AccountSheet.jsx';
import UpdateBar from './screens/UpdateBar.jsx';
import FirstRunChoice from './screens/FirstRunChoice.jsx';
import LockScreen from './screens/LockScreen.jsx';
import { isEnabled as passcodeEnabled, isLocked as passcodeLocked, lockNow, LOCK_AFTER_MS } from './passcode.js';
import { installPressSound } from './sfx5.js';

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
// "YYYY-M-D" key → Date
const keyToDateLocal = (k) => { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };

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
          <button onClick={onAdd} aria-label="Add a stack" data-tour="add" style={{ position: 'absolute', left: '50%', top: -22, transform: 'translateX(-50%)', width: 56, height: 56, borderRadius: 999, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      ) : (
        <button key={it.key} onClick={() => onNav(it.key)} aria-label={it.label} data-tour={it.key} style={{ position: 'relative', flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: screen === it.key ? 'var(--ink)' : 'var(--dim)', transition: 'color .25s' }}>
          {it.icon}
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.02em' }}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── glass round icon button (header discs) ──
// `tour` is the coach-mark anchor name — the disc renders its own <button>, so a
// data-tour on the call site would land on nothing. It stays undefined by default.
// `ring` is an optional decoration drawn around the disc's edge (the day's
// progress on the Completed disc). It sits behind the icon and takes no taps.
function Disc({ children, onClick, label, badge, dim, tour, ring }) {
  return (
    <button onClick={onClick} aria-label={label} data-tour={tour} style={{ position: 'relative', width: 46, height: 46, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', color: 'var(--ink)', opacity: dim ? .45 : 1, transition: 'opacity .3s' }}>
      {ring}
      {children}
      {badge != null && (
        <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
      )}
    </button>
  );
}

// ── header account control ──
// Sign-in existed but was invisible: you only met it on the paywall or by digging
// into Settings → Membership. This puts it in the header of the screen the app
// opens on. It opens the account sheet, which renders the same MembershipCard —
// no second auth path.
function AccountControl() {
  const S = useStore5();
  const signedIn = S.signedIn;   // store state, so the header flips the instant sign-in lands
  const email = readEmail();
  if (!signedIn) {
    return (
      <button onClick={openAccount} data-tour="signin" style={{ height: 46, flex: 'none', padding: '0 14px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', fontSize: 13.5, fontWeight: 700, letterSpacing: '-.01em' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3.5h3.5A2.5 2.5 0 0 1 20 6v12a2.5 2.5 0 0 1-2.5 2.5H14" /><path d="M10 16l4-4-4-4M14 12H4" /></svg>
        Sign in
      </button>
    );
  }
  return (
    <Disc label={email ? `Account — signed in as ${email}` : 'Account'} onClick={openAccount}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.5" r="3.6" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" /></svg>
    </Disc>
  );
}

// ── STACK (daily) screen ──
function StackScreen() {
  const S = useStore5();
  const key = S.viewDate || todayKey();
  const notToday = !!S.viewDate && S.viewDate !== todayKey();
  // Vic #3: no-time stacks queue FIRST as Next Up (deck order), then timed by time.
  const deck = orderedStackFor(key);
  const next = deck[0] || null;
  const rest = deck.slice(1);
  const completedCount = (S.doneByDate[key] || []).length;
  // The finale plays one full lap of the day-progress ring, in the space the
  // GuideDisc is vacating — the guide hands the header over rather than just
  // disappearing out of it.
  const finaleSweep = !!(S.coach && S.coach.questId === '__finale__');
  // The time/repeat coach anchors follow the thing the user just added, when that
  // thing is one of the rows below. If it isn't (nothing added yet, or it landed
  // in the hero slot), they fall back to the hero card so they always point
  // somewhere real. S.lastAddedId is transient — no match is a normal state.
  // WHICH ROW THE GUIDE IS TALKING ABOUT. Asked of the store rather than worked
  // out here, so these anchors and the quest predicates can never disagree
  // about it — they disagreed once, and Quest 3 spotlighted one card while
  // waiting for a change on another.
  const focusId = (guideFocusItem() || {}).id || null;
  const restIsTarget = !!focusId && rest.some((x) => x.id === focusId);

  // Vic #2 — hold-and-drag reorder. Times stay with positions: dropping re-assigns
  // which timed stack sits in which time slot; no-time stacks reorder their queue.
  const [drag, setDrag] = React.useState(null); // { idx, dy, over }
  const dragRef = React.useRef(null);
  const suppressClick = React.useRef(false);
  const commitDrag = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || toIdx == null) return;
    const newRest = [...rest];
    const [moved] = newRest.splice(fromIdx, 1);
    newRest.splice(toIdx, 0, moved);
    const visual = [next, ...newRest].filter(Boolean);
    reorderTimed(key, visual.filter((x) => !!x.time).map((x) => x.id));
    const ntNew = visual.filter((x) => !x.time).map((x) => x.id);
    if (ntNew.length > 1) {
      const ntSet = new Set(ntNew); let k = 0;
      reorderDeck(getState().deckItems.map((x) => ntSet.has(x.id) ? ntNew[k++] : x.id));
    }
  };
  const rowPointerDown = (idx) => (e) => {
    if (e.target.closest('input,button,a,label')) return;
    const startY = e.clientY; const el = e.currentTarget; const pid = e.pointerId;
    let active = false;
    const timer = setTimeout(() => { active = true; setDragging(true); try { el.setPointerCapture(pid); } catch {} setDrag({ idx, dy: 0, over: idx }); }, 180);
    const move = (ev) => {
      const dy = ev.clientY - startY;
      if (!active) { if (Math.abs(dy) > 10) cleanup(); return; }
      if (ev.cancelable) ev.preventDefault();
      const under = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.dataset && n.dataset.dragidx !== undefined);
      const over = under ? +under.dataset.dragidx : dragRef.current?.over;
      dragRef.current = { idx, dy, over };
      setDrag({ idx, dy, over });
    };
    const up = () => {
      clearTimeout(timer);
      if (active) {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 80);
        const moved = (dragRef.current?.over ?? idx) !== idx;
        commitDrag(idx, dragRef.current?.over ?? idx);
        setDragging(false);
        // Reordering swaps the things between time slots and leaves the slots
        // alone, which is genuinely surprising the first time. Show it.
        if (moved) setTimeout(() => maybeHint('reorder'), 450);
      }
      cleanup();
    };
    const cleanup = () => { clearTimeout(timer); setDragging(false); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); dragRef.current = null; setDrag(null); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const labelDate = notToday ? keyToDateLocal(key) : new Date();
  const dateLabel = labelDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  const cardIcon = (it) => {
    if (it.kind === 'doc') return <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: THUMBS.doc, border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.9)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9.5 12h5M9.5 15.5h5" /></svg></div>;
    if (it.kind === 'note') return <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: 'var(--disc)', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>{INote}</div>;
    if (it.thumb) {
      const bg = it.thumbUrl ? `url(${it.thumbUrl})` : (THUMBS[it.thumb] || THUMBS.yt);
      return <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: bg, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.9)' }}>{!it.thumbUrl && IPlay}</div>;
    }
    return <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 999, background: 'var(--disc)', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>{IDrop}</div>;
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '28px 20px 140px', animation: 'ppwScreenIn .38s cubic-bezier(.26,1,.4,1)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>{dateLabel}</div>
            {notToday && (
              <button onClick={backToToday} data-tour="today-chip" style={{ height: 24, padding: '0 10px', borderRadius: 999, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em' }}>TODAY</button>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>Stack</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
          <AccountControl />
          {/* The guide's home. It fills a segment per quest, and retires from
              the header for good once all eight are done — a finished tutorial
              should stop taking up the space. */}
          <GuideDisc />
          <Disc label="Completed today" badge={completedCount || null} onClick={openCompleted} tour="completed-disc"
            ring={<CompletedRing done={completedCount} remaining={deck.length} sweep={finaleSweep} />}>{ICheck}</Disc>
          {/* W13 (2026-07-29): this was a full-size tappable disc in the primary
              header with no onClick at all — a dead control sitting next to two
              live ones. Reminders are a real shipped feature (the slot engine
              fires them); they just live in Settings. It now goes there, and
              dims when reminders are OFF so the bell states the truth rather
              than implying something is armed when nothing is. */}
          <Disc label="Notifications" onClick={() => { setState({ screen: 'settings' }); setTimeout(() => maybeHint('bell'), 600); }} dim={!S.reminders} tour="bell">{IBell}</Disc>
        </div>
      </div>

      {/* Get the app — Row 15 (L2-LS-DISTRIB). Dismissible; renders nothing
          once installed or already dismissed. */}
      <InstallBanner />

      {/* NEXT UP hero */}
      {next ? (
        <div data-tour="next-up" style={{ position: 'relative', marginTop: 24, borderRadius: 28, padding: '22px 22px 20px', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwRise .45s cubic-bezier(.3,1.2,.4,1) both' }}>
          {/* slow accent border-trace (prototype ppwTrace) */}
          <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} preserveAspectRatio="none" viewBox="0 0 100 100">
            <rect x="0.6" y="1.2" width="98.8" height="97.6" rx="7.5" fill="none" vectorEffect="non-scaling-stroke" stroke="var(--accent)" strokeWidth="1.5" pathLength="100" strokeDasharray="100" style={{ animation: 'ppwTrace 2.6s ease-out .4s both' }} />
          </svg>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Next up</div>
            {next.time ? (
              <label data-tour={restIsTarget ? undefined : 'item-time'} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--dim)', flex: 'none' }}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1, textShadow: 'var(--emboss)' }}>{next.time}</span>
                <input type="time" value={next.time} onChange={(e) => setItemTime(next.id, e.target.value)} aria-label="Edit next slot time" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, padding: 0, opacity: 0, border: 'none', cursor: 'pointer' }} />
              </label>
            ) : (
              // Vic #3 — no-time stack: it simply IS Next Up, no clock attached.
              <span data-tour={restIsTarget ? undefined : 'item-time'} style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Anytime</span>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 23, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{next.title}</div>
          <div style={{ marginTop: 5, fontSize: 14, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 7 }}>
            {/* F6: the hero card is the FIRST thing a new customer reads, so the
                example tag matters most here — this is the slot they think they chose. */}
            {next.example && (
              <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 999, border: '1px solid var(--hairline)', background: 'var(--track)', color: 'var(--dim)' }}>Example</span>
            )}
            <span style={{ minWidth: 0 }}>{next.meta}</span>
          </div>
          <button onClick={() => openRepeat(next.id)} aria-label="Repeat schedule" data-tour={restIsTarget ? undefined : 'item-repeat'} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 44, background: 'none', border: 'none', padding: '10px 0', color: 'var(--dim)', fontSize: 11, fontWeight: 600, letterSpacing: '.05em' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
            {repeatLabel(next.repeat)}
          </button>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
            {safeUrl(next.url) && (
              <a href={safeUrl(next.url)} target="_blank" rel="noopener noreferrer" aria-label="Play now" style={{ height: 48, width: 52, flex: 'none', borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IPlay}</a>
            )}
            {/* 2026-07-06 (Vic): icon-only tick — the "Done" text sat flush to the button edge. */}
            <button onClick={() => markDone(next.id, key)} aria-label="Done" title="Done" data-tour="done" style={{ flex: 1, height: 48, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </button>
            {next.time && (
              <button onClick={() => setItemTime(next.id, addMinutes(next.time, 15))} aria-label="Snooze" style={{ height: 48, padding: '0 16px', borderRadius: 16, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 7 }}>{ISnooze} Snooze</button>
            )}
            <button onClick={() => deleteItem(next.id)} aria-label="Delete this slot" style={{ height: 48, width: 48, flex: 'none', borderRadius: 16, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ITrash}</button>
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', marginTop: 24, borderRadius: 28, padding: '28px 22px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)' }}>
          {/* §6d — an empty deck is not an achievement. "All done" belongs only to
              someone who actually ticked something off today; a day with nothing
              planned and nothing done was being congratulated for doing nothing,
              and given no way out of the empty screen. Split on the done count. */}
          {completedCount === 0 ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>Nothing on this day yet.</div>
              <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--dim)' }}>Add something with the ＋, or ask your AI to plan the whole day.</div>
              <button onClick={openAiBridge} style={{ marginTop: 16, minHeight: 44, padding: '0 18px', borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', fontSize: 13.5, fontWeight: 600 }}>Plan with AI</button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, color: 'var(--accent)' }}>{ICheck}<span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>All done for today</span></div>
              <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--dim)' }}>Your stack resets tomorrow morning.</div>
            </>
          )}
        </div>
      )}

      {/* deck (rest of today) — selection actions live inline with this header (Vic 4b) */}
      <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>{rest.length ? 'Later today' : ''}</div>
        {S.selectedIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, animation: 'ppwRise .25s ease both' }}>
            <button onClick={() => selectAll(rest.map((x) => x.id))} style={{ height: 36, padding: '0 12px', borderRadius: 999, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--ink)', fontSize: 12, fontWeight: 600 }}>Select all</button>
            <button onClick={clearSelection} aria-label="Clear selection" style={{ height: 36, padding: '0 10px', borderRadius: 999, border: 'none', background: 'none', color: 'var(--dim)', fontSize: 12, fontWeight: 600 }}>Clear</button>
            <button onClick={deleteSelected} aria-label="Delete selected stacks" style={{ height: 36, padding: '0 13px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', fontSize: 12, fontWeight: 700 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 4h4M6.5 7l1 13h9l1-13" /></svg>
              {S.selectedIds.length}
            </button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rest.map((it, i) => {
          const isDragged = drag && drag.idx === i;
          const isOver = drag && drag.over === i && drag.idx !== i;
          return (
            <div
              key={it.id}
              data-dragidx={i}
              data-tour={it.id === focusId ? 'latest-item' : undefined}
              onPointerDown={rowPointerDown(i)}
              onClick={() => { if (suppressClick.current) return; if (S.selectedIds.length) { toggleSelect(it.id); return; } if (it.embed || it.url || it.kind === 'doc') openPlayer(it); }}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', minHeight: 68, borderRadius: 26, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: `1px solid ${isOver ? 'var(--acc-rim)' : 'var(--rim)'}`, boxShadow: isDragged ? 'var(--elev-hi)' : 'var(--elev)', cursor: (it.embed || it.url) ? 'pointer' : 'grab', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', transform: isDragged ? `translateY(${drag.dy}px) scale(1.03)` : 'none', zIndex: isDragged ? 5 : 1, transition: isDragged ? 'none' : 'transform .2s, border-color .2s' }}
            >
              {/* Vic 4 — small selection tick, top-left of every stack card */}
              {/* F10: 44px target, 22px circle. The button carries the hit area and
                  the SPAN carries the look, so the padding cannot inflate the ring.
                  Negative margins cancel the extra box, leaving the row as it was. */}
              <button onClick={(e) => { e.stopPropagation(); toggleSelect(it.id); }}
                role="checkbox" aria-checked={S.selectedIds.includes(it.id)}
                aria-label={S.selectedIds.includes(it.id) ? 'Deselect' : 'Select for deletion'}
                data-tour={i === 0 ? 'select-circle' : undefined}
                style={{ width: 44, height: 44, flex: 'none', alignSelf: 'flex-start', margin: '-9px -11px -11px -11px', padding: 0, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, border: `1.5px solid ${S.selectedIds.includes(it.id) ? 'var(--acc-rim)' : 'var(--rim)'}`, background: S.selectedIds.includes(it.id) ? 'var(--acc-surf)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)', transition: 'all .2s' }}>
                  {S.selectedIds.includes(it.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                </span>
              </button>
              {cardIcon(it)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{it.title}</div>
                <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* F6: say what we put there. Without this the starter slots read
                      as things the customer chose, on day one, in their own app. */}
                  {it.example && (
                    <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 999, border: '1px solid var(--hairline)', background: 'var(--track)', color: 'var(--dim)' }}>Example</span>
                  )}
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.meta}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flex: 'none' }}>
                {it.time ? (
                  <input type="time" value={it.time} onClick={(e) => e.stopPropagation()} onChange={(e) => setItemTime(it.id, e.target.value)} aria-label="Edit slot time" data-tour={it.id === focusId ? 'item-time' : undefined} style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)', background: 'transparent', border: 'none', outline: 'none', textAlign: 'right', padding: 0, width: 84, cursor: 'pointer' }} />
                ) : (
                  <span data-tour={it.id === focusId ? 'item-time' : undefined} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)' }}>Next Up</span>
                )}
                {/* F10 (UX pass 2026-08-11): these controls were 13x17 and 22x22
                    against the app's own 48px floor. The ICONS are unchanged —
                    only the padding grew, so the tappable area is real without
                    the row looking different. `gap` drops to 0 because the new
                    padding now provides the separation. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); openRepeat(it.id); }} aria-label="Repeat and time options" data-tour={it.id === focusId ? 'item-repeat' : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, background: 'none', border: 'none', padding: '14px 12px', color: 'var(--dim)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
                  </button>
                  {/* Vic #1 — AUTO tickbox: at slot time the item opens/plays itself. */}
                  {(it.url || it.embed) && (
                    <button onClick={(e) => { e.stopPropagation(); toggleAuto(it.id); }} aria-label={it.auto ? 'Autoplay on — tap to turn off' : 'Autoplay off — tap to turn on'} aria-pressed={!!it.auto} data-tour={i === 0 ? 'auto-box' : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44, background: 'none', border: 'none', padding: '14px 10px', color: 'var(--dim)', fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em' }}>
                      <span style={{ width: 15, height: 15, borderRadius: 5, border: `1.5px solid ${it.auto ? 'var(--acc-rim)' : 'var(--rim)'}`, background: it.auto ? 'var(--acc-surf)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)', transition: 'all .2s' }}>
                        {it.auto && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                      </span>
                      AUTO
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* F6: one tap to a genuinely empty day. The examples are useful for
            showing what a stack IS, and a dead weight the moment the user wants
            their own — until now there was no way to say "not these". */}
        {onlyExamplesLeft() && (
          <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 18, border: '1px dashed var(--hairline)', background: 'var(--track)' }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--dim)' }}>
              These are examples, to show you what a stack looks like. Tap ＋ to add your own — or clear them and start empty.
            </div>
            <button onClick={clearExamples}
              style={{ marginTop: 10, minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 13, fontWeight: 600 }}>
              Clear the examples
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function addMinutes(t, mins) {
  const total = (toMin(t) + mins) % (24 * 60);
  const h = Math.floor(total / 60), m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// ── fasting badge — corner F/E indicator + info popup (prototype: fastBadge) ──
function FastingBadge() {
  const S = useStore5();
  const [open, setOpen] = React.useState(false);
  if (!S.fastOn) return null;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const eating = mins >= toMin(S.eatOpen) && mins < toMin(S.eatClose);
  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label="Fasting status" style={{ position: 'absolute', top: 'calc(12px + env(safe-area-inset-top, 0px))', right: 14, zIndex: 31, width: 34, height: 34, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--surface-strong)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', boxShadow: 'var(--elev)', color: 'var(--accent)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {eating ? 'E' : 'F'}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(54px + env(safe-area-inset-top, 0px))', right: 14, left: 14, zIndex: 31, borderRadius: 20, padding: 16, background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .4s cubic-bezier(.3,1.36,.4,1) both' }}>
          <div style={{ fontSize: 15, fontWeight: 700, textShadow: 'var(--emboss)' }}>{eating ? 'Eating window open' : 'Fasting'}</div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
            {eating
              ? `Your window closes at ${S.eatClose}. The badge flips back to F after that.`
              : `Your eating window opens at ${S.eatOpen} and closes at ${S.eatClose}. The badge flips to E while it's open.`}
          </div>
          <button onClick={() => setOpen(false)} style={{ marginTop: 12, background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>Got it</button>
        </div>
      )}
    </>
  );
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

// ── DESKTOP STAGE (2026-08-25) ────────────────────────────────────────────
// On a desktop the app used to be a phone-shaped column floating on a flat
// grey void — which read as "there is no desktop version". There is; it is
// this one. The frame is load-bearing (the coach, the hints and every overlay
// measure against it), so the desktop treatment leaves the frame byte-identical
// and designs the ROOM it stands in instead: the theme's own ground and glow
// at desktop scale, the pitch as brand chrome beside the device, and a QR that
// hands the same URL to a phone.
//
// Gated on matchMedia so jsdom (no matchMedia) and every existing test render
// exactly the mobile tree.
function useDesktop() {
  const [wide, setWide] = React.useState(() => {
    try { return window.matchMedia('(min-width: 980px)').matches; } catch { return false; }
  });
  React.useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(min-width: 980px)'); } catch { return undefined; }
    const on = () => setWide(mq.matches);
    if (mq.addEventListener) { mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }
    mq.addListener(on); return () => mq.removeListener(on);
  }, []);
  return wide;
}

const deskImg = (name) => `${import.meta.env.BASE_URL}assets/onboarding/${name}.webp`;

/** The brand panel beside the device. Pure chrome: nothing in the app depends
 *  on it, and it never claims anything the app cannot do — in particular it
 *  says NOTHING about data moving between desktop and phone, because it
 *  doesn't (each device keeps its own local data until the profile backend
 *  ships). "Scan to open on your phone" hands over the URL, not the data. */
function DesktopStage({ S }) {
  const src = logoUrl(S);
  return (
    <div aria-hidden="false" style={{ position: 'relative', zIndex: 1, width: 400, maxWidth: '34vw', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0, color: 'var(--ink)' }}>
      {src && (
        <div style={{ width: 108, height: 108, borderRadius: 28, background: 'var(--ground)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img src={src} alt="PPWellness" style={{ width: '86%', height: '86%', objectFit: 'contain' }} />
        </div>
      )}
      <h1 style={{ margin: '26px 0 0', fontSize: 'clamp(30px, 2.6vw, 40px)', lineHeight: 1.12, fontWeight: 800, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>
        The most powerful app for your life.
      </h1>
      <p style={{ margin: '14px 0 0', fontSize: 19, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.4 }}>
        <span style={{ color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Your Ideal Lifestyle.</span>{' '}
        <span style={{ color: 'var(--ink)', textShadow: 'var(--emboss)' }}>Planned. Organised. Brought to you.</span>
      </p>
      {/* three of the clay lifestyle images, quiet, as texture not argument */}
      <div style={{ marginTop: 22, display: 'flex', gap: 12 }}>
        {['meditation', 'stretch', 'course'].map((n, i) => (
          <img key={n} src={deskImg(n)} alt="" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ width: 64, height: 64, borderRadius: 18, objectFit: 'cover', border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)', transform: `rotate(${i === 1 ? 3 : i === 0 ? -4 : 2}deg)` }} />
        ))}
      </div>
      {/* the handoff — same URL, in a pocket */}
      <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px 14px 14px', borderRadius: 22, background: 'var(--surface)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
        <div style={{ width: 96, height: 96, flex: 'none', borderRadius: 14, background: '#F4F1EA', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={`${import.meta.env.BASE_URL}assets/onboarding/qr-app.svg`} alt="QR code for app.ppwellness.co" style={{ width: 82, height: 82, display: 'block' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, textShadow: 'var(--emboss)' }}>Best in your pocket.</div>
          <div style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)' }}>Scan to open it on your phone — free, straight in the browser.</div>
          <div style={{ marginTop: 5, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>app.ppwellness.co</div>
        </div>
      </div>
    </div>
  );
}

// ── APP SHELL ──
export default function App5() {
  const S = useStore5();
  const vars = parseVars(themeVars(S));
  const nav = (screen) => setState({ screen });

  // First-run guidance: after onboarding completes, a TWO-step welcome — this
  // is your stack, and here is your guide. That is all.
  //
  // It used to be five boxes of reading before the user had touched anything,
  // which is a wall rather than a welcome. The teaching moved into the eight
  // quests, where it happens on the real screen with the user's own hands; the
  // welcome's only job now is to hand over to them.
  const [tourOpen, setTourOpen] = React.useState(false);
  React.useEffect(() => {
    if (!S.onboarded) return;
    if (hasSeenTour() || guideWelcomed()) return;
    // F2 (2026-08-11): accountOpen added. The tour used to start ON TOP of an
    // account sheet that was still open from sign-up, which is how a new customer
    // ended up five layers deep and landed back on that panel afterwards.
    if (S.aiOpen || S.addOpen || S.termsOpen || S.accountOpen) return;
    const t = setTimeout(() => setTourOpen(true), 700);     // let the screen settle
    return () => clearTimeout(t);
  }, [S.onboarded, S.aiOpen, S.addOpen, S.termsOpen, S.accountOpen]);

  // THE FINALE — the eighth quest lands and the guide says goodbye, once.
  //
  // Deferred until nothing else owns the screen: arriving on top of a sheet the
  // user is in the middle of would make the last thing the guide ever does the
  // most annoying thing it ever did.
  const finaleFired = React.useRef(false);
  React.useEffect(() => {
    if (finaleFired.current) return;
    if (!S.onboarded || S.guide.done) return;
    if (!allDone(S)) return;
    if (S.coach || S.journalOpen || anySheetOpen(S)) return;
    const t = setTimeout(() => {
      if (finaleFired.current) return;
      const now = getState();
      if (now.coach || now.journalOpen || anySheetOpen(now) || now.guide.done) return;
      finaleFired.current = true;
      startFinale();        // the finale's own [Done] is what retires the disc
    }, 1000);
    return () => clearTimeout(t);
  }, [S.guide, S.coach, S.journalOpen, S.onboarded, S.addOpen, S.aiOpen, S.accountOpen, S.completedOpen, S.termsOpen, S.playerItem]);

  // One place watches the store and asks for hints; the engine decides whether
  // to answer. See useHintWatcher for why the triggers live together.
  useHintWatcher();

  // A quest mid-flight writes its place to disk the moment the app goes to the
  // background. Quest 6 deliberately sends the user to their AI in another app;
  // they will not tap pause on the way out, and the tab may not survive the
  // trip. Coming back — or cold-booting — should not cost them the quest.
  React.useEffect(() => {
    const stash = () => { if (document.visibilityState === 'hidden') stashCoachPosition(); };
    document.addEventListener('visibilitychange', stash);
    window.addEventListener('pagehide', stashCoachPosition);
    return () => {
      document.removeEventListener('visibilitychange', stash);
      window.removeEventListener('pagehide', stashCoachPosition);
    };
  }, []);

  // PASSCODE — lock after LOCK_AFTER_MS in the background, never while in use.
  //
  // Locking only drops the decrypted session from memory; the ciphertext stays on
  // disk. Killing the app locks it too, for free: memory goes with the page, and
  // nothing readable was ever written down.
  React.useEffect(() => {
    if (!passcodeEnabled()) return;
    let t = null;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        t = setTimeout(() => { lockNow(); t = null; }, LOCK_AFTER_MS);
      } else if (t) {
        clearTimeout(t); t = null;   // back within the grace period — no keypad
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { if (t) clearTimeout(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // days-used counter — one distinct calendar day per boot. Nothing reads it yet;
  // it is what lets a later nudge wait until someone has actually come back a
  // few times, instead of asking on the first screen they ever see.
  React.useEffect(() => { recordUseDay(); }, []);

  // runtime slot engine — fires notes/reminders/autoplay when a slot's time
  // arrives (20s tick, ported from the prototype). Cleans up on unmount.
  React.useEffect(() => startSlotEngine(), []);
  // global press sound — soft ASMR tap on any interactive press (Sounds-gated).
  React.useEffect(() => installPressSound(), []);

  // MEMBERSHIP — the server is the authority on Premium, so ask it on boot and
  // whenever the app comes back to the foreground (a purchase or a cancellation
  // may have landed while it was backgrounded). Signed-out users make no request.
  // A magic-link lands back here as ?login_token=… — consume it, then strip it
  // from the URL so a one-time code never sits in history or gets shared.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = new URL(window.location.href);
        const lt = url.searchParams.get('login_token');
        if (lt) {
          url.searchParams.delete('login_token');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          try {
            applyServerEntitlement(await completeSignIn(lt));
            // The link lands on the Stack screen, nowhere near the account. If
            // this sign-in CREATED the account, open the account screen so the
            // "your account is set up — set a password" moment is actually seen
            // rather than happening invisibly, which is the whole Wave 2 fault.
            // Don't stack the account moment on top of the consent screen. If
            // setup is unfinished, the flag is kept and finishOnboarding() opens
            // the account sheet the moment the wizard is done — one thing at a time.
            if (consumeNewAccount()) {
              setState({ justCreated: true });
              if (getState().onboarded) openAccount();
            }
          } catch (e) {
            // A dead link used to fail in total silence, leaving someone staring
            // at a signed-out app with no idea why. Send them somewhere they can
            // ask for another one.
            setState({ signInError: e?.message || 'That sign-in link did not work. Ask for a new one.' });
            openAccount('signin');
          }
        }
      } catch {}
      if (alive) { await ensureFreshSession(); await syncEntitlement(); await syncProfile(); }
    })();
    // STAYING SIGNED IN — the session the backend issues lasts 60 minutes, and
    // the app never renewed it, so anyone who kept the app open long enough was
    // silently signed out and met the paywall again. Renew on resume, and on a
    // slow tick for the case where the app is simply left open.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      ensureFreshSession().then(syncEntitlement);
    };
    document.addEventListener('visibilitychange', onVisible);
    const keepAlive = setInterval(() => { ensureFreshSession(); }, 10 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(keepAlive);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  let body;
  if (S.screen === 'stack') body = <StackScreen />;
  else if (S.screen === 'library') body = <LibraryScreen />;
  else if (S.screen === 'calendar') body = <CalendarScreen />;
  else if (S.screen === 'settings') body = <SettingsScreen />;
  else body = <StackScreen />;

  const isDesktop = useDesktop();
  return (
    // On desktop the room is themed with the app's own tokens — change the
    // colourway inside the phone and the whole desktop changes with it. On
    // mobile the frame covers the viewport, so the flat grey stays as-is.
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', ...(isDesktop ? { ...vars, gap: 'clamp(40px, 5vw, 84px)', background: 'var(--ground)', padding: '0 4vw' } : { background: '#83878B' }) }}>
      {isDesktop && (
        <>
          {/* the same luminous ground the frame has inside, at room scale */}
          <div aria-hidden="true" style={{ position: 'absolute', width: '44vw', height: '44vw', left: '-12vw', top: '-16vw', borderRadius: 999, background: 'var(--glow-1)', filter: 'blur(70px)', pointerEvents: 'none', opacity: 'var(--glow-op, 1)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', width: '38vw', height: '38vw', right: '-10vw', bottom: '-14vw', borderRadius: 999, background: 'var(--glow-2)', filter: 'blur(80px)', pointerEvents: 'none', opacity: 'var(--glow-op, 1)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />
          <DesktopStage S={S} />
        </>
      )}
      <div data-easyread={S.a11y.on ? '1' : '0'} style={{ position: 'relative', width: 'min(430px, 100vw)', height: isDesktop ? 'min(932px, 92dvh)' : 'min(932px, 100dvh)', overflow: 'hidden', borderRadius: 'clamp(0px, calc((100vw - 429px) * 99), 40px)', boxShadow: isDesktop ? '0 60px 140px -40px rgba(15,18,26,.6), 0 0 0 1px rgba(255,255,255,.09)' : '0 40px 120px -30px rgba(20,26,36,.55)', zIndex: 1, fontFamily: "'Nunito', system-ui, sans-serif", fontWeight: 500, color: 'var(--ink, #23262C)', zoom: S.a11y.zoom || 1, ...vars }}>
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
        {/* fasting corner badge */}
        <FastingBadge />
        {/* overlays */}
        <AddSheet />
        <MediaViewer />
        <SchedulePicker />
        <AiBridgeSheet />
        <CoachMarks
          open={tourOpen}
          steps={WELCOME_STEPS}
          onClose={() => { markGuideWelcomed(); setTourOpen(false); }}
        />
        {/* the guide's journal (43) and the one-shot hint bubble (44) */}
        <QuestJournalSheet />
        <HintBubble />
        <CompletedSheet />
        {/* Tells the user a newer build exists and lets THEM choose. Since the
            2026-07-06 New Design cutover no update prompt rendered at all — the
            legacy UpdateToast lives in a branch of App.jsx that never runs. */}
        <UpdateBar />
        <AccountSheet />
        <RepeatSheet />
        <SlotReminder />
        <NotePopup />
        <OnboardingScreen />
        {/* Above the wizard (40), below the account sheet (42): the first thing a
            brand-new visitor sees, because until now the only account words on
            this screen were "Sign in" and "Already have an account?". */}
        <FirstRunChoice />
        <TermsScreen />
        {/* Above everything, including the coach marks — while it is up there is
            genuinely no session to reach underneath. */}
        <LockScreen />
        <UpsellModal />
      </div>
    </div>
  );
}
