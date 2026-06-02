# [VIC-SETUP] PPW Push Sender Worker — one-time setup

This is the **one new piece of infra** for closed-app Web Push (P0b). It is
**free** (Cloudflare Workers free tier + KV). The app already ships the
subscribe + service-worker code; this Worker is what actually *sends* the push
every minute. Until it's deployed, the app uses the **calendar `.ics`** path
(P0a) for guaranteed lock-screen reminders, so nothing is blocked.

## What you need
1. A Cloudflare account (free) — https://dash.cloudflare.com/sign-up
2. `npm i -g wrangler` then `wrangler login`

## Steps
```bash
cd worker
npm install            # installs wrangler (devDependency)

# 1. Create the KV namespace, paste the printed id into wrangler.toml (id = "...")
npx wrangler kv namespace create PPW_PUSH

# 2. Set the VAPID secrets. Values are in:
#    C:\Users\Victor\Documents\junk files\ppw-vapid-keys.txt
npx wrangler secret put VAPID_PUBLIC_KEY     # paste the PUBLIC value
npx wrangler secret put VAPID_PRIVATE_KEY    # paste the PRIVATE value
npx wrangler secret put VAPID_SUBJECT        # mailto:info@ppwellness.co

# 3. Deploy
npx wrangler deploy
```
Wrangler prints the Worker URL, e.g. `https://ppw-push-sender.<acct>.workers.dev`.

## Wire the app to the Worker
Set the URL in `src/lib/push-config.js`:
```js
export const PUSH_SYNC_ENDPOINT = 'https://ppw-push-sender.<acct>.workers.dev/subscribe';
```
Then rebuild + push to `main` (GitHub Pages redeploys). After that, "Enable
lock-screen push" in the app stores the subscription on the Worker and the cron
sends reminders at each due slot time — locked phone, app closed.

## Notes
- The VAPID **public** key is already baked into the app (safe). The **private**
  key lives ONLY in the Worker secret — never commit it.
- Payload-less push (the SW shows a generic "Time for your next stack"
  notification). iOS requires a notification be shown on every push; the SW does.
- Cost: $0. Free tier covers minute-cron + this push volume comfortably.
