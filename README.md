# ppw-app — Peak Performance Wellness

Folder-driven fascia therapy + protocol-driven daily routines. The folder tree under `public/videos/` IS the catalogue — drop a `media.json` (YouTube unlisted) in the right folder and the app plays it. Protocol JSON files drop in elsewhere and merge into the daily timeline. No backend, no auth — localStorage only.

**Phase 2** (current) extends the original Phase 1 session builder with: the integrated `/today` view, an evidence-based protocol catalogue, audio modules, browser notifications, PWA install, and a YouTube-unlisted media model that replaces local mp4s.

## Run it

```bash
cd ppw-app
npm install
npm start            # http://localhost:3000
npm run build        # → dist/  (root base path)
npm run build:gh     # → dist/  (built for GitHub Pages subpath)
```

Built with Vite 5 + React 18 + react-router-dom 6 + Tailwind 3.

## Live URL

Once the GitHub Pages deploy lands, the app is at:

```
https://<vic-username>.github.io/<repo-name>/
```

(Vic's GitHub username + the repo slug he picks — e.g. `https://victorroyalch.github.io/ppw-fascia-app/`. The trailing slash matters for PWA scope.)

## Deploy flow — push triggers everything

1. Make changes locally → `git commit`
2. `git push origin main`
3. GitHub Actions runs `.github/workflows/deploy.yml` automatically
4. Build takes ~60–90 s; deploy takes another ~30 s
5. Hard-refresh the live URL — service worker picks up the new `ppw-cache-v…` and replaces the old cache

The workflow auto-derives the base path from the repo name (`/${{ github.event.repository.name }}/`), so renaming the repo doesn't break the deploy.

## First-time setup (one-shot, by Vic)

1. Create empty **public** repo at https://github.com/new — name it `ppw-fascia-app` (or your preferred slug). Don't initialise with README / .gitignore / license.
2. From this folder, push:
   ```bash
   git remote add origin https://github.com/<vic-username>/ppw-fascia-app.git
   git branch -M main
   git push -u origin main
   ```
3. In the new repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Wait ~5–10 min for the first workflow run to finish (visible under the Actions tab).
5. Open the live URL on iPhone Safari → **Share → Add to Home Screen** → tap the icon to launch as a PWA.

## Install as PWA on phone

- iOS Safari: Share button → **Add to Home Screen**
- Android Chrome: three-dot menu → **Install app**

The app launches full-screen, gets its own icon, and works offline for previously-visited screens (app-shell + cached protocol JSON).

## Design system — Option B (locked)

| Role            | Hex       | Token                           |
|-----------------|-----------|---------------------------------|
| Deep navy bg    | `#0a1628` | `bg-bg`, `--ppw-bg-deep`        |
| Gold accent     | `#f5b845` | `bg-accent`, `--ppw-gold`       |
| Cream           | `#f0e8d8` | `text-cream`, `--ppw-cream`     |
| Teal            | `#4a9eb8` | `bg-teal`, `--ppw-teal`         |

Headings: Syne. Body: DM Sans. Both load from Google Fonts.

## The 12 routes

| Route             | Phase | Purpose |
|-------------------|-------|---------|
| `/`               | both  | Default — redirects to `/today` if user has any active state, otherwise shows Entry |
| `/welcome`        | 1     | Entry: pick Zone-first or Lifestyle-first |
| `/lifestyle`      | 1     | 10 cards; preset zones |
| `/level`          | 1     | Beginner / Intermediate / Advanced |
| `/body`           | 1     | Tap hotspots → pain 1–3 → save as routine |
| `/tests`          | 1     | Optional yes/no engine — Skip Tests button at top |
| `/summary`        | 1     | Stack with `×2` markers |
| `/session`        | 1     | Player walks through stack |
| `/today`          | 2     | Integrated daily timeline (● protocol, ◆ routine, 🎧 audio) |
| `/protocols`      | 2     | List, multi-select activate |
| `/protocol/:id`   | 2     | Crisis · Science · Enemies · Supps · Nutrition · Daily · Biomarkers · Timeline |
| `/modules`        | 2     | Audio + future modules |
| `/settings`       | 2     | Notifications, mock toggle, version, clear-all |

## Adding media — three modes

### Default zone media
```
public/videos/zones/<zone_code>/<level>/media.json
```

### Lifestyle override (per-zone OR `_all` for whole-body)
```
public/videos/lifestyle_protocols/<lifestyle>/<zone_code>/<level>/media.json
public/videos/lifestyle_protocols/<lifestyle>/_all/<level>/media.json
```

### Audio / module
```
public/videos/modules/<type>/<slug>/media.json
```

### `media.json` schema
```json
{
  "media_type": "video",          // or "audio"
  "youtube_id": "abc123",
  "title": "Lower Back Release",
  "duration_sec": 1058,
  "level_overrides": null
}
```

The app auto-resolves and renders a YouTube-nocookie iframe (full UI for `video`, minimal cropped chrome for `audio`). If `media.json` is missing the app tries the legacy `/.../video.mp4` and falls back to a "coming soon" placeholder.

### Helper script
```bash
npm run add-media -- --type video --youtube Uro31OnQ1uw \
  --title "Lower Back Release" --duration 1058 \
  --zone 12_lower_back_left --level beginner

npm run add-media -- --type video --youtube wOrF6dagTbE \
  --title "Office Worker Reset" --duration 509 \
  --lifestyle office --all --level beginner

npm run add-media -- --type audio --youtube bYbSr5b_mwM \
  --title "Daytime Stress" --duration 326 \
  --module daytime_stress
```

Writes the `media.json` to the right leaf folder. See `tools/add_media.js`.

### Already seeded (Phase 2 launch catalogue)
| Title                    | YouTube ID    | Type  | Where |
|--------------------------|---------------|-------|-------|
| Lower Back Release       | `Uro31OnQ1uw` | video | `12_lower_back_{l,r}` × 3 levels |
| Shoulder Release         | `zL6IwRT_uvM` | video | `03_shoulder_{l,r}` × 3 levels |
| Hip Opener               | `HwF0KleMGhc` | video | `06_hip_{l,r}` × 3 levels |
| Office Worker Reset      | `wOrF6dagTbE` | video | `lifestyle_protocols/office/_all` × 3 |
| Standing for Long Hours  | `x2RZiMxd5w8` | video | `lifestyle_protocols/standing_long/_all` × 3 |
| Daytime Stress (audio)   | `bYbSr5b_mwM` | audio | `modules/audio/daytime_stress` |

Educational + testimonial IDs are stashed in `src/constants/marketing-media.ts` for Phase 3.

## Adding a protocol

Drop a JSON file matching the v1.2 schema (`src/types/protocol.ts`) into `public/` for local testing, or push to the GitHub repo configured in `src/config.js → PROTOCOLS_JSON_URL` for production.

In **Settings**, toggle "Mock" to read `/mock-protocol.json` from `public/`, or "Live" to pull from GitHub. The `mock-protocol.json` shipped with this build is a hand-crafted Testosterone Optimisation protocol with two `fascia_routine` items wired to seeded YouTube IDs, so the integrated daily view renders end-to-end out of the box.

## Migrating from local mp4 → YouTube unlisted

The legacy mp4 path is still recognised as a fallback. Per leaf folder, when both `media.json` and `video.mp4` exist, the JSON wins. The 1001 leaf folders all retain their `INSTRUCTIONS.txt` files; once you upload to YouTube unlisted, run the `add-media` script and the app immediately switches to the iframe.

## Notifications

Permission is requested the first time you activate a protocol or audio module. Reminders fire `NOTIFICATION_LEAD_TIME_MIN` (default 5) before each scheduled item, scheduled via in-page `setTimeout` from the merged daily timeline. No backend, no push — pure local. The service worker handles `notificationclick` to focus or open `/today`.

## PWA install

`manifest.json` + `public/sw.js` provide app-shell caching, offline-friendly navigation, and install-to-home-screen. Cache name bumps with each release (`ppw-cache-v0.3.0`). Both files are subpath-aware: the SW derives BASE from `self.location.pathname` and the manifest uses relative paths, so the same files work at root (`/`) and under a GitHub Pages repo subpath (e.g. `/ppw-fascia-app/`) without rebuilding.

## Folder tree (Phase 2)

```
ppw-app/
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── mock-protocol.json
│   ├── assets/
│   │   ├── body_front.png      (600×1200)
│   │   ├── body_back.png       (600×1200)
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── videos/
│       ├── zones/<29 zones>/<3 levels>/media.json + INSTRUCTIONS.txt
│       ├── lifestyle_protocols/<10 lifestyles>/<29 zones | _all>/<3 levels>/media.json + INSTRUCTIONS.txt
│       ├── tests/<15 groups>/test_NN/{,yes,no}/test.mp4 (legacy) or media.json
│       └── modules/audio/<slug>/media.json
├── src/
│   ├── App.jsx                 (~1000 lines — 12 routes, all components)
│   ├── data.js                 (zones, lifestyles, hotspots, FASCIA_CHAINS, paths)
│   ├── state.js                (localStorage hooks: protocols, modules, routines, completed)
│   ├── protocols.js            (fetch + merge daily items)
│   ├── notifications.js        (permission + setTimeout scheduler)
│   ├── MediaPlayer.jsx         (video iframe / audio chrome / mp4 fallback)
│   ├── config.js               (PROTOCOLS_JSON_URL, USE_MOCK_DATA, LEAD_TIME_MIN, LS_KEYS, APP_VERSION)
│   ├── config.ts               (TS surface — for Phase 3 type-checking)
│   ├── types/protocol.ts       (Protocol schema v1.2)
│   ├── constants/marketing-media.ts
│   ├── index.css
│   └── main.jsx
├── tools/add_media.js          (npm run add-media)
├── tailwind.config.js          (Option B palette)
├── vite.config.js
└── package.json
```

## Hard rules — DO NOT violate

- DO NOT rename the 29 zone codes (e.g. `12_lower_back_left`) — they're the join key between `data.js`, the folder tree, and the protocol JSON
- DO NOT change the body-map canvas dimensions (600×1200 viewBox) — hotspot coords break
- DO NOT delete any `INSTRUCTIONS.txt` files
- DO NOT add a backend / auth / Supabase / Firebase — localStorage only
- Mobile-first; tested down to ~360 px width

## Tests are optional

`/tests` is the original yes/no branching engine. The "Skip tests →" button at the top jumps directly to `/summary` with the current zone selection intact. Tests still run for users who want them.

## Pain scale (KEEP)

Pain `3` doubles a zone's video in the stack, marked `×2` in the summary. This is tied to the stack-building logic — don't change without revisiting `buildStack()` in `App.jsx`.

## Next phase (3) — wishlist, not built

- Onboarding intro using `wV7IBF1XFMM` ("Fascia Is Not Packaging")
- Landing-page testimonial using `25I3JefkT2c`
- Per-item time editing in `/today`
- Variant pickers (standard/vegan) on protocol activation
- Multi-day view (week / month)
- Background-tab notifications via push (will need a backend)
