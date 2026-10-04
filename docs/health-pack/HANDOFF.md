# Health build — handoff

## STATUS

**Phases 1 and 2 complete, on branch `feat/health-meters-2026-10`. Not merged, not deployed.**

| | |
|---|---|
| Branch | `feat/health-meters-2026-10` (off `origin/main` @ `19413ab`) |
| Commits | `42f416b` Phase 1 · `cce5c39` review fixes · `e8f235b` Phase 1 status · _this_ Phase 2 |
| Worktree | `C:\Users\Victor\Documents\PPW-Code\ppw-fascia-app-health` |
| Tests | **716 passing** (676 after Phase 1 — 40 new) |
| Build | clean |
| Rendered | real Chromium at 390 px, **both themes**, 14 frames, zero console errors |
| Live | **nothing deployed.** `app.ppwellness.co` is untouched |

Next: Phase 3 — the dashboard (meters).

### The review, and why it mattered

The first cut passed 637 tests. An adversarial review that re-derived every
number from `data/` independently still found **five P0s and three material
P1s** — because the tests and the code came from the same hand and shared the
same blind spots. All eight are fixed in `cce5c39` and pinned by 39 new tests
written as *what a person experiences*, not as assertions about internals.

The sharpest one: `resolveForm` picked the longest matching synonym, so
`"Vitamin A (as retinyl palmitate and beta-carotene)"` — ordinary multivitamin
wording — resolved to beta-carotene, counted **zero** toward the preformed-
retinol limit, and showed a pregnant user nothing. A bare `"Vitamin A"`
correctly asked a question. **The engine got less safe the more honest the
label was.**

The most far-reaching: `store5.todayKey()` writes `2026-10-4`, and
`new Date("2026-10-4T00:00:00")` is an `Invalid Date`. Every test fed padded
dates, so every surgery window and lab-freshness check would have failed
silently the first time real app data reached it.

Full list in the `cce5c39` commit message.

---

## What Phase 2 built

**My supplements** — what a person actually takes, above the shop on Library → Supps.

| Module | Does |
|---|---|
| `cabinet.js` | Products into slots. Products sharing a time AND a repeat collapse into one card, because the Stack wants "Morning supplements · 3", not three rows — and one slot costs **one** stack against the free cap however many bottles are in it. Also ticking (whole slot or one product), `syncDeck` to keep the Stack in step, and `overMaxProducts`. |
| `parseSpec.js` | A shop listing's `brand_spec` into draft ingredient lines. Ranges resolve to the **high** end, everything is marked `needsCheck`, and an ingredient it cannot name is kept rather than dropped. |
| `useHealthData.js` | Loads the ~0.85 MB of data on the first health surface that needs it, and hands the index to the store. |

**Screens** — `SuppsCabinet.jsx` (slot cards, timing tips, the cap note, the `avoid` list) and `AddSupplementSheet.jsx` (add/edit, searchable ingredient picker, live conversion, the two questions below).

### Decisions taken in Phase 2

**Slots are derived, never stored.** The cabinet owns the schedule; `syncDeck` rebuilds the
Stack's supplement cards from it on every change. This is why the Stack card's edit button
opens the cabinet instead of the card — editing a derived card would be editing a shadow,
and the next sync would overwrite it. It is also why deleting a supplement genuinely stops
its reminder.

**An `avoid` product is kept, listed, and never scheduled.** It gets no slot, costs nothing
against the cap, and its reason is written to "Questions for my doctor". Someone who takes
it anyway can log it with "I still take this" — so the limits still see it, which is the
whole point: a product the app refuses to schedule is exactly the one it most needs to count.

**Slot titles carry no product names.** §5.9 — a deck item's title is what a notification
would use, so "Morning supplements" is the whole point. The shoot asserts that no product
name reaches the Stack card.

**Over a safe maximum is said in the cabinet, not only in the edit sheet.** Judged across
the planned day, so two ordinary bottles that are over the line together are both named —
a per-product check cannot see that case.

**The sheet warns before saving, against the real day.** `wouldExceed` runs against
everything else in the cabinet, so the warning reads "with everything else you take, this
comes to…", not "this product is large".

### The two questions the engine refuses to answer

Both exist because Phase 1's review made the engine stop guessing — and a refusal with no
question attached is just a silent failure.

1. **"Which does the label say?"** — only when knowing the form could *relax* the verdict
   (`formMatters`). The sheet offers one button per distinct form, labelled by the synonym a
   bottle is most likely to print, plus "Not sure". Offering raw synonyms instead would ask
   the same question three times for vitamin A, and could truncate away the only answer that
   helps.
2. **"Which one did your doctor prescribe?"** — when a product holds more than one nutrient
   with a limit. A doctor prescribing 65 mg of iron has not blessed the 50 mg of zinc in the
   same tablet; until the person says which, **nothing** in that product is treated as
   supervised.

### Found by looking at the rendered screen, not by a test

- **The sheet was see-through.** `--surface-strong` is a translucent gradient that is only
  legible over a blurred backdrop — every other sheet in this app pairs it with
  `--blur-heavy`. Without that pair the Library read straight through the form. 716 green
  tests had nothing to say about it.
- **Niacin 500 mg sat in the cabinet looking ordinary** at fifty times its 10 mg maximum,
  because the list showed condition and medicine flags but nothing about dose. That is now
  `overMaxProducts`, pinned by 6 tests.
- **The over-max detail line washed out** in accent-on-light-glass. The badge shouts; the
  line is the evidence and has to be readable, so it is `--ink`.

### A test that was lying

The shoot drove the app with `element.click()`, which never fires `pointerdown` — so hint
bubbles that a real tap dismisses stayed stranded on top of the sheet, and a "successful"
tap on an off-screen element left the next assertion looking at an unchanged page. It now
moves a real mouse, after scrolling the target into view, and asserts nothing is stranded.

---

## What Phase 1 built

### The engine — `src/app5/health5/`

Pure modules, no UI, no network. Every number comes from `docs/health-pack/data/`;
nothing is inferred from memory.

| Module | Does |
|---|---|
| `units.js` | A label amount into a `[meter, limit]` pair. The two differ constantly — 400 IU of synthetic vitamin E is 180 mg toward the target and 364 mg toward the limit; beta-carotene counts toward the vitamin A target and **zero** toward its limit. Unknown units and amounts are flagged, never dropped. |
| `targets.js` | The daily target for this person: sex, age bands, pregnancy/breastfeeding (never below the ordinary need), protein by body weight and training. Also `canShowLow` / `canSuggestSupplement`, which decide whether "low" is an honest thing to say. |
| `limits.js` | The safe maximum, after `byForm` and `byAge`, against the total that `appliesTo` names. Separates real breaches from softer warnings (`cautionAt`, `productCautionAt`, `infoAt`) so the app never cries wolf. |
| `totals.js` | A day's four running totals (meter, limit, supplements-only, food-only), today vs planned. Non-nutrient ingredients still feed meters — psyllium husk gives 0.8 g fibre per gram. |
| `flags.js` | Conditions and medicines into actions. Group matching, `when` evaluation (forms / aboveDaily / surgery window), strictest-wins, suppression, and the before-your-operation plan. |
| `labs.js` | `LAB_MAP`, freshness, and the iron gate. |
| `timing.js` | Same-slot clashes (iron + calcium) and "move by N hours". |
| `data.js` | Lazy loader, one shared in-flight fetch, synonym lookup. |
| `store.js` | The `ppw5.health` slice, the age gate, consents and doctor questions. |

### Also

- `tools/sync-health.mjs` — bakes `docs/health-pack/data/` into `public/health/` at
  prebuild, **excluding `research-raw/`**. Emits a `manifest.json` with a SHA-256 per
  file, which the service worker will key its cache on and which Phase 5 uses to mark
  the 9 standard protocols trusted.
- `weekdays` (Mon–Fri) repeat — `normRepeat`, `itemOnDate`, `recurrence.js`, `RepeatSheet`.
- Settings → **Health** card: age gate, Track protein & carbs, Questions for my doctor,
  My supplements, and **Delete my health data**.

---

## Decisions taken, and why

**The age gate asks rather than assumes.** Unknown age is neither "adult" nor "child" —
it is a question. Answered once, stored as `ageConfirmed`.

**`needsFormQuestion` only asks when the answer could RELAX the verdict.** The `unknown`
rows in the data are already the cautious ones, so a bare label is counted strictly. Asking
is worth someone's time when it could clear a warning ("is it niacinamide?" 10 → 35 mg),
never to make something stricter. This is why vitamin D never asks: unknown converts like
D3, which is what almost every bottle is.

**Delete is one key.** Everything health lives in `ppw5.health` and nothing else, so
deleting it cannot half-work. Voice-note file ids are returned to the caller for separate
IndexedDB removal rather than deleted behind the scenes.

**`rules.json` is the only source of flags.** The matching lists inside `nutrients.json`
are display copy and the engine never reads them — two sources would drift and one would
be wrong.

---

## Two bugs found and fixed during the build

**A timezone bug in surgery dates.** `toISOString()` converts local midnight to UTC, so
anywhere east of Greenwich — Mauritius included — every "pause from" date came out a day
early. Dates are now formatted from local parts.

**`Number(null)` is `0`, and `0` is finite.** The age gate read a person with no age
recorded as *age zero*, i.e. under 18, and silently switched health features off instead
of asking. The unit test passed because it used `{}` (`undefined` → `NaN`); the real
default from `emptyHealth()` is `age: null`. **Caught by looking at the rendered screen,
not by a test.** Both are now pinned by tests.

---

## Open questions for Vic

1. **Four shop products are over a safe maximum** (`review/CATALOG-REVIEW.md`). Per §7.5
   they stay `publishable: false` until swapped. No action needed in Phase 1 — flagging so
   it is not forgotten when the cabinet lands in Phase 2.
2. ~~**Dark theme is not yet visually verified.**~~ **Closed in Phase 2.** The cause was as
   suspected: the app paints from `themeVars(S)` and ignores the OS preference, so
   `colorScheme` did nothing. `tools/shoot-health-phase2.mjs` drives the store's own
   `ppw5.bg` key instead, and **asserts the two themes render a different `--ink`**, so the
   frames cannot quietly go back to being two light sets.
3. **"Morning supple…" truncates on the Stack card.** The row's generic width behaviour,
   which clips every long title equally — not a Phase 2 regression. The full title is kept
   because it is what a notification reads, and the card already shows the time beside it.

---

## How to check it yourself

```
cd C:\Users\Victor\Documents\PPW-Code\ppw-fascia-app-health
npm run test                       # 716 passing
npm run build                      # clean
npx vite --port 5235 --strictPort  # then Library -> Supps, and Settings -> Health
node tools/shoot-health-phase1.mjs # Settings -> Health frames
node tools/shoot-health-phase2.mjs # cabinet + add/edit sheet, both themes
```

Screenshots: `.shots/health-phase1/` and `.shots/health-phase2/`
