# Wire Fascia App premium to Gumroad — brief for App Coder

## Context

The app has no backend and no user accounts (`localStorage`-only PWA). Premium is currently a manual test toggle (`src/lib/entitlement.js`) with two explicit seam points marked in code:
- `src/app5/screens/SettingsScreen.jsx:169`
- `src/app5/screens/UpsellModal.jsx:37-39`

Price shown in-app: **$4.99/month** (`PREM_PRICE` constant, duplicated in both `UpsellModal.jsx:10` and `LibraryScreen.jsx:215`).

A Gumroad membership product has been created (hidden — not on any public profile section, reachable only by direct permalink). Vic will supply the permalink/product URL once created.

## Recommended approach: Gumroad License Keys (no login system needed)

This fits the existing no-backend architecture with zero new infra — do NOT build a login/account system.

1. On the Gumroad product: enable **"Generate a unique license key per sale."**
2. Replace the two seam-point buttons with:
   - A real checkout link → opens the Gumroad product's direct permalink (new tab)
   - A **"Redeem license key"** input field for the user to paste their key after purchase
3. On redemption, call Gumroad's public license verification endpoint:
   `POST https://api.gumroad.com/v2/licenses/verify`
   with the product permalink + the entered key (public endpoint, no auth token needed).
   Store the key in `localStorage` alongside the existing `LS_KEYS.ENTITLEMENT` pattern.
4. **Re-verify periodically** (e.g. on app launch) using the stored key. Gumroad's verify response includes subscription-status fields — confirm exact field names against Gumroad's current API docs at build time (going from general knowledge here, verify before relying on it). A cancelled/ended subscription detected this way should call `setPremium(false)`.
5. Handle offline gracefully: cache last-known-good status, re-check when back online rather than revoking premium on a single failed network call.
6. Remove/hide the "Manual test switch" note and dev-only toggle once real wiring is live (or gate it behind a dev flag).

## Not required
- No backend server
- No login/password system
- No webhook receiver (the periodic re-verify pattern covers cancellation detection without needing Gumroad's server-side webhooks)

---
*Prepared by Priority Guide session, 2026-07-10. Companion ledger row: RG-02 in `06-Roadmap/agentix-os/MASTER-LEDGER.json`.*
