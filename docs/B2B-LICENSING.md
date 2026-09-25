# B2B licensing

The lifestyle app (`https://app.ppwellness.co`) is licensed **per company, for that company’s staff**. It is not sold to the public.

There is no multi-tenant billing engine in this repo. The membership API (`ppw-wellness-assistant`, `WELLNESS_ASSISTANT_URL` / `VITE_PPW_API_BASE`) still decides who has full access. This app only closes the public doors and explains the licence.

## What a visitor can do

- **Look around first** — the first-run walkthrough. No account, no payment. Preview limits still apply (stack cap, saved routines, monetised protocols).
- **Sign in** — existing staff and the owner. Password, or an email link for an account that already exists.
- **Contact** — `victor@ppwellness.co` (mailto on the first-run screen, the account sheet, and the licence notice). A meeting link appears only when `VITE_LICENSE_CALENDLY_URL` is an `https` URL at build time. No Calendly URL was in the repo, so none is invented.

## What a visitor cannot do

- Create an account from the app.
- Open Gumroad, Stripe, or any “Go Premium” / checkout path. `GUMROAD_URL` is `null`. Consumer prices are not shown.

If a magic-link sign-in comes back with `isNewAccount: true` for anyone other than the owner allow-list, the app deletes that account and signs out. Public registration does not finish.

## Staff under a company licence

1. Agree the licence offline (email / invoice). There is no in-app checkout.
2. Create the staff account on the membership API (the same accounts that already sign in). This repo does not provision orgs.
3. Staff open the app → **Sign in** with that email and password (or the email link).
4. Full access is whatever `/api/me/entitlement?app=lifestyle` returns: `role === "admin"` (backend `ADMIN_EMAILS`), or `entitlement` of `paid` or `guest`. The app does not grant this locally.

Existing staff accounts keep the same sign-in. Nothing here rotates passwords or deletes accounts that are not brand-new public sign-ups.

## Owner demo (unlimited, no paywall)

One owner account, for walking a prospective company through the full product.

| | |
|---|---|
| Email | `victor@ppwellness.co` |
| Allow-list | `OWNER_ADMIN_EMAILS` in `src/app5/licensing.js`, defaulting to that address. Override at build time with `VITE_OWNER_ADMIN_EMAILS` (comma-separated). |
| How to sign in | On the first screen, choose **Sign in** (not Look around). Use the owner email and its password. If no password is set yet, use **Email me a sign-in link instead**, then set a password on the account screen. |
| Why it is unlimited | The membership API must list this address in `ADMIN_EMAILS`. That returns `role: "admin"`, and the app treats admin as full access (no stack cap, routines, protocols). The client allow-list only labels the account “Owner demo account”. It does not unlock features from a forged email. |

**Look around first** stays for a frictionless guest walkthrough of the shell. The unlimited demo is the signed-in owner account.

## Backend still required

This pull request does not change the membership API.

- `ADMIN_EMAILS` on that API must include `victor@ppwellness.co` or the owner demo is a normal signed-in account without full access.
- `/api/auth/login` may still create a user row before the app sees `isNewAccount`. The app deletes that row when the callback says the account is new. If the API stops sending `isNewAccount`, a magic link could leave an unused account behind. Closing that for good means the API rejecting unknown emails.
- Old Gumroad subscriptions, if any are still billing, are not cancelled by this app. There is no longer a link to that store.
