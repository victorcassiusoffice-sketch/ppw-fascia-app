# Wake-up commands — Sub-Chat 5 (BodyMap full rebuild)

Vic, paste this **single PowerShell block** into a fresh PowerShell window and hit Enter. It will:

1. Clear any stale `git/index.lock` from yesterday's session
2. Copy the two anatomical base body PNGs from the Protocol Agent folder
3. Copy the 16 chain-overlay PNGs into a `chains/` subfolder (staged for later use)
4. `git add` everything in the working tree
5. Commit with a descriptive message
6. Push to `main` so GitHub Actions auto-deploys

## The block

```powershell
# 1. Clear any stale git lock
Remove-Item "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app\.git\index.lock" -Force -ErrorAction SilentlyContinue

# 2. Copy anatomical base body silhouettes (Sub-Chat 3 output)
Copy-Item -Path "C:\Users\Victor\PPW Protocol Agent\art\output\base_body\*.png" `
          -Destination "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app\public\assets\body_zones\" `
          -Force

# 3. Copy 16 chain-overlay PNGs into chains/ subfolder (staged for later sub-chats)
New-Item -ItemType Directory -Force -Path "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app\public\assets\body_zones\chains" | Out-Null
Copy-Item -Path "C:\Users\Victor\PPW Protocol Agent\art\output\body_zone_pngs\*.png" `
          -Destination "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app\public\assets\body_zones\chains\" `
          -Force

# 4-6. Stage, commit, and push
Set-Location "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app"
git add .
git commit -m "feat(BodyMap): anatomical PNG + polygon hotspots, hotfix to back hotspots, affiliate buttons"
git push origin main
```

## What changed in this sub-chat

- `src/data.js` — `HOTSPOTS_FRONT` and `HOTSPOTS_BACK` rebuilt with anatomical polygon shapes (29 zones, 600×1200 viewBox). Backed up at `src/data.js.backup3`.
- `src/App.jsx` — `BodyMap` component now renders body PNG inside the SVG canvas with three-stage fallback (`body_zones/body_<view>.png` → `body_<view>.png` → solid navy rect). Hotspots render as `<polygon>` elements. Backed up at `src/App.jsx.backup3`.
- `public/assets/body_zones/README.md` — documents the new asset layout and fallback behavior.

After the push, GitHub Actions builds and deploys to Pages within ~2 min. Reload the live App, navigate to the BodyMap, and the wireframe rectangles should be gone — replaced by anatomically-shaped tap targets sitting on top of the new figure.

## If something goes wrong

- **`git push` rejected (non-fast-forward)**: `git pull --rebase origin main` then re-run `git push origin main`.
- **`Copy-Item` fails with "cannot find path"**: confirm the Protocol Agent folder still has `art\output\base_body\*.png` and `art\output\body_zone_pngs\*.png`.
- **BodyMap shows just a dark rect**: the new PNGs didn't make it. Check `public/assets/body_zones/body_front.png` exists. Re-run step 2.
- **Polygons appear shifted from the figure**: the PNG isn't 1024×1024 or doesn't match the 600×1200 anatomy landmarks. Regenerate via Sub-Chat 3 prompts.
