# The routine market: public build, routine format v2, the Studio (3 Nov 2026)

Branch `feat/routine-market-2026-11-03`, off `origin/main` `ca70b01`.
**Not merged. Not deployed.** `app.ppwellness.co` is untouched.

Victor's decision, 3 Nov 2026: the Lifestyle App goes **public and free**
("lifestyle public"); a therapist or clinic sells a routine **outside** the app
by link or QR ("lifestyle option 1"); the app sells nothing; PPW charges the
practitioner a yearly licence on the web; the first clinic is Victor's own
clients. Plan: vault `06-Roadmap/_handoff/LIFESTYLE-APP-ROUTINE-MARKET-PLAN-2026-11-03.md`,
steps 1 to 4. Steps 5 to 8 (cloud routines, push, store wrappers, Gumroad
off-sale) are not in this branch.

## 1. Public build

The access-code door (`access.js`, `access-codes.json`, `screens/AccessGate.jsx`)
and the confidentiality tick (`nda.js`) are **deleted**, with their two test
files and the two tools that only served them (`tools/mint-access-code.mjs`,
`tools/shoot-b2b-gate.mjs`). `App5.jsx` mounts no door. Nothing on the device
decides who may be here any more.

Unchanged and proven (`public-build.test.jsx`, `demo-embed.test.jsx`,
`all-access-open.test.jsx`):

- `?demo=1` is still the furnished sample day, writes nothing, makes no request,
  offers no sign-in, and is never a practitioner.
- A `#r=` link read on boot is stripped from the URL and held through the
  first-run doors; a v1 link and a v2 link both open on a fresh install.
- The client side is free and offline-first exactly as before: `PREMIUM_OPEN`
  stays `true`, `premiumPaid` still records the server's own verdict (the
  2026-07-31 subscriber), and the Gumroad webhook path in the API is untouched.

Still open, not this build: a site privacy page. The app itself references none
(the only "privacy" in `src/` is the passcode lock's wording); the 28 Oct store
analysis found `ppwellness.co/privacy*` at 404, which is the marketing site's.

## 2. Practitioner entitlement (the API side)

`ppw-wellness-assistant` branch `feat/practitioner-entitlement-2026-11-03`:
`app_entitlements.entitlement = 'practitioner'` for app `lifestyle`, granted by
`POST /api/admin/licences/grant` (inside the catch-all; no new Vercel function)
or by a DB row; revoked by `POST /api/admin/licences/revoke`.
`GET /api/me/entitlement?app=lifestyle` answers `practitioner: true` (and
`premium: true`); revoked answers `entitlement: 'none', practitioner: false`.
How to grant one: that repo's `docs/PRACTITIONER-LICENCE.md`. No payment code.

On this side (`membership.js`, `store5.js`): `fetchEntitlement` keeps the flag in
the verified cache; `cachedPractitioner()` applies the same four conditions as
`cachedPremium()` (signed in, verified read, within `OFFLINE_GRACE_MS`, period
not lapsed); `state.practitioner` follows every server answer both ways and
`studioOpen` is closed when it goes false. A hand-written flag opens nothing
(`practitioner-entitlement.test.jsx`). Settings → Membership shows
"Practitioner licence · active" for a licensed account, with no Gumroad line.

## 3. Routine format v2 in the link

`routineToLink` writes `{ p:'ppwr', v:2, n, a?, g?, rv?, i }`:

| key | meaning | bound |
|---|---|---|
| `a` | author (the practitioner's name) | 80 chars |
| `g` | what it addresses (the issue) | 120 chars |
| `rv` | the routine's version, a short string ("2", "2026-11") | 24 chars |

The item shape is unchanged (`t m u b k h r d`): videos travel as a URL in `u`,
and the embed is derived on arrival through `safeUrl` as before.
`parseRoutineLink` reads v1 (no `v`, or `v:1`) and v2 alike, reports `wire`,
and returns `author`/`goal`/`version` (`null` for v1); unknown top-level keys
from a later version are not read, so those links still open. The saved routine
keeps the three fields (`createRoutine(name, items, meta)`, `routineMeta`); the
receive sheet prints "From <author> · version N" and "For <issue>"; the
.md file rail is unchanged. Tests: `routine-link-v2.test.js`.

## 4. The Studio

`screens/StudioSheet.jsx` (z38), opened from Library → Routines → "Studio ·
send a routine to a client", a button only a practitioner sees; `openStudio()`
refuses anyone else and the sheet renders nothing unless `practitioner` is
true. Inside: the practitioner's name (kept on this device, `ppw5.studio`), a
routine picker, "What it addresses", "Version" with +1, **Copy link** (a v2
link), **Show QR code** (`uqr` 0.1.3, an inline SVG on a white ground; refused
above `QR_MAX_CHARS` = 2,900 characters, never truncated) and **Print card**
(a plain black-on-white page in a window of its own with the QR, the link, the
steps and the list of items). No price anywhere; the footer says the app is free
for the client and what they are charged is between them and the practitioner.
Tests: `studio.test.jsx`.

## Re-run the proofs

```
npx vitest run
npm run build
```

Evidence of the real-browser gate for this branch lives in the vault under
`06-Roadmap/_handoff/test-evidence-2026-11-03/lifestyle-routine-market/`.
