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

// Module-level LIVE config mirror so the global press-sound listener (which is
// not a React component) always knows the current Level/sound/haptics without a
// re-subscribe. Updated on every save + by useSoftTactile's effect.
let _liveCfg = null;
export function liveTactile() { if (!_liveCfg) _liveCfg = loadTactile(); return _liveCfg; }

export function saveTactile(cfg) {
  _liveCfg = cfg;
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
// ── HTMLAudio WAV fallback (2026-06-19) — for engines where WebAudio is blocked
// or fails (rare, but the user hit "no sound" repeatedly so we belt-and-brace).
// A short pitch-dropping click is PCM-synthesised in pure JS (no AudioContext
// needed) into a WAV Blob URL once, then played through a tiny <audio> pool. ──
let _wavUrl = null;
let _audioPool = null;
let _poolIdx = 0;
function clickWavUrl() {
  if (_wavUrl || typeof window === 'undefined' || typeof Blob === 'undefined') return _wavUrl;
  // Liquid-drop (2026-06-20): a rounded sine that bends UP in pitch with a soft
  // attack + gentle decay — a water "plip", no noise edge (matches the WebAudio
  // path). dur longer than the old tick so it reads as a drop, not a click.
  const sr = 44100, dur = 0.14, n = Math.floor(sr * dur);
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  ws(36, 'data'); dv.setUint32(40, n * 2, true);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const frac = i / n;
    // soft attack over first 12%, gentle exponential decay after.
    const env = frac < 0.12 ? frac / 0.12 : Math.pow(1 - (frac - 0.12) / 0.88, 2.4);
    const f = 440 * (1 + 1.2 * Math.min(1, frac / 0.85));   // 440 → ~970 Hz rise
    phase += (2 * Math.PI * f) / sr;
    let s = Math.sin(phase) * env;
    s = Math.max(-1, Math.min(1, s));
    dv.setInt16(44 + i * 2, s * 32767, true);
  }
  try { _wavUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); } catch (_) { _wavUrl = null; }
  return _wavUrl;
}
function playClickFallback(gain) {
  const url = clickWavUrl();
  if (!url || typeof Audio === 'undefined') return;
  if (!_audioPool) { _audioPool = [0, 1, 2].map(() => { const a = new Audio(url); a.preload = 'auto'; return a; }); }
  const a = _audioPool[_poolIdx = (_poolIdx + 1) % _audioPool.length];
  try { a.volume = Math.min(1, gain * 1.4); a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* ignore */ }
}

// LIQUID-DROP press sound (2026-06-20, Vic FRESH-EYES: "make the click a softer
// liquid-drop, not the current tick"). A water droplet = a rounded SINE pluck
// that bends UP in pitch (the "plip"), through a resonant low-pass so there is
// NO bright noise edge, with a soft attack and a gentle bell-like decay. The
// harsh bandpass-noise transient that made the old sound a "tick" is gone.
// down ≈ a fuller, lower drop; up ≈ a lighter, higher droplet (rarely played).
export function playClick(stage, level, soundEnabled) {
  const gain = gainForLevel(level, stage, soundEnabled);
  if (gain <= 0) return;
  const ac = ctx();
  if (!ac) { playClickFallback(gain); return; }     // WebAudio unavailable → HTMLAudio WAV
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - _lastPlay < 28) return;                 // throttle: one drop / 28ms
  _lastPlay = now;

  const t = ac.currentTime;
  const dur = stage === 'up' ? 0.10 : 0.14;         // longer than a click → rounded drop

  // Pitch-rising sine = the droplet "plip" (low → up). Sine only, no noise edge.
  const osc = ac.createOscillator();
  osc.type = 'sine';
  const f0 = stage === 'up' ? 620 : 440;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + dur * 0.85);

  // Resonant low-pass softens any edge and gives the watery "bloop" body.
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.6);
  lp.Q.value = 6;

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);   // soft attack (not a snap)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);   // gentle decay

  osc.connect(lp).connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
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

// ── GLOBAL press-sound (2026-06-19, ROOT-CAUSE FIX) ─────────────────────────
// The click sound was previously wired ONLY to /soft-lab + the Settings toggle,
// so tapping the actual app (nav, bell, cards, CTAs) was SILENT — that is why
// "sound doesn't work" recurred. This installs ONE capture-phase pointerdown
// listener so EVERY interactive press app-wide plays the click when sound is
// enabled. pointerdown IS the user gesture, so it also unlocks the audio context
// on the first tap. Throttled in playClick (so a component that ALSO plays on
// press doesn't double-fire). Mounted once from App.
const PRESS_SELECTOR =
  'a[href], button, [role="button"], summary, label, ' +
  'input[type="checkbox"], input[type="radio"], ' +
  '.seg-opt, .glass-switch, .glass-disc, .glass-capsule, .navbtn, .bell, .nav-bead, [data-click-sound]';
let _globalInstalled = false;
export function installGlobalPressSound() {
  if (typeof document === 'undefined' || _globalInstalled) return () => {};
  _globalInstalled = true;
  const onDown = (e) => {
    const cfg = liveTactile();
    if (!cfg.sound || cfg.level === 'off') return;
    const t = e.target;
    const el = t && t.closest ? t.closest(PRESS_SELECTOR) : null;
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    unlockAudio();
    playClick('down', cfg.level, cfg.sound);
    vibrate(cfg.level, cfg.haptics);
  };
  document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  return () => { document.removeEventListener('pointerdown', onDown, { capture: true }); _globalInstalled = false; };
}
