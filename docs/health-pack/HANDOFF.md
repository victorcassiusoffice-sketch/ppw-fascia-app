# Health build — handoff

## STATUS

**Phase 1 (health engine + data) — complete and reviewed, on branch `feat/health-meters-2026-10`. Not merged, not deployed.**

| | |
|---|---|
| Branch | `feat/health-meters-2026-10` (off `origin/main` @ `19413ab`) |
| Commits | `42f416b` Phase 1 · `cce5c39` review fixes |
| Worktree | `C:\Users\Victor\Documents\PPW-Code\ppw-fascia-app-health` |
| Tests | **676 passing** (was 528 before this phase — 148 new) |
| Build | clean |
| Live | **nothing deployed.** `app.ppwellness.co` is untouched |

Next: Phase 2 — My supplements (cabinet) + supplement slots.

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
2. **Dark theme is not yet visually verified.** The shoot script sets `colorScheme`, but
   the app drives its own theme from the store, so both sets of frames are the light theme.
   Phase 2 will drive the real theme toggle.

---

## How to check it yourself

```
cd C:\Users\Victor\Documents\PPW-Code\ppw-fascia-app-health
npm run test                       # 637 passing
npm run build                      # clean
npx vite --port 5234 --strictPort  # then Settings -> Health
node tools/shoot-health-phase1.mjs # phone-width frames into .shots/
```

Screenshots: `.shots/health-phase1/`
