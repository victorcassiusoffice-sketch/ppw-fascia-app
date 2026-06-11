# /protocols + /protocol/:id — concept board

Library screens. Clip 4 (dark cinematic cards, stagger) is the reference;
restraint from clip 5.

## /protocols layout

```
┌─────────────────────────────────┐
│ ← Today                         │
│ LIBRARY (eyebrow)               │
│ Protocols (display)             │
│ ┌─────────────────────────────┐ │
│ │ science banner (Register B) │ │  unchanged content imagery
│ └─────────────────────────────┘ │
│ cards (staggerContainer):       │
│ ┌─────────────────────────────┐ │
│ │ VARIANT · KIND              │ │  .card solid; active card gets the
│ │ Topic title        [Activate]│ │  accent hairline + soft accent glow
│ │ 12 studies · 6 daily items  │ │  (clip 4 glow line, static version)
│ │ View full protocol →        │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## Glass hierarchy

- **Ground:** page on bg-art. Cards solid `.card` (hover-translate exists →
  keep solid; no backdrop-filter).
- **Floats:** nothing floats here except global chrome. This screen stays
  calm — the library is ground, /today is the stage.

## Signature moves

1. **Stagger** — cards via `staggerContainer(60)` + `enterRow` (replaces CSS
   `.fade-in-stagger`). Skeletons keep `animate-pulse`.
2. **Morph — Activate pill.** Activate → ✓ Active morphs colour/border in
   place (`pressScale` + colour transition), no layout jump.
3. **Settle** — none. One accent beat per screen; the stagger IS the beat.

## /protocol/:id

- Sections keep scroll-fade (`Section`/`useScrollFadeIn`) — already restrained.
- Stat cards + supplement cards: solid `.card`, no glass (long scroll +
  many elements = blur cost).
- Fasting segmented control (16:8 / 18:6 / …) gets **glideIndicator**
  (`layoutId="fast-window"`) — same pattern as day pills.
- Countdown numerals: big thin tabular (clip 6 typography), accent.

## Reduced motion

Stagger collapses to opacity; glide pill jumps; scroll-fade already guarded.
