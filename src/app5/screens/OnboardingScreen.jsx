// OnboardingScreen — first run, rebuilt 2026-07-28 (Vic 2c/2d).
//
// WAS: a 6-step wizard collecting lifestyle chips, anchors, interests, 1-10
// level sliders, body goals, discreet mode, fasting windows, modules and
// reminders — before the user had seen a single screen of the app.
//
// NOW: 3 screens. Explain what a Stack IS, offer the free "plan it with your own
// AI" path, keep the legally-required terms gate, and get out of the way. The
// rest is taught in place by the coach marks, and every setting that was cut
// still lives in Settings.
//
// Nothing collected here is lost: the store keeps its defaults for the cut prefs
// (obLifestyle/obBody/obInterests/dayT/fasting/modules), so any feature reading
// them behaves exactly as before — the user just isn't interrogated up front.

import React from 'react';
import { useStore5, setState, finishOnboarding, openTerms, openAiBridge } from '../store5.js';

const STEPS = 3;

const H1 = { margin: '18px 0 0', fontSize: 27, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' };
const SUB = { margin: '10px 0 0', fontSize: 15, lineHeight: 1.6, color: 'var(--dim)' };
const CARD = { border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)' };

// a miniature, non-interactive stack card — shows rather than tells
function DemoCard({ time, title, meta, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, ...CARD, borderColor: accent ? 'var(--acc-rim)' : 'var(--rim)' }}>
      <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 999, background: accent ? 'var(--acc-surf)' : 'var(--disc)', border: `1px solid ${accent ? 'var(--acc-rim)' : 'var(--rim)'}`, color: accent ? 'var(--acc-ink)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3s6 6.3 6 10.3a6 6 0 0 1-12 0C6 9.3 12 3 12 3z" /></svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, textShadow: 'var(--emboss)' }}>{title}</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: 'var(--dim)' }}>{meta}</span>
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)', flex: 'none' }}>{time}</span>
    </div>
  );
}

export default function OnboardingScreen() {
  const S = useStore5();
  if (S.onboarded) return null;

  const step = S.obStep || 0;
  const setStep = (n) => setState({ obStep: n });
  const canNext = step !== 2 || S.termsOk;   // terms gate stays on the final screen

  const next = () => {
    if (step < STEPS - 1) { setStep(step + 1); return; }
    if (!S.termsOk) return;
    finishOnboarding();
  };

  const startWithAi = () => {
    if (!S.termsOk) { setStep(2); return; }   // consent first, always
    finishOnboarding();
    setTimeout(() => openAiBridge(), 350);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', background: 'var(--ground)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />

      {/* dots + back */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 20px 0' }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} aria-label="Back"
          style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', visibility: step > 0 ? 'visible' : 'hidden' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div style={{ display: 'flex', gap: 7 }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, background: i === step ? 'var(--accent)' : 'var(--hairline)', transition: 'all .3s cubic-bezier(.3,1.3,.4,1)' }} />
          ))}
        </div>
        <div style={{ width: 44 }} />
      </div>

      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '10px 24px 24px', display: 'flex', flexDirection: 'column' }}>

        {/* ── 1 · WHAT A STACK IS ── */}
        {step === 0 && (
          <div style={{ animation: 'ppwScreenIn .6s cubic-bezier(.26,1,.4,1)' }}>
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Welcome</div>
            <h1 style={H1}>Your day, as a stack</h1>
            <p style={SUB}>
              A <strong style={{ color: 'var(--ink)' }}>stack</strong> is simply the things you mean to do today —
              stacked in order, with a time on each.
            </p>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <DemoCard accent time="07:30" title="Morning walk" meta="20 min, outside" />
              <DemoCard time="13:00" title="Box breathing" meta="5 min" />
              <DemoCard time="21:30" title="I did enough today." meta="A note to yourself" />
            </div>
            <p style={{ ...SUB, marginTop: 20 }}>
              Tick things off as the day goes. Tomorrow it rebuilds itself, so you never start from a blank page.
            </p>
          </div>
        )}

        {/* ── 2 · HOW TO FILL IT (incl. the free AI path) ── */}
        {step === 1 && (
          <div style={{ animation: 'ppwScreenIn .6s cubic-bezier(.26,1,.4,1)' }}>
            <h1 style={H1}>Two ways to fill it</h1>
            <p style={SUB}>Add things yourself, or let the AI you already use do it for you.</p>

            <div style={{ marginTop: 20, padding: 18, borderRadius: 22, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'rgba(255,255,255,.18)', border: '1px solid var(--acc-rim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" /></svg>
                </span>
                <div style={{ fontSize: 16, fontWeight: 700, textShadow: 'var(--label-shadow)' }}>Talk to your AI</div>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, opacity: .95 }}>
                Use ChatGPT, Claude or Gemini — whichever you already have. It asks a few questions and writes
                your plan; you paste it back here. <strong>Free, and we never see your chat.</strong>
              </p>
            </div>

            <div style={{ marginTop: 14, padding: 18, borderRadius: 22, ...CARD }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </span>
                <div style={{ fontSize: 16, fontWeight: 700, textShadow: 'var(--emboss)' }}>Add it yourself</div>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--dim)' }}>
                Tap ＋ to drop in a video, a note, a protocol or a supplement. Set a time, and choose whether it
                repeats.
              </p>
            </div>

            <p style={{ ...SUB, marginTop: 18, fontSize: 13 }}>
              We’ll point these out once you’re inside — nothing to learn up front.
            </p>
          </div>
        )}

        {/* ── 3 · CONSENT (legally required gate) ── */}
        {step === 2 && (
          <div style={{ animation: 'ppwScreenIn .6s cubic-bezier(.26,1,.4,1)' }}>
            <h1 style={H1}>Before you start</h1>
            <p style={SUB}>One quick thing, then you’re in.</p>

            <div style={{ marginTop: 20, padding: '16px 18px', borderRadius: 20, ...CARD }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--dim)' }}>
                PPW organises and schedules the content <em>you</em> choose. It is not medical advice, and it
                doesn’t host or sell any content. Your stacks stay on your device.
              </p>
              <button onClick={() => setState({ termsOk: !S.termsOk })}
                style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', gap: 11, background: 'none', border: 'none', padding: 0, color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 9, border: `1px solid ${S.termsOk ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: S.termsOk ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)' }}>
                  {S.termsOk && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>I agree to the Terms &amp; Health Disclaimer</span>
              </button>
              <button onClick={openTerms} style={{ marginTop: 8, background: 'none', border: 'none', padding: '4px 0', minHeight: 34, color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>Read the full terms</button>
            </div>

            <button onClick={startWithAi} disabled={!S.termsOk}
              style={{ marginTop: 18, width: '100%', height: 52, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)', opacity: S.termsOk ? 1 : .45 }}>
              Start by talking to my AI
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* primary CTA */}
        <button onClick={next} disabled={!canNext}
          style={{ position: 'relative', marginTop: 20, width: '100%', height: 54, borderRadius: 18, border: `1px solid ${step === 2 ? 'var(--rim)' : 'var(--acc-rim)'}`, background: step === 2 ? 'var(--surface)' : 'var(--acc-surf)', color: step === 2 ? 'var(--ink)' : 'var(--acc-ink)', fontWeight: 600, fontSize: 16, textShadow: step === 2 ? 'var(--emboss)' : 'var(--label-shadow)', boxShadow: step === 2 ? 'var(--elev)' : 'var(--acc-glow)', opacity: canNext ? 1 : .45, transition: 'opacity .25s' }}>
          {step === 0 ? 'Next' : step === 1 ? 'Next' : 'Start with an empty day'}
        </button>
      </div>
    </div>
  );
}
