// licensing.js — the B2B gate for the lifestyle app.
//
// The product is licensed per company, for that company's staff. There is no
// public checkout and no public sign-up. This module is the single place those
// rules are named. It imports nothing from membership.js (membership imports
// this), so it cannot grant access by itself.
//
// Full access still comes from the membership API:
//   role === "admin"  (backend ADMIN_EMAILS — staff / owner)
//   entitlement === "paid" | "guest"
// The owner allow-list here only IDENTIFIES the demo account. It does not
// unlock features from a typed-in email. A visitor who edits localStorage
// cannot become the owner.

/** Who companies email to arrange a licence and an invoice. */
export const LICENSE_CONTACT_EMAIL = 'victor@ppwellness.co';

/**
 * The one unlimited owner/admin used for sales demos.
 * Override at build time with VITE_OWNER_ADMIN_EMAILS (comma-separated).
 * The default is the founder address. Do not add customer emails here —
 * their access is an account on the membership API, under their company.
 */
function ownerEmailsFromEnv() {
  let raw = '';
  try {
    raw = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OWNER_ADMIN_EMAILS) || '';
  } catch { raw = ''; }
  return String(raw)
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

const configuredOwners = ownerEmailsFromEnv();
export const OWNER_ADMIN_EMAILS = configuredOwners.length
  ? configuredOwners
  : ['victor@ppwellness.co'];

export function isOwnerAdminEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  return !!clean && OWNER_ADMIN_EMAILS.includes(clean);
}

/** Public self-serve pay is off. The UI must not build a checkout link. */
export const PUBLIC_CHECKOUT_ENABLED = false;

/** Public self-serve registration is off. New people are licensed, not signed up. */
export const PUBLIC_SIGNUP_ENABLED = false;

export const LICENSE_ONLY_MESSAGE =
  'Licensed organizations only. This app is not open for public sign-up. Contact Peak Performance Wellness at victor@ppwellness.co to arrange a company licence for your staff.';

export function licenseMailto() {
  const subject = encodeURIComponent('Company licence — Peak Performance Wellness');
  const body = encodeURIComponent(
    'Hello,\n\nWe would like to license the Peak Performance Wellness lifestyle app for our staff.\n\nCompany:\nApproximate number of staff:\n\n'
  );
  return `mailto:${LICENSE_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

/**
 * Optional meeting link. Nothing in the repo shipped a Calendly URL, so this
 * stays empty unless VITE_LICENSE_CALENDLY_URL is an https URL at build time.
 * A non-https value is ignored — the app must not open an arbitrary scheme.
 */
export function licenseCalendlyUrl() {
  let raw = '';
  try {
    raw = String(
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_LICENSE_CALENDLY_URL) || ''
    ).trim();
  } catch { return null; }
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}
