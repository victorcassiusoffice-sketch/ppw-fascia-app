// P0b (2026-06-02) — Web Push public config.
//
// The VAPID PUBLIC key is the `applicationServerKey` handed to
// PushManager.subscribe(). It is designed to be public — safe to commit and
// ship in the bundle. The matching PRIVATE key lives ONLY in the Cloudflare
// Worker (see junk files\ppw-vapid-keys.txt and the [VIC-SETUP] doc); never
// embed the private key here.

export const VAPID_PUBLIC_KEY =
  'BCWUvxS1kdvuTwDAbJ_56OKz4HPbMTGAR95YTxMzVlLTpZX1TEt3gTGclPJQGP-cODJuTF5a4oy7MaTnKxdAbaw';

// Where the app POSTs the push subscription + a user's due slot times.
// [VIC-SETUP] — set this to the deployed Cloudflare Worker URL once it exists.
// While empty, the app stores the subscription locally and the subscribe flow
// reports that the sender is not yet live (no false "you'll be reminded").
export const PUSH_SYNC_ENDPOINT = '';
