# Claude Design Import — Spec (from `PPW Fascia App.dc.html`)

Source: `PPW app- The one- rebuild-handoff.zip` (Vic, 2026-07-06), extracted to
scratchpad (session-temporary — see `CLAUDE-DESIGN-TRANSFER-HANDOFF.md` for path).
Primary file: `project/PPW Fascia App.dc.html` (3488 lines). `v1`/`v2` siblings in the
same folder are earlier iterations — ignored per the bundle's own README.

**Note on how this was built:** three background research-agent attempts to digest the
whole file in one pass each failed silently (2 tool calls, ~120k tokens, no output —
the file is too large for a single-shot read/write). Abandoned that approach. This spec
was built via direct targeted `Grep`/`Read` instead — cheaper and it worked. Per-screen
pixel detail below is filled in as each screen is actually implemented (JIT), not
upfront, to control token spend on a large file.

## ⚠️ CRITICAL ARCHITECTURE FINDING (2026-07-06) — the design is a COMPLETE APP, not UI-with-mock-data

The brief assumed the Claude Design export was "UI-only with mock data." **It is not.** Reality:
- `support.js` = the generic Claude Design **DSL runtime** (`dc-runtime`) — parses `<x-dc>`
  templates, `{{ }}` bindings, `sc-if`/`sc-for`, renders via `window.React`. NOT app logic. Ignore for logic.
- `PPW Fascia App.dc.html` = **template** (`<x-dc>`, ~lines 9-1611) **+ a full working app**
  in a `<script type="text/x-dc" data-dc-script>` block (~lines 1613-3488): `class Component extends
  DCLogic` with a complete state model, its OWN localStorage persistence under the **`ppw5.` prefix**
  (different namespace from the current app's `ppw.` keys → NO data collision), premium gating,
  a curated YouTube library, an AI stack builder, IndexedDB media handling, onboarding, fasting,
  a11y, an elaborate multi-skin theme engine.

**Theme engine** (the `{{ vars }}` value) is computed in the script at **lines ~2257-2505**:
`GROUNDS` (2337), `SOFT` colourways (2257), `GLASS` scenes (2273) lookup tables → a big `vars`
CSS-custom-property string. Three registers: **glass** · **soft-neumorphism** (DEFAULT is
`skin:'soft', bg:'grey', soft:'graphite'` → light soft-neumorphism) · **gel-glass-over-scene**.
All plain JS string-generation — portable near-verbatim. The `var(--x, fallback)` fallbacks in
the template are the light-glass values; the real per-skin values come from this engine.

**Consequence for the port (given Vic's "New Design overrules every time"):** the New Design's
own data model + `ppw5.` persistence is the reference. Port it as THE app; re-wire only the
genuinely-external integrations a static prototype can't self-implement (real lock-screen `.ics`
reminders via existing `src/lib/ics.js`, Web Push, protocol fetch, Assistant sync). Because
`ppw5.` ≠ `ppw.`, the new app starts clean and the old app's data is untouched (reversible).

**Scope reality:** this is a ~1900-line app-logic + ~1590-line template → React port. Large,
multi-session. Build as a parallel `src/app5/` tree (theme engine + store + screens), swap routes
per completed+verified screen, keep the app building at every commit. Never leave a broken checkpoint.

## Screen inventory (confirmed via `data-screen-label` attributes)

| Screen | ~Line | Notes |
|---|---|---|
| PPW Lifestyle App | 38 | Root shell / device frame |
| Stack | 55 | **This is the daily/"Today" view** in the new naming — hero "Next up" card + today's item deck. Naming shift: old app's "Today" ≈ new "Stack". |
| Library | 221 | **This is the old app's "Stack" (routines/audio/protocols library)** — tabbed (Routines/Media/Protocols). Naming swapped vs current app — confirm with Vic before implementing to avoid mixing up the two. |
| Calendar | 422 | Month grid |
| Settings | 470 | Includes the Membership/Premium card (line ~605) |
| Easy set up | 827 | Accessibility helper (elder/easy-read mode) |
| **Upgrade** | 852 | **Paywall modal** — see Premium section below |
| Terms | 874 | Terms & health disclaimer, full legal text present in file |
| Add sheet | 949 | 2×2 add-content sheet |
| Fasting info | 1064 | Info modal |
| Slot reminder | 1077 | Reminder modal |
| Stack assistant | 1099 | Assistant orb chat panel (premium-gated) |
| Repeat options | 1174 | Recurrence picker |
| Completed | 1204 | Completed-today list |
| Media viewer | 1239 | In-app media viewer |
| Note popup | 1308 | Affirmation/note popup |
| Onboarding | 1321 | Wizard |

## Premium / paywall mechanics — FULL DETAIL (highest priority — this is what Vic asked about)

**The mechanism is already fully designed and documented by its own author.** One boolean
drives everything: `this.state.premium` (in `support.js`, the prototype's mock runtime).

### The flag
- Read: `if (g('premium') === '1') def.premium = true;` — i.e. persisted as string `'1'`/absent.
- Write: `this.save('premium', nv ? '1' : '0')` then `setState({ premium: nv })`.
- Every gated feature keys off `isPremium` (= `S.premium`) — single source of truth, no
  per-feature flags to hunt down.

### Author's own comment (support.js ~line 3189, verbatim)
> "PREMIUM is a local tickbox for the prototype. To ship real payments, replace
> `togglePremium` / `enablePremium` with your checkout flow and set `this.state.premium`
> from the verified entitlement (Stripe, RevenueCat…). Every gated feature keys off
> `isPremium` (`this.state.premium`), so no [other code changes needed]."

This is exactly Vic's ask, just naming Stripe/RevenueCat instead of Gumroad — same shape.

### Settings UI (the switch Vic referenced) — `.dc.html` ~line 604-621
"Membership" section, one card:
- Icon (compass/diamond glyph) + `"Premium {{ premStatusLabel }}"` (label is `"· active"`
  when on, empty when off) + subtitle `"{{ premPrice }}/mo · Routines, unlimited stacks,
  always-on Assistant"`.
- A toggle switch (glass pill track + sliding knob — same visual pattern as the existing
  app's theme toggle) bound to `togglePremium`.
- Caption directly under it (**keep this copy or something close — it's exactly the
  right framing for Vic's dev/test use case**): *"Prototype toggle — flip on to preview
  Premium. In code this is one `premium` flag, ready to wire to your payment gateway
  without touching anything else."*
- Card recolors when active: `premCardBg`/`premCardRim`/`premCardInk`/`premCardDim` all
  switch to the accent-glass treatment when `S.premium` is true, back to plain glass
  when false.

### Upsell/paywall modal — `.dc.html` ~line 852-869, screen label "Upgrade"
Triggered by `openUpsell(reason)` / closed by `closeUpsell()`. Full-screen scrim + centered
glass sheet:
- Icon, title "Premium feature", dynamic body text `{{ upsellReason }}` (varies per trigger
  — see below).
- Static 3-bullet feature list: "Routines — chain many items into one stack" /
  "Unlimited stacks (free is capped at 10)" / "Always-on Assistant in the corner".
- Price line `{{ premPrice }} / month`.
- Primary button "Enable Premium (prototype)" → `enablePremium` (same flag flip as the
  Settings toggle — **this is the button that becomes the real Gumroad checkout CTA**).
- Secondary "Not now" → `closeUpsell`.

### Gated features (what trips the paywall) — confirmed via grep of `support.js`
1. **Stack item limit**: `overLimit() { return !this.state.premium && this.state.deckItems.length >= 10; }`
   — free tier caps today's stack at 10 items. Triggers on add-attempt with reason
   *"You have reached the free limit of 10 stacks. Go Premium for unlimited stacks."*
   (checked in at least 3 places: add-item, drop-item, and one more add path).
2. **Assistant orb** (`openAssistantOrb`): if `!S.premium`, opens the upsell with reason
   *"The Assistant is part of Premium — it plans, researches and rebuilds your day, right
   from this corner."* — matches the CURRENT app's separate paid "Wellness Assistant"
   concept (`FEATURE_ASSISTANT_LAUNCH` / `isProMember()` in `src/lib/entitlement.js`) —
   **these two concepts should probably reconcile into one gate**, flag for Vic.
3. **Routines feature** (`upsellRoutines`): reason *"Routines let you chain many videos,
   audios and affirmations into one named stack that plays in order — with your own cover
   image, combining unlimited stacks into one."*

### Mapping to the current app's existing entitlement code
`src/lib/entitlement.js` already has the identical shape: `isProMember()` reads
`localStorage['ppw.entitlement'] === 'pro'`, fail-closed default. The prototype uses a
different key/encoding (`premium` / `'1'`/`'0'`) but the **concept is identical** — one
boolean, localStorage-backed, gates features. Plan: keep `ppw.entitlement`/`isProMember()`
as the real source of truth (already wired to `FEATURE_ASSISTANT_LAUNCH`), add the Settings
toggle + upsell modal from this design on top of it, add the 10-item stack cap +
Routines/Assistant gates, and make Gumroad verification the thing that can *also* set
`ppw.entitlement = 'pro'` — Vic's manual toggle and a real Gumroad unlock both just flip
the same flag, exactly per the author's own comment.

## Design tokens (partial — collected from the sections read so far; more added as each screen is implemented)

CSS custom properties, always used as `var(--name, fallback)`:
- `--accent` `#F2792B` (light) — matches current app's accent (already `#E8772E`/`#F2792B`
  per PPW brand rules, consistent).
- `--ink` `#23262C`, `--dim` `rgba(35,38,44,.58)` — text colors.
- `--ground` `radial-gradient(130% 100% at 30% 12%, #FDFDFE 0%, #E9EDF3 50%, #C6CFDB 100%)` — default background.
- `--surface` `linear-gradient(133deg, rgba(255,255,255,.6), rgba(255,255,255,.2))`, `--surface-strong` (more opaque variant for modals).
- `--blur` `blur(20px) saturate(170%)`, `--blur-heavy` `blur(28px) saturate(170%)` (modals).
- `--rim` `rgba(255,255,255,.9)` (card border), `--hairline` `rgba(70,80,100,.14)` (dividers).
- `--elev` `0 14px 36px -14px rgba(70,80,100,.38)`, `--elev-hi` `0 22px 50px -14px rgba(70,80,100,.48)` (modals).
- `--acc-surf` `linear-gradient(133deg, rgba(242,121,43,.9), rgba(242,121,43,.66))`, `--acc-rim`, `--acc-ink` `#FFFFFF`, `--acc-glow` — accent-filled buttons/cards.
- `--disc` `radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,.85), rgba(255,255,255,.4))` — circular icon button fill.
- `--gloss` (top gloss overlay via `style-before`), `--emboss` (text-shadow for legibility on glass), `--inset` (toggle track inset shadow).
- Font: `'Nunito'` (this design) — **differs from current app's Geist/EB Garamond/Inter set** per the vault design-system docs — flag for Vic: intentional change or carry over old type system?
- Radii: 28px (hero cards), 24-26px (cards/rows), 999px (pills/discs), 14-18px (icon tiles/buttons).
- Keyframes: `ppwScreenIn`, `ppwRise`, `ppwLogoIn`, `ppwLogoFloat`, `ppwSheetIn`, `ppwFade`, `ppwTrace` (border-trace on hero), `ppwNoteFlash`/`ppwNotePulse`/`ppwNoteMarquee`. All collapse under `prefers-reduced-motion`.

## Open questions for Vic

1. **Naming swap**: new design's "Stack" = old app's "Today"; new design's "Library" = old
   app's "Stack" (routines/audio/protocols tabs). Confirm before implementing so nothing
   gets cross-wired.
2. **Assistant gate reconciliation**: the design gates the in-app "Assistant orb" behind
   the same `premium` flag that also gates stack-limit/Routines. The current app treats
   the Wellness Assistant as a wholly separate paid *external* service. Merge into one
   gate, or keep the orb as a separate concept?
3. **Font**: this design uses Nunito everywhere; the current app + vault design-system
   docs specify Geist/EB Garamond/Inter. Which wins?
4. **Scope/sequencing** (raised in chat): given the size (17 screens/modals) vs. the small,
   well-understood, independently-testable premium/Gumroad gate — recommend wiring premium
   first on the current app, then doing the visual transfer screen-by-screen. Awaiting Vic's
   confirmation.
