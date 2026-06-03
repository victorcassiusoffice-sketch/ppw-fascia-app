# PPW App — Mobile Design-Trends + Animation/Tooling Report (2025/2026)

_For: PPW App Design Agent · By: Design-Trends + Animation/Tooling Analyst · Date: 2026-06-03_
_Scope: PPW App only (Fascia / Slot-Calendar routine app). Not Room Designer, not Bonny, not Nook._
_Direction in force: modern **dark timeline-card** style — navy bg, month/date header, horizontal day-pill strip, large rounded status cards down a time-rail. Governed by `docs/DESIGN-PRINCIPLES.md`._

---

## 0. Source & method

Primary source read in full via fetch: **Fuselab Creative — "20 Mobile App Design Trends for 2026"** (`fuselabcreative.com/mobile-app-design-trends-for-2025`, published Mar 2025, updated Mar 2026). The page resolved cleanly — full body text extracted, no JS-shell fallback needed. The article splits its 20 trends into **Style** (visual) and **Accessibility** (functional). Every trend below is from that article; analysis and PPW application are mine.

Repo stack confirmed by reading `package.json`, `tailwind.config.js`, `src/index.css`, `src/useScrollFadeIn.js`, and `src/App.jsx` (see §3).

---

## 1. The 20 trends, extracted

**Style (visual):** Dark mode (+ auto/adaptive) · Soft rounded edges · Micro-interactions · Transparent overlays (blur/glass depth) · Neubrutalism · Bento grids (asymmetric) · Exaggerated minimalism · Motion graphics · Distinctive typography.

**Accessibility (functional):** No buttons / gesture controls · Multi-modal input (voice, eye-tracking) · Split screen · Passwordless + biometric auth · Predictable interfaces · Chatbots (AI) · Sustainable / digital-wellbeing design · Bottom navigation · Hyper-personalization (AI, real-time) · Augmented reality · Slides (swipe/scroll/carousel navigation).

---

## 2. Per-trend deep analysis → applied to PPW's dark timeline-card direction

Each trend is scored **High / Med / Low** for impact on _this_ app, and tied to Vic's standing lens — **Balance** (symmetrical vs asymmetrical), **Whitespace**, **Grid** — plus the three explicit asks (bell bottom+larger, single DNA-helix logo, fix `/today` symmetry).

### HIGH PRIORITY

**Dark mode (adaptive).** _What:_ dark is now the baseline, with auto light/dark switching and richer dark palettes. _Apply:_ we're already navy-dark by direction — so the win is **palette depth**, not the toggle. Build a proper dark elevation scale: base navy `#0a1628` → raised card → active card, separated by lightness + a 1px top inner-highlight (so cards read as lit panels, not flat fills). Status-pill colours (emerald/amber/coral already in tokens) must hit AA contrast on navy. _Lens:_ Grid — bake the elevation steps into the spacing/token scale. _Impact:_ **High.**

**Soft rounded edges.** _What:_ large corner radii everywhere — cards, pills, buttons — for an approachable feel matching phone hardware. _Apply:_ define a **radius scale** (pill = full; status card ≈ 20–24px; inner chips ≈ 12px; bottom bell container ≈ full). Reuse as tokens; never one-off radii. _Lens:_ Grid (radius scale is part of the grid contract). _Impact:_ **High** — cheap, on-brand, instantly modern.

**Micro-interactions.** _What:_ subtle feedback on every touch — the article's headline trend. _Apply (PPW-specific):_ status-pill tap → quick scale-down + colour deepen; progress % → count-up and ring/bar fill on appear; checkbox complete → check draws + card gives a soft satisfied "settle"; day-pill select → springy highlight slide; ⋮ menu → fade+rise. Keep them <200ms, never block the tap. _Lens:_ Whitespace — micro-motion lets you _remove_ explanatory chrome because the motion communicates state. _Impact:_ **High.**

**Motion graphics / fluid transitions.** _What:_ static screens feel dead; users expect dynamic transitions. _Apply:_ card **expand/collapse** (collapsed status card → expanded detail) as an animated height+content reveal; **route transitions** between Today / Calendar / Stacks (slide-fade); list reorder choreography when @dnd-kit drops a card. This is the category that exposes plain-CSS limits (see §4). _Lens:_ Balance — motion draws the eye to the asymmetric "next up" card. _Impact:_ **High.**

**Bottom navigation.** _What:_ thumb-reachable bottom bar is the ergonomic standard on tall phones. _Apply — and this directly serves Vic's bell ask:_ introduce a **bottom action zone** as the home for the **larger notification bell** (FAB-scale or a bottom-bar slot), moved off the top-right. Anchor primary nav + bell to the bottom on the same grid as the day pills. _Lens:_ Balance (symmetrical, stable bottom bar) + Grid (bell resolves to the shared spacing unit). _Impact:_ **High** — knocks out explicit ask #1.

**Exaggerated minimalism.** _What:_ minimalist base + a few oversized, confident elements (big type, oversized buttons, generous whitespace). _Apply — this is the fix for `/today` symmetry (ask #3):_ the crowded "couldn't fit on one line" control row is the _opposite_ of this trend. Solution: fewer elements per row, promote ONE element (the active/"next up" card or primary CTA) to oversized, let the rest breathe on a second row. Big clear date header; generous gutters. _Lens:_ Whitespace + Balance (deliberate asymmetry: one big hero element, calm supporting field). _Impact:_ **High** — knocks out explicit ask #3.

**Distinctive typography.** _What:_ type as brand voice, not just legibility. _Apply:_ we're on Inter app-wide (serif retired). Get personality from a **type scale + weight contrast**, not a novelty face: oversized semibold date/"next up", quiet uppercase micro-labels for status pills, tabular-nums for times/percentages so numbers don't jitter as they animate. _Lens:_ Grid (type scale is grid) + Whitespace. _Impact:_ **High** (free, big perceived-quality lift).

**Hyper-personalization.** _What:_ real-time, behaviour-driven adaptation. _Apply (light, on-device — fits Vic's sustainable/privacy lean):_ surface the **next-due stack** automatically at the top; reorder the day's rail by time-of-day; gentle "you usually do X now" nudge. No servers needed — derive from existing local state. _Lens:_ Balance (the surfaced item is the asymmetric hero). _Impact:_ **High** conceptually; **Med** build.

### MEDIUM PRIORITY

**Slides / swipe navigation.** _What:_ swipe between screens/days instead of menu hops. _Apply:_ **horizontal swipe to change the selected day** (syncs with the day-pill strip); swipe a status card for quick actions (complete / snooze / merge). Pairs with @dnd-kit gestures. _Lens:_ Grid (day pills + swipe map to the same date model). _Impact:_ **Med–High.**

**Transparent overlays / depth.** _What:_ blurred translucent layers for hierarchy. _Apply — but cautious:_ the cream "Vision-Pro frosted-glass" look was abandoned as a flop, so **use glass sparingly** — only for transient layers that sit _above_ content (the ⋮ action sheet, Add-Stack bottom sheet, toast) with a dark blur, never as the base card surface. _Lens:_ Balance (overlay is modal/symmetrical). _Impact:_ **Med.**

**Bento grids (asymmetric).** _What:_ asymmetric grouped tiles, scannable. _Apply:_ not for the main time-rail (that's a vertical list), but ideal for a **summary / "today at a glance" header** or a stats/streak zone — a few differently-weighted tiles (next stack large, streak + count small). _Lens:_ Balance (asymmetry by design) + Grid (bento _is_ a grid discipline). _Impact:_ **Med.**

**No buttons / gesture controls.** _What:_ rely on swipe/tap/long-press over explicit buttons. _Apply:_ long-press a card → multi-select/merge; pull-to-refresh the day; swipe actions (above). Keep a visible affordance for discoverability (don't go fully invisible). _Lens:_ Whitespace (fewer buttons = calmer). _Impact:_ **Med.**

**Sustainable / digital-wellbeing.** _What:_ efficient, non-addictive, low-energy design. _Apply — strongly on-brand for a wellness app:_ no infinite scroll, no dark patterns, fast task completion, a clean "done for today" end-state that lets the user _leave_. Dark palette + minimal motion also saves battery on OLED. _Lens:_ Whitespace as wellbeing. _Impact:_ **Med** (brand-aligned differentiator).

**Predictable interfaces.** _What:_ familiar patterns, low cognitive load. _Apply:_ keep standard bottom nav, recognizable icons, conventional gestures — _adapt_ trends, don't reinvent. Guardrail against over-animating. _Impact:_ **Med** (governance, not a feature).

### LOW PRIORITY (note, mostly defer)

**Passwordless / biometric auth** — app is local-first; revisit only if accounts/sync ship. **Low.**
**Multi-modal input (voice/eye-tracking)** — accessibility win long-term; ensure semantic markup + large hit targets now so it's possible later. **Low.**
**Split screen** — foldable/tablet concern; ensure layout is responsive, don't build for it yet. **Low.**
**Chatbots / AI assistant** — out of scope for the routine surface today. **Low.**
**Augmented reality** — not relevant to a slot-calendar. **Low** (AR belongs to the fascia/anatomy education content, not this app).

---

## 3. Current stack (read from repo)

```
React 18.3 · Vite 5.4 · react-router-dom 6.26
Tailwind CSS 3.4 (+ postcss, autoprefixer)   ← styling is Tailwind, not plain CSS
@dnd-kit (core/sortable/modifiers/utilities)  ← drag-drop already in place
vitest + @testing-library                     ← tests exist
NO animation library installed.
```

**What the app already does for motion (good foundation):**
- CSS `transition`s on cards/buttons/icons (`src/index.css`).
- `@keyframes` already present: `pulse-selected`, `fadeIn`, `pulse-iherb-all`.
- `useScrollFadeIn.js` — an IntersectionObserver fade-in hook that **already respects `prefers-reduced-motion`** and degrades gracefully. This is the pattern to extend.
- A DNA-helix asset is already referenced (`images/science/dna-helix.webp`) — useful for the logo work.
- Bell is `IconBell` (currently top-right, ~36px toggle) — to be moved bottom + enlarged.
- Wordmark is literal `PPW.` text — to be removed in favour of the single helix mark.

**Implication:** ~75–80% of the trend work above (radii, palette depth, type scale, hover/tap micro-states, pulse, fade-in, simple slides) is **pure Tailwind + CSS** on top of what exists. The gaps are structural.

---

## 4. Animation / micro-interaction feature list + what each needs

| Feature | Achievable with what we HAVE (Tailwind/CSS + hook)? | Needs a lib? |
|---|---|---|
| Hover/tap/press states (pill, button, ⋮) | ✅ CSS transition | — |
| Day-pill selected highlight + pulse | ✅ `pulse-selected` keyframe already exists | — |
| Scroll/enter fade-in (cards appearing) | ✅ `useScrollFadeIn` | — |
| Progress % count-up + ring/bar fill | ✅ CSS transition on width/stroke-dashoffset; JS count-up | — |
| Completion "settle" / check draw | ✅ CSS keyframe + SVG stroke-dashoffset | — |
| Simple route slide-fade | ⚠️ doable but fiddly (no exit phase in plain CSS) | nicer with lib |
| **Card expand/collapse to auto height** | ❌ painful in CSS (auto-height not animatable cleanly) | **yes** |
| **Enter/exit on mount/unmount** (sheets, toasts, removed cards) | ❌ React unmounts before CSS can animate out | **yes** |
| **List reorder choreography** (dnd drop, merge/stack) | ❌ items teleport without shared-layout animation | **yes** |
| **Swipe-card gestures w/ spring physics** | ⚠️ @dnd-kit handles drag; spring feel is manual | nicer with lib |
| **Animated DNA-helix logo** | ✅ SVG + CSS/SMIL for a clean loop | Lottie/Rive only if richer |

The four ❌/⚠️ rows are recurring in _this_ app (status cards expand, Add-Stack sheet, toasts, dnd reorder, merged cards) — they're not edge cases. That's the case for one small library.

---

## 5. Tooling verdict (free-only, minimal set)

**Verdict: keep CSS/Tailwind for the micro-interaction layer, and add ONE free library — Framer Motion (`motion`, MIT) — for the structural layer (expand/collapse, enter/exit, reorder, gesture springs, page transitions).**

Why Framer Motion and not the others:
- **Solves exactly the gaps** — `layout` prop (auto-height + shared-layout reorder), `AnimatePresence` (exit animations React can't do alone), `drag`/spring (swipe cards), page transitions. These are the four hard rows above, in one tool.
- **React-idiomatic & declarative** — fits an 18.x function-component codebase; far less churn than GSAP's imperative timelines.
- **Plays with @dnd-kit** — keep @dnd-kit for the drag mechanics; use Motion for the visual settle/reorder. No conflict.
- **Reduced-motion built in** (`useReducedMotion`) — matches the accessibility discipline already in `useScrollFadeIn`.
- **Bundle is controllable** — full import ~30–50kb gzip, but with `LazyMotion` + the `m` component you ship only used features (~6–18kb gzip). Acceptable for the value.

**Free-only options considered (no paid software, ever):**
- **Framer Motion / `motion`** — MIT, free. ✅ **Recommended pick.**
- **@formkit/auto-animate** — MIT, ~3kb. Lightest possible; one hook auto-animates add/remove/reorder. ✅ **Fallback** if we want to avoid Motion's footprint — but it can't do gestures, exit choreography for sheets, or fine control. Good _only_ for the card list + day strip.
- **GSAP** — now fully free incl. former paid plugins. Powerful but imperative/overkill here; reach for it only if a future hero animation outgrows Motion.
- **react-spring** — MIT, capable, but more boilerplate than Motion for layout/exit; no clear win.
- **Lottie (`lottie-react`)** — free; ~60kb runtime + JSON. **Optional, logo/success only** — use if Vic wants After-Effects-grade helix or a celebratory "all done" burst. Not part of the minimal set.
- **Rive (free tier)** — tiny runtime, great interactive logo, but adds a `.riv` authoring dependency. Optional, not minimal.

**For the DNA-helix logo specifically:** do it first as an **animated SVG (CSS/SMIL)** — gentle rotate/draw loop, zero new deps, matches "single minimalist mark, no wordmark." Reserve Lottie/Rive only if a richer render is wanted later.

**One-line recommendation to the design agent:**
> Build the redesign on Tailwind + CSS for everything micro; add **Framer Motion (free/MIT), imported via `LazyMotion`+`m`** for card expand/collapse, sheet/toast enter-exit, dnd reorder settle, swipe gestures, and route transitions; animate the helix logo as an SVG. No paid tools. Net new dependency: **one.**

---

## 6. How this maps back to the three explicit asks

1. **Bell → bottom + larger** → delivered by the **Bottom navigation** trend (§2): a bottom action zone hosts a FAB/bar-scale bell; Framer Motion gives it a tap-spring + on/off morph. Keep all current permission/scheduling behaviour.
2. **Single DNA-helix logo, no wordmark** → remove the `PPW.` text; use the existing `dna-helix.webp` (or a new SVG mark) as a lone, centered mark; animate via SVG/CSS. Ties to **Distinctive typography / exaggerated minimalism** (confidence through restraint).
3. **Fix `/today` symmetry** → delivered by **Exaggerated minimalism + Whitespace + Grid** (§2): fewer controls per row, one promoted oversized element, second row to breathe, everything resolved to one spacing/radius grid so nothing overflows at mobile width.
```
