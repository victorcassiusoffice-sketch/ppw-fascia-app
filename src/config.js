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
  FASTING_PREFS:       'ppw.fastingPrefs',
};

export const APP_VERSION = '0.4.0-night-run';
