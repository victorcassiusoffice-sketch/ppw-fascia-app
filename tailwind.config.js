/** @type {import('tailwindcss').Config} */

// Dual-theme (2026-06-03): semantic colour names resolve to CSS-variable RGB
// channel triplets defined per [data-theme] in src/index.css. Using the
// rgb(var(--x) / <alpha-value>) form keeps every Tailwind opacity utility
// (bg-cream/5, text-muted/80, border-accent/40) working AND theme-aware, so the
// existing JSX utility classes re-skin on a single data-theme flip with no churn.
const tok = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core semantic tokens (theme-flipped)
        bg:               tok('--c-bg-base'),
        surface:          tok('--c-surface'),
        'surface-active': tok('--c-surface-active'),
        'surface-inset':  tok('--c-surface-inset'),
        accent:           tok('--c-accent'),
        'accent-bright':  tok('--c-accent-bright'),
        'on-accent':      tok('--c-on-accent'),
        cream:            tok('--c-ink-hi'),   // legacy name → primary ink
        ink:              tok('--c-ink-hi'),
        muted:            tok('--c-ink-mid'),
        'ink-low':        tok('--c-ink-low'),
        teal:             tok('--c-alt-teal'),
        'status-done':    tok('--c-status-done'),
        'status-now':     tok('--c-status-now'),
        'status-later':   tok('--c-status-later'),
        'status-alert':   tok('--c-status-alert'),

        // Legacy ppw-* aliases (kept; now theme-aware)
        'ppw-bg':    tok('--c-bg-base'),
        'ppw-gold':  tok('--c-accent'),
        'ppw-cream': tok('--c-ink-hi'),
        'ppw-teal':  tok('--c-alt-teal'),

        // Static brand candy values (used by gradient tiles; not theme-flipped)
        // 2026-06-11: legacy warm-gold `gold: #DCA957` retired (zero usages —
        // accent is orange per REBUILD-DIRECTION §2; brand gold lives only in
        // the helix/streak/Pro-badge brand thread, not as a utility colour).
        'cream-bg':   '#ECEBE9',
        glass:        '#FFFFFF',
        'ink-dark':   '#1A1A1A',
        slate:        '#5B6472',
        amber:        '#F5B845',
        'amber-deep': '#E8893A',
        emerald:      '#1E7A52',
        coral:        '#D9655B',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        body:    ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
