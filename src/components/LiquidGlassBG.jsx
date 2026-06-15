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
const FRAG = `
precision mediump float;
uniform float u_time;
uniform vec2  u_res;
uniform float u_theme; // 1.0 = light, 0.0 = dark

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  uv.x *= u_res.x / u_res.y;
  float t = u_time * 0.09;                       // calm flow — visible but not distracting
  vec2 q = vec2(fbm(uv * 2.2 + t),
                fbm(uv * 2.2 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(uv * 2.2 + 2.0 * q + vec2(1.7, 9.2) + 0.15 * t),
                fbm(uv * 2.2 + 2.0 * q + vec2(8.3, 2.8) - 0.12 * t));
  float f = fbm(uv * 2.2 + 2.5 * r);

  vec3 col;
  if (u_theme > 0.5) {
    vec3 a = vec3(0.86, 0.88, 0.92), b = vec3(0.72, 0.77, 0.85), acc = vec3(0.97, 0.90, 0.83);
    col = mix(a, b, clamp(f * f * 2.2, 0.0, 1.0));
    col = mix(col, acc, clamp(r.x * 0.5, 0.0, 0.38));
  } else {
    vec3 a = vec3(0.06, 0.07, 0.10), b = vec3(0.12, 0.15, 0.21), acc = vec3(0.30, 0.16, 0.07);
    col = mix(a, b, clamp(f * f * 2.2, 0.0, 1.0));
    col = mix(col, acc, clamp(r.x * 0.42, 0.0, 0.34));
  }
  col += 0.05 * smoothstep(0.62, 0.96, f);       // caustic sheen highlights
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
      gl.uniform1f(uTheme, themeRef.current === 'light' ? 1.0 : 0.0);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }

    function renderOnce() {
      resize();
      gl.uniform1f(uTheme, themeRef.current === 'light' ? 1.0 : 0.0);
      gl.uniform1f(uTime, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function onVisibility() {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce && !running) { running = true; start = null; raf = requestAnimationFrame(frame); }
    }

    if (reduce) {
      renderOnce(); // static liquid frame — honours prefers-reduced-motion
    } else {
      raf = requestAnimationFrame(frame);
      document.addEventListener('visibilitychange', onVisibility);
    }
    window.addEventListener('resize', resize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      // NB: deliberately NOT calling WEBGL_lose_context here. React StrictMode
      // (and toggling the liquid bg off→on) remounts this component on the SAME
      // canvas; losing the context permanently breaks the remount's getContext.
      // The browser releases the context when the canvas node is GC'd.
    };
  }, []);

  return <canvas ref={canvasRef} className="liquid-bg-canvas" aria-hidden="true" />;
}
