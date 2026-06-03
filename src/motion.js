// Framer Motion (the `motion` package, MIT) — centralised, tree-shaken setup.
//
// We use LazyMotion + the lightweight `m` component so the animation features
// load lazily and the bundle stays small. Every consumer must guard with
// useReducedMotion(): when the user prefers reduced motion we collapse the
// variants to instant (no transform/opacity travel), satisfying the build spec's
// "reduced-motion guarded" requirement.

export { LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion } from 'motion/react';

// Spring + ease presets matching the design tokens (--dur-mid 200ms, --ease).
export const EASE = [0.22, 1, 0.36, 1];
export const SPRING = { type: 'spring', stiffness: 420, damping: 32 };

// Returns variant helpers that no-op when reduced motion is requested.
export function motionPresets(reduced) {
  if (reduced) {
    const none = { initial: false, animate: {}, exit: {}, transition: { duration: 0 } };
    return {
      route: none,
      card: none,
      sheet: { initial: false, animate: {}, exit: {}, transition: { duration: 0 } },
      scrim: { initial: false, animate: {}, exit: {} },
      expand: { initial: false, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: { duration: 0 } },
    };
  }
  return {
    route: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -8 },
      transition: { duration: 0.18, ease: EASE },
    },
    card: {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, scale: 0.97 },
      transition: { duration: 0.22, ease: EASE },
    },
    sheet: {
      initial: { opacity: 0, y: 24 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 24 },
      transition: { duration: 0.24, ease: EASE },
    },
    scrim: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.18 },
    },
    expand: {
      initial: { height: 0, opacity: 0 },
      animate: { height: 'auto', opacity: 1 },
      exit: { height: 0, opacity: 0 },
      transition: { duration: 0.22, ease: EASE },
    },
  };
}
