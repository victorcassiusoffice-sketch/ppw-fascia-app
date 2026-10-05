// demo.js — the one question "is this load a demo?", and nothing else.
//
// WHAT IT IS FOR. The Lifestyle App is embedded on ppwellness.co as a working
// demo, in an iframe (app.ppwellness.co sends no X-Frame-Options and no CSP
// frame-ancestors, so it frames). A prospect on the marketing page must meet the
// APP — a populated day they can tap around — not the access-code door, not the
// first-run choice, not the wizard, and not the terms tick-box. So the embed
// loads `?demo=1` and that parameter opens a second door beside the code door.
//
// WHERE THE BYPASS LIVES, and why it lives there. Nowhere. It is re-derived from
// the URL on every call, so it is exactly as durable as the page load the URL
// asked for, and no more. Three places it could have lived and did not:
//
//   `ppw5.access` — the grant the real door writes. Using it would hand the
//     visitor's device a licence it was never given: `hasAccess()` would answer
//     true on every later load, the app would believe it was licensed, and the
//     id written down would name no code in the registry. The whole point of a
//     revocable partner code is that nothing else can mint one.
//
//   localStorage, under some other key — the same fault with a different name.
//
//   sessionStorage — subtler and still wrong. It survives reloads AND same-tab
//     navigations for the life of the tab, so a visitor who opened the demo and
//     then typed `app.ppwellness.co` into that same tab would still be inside
//     with no code. That is a lasting grant; it just expires when they close
//     the tab. "That load only" has to mean that load only.
//
// Deriving it from the URL also makes the reload that MATTERS work: an iframe
// reloads to its own `src`, which carries `?demo=1`, so a prospect refreshing
// the marketing page stays in the demo. Drop the parameter and the door is back
// on the very next load, with nothing to clear.
//
// WHAT IT IS NOT. It is not a security boundary, for the same reason the code
// door is not one (see the header of access.js): this is a browser bundle and
// anybody can put `?demo=1` in an address bar. That is fine — the demo shows
// the product, and the product is not a secret. What the demo must never do is
// touch the device it runs on, and that is enforced where the writes are, in
// store5.js and files5.js, not here.

/** The parameter the embed carries. Changing it changes the iframe snippet. */
export const DEMO_PARAM = 'demo';

// `?demo` on its own counts — a web builder who drops the `=1` should get the
// demo rather than the code prompt. `demo=0` and `demo=false` do not, so the
// parameter can be switched off by editing one character.
const MEANS_YES = new Set(['', '1', 'true', 'yes', 'on']);

/**
 * Is THIS page load a demo?
 *
 * Read live, never cached: see the header. Cheap enough to call from a render —
 * it is one URLSearchParams over a string that is a few characters long.
 */
export function isDemo() {
  try {
    const v = new URLSearchParams(window.location.search).get(DEMO_PARAM);
    return v !== null && MEANS_YES.has(String(v).trim().toLowerCase());
  } catch {
    // No window (a non-browser import), or a URL the parser refuses. Fail
    // CLOSED: the app is gated, not demoed.
    return false;
  }
}
