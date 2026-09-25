// The only path a visitor has to full access: a company licence, arranged
// offline. No price, no store, no "create account".

import React from 'react';
import { LICENSE_CONTACT_EMAIL, licenseMailto, licenseCalendlyUrl } from '../licensing.js';

const linkBtn = {
  marginTop: 12, width: '100%', minHeight: 50, borderRadius: 16,
  border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)',
  fontWeight: 700, fontSize: 15, boxShadow: 'var(--acc-glow)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
  textAlign: 'center', padding: '10px 14px',
};

export default function LicenseNotice({
  heading = 'Licensed organizations only',
  detail = 'Peak Performance Wellness licenses this app per company, for that company’s staff. There is no public sign-up and nothing to buy in the app.',
}) {
  const calendly = licenseCalendlyUrl();
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{heading}</div>
      <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)' }}>{detail}</p>
      <a href={licenseMailto()} style={linkBtn}>Email {LICENSE_CONTACT_EMAIL}</a>
      {calendly && (
        <a href={calendly} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn, marginTop: 8, background: 'var(--disc)', color: 'var(--ink)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
          Book a meeting
        </a>
      )}
      <p style={{ margin: '10px 0 0', fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
        Licences are arranged by invoice. Staff then sign in with the account their organisation was given.
      </p>
    </div>
  );
}
