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

## ⭐ BINDING DECISION (Vic, 2026-07-06): "Everything New Design. New Design overrules every time."

When the incoming Claude Design build (`PPW Fascia App.dc.html`) conflicts with the
current app in ANY way — naming, layout, fonts, colours, gating, structure — **the New
Design wins.** Do not preserve old visual/UX choices out of caution. The only things
carried over from the old app are the **working data/logic/backend** (localStorage state,
recurrence engine, stacks, .ics reminders, entitlement flag) — re-wired behind the new UI.
Resolved open questions accordingly:
- Naming: new design's **"Stack"** = the daily view (old "Today"); new design's **"Library"**
  = the library (old "Stack"). Use the new names.
- Assistant: new design's **in-app Assistant orb, gated by the one `premium` flag**. (The old
  separate-external-paid-Assistant model yields to the new design.)
- Font: **Nunito** (new design), replacing Geist/EB Garamond/Inter.

## Plan (from Vic's brief)

- STEP 0 — Get Vic's new Claude Design Fascia App code. **RECEIVED 2026-07-06** as a handoff-bundle zip (see below).
- STEP 1 — Orient: framework/entry points/backend/deploy/paywall state. DONE (see below).
- STEP 2 — Transfer: swap UI to the new Claude Design build, re-wire real data/backend so nothing existing breaks.
- STEP 3 — Premium payments: Gumroad as the rail (PayPal dead). Settings keeps a premium toggle UI; real state driven by Gumroad entitlement; Vic keeps a manual override so he can flip Premium on for his own testing without buying anything. No hardcoded Gumroad product ID/keys — config placeholder only.

## STATUS (update this after every meaningful chunk, then commit + push)

**Last updated:** 2026-07-06, mid-session.
**Screen-transfer progress tracker (17 screens/modals total):**
- [x] Global — Nunito font app-wide (`182c917`)
- [x] Premium mechanism — Settings toggle + entitlement seam (`7f0b919`)
- [x] **Native-port foundation** — `src/app5/theme5.js` (full skin engine, ported verbatim) + `src/app5/store5.js` (state + `ppw5.` persistence + stack ops) + `src/app5/App5.jsx` (shell + nav dock) mounted at **`/v2`** (full-bleed route, bypasses old chrome; live app untouched)
- [x] Stack (daily/home view) — NEXT UP hero + deck + mark-done/edit-time/delete/snooze + per-date via viewDate. `df53c94`
- [x] Library — 4-tab gliding control, Routines Premium gate, Media list + add-to-stack; Protocols/Supps empty states. `c0e935b`
- [x] Add sheet — 2×2 tiles (→Library), Assistant CTA (gated), custom paste-a-link add, YouTube/Spotify. `2924108`
- [x] Calendar — month grid + dots + per-date day panel + Open in Stack. `e04e458`
- [x] Settings — skin picker (all soft colourways + glass scenes) + Premium toggle. `7554c64`
- [x] Upgrade/upsell modal — faithful paywall, Enable = Gumroad seam. `2924108`
- [x] Media viewer — tap a video item → inline YouTube embed player. `74aa26a`
- [x] Affirmation (note) composer — in Add sheet, creates note items. `a58525f`
- [x] Completed-today sheet + Undo — from Stack header check-disc. `bd8379f`
- [x] Repeat-options sheet — hero recurrence control (daily/weekly/every-N/once). `f9d853c`
- [x] Terms & Health Disclaimer — full disclaimer, reachable from Settings→About. `e286720`
- [ ] **Remaining** (bigger or needs external deps): Onboarding wizard (large, first-run) · Stack assistant orb chat (needs a real AI endpoint — prototype used Claude-Design's `window.claude`; wire to the existing Wellness Assistant service or an API) · Note popup (affirmation full-screen display fired at its scheduled time — needs a runtime timer) · Slot reminder (needs the existing `.ics`/push wiring) · doc upload (in Add/Library) · Fasting badge/info · Easy set-up (a11y zoom/easy-read)
- [ ] **Deferred polish**: copy scene-background image assets (`assets/glass/*.png`, `bg-grey.png`) into the build so glass/gel scenes show photos (default soft skins need none) · Settings a11y/notifications/IF/tactile sections · reminders wired to the existing `.ics`/push · route cutover (make `/` the New Design) — Vic's explicit go required

**Native port architecture (DECIDED):** The New Design is a complete app with its own data model
(`ppw5.` keys). Porting it as a parallel `src/app5/` tree mounted at `/v2`; old app stays on `/`
untouched (its `ppw.` data is separate). Swap main routes to app5 only at parity + Vic's go.
Pattern per screen: translate the `.dc.html` template slice → JSX in `App5.jsx` (or its own file),
wire bindings/handlers to `store5.js` (grow the store per screen), keep the app building each commit.
Theme is done (`theme5.js`) — every screen inherits it. To VIEW progress: dev server → `/v2`.

**Last completed step:** Native-port foundation + Stack screen SHIPPED to `/v2` (theme5 + store5 + App5). Nunito (`182c917`) + Premium toggle (`7f0b919`) shipped earlier. `src/lib/entitlement.js` gained `setProMember(isPro)` — the single seam for a future real Gumroad unlock (comment explains it). `src/pages/Settings.jsx` gained a "Membership" card with a glass-switch toggle wired to it (same visual pattern as the existing IF toggle). NO payment gateway wired — Vic explicitly asked to keep it a manual switch for now, just built so a real unlock is a one-function-call drop-in later. Verified live in dev server: toggles both ways, label/persistence correct across reload, zero console errors, clean production build.
**Also done:** `docs\claude-design-import\DESIGN-SPEC.md` — screen inventory (17 screens/modals) + full premium/paywall mechanics from the Claude Design prototype, built via targeted Grep/Read after **three background digest-agents failed silently** (2 tool calls, ~120k tokens each, no output each time — do NOT repeat that approach on this file, it's too big for one-shot digestion; read it in small targeted chunks instead).
**MILESTONE (2026-07-06):** ALL 5 PRIMARY NAV SCREENS live at `/v2` (Stack/Library/Add/Calendar/Settings) + the Premium upsell modal. Fully navigable New Design on its own `ppw5.` data; theme engine drives every skin; premium gate + toggle work. Open questions from earlier are RESOLVED by Vic's "New Design overrules every time" (new naming, Nunito, one premium flag).
**Next step:** Secondary modals/flows (unchecked tracker items) — note composer, media viewer, onboarding wizard, assistant chat, terms, repeat picker, etc. Then deferred polish (scene image assets, remaining Settings sections, reminders wiring). Route cutover (`/` → New Design) is LAST + needs Vic's explicit go.
**Blocked on:** nothing — continue down the tracker. Vic decision needed only for the final production cutover.
**To test right now:** `npm run dev` → open `http://localhost:3000/v2`. The live app at `/` is untouched.

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
