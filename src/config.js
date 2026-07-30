// PPW App runtime config — flip flags here, no rebuild required if served statically.
// Mirror of config.ts (which has the TypeScript surface) but JS-only for the build.

export const PROTOCOLS_JSON_URL =
  'https://raw.githubusercontent.com/ppwellness/ppw-protocols/main/protocols/';

export const USE_MOCK_DATA = true;

export const NOTIFICATION_LEAD_TIME_MIN = 5;

export const LS_KEYS = {
  ACTIVE_PROTOCOLS:    'ppw.activeProtocols',
  ACTIVE_MODULES:      'ppw.activeModules',
  ACTIVE_ROUTINES:     'ppw.activeRoutines',
  COMPLETED_TODAY:     'ppw.completedToday',
  NOTIFICATIONS_OPTIN: 'ppw.notificationsOptIn',
  USE_MOCK_OVERRIDE:   'ppw.useMockOverride',
  DAILY_ORDER:         'ppw.dailyOrder',
  DAILY_TIMES:         'ppw.dailyTimes',
  DAILY_HIDDEN:        'ppw.dailyHidden',
  DAILY_DUPLICATES:    'ppw.dailyDuplicates',
  DAILY_MERGES:        'ppw.dailyMerges',
  DAILY_TITLES:        'ppw.dailyTitles',
  FASTING_PREFS:       'ppw.fastingPrefs',
  USER_STACKS:         'ppw.userStacks',         // Phase 2 (2026-05-23) — user-created stacks per-date
  IF_PREFS:            'ppw.ifPrefs',            // Phase 3 (2026-05-23) — intermittent fasting daily window
  NOTIFICATION_PREFS:  'ppw.notificationPrefs',  // Iter 2 Phase 7 — { enabled, autoplayAll }
  AUTOPLAY_PATTERNS:   'ppw.autoplayPatterns',   // Iter 2 Phase 7.3 — { '<stack-id>__<HH:MM>': true }
  RECURRENCE_RULES:    'ppw.recurrenceRules',       // 2026-06-03 — global list of recurring routine rules
  RECURRENCE_OVERRIDES:'ppw.recurrenceOverrides',   // 2026-06-03 — per-date exceptions, key ::<ISO>
  MIGRATION_FLAG:      'ppw.migration.recurrence.v1',// 2026-06-03 — run-once migration marker
  ENTITLEMENT:         'ppw.entitlement',            // 2026-06-10 — 'pro' unlocks Pro-gated surfaces (Assistant). Absent/anything-else = free.
  ASSISTANT_SYNC:      'ppw.assistantSync',          // 2026-06-11 (D2) — { token, cursor, lastSyncAt, ackQueue } for the Assistant bridge
};

// ─── Wellness Assistant launch (STAGED — do NOT enable until go-live) ───────────
// The Assistant is a SEPARATE paid service (its own Vercel app + Neon DB + Anthropic
// key). This app only ever LINKS OUT to it — it is never merged in (locked arch).
//
// FEATURE_ASSISTANT_LAUNCH is the single master switch. While false, the Coach
// surface (entry tile on Today, /coach page, Settings launch row) does not render
// or mount anywhere, for anyone. Go-live = this one line is true (and ship).
//
// 2026-06-16: flipped ON to surface the live coach. Entitlement is NOT gated here
// on purpose — the Assistant owns the paywall + guest pass, so opening it always
// lands the user on its own sign-in / guest / subscribe flow and a free user can
// never spend tokens (see entitlement.js). To make the entry Pro-only instead,
// gate the entry render on isProMember() — left open per Vic's "coach accessible
// from within the app" goal.
export const FEATURE_ASSISTANT_LAUNCH = false;

// Where the launch button points — the live, separately-deployed Assistant service.
// Also the base URL the D2 sync client (src/lib/assistantSync.js) calls for the
// device-bridge routes (/api/device/exchange, /api/plan/patches, /api/plan/ack).
export const WELLNESS_ASSISTANT_URL = 'https://ppw-wellness-assistant.vercel.app';

// Deep link to the coach chat UI on the Assistant service. The app only ever
// LINKS OUT here (locked arch — never embedded; the Assistant also sets
// X-Frame-Options: DENY so it cannot be iframed). Opening this in a new tab needs
// NO CORS — only the D2 plan-sync fetch() routes need the app origin allow-listed.
export function coachUrl() {
  return `${(WELLNESS_ASSISTANT_URL || '').replace(/\/+$/, '')}/assistant`;
}

export const APP_VERSION = '0.5.0-dual-theme';
