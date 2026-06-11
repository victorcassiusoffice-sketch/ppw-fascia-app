# Bottom nav + bell + header — concept board

The persistent chrome. Clip 3 (frosted glide) + clip 1 (morphing blob button).

## Layout (UNCHANGED bones — 5-slot grid, centre bell)

```
┌─────────────────────────────────┐
│  ◇ helix              ☾ Dark    │  header: glass film over scroll
│  …                              │
│ ┌─────────────────────────────┐ │
│ │ Today Protocols (🔔) Mod Set│ │  .glass dock — frosted, border-light,
│ └─────────────╨───────────────┘ │  floats over content. Active tab gets
└─────────────────────────────────┘  a small gliding accent dot (layoutId).
```

## Glass hierarchy

- **Bottom nav = THE glass dock** (clip 3's frosted segmented control).
  `.glass` — backdrop-blur over scrolling content, top border-light,
  dual shadow. Static surface → blur allowed.
- **Bell** — the morphing blob (clip 1). Raised circle; ON state morphs to
  accent fill + soft ring glow. `pressScale(0.93)` squish.
- **Header** — gradient film → glass film (blur fade) so content scrolls
  under it; static → blur allowed.

## Signature moves

1. **Glide — active tab.** A 4px accent dot/pill under the active tab slides
   between slots (`layoutId="nav-dot"`, `SPRING.glide`). Labels colour-fade.
2. **Morph — bell.** OFF (surface, outline glyph) ↔ ON (accent fill, filled
   glyph, `--accent-soft` halo) morphs via colour/shadow transition; the
   toggle moment gets one `settle` scale beat (it's the app's playful organ).
3. Toast above nav: `toastIn` (rise+fade, solid surface — it moves).

## One-thing-moves audit

Tab tap → dot glides + route transitions (the route IS the same beat).
Bell toggle → only the bell morphs; toast follows after.

## Reduced motion

Dot jumps; bell colour-snaps; toast fades only.
