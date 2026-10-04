# Build brief — Supplements, nutrient meters and protocols

**For:** the builder working in `victorcassiusoffice-sketch/ppw-fascia-app` (the PPWellness Lifestyle App, live at app.ppwellness.co).
**From:** Vic. Research and data prepared 2026-10-04, then independently reviewed (all 15 spot-checked safety limits matched NIH and EFSA).
**Read this whole file first, then work phase by phase.**

---

## 0. What we're building, in one breath

People (individuals and company staff) tell their own AI about their life and health. The AI hands the app a structured plan. The app turns it into a daily routine — supplements at the right times, movement, meals, notes, voice notes — and shows a **health dashboard**: a meter per vitamin, mineral and trace mineral that fills as they tick off supplements, protein/carb/fibre bars, and gut inputs. Low meters can be tapped to see what's missing and how to fix it with food first. Safe maximums, medicine interactions and conditions (diabetes, varicose veins, surgery, pregnancy…) are checked by the app itself, from vetted data. Nine standard, trial-based protocols can be started in one tap, and people can import their own protocol as a `.md` file.

**Safety beats ambition.** The app organises and informs. It never diagnoses, never prescribes, never pushes anyone above a safe maximum, and sends condition-specific doses through "ask your doctor first".

---

## 1. Ground rules

1. Work on a new branch: `feat/health-meters-2026-10`. Commit after every small working step and push each commit. Keep a STATUS section at the top of `docs/health-pack/HANDOFF.md` updated in the same commit.
2. **Never merge to `main` or deploy without Vic's explicit "yes".** Pushing to `main` deploys to app.ppwellness.co.
3. Existing tests must stay green (`npm run test`) and `npm run build` must pass at every commit. Add the tests in §9.
4. Don't break existing data. All new state is additive. Existing `ppw5.*` keys keep their format.
5. **No invented health numbers.** Every dose, target, limit and interaction comes from `docs/health-pack/data/`. If something you need is missing, stop and list it for Vic — don't fill it from memory.
6. **Health features are for adults (18+).** All limits in the data are adult values.
7. App copy: plain English, short sentences, calm tone (Vic and many users have dyslexia). No "treats", "cures", "detox", "boost immunity". Say "may help", "studies found", "ask your doctor".
8. Mobile first (≥ 360 px), both themes, Easy-read mode and text-size zoom must work on every new screen. Tap targets ≥ 44 px. Follow the existing New Design patterns (`src/app5/`, theme vars, sheets, `ppwRise`/`ppwSheetIn`, sounds).
9. No new backend, no new third-party APIs, no analytics on health data. **Health data never leaves the device** unless the person copies it into their own AI themselves.

---

## 2. Where things are today (read these first)

| Area | Files | Notes |
|---|---|---|
| App shell, nav, Stack screen | `src/app5/App5.jsx` | Nav: Stack · Library · ＋ · Calendar · Settings. `FREE_STACK_CAP = 10` in store5. |
| State + persistence | `src/app5/store5.js` | `ppw5.` keys; `deckItems`, `doneByDate`, `markDone`, `normRepeat`, `parsePlanDoc` (whitelist), `addItemsToPlan`, `applyPlanRebuild`, `parseRoutineMd`, `routineToMd`, slot engine `startSlotEngine`. |
| AI planner | `src/app5/assistant/aiPrompt.js`, `parsePlan.js`, `AiBridgeSheet.jsx`, `verifyVideo.js` | Prompt v5 → `ppw-routine` v2 block. Extraction is tolerant; `parsePlanDoc` whitelists keys (only `kind:'note'` survives today). |
| Supplements (shop) | `src/app5/screens/SuppsSection.jsx`, `src/lib/suppsAffiliates.js`, `src/config/supps-affiliates.json` | Library → Supps tab. iHerb shop list. 10 products, all `needs_evidence_review`. |
| Protocols | `src/app5/protocols5.js`, `LibraryScreen.jsx` (Protocols tab), `public/protocols/app-manifest.json` | Today: PDF protocols only. |
| Files / media | `src/app5/files5.js` (IndexedDB docs), `src/lib/mediaStore.js`, `src/app5/screens/MediaViewer.jsx` | MediaViewer has no audio playback yet. |
| Repeats | `normRepeat()` in store5, `src/recurrence.js` | daily, weekly, once, every N (2–14). **No "weekdays" yet.** |
| Passcode | `src/app5/passcode.js` | Encrypts the session token only, not app data. |

---

## 3. The data pack and how the numbers work

Copy `docs/health-pack/data/` (except `research-raw/`) into the app as `public/health/` at build time (a small prebuild script, like `tools/sync-protocols.mjs`). Load it lazily (when the Health sheet, Supps cabinet or AI import first needs it). Cache it in the service worker keyed by each file's `_version` + `generatedAt`, so a data update replaces the cache.

| File | What it is |
|---|---|
| `nutrients.json` | 37 nutrients: units, `unitRules`, `synonymForms`, RDA by sex/age, `meter`, `limit`, studied ranges + key studies, timing (with `separateFrom[].ids`), food sources, low/high text, sources. Its `conditionFlags`/`interactions` are **display text only**. |
| `ingredients.json` | 46 non-meter ingredients (herbs, venoactive products, psyllium, cod liver oil…) with synonyms, `contributes` (psyllium → fibre ×0.8) and rule `groups` (`any_supplement`, `herbal`, `venoactive`, `beta_carotene`…). |
| `rules.json` | **The engine's only source of flags.** 37 conditions (flags with resolved `target`, optional `when`), 21 medicine groups (interactions with `badge`, `impliesConditions`), 23 "pause before surgery" items. |
| `protocols/*.md` + `index.json` | The 9 standard protocols: readable Markdown + a `ppw-protocol` JSON block (the same format users import). |
| `research-raw/` | The original research files, for audit. Don't ship. |

`docs/health-pack/reference/parseProtocolMd.mjs` is a working reference parser; `node docs/health-pack/reference/check-protocols.mjs` parses all 9 and checks worst-case daily sums against the limits. Port it into `src/app5/`.

### Units (engine uses `unitRules` only)
- Normalise units with `UNIT_ALIASES` (in `build` notes below): mcg, μg (Greek mu), ug → µg; "billion CFU" → billion_cfu; IU; "µg DFE". **An unknown unit keeps the line and shows "Check this amount" — never drop it.**
- `unitRules.mass` converts g/mg/µg to the base unit. `iu` and `forms` give `[meter, limit]` multipliers by form; `formByUnit` and `dfeUnit` cover the special cases (beta-carotene given in mg; folate given as µg DFE). Unknown form uses the `unknown` row (the cautious one).
- Forms come from the line's `form`, else from the label's "(as …)" part, else from `synonymForms` ("beta-carotene" → vitamin A beta_carotene, "niacinamide" → B3 nicotinamide, "folic acid", "methylfolate", "d-alpha"/"dl-alpha" tocopherol, silica vs orthosilicic acid…). Plain "niacin" is ambiguous (US labels write "Niacin (as niacinamide)"). **If the form is unknown and the verdict depends on it, ask one question** ("Does the label say niacinamide?", "Does it say retinol or beta-carotene?") instead of showing red.
- Products with `requiresLines` (cod liver oil) can't be saved until those lines (vitamin A as retinol, vitamin D, omega-3) have amounts.
- The free-text `conversions` are for people and for a "I only know the compound weight" helper in the add sheet (e.g. 500 mg magnesium oxide → 300 mg magnesium). Labels normally give the elemental amount — use that.

### Targets and meter modes
- **Target** (`meter.target`) by sex; apply `meter.ageRules`; pregnant/breastfeeding → `max(target, pregnancyTarget|lactationTarget)`. Unknown sex → the higher target, except iron (male value). Protein uses `meter.rules` (g/kg × weight; 1.2 g/kg if training/athlete; 1.0 from 65; no target with kidney disease; fallback grams without weight).
- **Modes**:
  - `target` — fills to the target (most vitamins, zinc, copper, selenium, iodine, omega-3).
  - `food_first` — magnesium, calcium, choline, vitamin B3, fibre, protein. Most should come from food. With food data **for that nutrient** (a logged food amount or an AI estimate for it): normal states. **Without it: no low/partial state** — show the supplement amount against the supplement maximum, with "Most of this comes from food".
  - `labs_led` — iron. Shows amounts and limits; "low" only from a ferritin result (see LAB_MAP).
  - `food_only` — potassium, chromium, molybdenum, manganese. Show amounts and limits; never "low"; never suggest pills.
  - `user_set` — carbs: no target unless the person sets one (130 g shown as information).
  - `track` — collagen, probiotics, creatine, CoQ10, ashwagandha, NMN, boron, silicon: amount vs studied range and limits; no "low".
- **Today's total** = supplements ticked done today + food (meal items ticked + quick-adds) + the AI food estimate if the person accepted it. Show supplements and food as two segments and label which is which.

### Safe maximums (`limit`)
- `value` in the nutrient's unit. **`warn` decides whether near/over-max states show** (`kind` only labels the source in the detail screen).
- `appliesTo`: `total` (food + supplements), `supplements_only`, `preformed_retinol` (vitamin A as retinol only), `folic_acid` (folic acid + methylfolate in µg, not DFE).
- `byForm` (vitamin B3, silicon) and `byAge` (calcium) override `value`; unknown form → the `unknown` key.
- `cautionAt` + `cautionText` (omega-3 > 1 g; manganese > 4 mg from supplements, `cautionByAge` 0.5 mg from 65) = amber note, not over-max.
- `productCautionAt` (iodine > 500 µg in a single product) = amber note on that product.
- `infoAt` + `infoText` (biotin, creatine, CoQ10, NMN, collagen) = info line.
- **Doctor-prescribed doses**: the "My doctor prescribed this dose" switch works for any nutrient with a limit (e.g. a prescribed weekly vitamin D, or B6 for pregnancy sickness). That supplement's amount shows as "Doctor-supervised" and doesn't trigger over-max (the number and the max are still shown). `supervisedException` on iron only means bundled protocols may carry a supervised iron dose.
- **States** (`nutrients.json → thresholds`): `low` < 50% of target · `partial` 50–99% · `covered` ≥ 100% · `near_max` ≥ 80% of the limit · `over_max` > 100% · `supervised`.
- Also compute **planned** totals ("if you take everything planned today") and check limits **before** adding a supplement — warn in the add sheet, don't wait for the meter.

### Flags (conditions and medicines)
- The person's conditions = `profile.conditions` + every medicine's `impliesConditions` (warfarin/DOACs/antiplatelets → `blood_thinners`; levothyroxine → `thyroid_disease`) + surgery: `profile.surgery.date` in the future → `upcoming_surgery`; within the last 42 days → `recent_surgery` + age ≥ 65 → `age_65_plus` + vegan/vegetarian diet → `vegan_vegetarian`. `upcoming_surgery` with no date → treat every surgery flag as active and ask for the date.
- For each ingredient the person takes, collect `rules.conditions[*].flags` for their conditions and `rules.medicines[*].interactions` for their medicines (use the interaction's `badge`). Groups: `any_supplement` matches every supplement; `herbal` matches ingredients marked `"herbal": true` in `ingredients.json`, plus ashwagandha and any "other" ingredient — never vitamins, minerals, multivitamins, cod liver oil, foods or medicines (see `rules.groups`).
- Respect `when` on condition flags **and** medicine interactions (see `rules.whenMeaning`): `forms` (unknown = the label doesn't say), `aboveDaily` (counted the way the limit counts — folate in µg folic acid, vitamin E in mg_ul), `withinDaysBeforeSurgery` (the window before the operation; what the reminder says comes from the pause row's `advice`, see §5.7). A flag whose `when` isn't met is inactive: it shows nothing and hides nothing.
- `when.defaulted: true` means the threshold is the app's **everyday amount** (`rules.everydayAmounts` — multivitamin level, below every safe maximum; an app choice, not a health limit). It stops an ordinary multivitamin being gated by, say, liver disease or a blood-pressure medicine. In the detail, say "Applies above <amount> a day". Conditions where any amount matters (kidney disease, cancer treatment, haemochromatosis, upcoming surgery, iodine with thyroid disease, vitamin A in pregnancy, probiotics when immunocompromised) have no threshold.
- Show the strictest badge (`rules.actionOrder`) and list every reason (`why` + `alsoWhy`). `avoid` red · `doctor_first` amber, needs a "My doctor says it's OK" tap (stored with the date) · `caution` yellow · `check_level` blue, "a blood test is the way to know" · `may_need_more` and `info` = information.
- **Suppress low/partial states and food nudges** for any nutrient where the person has an `avoid` or `doctor_first` flag or badge (e.g. potassium with kidney disease or ACE inhibitors, vitamin K with warfarin, iodine with thyroid disease, iron with haemochromatosis). Show "Ask your doctor about <nutrient>" instead.
- **Timing tips** from `timing.separateFrom[].ids` — if two things in the same slot should be apart (iron + calcium, levothyroxine + iron…), show a tip and offer "Move by N hours".

---

## 4. Phases

Stop after each phase: push, update HANDOFF.md, send Vic a 3-line report + 2–3 screenshots (phone width), then continue unless he says stop.

### Phase 1 — Health engine + data (no UI yet)
- `src/app5/health5/`: pure, tested modules — `data.js` (lazy loader + cache), `units.js`, `totals.js`, `targets.js`, `limits.js`, `flags.js`, `timing.js`, `labs.js` (LAB_MAP in `ai/intake-prompt-v6.md`).
- Store slice at `ppw5.health`: `profile` (wake/bed/work/meals/training, sex, age, weightKg, diet, conditions, conditionsOther, medicines, medicinesOther, allergies, surgery, labs, foodEstimate), `cabinet`, `doneSupps` (per date per slot), `foodLogs`, `gut` (fermented servings per date, plants per week), `askDoctor`, `activeProtocols`, `consents` (doctor-OK taps with dates), `settings` (trackMacros, aiIncludeHealth, aiIncludeSupps).
- Age gate: health features need age ≥ 18 (ask once if unknown: "Are you 18 or over?").
- Add repeat token `weekdays` (Mon–Fri) to `normRepeat`, the recurrence engine and the Repeat sheet.
- Settings → "Health" card: My health details (view/edit profile and labs), Track protein & carbs (off by default), Questions for my doctor, **Delete my health data** (confirm; wipes `ppw5.health` and voice-note files).

### Phase 2 — My supplements (cabinet) + supplement slots
- Library → Supps tab: **My supplements** (top) and the existing **Shop** list (below, unchanged).
- Add/edit a supplement: name, servings, times (one or more), repeat, with food; ingredients via a searchable picker (synonyms) with amount, unit and form where it matters. Live preview of converted amounts and badges. "My doctor prescribed this dose" switch (→ supervised, stored with the date).
- **Slots**: supplements sharing a time + repeat become ONE deck item, kind `supps` ("08:00 · Morning supplements · 4"). Ticking the slot marks all taken; expanding it lets the person tick each. One slot = one stack against `FREE_STACK_CAP`.
- **`avoid` items go into the cabinet as "Not scheduled"** with the red flag and reason, and are added to Questions for my doctor. If the person taps "I still take this", they get a "Took it today" button in the cabinet (counted in totals so limits still see it) — but **no slot and no reminders**, and the red badge stays on every view.
- Shop products get "Add to my supplements" (pre-filled from `brand_spec`). Four are over a safe maximum — see `review/CATALOG-REVIEW.md` — and will show red until Vic swaps them.

### Phase 3 — Health dashboard
- **Stack screen strip** under the header (above Next Up): one row of rings — Vitamins · Minerals · Trace · Protein · Gut — with a red dot if anything is near/over max. Hidden until there's at least one supplement or tracked item; before that, a small "Set up your supplements" card (opens the AI planner or the cabinet).
- **Health sheet**: big summary ("18 of 26 covered today"), "You're low on" chips (tap → detail), a warnings banner for over-max, then: Vitamins, Minerals, Trace minerals, Protein carbs & fibre, Gut inputs, Other supplements. Each row: name, bar with a target tick and a red zone past the max, "150 / 200 mg", state chip. Toggle **Today / Planned**. Label "Supplements only" when there's no food data.
- **Nutrient detail**: one-line purpose (`notes`), today's sources, daily need vs app target vs studied range (goal, evidence grade, key study links), safe max and what it counts, top 5 foods, timing tips, personal flags, `lowText`/`highText`, mapped lab result with date.
- **Gut inputs**: fibre bar, fermented servings today (+1), plant variety this week (+1), probiotic taken (if in cabinet). Caption: "Tracks what you feed your gut. It can't measure your gut bacteria — only a stool test can."
- **Protein & carbs** (when on): bars + quick-add (+5, +10, +25 g); meal items with estimates add automatically when ticked.

### Phase 4 — AI intake v6
- Replace `BASE_PROMPT` with the v6 text in `docs/health-pack/ai/intake-prompt-v6.md`; generate its ID lists from `public/health/*.json` at build time. Apply the `buildPrompt()` changes listed there.
- Extend `parsePlan.js`/`parsePlanDoc` for `ppw-routine` v3 per the table in that file. v1/v2 import exactly as today.
- **Import preview** (in `AiBridgeSheet`), four short skippable steps: 1) About you (nothing saved until "Looks right"); 2) Supplements (converted amounts, badges; `avoid` → Not scheduled; `doctor_first` → OK tap; `needsLabel` → "Add amount later"; `suggested` → unticked, tagged "Suggested by your AI", amount chosen by the person — and **dropped** per the parser table: iron without a recent low ferritin, any potassium, and all suggestions in pregnancy, breastfeeding, trying to conceive or under 18); 3) Suggested protocols (cards with Start, never auto-started); 4) Items. "Ask your doctor" points save to Questions for my doctor. Medicines in `medicinesOther` → note "We can't check this medicine — ask your pharmacist about your supplements".

### Phase 5 — Protocols
- Library → Protocols: **Standard protocols** (from `public/health/protocols/index.json`) above the existing PDF list. Mark them trusted by id + SHA-256 of the file, computed at build time.
- Detail: tagline, for / not for, the plan, safety, key studies, evidence grade, doctor-first banner.
- **Start**: pick a start date (surgery protocol asks for the operation date; `dayOffset` counts from it). Check `notFor` against the profile and explain any clash; allow "My doctor has approved this" (stored), except never allow iron with haemochromatosis. Resolve anchors from the profile (wake, meals, bed, training; `after_meals` = lunch + 15 min unless set), `offsetMin`, `dayOffset`, `endDayOffset`, `durationWeeks`. **Items whose date has already passed (e.g. an operation less than 28 days away) are brought forward to today.** Supplement items go into the cabinet (as slots); others become deck items. Register the active protocol (start, end, review date) and add a review reminder at `reviewAfterWeeks`.
- Active protocols show progress and a Stop button (removes future items, keeps history).
- **Import protocol (.md)** and **Share protocol** (export like `routineToMd`). Imported files are never trusted: a `supervised` item becomes `supervisedRequested` → ask "My doctor prescribed this dose" per item. No block → "Ask my AI to convert it" (copy the convert prompt + the file text, paste back).

### Phase 6 — Voice notes + polish
- ＋ Add → **Voice note**: MediaRecorder (`audio/webm;codecs=opus`, or `audio/mp4` on iOS), max 3 minutes, saved via `files5`, item kind `voice` {fileId, durationSec}. Mic denied → plain message. AI-planned voice items show "Tap to record" until recorded.
- MediaViewer: audio playback for `voice`. Deleting a voice item deletes its file.
- Icons per kind (supps, meal, movement, habit, test, voice) in the existing line-icon style.
- Optional: encrypt `ppw5.health` when a passcode is set (meters show "Locked" until unlock).

---

## 5. Safety rules (non-negotiable)

1. Never schedule anything flagged `avoid`. "I still take this" only allows logging it (no slot, no reminders), keeps the red badge visible everywhere, and adds it to Questions for my doctor.
2. `doctor_first` needs an explicit "My doctor says it's OK" tap, stored with the date.
3. Never suggest iron without a ferritin result from the last 6 months that the report calls low. Iron never shows "low" from intake alone.
4. Never suggest potassium supplements.
5. Over-max states can't be dismissed except by marking the dose doctor-prescribed. Show the number, the max, and what counts toward it.
6. Pregnancy, breastfeeding or trying to conceive: "Ask your midwife or doctor" banner on the dashboard; no new-supplement suggestions.
7. Surgery date set → a "Before your operation" list from `rules.pauseBeforeSurgery` for matching cabinet items (matching rules in `rules.pauseAdviceMeaning`), by each row's `advice`:
   - `pause` → "Pause from <date>" (operation date − `stopDaysBefore`).
   - `ask_pause` → "Ask your team if you should pause this from <date>".
   - `continue_ask` (iron, vitamin D, C, zinc, magnesium, fish oil) → "Usually continued — ask your team". **Never "Pause".**
   - `taper_ask` (valerian) → from 28 days before: "Ask your team how to taper it". Never a sudden stop; it stays scheduled.
   Plus "Tell your team every supplement" at day −28 (or today if that's passed). When an `avoid` flag becomes active on a scheduled item (garlic 7 days before), its slot stops reminding and shows "Paused for your operation"; after the operation it asks "Ask your team before you restart" — it never restarts on its own.
8. Every protocol and nutrient screen shows the evidence grade and a short "Not medical advice" line.
9. **Lock-screen notifications never show health details.** Supplement slots: "Time for your supplements". Tests, protocol items and anything from a doctor-first protocol: "PPWellness reminder". The full title shows only inside the app.
10. Under 18: no supplements, protocols or meters.

---

## 6. Copy

- Use `lowText`, `highText`, `notes`, protocol `notes`/`safety` and rule `why` texts as written. Don't rewrite health statements; you may shorten for space.
- Low wording: "Low today" (with food data) / "Not covered by your supplements" (without). Never "deficient".
- Food first: every low state lists 3–5 food sources before any supplement idea.

---

## 7. Decisions — defaults until Vic says otherwise

Make these one-line constants so they're easy to flip:

1. **Free vs Premium:** dashboard, cabinet, slots and the 9 standard protocols are free. Free users can run **1 active protocol**; Premium unlimited. Importing your own protocol (.md) and the AI convert flow are Premium.
2. **Free cap:** a supplement slot counts as 1 stack; protocol items don't count toward `FREE_STACK_CAP`.
3. **Placement:** strip on the Stack screen + Health sheet. No new nav tab.
4. **Food:** AI estimate + quick-add + meal estimates. No food database in this version.
5. **Catalog:** the 4 over-max products stay `publishable: false` until Vic swaps them.

---

## 8. Out of scope

Company/employer dashboards, syncing health data to the server, health details in notifications, a food database, barcode scanning, wearables, users under 18.

---

## 9. Tests to add (vitest)

- **Units**: 1,000 IU D3 → 25 µg · 400 IU synthetic E → meter 180 mg, limit 364 mg (over 300) · 400 IU natural E → 268 mg both · 400 µg folic acid → 680 µg DFE meter (label factor 1.7), 400 µg toward the limit · 400 µg DFE (form unknown) → 400 meter, 235 toward the limit · 5,000 IU beta-carotene → 1,500 µg RAE meter, 0 toward the limit · 6 mg beta-carotene → 3,000 µg RAE, 0 toward the limit · "200 mcg", "200 μg", "200 ug" all → 200 µg · unknown unit "drops" → line kept, flagged.
- **Limits**: magnesium supplements 300 mg → over max even with a 200 mg food estimate · zinc 30 mg → over 25 · B3 nicotinamide 20 mg → fine (57%), nicotinic acid 20 mg → over (10) · calcium 2,200 mg total at 40 → near max (2,500), at 60 → over (2,000) · iron 65 mg supervised → "Doctor-supervised" · omega-3 1,500 mg → caution, not over max · iodine product of 600 µg → product caution + near max.
- **Modes**: magnesium with no food data → no "low" · magnesium with only a protein estimate → still no "low" · potassium never "low", never suggested · iron "low" only with a recent low ferritin · iodine with thyroid disease → low state and food nudges hidden ("Ask your doctor about iodine") · vitamin K with warfarin → same.
- **Targets**: unknown sex → higher target except iron · age 72 → vitamin D 20 µg · pregnancy → max(target, pregnancy value) · protein 80 kg athlete → 96 g · age 17 → health features off.
- **Forms**: "Niacin (as niacinamide) 20 mg" → nicotinamide, fine · "Niacin 20 mg" → asks the form question before any red · cod liver oil can't be saved without its A, D and omega-3 lines · 400 µg folic acid with type 2 diabetes → no flag (counted as 400 µg folic acid, not 680 DFE) · prescribed weekly vitamin D marked "doctor prescribed" → "Doctor-supervised", not over-max.
- **Flags**: pregnancy + retinol → avoid · pregnancy + beta-carotene → nothing · pregnancy + unknown vitamin A → doctor first · trying to conceive + retinol 1,000 µg → nothing, 4,000 µg → avoid · smoker + beta-carotene → avoid, unknown → caution · migraine + magnesium 200 mg → nothing, 400 mg → doctor first · warfarin + vitamin K → doctor first (badge) and implies `blood_thinners` · SSRIs + St John's wort → avoid · ACE inhibitor + potassium salt substitute → avoid; + a multivitamin with 80 mg potassium → nothing; + potassium 300 mg → avoid · operation in 30 days + garlic → "Pause from" reminder, not avoid; in 5 days → avoid and its slot stops reminding · operation in 20 days + valerian → "Ask your team how to taper it", still scheduled, never "Pause" · operation in 3 days + iron → "Usually continued — ask your team", amber "tell your team" badge, still scheduled · multivitamin with 15 mg vitamin E → "Ask your team if you should pause this", not "Pause" (vitamin E's own row needs > 100 mg) · high blood pressure + magnesium 100 mg → caution only; 300 mg → doctor first · kidney disease + magnesium 100 mg → doctor first (any amount) · strictest badge wins · cranberry with warfarin → avoid · garlic supplement with apixaban → avoid · B6 30 mg with an anti-seizure medicine → doctor first; B6 2 mg → nothing.
- **Labs**: low haemoglobin alone → no iron unlock · ferritin low 8 months ago → "Out of date" · MMA high → B12 low.
- **Protocols**: all 9 bundled files parse and are trusted · imported file with `supervised` → asks per item · malformed files fail cleanly · operation 2026-11-02 → "List every supplement" on 2026-10-05; started on 2026-10-20 → that item is brought forward to 2026-10-20.
- **AI v3**: the v6 example is rejected as an echo · a real v3 block imports profile, supplements (as slots, not deck items), suggestions (unticked, not started), items · v2 imports as before · amount null → needs label · unknown ids → "other" / plain text · URLs dropped · age 16 in profile → no supplements imported.
- **Cabinet**: `avoid` item → Not scheduled but listed, added to Questions for my doctor; after "I still take this" → logged only ("Took it today"), counted in totals, **no slot and no reminders**, red badge still shown.
- **Slots**: 3 supplements at 08:00 daily → 1 deck item counted once against the cap · different repeats at one time → separate slots.
- **Timing**: iron + calcium in one slot → move tip.

Then: dev server, check every new screen at 375 px in both themes and Easy-read 140%, zero console errors.

---

## 10. Report back (after each phase)

1. What works now (3 lines, plain English).
2. Screenshots (phone width).
3. Anything blocked or any decision needed from Vic.
4. Commit hashes on `feat/health-meters-2026-10`.

---

### Build notes

- `UNIT_ALIASES` (copy into `health5/units.js`): mcg/μg/ug/microgram → µg · mg/milligram → mg · g/gram → g · iu/i.u./ui → IU · "mcg DFE"/"µg DFE" → µg DFE · "mcg RAE"/"µg RAE" → µg · "mg NE", "mg α-TE" → mg · "billion CFU"/"bn CFU" → billion_cfu · "million CFU" → million_cfu · "CFU" → cfu.
- Herb name matching: lower-case, straight apostrophes, "st." → "st", drop "extract", "root", "leaf", "powder", then whole-word match against `ingredients.json` synonyms.
