# PPW App — Redesign Build Spec (DUAL-THEME SYNTHESIS)

_Owner: App-UI Design agent · v2 2026-06-03 · PPW Fascia App (Slot-Calendar routine app) ONLY._
_Governed by `docs/DESIGN-PRINCIPLES.md`. Inputs fused: 4 LIGHT refs (neumorphic soft-UI) + 3 DARK refs (dark-slate design system, deep-teal-silk, dark neumorphic dashboard) + `docs/design-trends-2025-report.md` (fuselab) + Vic's lens (balance / whitespace / grid) + the 4 explicit changes (bell→bottom+larger · single DNA-helix logo · /today symmetry · faded body-zone background)._

> **This is the approval baseline for a DUAL-THEME, fully tokenised design: LIGHT (neumorphic soft-UI) ↔ DARK (dark-slate neumorphic + orange).** One toggle flips colours, shadows/elevation, borders, radii. Geometry (spacing, radius, elevation steps, grid) is shared; only the token VALUES differ per theme. Mockup: `docs/mockup-today.html`. Do not touch the live app until Vic approves.

---

## 0. Reference synthesis — what each set contributes

| Source | What we take |
|---|---|
| **LIGHT — Fitness app** (closest to ours) | Soft-extruded cards (dual light/dark shadow), circular gradient progress ring, candy-gradient vertical stat bars, thumbnail+play list cards, "Day/Rounds/Time/Intensity" card, raised-puck bottom nav. → our status-card rail + progress + bottom nav. |
| **LIGHT — Home Konnect** | Orange accent, pastel-tinted cards on light ground, bottom nav with ONE accent-coloured active item. |
| **LIGHT — Neumorphic Kit** | Control grammar: soft toggles (orange ON), sliders (orange fill + raised knob), segmented controls, raised icon pucks, diamond chips, gauge arcs. |
| **LIGHT — Music player** | Coloured gradient **waveform** → audio-stack visualisation. |
| **DARK — Design System (ref #2, PRIMARY)** | The structural backbone: Surfaces (Base/Raised/Inset/Pressed), **5-step elevation**, **border scale** (1/2/4/6/8px), **radius scale** (4/8/12/16/24/full), **spacing scale**, full Controls / Navigation (tabs, process, pagination) / Data-display (cards, list items, badges, avatars) / Feedback (modal, toast, alert, progress, skeleton). Orange accent = on-brand. **Bell provided at multiple sizes** → use the largest for the bottom bell. |
| **DARK — Deep Teal Silk** | Optional **alt accent / alt-dark palette** (`#0B3037` / `#134E5E`) — frosted silk pills. Offered as a teal variant. |
| **DARK — Neumorphic dashboard** | Depth/motion inspiration: frosted glass knob with rim-glow, equalizer waveform, soft charcoal elevation — informs the dark elevation feel + media visual. |
| **Fuselab trends** | Dark-mode palette depth, soft radii, micro-interactions, fluid expand/collapse + route transitions, **bottom navigation** (bell home), **exaggerated minimalism** (fixes /today crowding), Inter type scale, bento for the glance header. |

---

## 1. TOKEN ARCHITECTURE (the heart of dual-theme)

Two layers. **Primitive geometry** = theme-independent (same in light & dark). **Semantic tokens** = re-mapped per theme via a single `[data-theme]` attribute on `<html>`.

### 1.1 Shared geometry (NEVER changes between themes)
From the dark design system's scales — adopt as the universal grid:
```
/* Spacing (8pt-ish, per dark-system spacing strip) */
--sp-1:6px --sp-2:10px --sp-3:14px --sp-4:20px --sp-5:28px --sp-6:36px --sp-7:48px
/* Radius scale */
--r-4:4px --r-8:8px --r-12:12px --r-16:16px --r-24:24px --r-pill:999px
/* Border scale */
--bd-1:1px --bd-2:2px --bd-4:4px
/* Elevation = 5 steps (Elv0 none → Elv4 deep). Each theme supplies its OWN shadow values for these step names. */
--elv-0 --elv-1 --elv-2 --elv-3 --elv-4
/* Layout */
--page-max:480px --gutter:20px --rail-gap:12px
/* Type scale (Inter, tnum on numerics) — shared */
display 28/34 600 · h1 22/28 600 · h2 18/24 600 · body 15/22 400 · label 13/18 500 · micro 11/14 600 UPPERCASE+0.08em · num-lg 32/32 700 tnum
/* Motion durations */
--dur-fast:140ms --dur-mid:200ms --dur-slow:240ms
```

### 1.2 Semantic tokens — DARK theme (`[data-theme="dark"]`, default)
Base = dark slate + orange (ref #2). Cards are dark raised panels (NOT pastel-bright — pastels become dark-tinted accent edges/pills, since bright pastels don't sit in a dark UI).
```
--bg-base       #15171C   /* app base (behind faded art) */
--surface-raised #1E2128  /* default card */
--surface-active #262A33  /* active/expanded card */
--surface-inset  #121419  /* pressed/inset wells (sliders, fields) */
--hairline      rgba(255,255,255,0.07)
--top-highlight rgba(255,255,255,0.06)   /* 1px inner top edge = lit panel */
--ink-hi  #F1F3F8   --ink-mid #AEB6C4   --ink-low #6E7787
--accent       #E8772E   /* brand orange */
--accent-bright #F58B3C
--accent-soft  rgba(232,119,46,0.16)
--alt-teal     #2BB6C4   /* optional alt accent (deep-teal-silk family) */
/* status semantics */
--status-done #5FB87C  --status-now #F58B3C  --status-later #6E7787  --status-alert #E2685E
/* Elevation shadows (dark = deep drop + faint top light, orange-less) */
--elv-0: none;
--elv-1: 0 1px 0 var(--top-highlight) inset, 0 2px 6px -4px rgba(0,0,0,.6);
--elv-2: 0 1px 0 var(--top-highlight) inset, 0 8px 20px -12px rgba(0,0,0,.7);
--elv-3: 0 1px 0 var(--top-highlight) inset, 0 16px 32px -16px rgba(0,0,0,.75);
--elv-4: 0 1px 0 var(--top-highlight) inset, 0 28px 48px -20px rgba(0,0,0,.8);
```

### 1.3 Semantic tokens — LIGHT theme (`[data-theme="light"]`)
Neumorphic soft-UI: one off-white ground, cards extruded with a **dual shadow pair** (light top-left + dark bottom-right), near-zero borders, orange accent, candy gradients for data viz.
```
--bg-base       #E7ECF3   /* single neumorphic ground — cards share this fill */
--surface-raised #E7ECF3  /* SAME as bg; depth comes from shadow, not fill */
--surface-active #EDF1F7
--surface-inset  #E7ECF3  /* inset wells use inset shadow */
--hairline      rgba(15,30,60,0.05)
--top-highlight rgba(255,255,255,0.9)
--ink-hi  #2B3242   --ink-mid #5B6678   --ink-low #95A0B2
--accent       #F2792B   /* orange (matches light refs) */
--accent-bright #FF8C3E
--accent-soft  rgba(242,121,43,0.14)
--alt-teal     #1E9AA8
--status-done #57C08A  --status-now #F2792B  --status-later #95A0B2  --status-alert #E2685E
/* Elevation = neumorphic DUAL shadows (light hi-light + soft dark) */
--nm-light: rgba(255,255,255,0.9);
--nm-dark:  rgba(163,177,198,0.55);
--elv-0: none;
--elv-1: 3px 3px 6px var(--nm-dark), -3px -3px 6px var(--nm-light);
--elv-2: 6px 6px 12px var(--nm-dark), -6px -6px 12px var(--nm-light);
--elv-3: 9px 9px 18px var(--nm-dark), -9px -9px 18px var(--nm-light);
--elv-4: 12px 12px 24px var(--nm-dark), -12px -12px 24px var(--nm-light);
--elv-inset: inset 3px 3px 6px var(--nm-dark), inset -3px -3px 6px var(--nm-light);
```
**Rule:** components reference ONLY semantic tokens (`var(--surface-raised)`, `var(--elv-2)`, `var(--accent)`). Flipping `data-theme` swaps every value — light↔dark in one switch. Persist choice in localStorage `ppw.theme`; default to dark (brand-forward); honour `prefers-color-scheme` on first run.

### 1.4 Data-viz palette (both themes, candy gradients from the fitness + dashboard refs)
Progress ring + stat bars + waveform use gradients: `relax #4FB3F2→#7C5CF2`, `cardio #2BD4C4`, `strength #F5A623→#F2792B`, `stretch #F25C8A`. Cards on the rail get a subtle accent edge by **kind**, not a full pastel fill, so both themes stay legible.

---

## 2. Faded body-zone background (explicit change #4) — both themes
- **Asset:** `public/assets/backgrounds/fascia_web_field.png` (gold fascia web on black). Production-ready now.
- **Dark:** `opacity .10`, `blur(2px)`, `mix-blend screen`, top→bottom fade mask. Reads as faint gold fascia texture on slate.
- **Light:** same art, `opacity .06`, `mix-blend multiply`, even softer — a ghost of the fascia web on the off-white. (Light needs multiply so the art darkens rather than glows out.)
- Fixed, app-wide, `z-index:-1`, `pointer-events:none`. Token: `--bg-art-opacity` / `--bg-art-blend` per theme.
- **Flag (non-blocking):** Media image agent to deliver a purpose-made faded DNA-helix→fascia line motif (monochrome, transparent, pre-faded, ~1440×3120) for a cleaner result; mask-a-render is the interim.

---

## 3. Logo — single DNA-helix mark (explicit change #2)
- Remove the entire `PPW.` wordmark + "Peak Performance Wellness" label.
- ONE minimalist **inline SVG** helix: two sine strands + rungs, single stroke `var(--accent)`, ~28px header / 40px splash. Crisp at any size, theme-aware (stroke = accent token), zero deps.
- Existing PNGs (`dna-helix.webp`, `dna_helix_full.png`) = reference only (coloured renders). Flag Media agent for a clean SVG/transparent mark.
- Motion: stroke-draw on mount; slow rotate ONLY on splash. `prefers-reduced-motion` → static.

---

## 4. PER-SCREEN SYNTHESIS (balance / whitespace / grid noted each)

### 4.1 `/today` — Slot Calendar (primary)
**Balance: asymmetrical** (one promoted "Next up" hero carries weight; calm field below). **Whitespace** does the de-crowding. **Grid:** everything on §1.1 scales.
Top→bottom:
1. **Header (sticky):** left = DNA-helix SVG (28px, home). Right = **theme toggle** (sun/moon, neumorphic puck) + optional avatar. NO bell here, NO wordmark. Spare.
2. **Month + date line:** big `display` month (left) + small year; right = streak chip + completion ring (restyled to tokens). Only these two on the line → balanced.
3. **Day-pill strip:** horizontal snap scroll, −7…+30. Pill 48px, `--r-16`, `--elv-1`. weekday(`micro`,ink-low) / day(`h2`,ink-hi) / has-stacks dot. **Selected = accent fill** (orange) with `--elv-2`; **today (unselected) = accent ring**. Spring slide (`layoutId`). *(Active-highlight colour = orange per refs; teal alt available — see §8.)*
4. **"Next up" hero (oversized, asymmetric anchor):** full-width card, `--r-24`, `--elv-2`. Eyebrow `NEXT UP` (status-now), big time (`num-lg`, tnum), title (`h1`), **Open** pill (accent). Doubles as the fitness-ref "circular ring" home: a gradient **completion ring** (today's %) sits right of the text. All-done → calm end-state.
5. **Action row — REBALANCED (fixes #3):** bell GONE (→ bottom). Two equal oversized pills on one line: **`+ Stack`** (accent fill) · **`+ Protocol`** (secondary/outline), 2-col grid, `--sp-3` gap, 44px tall. Rare actions (Clear, Select) → a `⋮` overflow at row-right or a contextual second row only in select-mode. Nothing crowds at 360px.
6. **Selection bar (contextual):** slides in above bottom nav — Merge(n)/Duplicate(1)/Delete/count/clear. Symmetrical. All existing bulk logic intact.
7. **Status-card time-rail (core list):** thin left rail line + node dot per card (timeline read). Each card `--surface-raised` + `--elv-2`, `--r-24`, kind-accent left edge:
   - top-left **status pill** (`micro` chip): DONE/NOW/LATER/OVERDUE in status colours.
   - **time chip** (`--r-12`, tnum, tap-to-edit) · **◇ kind icon** in 28px rotated-square · **title** (`h2`, inline-rename) · **subtitle** (duration / "N parallel" / zone count).
   - right: **progress %** (tnum) + slim gradient track, OR done-check; **⋮ menu** → action sheet (Open, Duplicate, Add to calendar, Remove, Unstack). The current 4–6 inline icons collapse into `⋮` for a clean face (≤1 quick-action may stay inline if Vic wants).
   - long-press = drag (@dnd-kit + Motion `layout`); drop-to-merge gold (+) overlay retained; tap body = animated expand (auto-height) → media player + zones + Mark-done/Duplicate/Remove; merged cards keep tabs/parallel.
8. **Empty state:** centered, generous whitespace, faded helix, one primary CTA + quiet links.

### 4.2 Bottom navigation + enlarged bell (explicit change #1)
- **Persistent bottom bar**, app-shell, every main screen. 64px + safe-area. `--surface-raised` (dark) / neumorphic raised (light), `--elv-3`, hairline top.
- Slots: **Today · Protocols · (BELL) · Modules · Settings** — mirrors the drawer destinations.
- **Bell = center, enlarged 56px puck** raised ~12px above bar (notch). ON = accent ring + filled bell (dark-system bold bell glyph); OFF = neutral. Behaviour unchanged (permission → toggle → schedule gate). Tap = Motion spring + fill morph.
- Active slot = accent icon+label; inactive = ink-low. **Retire the hamburger drawer** (recommended — see §8).

### 4.3 Add-Stack / Add-Protocol / Clear-Calendar / ⋮ sheet / Notification overlay
**Balance: symmetrical** (calm/trustworthy). Bottom sheets, `--surface-active`, `--r-24` top, scrim + blur, AnimatePresence slide-up/down. Controls use the neumorphic-kit / dark-system grammar: orange toggles, orange-fill sliders (start/end/duration), segmented type-picker, focused field = accent border, error = alert. All fields/logic preserved.

### 4.4 Protocols list & Protocol detail
**Balance: symmetrical grid.** Cards → `--surface-raised` `--elv-2` `--r-16`; Activate = accent pill (filled when active). Detail: hero, stat cards (dark-system card w/ progress), supplement rows with iHerb/Amazon buttons (accent + secondary), nutrition eat/avoid as two balanced columns. Science imagery stays (content). Inter throughout; serif retired.

### 4.5 Audio & Modules
Audio tile = thumbnail + title + duration + **circular play puck** (fitness-ref). Active = accent ring. Expanded player uses the **gradient waveform** (music-ref) as the audio visualisation. `--elv-2` cards.

### 4.6 Settings
**Balance: symmetrical, calm.** Sectioned cards. Add a **Appearance** section: Theme = segmented **Light / Dark / System** (neumorphic segmented control). Notifications, IF window (orange slider + time fields), data-source toggle, clear-all. Reliable-reminders card retained.

### 4.7 Routine builder (welcome→lifestyle→level→BodyMap→tests→summary→session)
Restyle to tokens; BodyMap zone art (PNG/SVG) stays — it's content. Choice tiles = `--elv-2` cards; progress bar = accent. Splash = animated helix.

---

## 5. Framer Motion — animation list (one dep: `motion`, MIT, via `LazyMotion`+`m`, `useReducedMotion` guarded)
Day-pill select (shared-layout spring) · card mount (fade+rise, 30ms stagger) · card expand/collapse (`layout` auto-height) · remove/merge (AnimatePresence exit + sibling settle) · dnd drop (`layout`) · merge (+) overlay (fade+pulse) · progress % count-up + ring/bar fill · completion check draw + card settle · bell tap (spring + fill morph) · sheet/toast (slide-up/down + scrim) · route transitions (slide-fade 180ms) · day swipe (drag + rubber-band) · **theme toggle (cross-fade tokens ~200ms so the flip feels designed, not a flash)** · helix (SVG draw). Micro hover/press = pure CSS.

## 6. Build order
1. Token layers (geometry + dark + light) into `tailwind.config.js`/`index.css`; `data-theme` switch + persistence + faded bg per theme.
2. `motion` + `LazyMotion` + reduced-motion guard.
3. Header: drop wordmark, add SVG helix, add theme toggle.
4. Bottom nav + 56px bell; move bell logic out of `/today`; retire drawer.
5. `/today`: month header → day strip → next-up hero/ring → rebalanced actions → status-card rail.
6. Sheets/modals restyle + AnimatePresence.
7. Other routes → tokens; Settings → Appearance section.
8. QA each screen vs Balance/Whitespace/Grid + 4 changes; verify no overflow at 360px; verify both themes pass AA contrast.

## 7. Preserved behaviour (do NOT break)
Date-scoped state; stacks/merges/duplicates; drag-reorder + drop-to-merge; multi-select bulk ops; inline rename + time edit; add stack (6 types)/add protocol; clear day/range; notifications permission+scheduling+.ics+push; IF window; affiliate links; completion/streak. **Reskin + theming + motion layer — not a logic rewrite.**

## 8. Open questions for Vic (blocking-only)
1. **Active-highlight colour:** both ref sets lean **orange** (on-brand) — recommend **orange/gold** as the selected-day + active-nav + primary colour, with **teal (`#2BB6C4` / deep-teal-silk)** as an optional alt accent (could even be a 3rd theme later). Confirm orange as primary?
2. **Hamburger drawer:** recommend **retiring it** in favour of the bottom nav (dark + light refs both use bottom nav; two nav systems is redundant). Confirm drawer removal?
3. **Default theme:** propose **dark default** (brand-forward, matches the abandoned-cream pivot), with Light/Dark/System in Settings. Confirm default = dark?

Non-blocking: a cleaner faded-helix background asset + a final SVG helix logo will be generated by the Media image agent once palette is locked.
