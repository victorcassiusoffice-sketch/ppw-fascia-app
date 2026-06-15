// ─── Minimal i18n strings layer (2026-06-16) ───────────────────────────────
//
// WHY THIS EXISTS — flag for the team:
// The app is going MULTILINGUAL. There is NO full i18n framework wired yet
// (no i18next / react-intl, no locale routing, no number/date locale plumbing
// beyond the browser's own toLocaleDateString). This file is the SINGLE
// translation-ready strings module: every UI label that an icon-only / converted
// control depends on lives here keyed by a stable id, so when a real i18n layer
// lands the strings move WITH it instead of being hunted out of JSX.
//
// SCOPE TODAY: this module backs the controls touched in the 2026-06-16
// "words → icons (multilingual)" pass — the icon-only Apps selector, the iHerb
// cart actions, and the theme "Auto" chip. The rest of the app's copy
// (nav labels, segment labels, primary CTAs, body text) is NOT migrated yet —
// see REPORT/handoff. Migrating it is a mechanical follow-up: add keys here,
// swap the literal for t('key'). Keep ALL new user-facing strings in this file.
//
// USAGE:
//   import { t } from '../i18n/strings.js';
//   t('apps.spotify')                       → "Spotify"
//   t('apps.attachLink', { app: 'YouTube' }) → "Attach a YouTube link to this stack"
//
// Interpolation is a simple {name} replace — no plural rules yet (add when a
// real i18n lib lands). Unknown keys fall back to the key itself so a missing
// translation is visible, never a blank.

export const DEFAULT_LOCALE = 'en';

export const STRINGS = {
  en: {
    // Add-Stack → Apps selector (icon-only controls; these back aria-label + title)
    'apps.heading': 'Apps',
    'apps.youtube': 'YouTube',
    'apps.spotify': 'Spotify',
    'apps.custom': 'Custom',
    'apps.attachLink': 'Attach a {app} link to this stack',

    // Protocols → iHerb affiliate actions (icon + label)
    'protocol.addAllToCart': 'Add all {n} to iHerb cart',
    'protocol.buyOnIherb': 'Buy on iHerb',

    // Settings → Appearance, theme "Auto/System" chip (icon + label)
    'theme.auto': 'Auto',
    'theme.autoHint': 'Follow the device theme',
  },
};

let currentLocale = DEFAULT_LOCALE;

/** Set the active locale. No-op (keeps current) if the locale isn't loaded. */
export function setLocale(locale) {
  if (STRINGS[locale]) currentLocale = locale;
  return currentLocale;
}

export function getLocale() {
  return currentLocale;
}

/**
 * Resolve a string by key for the active locale, with {name} interpolation.
 * Falls back to the English string, then to the key itself, so nothing is ever
 * blank and missing translations are obvious.
 */
export function t(key, vars) {
  const table = STRINGS[currentLocale] || STRINGS[DEFAULT_LOCALE];
  let str = (table && table[key]) != null ? table[key] : STRINGS[DEFAULT_LOCALE][key];
  if (str == null) str = key;
  if (vars) {
    for (const name in vars) {
      str = str.replace(new RegExp('\\{' + name + '\\}', 'g'), String(vars[name]));
    }
  }
  return str;
}
