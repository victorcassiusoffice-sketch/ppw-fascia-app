# Claude Design Transfer + Premium/Gumroad Build — Handoff

**Read this file FIRST if resuming after a credit cutout or new session.**

Repo: `C:\Users\Victor\Documents\PPW-Code\ppw-fascia-app`
Branch: `feat/claude-design-transfer-2026-07-06`
Rollback point (pre-this-work): `3fc415107e17a7e5758cd0cfc8782189bc271fca` (branch `feat/mlt-full-build-2026-06-23`, also `origin/main` as of 2026-07-06)

To roll back completely: `git checkout main` (or `feat/mlt-full-build-2026-06-23`) — nothing on this branch touches those.

## How to resume

1. `cd C:\Users\Victor\Documents\PPW-Code\ppw-fascia-app`
2. `git checkout feat/claude-design-transfer-2026-07-06 && git pull origin feat/claude-design-transfer-2026-07-06`
3. Read the STATUS section below — it names the last completed step and the next one.
4. Check `git log --oneline -15` against the STATUS section to confirm nothing is ahead/behind what's recorded.

## Plan (from Vic's brief)

- STEP 0 — Get Vic's new Claude Design Fascia App code. **RECEIVED 2026-07-06** as a handoff-bundle zip (see below).
- STEP 1 — Orient: framework/entry points/backend/deploy/paywall state. DONE (see below).
- STEP 2 — Transfer: swap UI to the new Claude Design build, re-wire real data/backend so nothing existing breaks.
- STEP 3 — Premium payments: Gumroad as the rail (PayPal dead). Settings keeps a premium toggle UI; real state driven by Gumroad entitlement; Vic keeps a manual override so he can flip Premium on for his own testing without buying anything. No hardcoded Gumroad product ID/keys — config placeholder only.

## STATUS (update this after every meaningful chunk, then commit + push)

**Last updated:** 2026-07-06, mid-session.
**Last completed step:** Premium manual-test toggle SHIPPED on this branch (commit `7f0b919`, pushed). `src/lib/entitlement.js` gained `setProMember(isPro)` — the single seam for a future real Gumroad unlock (comment explains it). `src/pages/Settings.jsx` gained a "Membership" card with a glass-switch toggle wired to it (same visual pattern as the existing IF toggle). NO payment gateway wired — Vic explicitly asked to keep it a manual switch for now, just built so a real unlock is a one-function-call drop-in later. Verified live in dev server: toggles both ways, label/persistence correct across reload, zero console errors, clean production build.
**Also done:** `docs\claude-design-import\DESIGN-SPEC.md` — screen inventory (17 screens/modals) + full premium/paywall mechanics from the Claude Design prototype, built via targeted Grep/Read after **three background digest-agents failed silently** (2 tool calls, ~120k tokens each, no output each time — do NOT repeat that approach on this file, it's too big for one-shot digestion; read it in small targeted chunks instead).
**Next step:** Full visual transfer of the 17 screens/modals (`PPW Fascia App.dc.html` → real React), screen by screen, each as its own small commit. Open questions to resolve with Vic first (logged in DESIGN-SPEC.md): (1) naming swap — new design's "Stack" = old app's "Today", new design's "Library" = old app's "Stack"; (2) whether to reconcile the design's Assistant-orb premium-gate with the current app's separate external-paid-Assistant model; (3) font — design uses Nunito, current app/vault docs specify Geist/EB Garamond/Inter.
**Blocked on:** nothing — ready to start screen-by-screen transfer whenever Vic gives the word / answers the open questions above.

## Where the source design lives (not in the repo — scratchpad is session-temporary)

The design bundle is a **scratchpad extraction of a zip Vic provided**, NOT committed to the repo (it's ~140MB with video/image assets — don't add it to git). If resuming in a fresh session and the scratchpad path above no longer exists, ask Vic to re-share `C:\Users\Victor\Documents\PPW app- The one- rebuild-handoff.zip` and re-extract. The durable artifact that DOES survive in git is `docs\claude-design-import\DESIGN-SPEC.md` (once written) — that's the implementation source of truth going forward, not the raw zip.

## Step 1 findings (current app, before any change)

- Stack: Vite + React 18 + react-router-dom 6 + Tailwind 3 + @dnd-kit + `motion`. localStorage-only, no backend/auth. Vitest for tests (`npm run test`).
- Deploy: `.github/workflows/deploy.yml` builds + deploys to GitHub Pages on push to `main`. Live at `https://victorcassiusoffice-sketch.github.io/ppw-fascia-app/`.
- Premium/paywall today: `src/lib/entitlement.js` — `isProMember()` reads `localStorage['ppw.entitlement'] === 'pro'`, defaults to free (fail-closed). Gates the separate paid "Wellness Assistant" launch button (`FEATURE_ASSISTANT_LAUNCH` in `src/config.js`, currently `true`) shown in `src/pages/Settings.jsx` and `src/pages/Today.jsx`. **No UI toggle currently wired to `ppw.entitlement` in Settings** — Vic says there's a premium switch in Settings; that's either part of the incoming new build or needs adding fresh. To confirm with Vic once code lands.
- No Gumroad integration exists yet anywhere in the repo (grepped, zero hits).

## Working discipline for this build (so a credit cutout never loses more than one small step)

1. Commit after every small, working, logically-complete change — never one giant commit at the end.
2. `git push origin feat/claude-design-transfer-2026-07-06` after every commit (this is the off-machine backup; GitHub is source of truth if the session dies).
3. Update the STATUS section above in the same commit as the code change it describes.
4. Before any destructive-feeling step (large file replace, deleting old components), confirm the commit before it is already pushed.
5. Final production deploy (merge to `main` / trigger Pages) requires Vic's explicit yes — this branch stays isolated until then.
