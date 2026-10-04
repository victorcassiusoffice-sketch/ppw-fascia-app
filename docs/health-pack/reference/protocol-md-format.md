# PPW protocol file format (v1)

A protocol is a normal Markdown file that people can read, with one fenced `ppw-protocol` JSON block at the end that the app reads. The app only trusts the block. This is the same pattern as shared routines (`ppw-routine`).

Use it for: the 9 standard protocols, protocols Vic writes, and the output of the PPW protocol agent (so its protocols can be imported straight into the app).

## Skeleton

````markdown
# Protocol title

PPW Protocol · v1 · Evidence B · **Doctor first**

One plain line about what it does.

**For:** who it's for.
**Not for:** who should not use it.

## The plan
1. **Item title** — Nutrient amount
   When · How often · evidence B
   One plain line of notes.

## Safety
- One line each.

## Key studies
- Title (year, type). Finding. [Link](https://…)

```ppw-protocol
{ …the JSON block below… }
```
````

## The block

```json
{
  "ppw": "protocol", "v": 1,
  "id": "vein-health", "title": "Vein health", "tagline": "One plain line",
  "for": "Who it's for", "notFor": ["pregnancy", "kidney_disease", "plain text is fine too"],
  "doctorFirst": true, "evidence": "B",
  "durationWeeks": null, "reviewAfterWeeks": 8,
  "anchorDate": "start",
  "items": [
    { "kind": "supplement", "title": "Diosmin + hesperidin (MPFF) 1000 mg",
      "time": "08:00", "anchor": "breakfast", "offsetMin": null,
      "repeat": "daily", "durationMin": null, "dayOffset": null, "endDayOffset": null,
      "nutrients": [ { "id": "mpff_diosmin_hesperidin", "amount": 1000, "unit": "mg" } ],
      "withFood": null, "supervised": false,
      "notes": "Doctor-first. Allow at least 4 weeks to judge it.", "evidence": "B",
      "source": "https://…" }
  ],
  "safety": ["…"],
  "keyStudies": [ { "title": "…", "year": 2020, "type": "Cochrane review", "finding": "…", "url": "https://…" } ],
  "sources": ["https://…"]
}
```

## Field rules

| Field | Rule |
|---|---|
| `kind` | `supplement`, `movement`, `habit`, `meal`, `test`, `note` (`voice` also accepted) |
| `repeat` | `daily`, `weekdays`, `weekly`, `once`, or `"2"`–`"14"` (every N days) |
| `time` | `"HH:MM"` 24-hour — the default when the person's day isn't known |
| `anchor` + `offsetMin` | fit the item to the person's day: `wake`, `breakfast`, `lunch`, `dinner`, `bed`, `before_exercise`, `after_meals`; negative minutes = before |
| `dayOffset` / `endDayOffset` | days from the start date — or from the operation if `"anchorDate": "surgery"` (negative = before) |
| `nutrients[]` | `id` from `data/nutrients.json` or `data/ingredients.json`; anything else `"id": "other"` with a `"name"`. `unit`: µg, mg, g, IU, billion_cfu |
| `supervised` | `true` only for a doctor-supervised dose above the safe maximum; only honoured when `doctorFirst` is `true` |
| `evidence` | A strong · B moderate · C weak or mixed |
| links | only `https://` links that really exist |

Doses must stay at or under the safe maximum in `data/nutrients.json → limit` unless the protocol is doctor-first and the item is `supervised`.

Check a file: `node reference/check-protocols.mjs` (parses every file in `data/protocols/`).
