# /today — concept board

The flagship screen. Clip 6 (glass over organic) + clip 3 (glide) + clip 4
(trace + stagger) all land here.

## Layout (unchanged bones, re-clothed)

```
┌─────────────────────────────────┐
│ ORGANIC TEXTURE ZONE (dark only)│  fascia_fluid_motion.png, fixed behind,
│ ┌─────────────────────────────┐ │  masked fade-out ~480px down
│ │ sticky glass top bar        │ │  .glass-strong — month · ring · streak
│ │  June 2026        ◔ 40% 🔥3 │ │
│ │  [M][T][W][≡T≡][F][S][S]    │ │  ← day pills: ONE sliding glass pill
│ │  [+ Stack][+ Protocol][⋯]   │ │    (glideIndicator, layoutId="day-pill")
│ ├─────────────────────────────┤ │
│ │ NEXT-UP HERO  .glass-strong │ │  ← borderTrace draws around it on mount /
│ │  next up                    │ │    when nextUp changes. Big thin tabular
│ │  07:30                      │ │    numerals (clip 6 typography).
│ │  Morning fascia release     │ │
│ │  [Open ▸]            ◔ 92px│ │
│ └─────────────────────────────┘ │
│  rows (staggerContainer):       │  ← enterRow rise+fade, 60ms cadence;
│  ┌───────────────────────────┐  │    leading glyph settles (settleEmoji)
│  │ ≡ ☐ [07:30] Title  ⋯ ▾   │  │    cards = solid surface (drag-animated)
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## Glass hierarchy

- **Floats:** sticky top bar (glass-strong over texture), Next-up hero
  (glass-strong, the ONE card over the organic zone), overflow ⋯ menu (glass).
- **Ground:** stack rows stay SOLID `.card` — they drag/reorder (transform-
  animated) so no backdrop-filter, and visual depth must read against the
  hero's glass, not compete with it.
- Texture is dark-theme only (`--hero-art-opacity: 0` in light); light theme
  hero = neumorphic raised card (clip 1 emboss).

## Signature moves

1. **Glide — day pills.** The selected state stops being a per-button bg flip.
   ONE pill (`layoutId="day-pill"`, `SPRING.glide`) slides under the labels;
   label colour cross-fades via CSS. Today's outline ring stays static.
2. **Trace — hero.** SVG rect stroke (accent, 1.5px, rounded corners) draws
   around the hero via dashoffset when `nextUp.id` changes. Transform/opacity/
   dashoffset only — runs once per change, not a loop.
3. **Stagger + settle — rows.** List wrapped in `staggerContainer(60)`; rows
   `enterRow` (replaces CSS `.fade-in-stagger`); each row's leading time-chip
   settles (`settleEmoji`) a beat after its row.
4. **Morph — Mark done.** The CTA morphs bg/label between states (FM layout +
   colour cross-fade), no swap-flash. Press = `pressScale(0.96)`.

## One-thing-moves audit

Day switch → pill glides; rows re-stagger AFTER pill lands (FM handles via
exit-before-enter on the keyed list; keep exits instant `DUR.fast`).
Hero trace fires only when rows are settled (delay = container delayChildren).

## Reduced motion

Pill: instant jump (layout animation disabled). Trace: full stroke, no draw.
Rows: opacity-only, no stagger. Settle: none.
