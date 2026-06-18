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
  const base = level === 'firm' ? 0.62 : 0.32;     // Firm vs Soft (2026-06-18: raised — the prior
                                                    // 0.15/0.40 bandpassed-noise click was inaudible on phone speakers)
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
let _unlocked = false;

function ctx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!_ctx) { try { _ctx = new AC(); } catch (_) { return null; } }
  if (_ctx.state === 'suspended') { _ctx.resume().catch(() => {}); }
  return _ctx;
}

/** Must run INSIDE a user gesture (pointerdown). Creates + resumes the context
 *  and plays a one-frame silent buffer — on iOS/Safari this flips the page audio
 *  session to 'playback' so the very next click is actually audible (the classic
 *  "first taps make no sound" fix). Idempotent. Honest caveat: the iOS hardware
 *  silent switch still mutes WebAudio regardless — the Settings toggle is the
 *  reliable mute on iOS; this only fixes the suspended-context / unlock case. */
export function unlockAudio() {
  const ac = ctx();
  if (!ac || _unlocked) return;
  _unlocked = true;
  try {
    const b = ac.createBuffer(1, 1, ac.sampleRate);
    const s = ac.createBufferSource();
    s.buffer = b;
    s.connect(ac.destination);
    s.start(0);
  } catch (_) { /* ignore */ }
}

/** Synthesise one stage of a "plasticky slot switch": a short tonal tick that
 *  drops in pitch, with a transient noise attack. Tonal core = clearly audible
 *  on phone speakers (the prior noise-only burst was a whisper). down ≈ 60ms
 *  (lower), up ≈ 45ms (brighter). */
export function playClick(stage, level, soundEnabled) {
  const gain = gainForLevel(level, stage, soundEnabled);
  if (gain <= 0) return;
  const ac = ctx();
  if (!ac) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - _lastPlay < 28) return;                 // throttle: one click / 28ms
  _lastPlay = now;

  const t = ac.currentTime;
  const dur = stage === 'up' ? 0.045 : 0.06;

  // Tonal core — a triangle tick dropping in pitch (the "thock"/"tick").
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  const f0 = stage === 'up' ? 2200 : 1500;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);   // fast attack
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);   // fast decay
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);

  // Transient noise attack layered on top for the crisp "click" edge.
  const nFrames = Math.max(1, Math.floor(ac.sampleRate * 0.012));
  const buf = ac.createBuffer(1, nFrames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < nFrames; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nFrames, 3);
  }
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = stage === 'up' ? 2800 : 1900;
  bp.Q.value = 0.8;
  const ng = ac.createGain();
  ng.gain.value = gain * 0.6;
  noise.connect(bp).connect(ng).connect(ac.destination);
  noise.start(t);
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
    unlockAudio();                       // inside the gesture — flips iOS session + resumes ctx
    playClick('down', cfg.level, cfg.sound);
    vibrate(cfg.level, cfg.haptics);
  }, [cfg]);

  const onRelease = useCallback(() => {
    playClick('up', cfg.level, cfg.sound);
  }, [cfg]);

  return { cfg, setCfg, onPress, onRelease };
}
