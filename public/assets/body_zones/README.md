# Body-zone PNG assets

This folder holds two types of PNG assets used by the **BodyMap** component (`src/App.jsx`):

1. **Base body silhouettes** (`body_front.png`, `body_back.png`) — Sub-Chat 3 anatomical PNGs that the polygon hotspots sit on top of.
2. **Chain overlay PNGs** — 16 transparent PNGs (8 fascia chains × 2 views) showing the active chain highlighted in gold. Live in `chains/` subfolder for now (Sub-Chat 5 stages them; later sub-chats wire them in).

## Where Sub-Chat 3 generated these

```
C:\Users\Victor\PPW Protocol Agent\art\output\base_body\
    body_front.png   ← 1024×1024, translucent grey-cream A-pose figure, pure black bg
    body_back.png    ← 1024×1024, same figure rear view

C:\Users\Victor\PPW Protocol Agent\art\output\body_zone_pngs\*.png
    16 chain overlay PNGs, ~1 MB each (~16 MB total)
```

## How they get into the App

Sub-Chat 5's sandbox does **not** have access to the `PPW Protocol Agent` folder. Vic copies them in once with the wake-up PowerShell block (see `WAKE_UP_COMMANDS.md` at App root). The block does:

```powershell
# Copy the two anatomical base body silhouettes
Copy-Item -Path "C:\Users\Victor\PPW Protocol Agent\art\output\base_body\*.png" `
          -Destination "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app\public\assets\body_zones\" `
          -Force

# Copy the 16 chain overlay PNGs into a chains/ subfolder (staged for later use)
New-Item -ItemType Directory -Force -Path "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app\public\assets\body_zones\chains" | Out-Null
Copy-Item -Path "C:\Users\Victor\PPW Protocol Agent\art\output\body_zone_pngs\*.png" `
          -Destination "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app\public\assets\body_zones\chains\" `
          -Force
```

## Fallback behavior — graceful degrade

The BodyMap component (`src/App.jsx`) uses a **three-stage fallback** for the base body PNG so the UI never breaks:

```
1. Try public/assets/body_zones/body_<view>.png       (Sub-Chat 3 anatomical PNG, preferred)
2. Try public/assets/body_<view>.png                  (legacy figure already in repo)
3. Render solid navy rect (#0a1628) as a placeholder
```

Polygon hotspots render on top regardless, so a body tap still works even with no PNG.

## Expected base-body filenames

| File              | Size       | Description                          |
| ----------------- | ---------- | ------------------------------------ |
| `body_front.png`  | 1024×1024  | Anatomical front silhouette          |
| `body_back.png`   | 1024×1024  | Anatomical rear-view silhouette      |

The component places them inside an SVG `<image>` element with `viewBox="0 0 600 1200"` and `preserveAspectRatio="xMidYMid meet"` — the PNG is letter-boxed into the polygon coord space.

## Expected chain overlay filenames (in `chains/`)

| Chain                  | Front view                            | Back view                            |
| ---------------------- | ------------------------------------- | ------------------------------------ |
| `superficial_back_line`  | `superficial_back_line_front.png`     | `superficial_back_line_back.png`     |
| `superficial_front_line` | `superficial_front_line_front.png`    | `superficial_front_line_back.png`    |
| `lateral_line`           | `lateral_line_front.png`              | `lateral_line_back.png`              |
| `spiral_line`            | `spiral_line_front.png`               | `spiral_line_back.png`               |
| `deep_front_line`        | `deep_front_line_front.png`           | `deep_front_line_back.png`           |
| `arm_lines_front`        | `arm_lines_front_front.png`           | `arm_lines_front_back.png`           |
| `arm_lines_back`         | `arm_lines_back_front.png`            | `arm_lines_back_back.png`            |
| `functional_lines`       | `functional_lines_front.png`          | `functional_lines_back.png`          |

## Polygon hotspot reference (29 zones)

Sub-Chat 5 replaced the rect/ellipse wireframe hotspots with anatomically-shaped polygons. Coordinates live in `src/data.js` under `HOTSPOTS_FRONT` and `HOTSPOTS_BACK`. The viewBox is **600×1200** (sacred — never change). Anatomical landmarks:

- Top of head: y≈80 · Shoulders: y≈260 · Mid-chest: y≈360 · Navel: y≈500
- Hip line: y≈640 · Mid-thigh: y≈840 · Knees: y≈980 · Ankles: y≈1130 · Feet: y≈1180
- Body centerline: x=300

Left/right are from the **viewer's perspective** (matches existing `LIFESTYLE_ZONES` mapping). Each hotspot has `code`, `polygon` (SVG points string), and `cx, cy` (centroid for pain-rating label position).

## Specs

- 600 × 1200 logical viewBox (PNGs scale to fit via `preserveAspectRatio`)
- Gold (`#f5b845`) glow / outline for chain overlays
- Body PNG file size: ~700 KB each
- Chain overlay file size: ~1 MB each → ~16 MB total for the chain set
