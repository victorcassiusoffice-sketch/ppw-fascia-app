# Routine link share, Indigo default, stack intro

Branch `feat/routine-link-share-indigo-intro-2026-10`, off `origin/main` `19413ab`.
**Not merged. Not deployed.** `app.ppwellness.co` is untouched.

| | |
|---|---|
| Tests | **717 passing** across 54 files (baseline was 528 across 42) |
| Build | clean |
| Proven | real Chromium, 390x844, Indigo, 18 checks, two separate browser profiles |
| Evidence | `.shots/share-journey/` + `journey.json` |

Re-run the proof:

```
npx vite --port 5240 --strictPort
node tools/shoot-share-journey.mjs
```

---

## Why it is a link and not a file

Vic asked for the shared **file** to open the routine in the app when tapped in
WhatsApp. That is not achievable, and the reason is platform, not effort:

- **iOS** routes a document only to a native app that declares a UTI in its
  bundle. A web app cannot claim one, at all.
- **Chromium `file_handlers`** is desktop-only and needs the PWA installed.
- **Android Web Share Target** appears in the system share sheet, never in
  WhatsApp's own "open with".

The manifest declared none of the three, and adding them would not have changed
any of the above. So the thing the recipient taps is a **link**, which WhatsApp
makes tappable and which opens the app on both platforms with nothing installed.
The gesture is identical for both people; only the payload shape changed.

### The URL

`<origin><BASE_URL>#r=<base64url(JSON)>`

- **Fragment, not a path.** Live-probed: every path except `/` is HTTP 404 on
  GitHub Pages (`cp index.html 404.html` in the deploy workflow), which would
  kill WhatsApp's link preview and the service worker's navigation cache.
- **Fragment, not a query.** A fragment is never transmitted, so a client's
  prescribed programme never reaches GitHub's logs or a `Referer` header.
- **No backend, no new dependency.** `btoa` over a `TextEncoder` byte string.

`embed` and `thumbUrl` are deliberately **not** transmitted — they are re-derived
from the url on arrival and re-checked through `safeUrl`, so a sender chooses
only which *page* a link points at, never what lands in an `<iframe src>`.

### Too long for a link

`routineToLink` returns `null` above the item ceiling or the 8,000-char budget,
and the sender falls back to the existing `.md` file with a line saying so. It
**never truncates**. The file rail stays for exactly this reason, plus desktop
and any browser without `navigator.share`.

---

## What the review found

Eight independent lenses attacked the first build; every finding was then handed
to a second agent whose job was to refute it. **29 survived** verification, 10
were refuted. The ones that mattered:

**The programme was being silently shortened.** The sender encoded every stack;
the receiver sliced to 60 and said nothing. An 84-stack programme fitted one
link, arrived as 60, and both ends reported success — while the `.md` fallback it
replaced carried all 84. Now the sender refuses (falls back to the file) and the
decoder reports what it dropped.

**A six-week programme could not express six weeks.** `dayOffset` was clamped to
27 by the AI bridge's four-week planning ceiling. Weeks 5 and 6 collapsed onto
one day. The share rails now have their own ceiling.

**Every error message in the app was invisible on Indigo.** `#CC0055` on navy is
1.05:1. The passcode-lock error told a locked-out person nothing. There is now a
real `--bad` token per colourway.

**The held programme was destroyed by four different accidents** — a backdrop
tap, a corrupt second link, the account sheet being buried beneath the share
sheet, and the coach tour firing on top of it. A programme a client has not
answered yet now survives everything that is not an answer.

**The feature had no authoring path.** The wire format carries `repeat` and
`dayOffset`, the codec transmits them, the sheet displays them — and the builder
had no way to enter either, so a routine built in the app shared as a flat list
of one-off items. The builder now has both controls. *This is slightly beyond the
literal ask (the share method); it is included because without it the thing being
shared cannot carry a schedule.*

---

## Indigo

`soft: 'gloft'` -> `soft: 'indigo'` in the store defaults, plus the chrome colours
in `index.html` and `public/manifest.json`.

- `brand-and-default-theme.test.jsx` was a **deliberate product lock from
  2026-08-07**, not a stale assertion. It is reversed on Vic's new instruction and
  re-pinned to Indigo with the same rigour, including the gloft/indigo
  counter-example swapping direction.
- An existing user who already chose a colourway keeps it. One who never chose
  flips to dark. A migration faking a choice they never made was rejected: it
  would make every future default change impossible for that cohort.
- Contrast improved rather than regressed: ink-on-ground 4.79/7.51/11.69 for
  Indigo against 4.13/6.02/7.33 for Gloft.

**Known, not fixed, needs a Vic decision:** white labels on the primary accent
button measure below the WCAG floor. This is equally true on the old Gloft
default, so it is not a regression from this work, and changing the accent ramp is
a brand decision. The `--dim` half of it (card meta text) can be fixed
independently with a per-colourway `dimA`, exactly as graphite already does.

---

## The intro

The six-card stack show **was never visible**: it ran behind the first screen and
finished in ~2.97s. That guard is fixed, and "Create an account" no longer skips
the whole pitch.

The art is **generated from the real app in Indigo** by
`tools/shoot-intro-assets.mjs`, not taken from the supplied pitch zips. All 127
images in those zips are gold-toned for the colourway the app just stopped using,
and they are marketing renders rather than the app. The zips were left where they
are and used as framing references only.

The first cut of that art baked **"MONDAY 5 OCTOBER"** and a dead "Sign in" pill
into the frame. The shoot now pins the clock, forces a locale and timezone,
anchors the crop below the header band, and writes a receipt — so it produces the
same image on any machine on any day.

---

## Open for Vic

**Should a routine that arrived by link be savable on the free tier?**

`createRoutine` is premium-gated, with two tests written specifically to stop
anyone relaxing it. As built, the gate stays: the Save button is shown to
everyone and the store's own upsell speaks, so a free recipient sees a real
answer rather than a dead button. That is one line to change.

The argument for changing it: a practitioner handing a programme to a free client
is the strongest reason that client ever upgrades, and letting them *keep* it free
while charging to *run* it puts the upgrade moment in a better place. But it moves
money, so it is Vic's call, not an implementation detail.
