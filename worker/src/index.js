// PPW Fascia App — Web Push sender Worker. [VIC-SETUP] — NOT YET DEPLOYED.
//
// Free Cloudflare Worker with a Cron Trigger (1-minute granularity on the free
// tier). Every minute it finds subscriptions whose due slot times match "now"
// in the subscriber's timezone and sends a payload-less Web Push (a "tickle").
// The app's service worker (public/sw.js `push` handler) then shows the
// notification — this keeps the Worker simple (VAPID JWT auth only, no
// aes128gcm payload encryption needed).
//
// Storage: Cloudflare KV namespace `PPW_PUSH` — one entry per subscription,
// keyed by endpoint hash, value = { subscription, dueTimes:["HH:MM",...], tz }.
//
// Endpoints:
//   POST /subscribe   body: { subscription, dueTimes, tz }  -> stores/updates
//   POST /unsubscribe body: { endpoint }                    -> deletes
//   (cron)            scans KV, sends due pushes
//
// Secrets (wrangler secret put):
//   VAPID_PRIVATE_KEY  base64url 32-byte EC private d  (junk files\ppw-vapid-keys.txt)
//   VAPID_PUBLIC_KEY   base64url 65-byte uncompressed point
//   VAPID_SUBJECT      e.g. mailto:info@ppwellness.co

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Import the raw VAPID EC keys as a CryptoKey for ES256 signing.
async function importVapidKey(env) {
  const d = bytesToB64url(b64urlToBytes(env.VAPID_PRIVATE_KEY));
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY); // 65 bytes: 0x04 || X(32) || Y(32)
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  const jwk = { kty: 'EC', crv: 'P-256', d, x, y, ext: true, key_ops: ['sign'] };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

// Build a signed VAPID JWT for the given push endpoint origin.
async function vapidAuthHeader(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = { aud, exp, sub: env.VAPID_SUBJECT || 'mailto:info@ppwellness.co' };
  const enc = (o) => bytesToB64url(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const key = await importVapidKey(env);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`;
  return { Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}` };
}

async function sendPush(env, subscription) {
  const headers = await vapidAuthHeader(env, subscription.endpoint);
  headers['TTL'] = '120';
  // Payload-less push: SW shows a default notification.
  const res = await fetch(subscription.endpoint, { method: 'POST', headers });
  return res.status; // 201 ok; 404/410 = gone (delete)
}

function nowHHMM(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || 'UTC',
    }).formatToParts(new Date());
    const h = parts.find((p) => p.type === 'hour').value;
    const m = parts.find((p) => p.type === 'minute').value;
    return `${h}:${m}`;
  } catch (_) {
    return new Date().toISOString().slice(11, 16);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/subscribe') {
      const body = await request.json().catch(() => null);
      if (!body || !body.subscription || !body.subscription.endpoint) {
        return new Response('bad request', { status: 400, headers: CORS });
      }
      const key = 'sub:' + (await sha256Hex(body.subscription.endpoint));
      await env.PPW_PUSH.put(key, JSON.stringify({
        subscription: body.subscription,
        dueTimes: Array.isArray(body.dueTimes) ? body.dueTimes : [],
        tz: body.tz || 'UTC',
      }));
      return new Response('ok', { headers: CORS });
    }

    if (request.method === 'POST' && url.pathname === '/unsubscribe') {
      const body = await request.json().catch(() => null);
      if (body && body.endpoint) {
        await env.PPW_PUSH.delete('sub:' + (await sha256Hex(body.endpoint)));
      }
      return new Response('ok', { headers: CORS });
    }

    return new Response('PPW push worker', { headers: CORS });
  },

  // Cron Trigger — runs every minute (see wrangler.toml).
  async scheduled(event, env, ctx) {
    const list = await env.PPW_PUSH.list({ prefix: 'sub:' });
    const jobs = [];
    for (const k of list.keys) {
      const raw = await env.PPW_PUSH.get(k.name);
      if (!raw) continue;
      const rec = JSON.parse(raw);
      const hhmm = nowHHMM(rec.tz);
      if ((rec.dueTimes || []).includes(hhmm)) {
        jobs.push(
          sendPush(env, rec.subscription).then(async (status) => {
            if (status === 404 || status === 410) await env.PPW_PUSH.delete(k.name);
          }).catch(() => {})
        );
      }
    }
    ctx.waitUntil(Promise.all(jobs));
  },
};
