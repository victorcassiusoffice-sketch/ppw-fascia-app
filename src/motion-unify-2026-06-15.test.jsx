// Motion unification (2026-06-15) — one coherent motion language across page
// transitions AND selection states. Locks the two unifications:
//   1. The route shell consumes the shared `screenTransition` primitive (every
//      route enters identically — no horizontal-vs-vertical split).
//   2. Tailwind's `transition-*` utilities resolve to the app's standard curve
//      + family duration, so CSS-driven selections (rings, borders, colour
//      fades) ease identically to the bespoke CSS (`var(--ease)`) and the
//      Framer springs (`EASE.standard`).
import { describe, it, expect } from 'vitest';
import { screenTransition, EASE, SHIFT, DUR } from './lib/motion';
import twConfig from '../tailwind.config.js';

const APP_CURVE = 'cubic-bezier(0.22, 1, 0.36, 1)';

describe('Motion — one shared route primitive', () => {
  it('screenTransition enters on the locked screen tokens (rise + fade, no x-slide)', () => {
    // jsdom has no matchMedia → reduced() === false → full variant.
    expect(screenTransition.hidden).toMatchObject({ opacity: 0, y: SHIFT.screen });
    // The unified entrance moves on a SINGLE axis (vertical rise) — never x.
    expect(screenTransition.hidden).not.toHaveProperty('x');
    expect(screenTransition.show.opacity).toBe(1);
    expect(screenTransition.show.y).toBe(0);
    expect(screenTransition.show.transition.duration).toBeCloseTo(DUR.slow / 1000, 5);
    expect(screenTransition.show.transition.ease).toEqual(EASE.standard);
  });

  it('EASE.standard is the app curve (matches index.css --ease and the Tailwind default)', () => {
    const [a, b, c, d] = EASE.standard;
    expect(`cubic-bezier(${a}, ${b}, ${c}, ${d})`).toBe(APP_CURVE);
  });
});

describe('Motion — Tailwind utility transitions share the app easing', () => {
  const ext = twConfig.theme.extend;

  it('transitionTimingFunction.DEFAULT is the app standard curve (not Tailwind 0.4,0,0.2,1)', () => {
    expect(ext.transitionTimingFunction.DEFAULT).toBe(APP_CURVE);
  });

  it('transitionDuration.DEFAULT is the family state-change tier (200ms), not 150ms', () => {
    expect(ext.transitionDuration.DEFAULT).toBe('200ms');
  });
});
