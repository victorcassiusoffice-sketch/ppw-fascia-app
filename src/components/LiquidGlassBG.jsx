// LiquidGlassBG (2026-06-15, Vic "ultra code" — real flowing liquid motion).
//
// A full-bleed WebGL layer that renders SLOW-FLOWING liquid (domain-warped FBM,
// iq-style) tinted to the theme. It sits BEHIND all glass UI; the existing glass
// surfaces (backdrop-filter blur) refract + blur this living ground → genuine
// liquid glass that actually MOVES, not the static refraction sheen.
//
// Why this approach (per liquid-glass-implementation.md law #3 + the iOS limit):
//   - It does NOT use `backdrop-filter: url()` (unsupported on iOS Safari) and it
//     does NOT sample the DOM. It's a self-contained GPU shader on a <canvas>,
//     which iOS Safari runs fine. The glass on top does the refraction via its
//     normal backdrop-blur.
//   - One fullscreen quad + 5-octave value-noise ×3 (domain warp) is a few-µs
//     fragment cost → holds 60fps with wide margin on modern phones.
//
// Graceful fallbacks (hard a11y/perf laws):
//   - prefers-reduced-motion → render ONE static frame, no rAF loop.
//   - no WebGL context → render nothing; the CSS .app-bg gradient shows through.
//   - tab hidden → pause the loop (battery).
//   - DPR capped at 1.5 so hi-dpi phones don't over-shade.

import React, { useRef, useEffect } from 'react';

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// mediump: ample for a soft background; faster + broadest mobile support.
//
// RADICAL REDO (2026-06-22) — CLEAN MINIMAL GROUND.
// The prior 5-octave domain-warped FBM read as a CLOUDY, murky churn — the glass
// over it could never look crisp (Vic: "frosty/murky, nothing like the refs").
// The reference motion videos (app-refs/*.mp4) are the opposite: a SMOOTH grey
// field with ONE or two large, soft LUMINOUS pools slowly drifting, and crisp
// glass catching that moving light. This shader is rebuilt to that: a smooth
// base gradient + a few big gaussian light-pools that orbit slowly. Far less
// visual noise → the glass on top reads CLEAR + glossy, exactly like the refs,
// and the drifting pools give genuinely VISIBLE liquid motion.
const FRAG = `
precision mediump float;
uniform float u_time;
uniform vec2  u_res;
uniform float u_theme;  // 1.0 = light, 0.0 = dark
uniform float u_energy; // 0..1 — interaction energy (scroll velocity + tap impulse, decays)

// Big soft light-pool: aspect-corrected gaussian falloff. Returns 0..1.
float pool(vec2 uv, vec2 c, float r, float asp){
  vec2 d = uv - c; d.x *= asp;
  float x = length(d) / r;
  return exp(-x * x * 2.2);              // smooth gaussian — no hard edge
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  float asp = u_res.x / u_res.y;
  // Calm but VISIBLE drift (Vic flags absent motion every round): wide-travel
  // orbits so the light-pools clearly migrate across the screen over a few
  // seconds. Scroll/tap energy nudges it a touch (responds to the user).
  float t = u_time * (0.080 + u_energy * 0.12);

  // Three large pools tracing WIDE independent orbits → soft, clearly-moving light.
  vec2 c1 = vec2(0.24 + 0.22 * sin(t * 0.95),       0.26 + 0.17 * cos(t * 0.73));
  vec2 c2 = vec2(0.80 + 0.21 * cos(t * 0.66),       0.74 + 0.19 * sin(t * 0.86));
  vec2 c3 = vec2(0.50 + 0.26 * sin(t * 0.47 + 1.6), 0.52 + 0.21 * cos(t * 0.57 + 2.1));
  float p1 = pool(uv, c1, 0.62, asp);
  float p2 = pool(uv, c2, 0.58, asp);
  float p3 = pool(uv, c3, 0.74, asp);

  vec3 col;
  if (u_theme > 0.5) {
    // LIGHT — near-white, clean. Cool light pool + a faint warm one drift across
    // a soft top-lit gradient. Stays bright so dark ink + glass read crisp.
    vec3 base = mix(vec3(0.95, 0.965, 0.985), vec3(0.875, 0.905, 0.945), uv.y);
    col  = base;
    col += p1 * vec3(0.045, 0.055, 0.075);   // cool luminous pool
    col += p2 * vec3(0.060, 0.050, 0.038);   // faint warm pool
    col -= p3 * vec3(0.030, 0.032, 0.040);   // soft shadow lobe → gentle depth
  } else {
    // GRAPHITE (dark) — the REFERENCE ground: a smooth MID-GREY gradient (NOT
    // near-black), exactly like REF-source-btn-v02 / REF-glass-ui-kit-panel.
    // Top is lit (~#525a66), floor is deep graphite (~#262b33); a cool pool + a
    // warm amber pool drift across so the clear glass catches moving light and
    // reads glossy/bevelled. Re-pitches "dark" as refined graphite, per the refs.
    vec3 base = mix(vec3(0.320, 0.350, 0.400), vec3(0.150, 0.168, 0.205), uv.y);
    col  = base;
    col += p1 * vec3(0.140, 0.160, 0.200);   // cool luminous pool (the panel's edge-light feel)
    col += p2 * vec3(0.150, 0.095, 0.045);   // warm amber pool (PPW accent in the light)
    col += p3 * vec3(0.070, 0.080, 0.100);   // mid lift
    col += (u_energy * 0.06) * p1;           // brightens subtly on interaction
  }
  // Soft focal vignette — keeps the eye centred, adds a touch of depth.
  float vig = smoothstep(1.30, 0.25, length(uv - 0.5));
  col *= mix(0.93, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
  return s;
}

export default function LiquidGlassBG({ theme }) {
  const canvasRef = useRef(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' })
        || canvas.getContext('experimental-webgl');
    } catch (_) { gl = null; }
    if (!gl) { canvas.style.display = 'none'; return; } // fallback: CSS gradient shows

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { canvas.style.display = 'none'; return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTheme = gl.getUniformLocation(prog, 'u_theme');
    const uEnergy = gl.getUniformLocation(prog, 'u_energy');

    // Interaction energy (2026-06-15 "movement engagement") — scroll velocity +
    // tap impulse feed `energy`, which decays back to calm each frame. The liquid
    // surges subtly then settles → it feels alive + responds to the user. Caps at
    // 1.0 so it never gets busy; listeners are passive; only in the animated path.
    let energy = 0;
    let lastScrollY = (typeof window !== 'undefined') ? window.scrollY : 0;
    function onScroll() {
      const y = window.scrollY;
      const dv = Math.min(Math.abs(y - lastScrollY) / 60, 0.5); // velocity → impulse
      energy = Math.min(energy + dv, 1);
      lastScrollY = y;
    }
    function onPointerDown() { energy = Math.min(energy + 0.45, 1); } // tap impulse

    // Render the soft liquid ground at REDUCED internal resolution (≈0.6× CSS
    // px, DPR ignored) and let CSS upscale it. It's a blurred ground behind a
    // scrim + the glass's own backdrop-blur, so the downscale is invisible — but
    // it cuts fragment count ~6–9× → a wide 60fps margin on every device
    // (incl. weak Android WebView / this software-rendered harness).
    const RENDER_SCALE = 0.6;
    function resize() {
      const w = Math.max(2, Math.floor((canvas.clientWidth || window.innerWidth) * RENDER_SCALE));
      const h = Math.max(2, Math.floor((canvas.clientHeight || window.innerHeight) * RENDER_SCALE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    }

    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let start = null;
    let running = true;
    function frame(now) {
      if (!running) return;
      if (start == null) start = now;
      resize();
      energy *= 0.93; // ease back to calm (~0.9s settle)
      gl.uniform1f(uTheme, themeRef.current === 'light' ? 1.0 : 0.0);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform1f(uEnergy, energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }

    function renderOnce() {
      resize();
      gl.uniform1f(uTheme, themeRef.current === 'light' ? 1.0 : 0.0);
      gl.uniform1f(uTime, 0);
      gl.uniform1f(uEnergy, 0); // reduced-motion: calm, no interaction surge
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function onVisibility() {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce && !running) { running = true; start = null; raf = requestAnimationFrame(frame); }
    }

    if (reduce) {
      renderOnce(); // static liquid frame — honours prefers-reduced-motion (no listeners)
    } else {
      raf = requestAnimationFrame(frame);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('pointerdown', onPointerDown, { passive: true });
    }
    window.addEventListener('resize', resize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
      // NB: deliberately NOT calling WEBGL_lose_context here. React StrictMode
      // (and toggling the liquid bg off→on) remounts this component on the SAME
      // canvas; losing the context permanently breaks the remount's getContext.
      // The browser releases the context when the canvas node is GC'd.
    };
  }, []);

  return <canvas ref={canvasRef} className="liquid-bg-canvas" aria-hidden="true" />;
}
