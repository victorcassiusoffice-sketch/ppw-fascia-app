# Liquid-Glass Redesign — System Overview

**Source of truth:** `PPW-Second-Brain/06-Roadmap/09-Fascia-App/REBUILD-DIRECTION-2026-06-11.md`
(motion language distilled from Vic's 6 clips) + contact sheets at `_clip-analysis-2026-06-11/`.
**Branch:** `feat/full-redesign-liquid-glass` · 2026-06-11.

## The language in one line

*Frosted glass that glides, soft surfaces that morph, one glowing accent that
traces — and only one thing moves at a time.*

## Five signature moves → where they land

| Move | Clip | Primitive | Applied to |
|---|---|---|---|
| **Glide** | 3 | `glideIndicator` (FM `layoutId`) | DateStrip day pill · Settings theme segment · fasting window segment |
| **Morph** | 1, 5 | `pressScale` + state morph | Mark-done CTA · Activate pills · bell toggle · all buttons (squishy press) |
| **Trace** | 4 | `borderTrace` (SVG dashoffset) | Next-up hero card when it becomes current |
| **Settle** | locked | `settleEmoji` spring | row leading glyphs · streak flame · empty-state orb |
| **Stagger** | 4 | `staggerContainer` + `enterRow` | Today rows · Protocols cards · Modules cards · Settings sections |

## Glass hierarchy (what floats, what's ground)

Three tiers, expressed as CSS tokens in `src/index.css`:

- **GROUND** — `--c-bg-base` + bg-art. Never blurred. Everything sits on it.
- **GLASS** (`.glass`) — frosted floating surface: `backdrop-filter: blur(--glass-blur)`,
  1px border-light (top-lit), dual shadow (ambient + key). For STATIC chrome only:
  sticky top bar, bottom nav dock, overflow menu, hero card, modal scrim.
- **GLASS-STRONG** (`.glass-strong`) — heavier blur + higher opacity for surfaces
  over imagery (hero card over the organic texture).

**Performance law (binding):** `backdrop-filter` ONLY on surfaces that never
animate `transform`/position. Sheets, toasts, the glide pill, and cards while
dragging use SOLID surface tokens. Animations are transform/opacity only.

## Per-theme treatment

- **DARK (default)** = slate + orange *glass-over-organic* (clip 6). One rich
  organic texture — `assets/backgrounds/fascia_fluid_motion.png` (dark ground,
  warm silk ribbons; already shipped) — behind the `/today` hero zone, masked
  to fade out below the hero. Frosted cards float above it. Accent `#E8772E`.
- **LIGHT** = *neumorphic morph* (clips 1, 5). No texture; depth comes from the
  dual nm shadows already merged. Glass tiers map to soft extruded surfaces
  with a faint white-glass film. Accent `#F2792B`.

## Restraint rules

1. ONE thing moves at a time (clip 5). Route change → only the screen moves.
   Row enter → only rows (their glyph settles as a child beat). Pill glide →
   nothing else animates.
2. No bounce anywhere except `settle` (~8% overshoot, the signature beat).
3. Reduced motion: every primitive collapses to opacity-only (already in the
   token set, mandatory).
4. Timing tokens come from `src/lib/motion/index.ts` — components never inline
   magic numbers. Do NOT retime DUR/STAGGER/EASE/SPRING.

## Unchanged (engine + identity)

localStorage shapes · recurrence engine · .ics path · PWA/Pages deploy ·
bottom-nav 5-slot layout + centre bell · helix logo · EB Garamond/Inter ·
feature flags · dual-theme token architecture.

## Boards

1. `01-today.md` — /today (hero zone, day pills, rows)
2. `02-protocols.md` — /protocols + /protocol/:id
3. `03-modules.md` — /modules
4. `04-settings.md` — /settings
5. `05-nav.md` — bottom nav + bell + header
6. `06-sheets-toasts.md` — sheets, modals, toasts, route transitions, theme flip
