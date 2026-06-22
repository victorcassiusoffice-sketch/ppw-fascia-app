// App-wide background layer (Refinement 2 — REF-01/04/05).
//
// Renders the user-selected surface BEHIND all glass UI, plus a per-theme
// scrim tier so glass tokens keep AA contrast over any image (including
// arbitrary user photos). Static layer — never animated (perf law).
//
// Writes `data-bg` onto <html>: full-bleed image grounds ('nature'/'custom')
// suppress the /today hero-art zone via CSS (no texture-on-texture).

import React, { useEffect } from 'react';
import { useTheme } from '../theme.js';
import { useBackground } from '../lib/background.js';
import { getGlassIntensity, applyGlassIntensity } from '../lib/glassIntensity.js';
import LiquidGlassBG from './LiquidGlassBG.jsx';

export default function AppBackground() {
  const { resolved } = useTheme();
  const { kind, customUrl, skinUrl, tone } = useBackground(resolved);

  useEffect(() => {
    document.documentElement.setAttribute('data-bg', kind);
    // tone drives the scrim tier for image skins (bright → heavier scrim).
    if (tone) document.documentElement.setAttribute('data-bg-tone', tone);
    else document.documentElement.removeAttribute('data-bg-tone');
    return () => {
      document.documentElement.removeAttribute('data-bg');
      document.documentElement.removeAttribute('data-bg-tone');
    };
  }, [kind, tone]);

  // Lens 4 — apply the stored glass-intensity level at boot (Settings owns
  // changes thereafter via the same html[data-glass] attribute).
  useEffect(() => { applyGlassIntensity(getGlassIntensity()); }, []);

  return (
    <div className="app-bg" aria-hidden="true">
      {kind === 'nature' && (
        <img
          src={`${import.meta.env.BASE_URL}assets/backgrounds/fascia_fluid_motion.png`}
          alt=""
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      {kind === 'skin' && skinUrl && (
        <img src={skinUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      )}
      {kind === 'custom' && customUrl && <img src={customUrl} alt="" />}
      {/* 'clean' (the approved default) — clean graphite/white field with 3 slow
          drifting luminous blobs (pure CSS; reduced-motion freezes it). Glass
          reads crisp + clear over it — the redesign root-fix. */}
      {kind === 'clean' && (
        <div className="cg-field" aria-hidden="true">
          <div className="cg-blob cg-b1" />
          <div className="cg-blob cg-b2" />
          <div className="cg-blob cg-b3" />
        </div>
      )}
      {/* 'liquid' — animated WebGL flowing-glass ground (REF flowing-liquid motion).
          Self-contained shader; the glass UI above refracts it via backdrop-blur. */}
      {kind === 'liquid' && <LiquidGlassBG theme={resolved} />}
      {/* 'grey' renders no image — the .app-bg ground itself is the surface. */}
      <div className="app-bg-scrim" />
    </div>
  );
}
