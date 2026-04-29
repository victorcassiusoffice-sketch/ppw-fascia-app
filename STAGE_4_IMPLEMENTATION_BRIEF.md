# Stage 4 — PPW Body-Zone Taxonomy v2 Implementation Brief

**For the executor sub-chat. 1 page. Paste this in to start.**

Source of truth: `NEW_ZONE_MAP.md` (sibling file, same folder). Zone count: **17 zone-groups → 33 codes**.

---

## Read order (do this first, in this order)

1. `NEW_ZONE_MAP.md` — full taxonomy + rationale + sources
2. `src/data.js` — current `ZONES`, `HOTSPOTS_FRONT`, `HOTSPOTS_BACK`, `TESTS_BY_GROUP`, `LIFESTYLE_ZONES`, `FASCIA_CHAINS`, `ZONE_TO_CHAIN`
3. `src/App.jsx` lines 1–100 — `ZONE_LABEL_OVERRIDES` and `BODY_IMAGE_TRANSFORMS`
4. `public/assets/body_zones/README.md` — viewBox / PNG conventions
5. `public/videos/zones/12_lower_back_left/beginner/{INSTRUCTIONS.txt, media.json}` — leaf folder format
6. `WAKE_UP_COMMANDS.md` and `PRE_PUSH_NOTES.md` — Vic's deploy conventions

---

## Edit order (strict — one at a time, smoke after each)

1. **Backup** `src/data.js` → `src/data.js.backup4`. Backup `src/App.jsx` → `src/App.jsx.backup4`.
2. **Rewrite `src/data.js`:**
   - `ZONES` — replace 29 entries with 33 new codes (kebab-case). Group field = zone-group base (e.g. `lower-back`).
   - `HOTSPOTS_FRONT` and `HOTSPOTS_BACK` — replace with §6 polygon arrays. Use the per-sex override structure from §5d (`{ shared: [...], male: [...], female: [...] }`). Add a `getHotspots(view, sex)` helper.
   - `TESTS_BY_GROUP` — new keys/counts:
     ```js
     'headache':1, 'jaw':1, 'neck':2, 'traps':1, 'upper-back':1,
     'front-shoulder':2, 'elbow':2, 'forearm':1,
     'lower-back':3, 'hip-flexor':2, 'gluteal':2, 'it-band':2, 'hamstrings':1,
     'knee-inside':1, 'knee-outside':1, 'knee-back':1, 'calf':2,
     ```
   - `LIFESTYLE_ZONES` — full new map:
     ```js
     plumber:       ['front-shoulder-left','front-shoulder-right','lower-back-left','lower-back-right','knee-inside-left','knee-inside-right'],
     electrician:   ['neck-left','neck-right','front-shoulder-left','front-shoulder-right','forearm-left','forearm-right'],
     builder:       ['lower-back-left','lower-back-right','front-shoulder-left','front-shoulder-right','hip-flexor-left','hip-flexor-right'],
     cyclist:       ['hip-flexor-left','hip-flexor-right','hamstrings-left','hamstrings-right','lower-back-left','lower-back-right','it-band-left','it-band-right'],
     racket_sports: ['front-shoulder-left','front-shoulder-right','elbow-left','elbow-right','forearm-left','forearm-right'],
     jujitsu:       ['neck-left','neck-right','front-shoulder-left','front-shoulder-right','hip-flexor-left','hip-flexor-right','lower-back-left','lower-back-right','gluteal-left','gluteal-right'],
     office:        ['headache','neck-left','neck-right','traps-left','traps-right','front-shoulder-left','front-shoulder-right','lower-back-left','lower-back-right'],
     standing_long: ['hip-flexor-left','hip-flexor-right','knee-inside-left','knee-inside-right','calf-left','calf-right','lower-back-left','lower-back-right'],
     lifting_boxes: ['lower-back-left','lower-back-right','hip-flexor-left','hip-flexor-right','gluteal-left','gluteal-right','front-shoulder-left','front-shoulder-right','hamstrings-left','hamstrings-right'],
     driving:       ['neck-left','neck-right','lower-back-left','lower-back-right','hip-flexor-left','hip-flexor-right','gluteal-left','gluteal-right'],
     ```
   - `FASCIA_CHAINS` — full new map:
     ```js
     superficial_back_line:  ['headache','traps-left','traps-right','upper-back-left','upper-back-right','lower-back-left','lower-back-right','gluteal-left','gluteal-right','hamstrings-left','hamstrings-right','knee-back-left','knee-back-right','calf-left','calf-right'],
     superficial_front_line: ['neck-left','neck-right','front-shoulder-left','front-shoulder-right','hip-flexor-left','hip-flexor-right','knee-inside-left','knee-inside-right'],
     lateral_line:           ['neck-left','neck-right','it-band-left','it-band-right','knee-outside-left','knee-outside-right','calf-left','calf-right'],
     spiral_line:            ['upper-back-left','upper-back-right','it-band-left','it-band-right','calf-left','calf-right'],
     deep_front_line:        ['jaw-left','jaw-right','neck-left','neck-right','hip-flexor-left','hip-flexor-right','calf-left','calf-right'],
     arm_lines_front:        ['front-shoulder-left','front-shoulder-right','elbow-left','elbow-right','forearm-left','forearm-right'],
     arm_lines_back:         ['traps-left','traps-right','upper-back-left','upper-back-right','elbow-left','elbow-right','forearm-left','forearm-right'],
     functional_lines:       ['front-shoulder-left','gluteal-right','front-shoulder-right','gluteal-left'],
     ```
   - **Add backwards-compat shim** — `MIGRATE_OLD_CODE(oldCode) → [newCodes...]` for any localStorage routine saved pre-v2:
     ```js
     export const OLD_TO_NEW = {
       '01_head_both':         ['headache'],
       '02_neck_left':         ['neck-left'],     '02_neck_right':        ['neck-right'],
       '03_shoulder_left':     ['front-shoulder-left'],   '03_shoulder_right':    ['front-shoulder-right'],
       '04_upper_arm_left':    [], '04_upper_arm_right':   [],   // deprecated
       '05_forearm_left':      ['forearm-left'],  '05_forearm_right':     ['forearm-right'],
       '06_hip_left':          ['hip-flexor-left','gluteal-left'],   '06_hip_right': ['hip-flexor-right','gluteal-right'],
       '07_thigh_left':        ['hip-flexor-left','hamstrings-left'],   '07_thigh_right': ['hip-flexor-right','hamstrings-right'],
       '08_ankle_left':        ['calf-left'],     '08_ankle_right':       ['calf-right'],
       '09_chest_left':        [], '09_chest_right':       [],   // deprecated
       '10_lower_arm_left':    ['forearm-left'],  '10_lower_arm_right':   ['forearm-right'],
       '11_lateral_arm_left':  [], '11_lateral_arm_right': [],   // deprecated
       '12_lower_back_left':   ['lower-back-left'], '12_lower_back_right': ['lower-back-right'],
       '13_knee_left':         ['knee-inside-left','knee-outside-left','knee-back-left'],
       '13_knee_right':        ['knee-inside-right','knee-outside-right','knee-back-right'],
       '14_foot_left':         ['calf-left'],     '14_foot_right':        ['calf-right'],
       '15_itband_left':       ['it-band-left'],  '15_itband_right':      ['it-band-right'],
     };
     ```
3. **Rewrite `src/App.jsx`** — `ZONE_LABEL_OVERRIDES`:
   ```js
   const ZONE_LABEL_OVERRIDES = {
     'headache':            'Head',
     'jaw-left':            'Jaw L', 'jaw-right':           'Jaw R',
     'traps-left':          'Trap L', 'traps-right':        'Trap R',
     'upper-back-left':     'Up.Bk L', 'upper-back-right':  'Up.Bk R',
     'front-shoulder-left': 'F.Sh L', 'front-shoulder-right':'F.Sh R',
     'forearm-left':        'F.Arm L', 'forearm-right':     'F.Arm R',
     'lower-back-left':     'L.Bk L', 'lower-back-right':   'L.Bk R',
     'hip-flexor-left':     'Hip.F L', 'hip-flexor-right':  'Hip.F R',
     'gluteal-left':        'Glut L', 'gluteal-right':      'Glut R',
     'it-band-left':        'ITB L', 'it-band-right':       'ITB R',
     'hamstrings-left':     'Ham L', 'hamstrings-right':    'Ham R',
     'knee-inside-left':    'Kn.In L', 'knee-inside-right': 'Kn.In R',
     'knee-outside-left':   'Kn.Out L', 'knee-outside-right':'Kn.Out R',
     'knee-back-left':      'Kn.Bk L', 'knee-back-right':   'Kn.Bk R',
     'calf-left':           'Calf L', 'calf-right':         'Calf R',
   };
   ```
4. **Add sex toggle setting** to `/settings` route — radio group: Male / Female / Default. localStorage key `ppw.bodyFigure`. Wire `BodyMap` to read it and pick base PNG + polygon-override set.
5. **Write `tools/migrate_zones_v2.mjs`** — idempotent Node script that:
   - Creates 33 new leaf folders under `public/videos/zones/<new-code>/{beginner,intermediate,advanced}/INSTRUCTIONS.txt`.
   - Copies (does NOT move) the 6 seed `media.json` files for all 3 levels (lower-back-L/R, front-shoulder-L/R, hip-flexor-L/R).
   - Adds `LEGACY_NOTE.txt` to all 29 old folders, pointing to new code(s).
   - Mirrors the 33-zone subtree under each of 10 `lifestyle_protocols/<lifestyle>/` directories.
   - Does NOT delete any existing file. Does NOT delete INSTRUCTIONS.txt.
   - Logs every action; safe to re-run.
6. **Smoke test** — see checklist below. Only after all green, hand back to Dispatch.

---

## Smoke test checklist

- [ ] `npm run build` succeeds with zero errors.
- [ ] `/body` route renders without console errors. **All 33 polygons visible** across front+back. None overlapping (visually inspect).
- [ ] Tap each new polygon → routes to new zone code, pain-rating modal opens, save works.
- [ ] Old localStorage from a pre-v2 routine load → migrates via `OLD_TO_NEW` shim, no data loss, no crash.
- [ ] All 6 seed videos still play under their new codes (lower-back-L/R, front-shoulder-L/R, hip-flexor-L/R) at all 3 levels.
- [ ] Lifestyle pre-selects work — open `/lifestyle`, pick each of 10 lifestyles, verify expected zones highlight on `/body`.
- [ ] Tests engine works for new groups — `/tests` after picking a zone with `TESTS_BY_GROUP[group] > 0` plays the test trees. (Test videos themselves can be missing; the engine shouldn't crash.)
- [ ] Sex toggle in `/settings` switches base PNG + recalibrates `front-shoulder-*` / `hip-flexor-*` / `gluteal-*` / `lower-back-*` polygons. (Requires female PNGs; if missing, falls back to neutral.)
- [ ] `migrate_zones_v2.mjs` runs cleanly twice in a row (idempotency).
- [ ] No old `NN_name_side` zone code remains as a hardcoded literal anywhere except the `OLD_TO_NEW` shim and `LEGACY_NOTE.txt` files. Grep for `NN_` and `^[0-9][0-9]_` patterns.
- [ ] `dist/` build still passes the existing test scripts (`scripts_build.mjs`, smoke configs).

---

## DON'Ts (hard rules)

- **DON'T delete any `INSTRUCTIONS.txt` file** — they're sacred (Vic's rule). Only ADD new ones.
- **DON'T delete any old `NN_name_side` folder** — leave as legacy stub with `LEGACY_NOTE.txt`.
- **DON'T delete or move any existing `media.json`** — copy only.
- **DON'T touch the 600×1200 viewBox** in `data.js` or `App.jsx` — sacred (PNG transforms calibrated to it).
- **DON'T change the `media.json` schema** — extend with optional fields only (e.g. `sex_overrides` for future use).
- **DON'T post or publish anything** — Vic confirms publishing per Vic Protocol.
- **DON'T change folder naming convention** for new codes — kebab-case, no level prefix, no underscores.
- **DON'T skip backups** — `*.backup4` before any edit.
- **DON'T merge or rename anything not specified in `NEW_ZONE_MAP.md`** — if unclear, stop and ask Dispatch.
- **DON'T introduce new dependencies** — stay on Vite 5 / React 18 / Tailwind 3 stack.
- **DON'T modify protocols.js, state.js, notifications.js, MediaPlayer.jsx, or SortableList.jsx** unless a specific file edit is required (e.g. for the sex toggle setting in settings view).
- **DON'T remove the legacy `body_front.png` / `body_back.png` fallback** — keep the three-stage fallback in `BodyMap` working.

---

## When done

Report DONE / WAITING to Dispatch with:
- Zone count (should be 17 groups / 33 codes confirmed)
- Smoke test pass list
- Any deviations from this brief and why
- Path to migration log from `tools/migrate_zones_v2.mjs`

If anything is ambiguous, **stop and ask Dispatch — don't guess.**
