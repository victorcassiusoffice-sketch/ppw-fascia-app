# Slot Calendar — Per-Date Independence + Recurrence

**Report date:** 2026-06-03
**Scope:** Analysis only. No app code changed. Target work branches off `main`.
**Author:** CoWork (analysis for Dispatch / Vic)

---

## 1. The bug (as reported)

On `/today`, the Slot Calendar does **not** hold separate routines per date. Every
calendar date shows the **same** stack. If you add routines today, switch to
tomorrow, the same stack appears. If you delete one stack on tomorrow (e.g. a
YouTube yoga link), it deletes on **every** day. Dates are not independent.

---

## 2. Root cause (in code)

The data layer *looks* date-scoped, which is why this is easy to misread. The
real defect is in the generic storage hook that every date-scoped hook is built
on top of.

### 2.1 The keys ARE date-scoped

`src/state.js` builds a per-date localStorage key and every daily hook uses it:

```js
// src/state.js
function dateKey(base, date) {
  return `${base}::${date || todayISO()}`;            // e.g. ppw.userStacks::2026-06-04
}
export function useDateScopedStorage(baseKey, date, initial) {
  const key = dateKey(baseKey, date);
  return useLocalStorage(key, initial);
}
export function useUserStacks(date) {
  const [stacks, setStacks] = useDateScopedStorage(LS_KEYS.USER_STACKS, date, []);
  ...
}
```

And `src/App.jsx` correctly threads the selected date into all of them:

```js
// src/App.jsx (~line 1966-1984)
const [selectedDate, setSelectedDate] = useState(() => todayISO());
const { isDone, toggle, completed }   = useCompletedToday(selectedDate);
const [dailyOrder, setDailyOrder]     = useDateScopedStorage(LS_KEYS.DAILY_ORDER, selectedDate, []);
const { isHidden, hide, ... }         = useDailyHidden(selectedDate);
const { duplicates, ... }             = useDailyDuplicates(selectedDate);
const { merges, ... }                 = useDailyMerges(selectedDate);
const { stacks: userStacks, addStack: addUserStack, removeStack: removeUserStack, ... }
                                      = useUserStacks(selectedDate);
```

So the storage *addressing* is right. The bug is one level down.

### 2.2 The actual defect — `useLocalStorage` ignores key changes and write-stamps stale state

```js
// src/state.js — THE BUG
export function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => readJSON(key, initial)); // (A) runs ONCE, on mount only
  useEffect(() => { writeJSON(key, val); }, [key, val]);        // (B) persists on key OR val change
  return [val, setVal];
}
```

`useState(initializer)` only runs the initializer on the **first** render. When
`selectedDate` changes, `useUserStacks(selectedDate)` re-runs and passes a
**new** `key` into `useLocalStorage` — but line (A) does **not** re-read. `val`
still holds the previous date's in-memory array.

Worse: effect (B) depends on `[key, val]`, so when `key` changes it **fires and
writes the stale `val` onto the new date's key**. So switching dates doesn't just
*show* the wrong data — it actively **overwrites the target date's stored data**
with the current day's stack.

### 2.3 Why this produces exactly Vic's symptoms

1. Day A: `val = [stackX]`, persisted to `ppw.userStacks::A`.
2. Switch to Day B → hook gets `key = ppw.userStacks::B`. `val` is still
   `[stackX]` (no re-read). Effect (B) fires on the key change and writes
   `[stackX]` into `ppw.userStacks::B`. **B now shows A's stack.**
3. Delete `stackX` on Day B → `val = []`. Effect (B) writes `[]` to `::B`.
4. Switch back to Day A → key changes to `::A`, but `val` is still `[]`; effect
   (B) stamps `[]` over `ppw.userStacks::A`. **The delete "cascaded" to A.**

Net effect: there is effectively **one shared in-memory stack** that gets
rubber-stamped onto whichever date you land on. Every daily hook in `state.js`
(`useUserStacks`, `useDailyMerges`, `useDailyHidden`, `useDailyDuplicates`,
`useCompletedToday`, `DAILY_ORDER`, `DAILY_TIMES`) sits on this same broken
primitive, so all of them share the leak.

### 2.4 Why the existing test missed it

`src/addUrl.test.jsx` renders `renderHook(() => useUserStacks(DATE))` with a
**fixed** date and never switches. The key never changes, so the broken branch
(re-read on key change) is never exercised. The regression guard we need is a
test that mounts on date A, **re-renders with date B**, and asserts independence.

### 2.5 One genuinely un-scoped store (secondary)

`useDailyTitles()` uses `useLocalStorage(LS_KEYS.DAILY_TITLES, {})` with **no**
date — custom titles are global by design. Low priority, but worth a deliberate
decision during the fix (titles keyed by stack id, so collisions are unlikely;
leave global unless it causes cross-date bleed).

---

## 3. Target behaviour

1. **Every date is independent.** Add / delete / edit / reorder / merge on a
   given day affects **only that day**.
2. **Recurrence on add:** This day only · Everyday · Weekly · Every N days
   (custom interval, N up to 30). Recurrence schedules the routine across
   matching future dates, horizon capped at **30 days**.
3. **Reconciliation rule (Vic's law):** recurrence sets the *default*
   occurrences, but a per-date edit/delete is an **independent override of that
   single day**. A delete/set on a day must **not** cascade unless the user
   explicitly chooses "All occurrences."

---

## 4. Proposed data model

Two layers: a **rule layer** (recurrence definitions) and a **per-date override
layer** (exceptions). The day view is the rule expansion *plus* the day's
overrides.

### 4.1 Recurrence rules (global list, one record per recurring routine)

```jsonc
// localStorage key: ppw.recurrenceRules  (NEW, single global list)
[
  {
    "id": "rule::<uuid>",
    "stack": { /* the full stack payload from AddStackModal: type,url,title,time,durationSec,... */ },
    "anchorDate": "2026-06-03",      // first occurrence (ISO)
    "freq": "everyday | weekly | everyN",
    "interval": 2,                    // only for everyN (1..30); weekly => 7; everyday => 1
    "horizonDays": 30,                // expansion cap
    "createdAt": 1717372800000
  }
]
```

**Expansion engine** (pure function, fully unit-testable):
`expandRule(rule, fromISO, toISO) -> [ISO dates]`
- everyday → every date in window
- weekly → anchor + 7k
- everyN → anchor + interval·k (interval 1..30)
- window is clamped to `[today, today+horizonDays]`.

A recurring routine is **not** copied into 30 day-buckets. It lives once as a
rule and is expanded on read. This keeps storage small and makes "edit all
occurrences" trivial (edit the rule).

### 4.2 Per-date instances (unchanged concept, now correctly isolated)

`ppw.userStacks::<ISO>` stays the home for **one-off** ("This day only") stacks —
exactly as today, once the `useLocalStorage` primitive is fixed.

### 4.3 Per-date overrides (the "this day only" exceptions to a rule)

```jsonc
// localStorage key: ppw.recurrenceOverrides::<ISO>  (NEW, per-date)
{
  "rule::<uuid>": {
    "deleted": true,                 // this day skips the occurrence
    "patch": { "time": "07:30" }     // OR a per-day field override (mutually useful)
  }
}
```

### 4.4 Day-view assembly (read path)

```
dayItems(date) =
    expand all rules → occurrences on `date`
    ─ minus occurrences where override[date][ruleId].deleted === true
    + apply override[date][ruleId].patch where present
    + one-off userStacks::date
    (then existing order / hidden / merge / time layers apply as today)
```

### 4.5 Write semantics

| Action | Scope choice | Effect |
|---|---|---|
| Add routine | This day | append to `userStacks::date` (no rule) |
| Add routine | Everyday / Weekly / Every N | create one `recurrenceRules` record |
| Delete | This day | write `overrides::date[ruleId].deleted = true` (rule untouched) |
| Delete | All occurrences | remove the `recurrenceRules` record (+ optional override cleanup) |
| Edit | This day | write `overrides::date[ruleId].patch` |
| Edit | All occurrences | patch the rule's `stack` |

This satisfies Vic's law structurally: the default delete path writes a
**single-date** override and can never touch another day. Cascade happens **only**
when the user picks "All occurrences," which mutates the shared rule.

### 4.6 The required primitive fix (prerequisite for everything)

`useLocalStorage` must re-read when `key` changes and must **not** write stale
state to a new key. The clean React pattern (adjust state during render):

```js
export function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => ({ key, val: readJSON(key, initial) }));
  if (state.key !== key) {                       // key changed → re-read synchronously
    setState({ key, val: readJSON(key, initial) });   // no stale persist
  }
  useEffect(() => { writeJSON(state.key, state.val); }, [state.key, state.val]);
  const setVal = useCallback((u) => {
    setState((s) => ({ key: s.key, val: typeof u === 'function' ? u(s.val) : u }));
  }, []);
  return [state.val, setVal];
}
```

This single fix restores per-date independence for **all** existing daily hooks
even before recurrence is added. Recurrence is the additive layer on top.

---

## 5. Proposed UX

**On add (scope picker in `AddStackModal`):** a segmented control —
`This day` (default) · `Everyday` · `Weekly` · `Every N days` (reveals a 1–30
stepper). Copy under it: "Recurring routines fill your calendar up to 30 days
ahead." Selecting anything but "This day" creates a rule.

**On delete / edit of a recurring item:** a small confirm sheet —
`This day only` (default, highlighted) vs `All occurrences`. One-off stacks skip
the sheet entirely (no scope to choose). A subtle badge (e.g. ↻) marks recurring
items in the list so the user knows a scope choice is coming.

**Defaults chosen to honour Vic's law:** delete/edit default to "This day only,"
so the destructive cascade is never the accidental path.

---

## 6. Build / branch strategy & overlap risk

- **Branch off `main`.** Recurrence is a **data/state-layer** change centred on
  `src/state.js` (the hook fix + new rule/override hooks + a pure
  `recurrence.js` engine) plus small wiring in `AddStackModal.jsx` (scope picker)
  and the add/delete handlers in `App.jsx`.
- **In-flight layout work** lives on `feat/visionpro-bento-layout`, which is a
  CSS/markup re-skin of `/today`. Overlap risk is **low but non-zero**:
  - `src/state.js` — **no overlap** (layout branch doesn't touch the data layer). Safe.
  - `src/AddStackModal.jsx` and the `/today` render block in `src/App.jsx` —
    **possible overlap** if the bento branch restyles the modal or the
    add/delete controls. Mitigation: keep the recurrence diff to *logic and new
    elements* (scope picker, confirm sheet), avoid touching existing className /
    layout lines, and land recurrence first or rebase the bento branch onto it.
- **Migration:** existing data is already stored under `ppw.userStacks::<ISO>`
  keys, but the stale-write bug means a date may hold a value copied from another
  day. Migration is light: no schema rename needed; on first load after the fix,
  optionally de-dupe identical stacks that were stamped across dates (best-effort,
  non-destructive). New keys (`ppw.recurrenceRules`, `ppw.recurrenceOverrides::*`)
  default to empty.

---

## 7. Summary for Dispatch

The date-scoped *keys* are correct; the `useLocalStorage` primitive in
`src/state.js` never re-reads when the key changes and its persist effect stamps
the current in-memory value onto the newly-selected date — so every date shares
one stack and deletes cascade. Fix the primitive (re-read on key change, no stale
write), then add a rule + per-date-override layer for recurrence, with delete/edit
defaulting to "this day only."
