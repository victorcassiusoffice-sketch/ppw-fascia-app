# PPW App — Design Principles (Redesign Governance)

_Owner: App-UI Design agent · Established 2026-06-03 · Governs ALL redesign decisions for the PPW Fascia App (Slot Calendar / routine app). PPW App only — not website, not Bonny, not Nook._

## 0. Direction
- **ABANDONED:** cream / Vision-Pro frosted-glass look (Vic: "flop"). Do not revive. Note: `/today` still ships the cream sticky bar + `slot-cream` — it is the thing being replaced.
- **NEW:** modern **dark timeline-card** style — navy background, month/date header, horizontal day-pill strip (selected day highlighted), large rounded **status cards** down a time-rail (status pill, title + subtitle, progress %, ⋮ menu).
- Functionality is **preserved**. Look only changes.

## 1. Explicit changes (Vic, 2026-06-03) — non-negotiable
1. **Notification bell → BOTTOM + LARGER.** Move off the top-right. Make it a prominent bottom element (bottom bar / FAB-scale), not a small 36px toggle. Keep all current behaviour (permission request, on/off, scheduling gate).
2. **Remove the "PPW" text wordmark entirely.** Replace with ONE single minimalist **DNA-helix logo mark** — clean, minimal. Asset to be generated via the Media image agent once style is locked. No text lockup beside it.
3. **Fix symmetry/fit on `/today`.** The "Today" control row reads as "couldn't fit on one line" — crowded, uneven. Rebalance spacing/alignment so nothing crowds or overflows at mobile widths.

## 2. Standing evaluation lens — apply to EVERY screen + every incoming screenshot
Score each screen on these three before proposing or building anything.

### A. Visual Balance
Distribution of visual weight across the layout.
- **Symmetrical** = formal, stable, organized. Use for: settings, forms, confirmation modals, anything that should feel calm/trustworthy.
- **Asymmetrical** = dynamic, modern — achieved through deliberate contrast in size / colour / position. Use for: hero/"next up" zones, the active day, feature tiles.
- Choose deliberately per screen; never accidental. Every screen states which balance it's using and why.

### B. Whitespace / Negative Space
Empty space is an active design element, not leftover.
- Strategic whitespace prevents clutter, guides the eye through hierarchy, improves readability.
- Give the primary action and the active/"next" item room to breathe. Crowding = the `/today` fit problem; whitespace is the fix.
- Prefer fewer elements per row with more breathing room over cramming controls onto one line.

### C. Grid System
Define the structural grid FIRST, then lay every element on it.
- A consistent grid → proportional spacing + symmetry that holds across screen sizes.
- Establish: column count, gutter, base spacing unit (e.g. 4/8px scale), card radius scale, and the horizontal margin. Reuse everywhere.
- Day pills, cards, action buttons, and the bottom bell must all resolve to the same grid/spacing tokens.

## 3. Working rule
Before any mockup: (1) name the grid, (2) state each screen's balance choice, (3) show where whitespace carries hierarchy, (4) confirm the 3 explicit changes are honoured. Report the plan, get Vic's nod, then build.

## 4. Reference status
- Attached image #1 covers the **day-pill strip + collapsed status-card list** style — locked.
- Awaiting Vic's screenshot BATCH for: expanded card, merged/stacked card, Add-Stack sheet, top-bar/hero zone, (lower priority) drawer, empty state, clear-calendar picker, and the new bottom-bell treatment.
- On arrival: re-analyse each screen against A/B/C + the 3 explicit changes; report changes before building.
