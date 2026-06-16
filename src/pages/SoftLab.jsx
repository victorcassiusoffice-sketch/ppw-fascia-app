// SOFT LAB (2026-06-17) — STAGED REVIEW PAGE, NOT DEPLOYED.
// A standalone screen for Vic to see all 5 Soft colourways on real neumorphic
// chrome and FEEL the press + slot/click at each Level. Sets data-theme=light
// + data-soft-skin + data-crisp on <html> while mounted; restores on unmount.
// Wired at /soft-lab on the feat/soft-v1 branch only (never merged/deployed).
import React, { useEffect, useState } from 'react';
import { useSoftTactile } from '../lib/softTactile.js';

const SKINS = [
  { id: 'slate', label: 'Slate', dot: '#4E6075' },
  { id: 'frost', label: 'Frost', dot: '#2E93AD' },
  { id: 'cream', label: 'Cream', dot: '#C0832B' },
  { id: 'honey', label: 'Honey', dot: '#F2B01E' },
  { id: 'sage',  label: 'Sage',  dot: '#4F9173' },
];
const LEVELS = ['off', 'soft', 'firm'];

function SoftButton({ children, accent = false, disabled = false, onPress, onRelease }) {
  return (
    <button
      type="button"
      className={'soft-btn' + (accent ? ' is-accent' : '')}
      disabled={disabled}
      onPointerDown={() => !disabled && onPress()}
      onPointerUp={() => !disabled && onRelease()}
    >
      {children}
    </button>
  );
}

export default function SoftLab() {
  const [skin, setSkin] = useState('cream');
  const [crisp, setCrisp] = useState(false);
  const { cfg, setCfg, onPress, onRelease } = useSoftTactile();

  // Drive <html> so the colourway tokens cascade to the whole page.
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute('data-theme');
    const prevSkin = html.getAttribute('data-soft-skin');
    const prevCrisp = html.getAttribute('data-crisp');
    html.setAttribute('data-theme', 'light');
    html.setAttribute('data-soft-skin', skin);
    html.setAttribute('data-crisp', crisp ? 'on' : 'off');
    return () => {
      if (prevTheme) html.setAttribute('data-theme', prevTheme); else html.removeAttribute('data-theme');
      if (prevSkin) html.setAttribute('data-soft-skin', prevSkin); else html.removeAttribute('data-soft-skin');
      if (prevCrisp) html.setAttribute('data-crisp', prevCrisp); else html.removeAttribute('data-crisp');
    };
  }, [skin, crisp]);

  return (
    <main className="px-5 pt-4 pb-28 max-w-2xl mx-auto" style={{ minHeight: '100vh', background: 'var(--col-bg)', color: 'var(--col-ink)' }}>
      <h1 className="font-display" style={{ fontSize: 26, marginBottom: 2 }}>Soft Lab</h1>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
        Neumorphism v1 — staged for review. Tap a palette, set the Level, press the buttons.
      </p>

      {/* Colourway picker */}
      <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Colourway</div>
      <div className="flex gap-2.5" style={{ marginBottom: 22, flexWrap: 'wrap' }}>
        {SKINS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSkin(s.id)}
            className="soft-btn"
            aria-pressed={skin === s.id}
            style={{ padding: '8px 14px', boxShadow: skin === s.id ? 'var(--elv-inset)' : 'var(--elv-2)' }}
          >
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: s.dot, display: 'inline-block', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Tactile level */}
      <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Press level</div>
      <div className="flex gap-2.5" style={{ marginBottom: 14 }}>
        {LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setCfg((c) => ({ ...c, level: lv }))}
            className="soft-btn"
            aria-pressed={cfg.level === lv}
            style={{ textTransform: 'capitalize', boxShadow: cfg.level === lv ? 'var(--elv-inset)' : 'var(--elv-2)' }}
          >
            {lv}
          </button>
        ))}
      </div>

      {/* Toggles */}
      <div className="flex gap-2.5" style={{ marginBottom: 26, flexWrap: 'wrap' }}>
        <button type="button" className="soft-btn" aria-pressed={cfg.sound} onClick={() => setCfg((c) => ({ ...c, sound: !c.sound }))} style={{ boxShadow: cfg.sound ? 'var(--elv-inset)' : 'var(--elv-2)' }}>
          Sound: {cfg.sound ? 'On' : 'Off'}
        </button>
        <button type="button" className="soft-btn" aria-pressed={crisp} onClick={() => setCrisp((v) => !v)} style={{ boxShadow: crisp ? 'var(--elv-inset)' : 'var(--elv-2)' }}>
          Crisp edges: {crisp ? 'On' : 'Off'}
        </button>
      </div>

      {/* Live samples */}
      <div className="soft-card" style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Sample card</div>
        <div className="text-muted" style={{ fontSize: 13 }}>Surface == ground; depth is the dual-light shadow. No blur in Soft.</div>
      </div>

      <div className="flex gap-3" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <SoftButton accent onPress={onPress} onRelease={onRelease}>Primary</SoftButton>
        <SoftButton onPress={onPress} onRelease={onRelease}>Secondary</SoftButton>
        <SoftButton disabled onPress={onPress} onRelease={onRelease}>Disabled</SoftButton>
      </div>
    </main>
  );
}
