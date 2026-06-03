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
};

export const APP_VERSION = '0.5.0-dual-theme';
