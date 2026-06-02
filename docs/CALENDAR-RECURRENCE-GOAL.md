# Paste-ready `/goal` — Slot Calendar per-date independence + recurrence

Copy everything inside the fenced block below into the code runner.

```
/goal Fix the /today Slot Calendar so every calendar DATE is independent, and add a recurrence option (Everyday / Weekly / Every N days up to 30). Analysis already done — see docs/calendar-recurrence-report.md. Preserve ALL existing functionality.

PLAN (short):
1. Root cause is in src/state.js → useLocalStorage: it reads the localStorage key ONCE via useState initializer and never re-reads when the key changes, AND its persist effect [key,val] write-stamps the stale in-memory value onto the newly-selected date key. Net: all dates share one stack and deletes cascade. Fix the primitive first (re-read on key change, no stale write) using the "adjust state during render" pattern. This alone restores per-date independence for every daily hook (useUserStacks, useDailyMerges, useDailyHidden, useDailyDuplicates, useCompletedToday, DAILY_ORDER, DAILY_TIMES).
2. Add a pure recurrence engine src/recurrence.js: expandRule(rule, fromISO, toISO) for everyday / weekly / everyN (interval 1..30), horizon capped at 30 days, clamped to [today, today+30].
3. Add a global rule store (ppw.recurrenceRules) and a per-date override store (ppw.recurrenceOverrides::<ISO>) in src/state.js. Day view = expand rules for the date, minus per-date {deleted}, plus per-date {patch}, plus one-off userStacks::<ISO>.
4. Wire a scope picker into AddStackModal (This day [default] / Everyday / Weekly / Every N days+stepper) and a delete/edit scope sheet (This day only [default] / All occurrences) in App.jsx. Recurring items get a badge; one-off items skip the sheet.
5. Write vitest unit tests proving per-date independence and recurrence expansion. Migrate existing data non-destructively. Branch off main, keep CSS/layout diff minimal to avoid clashing with feat/visionpro-bento-layout.

Branch: create feat/calendar-recurrence off main (NOT off feat/visionpro-bento-layout). The bento branch is a CSS/markup re-skin; this is a data/state change. Touch src/state.js (no overlap), new src/recurrence.js, and keep edits in src/AddStackModal.jsx + src/App.jsx to logic + new elements only — do not rewrite existing className/layout lines. Flag any overlap you hit.

=== GATE-1 (AUTONOMOUS — machine-verifiable only; you must complete ALL before handing to Vic) ===
- src/state.js useLocalStorage fixed: re-reads on key change and never persists a stale value to a new key.
- New date-keyed model implemented: global ppw.recurrenceRules + per-date ppw.recurrenceOverrides::<ISO>; one-off stacks remain in ppw.userStacks::<ISO>.
- Pure recurrence engine src/recurrence.js implemented (everyday / weekly / everyN 1..30; 30-day horizon).
- Unit tests (vitest) all green, including:
    (a) PER-DATE INDEPENDENCE: render hook on date A, add a stack; re-render on date B → B does not see it; delete on B → A still intact (this is the regression guard the old test lacked).
    (b) RECURRENCE EXPANSION: everyday fills consecutive days; weekly hits anchor+7k; everyN with N=2 and N=30 hits correct dates; nothing expands beyond the 30-day horizon.
    (c) OVERRIDE ISOLATION: "this day only" delete writes a single-date override and does NOT touch other dates or the rule; "all occurrences" delete removes the rule.
- Non-destructive migration of any existing single-stack / stale-stamped data runs once on load without throwing; existing userStacks keys still readable.
- Build green: `npm run build` succeeds.
- Full test run green: `npm run test`.
- Pushed to remote (feat/calendar-recurrence) and merged/fast-forwarded to main per repo flow.
- Report the LIVE commit SHA on main by fetching it (git rev-parse / origin), not from memory.

=== GATE-2 ([VIC-VERIFY] — device checks, do NOT attempt autonomously) ===
- On the phone, open /today. Add a routine on Day 1 and a DIFFERENT routine on Day 2; confirm each day shows only its own (independence).
- Set one routine to Weekly and another to Every 2 days; scroll the date strip forward and confirm they land on the correct future dates within 30 days.
- Delete one routine on a single day via "This day only"; confirm the other days still show it (no cascade). Then delete one via "All occurrences" and confirm it clears across its dates.
- Confirm existing stacks, merges, reminders, ICS export, and reordering still work unchanged.

CONSTRAINTS: No layout/visual redesign. Preserve all existing functionality. Do not push device/phone checks into GATE-1. Stop and report if anything in AddStackModal.jsx or the /today render block conflicts with feat/visionpro-bento-layout.
```
