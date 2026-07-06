// sfx5 — the New Design's UI sounds (soft ASMR, WebAudio synth, no assets).
// Verbatim port of the prototype's sfx(): 'drop' = warm wooden tock + gentle
// tick; 'swish' = filtered noise sweep. Gated by the Sounds setting. A global
// pointerdown listener plays 'drop' on any interactive press (installed once
// from App5), matching the prototype's tap-feel everywhere.

import { getState } from './store5.js';

let _ac = null, _noise = null, _lastSfx = 0;

export function sfx(kind) {
  if (!getState().sounds) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = _ac || (_ac = new AC());
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const now = Date.now();
    if (_lastSfx && now - _lastSfx < 40) return;
    _lastSfx = now;
    if (!_noise) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      _noise = buf;
    }
    if (kind === 'swish') {
      const src = ctx.createBufferSource(); src.buffer = _noise; src.playbackRate.value = 0.9;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(260, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
      bp.frequency.exponentialRampToValueAtTime(700, t + 0.42);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);
      src.connect(bp); bp.connect(g); g.connect(ctx.destination);
      src.start(t); src.stop(t + 0.5);
    } else {
      /* soft ASMR tap: warm wooden tock + gentle tick, no watery chirp */
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(232, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.16);
      const src = ctx.createBufferSource(); src.buffer = _noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 1.3;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.055, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(bp); bp.connect(g2); g2.connect(ctx.destination);
      src.start(t); src.stop(t + 0.06);
    }
  } catch {}
}

// global press sound — one listener, plays 'drop' on any interactive press.
let _installed = false;
export function installPressSound() {
  if (_installed) return () => {};
  _installed = true;
  const onDown = (e) => {
    if (e.target && e.target.closest && e.target.closest('button, a, [role="switch"], input[type="range"], label')) sfx('drop');
  };
  document.addEventListener('pointerdown', onDown, { passive: true });
  return () => { document.removeEventListener('pointerdown', onDown); _installed = false; };
}
