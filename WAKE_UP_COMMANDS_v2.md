# WAKE_UP_COMMANDS_v2.md

**Stage 4 — BodyMap v2 ship sequence.** Vic pastes this single PowerShell block into a terminal at the App root. It clears any stale git lock, copies the 4 base body PNGs into the live `public/assets/body_zones/` folder, then commits + pushes. CoWork has already done all source/folder edits.

---

## Pre-flight (already done by CoWork, listed for the record)

- Stage 0: read NEW_ZONE_MAP.md + STAGE_4_IMPLEMENTATION_BRIEF.md, verified `src/config.js` clean (21 lines, no `port const` corruption).
- `src/data.js` rewritten to v2 taxonomy (33 codes, sex-override polygons, OLD_TO_NEW shim) — md5 `ffc78710bf863d720a2cc5c8886309b7`.
- `src/App.jsx` BodyMap updated (sex toggle pill + getHotspots + bodyFigureFile) — md5 `b30945d40e86fc8c2bf6e614d64fa397`.
- `src/protocols.js` patched with `migrateZoneCodes` shim for legacy localStorage routines — md5 `234a843ee7712fa14f19125e53cb6467`.
- 99 new zone leaf-folders created (33 codes × 3 levels) with INSTRUCTIONS.txt.
- 24 seed `media.json` files migrated to new zone codes (Lower Back, Front Shoulder, Hip Flexor, Gluteal — each L/R × 3 levels).
- 29 LEGACY_NOTE.txt files written to deprecated old zone folders (legacy INSTRUCTIONS.txt preserved per Vic's rule).
- `npm run build` passed clean: 47 modules, 0 errors, 1.52s.
  - `dist/index.html` 1.63 kB / 0.77 kB gzip
  - `dist/assets/index-*.css` 24.13 kB / 5.40 kB gzip
  - `dist/assets/index-*.js` 113.84 kB / 34.36 kB gzip
  - `dist/assets/vendor-*.js` 162.34 kB / 52.99 kB gzip

---

## What Vic needs to paste

Open PowerShell at the App root (`C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app`) and run the block below as-is. It is idempotent — safe to re-run.

```powershell
# ─── Stage 4 deploy: BodyMap v2 ───────────────────────────────────────
$ErrorActionPreference = 'Stop'
$AppRoot   = 'C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app'
$ArtSource = 'C:\Users\Victor\PPW Protocol Agent\art\output\base_body'
$AssetDest = Join-Path $AppRoot 'public\assets\body_zones'

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

# 2. Copy 4 base body PNGs into the live asset folder
if (-not (Test-Path $ArtSource)) {
    Write-Host "  ✗ MISSING source folder: $ArtSource" -ForegroundColor Red
    Write-Host "    Skipping PNG copy — generate base body PNGs first, then re-run." -ForegroundColor Red
} else {
    if (-not (Test-Path $AssetDest)) { New-Item -ItemType Directory -Path $AssetDest | Out-Null }
    $Pairs = @(
        @{ Src = 'body_front_male.png';   Dst = 'body_front.png'   },
        @{ Src = 'body_back_male.png';    Dst = 'body_back.png'    },
        @{ Src = 'body_front_female.png'; Dst = 'female_front.png' },
        @{ Src = 'body_back_female.png';  Dst = 'female_back.png'  }
    )
    foreach ($p in $Pairs) {
        $From = Join-Path $ArtSource $p.Src
        $To   = Join-Path $AssetDest $p.Dst
        if (Test-Path $From) {
            Copy-Item -Path $From -Destination $To -Force
            Write-Host "  ✓ $($p.Src) → public/assets/body_zones/$($p.Dst)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ skipped (missing): $($p.Src)" -ForegroundColor Yellow
        }
    }
}

# 3. Stage + commit + push
git add .
$status = git status --porcelain
if ([string]::IsNullOrEmpty($status)) {
    Write-Host "→ Nothing to commit — working tree clean." -ForegroundColor Cyan
} else {
    git commit -m "feat(BodyMap v2): 33-code kebab taxonomy + sex toggle + folder migration

- Replace 29 NN_name_side codes with 33 v2 kebab-case codes (NEW_ZONE_MAP.md)
- HOTSPOTS_FRONT/BACK now {shared, female} with getHotspots(view, sex) resolver
- 4 female polygon overrides: front-shoulder, hip-flexor, gluteal, lower-back
- BodyMap.jsx: sex toggle pill (male/female), persists to ppw.bodyFigure
- bodyFigureFile() resolves base PNG by view + sex (3-stage fallback preserved)
- protocols.js: migrateZoneCodes() shim translates legacy localStorage on read
- 99 new zone leaf-folders (33 codes x 3 levels) + 24 seed media.json migrations
- 29 LEGACY_NOTE.txt stubs in deprecated old folders (INSTRUCTIONS.txt preserved)
- Hip Opener video seeds BOTH hip-flexor + gluteal (covers full hip flow)
- npm run build clean: 47 modules, 0 errors, 1.52s"
    git push origin main
    Write-Host "→ Pushed to origin/main" -ForegroundColor Green
}

Write-Host "`n✓ Stage 4 deploy complete." -ForegroundColor Green
```

---

## After Vic pushes

GitHub Actions builds + deploys to ppwellness.co.

Then Vic opens the live site and:
1. Hard-refresh (Ctrl-F5 or Cmd-Shift-R) to bypass cached `index-*.js`.
2. Navigate to `/body`.
3. Confirm:
   - Sex toggle pill (♂ MALE / ♀ FEMALE) above FRONT/BACK toggle.
   - 33 invisible polygon zones cover the figure on front + back.
   - Tapping any zone routes correctly + opens the pain-rating modal.
   - Toggling FEMALE swaps the base PNG (or falls back gracefully if female PNG missing).
   - The 6 seed videos still play under their new codes:
     - `lower-back-left`/`right` → "Lower Back Pain Release Protocol"
     - `front-shoulder-left`/`right` → "Shoulder Release Protocol"
     - `hip-flexor-left`/`right` AND `gluteal-left`/`right` → "Hip Opener — Release your Hips"
4. Open `/settings` — App version still reads `0.2.0-phase2`. Note: existing user routines saved with old NN_ codes will auto-migrate on next read via the `migrateZoneCodes` shim.

If anything off, ping Dispatch.

---

## Rollback plan (if needed)

`git revert HEAD` and force-push, OR restore source files from `*.backup_v1pre`:

```powershell
Copy-Item src\data.js.backup_v1pre   src\data.js   -Force
Copy-Item src\App.jsx.backup_v1pre   src\App.jsx   -Force
Copy-Item src\index.css.backup_v1pre src\index.css -Force
git checkout -- src/protocols.js
git add . ; git commit -m "revert: BodyMap v2 (rollback)" ; git push origin main
```

(public/videos/zones/ migration is purely additive — leaves old folders untouched, so no rollback needed there.)
