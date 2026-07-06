// SettingsScreen — New Design Settings (focused port).
//
// Ported now: Appearance → Theme (soft colourway swatches, incl. "Glass" → scene
// picker) and Membership → Premium toggle. These showcase the theme engine and
// give Vic the premium switch inside the New Design. Deferred to later passes:
// glass-skin intensity, tactile, easy-read/text-size, notifications, IF, terms.

import React from 'react';
import { SOFT, GLASS } from '../theme5.js';
import { useStore5, setTheme, setPremium, openTerms } from '../store5.js';

const SOFT_ORDER = ['graphite', 'silver', 'ivory', 'black', 'gloft', 'indigo', 'gel'];
const GLASS_ORDER = Object.keys(GLASS);

function Eyebrow({ children }) {
  return <div style={{ marginTop: 26, fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>{children}</div>;
}

export default function SettingsScreen() {
  const S = useStore5();
  const isGel = S.soft === 'gel';

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '28px 20px 140px', animation: 'ppwRise .5s cubic-bezier(.26,1,.4,1)' }}>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>Settings</h1>

      <Eyebrow>Appearance</Eyebrow>
      <div style={{ marginTop: 12, borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 15, fontWeight: 500, textShadow: 'var(--emboss)' }}>Theme</div>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '12px 8px' }}>
            {SOFT_ORDER.map((key) => {
              const c = SOFT[key];
              const active = S.soft === key;
              return (
                <button key={key} onClick={() => setTheme({ skin: 'soft', soft: key })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, minWidth: 52 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 999, background: c.base, border: `2px solid ${active ? 'var(--accent)' : (c.rim || 'transparent')}`, boxShadow: `3px 3px 8px ${c.dark || 'rgba(0,0,0,.3)'}, -3px -3px 8px rgba(255,255,255,.9)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, background: c.accent }} />
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--dim)' }}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isGel && (
          <>
            <div style={{ height: 1, background: 'var(--hairline)', margin: '0 18px' }} />
            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 15, fontWeight: 500, textShadow: 'var(--emboss)' }}>Glass Theme</div>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 12, padding: '2px 2px 10px', WebkitOverflowScrolling: 'touch' }}>
                {GLASS_ORDER.map((key) => {
                  const g = GLASS[key];
                  const active = S.gelBg === key;
                  // swatch: use the scene's base colour (image thumb loads later once assets are copied)
                  const base = (g.ground || '').split(' url(')[0] || '#C9CDD3';
                  return (
                    <button key={key} onClick={() => setTheme({ gelBg: key })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, flex: 'none' }}>
                      <span style={{ width: 42, height: 66, borderRadius: 14, background: base, border: `2px solid ${active ? 'var(--accent)' : 'var(--rim)'}`, boxShadow: '3px 3px 8px rgba(0,0,0,.2), -3px -3px 8px rgba(255,255,255,.35)' }} />
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--dim)' }}>{g.name}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--dim)' }}>Scene photos load once the background assets are added to the build — the glass tuning per scene is live now.</div>
            </div>
          </>
        )}
      </div>

      {/* Membership — Premium toggle (New Design's own flag; wired to store5.setPremium) */}
      <Eyebrow>Membership</Eyebrow>
      <div style={{ position: 'relative', marginTop: 12, borderRadius: 24, overflow: 'hidden', padding: 18, background: S.premium ? 'var(--acc-surf)' : 'var(--surface)', border: `1px solid ${S.premium ? 'var(--acc-rim)' : 'var(--rim)'}`, boxShadow: 'var(--elev)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.2)', border: `1px solid ${S.premium ? 'var(--acc-rim)' : 'var(--rim)'}`, color: S.premium ? 'var(--acc-ink)' : 'var(--ink)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8L3 8z" /></svg>
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: S.premium ? 'var(--acc-ink)' : 'var(--ink)', textShadow: 'var(--emboss)' }}>Premium{S.premium ? ' · active' : ''}</div>
              <div style={{ marginTop: 2, fontSize: 12.5, color: S.premium ? 'rgba(255,255,255,.82)' : 'var(--dim)' }}>Routines, unlimited stacks, always-on Assistant</div>
            </div>
          </div>
          <button onClick={() => setPremium(!S.premium)} aria-label="Toggle premium" style={{ position: 'relative', width: 60, height: 34, flex: 'none', borderRadius: 999, border: `1px solid ${S.premium ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: S.premium ? 'rgba(255,255,255,.32)' : 'var(--track)', boxShadow: 'var(--inset)' }}>
            <span style={{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 999, background: 'var(--thumb)', border: '1px solid var(--rim)', boxShadow: '0 3px 8px rgba(40,50,70,.25)', transform: `translateX(${S.premium ? 26 : 0}px)`, transition: 'transform .38s cubic-bezier(.3,1.3,.4,1)' }} />
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.5, color: S.premium ? 'rgba(255,255,255,.82)' : 'var(--dim)' }}>Manual test switch — no payment gateway wired yet. In code this is one <code>premium</code> flag (ppw5.premium), ready to wire to Gumroad checkout without touching anything else.</div>
      </div>

      {/* About */}
      <Eyebrow>About</Eyebrow>
      <div style={{ marginTop: 12, borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', overflow: 'hidden' }}>
        <button onClick={openTerms} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', minHeight: 60, background: 'none', border: 'none', color: 'var(--ink)', textAlign: 'left' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Terms &amp; Health Disclaimer</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>What this app is, and how to use it safely</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--dim)', flex: 'none' }}><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  );
}
