# Sheets, modals, toasts, route transitions, theme flip — concept board

The connective tissue. Clip 4 (soft toast glide, no bounce) + clip 5 (one
thing moves).

## Sheets / modals (AddStackModal, AddProtocolModal, Clear, recurring-delete)

```
        ┌─────────────────────┐
        │ scrim (.ppw-scrim)  │  blurred + dark; OPACITY-only anim → blur OK
        │ ┌─────────────────┐ │
        │ │ sheet (solid)   │ │  sheetUp spring (300/30) — arrives, no boing.
        │ │ surface-active  │ │  SOLID surface: it animates y → NO backdrop-
        │ └─────────────────┘ │  filter on the sheet itself.
        └─────────────────────┘
```

- Scrim: static blur layer, fades in (`presets.scrim` → opacity only). The
  scrim carries the glass feel; the sheet carries the content.
- Sheet enter: `sheetUp` (`SPRING.sheet`). Exit: fast slide-down (`DUR.fast`).
- Recurring-delete scope sheet + Clear modal: same grammar.

## Toasts

- `toastIn`: rise 16px + fade, spring 320/26, no bounce (clip 4's soft toast).
- Solid surface pill (moves → no blur). Auto-dismiss exits opacity-only.
- Both the bottom-nav flash and TodayView's inline toast use the same variant.

## Route transitions

- Keep enter-only keyed `m.div` (held exits block SPA nav — known constraint).
- Variant: `screenTransition` show-half only (rise `SHIFT.screen` + fade,
  `DUR.slow`, `EASE.standard`). The ONE thing that moves on nav.

## Theme flip

- Colour-only transition (body token transition, `--dur-mid`). No transform.
- Organic hero texture cross-fades via `--hero-art-opacity` (0 in light).

## Reduced motion

Scrim/sheet/toast → instant opacity. Route → instant. Already factory-guarded.
