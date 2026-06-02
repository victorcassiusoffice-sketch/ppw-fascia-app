/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:     '#0a1628',
        accent: '#FFBB58',
        cream:  '#F5EBD7',
        teal:   '#4a9eb8',
        ink:    '#F5EBD7',
        muted:  '#7b8eaa',
        'ppw-bg':    '#0a1628',
        'ppw-gold':  '#FFBB58',
        'ppw-cream': '#F5EBD7',
        'ppw-teal':  '#4a9eb8',
        /* Slot Calendar re-skin (2026-06-02) — cream / "Vision-Pro" tokens.
           Additive: scoped to the /today surface via the .slot-cream class.
           Existing dark tokens above are untouched so other routes are unaffected. */
        'cream-bg':   '#ECEBE9',
        glass:        '#FFFFFF',
        'ink-dark':   '#1A1A1A',
        slate:        '#5B6472',
        gold:         '#DCA957',
        amber:        '#F5B845',
        'amber-deep': '#E8893A',
        emerald:      '#1E7A52',
        coral:        '#D9655B',
      },
      fontFamily: {
        // v2 (2026-06-02) — serif retired app-wide. EB Garamond headers read
        // as the Bonny "Listening Body" brand; the Vision-Pro target is
        // sans-serif throughout. `display` now points at the same sans stack
        // as `body`, so every existing `font-display` header renders clean
        // sans with no per-call JSX churn.
        display: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        body:    ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
