# Fascia App Premium — professional auto-unlock via backend (approach A)

> **Decision 2026-07-10 (Vic): approach A — the proper way.** NOT the license-key-paste stopgap. Pay on Gumroad → account auto-upgrades to premium; cancel → auto-downgrades; cross-device; nothing to paste. This supersedes the earlier license-key version of this brief.

## The foundation already exists

The `ppw-wellness-assistant` repo already contains the professional backend this needs — do NOT build accounts/billing from scratch:
- `api/_lib/auth.ts` — real user accounts + entitlement field on `users`
- `api/_lib/billing.ts` — **provider-agnostic** billing core. `applySubscription()` is the single place that flips `users.entitlement` between `paid`/`expired` from a normalised payment event. Idempotent, webhook-driven. Already has PayPal + Lemon Squeezy adapters (`billing-paypal.ts`, `billing-lemonsqueezy.ts`).
- `api/_lib/db.ts` + `schema.sql` — Neon Postgres, `users` + `subscriptions` tables
- Decision on record: **App + Assistant = one app** (2026-06-24). This backend is the app's backend.

## The build (App Coder / backend session)

1. **Add a Gumroad adapter** — `api/_lib/billing-gumroad.ts`, modelled on `billing-paypal.ts`/`billing-lemonsqueezy.ts`. It receives Gumroad's webhook (Gumroad "Ping" / resource-subscription events), normalises to the `Canon` type (`active`/`canceled`/`expired`), and calls `applySubscription()`. **Confirm exact Gumroad subscription webhook event names + payload at build time** (sale, subscription_ended, subscription_updated, cancellation, refund — verify against Gumroad's current docs; do not assume). Route it through `api/router.ts`.
   - Note: the existing PayPal + Lemon Squeezy rails are effectively dead for PPW (LS denied, PayPal limited) — Gumroad is the live rail, so this adapter is the one that matters.
2. **Connect the Fascia App to the backend for auth + entitlement.** The app is currently a localStorage-only PWA (`src/lib/entitlement.js` reads a local flag). Replace the local `isProMember()` source with a server-read of the logged-in user's `entitlement` (via the assistant backend's auth/session), keeping `isProMember()` as the single seam so nothing else in the app changes. Since App + Assistant are one app, the app gains the assistant's login.
3. **Wire the two premium seam points** (`SettingsScreen.jsx:169`, `UpsellModal.jsx:37-39`): the "Enable Premium" button becomes a real Gumroad checkout link (opens the hidden membership product's permalink — Vic supplies it). On return, the app just reads server entitlement — the webhook will have flipped it. No key-pasting.
4. **Update the in-app price.** `PREM_PRICE` is `'$4.99'` in both `UpsellModal.jsx:10` and `LibraryScreen.jsx:215`. Change to `'$9.99'` (the new monthly tier). If 6-month/yearly are shown, use totals $47.94 / $59.88, not per-month rates.
5. Remove/hide the manual test toggle (or gate behind a dev flag) once server entitlement is live.

## Gumroad product (Vic — mostly done)

Membership product "PPWellness App — Premium Service" created, hidden (not on any profile section). Pricing: **$9.99/mo · $47.94/6mo · $59.88/yr**. Keep it a DRAFT (don't Publish) until the webhook + backend are live. License-key generation is NOT needed for approach A (webhook does the unlock, not a pasted key).

## Vic gates — infra provisioning (the real blocker for approach A)

Approach A only works once the assistant backend is actually deployed. Full runbook: `ppw-wellness-assistant/docs/P0-PROVISIONING.md`. The Vic-only account/key steps:
- **Neon Postgres** — create a free EU project, copy the pooled `DATABASE_URL`
- **Secrets** — generate `JWT_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `OWNER_SETUP_TOKEN` (commands in the runbook)
- **Vercel** — link/create a separate Hobby project, set env vars (token already in `junk files`)
- **Anthropic API key** — only needed for the Assistant *coach* feature; the **payment gateway does not need it**, so it can be deferred if the immediate goal is just premium auto-unlock. Set with a hard spend cap when the coach goes live.
- **Gumroad webhook URL** — once the backend has a live URL, set Gumroad's Ping/webhook to point at the Gumroad adapter's endpoint.

## Sequence
Provision backend infra (Vic, P0 runbook) → deploy assistant backend → add Gumroad adapter + webhook (build) → connect app auth/entitlement (build) → point Gumroad webhook at the live endpoint (Vic) → test a real purchase flips premium → publish the Gumroad product.

## Build discipline (binding)
- Branch-only, no deploy to production without Vic GATE-2. $0 net-new cost (free tiers only).
- Verify-before-claim: confirm Gumroad's actual webhook events + payload against live docs; confirm entitlement flips end-to-end with a real test purchase before calling it done.
- Split gates: GATE-1 = build + tests + render-verify green on a branch; GATE-2 = Vic ships + a real purchase flips premium live.

---
*Prepared by Priority Guide session, 2026-07-10. Companion ledger row: RG-02 in `06-Roadmap/agentix-os/MASTER-LEDGER.json`. Approach A chosen by Vic 2026-07-10.*
