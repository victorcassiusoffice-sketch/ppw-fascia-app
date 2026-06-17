// Soft tactile engine (2026-06-17) — STAGED, NOT DEPLOYED.
// Three-channel button feedback governed by one Level (Off / Soft / Firm):
//   • visual  — the .soft-btn convex→concave flip (CSS, driven by data-tactile)
//   • audio   — a two-stage WebAudio synth "slot/click" (down-thock + up-tick)
//   • haptic  — navigator.vibrate (Android/Chromebook only; iOS ignores it)
//
// Defaults (Vic 2026-06-17): sound ON at Level Soft — "sounds auto on, then in
// settings turn off". A clear off toggle lives in Settings → Button feedback.
// Sound is still gesture-gated (AudioContext only starts on the first press —
// never autoplays on load) and clicks throttle so rapid taps don't machine-gun.
// Honest caveat: no web API reads the iOS hardware silent switch, so the
// Settings toggle is the reliable mute on iOS. Haptics on-if-supported. Per the
// soft-neumorphism-ui skill §3, amended by Vic's sound-on default.

import { useCallback, useEffect, useState } from 'react';

export const TACTILE_KEY = 'ppw.tactile';
export const DEFAULT_TACTILE = { level: 'soft', sound: true, haptics: true };

/** Pure, unit-tested: audio gain for a press/release stage at a given Level.
 *  Returns 0 when muted (Level off OR sound disabled) so the caller can skip. */
export function gainForLevel(level, stage, soundEnabled) {
  if (!soundEnabled || level === 'off') return 0;
  const base = level === 'firm' ? 0.40 : 0.15;     // Firm vs Soft
  return stage === 'up' ? base * 0.55 : base;       // up-tick lighter than down-thock
}

/** Pure, unit-tested: vibration ms for a Level (Android only). 0 = none. */
export function vibrateMsForLevel(level, hapticsEnabled) {
  if (!hapticsEnabled || level === 'off') return 0;
  return level === 'firm' ? 15 : 8;
}

export function loadTactile() {
  try {
    const raw = JSON.parse(localStorage.getItem(TACTILE_KEY) || 'null');
    if (raw && typeof raw === 'object') return { ...DEFAULT_TACTILE, ...raw };
  } catch (_) { /* ignore */ }
  return { ...DEFAULT_TACTILE };
}

export function saveTactile(cfg) {
  try { localStorage.setItem(TACTILE_KEY, JSON.stringify(cfg)); } catch (_) { /* ignore */ }
}

// ── WebAudio synth click — lazy context, two-stage, throttled. ──────────────
let _ctx = null;
let _lastPlay = 0;

function ctx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!_ctx) { try { _ctx = new AC(); } catch (_) { return null; } }
  if (_ctx.state === 'suspended') { _ctx.resume().catch(() => {}); }
  return _ctx;
}

/** Synthesise one stage of a "plasticky slot switch": a short band-passed
 *  noise burst with a fast exponential decay. down ≈ 14ms, up ≈ 8ms. */
export function playClick(stage, level, soundEnabled) {
  const gain = gainForLevel(level, stage, soundEnabled);
  if (gain <= 0) return;
  const ac = ctx();
  if (!ac) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - _lastPlay < 30) return;                 // throttle: one click / 30ms
  _lastPlay = now;

  const dur = stage === 'up' ? 0.008 : 0.014;
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const env = Math.pow(1 - i / frames, 3);        // fast exponential-ish decay
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = stage === 'up' ? 2600 : 1700; // up brighter, down lower
  bp.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(ac.destination);
  src.start();
}

export function vibrate(level, hapticsEnabled) {
  const ms = vibrateMsForLevel(level, hapticsEnabled);
  if (ms > 0 && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(ms); } catch (_) { /* ignore */ }
  }
}

/** React hook: persisted tactile config + bound press/release handlers.
 *  Reflects the Level onto <html data-tactile> so the CSS depth matches. */
export function useSoftTactile() {
  const [cfg, setCfg] = useState(loadTactile);

  useEffect(() => {
    saveTactile(cfg);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-tactile', cfg.level);
    }
  }, [cfg]);

  const onPress = useCallback(() => {
    playClick('down', cfg.level, cfg.sound);
    vibrate(cfg.level, cfg.haptics);
  }, [cfg]);

  const onRelease = useCallback(() => {
    playClick('up', cfg.level, cfg.sound);
  }, [cfg]);

  return { cfg, setCfg, onPress, onRelease };
}
