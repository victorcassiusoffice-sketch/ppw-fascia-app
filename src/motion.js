// Back-compat shim (2026-06-11 liquid-glass redesign).
//
// The motion system now lives in src/lib/motion/index.ts — the ONE place
// timing/easing/variants are defined. This file re-exports the original
// surface verbatim so every pre-redesign import keeps resolving (Render
// Verification Gate law: a dropped export = hard mount crash). New code
// imports from './lib/motion' directly.

export {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
  motionPresets,
  LEGACY_EASE as EASE,
  LEGACY_SPRING as SPRING,
} from './lib/motion/index.ts';
