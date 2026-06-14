// /protocols + /protocol/:id (extracted verbatim from App.jsx, 2026-06-11
// liquid-glass redesign — zero logic change).
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActiveProtocols, useFastingPrefs, useDailyDuplicates } from '../state.js';
import { listProtocols, fetchProtocol, isMockActive } from '../protocols.js';
import { iherbUrl, amazonUkUrl, iherbCartAllUrl } from '../affiliate.js';
import { requestPermission, getPermissionState } from '../notifications.js';
import { Section } from '../components/shared.jsx';
import { m, staggerContainer, enterRow, glideIndicator, pressScale } from '../lib/motion';
import { IconArrowLeft } from '../components/icons.jsx';

/* ═══════════════════════════════════════════
   NEW — /protocols
   ═══════════════════════════════════════════ */
function ProtocolsList() {
  const [list, setList] = useState(null);
  const [activeProtocols, setActiveProtocols] = useActiveProtocols();
  useEffect(() => { listProtocols().then(setList); }, []);

  const toggle = (id) => {
    setActiveProtocols((cur) => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      requestPermission();
    }
  };

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="glass-disc mb-5" style={{ width: 40, height: 40, color: 'var(--col-ink)' }} aria-label="Back to Today" title="Back to Today"><IconArrowLeft /></Link>
      <div className="eyebrow mb-3">Library</div>
      <h1 className="font-display text-4xl md:text-5xl mb-3 leading-[1.02]">Protocols</h1>
      <p className="text-muted mb-6 max-w-xl leading-relaxed">Evidence-based, agent-generated. Tap to view, activate to merge into your day.</p>

      {/* 2026-06-12 revamp: legacy science banner purged — the library opens
          straight onto glass protocol panes over the user's background. */}
      {list == null && (
        <>
          <span className="sr-only" role="status">Loading protocols…</span>
          <div className="space-y-4" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-3 w-24 rounded bg-cream/10 mb-3" />
                <div className="h-6 w-2/3 rounded bg-cream/10 mb-3" />
                <div className="h-3 w-32 rounded bg-cream/5" />
              </div>
            ))}
          </div>
        </>
      )}
      {list && list.length === 0 && (
        <div className="card p-8 text-center fade-in is-visible">
          <div className="empty-orb" aria-hidden="true" />
          <div className="font-display text-lg mb-2">No protocols available yet.</div>
          <p className="text-muted text-sm">{isMockActive() ? 'Mock data is enabled but the mock file is unreachable.' : 'The remote protocol repo is empty. Flip mock mode on in Settings.'}</p>
        </div>
      )}

      {/* Liquid-glass (board 02, clip 4): cards enter staggered via the
          locked container/row primitives; the Activate pill MORPHS in place
          (colour cross-fade + squishy press), no layout jump. */}
      <m.div key={list ? 'loaded' : 'loading'} className="space-y-4" variants={staggerContainer()} initial="hidden" animate="show">
        {list && list.map(p => {
          const isActive = activeProtocols.includes(p.protocol_id);
          return (
            <m.div key={p.protocol_id} variants={enterRow} className={`card protocol-tile p-6 ${isActive ? 'border-accent' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="eyebrow mb-2">{p.variant} · {p.kind}</div>
                  <div className="font-display text-2xl mb-2 leading-tight">{p.topic}</div>
                  <div className="text-muted text-xs tracking-wide">{p.studies_used} studies · {p.sections.daily_plan?.length || 0} daily items</div>
                </div>
                <m.button onClick={() => toggle(p.protocol_id)} className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${isActive ? 'bg-cream/8 text-cream border border-accent' : 'btn-accent'}`} {...pressScale()}>
                  {isActive ? '✓ Active' : 'Activate'}
                </m.button>
              </div>
              <Link to={`/protocol/${p.protocol_id}`} className="text-accent text-sm font-medium mt-5 inline-flex items-center gap-1 hover:gap-2 transition-all">View full protocol <span aria-hidden="true">→</span></Link>
            </m.div>
          );
        })}
      </m.div>

      {/* 2026-06-12 revamp: closing science divider purged (legacy imagery). */}
    </main>
  );
}

/* ═══════════════════════════════════════════
   NEW — /protocol/:id
   ═══════════════════════════════════════════ */
function ProtocolDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [activeProtocols, setActiveProtocols] = useActiveProtocols();
  useEffect(() => { fetchProtocol(id).then(setP); }, [id]);

  if (!p) return <main className="px-5 py-10 max-w-3xl mx-auto"><div className="text-muted text-sm">Loading…</div></main>;

  const isActive = activeProtocols.includes(p.protocol_id);
  const toggle = () => setActiveProtocols(cur => cur.includes(p.protocol_id) ? cur.filter(x => x !== p.protocol_id) : [...cur, p.protocol_id]);

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto pb-16">
      <Link to="/protocols" className="glass-disc mb-5" style={{ width: 40, height: 40, color: 'var(--col-ink)' }} aria-label="Back to Protocols" title="Back to Protocols"><IconArrowLeft /></Link>
      <div className="eyebrow mb-3">{p.variant} · {p.kind} · v{p.schema_version}</div>
      <h1 className="font-display text-4xl md:text-5xl mb-3 leading-[1.02]">{p.topic}</h1>
      <p className="text-muted mb-6 max-w-xl leading-relaxed">{p.studies_used} studies · generated {new Date(p.generated_at).toLocaleDateString()}</p>
      <button onClick={toggle} className={isActive ? 'btn-ghost mb-10' : 'btn-accent mb-10'}>{isActive ? '✓ Active — deactivate' : 'Activate this protocol'}</button>

      {(p.topic || '').toLowerCase().includes('fasting') && <FastingControls />}

      <Section title="The Crisis">
        <p className="text-cream/80">{p.sections.crisis.body_md}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {p.sections.crisis.stats.map((s, i) => (
            <div key={i} className="card p-4 text-center">
              <div className="font-display text-2xl text-accent">{s.value}</div>
              <div className="text-xs text-muted mt-1">{s.caption}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The Science"><p className="text-cream/80">{p.sections.science.body_md}</p></Section>
      <Section title="The Enemies"><p className="text-cream/80">{p.sections.enemies.body_md}</p></Section>

      <Section title="Supplements">
        {iherbCartAllUrl(p.sections.supplements, p.topic) && (
          <a
            className="btn-iherb-all mb-4"
            href={iherbCartAllUrl(p.sections.supplements, p.topic)}
            target="_blank"
            rel="noopener nofollow sponsored"
          >
            🛒 Add all {p.sections.supplements.filter(s => s.iherb_sku).length} to iHerb cart
          </a>
        )}
        <div className="space-y-2">
          {p.sections.supplements.map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 sm:justify-start">
                    <div className="font-display text-lg">{s.name}</div>
                    <div className="text-xs text-muted">{s.brand}</div>
                  </div>
                  <div className="text-accent text-sm">{s.dose} · {s.timing}</div>
                  <p className="text-cream/70 text-sm mt-2">{s.rationale}</p>
                </div>
                <div className="supplement-actions">
                  <a
                    className="btn-iherb"
                    href={iherbUrl(s, p.topic)}
                    target="_blank"
                    rel="noopener nofollow sponsored"
                    aria-label={`Buy ${s.name} on iHerb`}
                  >
                    🛒 Buy on iHerb
                  </a>
                  <a
                    className="btn-amazon"
                    href={amazonUkUrl(s, p.topic)}
                    target="_blank"
                    rel="noopener nofollow sponsored"
                    aria-label={`Buy ${s.name} on Amazon UK`}
                  >
                    Amazon UK
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted text-xs mt-3 leading-relaxed">
          Affiliate disclosure: PPWellness earns a commission on qualifying purchases through these links at no extra cost to you. iHerb code QCI0747 also gives you a discount.
        </p>
      </Section>

      <Section title="Nutrition">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="text-xs text-accent uppercase tracking-widest mb-2">Eat</div>
            <ul className="space-y-1 text-sm">{(p.sections.nutrition.eat || []).map((x, i) => (<li key={i}>· {typeof x === 'string' ? x : (<span><span className="text-cream">{x.name}</span>{x.mechanism ? <span className="text-muted"> — {x.mechanism}</span> : null}</span>)}</li>))}</ul>
          </div>
          <div className="card p-4">
            <div className="text-xs text-muted uppercase tracking-widest mb-2">Avoid</div>
            <ul className="space-y-1 text-sm">{(p.sections.nutrition.avoid || []).map((x, i) => (<li key={i}>· {typeof x === 'string' ? x : (<span><span className="text-cream">{x.name}</span>{x.mechanism ? <span className="text-muted"> — {x.mechanism}</span> : null}</span>)}</li>))}</ul>
          </div>
        </div>
        {p.sections.nutrition.windows && p.sections.nutrition.windows.length > 0 && (
          <div className="card p-4 mt-3">
            <div className="text-xs text-accent uppercase tracking-widest mb-2">Eating windows</div>
            <ul className="space-y-1 text-sm">{p.sections.nutrition.windows.map((x, i) => (<li key={i}>· {typeof x === 'string' ? x : (<span><span className="text-cream">{x.name || x.label}</span>{x.mechanism ? <span className="text-muted"> — {x.mechanism}</span> : null}</span>)}</li>))}</ul>
          </div>
        )}
        {p.sections.nutrition.special_notes && (
          <div className="card p-4 mt-3">
            <div className="text-xs text-accent uppercase tracking-widest mb-2">Notes</div>
            <p className="text-cream/80 text-sm">{typeof p.sections.nutrition.special_notes === 'string' ? p.sections.nutrition.special_notes : JSON.stringify(p.sections.nutrition.special_notes)}</p>
          </div>
        )}
      </Section>

      <Section title="Daily Plan">
        <div className="space-y-2">
          {p.sections.daily_plan.map((e, i) => (
            <div key={i} className="card p-3 flex gap-3">
              <span className="font-display text-accent text-sm w-12 shrink-0">{e.time}</span>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm">{e.label}</div>
                <div className="text-muted text-xs">{e.category}{e.duration_min ? ` · ${e.duration_min} min` : ''}</div>
                {e.fascia_routine?.media_ref && (<div className="text-xs text-accent mt-1">🎬 {e.fascia_routine.media_ref.title}</div>)}
                {e.media_ref && (<div className="text-xs text-accent mt-1">{e.media_ref.media_type === 'audio' ? '🎧' : '🎬'} {e.media_ref.title}</div>)}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Biomarkers">
        <div className="space-y-2">
          {p.sections.biomarkers.map((b, i) => (
            <div key={i} className="card p-4 flex justify-between items-baseline">
              <div>
                <div className="font-display text-sm">{b.name}</div>
                <div className="text-muted text-xs">{b.test} · {b.frequency}</div>
              </div>
              <div className="text-accent text-sm">{b.target_range}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Timeline">
        <div className="space-y-2">
          {p.sections.timeline.map((t, i) => (
            <div key={i} className="card p-4">
              <div className="font-display text-accent text-sm">{t.phase}</div>
              <div className="text-cream/80 text-sm mb-2">{t.focus}</div>
              <ul className="text-xs text-muted space-y-1">{t.milestones.map((m, j) => <li key={j}>· {m}</li>)}</ul>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

/* ═══════════════════════════════════════════
   N14 — Fasting interactive controls
   ═══════════════════════════════════════════ */
function FastingControls() {
  const [prefs, setPrefs] = useFastingPrefs();
  const { addDuplicate } = useDailyDuplicates();
  const [perm, setPerm] = useState(getPermissionState());
  const [now, setNow] = useState(Date.now());
  const [banner, setBanner] = useState(null);

  // Live tick — once per second so the countdown updates smoothly.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const WINDOWS = [
    { key: '16:8', label: '16:8',  fastH: 16, eatH: 8 },
    { key: '18:6', label: '18:6',  fastH: 18, eatH: 6 },
    { key: '20:4', label: '20:4',  fastH: 20, eatH: 4 },
    { key: '24h',  label: '24h',   fastH: 24, eatH: 0 },
    { key: '48h',  label: '48h',   fastH: 48, eatH: 0 },
    { key: '72h',  label: '72h',   fastH: 72, eatH: 0 },
    { key: '7day', label: '7-day', fastH: 168, eatH: 0 },
  ];
  const fastWindow = WINDOWS.find(w => w.key === prefs.windowKey) || WINDOWS[0];
  const startMs = prefs.startISO ? new Date(prefs.startISO).getTime() : null;
  const endMs   = startMs ? startMs + fastWindow.fastH * 3600000 : null;
  const halfMs  = startMs && endMs ? startMs + (endMs - startMs) / 2 : null;
  const oneHourBeforeMs = endMs ? endMs - 3600000 : null;

  const fmtCountdown = (ms) => {
    if (ms == null || ms <= 0) return '00:00:00';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h >= 24) {
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return `${d}d ${String(rh).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Phase machine: idle / pre-fast / fasting / complete.
  let phase = 'idle';
  let countdownLabel = 'Pick a window and start';
  let countdownValue = '—';
  if (startMs && endMs) {
    if (now < startMs) {
      phase = 'pre-fast';
      countdownLabel = 'Fast starts in';
      countdownValue = fmtCountdown(startMs - now);
    } else if (now >= startMs && now < endMs) {
      phase = 'fasting';
      countdownLabel = 'Break-fast in';
      countdownValue = fmtCountdown(endMs - now);
    } else {
      phase = 'complete';
      countdownLabel = 'Fast complete — eat well';
      countdownValue = '00:00:00';
    }
  }

  const startNow = () => {
    setPrefs(p => ({ ...p, startISO: new Date().toISOString() }));
    const breakAt = new Date(Date.now() + fastWindow.fastH * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setBanner({ tone: 'ok', text: 'Fast started · ' + fastWindow.label + ' window · break-fast at ' + breakAt });
  };
  const startTonightAt8 = () => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    setPrefs(p => ({ ...p, startISO: d.toISOString() }));
    setBanner({ tone: 'ok', text: 'Fast scheduled for ' + d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) });
  };
  const setCustomStart = (e) => {
    const v = e.target.value;
    if (!v) return;
    const d = new Date(v);
    setPrefs(p => ({ ...p, startISO: d.toISOString() }));
  };
  const cancelFast = () => {
    setPrefs(p => ({ ...p, startISO: null }));
    setBanner(null);
  };

  // Notification scheduling — same setTimeout approach as the daily
  // notifications module. Service worker handles click events already.
  const scheduledRef = useRef([]);
  const clearScheduled = () => { scheduledRef.current.forEach(clearTimeout); scheduledRef.current = []; };
  useEffect(() => () => clearScheduled(), []);

  const scheduleAll = async () => {
    let p = perm;
    if (p !== 'granted') {
      p = await requestPermission();
      setPerm(p);
    }
    clearScheduled();
    if (p !== 'granted') {
      setBanner({ tone: 'warn', text: 'Notifications blocked — using in-app banners instead.' });
      return;
    }
    if (!startMs || !endMs) {
      setBanner({ tone: 'warn', text: 'Set a start time first.' });
      return;
    }
    const fire = (when, title, body) => {
      const delay = when - Date.now();
      if (delay <= 0) return false;
      const t = setTimeout(() => {
        try {
          new Notification(title, { body: body, tag: 'ppw-fast-' + when, icon: (import.meta.env.BASE_URL || '/') + 'assets/body_map.png' });
        } catch (_) {}
      }, delay);
      scheduledRef.current.push(t);
      return true;
    };
    let n = 0;
    if (fire(startMs, 'PPW · Fast starting', fastWindow.label + ' window — see you on the other side.')) n++;
    if (halfMs && fire(halfMs, 'PPW · Halfway there', 'Halfway through your ' + fastWindow.label + ' fast. Hydrate, salt, walk.')) n++;
    if (oneHourBeforeMs && fire(oneHourBeforeMs, 'PPW · 1 hour to break-fast', 'Prep your meal — protein-forward, real food.')) n++;
    if (fire(endMs, 'PPW · Break-fast time', 'Eat slowly, chew well. You earned it.')) n++;
    setBanner({ tone: 'ok', text: n + ' notification' + (n === 1 ? '' : 's') + ' scheduled.' });
  };

  const addToPlan = () => {
    if (!startMs || !endMs) {
      setBanner({ tone: 'warn', text: 'Set a start time first.' });
      return;
    }
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);
    const startTimeStr = String(startDate.getHours()).padStart(2, '0') + ':' + String(startDate.getMinutes()).padStart(2, '0');
    const endTimeStr   = String(endDate.getHours()).padStart(2, '0')   + ':' + String(endDate.getMinutes()).padStart(2, '0');
    const stamp = Date.now();
    addDuplicate({
      instanceId: 'dup::fasting-start::' + stamp,
      sourceId: 'fasting-protocol-block',
      kind: 'fasting',
      time: startTimeStr,
      category: 'fasting_window',
      label: 'Fast start — ' + fastWindow.label,
      duration_min: 0,
      notes: 'Begin ' + fastWindow.label + ' fast. Water, electrolytes, black coffee/tea OK.',
    });
    addDuplicate({
      instanceId: 'dup::fasting-end::' + (stamp + 1),
      sourceId: 'fasting-protocol-block',
      kind: 'fasting',
      time: endTimeStr,
      category: 'break_fast',
      label: 'Break-fast — ' + fastWindow.label,
      duration_min: 0,
      notes: 'Open your eating window. Protein-forward, real food.',
    });
    setPrefs(p => ({ ...p, addToPlan: true }));
    setBanner({ tone: 'ok', text: "Added to today's plan — check the Today screen." });
  };

  // Default value for the datetime-local input.
  const dtLocalValue = (() => {
    const d = startMs ? new Date(startMs) : new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  })();

  const phaseColour = phase === 'fasting' ? 'text-accent' : phase === 'complete' ? 'text-cream' : 'text-muted';

  return (
    <Section title="Live fasting timer">
      <div className="card p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-muted mb-2">Window</div>
        {/* Window segment (board 02, clip 3): ONE accent pill glides between
            the options via layoutId; labels colour-fade. */}
        <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Fasting window">
          {WINDOWS.map(w => {
            const active = prefs.windowKey === w.key;
            return (
              <m.button
                key={w.key}
                type="button"
                onClick={() => setPrefs(p => ({ ...p, windowKey: w.key }))}
                aria-pressed={active}
                className="seg-opt px-4 py-2 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'var(--chip-glass)',
                  backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.07))',
                  color: active ? 'var(--col-on-accent)' : 'var(--col-ink)',
                  border: '1px solid var(--glass-rim)',
                  boxShadow: '0 1px 0 var(--glass-specular) inset',
                  transition: 'color var(--dur-mid) var(--ease)',
                }}
                {...pressScale()}
              >
                {active && (
                  <m.span className="glide-pill" aria-hidden="true" style={{ borderRadius: 'var(--r-pill)' }} {...glideIndicator('fast-window')} />
                )}
                <span className="seg-label">{w.label}</span>
              </m.button>
            );
          })}
        </div>

        <div className="text-xs uppercase tracking-widest text-muted mb-2">Start</div>
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <button onClick={startNow} className="btn-accent flex-1 text-sm py-2.5">Start now</button>
          <button onClick={startTonightAt8} className="btn-ghost flex-1 text-sm py-2.5">Start tonight 8pm</button>
        </div>
        <label className="block text-xs text-muted mb-2">Or pick a custom start time:</label>
        <input
          type="datetime-local"
          value={dtLocalValue}
          onChange={setCustomStart}
          className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
          aria-label="Fast start time"
        />
      </div>

      <div className="card p-5 mb-4 text-center">
        <div className={'text-xs uppercase tracking-widest mb-2 ' + phaseColour}>{countdownLabel}</div>
        <div className="font-display text-4xl md:text-5xl text-accent mb-2 tabular-nums">{countdownValue}</div>
        {startMs && endMs && (
          <div className="text-xs text-muted">
            {new Date(startMs).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
            {' → '}
            {new Date(endMs).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        {startMs && (
          <button onClick={cancelFast} className="text-xs text-muted hover:text-accent mt-3 underline underline-offset-4">Cancel fast</button>
        )}
      </div>

      <div className="card p-5">
        <div className="font-display mb-1">Notifications & plan</div>
        <p className="text-muted text-xs mb-4">
          Schedule reminders for fast start, halfway, 1h before break-fast, and break-fast.
          Permission state: <span className="text-accent">{perm}</span>.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={scheduleAll} className="btn-accent flex-1 text-sm py-2.5">Schedule notifications</button>
          <button onClick={addToPlan} className="btn-ghost flex-1 text-sm py-2.5">Add to today's plan</button>
        </div>
        {banner && (
          <div className={'mt-3 text-xs px-3 py-2 rounded-lg ' + (banner.tone === 'ok' ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-cream/5 text-cream border border-cream/10')}>
            {banner.text}
          </div>
        )}
      </div>
    </Section>
  );
}

export { ProtocolsList, ProtocolDetail, FastingControls };
