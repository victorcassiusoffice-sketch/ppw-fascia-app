// App chrome (2026-06-03 redesign): DNA-helix logo mark, theme toggle, and the
// persistent bottom navigation with the enlarged centre bell.
//
// These replace the old top wordmark + hamburger drawer. The bell carries the
// SAME notification behaviour the old /today top-bar bell had (permission gate →
// enable/disable → TodayView's scheduler reacts to notifPrefs.enabled), just
// relocated and enlarged per Vic's explicit change #1.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './theme.js';
import { useNotificationPrefs } from './state.js';
import { requestPermission } from './notifications.js';
import { m, AnimatePresence, glideIndicator, pressScale, toastIn, SPRING, reduced } from './lib/motion';

/* ── PPW clear-glass logo (Vic-approved, 2026-06-12 revamp) — the master
   transparent SVG from 09-Fascia-App/brand/liquid-glass-logo/, shimmer
   variant for the splash. Replaces the legacy inline helix as the app mark. ── */
export function GlassLogo({ size = 34, shimmer = false, title = 'PPW' }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand/${shimmer ? 'ppw-glass-logo-shimmer.svg' : 'ppw-glass-logo.svg'}`}
      alt={title}
      style={{ height: size, width: 'auto', display: 'inline-block' }}
      draggable="false"
    />
  );
}

/* ── Legacy DNA-helix mark — kept for the assistant chip + back-compat
   (no longer the header mark). ── */
export function HelixLogo({ size = 30, draw = false, spin = false, title = 'PPW home' }) {
  return (
    <span className={'helix-mark' + (draw ? ' helix-draw' : '')} title={title} aria-label="PPW">
      <svg
        viewBox="0 0 24 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        width={size} height={size} className={spin ? 'helix-spin' : ''} aria-hidden="true"
      >
        <path d="M5 2c0 8 14 12 14 18S5 30 5 38" />
        <path d="M19 2c0 8-14 12-14 18s14 12 14 18" />
        <line x1="7" y1="8" x2="17" y2="8" />
        <line x1="9.5" y1="14" x2="14.5" y2="14" />
        <line x1="9.5" y1="26" x2="14.5" y2="26" />
        <line x1="7" y1="32" x2="17" y2="32" />
      </svg>
    </span>
  );
}

/* ── Theme toggle — REF-09 refractive glass switch (Refinement 2). Pill
   track + glass knob sliding Dark↔Light with the icon etched in the knob.
   Knob slide = transform only; quick flip stays here, the full
   Light/Dark/System control lives in Settings → Appearance. ── */
export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className={'glass-switch' + (isDark ? ' on' : '')}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <m.span
        className="glass-knob"
        initial={false}
        animate={{ x: isDark ? 34 : 3 }}
        transition={reduced() ? { duration: 0 } : SPRING.glide}
        aria-hidden="true"
      >
        {isDark ? '☾' : '☀'}
      </m.span>
    </button>
  );
}

/* ── Icons ── */
function IconHome() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
}
function IconProtocols() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z" /><line x1="8" y1="8" x2="15" y2="8" /></svg>;
}
function IconModules() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
}
function IconSettings() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L16 2h-4l-.8 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L7 10a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1L12 22h4l.8-2.5" /></svg>;
}
function IconBellGlyph({ filled }) {
  return <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
}

/* ── Bottom navigation + enlarged centre bell ── */
export function BottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const path = loc.pathname;
  const [notifPrefs, setNotifPrefs] = useNotificationPrefs();
  const [msg, setMsg] = useState(null);
  const msgTimer = useRef(null);
  const flash = useCallback((text) => {
    setMsg(text);
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  useEffect(() => () => clearTimeout(msgTimer.current), []);

  const isActive = (to) => (to === '/today' ? path === '/today' || path === '/' : path.startsWith(to));

  // Bell = the relocated notification toggle (same permission/scheduling gate
  // the /today top-bar bell used). TodayView's scheduler reacts to enabled.
  const toggleBell = useCallback(async () => {
    if (notifPrefs.enabled) {
      setNotifPrefs((p) => ({ ...p, enabled: false }));
      flash('Notifications off');
      return;
    }
    if (typeof Notification === 'undefined') { flash('Notifications unsupported here'); return; }
    let perm = Notification.permission;
    if (perm === 'default') perm = await requestPermission();
    if (perm === 'granted') {
      setNotifPrefs((p) => ({ ...p, enabled: true }));
      flash('Notifications on');
    } else {
      flash('Allow notifications in browser settings');
    }
  }, [notifPrefs.enabled, setNotifPrefs, flash]);

  // Liquid-glass redesign (2026-06-11, board 05): the active tab carries ONE
  // gliding accent dot (clip 3 — a single indicator slides, labels only
  // colour-fade). Solid dot — it moves, so no blur (perf law).
  const NavTab = ({ to, active, label, children }) => (
    <m.button
      type="button"
      className={'navbtn' + (active ? ' active' : '')}
      onClick={() => nav(to)}
      aria-current={active ? 'page' : undefined}
      {...pressScale(0.94)}
    >
      {active && <m.span className="nav-dot" aria-hidden="true" {...glideIndicator('nav-dot')} />}
      {children}<span>{label}</span>
    </m.button>
  );

  return (
    <div className="botwrap">
      <AnimatePresence>
        {msg && (
          <m.div
            role="status"
            variants={toastIn}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{
              position: 'absolute', bottom: 78, left: '50%', x: '-50%',
              background: 'var(--col-surface)', color: 'var(--col-ink)', boxShadow: 'var(--elv-2)',
              border: '1px solid var(--hairline)', borderRadius: 'var(--r-pill)',
              padding: '7px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none',
            }}
          >{msg}</m.div>
        )}
      </AnimatePresence>
      <nav className="botnav liquid-refract" aria-label="Primary">
        <NavTab to="/today" active={isActive('/today')} label="Today"><IconHome /></NavTab>
        <NavTab to="/protocols" active={isActive('/protocols') || path.startsWith('/protocol/')} label="Protocols"><IconProtocols /></NavTab>
        <div className="navbtn bellslot">
          {/* Bell keeps its CSS-only squish: it is centred via translateX(-50%)
              in .bell, which a Framer whileTap transform would clobber. The
              ON-state morph (accent fill + halo) is the clip-1 blob move. */}
          <button
            type="button"
            className={'bell' + (notifPrefs.enabled ? ' on' : '')}
            onClick={toggleBell}
            aria-pressed={notifPrefs.enabled}
            aria-label={notifPrefs.enabled ? 'Notifications on — tap to turn off' : 'Notifications off — tap to turn on'}
            title={notifPrefs.enabled ? 'Notifications on' : 'Notifications off'}
          >
            <IconBellGlyph filled={notifPrefs.enabled} />
          </button>
          <span className="belllabel">Alerts</span>
        </div>
        <NavTab to="/modules" active={isActive('/modules')} label="Modules"><IconModules /></NavTab>
        <NavTab to="/settings" active={isActive('/settings')} label="Settings"><IconSettings /></NavTab>
      </nav>
    </div>
  );
}
