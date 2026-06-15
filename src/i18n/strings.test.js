// Guards for the minimal i18n strings layer (2026-06-16, words → icons pass).
import { describe, it, expect, afterEach } from 'vitest';
import { t, setLocale, getLocale, DEFAULT_LOCALE } from './strings.js';

describe('i18n strings layer', () => {
  afterEach(() => setLocale(DEFAULT_LOCALE));

  it('resolves a known key for the default locale', () => {
    expect(t('apps.spotify')).toBe('Spotify');
    expect(t('theme.auto')).toBe('Auto');
  });

  it('interpolates {name} vars', () => {
    expect(t('apps.attachLink', { app: 'YouTube' })).toBe('Attach a YouTube link to this stack');
    expect(t('protocol.addAllToCart', { n: 4 })).toBe('Add all 4 to iHerb cart');
  });

  it('falls back to the key itself for an unknown id (never blank)', () => {
    expect(t('nope.missing')).toBe('nope.missing');
  });

  it('setLocale ignores an unloaded locale and keeps the current one', () => {
    expect(setLocale('xx')).toBe(DEFAULT_LOCALE);
    expect(getLocale()).toBe(DEFAULT_LOCALE);
    // The English string still resolves (graceful degrade until locales are added).
    expect(t('apps.youtube')).toBe('YouTube');
  });
});
