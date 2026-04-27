# Pre-push notes — Vic actions to get the App live on GitHub Pages

All source-side work is done. This file lists the exact PowerShell commands Vic needs to run to take it the last mile. Wall-clock time from start to "icon on iPhone": **~30–45 min**, mostly waiting for GitHub Actions.

---

## 1. Clean the partial `.git/` folder (one-shot)

A `git init` was attempted from the Cowork sandbox, but the mount permissions left a half-built `.git/` that needs to be removed. From PowerShell:

```powershell
cd "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app"
Remove-Item -Recurse -Force .git
```

If Windows complains about file locks, close any open editors / file explorers on the folder and retry.

---

## 2. Optional: copy Sub-Chat 3 body-zone PNGs

Cowork's sandbox has no access to `C:\Users\Victor\PPW Protocol Agent\…`, so the 16 chain PNGs from Sub-Chat 3 have to be copied manually:

```powershell
Copy-Item -Path "C:\Users\Victor\PPW Protocol Agent\art\output\body_zone_pngs\*.png" `
          -Destination "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app\public\assets\body_zones\" `
          -Force
```

If the source filenames differ from the `<chain>_<view>.png` pattern, add a mapping in `src/data.js → CHAIN_OVERLAY_FILES`. Details in `public/assets/body_zones/README.md`.

(The App works fine without these PNGs — BodyMap silently hides the overlay until they're present.)

---

## 3. Create the empty GitHub repo

In a browser, go to https://github.com/new

- **Owner:** your account (e.g. `victorroyalch` — whatever username you use)
- **Repository name:** `ppw-fascia-app` (or whatever slug you want — the workflow auto-derives the base path from this name)
- **Visibility:** **Public** (required — GitHub Pages on the free tier needs a public repo, and public repos get unlimited Actions minutes)
- **Initialise:** leave all three checkboxes unchecked. No README, no .gitignore, no license.

Click **Create repository**. Copy the HTTPS URL it shows (e.g. `https://github.com/victorroyalch/ppw-fascia-app.git`).

---

## 4. Init, commit, and push from PowerShell

```powershell
cd "C:\Users\Victor\Documents\Claude\Projects\PPWELLNESS - Website and Brand\ppw-app"

git init -b main
git config user.email "victorcassius.office@gmail.com"
git config user.name  "Vic Bhatoolaul"

git add -A
git commit -m "Initial commit — PPW Fascia App Phase 2 (GitHub Pages ready)"

# Replace <USER> + repo name to match what you created in step 3
git remote add origin https://github.com/<USER>/ppw-fascia-app.git

git push -u origin main
```

The push will prompt for GitHub credentials. **Easiest path:** GitHub Desktop (already installed on your Windows machine). Open it, "File → Add local repository", point it at the App folder, and use its **Push origin** button — it handles auth automatically.

**Alternative (CLI):** create a Personal Access Token at https://github.com/settings/tokens (Classic, scope = `repo`), then push with the token in the URL once:

```powershell
git push https://<USER>:<TOKEN>@github.com/<USER>/ppw-fascia-app.git main
```

…and then immediately rotate it. Don't commit the token anywhere.

---

## 5. Enable GitHub Pages

Once the push lands, go to the new repo on GitHub:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

(The workflow at `.github/workflows/deploy.yml` will already have triggered on the push, but Pages won't actually serve until the source is set.)

---

## 6. Watch the deploy

In the repo, click the **Actions** tab. You should see a workflow run named "Build and deploy to GitHub Pages". It takes ~60–90 s to build and another ~30 s to deploy.

When both jobs go green, the live URL is:

```
https://<USER>.github.io/ppw-fascia-app/
```

---

## 7. Install on phone

On iPhone Safari (or Android Chrome):

1. Open the live URL
2. Tap **Share → Add to Home Screen**
3. Tap the **PPW** icon on the home screen — it launches as a full-screen PWA, no browser chrome
4. Activate the **Testosterone** protocol from `/protocols`
5. Open `/today` — the timeline should populate
6. Tap a video — YouTube embed plays inline
7. Allow notifications when prompted

Phase 3 Track 3 (the 7-day personal pilot) starts the moment that icon opens on your phone.

---

## 8. Future content updates — no commands

Day-to-day, Cowork handles everything:

> **Vic:** "I uploaded the Hip Opener video to YouTube unlisted, ID is `abc123`."
>
> **Cowork:** runs `npm run add-media`, commits, pushes. GitHub Actions auto-deploys. ~3 min later it's live on your phone.

Drift-free, zero accounts beyond what you already have.
