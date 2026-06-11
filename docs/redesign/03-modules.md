# /modules — concept board

Audio library. Smallest screen; gets the calmest treatment (clip 5 restraint).

## Layout

```
┌─────────────────────────────────┐
│ ← Today                         │
│ LISTEN (eyebrow)                │
│ Audio & Modules (display)       │
│ cards (staggerContainer):       │
│ ┌─────────────────────────────┐ │
│ │ 🎧 AUDIO · DEFAULT 14:30    │ │  .card solid; active = accent hairline
│ │ Daytime Stress…   [+ Add]   │ │  glyph (🎧) settles on enter
│ │ [media player]              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## Glass hierarchy

- Ground only. Cards solid `.card`. Media player untouched (engine).

## Signature moves

1. **Stagger** — cards via `staggerContainer` + `enterRow`.
2. **Settle** — the 🎧 glyph (`settleEmoji` child) — the literal worked-example
   beat ("emojis gliding like poetry").
3. **Morph** — Add ↔ ✓ Active pill morphs in place, `pressScale`.

## Reduced motion

Opacity-only, no settle.
