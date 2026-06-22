// App chrome (2026-06-03 redesign): DNA-helix logo mark, theme toggle, and the
// persistent bottom navigation with the enlarged centre bell.
//
// These replace the old top wordmark + hamburger drawer. The bell carries the
// SAME notification behaviour the old /today top-bar bell had (permission gate →
// enable/disable → TodayView's scheduler reacts to notifPrefs.enabled), just
// relocated and enlarged per Vic's explicit change #1.

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './theme.js';
import { m, glideIndicator, pressScale, SPRING, reduced } from './lib/motion';

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

/* ── Icons — RADICAL REDO icon set (2026-06-22, Vic "icons must actually
   change"). Every glyph is redrawn fresh + distinct from the prior round: the
   house → a today/calendar-dot, the music-note → an audio equalizer, the gear →
   SLIDERS (Vic: the Settings icon must change), the bell + stack redrawn. Thin
   uniform stroke (the global REF-08 1.6 rule applies). ── */
function IconHome() {
  // "Today" — sun-over-day-dot (the daily plan / now). Distinct from Calendar
  // (which is the month grid). Mock `today` glyph.
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="13.5" r="4" /><path d="M12 3v2.5M21 13.5h-2.5M5.5 13.5H3M18 7.5l-1.6 1.6M7.6 9.1 6 7.5" /></svg>;
}
function IconCalNav() {
  // "Calendar" — month grid with a day dot (the date-planning destination).
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3.2" /><path d="M8 3v3.5M16 3v3.5M3.5 10h17" /><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" /></svg>;
}
function IconModules() {
  // "Modules" — audio equalizer bars (not a music note).
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10v4M8.5 6.5v11M13 4.5v15M17.5 8v8M21 11v2" /></svg>;
}
function IconSettings() {
  // "Settings" — three horizontal sliders with knobs (NOT the gear).
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 7h9M17 7h3.5M3.5 12h2.5M10.5 12h10M3.5 17h9M17 17h3.5" /><circle cx="14.5" cy="7" r="2.2" /><circle cx="8" cy="12" r="2.2" /><circle cx="14.5" cy="17" r="2.2" /></svg>;
}
/* STACK glyph — a clean stacked deck (rounded layers). */
function IconStack() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4.5" y="3.8" width="15" height="5.2" rx="2.2" /><rect x="4.5" y="10.6" width="15" height="5.2" rx="2.2" opacity="0.85" /><path d="M6.6 18.6h10.8" opacity="0.5" /></svg>;
}
/* Central ADD glyph — a thin plus (the raised centre action). */
function IconAdd() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" /></svg>;
}

/* ── Bottom navigation — symmetric, raised centre Add ── */
export function BottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const path = loc.pathname;

  const isActive = (to) => (to === '/today' ? path === '/today' || path === '/' : path.startsWith(to));

  // Liquid-glass nav beads (2026-06-17): every tab icon sits in a glass bead
  // matching the card action discs (REF-08). The active tab's accent-glass fill
  // GLIDES between beads (shared layoutId 'nav-bead' — clip 3 glide), and the
  // glyph liquid-taps on press. No backdrop-filter on the bead (the dock already
  // frosts + the button transforms — perf law #3).
  const NavTab = ({ to, active, label, children }) => (
    <m.button
      type="button"
      className={'navbtn' + (active ? ' active' : '')}
      onClick={() => nav(to)}
      aria-current={active ? 'page' : undefined}
      {...pressScale(0.94)}
    >
      <span className={'nav-bead' + (active ? ' is-active' : '')}>
        {active && <m.span className="nav-bead-fill" aria-hidden="true" {...glideIndicator('nav-bead')} />}
        {children}
      </span>
      <span className="navlabel">{label}</span>
    </m.button>
  );

  // Central STACK hub (2026-06-19, Vic): Protocols now lives behind a raised
  // nested-glass pod in the MIDDLE of the dock — a button INSIDE a button
  // (merged-liquid grammar). The bell drops to a normal bead slot.
  const stackActive = isActive('/protocols') || path.startsWith('/protocol/');

  return (
    <div className="botwrap">
      <nav className="botnav liquid-refract" aria-label="Primary">
        {/* RADICAL REDO nav (2026-06-22, whole-app approved): symmetrical
            [ Today · Stack · ＋Add · Calendar · Settings ]. Stack lives where
            Today used to be; the raised CENTRE pod is ＋ Add (Vic: "add stack in
            the MIDDLE") and NEVER slides — only the per-tab accent bead glides.
            Alerts left the nav (a toggle is not a destination → it's now the
            bell in the Today top bar); Calendar is promoted to a real
            destination. New outline icons; Settings = sliders. */}
        <NavTab to="/today" active={isActive('/today')} label="Today"><IconHome /></NavTab>
        <NavTab to="/protocols" active={stackActive} label="Stack"><IconStack /></NavTab>

        {/* Central ADD pod — raised glass, opens the Add-stack flow on Today. */}
        <div className="navbtn stackslot">
          <m.button
            type="button"
            className="nav-stack nav-add"
            onClick={() => nav('/today?add=1')}
            aria-label="Add stack"
            title="Add stack"
            {...pressScale(0.9)}
          >
            <span className="nav-stack-core" aria-hidden="true"><IconAdd /></span>
          </m.button>
          <span className="stacklabel">Add</span>
        </div>

        <NavTab to="/calendar" active={isActive('/calendar')} label="Calendar"><IconCalNav /></NavTab>
        <NavTab to="/settings" active={isActive('/settings')} label="Settings"><IconSettings /></NavTab>
      </nav>
    </div>
  );
}
