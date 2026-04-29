# WAKE_UP_COMMANDS_v3.md

**Stage 5 — BodyMap v2.1 ship sequence.** UX corrections from Vic's live phone test. No new PNGs needed (base body images unchanged from v2). Vic pastes the single PowerShell block below to commit + push.

---

## Stage 5 changes (already done by CoWork)

- **Sex toggle dropped** — single gender-neutral figure. `ppw.bodyFigure` localStorage key + male/female pill UI removed. `bodyFigureFile(view)` simplified, `getHotspots(view)` no longer takes sex.
- **ITB removed** — `it-band-left/right` zones dropped from data.js. Existing `it-band-*/` and old `15_itband_*/` folders moved to `public/videos/zones/_legacy_drops/` with LEGACY_NOTE.txt explaining "release technique target, not a pain location".
- **Knee consolidated** — 6 zones (`knee-inside-*`, `knee-outside-*`, `knee-back-*`) merged into 2 (`knee-left`, `knee-right`). Inside/outside/back differentiation moves to `/tests` engine (`TESTS_BY_GROUP.knee = 3`). Old knee-split folders moved to `_legacy_drops/`.
- **Polygon position audit** (per Vic's annotated screenshot):
  - `lower-back-*` re-anchored to L1–L5 (just above gluteals on BACK view) — cy 560 → 620.
  - `gluteal-*` polygon corrected to actual buttock region — cy 690 → 720.
  - `hamstrings-*` moved to back-of-thigh (was sitting on calf) — cy 860 → 900, top y 740 → 820.
  - `front-shoulder-*` medial edge trimmed (no more chest overlap) — inner x 246 → 230.
  - `hip-flexor-*` shifted ~25 px down (out of abdominal area) — cy 600 → 625.
  - `upper-back-*` shifted ~30 px down (off upper-shoulder) — cy 350 → 390.
  - `traps-*` shifted ~10 px down (off neck) — cy 265 → 275.
- **Select all / Clear all button** added next to FRONT/BACK toggle (gold outline pill). Toggles between selecting every zone in the current view (default pain rating 1) and clearing the entire selection across both views.
- **OLD_TO_NEW shim extended** — translates v2 `it-band-*` and `knee-inside/outside/back-*` codes to v2.1 codes (or drops) on read, so any users who saved routines under v2 codes auto-migrate.

### Final taxonomy

- **14 zone-groups → 27 zone codes** (down from 17 → 33 in v2).
- 19 hotspots on FRONT view, 23 on BACK view.

### Build verified

```
vite v5.4.21 building for production...
✓ 47 modules transformed.
dist/index.html                   1.63 kB │ gzip:  0.77 kB
dist/assets/index-HocxjreJ.css   24.14 kB │ gzip:  5.40 kB
dist/assets/index-CBniKC2v.js   110.85 kB │ gzip: 33.59 kB
dist/assets/vendor-DFLcxSee.js  162.34 kB │ gzip: 52.99 kB
✓ built in 1.45s
```

---

## What Vic needs to paste

Open PowerShell at the App root (`C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app`) and run the block below. Idempotent — safe to re-run.

```powershell
# ─── Stage 5 deploy: BodyMap v2.1 ─────────────────────────────────────
$ErrorActionPreference = 'Stop'
$AppRoot = 'C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app'

Set-Location $AppRoot
Write-Host "→ Working in $AppRoot" -ForegroundColor Cyan

# 1. Clear stale git lock if any
$LockFile = Join-Path $AppRoot '.git\index.lock'
if (Test-Path $LockFile) {
    Remove-Item $LockFile -Force
    Write-Host "  cleared stale .git/index.lock" -ForegroundColor Yellow
} else {
    Write-Host "  no stale .git/index.lock" -ForegroundColor DarkGray
}

# 2. (No PNG copy step — Stage 5 doesn't change base body images.
#     If you ever generate gender-neutral PNGs to replace body_front.png /
#     body_back.png, drop them into public\assets\body_zones\ and
#     re-commit; that's a separate task.)

# 3. Stage + commit + push
git add .
$status = git status --porcelain
if ([string]::IsNullOrEmpty($status)) {
    Write-Host "→ Nothing to commit — working tree clean." -ForegroundColor Cyan
} else {
    git commit -m "feat(BodyMap v2.1): UX corrections from live phone test (Vic Stage 5)

- Drop sex toggle (gender-neutral figure)
- Drop ITB zones (release technique, not pain location)
- Consolidate knee: 6 zones (inside/outside/back x L/R) -> 2 (knee-L/R);
  differentiation moves to /tests
- Polygon re-anchor:
  * lower-back -> L1-L5 just above gluteals (BACK only)
  * gluteal -> actual buttock region
  * hamstrings -> back of thigh (was on calf)
  * front-shoulder -> medial edge trimmed (no chest overlap)
  * hip-flexor -> shifted ~25px down (off abs)
  * upper-back -> shifted ~30px down
  * traps -> shifted ~10px down
- Add Select all / Clear all button (gold outline pill, next to FRONT/BACK)
- Extend OLD_TO_NEW shim with v2->v2.1 transitional mappings
- 14 zone-groups, 27 codes (was 17, 33)
- npm run build clean: 47 modules, 0 errors, 1.45s
- it-band-* and knee-inside/outside/back-* folders moved to _legacy_drops/
  (INSTRUCTIONS.txt preserved per Vic's rule)"
    git push origin main
    Write-Host "→ Pushed to origin/main" -ForegroundColor Green
}

Write-Host "`n✓ Stage 5 deploy complete." -ForegroundColor Green
```

---

## After Vic pushes

1. GitHub Actions builds + deploys.
2. Hard-refresh ppwellness.co/body (Ctrl-F5 / Cmd-Shift-R).
3. Smoke-test:
   - No sex toggle pill anymore.
   - FRONT/BACK toggle + a "✓ SELECT ALL" gold-outline pill next to it.
   - Tap "✓ SELECT ALL" → every zone in the current view goes into stack at pain=1; pill flips to "× CLEAR ALL".
   - Tap "× CLEAR ALL" → stack empties; pill flips back.
   - 19 zones tappable on FRONT, 23 on BACK. No knee splits (single Knee L / Knee R per side). No ITB anywhere.
   - **Position check (the whole reason for Stage 5):**
     - Lower Back labels sit just above gluteal area (L1–L5, not floating mid-thigh).
     - Gluteal labels sit on actual buttocks.
     - Hamstring labels sit on back-of-thigh (not on calf).
     - Front-shoulder labels don't bleed into chest area.
     - Hip-flexor labels sit at hip crease, not over abs.
     - Upper-back labels sit on thoracic mid-back, not upper-shoulder.
     - Trap labels sit on the trap muscle, not the neck.
4. Existing user routines auto-migrate via the `OLD_TO_NEW` shim — any v2 it-band saved zones drop silently, any v2 knee-inside/outside/back saved zones flatten to knee.

If anything is off, ping Dispatch.

---

## Rollback plan

```powershell
# Restore source files from Stage 5 backups
Copy-Item src\data.js.backup_v2pre   src\data.js   -Force
Copy-Item src\App.jsx.backup_v2pre   src\App.jsx   -Force
Copy-Item src\index.css.backup_v2pre src\index.css -Force
git add . ; git commit -m "revert: BodyMap v2.1 (rollback to v2)" ; git push origin main
```

(Folder moves to `_legacy_drops/` are reversible by `mv` back if needed; the `_legacy_drops/` folder itself is a stash, not a deletion.)
