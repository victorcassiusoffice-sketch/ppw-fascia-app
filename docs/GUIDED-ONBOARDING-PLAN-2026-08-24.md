# Guided Onboarding — "Your Guide" — Implementation Plan

**Date:** 2026-08-24 · **Author:** Fable product architect (design pass, ultracode)
**For:** Opus 5 build agent — this document is the complete build spec. Everything here was verified against the live code and the live app on 2026-08-24; file/line references are real.
**Repo:** `C:\Users\Victor\Documents\PPW-Code\ppw-fascia-app` · live at `https://app.ppwellness.co`
**Discipline:** feature branch off `main`, $0, no new dependencies, no backend. GATE-1 per phase = machine-verifiable (tests + build). Deploy follows the repo's standing rules, not this doc.

---

## 0 · Orientation — read before touching anything

1. **The live app is App5 only.** `src/App.jsx:115` sets `NEW_DESIGN_ONLY = true`; every route renders `src/app5/App5.jsx`. Everything in `src/pages/**`, `src/components/today/**`, `src/chrome.jsx`, `src/notifications.js`, `src/lib/push.js`, `src/lib/ics.js` is dead legacy code. **Never anchor, import, or edit the legacy tree for this feature.**
2. App5 is a fixed phone frame (`min(430px,100vw) × min(932px,100dvh)`, `position:relative; overflow:hidden`), screens switched by `store5` `S.screen ∈ {stack, library, calendar, settings}`. All sheets are absolutely-positioned overlays inside the frame. z-ladder: onboarding 40 < firstRunChoice 41 < accountSheet 42 < **(new) QuestJournal 43** < **(new) HintBubble 44** < aiBridge 45 < terms 50 < **coach 60** < lockScreen 70.
3. State: `src/app5/store5.js` (useSyncExternalStore), localStorage prefix `ppw5.` via `save(k,v)`. Date keys are **unpadded** `YYYY-M-D`.
4. The existing tutorial infra is `src/app5/coach/CoachMarks.jsx` + `src/app5/coach/tourSteps.js`: [data-tour] spotlight tour, 4-panel dimmer + cut-out, bubble flips, measured **relative to the phone frame** (`hostRef.parentElement`), missing target → centred-bubble fallback, `markTourSeen()/hasSeenTour()` → `ppw5.tourSeen`. It accepts a `steps` prop. **Extend this component; do not build a parallel engine.**
5. The tour trigger today is App5-local `tourOpen` state (`App5.jsx:445-455`), guarded by `S.onboarded && !hasSeenTour() && !(S.aiOpen||S.addOpen||S.termsOpen||S.accountOpen)` + 700 ms. The one-layer-at-a-time rule (F2) is law: no guidance layer may open while any of those flags is truthy, and only one guidance surface may be on screen at once.
6. Existing `[data-tour]` anchors: `add`, `stack`, `library`, `calendar`, `settings` (NavDock), `next-up` (hero), `signin` (header pill), `signup-onboarding`, `signin-onboarding`.
7. Voice: plain, warm, short, honest, no exclamation marks, no mascots, no "awesome". Canonical examples: "Your day, as a stack." · "Free, and we never see your chat." · "It stops someone who picks up your phone — it is not a bank vault." Every string in this doc is written in that voice — use them **verbatim**.

## 0.5 · The design in one paragraph

The app's own metaphor is "your day is a stack of things you tick off" — so the tutorial is **one more stack of things you tick off**: a quest journal called **Your Guide**, opened from a new ring-disc in the Stack header, holding **8 short quests**. Each quest is a guided do-it-yourself mini-tour on the real UI (the spotlight hole is genuinely tappable; the step advances only when the real store event fires). The wizard shrinks to two steps + terms; a 2-step welcome hands the user straight into Quest 1. A separate one-shot **hint engine** catches every trap contextually for users who skip the guide. A bundle of **permanent product fixes** removes the traps that should never have needed a tutorial. Finishing the guide makes the guide leave (the disc animates out), and a permanent **CompletedRing** stays behind as the daily progress surface. Progress is device-local (`ppw5.*`), replayable forever from Settings, and never requires Premium.

Why this shape (judged 3-designs × 3-adversarial-judges): a pure linear tour guarantees coverage but traps and overwhelms; pure contextual tips never reveal the app's power; the quest journal gives arc + agency, and the grafts below close its two real gaps (reminders-honesty reach, hint-engine starvation).

---

## 1 · Data model & flags (all new keys via `store5.save()`)

| Key | Shape | Meaning |
|---|---|---|
| `ppw5.guide` | JSON `{q: {tick:ts, add:ts, time:ts, tomorrow:ts, library:ts, ai:ts, reminders:ts, yours:ts}, done:ts?, welcomed:1?}` | quest completion timestamps; `done` set by finale; `welcomed` set when w2 exits |
| `ppw5.hints` | JSON map `id → count` | per-hint fire counts (count-based so lifetime caps work) |
| `ppw5.tourSeen` | existing | now guards ONLY the 2-step welcome |
| `ppw5.libSeen` | `'1'` | first Library visit happened (drives the permanent media-first default) |
| `ppw5.daysUsed` | JSON array of date-keys (max 10) | distinct open-days counter for the install nudge |

New store5 in-memory state:

```
S.coach   = null | { steps, mode:'passive'|'do', questId?, i }   // lifted from App5-local tourOpen
S.journalOpen = false
S.hint    = null | { id }                                        // current hint bubble
S.lastAddedId = null                                             // set by every add path
S.aiStep  = 0                                                    // AiBridgeSheet mirrors its internal step here (1..4)
```

New store5 actions: `openCoach(spec)`, `advanceCoach()`, `closeCoach()`, `openJournal()/closeJournal()`, `setHint(id)/clearHint()`, `recordQuest(id)`, `guideDone()`.

**Migration rule (mandatory):** on first boot of this build, if `ppw5.tourSeen` or `ppw5.onboarded` already exists → set `ppw5.guide.welcomed = 1` (skip the welcome only). Every hint stays armed and the GuideDisc renders — veterans of the old 5-step tour were never taught any of this.

**Cross-device note:** `profile.js` sync contract is inert (backend route unbuilt). Keep `ppw5.guide` and `ppw5.hints` as two flat JSON keys so they can ride the profile POST body later. The journal footer states: *"Your guide progress lives on this phone."*

---

## 2 · Engine changes (CoachMarks + new modules)

### 2.1 `src/app5/coach/CoachMarks.jsx` — upgrade, don't replace

- **Controlled mode:** read `S.coach` from store5 (keep the internal-state path for the welcome). `open` prop remains for the welcome; quest tours run controlled by `S.coach.i`.
- **`mode:'do'` (do-it-yourself steps):** the 4 dim panels keep `pointer-events:auto` and **only block** (they no longer advance on tap in do-mode); the cut-out hole stays genuinely empty so taps reach the real control (the accent ring is already `pointer-events:none`). Each do-step declares `advanceOn(S) → boolean`, evaluated in a store subscription; when true → `advanceCoach()`.
- **Per-step fields added to the step shape:** `{ target, title, body, mode?, buttons?, advanceOn?, before?, dormantWhen?, escape? }`
  - `before(S)` — side-effect run on step entry (e.g. `goLibrary('media')`, `openAiBridge()`). This is how tours navigate — the current tour cannot.
  - `dormantWhen(S)` — while true, the coach renders NOTHING (no dim, no bubble) but stays armed; resumes when false. Used while the note composer/keyboard or a sheet the step opened is up. (First Day's dormancy rule — mandatory, prevents bubble-over-keyboard.)
  - `escape` — **every do-step renders a small ✕ in the bubble corner** ("pause") → `closeCoach()` without recording completion. The dim must never be the only surface with no exit. Resuming: tapping the GuideDisc reopens the quest at its next incomplete step.
  - `buttons` — optional array for choice steps (`[{label, action}]`).
- Tap-on-dim in passive mode keeps advancing (unchanged). Missing-target centred fallback unchanged.

### 2.2 `src/app5/coach/quests5.js` — NEW

`QUESTS` = 8 defs `{id, title, blurb, steps}` (steps in §4). Helpers: `questDone(id)`, `allDone()`, `nextIncompleteStep(questId)`, `startQuest(id)` (= `closeJournal()` + `openCoach({steps, mode-per-step, questId, i: nextIncompleteStep})`).

**Quest list** (journal order, any order playable, each ~1 min):

1. **Tick one off** — the do/tick/done loop
2. **Add your first thing** — ＋, paste or note
3. **Put a time on it** — time is a button; repeat arrows
4. **Plan tomorrow** — per-date stacks, TODAY chip
5. **Look round the Library** — shelves; add the free protocol
6. **Let your AI plan a day** — the round trip
7. **The truth about reminders** — honesty + install + sounds
8. **Make it yours** — theme, text size, easy read

### 2.3 `src/app5/coach/hints5.js` + `HintBubble.jsx` — NEW (z44)

Registry of one-shot hints `{id, anchor, copy, cap, exempt?, questLink?, buttons?}` + one entry point `maybeHint(id)` called from the sites in §5.

**Engine laws (verbatim from the judged winner-graft — implement exactly):**
- Depth-1 queue: if a hint is showing, a second request is **dropped and its flag is NOT burned** — it waits for its next natural trigger.
- 20 s global cooldown between hints. **Exempt class** (fires immediately, answers the user's own tap): `select-circle`, `auto-box`, `link-failed`.
- Count-based lifetime caps per hint (default 1; exceptions listed in §5).
- Never while: any of `S.aiOpen/addOpen/termsOpen/accountOpen/completedOpen`, `S.playerItem`, `S.coach`, `S.journalOpen`, lock screen, or a drag in progress. (Exception: hints whose anchor lives INSIDE a sheet, marked `inSheet:true` — `add-intro`, `supps-intro`, etc. — fire with their own sheet open but nothing else.)
- Single tap anywhere dismisses. Auto-dismiss 8 s (exempt hints 6 s).
- A hint whose topic has an unfinished quest appends one tappable line: *"There is a one-minute quest on this in your guide."* → `openJournal()` at that quest.
- Settings gets a **Hints** toggle (`ppw5.hintsOff`) that mutes the lot.

`HintBubble.jsx` renders a single CoachMarks-style bubble (reuse its measurement util; no dimmer, no spotlight) anchored to the hint's `[data-tour]`, inside the frame, z44.

### 2.4 `src/app5/coach/welcomeSteps.js` — NEW (replaces TOUR_STEPS usage)

The 5-step `TOUR_STEPS` array is retired from auto-fire (keep the file; the App5 effect switches to `welcomeSteps`). Trigger and guards unchanged (`App5.jsx:445-455`), still one-shot via `ppw5.tourSeen`.

- **w1** · target: none (centred) · passive
  **This is your Stack.**
  *Everything you mean to do today, in one list, in order. The top card is always the next thing. We put four examples in so it is not empty — they are yours to tick off or clear.*
  [Next]
- **w2** · target: NEW anchor `data-tour="guide"` (GuideDisc) · choice
  **Your guide lives here.**
  *Eight short quests. Each one teaches the app by doing the real thing, and takes about a minute. Do them in any order, stop any time, replay them forever.*
  [Start the first quest] · [Later]
  — [Start the first quest] → `markTourSeen()`, `startQuest('tick')`. [Later] → `markTourSeen()`; the GuideDisc does one soft pulse 5 s later (hint `guide-pulse`, cap 1).

### 2.5 Components — NEW

| Component | File | What |
|---|---|---|
| `GuideDisc` | `src/app5/screens/GuideDisc.jsx` | Header disc left of the Completed disc, 8-segment SVG ring in the accent colour, same neumorphic emboss family. Tap → mid-quest? resume that quest at `nextIncompleteStep` : `openJournal()`. Hidden forever once `ppw5.guide.done` (it animates out at the finale — scale+fade, one spring). `data-tour="guide"`. |
| `QuestJournalSheet` | `src/app5/screens/QuestJournalSheet.jsx` | Bottom sheet (z43). Title **Your guide** · sub *Eight small quests. Any order.* Rows = quest title + blurb + the deck's round tick (same spring + press sfx on completion). At 4/8 the header line becomes *"Halfway. The rest is quicker."* Completed rows show **Replay** (re-runs the mini-tour, never un-ticks). Footer: *"Your guide progress lives on this phone."* |
| `HintBubble` | `src/app5/coach/HintBubble.jsx` | §2.3 |
| `CompletedRing` | `src/app5/screens/CompletedRing.jsx` | Thin SVG ring around the existing Completed disc: fill = done-today ÷ (done-today + remaining-today). Permanent daily progress surface (App5 lost the legacy streak/ring). First full sweep animates during the finale. |
| `ReorderGhost` | `src/app5/coach/ReorderGhost.jsx` | 2-card looping ghost animation (cards swap, time labels stay) used by the `reorder` hint. Honour `prefers-reduced-motion` → static two-frame swap. |

### 2.6 New `[data-tour]` anchors (~19 one-line attribute adds)

`guide` (GuideDisc) · `completed-disc` (header Completed disc) · `bell` (bell disc) · `done` (hero Done tick) · `add-link` (paste field) · `add-text` (Text tile) · `latest-item` (row whose id === `S.lastAddedId`, transient) · `item-time` (time control of targeted row) · `item-repeat` (repeat arrows of targeted row) · `cal-tomorrow` (tomorrow's cell — compute with the store's unpadded `YYYY-M-D`) · `open-in-stack` (day-panel button) · `today-chip` (TODAY chip) · `lib-tabs` (Library tab row) · `protocol-add` (Myofascial row add control) · `ai-copy` (bridge copy button) · `ai-preview` (bridge preview list) · `set-reminders` · `set-install` · `set-sounds` · `set-theme` (Settings rows) · `select-circle`, `auto-box` (first row's controls, for hints).

---

## 3 · First-run changes (OnboardingScreen + FirstRunChoice)

`src/app5/screens/FirstRunChoice.jsx` — structurally unchanged. One copy addition under the h1: *"Everything you mean to do, popping up on time."*

`src/app5/screens/OnboardingScreen.jsx` — 3 steps → **2 steps**:

1. **Step 0 becomes a toy.** The 3 DemoCards get a working tick: tapping strikes the card through with the press sfx. New line under the cards: *"Try it — tap a card to tick it off."* (First taste of the core verb, zero risk.)
2. **Delete the old step 1 ("Two ways to fill it") entirely.** Its content lives in Quest 6 and the `add-intro` hint, against the real UI.
3. **Terms step (legally unchanged)** gets two UX fixes:
   - While unticked, render under the dimmed CTAs: *"Tick the box above to continue — it is the legal bit."*
   - Tapping a dimmed CTA pulses the checkbox row (one soft scale pulse) instead of doing nothing.
   - Fork CTAs and behaviour unchanged (`Start by talking to my AI` / `Start with an empty day`; AI fork = sub-flow, F3 rule intact).
4. **AI-fork pre-marking:** if the wizard's AI fork applied a plan, set `ppw5.guide.q.ai` immediately — the user genuinely did the real thing. The welcome still runs afterwards.

---

## 4 · The eight quests — full step spec (copy is final; use verbatim)

Shared rules: every do-step has the ✕ escape (§2.1); every quest completion = ring segment fills + the deck's round tick animates in the journal + one press-sfx chime (respect `ppw5.sounds`); the closing bubble of each quest ends with the flat line *"Quest complete."* No confetti, no stars.

### Quest 1 — Tick one off (`tick`)
- **q1a** · `startQuest('tick')`: `before()` forces `S.screen='stack'`, `viewDate` today · target `next-up` · **do**
  **Do the thing, then tick it.** *The top card is your next thing. Tap the round tick on the card to mark it done.*
  `advanceOn`: `doneByDate[todayKey]` grew. (Copy is example-agnostic — works after examples are cleared.)
- **q1b** · target `completed-disc` · **do**
  **Done things do not disappear.** *They move in here. The little number is today's count. Tap the tick to see everything you have finished.*
  `advanceOn`: `S.completedOpen === true`.
- **q1c** · centred over the open sheet · passive
  **That is the whole loop.** *Do, tick, done. Tomorrow morning the stack rebuilds itself, so you never start from a blank page. Quest complete.*
  [Done] → `recordQuest('tick')`; CompletedSheet stays open for the user to close.

### Quest 2 — Add your first thing (`add`)
- **q2a** · target `add` · **do** — **Add something real.** *Tap the plus. A link you like, or a note to yourself — either works.* `advanceOn: S.addOpen`.
- **q2b** · target `add-link` (copy also names the Text tile) · **do** · `dormantWhen`: note composer open (keyboard)
  **Paste a link, or write a note.** *Paste a YouTube or Spotify link into the box, or tap Text and write one line you want to see today. The Routine, Media and Protocol tiles do not create things — they take you to the Library.*
  `advanceOn`: a new deck item with `example !== true` exists (`S.lastAddedId` set). Invalid paste → the permanent inline error (§6c) handles it; the coach stays dormant-armed.
- **q2c** · target `latest-item` · passive
  **It landed at 9:00, every day.** *New things start at 9:00 in the morning, repeating daily. That is rarely what you want. The next quest shows you how to change it. Quest complete.*
  [Done] → `recordQuest('add')`, `closeAdd()` if still open.

### Quest 3 — Put a time on it (`time`)
- **q3a** · target `item-time` on the Quest-2 item if present, else the hero · **do**, with escape button
  **The time is secretly a button.** *It does not look like one, but it is. Tap the time on this card and pick when it should pop up.* [Keep 9:00]
  `advanceOn`: that item's time changed **or** [Keep 9:00] tapped.
- **q3b** · target `item-repeat` same row · **do**
  **And how often.** *The small arrows choose the rhythm — every day, weekly, every few days, just once. Tap them and pick one. Quest complete when you have.*
  `advanceOn`: RepeatSheet opened for that item and a repeat value saved → `recordQuest('time')`.

### Quest 4 — Plan tomorrow (`tomorrow`)
- **q4a** · target `calendar` (NavDock) · **do** — **Every day has its own stack.** *Today is just one page of many. Tap Calendar.* `advanceOn: S.screen==='calendar'`.
- **q4b** · target `cal-tomorrow` · **do** — **Open tomorrow.** *Tap tomorrow's date. A dot on any day means that day already has something on it.* `advanceOn`: day panel open for tomorrow.
- **q4c** · target `open-in-stack`, then re-anchor `today-chip` · **do**, two beats
  **You are standing in tomorrow.** *Open it in the Stack. The whole screen is showing tomorrow now — the small TODAY chip up top is the way back. Add something for the morning if you like. Tap TODAY when you are ready.*
  `advanceOn`: `S.screen==='stack' && S.viewDate===tomorrow`, then `S.viewDate===today` → `recordQuest('tomorrow')`. (Adding an item is an optional suggestion, **not** the gate — the judged fix for the worst stall point.)

### Quest 5 — Look round the Library (`library`)
- **q5a** · `before(): goLibrary('media')` (never lands on the paywall) · target `lib-tabs` · passive
  **Everything lives in the Library.** *Media is links you have saved. Protocols are step-by-step plans. Supps is a supplement shopping list. Routines are whole saved days — that shelf is part of Premium; everything in this guide is free.* [Next]
- **q5b** · `before(): goLibrary('protocols')` · target `protocol-add` · **do**
  **Try a real protocol.** *Myofascial Recovery is free. Add it to today and it joins your stack. In Media, the small tick means add to today and the calendar disc means pick a day. Quest complete.*
  `advanceOn`: protocol item appended → `recordQuest('library')`. Free-cap refusal → coach shows: *"Your free stack is full — it holds 10 things, and the examples count. Clear the examples first."* + [Clear the examples] → `clearExamples()`.

### Quest 6 — Let your AI plan a day (`ai`) — pre-marked if the wizard AI fork applied (§3.4)
- **q6a** · `before(): openAiBridge()` · centred over bridge step 1 · passive
  **The biggest trick in the app.** *You describe your day to the AI you already use — ChatGPT, Claude or Gemini — and paste its reply back here. The app turns the reply into a planned day. Free, and we never see your chat.* [Next]
- **q6b** · target `ai-copy` · **do** · the user genuinely leaves the app; quest state survives in localStorage and the coach re-opens on return while the quest is mid-flight
  **Copy, ask, come back.** *Copy this prompt, open your AI wherever you normally use it, and paste in what it writes back. Bring the whole reply — do not trim it, the app reads through the messy bits.*
  `advanceOn`: `S.aiStep >= 3` (preview reached with parsed items). Parse failure = the bridge's own PARSE_HELP; the quest has **no failure state**.
- **q6c** · target `ai-preview` · **do**
  **You approve everything.** *Untick anything you do not want, then apply. One tap of Undo removes the lot if it went wrong. Quest complete.*
  `advanceOn`: apply pressed, items landed → `recordQuest('ai')`.
- **Requires:** AiBridgeSheet mirrors its internal step to `S.aiStep` (one `setState` per step change — §7 P1).

### Quest 7 — The truth about reminders (`reminders`)
- **q7a** · `before(): S.screen='settings'` · target `set-reminders` · passive
  **Reminders, honestly.** *The app can only nudge you while it is open on screen. Nothing rings when your phone is locked or the app is closed. We would rather tell you that plainly than let you miss something that matters. For must-not-slip things, set your phone's own alarm as well.* [Next]
- **q7b** · target `set-install` · choice
  **Keep it one tap away.** *Install the app to your home screen so it opens instantly, full screen, like any other app. On iPhone: Share, then Add to Home Screen.*
  Buttons: [Install now] (native prompt via `canPromptInstall()`; on iOS show the manual path with **[I have done it]** as primary — honest, no fake detection) · [I will do it later]. Both complete the step.
- **q7c** · target `set-sounds` · passive
  **Sounds help too.** *With sounds on, the app clicks and chimes while you use it. Quiet by design — nothing plays when the app is closed. Quest complete.* [Done] → `recordQuest('reminders')`.
- **Never, anywhere:** the words "alarm", "notification", "lock screen" as promises. The `.ics` sentence may be added only if per-item calendar export actually ships.

### Quest 8 — Make it yours (`yours`)
- **q8a** · `before(): S.screen='settings'` · target `set-theme` · **do**
  **Pick your look.** *Try a colourway, set the text size, or switch Easy read on for bigger, calmer type. This quest completes the moment you change any one of them.*
  `advanceOn`: colourway, zoom, or a11y value changed → `recordQuest('yours')`.

### Finale (`fin`)
- Trigger: 8th quest recorded (`allDone()` flips), 1 s delay, deferred until no sheet open.
- The journal opens itself in completed state; ring fully accent; the **CompletedRing does its first full sweep** behind it; one soft chime.
  **Guide complete.** *You have used everything that matters — the stack, adding, times, other days, the Library, your AI, honest reminders and your own look. The guide moves to Settings now; every quest can be replayed there whenever you want. Tomorrow morning your stack rebuilds itself. See you then.*
  [Done] → `guideDone()`; the GuideDisc animates out of the header; the journal lives on as the Settings **Guide** row forever.

---

## 5 · Contextual hint set (hints5.js registry)

| id | Trigger (call `maybeHint(id)` at…) | Anchor | Copy (verbatim) | Cap / notes |
|---|---|---|---|---|
| `guide-pulse` | 5 s after w2 [Later] | GuideDisc | (no bubble — one soft pulse animation) | 1 |
| `done-vanish` | first `markDone` when `ppw5.guide.q.tick` unset (welcome skippers) | `completed-disc` | **Done, not gone.** *Ticked things move in here. Tap the badge any time to see everything you have finished today.* | 1 · +quest link |
| `select-circle` | `S.selectedIds` 0→1 outside a quest | `select-circle` | **That circle is for choosing, not finishing.** *It selects cards so you can delete a few at once. To finish something, use the tick on the card itself.* | 1 · **exempt** |
| `auto-box` | first AUTO toggle | `auto-box` | **AUTO plays it for you.** *When this card's time arrives and the app is open on screen, it starts playing on its own.* | 1 · **exempt** |
| `link-defaults` | first successful paste/doc add outside Quest 2 | `latest-item` | **Added for 9:00, every day.** *Those are just the starting settings. Tap the time on the card to change when, or the small arrows to change how often.* | 1 · +quest link (time) |
| `link-failed` | **every** silent parse-fail of the paste field | inline under the field (not a bubble) | *That did not look like something we can add. YouTube, Spotify and most share links work. Plain web pages do too.* | ∞ · stateless · **exempt** — an error must never be one-shot |
| `add-intro` | first `openAdd()` when `ppw5.guide.q.add` unset | AddSheet header (`inSheet`) | **Two ways to fill your day.** *Talk to your AI writes a whole day for you. Or add things yourself — a note, a link, a document. The Routine, Media and Protocol tiles take you to the Library to pick from; they do not create anything here.* | 1 |
| `reorder` | first completed hold-drag | centred + `ReorderGhost` animation | **Times stay where they are.** *Dragging swaps the things between time slots — the slots themselves never move.* | 1 |
| `bell` | first bell-disc tap (arrives in Settings) | `set-reminders` | **The bell brings you here.** *Reminders live in Settings.* | 1 |
| `today-chip` | Stack retargeted to a non-today date outside Quest 4; ALSO re-arms once if the app relaunches with `S.viewDate !== today` | `today-chip` | **You are looking at another day now.** *The stack is showing {weekday} {date}. Tap TODAY to come back to the present.* | **2** |
| `reminder-truth` | first in-app slot banner fires, OR first Settings Reminders tap — whichever first; re-arms once if Reminders toggled ON without a banner-sighting | banner / `set-reminders` | **About reminders — the honest version.** *The app can only nudge you while it is open on screen. Closed or locked, it stays quiet. For the few things that must not slip, set your phone's own alarm as well.* | **2** · +quest link (reminders) — this un-opts-in cliff #1 |
| `routines-paywall` | first Routines-tab view by a free user | lock card | **Routines are the one paid thing here.** *A routine is a whole saved day you can reuse — Premium, $9.99 a month. The rest of the app is free. Nothing to decide now.* | 1 |
| `supps-intro` | first Supps-tab view (`inSheet` n/a — it's a screen) | top of list | **A shopping list, not a commitment.** *These are supplement sets grouped by protocol. Tick what you want. Buying happens on iHerb, not here — the first item opens the basket there, and the rest follow it in.* | 1 |
| `free-cap` | an add refused at `FREE_STACK_CAP` | refusal point | **You have hit the free limit.** *Free keeps up to 10 things, and the example cards count. Clearing them frees their slots. Premium removes the limit.* [Clear the examples] (only if example items remain → `clearExamples()`) · [Not now] | 1 |
| `install-nudge` | 3rd distinct use-day (`ppw5.daysUsed`), `!isStandalone()`, on Stack, no sheet, ≥1 real item | centred, choice | **Put it on your home screen.** *Installed, the app opens full screen, loads faster, and is easier to keep open for its nudges. It takes about ten seconds.* [Show me how] → Settings install row · [Maybe later] | **3**, re-arm 7 days after [Maybe later]; installing sets it permanently |

---

## 6 · Permanent product fixes (ship in the same build — these fix the app, not the tutorial)

a. **Library first impression:** on a free user's first-ever Library visit (`!ppw5.libSeen`), land on the **Media** tab, not Routines. Permanent, not quest-only. (`LibraryScreen.jsx` / `goLibrary` default.)
b. **Quick-add feedback:** the Library quick-add tick always shows a 2 s toast *"Added to today, 9:00."*
c. **Silent paste failure:** invalid link paste in AddSheet renders the inline `link-failed` line (§5) under the field — stateless, every time. Today it is a silent no-op.
d. **Empty-day vs all-done split** (StackScreen empty state): a day with zero items and zero done entries reads **Nothing on this day yet.** *Add something with the ＋, or ask your AI to plan the whole day.* [Plan with AI] → `openAiBridge()`. The all-done state keeps its existing copy.
e. **Supps default-unselected:** kill `defaultSelected()` pre-selection so "Shop 14 on iHerb" can never be the first thing a novice reads. (`SuppsSection.jsx`.)
f. **Protocols empty-state copy** stops blaming the internal pipeline: *"More protocols are on the way. Myofascial Recovery is free while you wait."* (or, if none shipped: *"Protocols land here as they are ready."*)
g. **Signed-out Go Premium** shows *"Sign in first — Premium attaches to an account."* instead of silently rerouting to Settings.
h. **Settings Reminders row** gains a permanent honest sub-line: *"Nudges appear while the app is open on screen. Nothing rings when it is closed."*
i. **Settings additions:** **Guide** row (opens the journal; shows "N of 8") · **Hints** toggle · this also makes the stale `CoachMarks.jsx` line-2 comment ("replayable from Settings") finally true.
j. **Terms step why-line + pulse** (§3.3).
k. **CompletedRing** (§2.5) — permanent daily done-vs-planned surface.

Explicitly **out of scope** (do not build): push notifications, `.ics` revival, backend profile sync, reviving any legacy-tree feature, XP/streaks/badges.

---

## 7 · Build order (each phase = GATE-1: `npm test` green + `npm run build` clean + listed tests added)

**P0 — Engine lift (no visible change).** Lift `tourOpen` → `S.coach`; add `S.hint`, `S.journalOpen`, `S.lastAddedId`, `S.aiStep`; CoachMarks controlled mode + do-mode + `before/advanceOn/dormantWhen/escape`; migration rule. Tests: existing tour still auto-fires once under the old guards; do-mode advances on a store predicate; escape closes without recording.
**P1 — Store surfacing.** `S.lastAddedId` set in every add path; AiBridgeSheet mirrors `S.aiStep`; `ppw5.daysUsed` counter; `ppw5.libSeen`. Tests: unit each.
**P2 — Permanent fixes bundle (§6 a–h, j).** Independent of the tutorial; smallest-risk visible ship. Tests: media-first Library default; empty-day split; supps unselected; paste-fail line renders.
**P3 — Quests.** `quests5.js` + all 19 anchors + GuideDisc + QuestJournalSheet + welcomeSteps + wizard 3→2 + AI-fork pre-mark + finale + CompletedRing. Tests: each quest's `advanceOn` predicates against a mocked store; anchor presence (`querySelector('[data-tour=…]')` per screen); journal tick idempotence; finale fires once.
**P4 — Hints.** `hints5.js` + `HintBubble` + `ReorderGhost` + all `maybeHint()` call sites + Settings Guide/Hints rows (§6 i). Tests: depth-1 drop keeps flag unset; cooldown + exempt class; caps; quest-link opens journal.
**P5 — Polish + full pass.** Sfx wiring, reduced-motion, easy-read zoom sanity (bubbles inside frame at 140% zoom), a full simulated first-run test (wizard → welcome → Q1 → skip → hints still arm).

Estimated: ~8 new files, ~10 touched (`App5.jsx`, `CoachMarks.jsx`, `store5.js`, `OnboardingScreen.jsx`, `SettingsScreen.jsx`, `LibraryScreen.jsx`, `AddSheet.jsx`, `AiBridgeSheet.jsx`, `SuppsSection.jsx`, `CalendarScreen.jsx`). No new deps. All frame-relative, all `ppw5.`-namespaced.

**Hard constraints for the build agent:** never promise OS notifications anywhere; never anchor to the legacy tree; respect the one-layer rule and the z-ladder; the dim must never be the only escape-less surface; do not seed tutorial items into the user's real deck (Quest 5's protocol add is the only tutorial-driven deck mutation, and the user chooses it); all copy verbatim from this doc.

---

## 8 · Flaws found along the way (beyond onboarding — for Vic's backlog)

P0-class (trust/damage): **(1)** Reminders over-promise — the Settings toggle implies phone alarms; reality is a foreground-only 20 s timer (fixed by §6h + hint + Quest 7, but the honest copy should ship even if nothing else does). **(2)** Selection-circle ≠ done misread sits one tap from bulk delete, and the hero Delete has no confirm. **(3)** Silent add defaults (09:00 daily) + silent invalid-paste no-op.
P1-class: **(4)** Library opens on a paywall for free users. **(5)** Free cap of 10 counts the 4 starter examples. **(6)** Done items vanish into an unlabeled disc. **(7)** Per-date stack retargeting with only a tiny TODAY chip. **(8)** Bell disc navigates to Settings (false affordance). **(9)** Drag reorder: 180 ms hold, zero affordance, times-swap semantics. **(10)** Tour one-shot with a false "replayable from Settings" code comment. **(11)** Supps pre-selected under a "Testosterone Optimisation" heading with no context; medical disclaimer collapsed. **(12)** "All done for today" shown for a genuinely empty day.
P2-class: **(13)** Protocols empty state blames an internal approval pipeline. **(14)** Signed-out Go Premium silently reroutes. **(15)** Gel custom photo background does not survive reload (object URL). **(16)** MediaViewer close button says "Cancel"; non-embeddable posters are not tappable. **(17)** Cross-device amnesia — profile sync backend inert, wizard replays on every new device. **(18)** Large dead legacy tree (incl. the entire body-zones/fascia content, push/.ics infra) ships in the repo unreachable.

Items 1–14 are addressed by this plan (§4–§6). Items 15–18 are flagged only.
