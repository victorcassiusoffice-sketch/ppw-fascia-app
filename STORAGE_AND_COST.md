# Storage & cost — PPW Fascia App hosting

## Where the App is hosted

GitHub Pages — free static hosting tied to the repo. Triggered by every push to `main` via the workflow at `.github/workflows/deploy.yml`. No new accounts beyond the GitHub account Vic already owns.

## Why GitHub Pages (and not Vercel / Netlify / Cloudflare)

- **No new account.** Vercel, Netlify, and Cloudflare all create a new identity on their platform when you sign up via GitHub OAuth. GitHub Pages is part of GitHub itself.
- **Free at our scale for years.** See limits below.
- **Auto-deploy on push.** The workflow handles everything end-to-end.
- **Custom domain ready.** When the App moves to `app.ppwellness.co`, point a CNAME at GitHub Pages — no rehost needed.

## Hard limits (GitHub Pages free tier)

| Limit | Value | Our current usage | Headroom |
| --- | --- | --- | --- |
| Site size (after build) | 1 GB | ~50 MB | 20× |
| Bandwidth | 100 GB / month | unknown — Vic + a few testers initially | huge |
| Builds | 10 / hour | a handful per day | huge |
| Repo size (source) | 1 GB recommended | ~70 MB | huge |

## Asset accounting

| Asset class | Where | Approx. size | Counts toward Pages? |
| --- | --- | --- | --- |
| Body silhouettes (`body_front.png`, `body_back.png`, `body_map.png`) | `public/assets/` | ~1.5 MB | yes |
| Brand icons (`icon-192`, `icon-512`) | `public/assets/` | ~50 KB | yes |
| Body-zone overlay PNGs (Sub-Chat 3, 16 files) | `public/assets/body_zones/` | ~17.5 MB | yes |
| Intro loop video (`intro_loop.mp4`) | `public/assets/` | a few MB | yes |
| Long-form videos (Vic on camera) | YouTube unlisted | not in repo | **no** |
| Audio modules | YouTube unlisted | not in repo | **no** |
| Protocol JSONs (`media.json`, `mock-protocol.json`) | `public/videos/...`, `public/` | tens of KB total | yes |
| JS bundles (built) | `dist/assets/` after build | ~500 KB gzipped | yes |

Total at v0.3 launch: roughly **50 MB** in the live site. The 1 GB site limit gives roughly **20× growth** before we need to think about it.

## Growth runway

At Vic's content rate (a few zone PNGs per quarter, a handful of protocol JSON updates per week, all video on YouTube), the App stays well under 200 MB for **multiple years**. The hard ceiling is 1 GB.

## Migration triggers — when to move off GitHub Pages

Move only if **any** of the following becomes true:

1. Static assets (everything in `public/`) approach **500 MB**.
2. Monthly bandwidth approaches **50 GB**.
3. We need server-side logic (Node API, auth, server-side rendering, scheduled jobs, etc.). GitHub Pages is static-only.
4. We outgrow the free Actions minutes (currently 2,000 min/month for private repos — but the App repo is public, so unlimited).

When any of those triggers fires, the migration target is **Cloudflare Pages**:
- Same git-driven flow (push to main → auto-deploy).
- Free tier is 500 builds/month, 100 K requests/day, unlimited bandwidth.
- Vic creates a Cloudflare account at that point — at our current scale, that's not needed for years.

## Free-tier checklist (for the future host)

- [ ] No new account required, OR justification for the new account
- [ ] Auto-deploy on git push
- [ ] Custom domain support (for `app.ppwellness.co`)
- [ ] HTTPS by default
- [ ] Bandwidth ceiling > 100 GB / month
- [ ] No charge for static asset egress
- [ ] PWA-friendly (correct MIME types for `.webmanifest`, headers for `sw.js`)

## What costs us nothing today

- Hosting → GitHub Pages
- Long-form video → YouTube unlisted (Vic's existing channel)
- Audio modules → YouTube unlisted
- Domain (when we attach one) → already owned (`ppwellness.co`)
- TLS certificate → automatic via GitHub Pages or Cloudflare
- Build minutes → public repo gets unlimited free Actions minutes
