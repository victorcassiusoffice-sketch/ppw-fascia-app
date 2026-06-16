/**
 * PPW App — Motion primitives (Framer Motion / web)
 * ------------------------------------------------------------------
 * Merged from the vault motion system
 * (06-Roadmap/app-ui/motion-system/05-motion-primitives.ts, LOCKED tokens)
 * on 2026-06-11 for the liquid-glass redesign, plus the two clip-derived
 * primitives the redesign added: glideIndicator + borderTrace.
 *
 * Stack (LOCKED): Framer Motion — package `motion` (MIT), import from
 * "motion/react". This is the ONE place motion is defined. Components import
 * named variants/transitions from here — never inline magic numbers. Change a
 * token below and the whole app re-times together.
 *
 * Back-compat: src/motion.js re-exports from this module so every existing
 * import keeps resolving (Render Verification Gate law: never drop an export).
 */

import type { Variants, Transition } from "motion/react";

/* Centralised Framer Motion surface — LazyMotion + lightweight `m` keeps the
 * bundle small; consumers import the runtime bits from here too. */
export {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";

/* ==================================================================
 * 1 · GLOBAL TIMING TOKENS  — the dials. Tune HERE, nowhere else.
 * ================================================================== */

/** Durations (ms) for timing-based motion. */
export const DUR = {
  fast: 160, // taps, exits, micro-feedback
  base: 280, // standard enter (rows, cards, fades)
  slow: 360, // route / screen transitions, "luxurious" reveals
  xslow: 480, // hero / first-paint flourish (use sparingly)
  // The liquid metaball morph (stack-card action cluster melting open from ONE
  // mass into separate discs — REF Recording A). Deliberately slow so the thick
  // liquid necks read: the reference neck window is ~500–650ms inside a ~1.4s
  // expand; we hold that character at a touch tighter 1100ms. Far above xslow
  // by design — see the advanced-liquid-morph skill for the why + fps budget.
  morph: 1100,
} as const;

/** Stagger gaps (ms) between siblings — set on CONTAINERS. */
export const STAGGER = {
  tight: 40,
  list: 60, // default list reveal cadence
  loose: 80, // more cinematic, more breathing room
} as const;

/** Easing curves for timing-based motion. */
export const EASE = {
  /** App standard — easeOutExpo-ish. Smooth arrival, no bounce. */
  standard: [0.22, 1, 0.36, 1] as const,
  /** Quick, decisive (exits / dismissals). */
  out: [0.4, 0, 1, 1] as const,
  /** Gentle both-ends (rare; symmetric moves). */
  inOut: [0.65, 0, 0.35, 1] as const,
};

/** Spring configs — the "poetry". stiffness=eager, damping=restraint. */
export const SPRING: Record<string, Transition> = {
  /** Soft float, tiny overshoot — the default "gliding" feel. */
  glide: { type: "spring", stiffness: 120, damping: 22, mass: 1 },
  /** Emoji settle — overshoots ~8% then settles. The signature beat. */
  settle: { type: "spring", stiffness: 260, damping: 14, mass: 0.9 },
  /** Press feedback — fast, no overshoot. */
  press: { type: "spring", stiffness: 400, damping: 28, mass: 0.8 },
  /** Sheet / modal glide-up — no bounce, just arrive. */
  sheet: { type: "spring", stiffness: 300, damping: 30, mass: 1 },
  /** Liquid morph — shape/radius/scale changes that should MELT between
   *  states (open/close/select). Softer + heavier than glide: a slow, fluid
   *  settle with a whisper of overshoot. The "more liquid morph" beat. */
  liquid: { type: "spring", stiffness: 112, damping: 17, mass: 1.1 },
};

/** Translate distances (px). */
export const SHIFT = {
  row: 14, // row rise on enter
  screen: 16, // screen slide on route change
  toast: 16, // toast rise
} as const;

/* ==================================================================
 * 2 · REDUCED MOTION  — hard requirement, not optional.
 * ================================================================== */

/**
 * True when the user has prefers-reduced-motion: reduce.
 * SSR/static-safe (the app is a GitHub Pages SPA, but guard anyway).
 */
export function reduced(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Opacity-only fallback shared by every primitive under reduced motion. */
const REDUCED_ENTER: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
};

/* ==================================================================
 * 3 · NAMED PRIMITIVES  — what components import.
 * ================================================================== */

/**
 * staggerContainer — parent that orchestrates children's enter, the FM way.
 * Put on the <m.ul>/<m.section> wrapping a list. Children with their own
 * `enterRow`/`settleEmoji` variants inherit the timing.
 */
export function staggerContainer(
  gap: number = STAGGER.list,
  delayChildren: number = 0,
): Variants {
  if (reduced()) {
    return {
      hidden: {},
      show: { transition: { staggerChildren: 0, delayChildren: 0 } },
    };
  }
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: gap / 1000, // FM uses seconds
        delayChildren: delayChildren / 1000,
      },
    },
  };
}

/**
 * enterRow — list row / card fade + rise. Use as a CHILD variant inside a
 * staggerContainer (the container times it). Falls back to opacity-only.
 */
export const enterRow: Variants = reduced()
  ? REDUCED_ENTER
  : {
      hidden: { opacity: 0, y: SHIFT.row },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: DUR.base / 1000, ease: EASE.standard },
      },
    };

/**
 * settleEmoji — playful glyph: scale-in past full size, then settles.
 * Vic's "gliding like poetry" beat. Nest inside a row so it lands a touch
 * after the row begins.
 */
export const settleEmoji: Variants = reduced()
  ? REDUCED_ENTER
  : {
      hidden: { opacity: 0, scale: 0.6 },
      show: {
        opacity: 1,
        scale: 1,
        transition: { ...SPRING.settle, delay: 0.08 },
      },
    };

/**
 * pressScale — tap/press feedback for any interactive element. Spread the
 * returned props onto an <m.button>/<m.div>. Reduced motion → no-op.
 *
 *   <m.button {...pressScale()}>…</m.button>
 */
export function pressScale(downScale: number = 0.94) {
  if (reduced()) return {};
  return {
    // 2026-06-15 "movement engagement": a touch deeper squish (0.96→0.94) + the
    // springy `settle` on RELEASE gives a satisfying liquid rebound on every
    // press app-wide; press-down stays on the fast no-overshoot `press` spring.
    whileTap: { scale: downScale, transition: SPRING.press },
    whileHover: { scale: 1.03 },
    transition: SPRING.settle,
  } as const;
}

/**
 * liquidMorph — wrap an element that should MELT between two states (selected /
 * open). Spread the returned props; pass `on` to drive the morph. The element
 * fluidly settles its corner-radius + scale on SPRING.liquid — the "more liquid
 * morph" character. Reduced motion → no transform (CSS still cross-fades).
 *
 *   <m.div {...liquidMorph(isSelected)}>…</m.div>
 */
export function liquidMorph(on: boolean, opts: { radius?: number; lift?: number } = {}) {
  const { radius = 30, lift = 1.012 } = opts;
  if (reduced()) return {};
  return {
    animate: { borderRadius: on ? radius : 24, scale: on ? lift : 1 },
    transition: SPRING.liquid,
  } as const;
}

/**
 * screenTransition — whole-screen / route change. Wrap each route's root in an
 * <m.main variants={screenTransition} initial="hidden" animate="show"
 * exit="exit">. (This app uses enter-only keyed transitions at the router —
 * a held exit can block the next route from mounting on SPA navigation.)
 */
export const screenTransition: Variants = reduced()
  ? {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0 } },
      exit: { opacity: 0, transition: { duration: 0 } },
    }
  : {
      hidden: { opacity: 0, y: SHIFT.screen },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: DUR.slow / 1000, ease: EASE.standard },
      },
      exit: {
        opacity: 0,
        y: -SHIFT.screen / 2,
        transition: { duration: DUR.fast / 1000, ease: EASE.out },
      },
    };

/**
 * sheetUp — modal / bottom-sheet glide-up (Add-stack, Add-content). Pair with
 * <AnimatePresence>. No bounce — it should arrive, not boing.
 * NOTE (liquid-glass perf law): the sheet animates position — its surface must
 * be SOLID, never backdrop-filtered. The static scrim carries the blur.
 */
export const sheetUp: Variants = reduced()
  ? {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0 } },
      exit: { opacity: 0, transition: { duration: 0 } },
    }
  : {
      hidden: { opacity: 0, y: "100%" },
      show: { opacity: 1, y: 0, transition: SPRING.sheet },
      exit: {
        opacity: 0,
        y: "100%",
        transition: { duration: DUR.fast / 1000, ease: EASE.out },
      },
    };

/**
 * toastIn — transient confirmation ("Saved ✓"). Rise + fade with a soft spring.
 */
export const toastIn: Variants = reduced()
  ? REDUCED_ENTER
  : {
      hidden: { opacity: 0, y: SHIFT.toast },
      show: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 320, damping: 26 },
      },
      exit: { opacity: 0, transition: { duration: DUR.fast / 1000 } },
    };

/* ==================================================================
 * 3b · CLIP-DERIVED PRIMITIVES (2026-06-11 redesign)
 * ================================================================== */

/**
 * glideIndicator — clip 3's "glass glide": segmented controls (day pills,
 * theme segment, fasting windows, nav dot) render ONE indicator element that
 * slides between options via Framer Motion's shared `layoutId`.
 *
 * Render the indicator INSIDE the active option only; FM animates it across:
 *
 *   {active && <m.span {...glideIndicator('day-pill')} className="…" />}
 *
 * Position animation is transform-based (FM layout animations animate
 * transform, not top/left). Reduced motion → instant jump.
 * Perf law: the indicator surface must be SOLID (it moves) — no blur.
 */
export function glideIndicator(layoutId: string) {
  return {
    layoutId,
    transition: reduced() ? { duration: 0 } : SPRING.glide,
  } as const;
}

/**
 * borderTrace — clip 4's "glow trace": a thin accent line draws around the
 * active card's border. Apply to an SVG <m.rect> overlaying the card:
 *
 *   <svg className="border-trace" aria-hidden>
 *     <m.rect variants={borderTrace} initial="hidden" animate="show"
 *             x="1" y="1" rx="24" width="…" height="…" />
 *   </svg>
 *
 * Animates pathLength (stroke-dashoffset under the hood) + opacity only —
 * no layout, no filter. Runs once per trigger (key it on the traced id).
 * Reduced motion → full stroke, no draw.
 */
export const borderTrace: Variants = reduced()
  ? {
      hidden: { pathLength: 1, opacity: 0 },
      show: { pathLength: 1, opacity: 1, transition: { duration: 0 } },
    }
  : {
      hidden: { pathLength: 0, opacity: 0 },
      show: {
        pathLength: 1,
        opacity: 1,
        transition: {
          pathLength: { duration: DUR.xslow / 1000, ease: EASE.standard },
          opacity: { duration: DUR.fast / 1000 },
        },
      },
    };

/* ==================================================================
 * 4 · LEGACY PRESETS (pre-redesign surface, kept verbatim)
 * ================================================================== */

/** Legacy ease/spring shapes (src/motion.js originals — consumers persist). */
export const LEGACY_EASE = [0.22, 1, 0.36, 1] as const;
export const LEGACY_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
};

/** Returns variant helpers that no-op when reduced motion is requested. */
export function motionPresets(reducedFlag: boolean) {
  if (reducedFlag) {
    const none = {
      initial: false as const,
      animate: {},
      exit: {},
      transition: { duration: 0 },
    };
    return {
      route: none,
      card: none,
      sheet: {
        initial: false as const,
        animate: {},
        exit: {},
        transition: { duration: 0 },
      },
      scrim: { initial: false as const, animate: {}, exit: {} },
      expand: {
        initial: false as const,
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0 },
      },
    };
  }
  return {
    route: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -8 },
      transition: { duration: 0.18, ease: LEGACY_EASE },
    },
    card: {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, scale: 0.97 },
      transition: { duration: 0.22, ease: LEGACY_EASE },
    },
    sheet: {
      initial: { opacity: 0, y: 24 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 24 },
      transition: { duration: 0.24, ease: LEGACY_EASE },
    },
    scrim: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.18 },
    },
    expand: {
      initial: { height: 0, opacity: 0 },
      animate: { height: "auto", opacity: 1 },
      exit: { height: 0, opacity: 0 },
      transition: { duration: 0.22, ease: LEGACY_EASE },
    },
  };
}

/* ==================================================================
 * 5 · CONVENIENCE RE-EXPORT
 * ================================================================== */

export const motionTokens = { DUR, STAGGER, EASE, SPRING, SHIFT } as const;
