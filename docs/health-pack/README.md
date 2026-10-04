# PPW Health Pack — supplements, nutrient meters, protocols

Prepared 4 Oct 2026 for the PPWellness Lifestyle App (app.ppwellness.co).

## What's inside

1. **BUILD-PROMPT.md** — the full brief for your builder (6 phases).
2. **ai/intake-prompt-v6.md** — the new "tell your AI anything" prompt, the format it sends back, and the protocol-convert prompt.
3. **data/** — 37 nutrients, 46 other ingredients, 37 conditions, 21 medicine groups, 23 surgery pause rules, 9 standard protocols. All sourced (NIH, EFSA, Cochrane, trials, guidelines).
4. **review/** — for you: `EVIDENCE-TABLE.md` (every meter in plain words) and `CATALOG-REVIEW.md` (your 10 iHerb products).
5. **reference/** — the protocol file format and a working parser.

## Use it in 3 steps

1. Read `review/CATALOG-REVIEW.md` (2 minutes). Four products go over a safe daily maximum.
2. Give your builder this folder and paste the prompt below.
3. Check its report after each phase. Nothing goes live without your yes.

## Prompt to paste into the builder

```
You're building the next feature of the PPWellness Lifestyle App (repo ppw-fascia-app).
The brief and data are in the health-pack folder I'm giving you.
1. Copy the folder into the repo at docs/health-pack/.
2. Read docs/health-pack/BUILD-PROMPT.md in full before writing any code.
3. Work on a new branch: feat/health-meters-2026-10. Start with Phase 1.
4. Use only the numbers in docs/health-pack/data/. Never invent a dose or limit.
5. After each phase: push, then report in 3 plain lines with phone-size screenshots.
Do not merge to main or deploy without my explicit yes.
```

## Before you offer it to companies

- The app keeps health data on the person's phone only. Keep it that way.
- If you ever want an employer view or to store health data on a server, get a data-protection check first (Mauritius Data Protection Act 2017; UK/EU GDPR for UK/EU staff). Health data needs explicit consent.
- Keep the wording "organise and inform". The app doesn't diagnose or prescribe.

## Your own protocols

Your protocol agent can output the `ppw-protocol` block (see `reference/protocol-md-format.md`), so its protocols import straight into the app.
