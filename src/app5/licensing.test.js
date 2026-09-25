import { describe, it, expect } from 'vitest';
import {
  OWNER_ADMIN_EMAILS, isOwnerAdminEmail, licenseMailto, licenseCalendlyUrl,
  PUBLIC_CHECKOUT_ENABLED, PUBLIC_SIGNUP_ENABLED, LICENSE_CONTACT_EMAIL,
} from './licensing.js';

describe('owner admin allow-list', () => {
  it('defaults to the one demo owner', () => {
    expect(OWNER_ADMIN_EMAILS).toContain('victor@ppwellness.co');
    expect(isOwnerAdminEmail('Victor@PPWellness.co')).toBe(true);
    expect(isOwnerAdminEmail('someone@example.com')).toBe(false);
    expect(isOwnerAdminEmail('')).toBe(false);
  });

  it('does not enable public checkout or public sign-up', () => {
    expect(PUBLIC_CHECKOUT_ENABLED).toBe(false);
    expect(PUBLIC_SIGNUP_ENABLED).toBe(false);
  });

  it('the contact path is a mailto to the owner, with no invented meeting URL', () => {
    expect(LICENSE_CONTACT_EMAIL).toBe('victor@ppwellness.co');
    expect(licenseMailto()).toMatch(/^mailto:victor@ppwellness\.co\?/);
    expect(licenseCalendlyUrl()).toBeNull();
  });
});
