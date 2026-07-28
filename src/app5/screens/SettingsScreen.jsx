// SettingsScreen — New Design Settings (focused port).
//
// Ported now: Appearance → Theme (soft colourway swatches, incl. "Glass" → scene
// picker) and Membership → Premium toggle. These showcase the theme engine and
// give Vic the premium switch inside the New Design. Deferred to later passes:
// glass-skin intensity, tactile, easy-read/text-size, notifications, IF, terms.

import React from 'react';
import { SOFT, BGS, bgUrl } from '../theme5.js';
import { useStore5, setTheme, setState, openTerms, setSounds, setReminders, setAutoplay, setA11y } from '../store5.js';
import MembershipCard from './MembershipCard.jsx';

// glass pill toggle (the prototype's 60×34 switch)
function Switch({ on, onTap, label }) {
  return (
    <button onClick={onTap} aria-label={label} role="switch" aria-checked={on} style={{ position: 'relative', width: 60, height: 34, flex: 'none', borderRadius: 999, border: `1px solid ${on ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: on ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', transition: 'background .3s' }}>
      <span style={{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 999, background: 'var(--thumb)', border: '1px solid var(--rim)', boxShadow: '0 3px 8px rgba(40,50,70,.25)', transform: `translateX(${on ? 26 : 0}px)`, transition: 'transform .38s cubic-bezier(.3,1.3,.4,1)' }} />
    </button>
  );
}
const ROW = { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', minHeight: 60, gap: 12 };
const DIV = <div style={{ height: 1, background: 'var(--hairline)', margin: '0 18px' }} />;

const SOFT_ORDER = ['graphite', 'silver', 'ivory', 'black', 'gloft', 'indigo', 'crimson', 'gel'];
const BG_ORDER = Object.keys(BGS);
// small gliding two/three-way segment used for Glass style + Text ink
function Seg({ options, value, onPick }) {
  return (
    <div style={{ position: 'relative', height: 38, flex: 1, maxWidth: 190, borderRadius: 12, background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', display: 'flex' }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onPick(v)} style={{ position: 'relative', flex: 1, margin: 3, borderRadius: 9, border: value === v ? '1px solid var(--acc-rim)' : 'none', background: value === v ? 'var(--acc-surf)' : 'none', fontSize: 11.5, fontWeight: 600, color: value === v ? 'var(--acc-ink)' : 'var(--dim)', transition: 'all .25s' }}>{label}</button>
      ))}
    </div>
  );
}

function Eyebrow({ children }) {
  return <div style={{ marginTop: 26, fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>{children}</div>;
}

export default function SettingsScreen() {
  const S = useStore5();
  const isGel = S.soft === 'gel';

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '28px 20px 140px', animation: 'ppwScreenIn .38s cubic-bezier(.26,1,.4,1)' }}>
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
              <div style={{ fontSize: 15, fontWeight: 500, textShadow: 'var(--emboss)' }}>Background</div>
              {/* Vic 2026-07-06: his own uploaded photo set (prototype scenes removed). */}
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 12, padding: '2px 2px 10px', WebkitOverflowScrolling: 'touch' }}>
                {BG_ORDER.map((key) => {
                  const active = S.gelBg === key;
                  return (
                    <button key={key} onClick={() => setTheme({ gelBg: key })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, flex: 'none' }}>
                      <span style={{ width: 42, height: 66, borderRadius: 14, background: `#20242B url("${bgUrl(key)}") center/cover no-repeat`, border: `2px solid ${active ? 'var(--accent)' : 'var(--rim)'}`, boxShadow: '3px 3px 8px rgba(0,0,0,.2)' }} />
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--dim)' }}>{BGS[key]}</span>
                    </button>
                  );
                })}
                {/* own photo (kept on this device for the session) */}
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 'none', cursor: 'pointer' }}>
                  <span style={{ width: 42, height: 66, borderRadius: 14, border: `2px dashed ${S.gelBg === 'custom' ? 'var(--accent)' : 'var(--hairline)'}`, background: S.gelBg === 'custom' && S.customBgUrl ? `url("${S.customBgUrl}") center/cover` : 'var(--track)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)' }}>
                    {!(S.gelBg === 'custom' && S.customBgUrl) && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: S.gelBg === 'custom' ? 'var(--accent)' : 'var(--dim)' }}>Photo</span>
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) setState({ customBgUrl: URL.createObjectURL(f), gelBg: 'custom' }); }} style={{ display: 'none' }} />
                </label>
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, flex: 'none' }}>Glass</div>
                <Seg options={[['frosted', 'Frosted'], ['clear', 'Clear']]} value={S.glassStyle} onPick={(v) => setTheme({ glassStyle: v })} />
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, flex: 'none' }}>Text</div>
                <Seg options={[['light', 'Light'], ['dark', 'Dark']]} value={S.inkMode} onPick={(v) => setTheme({ inkMode: v })} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Vision — easy read + text size (a11y, wired to setA11y) */}
      <Eyebrow>Vision</Eyebrow>
      <div style={{ marginTop: 12, borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', overflow: 'hidden' }}>
        <div style={ROW}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Easy read</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>Bolder, brighter text everywhere</div>
          </div>
          <Switch on={S.a11y.on} onTap={() => setA11y({ on: !S.a11y.on })} label="Toggle easy read" />
        </div>
        {DIV}
        <div style={ROW}>
          <div style={{ fontSize: 15, fontWeight: 500, flex: 'none' }}>Text size</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setA11y({ zoom: (S.a11y.zoom || 1) - 0.05 })} aria-label="Smaller text" style={{ width: 46, height: 46, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A−</button>
            <div style={{ fontSize: 15, fontWeight: 700, minWidth: 52, textAlign: 'center', textShadow: 'var(--emboss)' }}>{Math.round((S.a11y.zoom || 1) * 100)}%</div>
            <button onClick={() => setA11y({ zoom: (S.a11y.zoom || 1) + 0.05 })} aria-label="Bigger text" style={{ width: 46, height: 46, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A+</button>
          </div>
        </div>
      </div>

      {/* General — sounds / reminders / autoplay (wired to the slot engine) */}
      <Eyebrow>General</Eyebrow>
      <div style={{ marginTop: 12, borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', overflow: 'hidden' }}>
        <div style={ROW}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Sounds</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>Soft ASMR taps on every action</div>
          </div>
          <Switch on={S.sounds} onTap={() => setSounds(!S.sounds)} label="Toggle sounds" />
        </div>
        {DIV}
        <div style={ROW}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Reminders</div>
          <Switch on={S.reminders} onTap={() => setReminders(!S.reminders)} label="Toggle reminders" />
        </div>
        {DIV}
        <div style={ROW}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Autoplay media</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>Videos start on their own at slot time</div>
          </div>
          <Switch on={S.autoplay} onTap={() => setAutoplay(!S.autoplay)} label="Toggle autoplay" />
        </div>
      </div>

      {/* Membership — real accounts + server-verified Premium (2026-07-28).
          The manual toggle that used to live here unlocked every paid feature in
          one tap, on any device. It is gone: Premium now comes from the backend. */}
      <Eyebrow>Membership</Eyebrow>
      <MembershipCard />

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
