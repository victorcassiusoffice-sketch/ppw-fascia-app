# /settings — concept board

Control surfaces. Clip 1 (neumorphic morphing controls) + clip 3 (glide
segments) land here.

## Layout

```
┌─────────────────────────────────┐
│ ← Today                         │
│ CONFIGURE (eyebrow)             │
│ Settings (display)              │
│ Appearance                      │
│ ┌─────────────────────────────┐ │
│ │ Theme                       │ │  3-way segment: ONE gliding indicator
│ │ [☀ Light][☾ Dark][⌖ System] │ │  (layoutId="theme-seg") — clip 3 move.
│ └─────────────────────────────┘ │  Light theme: pill is embossed neumorphic
│ Notifications · Reminders ·     │  (clip 1); dark: frosted glass pill.
│ Fasting · Data source ·         │
│ Active state · About            │  sections stagger on mount (loose cadence)
└─────────────────────────────────┘
```

## Glass hierarchy

- Cards solid `.card` (ground). The gliding theme indicator is the only
  "glass chip" — solid-tinted in dark (it animates position → NO blur).
- Inset wells (`card-inset`) stay for inputs — clip 1's pressed-in surfaces.

## Signature moves

1. **Glide — theme segment.** The active state becomes one sliding indicator
   (`glideIndicator`, `SPRING.glide`). Same for Mock/Live toggle (2-seg).
2. **Morph — IF toggle.** On/Off pill morphs colour in place; `pressScale`.
3. **Stagger** — sections enter with `staggerContainer(STAGGER.loose)` +
   `enterRow` — one calm cascade, then stillness.

## Theme flip (the Settings superpower)

Flipping theme animates ONLY colours (CSS token transition on body — already
wired). Nothing translates. Clip 5: one thing changes.

## Reduced motion

Segment indicator jumps; stagger collapses; colour transition killed by the
existing `prefers-reduced-motion` body rule.
