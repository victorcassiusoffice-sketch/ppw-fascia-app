// OnboardingScreen — New Design first-run wizard (faithful port, 6 steps).
//
// 0 Welcome + terms agree · 1 Quick access (Spotify, course shortcuts,
// creators) · 2 Day flow + anchors + rhythm + interests/levels · 3 What to
// manage (+ discreet, fasting) · 4 Modules · 5 Reminders. Chip lists, copy and
// layout are verbatim from the prototype. Shown while !onboarded; finishing
// persists all prefs under ppw5.* and reveals the app. The soft-plaque logo
// images are among the deferred assets — step 0 shows the tagline card
// (plaque renders once assets land; glass is last priority per Vic).

import React from 'react';
import { useStore5, setState, toggleInList, finishOnboarding, openTerms } from '../store5.js';

const LIFESTYLES = ['Office & desk-bound', 'On my feet all day', 'Remote / hybrid', 'Shift work', 'Student', 'Parent duties', 'Caring for someone', 'Self-employed', 'Retired', 'Long commute', 'Frequent traveller'];
const ANCHORS = ['Morning coffee', 'Commute', 'School run', 'Lunch break', 'Gym session', 'Dog walk', 'Cooking dinner', 'Study time', 'Prayer / faith', 'Journaling', 'Wind-down'];
const INTERESTS = ['Meditation', 'Fitness', 'Yoga', 'Breathwork', 'Live audio', 'Cold exposure'];
const BODY = ['Sleep', 'Stress', 'Focus', 'Anxiety', 'Positivity', 'Movement', 'Nutrition', 'Screen time', 'Lose body fat', 'Anti-aging'];
const LEVELED = ['Yoga', 'Fitness', 'Meditation', 'Breathwork', 'Cold exposure'];
const LEVEL_ENDS = { Yoga: ['Chair yoga', 'Dynamic flow'], Fitness: ['Gentle walks', 'HIIT'], Meditation: ['5-minute', 'Deep practice'], Breathwork: ['Box breathing', 'Wim Hof'], 'Cold exposure': ['Cool rinses', 'Full method'] };
const STEPS = 6;

const chipStyle = (sel, h = 44) => ({ height: h, padding: '0 16px', borderRadius: 999, border: `1px solid ${sel ? 'var(--acc-rim)' : 'var(--rim)'}`, background: sel ? 'var(--acc-surf)' : 'var(--surface)', color: sel ? 'var(--acc-ink)' : 'var(--ink)', fontSize: 13.5, fontWeight: 600, textShadow: 'var(--label-shadow)', transition: 'all .25s' });
const H1 = { margin: '18px 0 0', fontSize: 27, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' };
const SUB = { margin: '8px 0 0', fontSize: 14.5, color: 'var(--dim)' };
const H2 = { margin: '26px 0 0', fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' };
const CARD = { border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)' };
const INPUT = { height: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 14 };
const TLABEL = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' };

function Toggle({ on, onTap, label, w = 60 }) {
  const knob = w === 60 ? 26 : 24;
  return (
    <button onClick={onTap} aria-label={label} style={{ position: 'relative', width: w, height: knob + 8, borderRadius: 999, border: `1px solid ${on ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: on ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', flex: 'none', transition: 'background .3s' }}>
      <span style={{ position: 'absolute', top: 3, left: 3, width: knob, height: knob, borderRadius: 999, background: 'var(--thumb)', border: '1px solid var(--rim)', boxShadow: '0 3px 8px rgba(40,50,70,.25)', transform: `translateX(${on ? w - knob - 8 : 0}px)`, transition: 'transform .38s cubic-bezier(.3,1.3,.4,1)' }} />
    </button>
  );
}

function Chips({ list, field, S, h }) {
  return (
    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {list.map((l) => (
        <button key={l} onClick={() => toggleInList(field, l)} style={chipStyle((S[field] || []).includes(l), h)}>{l}</button>
      ))}
    </div>
  );
}

export default function OnboardingScreen() {
  const S = useStore5();
  if (S.onboarded) return null;
  const step = S.obStep;
  const canNext = step !== 0 || S.termsOk;
  const next = () => { if (!canNext) return; if (step >= STEPS - 1) finishOnboarding(); else setState({ obStep: step + 1 }); };
  const back = () => { if (step > 0) setState({ obStep: step - 1 }); };
  const cta = step === 0 ? 'Get started' : step >= STEPS - 1 ? 'Build my day' : 'Continue';

  const addCourse = () => {
    const label = S.courseLabel.trim(), url = S.courseUrl.trim();
    if (!label || !url) return;
    setState({ courseLinks: [...S.courseLinks, { label, url }], courseLabel: '', courseUrl: '' });
  };
  const addCreator = () => {
    const name = S.creatorInput.trim();
    if (!name || S.obCreators.includes(name)) return;
    setState({ obCreators: [...S.obCreators, name], creatorInput: '' });
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', background: 'var(--ground)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />

      {/* top bar: back · dots · skip */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 20px 0' }}>
        <button onClick={back} aria-label="Back" style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', visibility: step > 0 ? 'visible' : 'hidden' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div style={{ display: 'flex', gap: 7 }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, background: i === step ? 'var(--accent)' : 'var(--hairline)', transition: 'all .3s cubic-bezier(.3,1.3,.4,1)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, visibility: step > 0 ? 'visible' : 'hidden' }}>
          <button onClick={() => setState({ obStep: Math.min(step + 1, STEPS - 1) })} style={{ background: 'none', border: 'none', minHeight: 44, color: 'var(--dim)', fontSize: 13.5, fontWeight: 500 }}>Skip</button>
          <button onClick={finishOnboarding} style={{ background: 'none', border: 'none', minHeight: 44, color: 'var(--dim)', fontSize: 13.5, fontWeight: 700, opacity: .85 }}>Skip all</button>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '20px 24px 24px', display: 'flex', flexDirection: 'column' }}>

        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 8, animation: 'ppwScreenIn .62s cubic-bezier(.26,1,.4,1)' }}>
            {/* soft plaque — renders the wordmark; logo raster is a deferred asset */}
            <div style={{ position: 'relative', width: 'min(86%, 330px)', margin: '14px auto 0', borderRadius: 42, padding: '44px 20px', background: 'var(--intro-slab, var(--surface))', boxShadow: 'var(--intro-shadow, var(--elev-hi))', animation: 'ppwLogoFloat 7s ease-in-out 1.2s infinite' }}>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '.06em', textShadow: 'var(--emboss)' }}>PPW</div>
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, letterSpacing: '.34em', textTransform: 'uppercase', color: 'var(--dim)' }}>Wellness</div>
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: 'var(--intro-bevel, none)' }} />
            </div>
            <p style={{ position: 'relative', margin: '36px auto 0', fontSize: 16, lineHeight: 1.6, color: 'var(--dim)', maxWidth: 280, textShadow: 'var(--emboss)' }}>Manage your life as simple daily stacks. Video, audio and affirmations that appear right on your screen.</p>
            <div style={{ margin: '24px auto 0', width: '100%', maxWidth: 328, padding: '15px 16px', borderRadius: 18, ...CARD, textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--dim)' }}>PPWellness organizes and schedules the content <em>you</em> choose. It is not medical advice and doesn't host or sell any content.</p>
              <button onClick={() => setState({ termsOk: !S.termsOk })} style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 8, border: `1px solid ${S.termsOk ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: S.termsOk ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)' }}>
                  {S.termsOk && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>I agree to the Terms &amp; Health Disclaimer</span>
              </button>
              <button onClick={openTerms} style={{ marginTop: 6, background: 'none', border: 'none', padding: '4px 0', minHeight: 34, color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>Read full terms</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ animation: 'ppwScreenIn .62s cubic-bezier(.26,1,.4,1)' }}>
            <h1 style={H1}>Set up quick access</h1>
            <p style={SUB}>All optional. You can add or change these any time in Settings.</p>
            <div style={{ marginTop: 22, padding: 16, borderRadius: 20, ...CARD, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -6px rgba(29,185,84,.7)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.8-.87 7.08-.5 9.72 1.11.3.18.39.57.21.85Zm1.23-2.73a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.24 1.33.36.22.48.7.25 1.07Zm.11-2.85C14.42 8.96 9.1 8.79 6.02 9.72a.94.94 0 1 1-.54-1.8c3.54-1.07 9.41-.86 13.11 1.33a.94.94 0 0 1-.96 1.62Z" /></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, textShadow: 'var(--emboss)' }}>Spotify</div>
                <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>Play your linked audio inside stacks.</div>
              </div>
              <button onClick={() => setState({ integrations: { ...S.integrations, spotify: !S.integrations.spotify } })} style={{ height: 40, padding: '0 16px', flex: 'none', borderRadius: 13, border: `1px solid ${S.integrations.spotify ? 'var(--acc-rim)' : 'var(--rim)'}`, background: S.integrations.spotify ? 'var(--acc-surf)' : 'var(--surface)', color: S.integrations.spotify ? 'var(--acc-ink)' : 'var(--ink)', fontSize: 13.5, fontWeight: 600, textShadow: 'var(--label-shadow)', transition: 'all .25s' }}>{S.integrations.spotify ? 'Linked ✓' : 'Link'}</button>
            </div>
            <div style={{ marginTop: 14, padding: 16, borderRadius: 20, ...CARD }}>
              <div style={{ fontSize: 15, fontWeight: 600, textShadow: 'var(--emboss)' }}>Course &amp; login shortcuts</div>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Sign in once — open straight in after.</p>
              {S.courseLinks.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {S.courseLinks.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, border: '1px solid var(--hairline)', background: 'var(--track)' }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                      </span>
                      <a href={c.url} target="_blank" rel="noopener noreferrer" aria-label="Open course" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg></a>
                      <button onClick={() => setState({ courseLinks: S.courseLinks.filter((_, j) => j !== i) })} aria-label="Remove course" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--hairline)', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={S.courseLabel} onChange={(e) => setState({ courseLabel: e.target.value })} placeholder="Name (e.g. Yoga Course)" aria-label="Course name" style={{ width: '100%', ...INPUT }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={S.courseUrl} onChange={(e) => setState({ courseUrl: e.target.value })} placeholder="Paste course URL" aria-label="Course URL" inputMode="url" style={{ flex: 1, minWidth: 0, ...INPUT }} />
                  <button onClick={addCourse} style={{ height: 44, padding: '0 18px', flex: 'none', borderRadius: 12, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 14, fontWeight: 600, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Add</button>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, padding: 16, borderRadius: 20, ...CARD }}>
              <div style={{ fontSize: 15, fontWeight: 600, textShadow: 'var(--emboss)' }}>Creators you follow</div>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--dim)', textShadow: 'var(--emboss)' }}>The assistant favours creators you name.</p>
              {S.obCreators.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {S.obCreators.map((name) => (
                    <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 6px 0 13px', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                      {name}
                      <button onClick={() => setState({ obCreators: S.obCreators.filter((x) => x !== name) })} aria-label="Remove creator" style={{ width: 24, height: 24, borderRadius: 999, border: 'none', background: 'var(--track)', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <input value={S.creatorInput} onChange={(e) => setState({ creatorInput: e.target.value })} placeholder="e.g. Yoga With Adriene" aria-label="Creator or course name" style={{ flex: 1, minWidth: 0, ...INPUT }} />
                <button onClick={addCreator} style={{ height: 44, padding: '0 18px', flex: 'none', borderRadius: 12, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 14, fontWeight: 600, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Add</button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ animation: 'ppwScreenIn .62s cubic-bezier(.26,1,.4,1)' }}>
            <h1 style={H1}>How does your day flow?</h1>
            <p style={SUB}>Tap everything that sounds like you — it shapes when your stacks land.</p>
            <Chips list={LIFESTYLES} field="obLifestyle" S={S} h={52} />
            <h2 style={H2}>What's already in your day?</h2>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>The assistant attaches stacks to moments you never skip.</p>
            <Chips list={ANCHORS} field="obAnchors" S={S} />
            <h2 style={H2}>Your day rhythm</h2>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>The assistant places every item around these times.</p>
            <div style={{ marginTop: 12, padding: '14px 16px 16px', borderRadius: 18, ...CARD, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['wake', 'Wake up'], ['bed', 'Bed time'], ['ws', 'Work starts'], ['we', 'Work ends']].map(([k, label]) => (
                <label key={k} style={{ display: 'block' }}>
                  <span style={TLABEL}>{label}</span>
                  <input type="time" value={S.dayT[k]} onChange={(e) => setState({ dayT: { ...S.dayT, [k]: e.target.value } })} aria-label={label} style={{ marginTop: 6, width: '100%', height: 42, ...INPUT }} />
                </label>
              ))}
            </div>
            <h2 style={H2}>What do you want in your stacks?</h2>
            <Chips list={INTERESTS} field="obInterests" S={S} />
            {LEVELED.some((i) => S.obInterests.includes(i)) && (
              <div style={{ marginTop: 16, padding: '6px 16px 16px', borderRadius: 18, ...CARD }}>
                {LEVELED.filter((i) => S.obInterests.includes(i)).map((name) => (
                  <div key={name} style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)' }}>{name} level</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>{S.obLevels[name] || 5}</div>
                    </div>
                    <input type="range" min="1" max="10" step="1" value={S.obLevels[name] || 5} onChange={(e) => setState({ obLevels: { ...S.obLevels, [name]: +e.target.value } })} aria-label={`${name} level from 1 to 10`} style={{ marginTop: 8, width: '100%', accentColor: 'var(--accent)' }} />
                    <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--dim)' }}><span>1 · {(LEVEL_ENDS[name] || [])[0]}</span><span>10 · {(LEVEL_ENDS[name] || [])[1]}</span></div>
                  </div>
                ))}
              </div>
            )}
            <input value={S.obCustom} onChange={(e) => setState({ obCustom: e.target.value })} placeholder="Your own words — e.g. short lunchtime reset" aria-label="Describe what you want" style={{ marginTop: 14, width: '100%', height: 46, padding: '0 14px', borderRadius: 14, ...INPUT }} />
            <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>The assistant builds your starter stack from this.</p>
          </div>
        )}

        {step === 3 && (
          <div style={{ animation: 'ppwScreenIn .62s cubic-bezier(.26,1,.4,1)' }}>
            <h1 style={H1}>What do you want to manage?</h1>
            <p style={SUB}>Pick as many as you like.</p>
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {BODY.map((l) => {
                const sel = S.obBody.includes(l);
                return <button key={l} onClick={() => toggleInList('obBody', l)} style={{ height: 58, borderRadius: 20, border: `1px solid ${sel ? 'var(--acc-rim)' : 'var(--rim)'}`, background: sel ? 'var(--acc-surf)' : 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', color: sel ? 'var(--acc-ink)' : 'var(--ink)', fontSize: 14.5, fontWeight: 600, textShadow: 'var(--label-shadow)', transition: 'all .25s' }}>{l}</button>;
              })}
            </div>
            {['Anxiety', 'Stress', 'Focus'].some((g) => S.obBody.includes(g)) && (
              <div style={{ marginTop: 16, padding: 16, borderRadius: 18, ...CARD }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, textShadow: 'var(--emboss)' }}>Keep it discreet?</div>
                <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Neutral names, never auto-plays.</p>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button onClick={() => setState({ discreet: true })} style={{ flex: 1, height: 44, borderRadius: 14, ...chipStyle(S.discreet), padding: 0 }}>Yes, discreet</button>
                  <button onClick={() => setState({ discreet: false })} style={{ flex: 1, height: 44, borderRadius: 14, ...chipStyle(!S.discreet), padding: 0 }}>Show names</button>
                </div>
              </div>
            )}
            {S.obBody.includes('Nutrition') || S.obBody.includes('Lose body fat') ? (
              <div style={{ marginTop: 16, padding: 16, borderRadius: 18, ...CARD }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, textShadow: 'var(--emboss)' }}>Intermittent fasting</div>
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Pick your eating window — the corner badge tracks it.</p>
                  </div>
                  <Toggle on={S.fastOn} onTap={() => setState({ fastOn: !S.fastOn })} label="Toggle fasting" />
                </div>
                {S.fastOn && (
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'block' }}>
                      <span style={TLABEL}>Eating opens</span>
                      <input type="time" value={S.eatOpen} onChange={(e) => setState({ eatOpen: e.target.value })} aria-label="Eating window opens" style={{ marginTop: 6, width: '100%', height: 42, ...INPUT }} />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span style={TLABEL}>Eating closes</span>
                      <input type="time" value={S.eatClose} onChange={(e) => setState({ eatClose: e.target.value })} aria-label="Eating window closes" style={{ marginTop: 6, width: '100%', height: 42, ...INPUT }} />
                    </label>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {step === 4 && (
          <div style={{ animation: 'ppwScreenIn .62s cubic-bezier(.26,1,.4,1)' }}>
            <h1 style={H1}>Choose your modules</h1>
            <p style={SUB}>You can change these any time.</p>
            <div style={{ marginTop: 24, borderRadius: 24, ...CARD, backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', overflow: 'hidden' }}>
              {Object.keys(S.obModules).map((k, i, arr) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', minHeight: 58, borderBottom: `1px solid ${i === arr.length - 1 ? 'transparent' : 'var(--hairline)'}` }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{k}</div>
                  <Toggle w={56} on={S.obModules[k]} onTap={() => setState({ obModules: { ...S.obModules, [k]: !S.obModules[k] } })} label={`Toggle ${k}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', animation: 'ppwScreenIn .62s cubic-bezier(.26,1,.4,1)' }}>
            <div style={{ width: 96, height: 96, borderRadius: 999, background: 'var(--disc)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5H4.5L6 16z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
            </div>
            <h1 style={{ margin: '26px 0 0', fontSize: 27, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>Stay on rhythm</h1>
            <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'var(--dim)', maxWidth: 270 }}>Gentle reminders at each slot. Quiet hours respected, always.</p>
            <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Gentle reminders</span>
              <Toggle on={S.reminders} onTap={() => setState({ reminders: !S.reminders })} label="Toggle reminders" />
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ position: 'relative', marginTop: 20 }}>
          <button onClick={next} style={{ width: '100%', height: 54, borderRadius: 18, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 16, textShadow: 'var(--label-shadow)', opacity: canNext ? 1 : .45, transition: 'transform .18s, opacity .25s' }}>{cta}</button>
        </div>
      </div>
    </div>
  );
}
