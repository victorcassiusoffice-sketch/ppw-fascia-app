// /settings (extracted verbatim from App.jsx, 2026-06-11 liquid-glass
// redesign — zero logic change).
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../theme.js';
import { getPermissionState, requestPermission } from '../notifications.js';
import { useLocalStorage, useActiveProtocols, useActiveModules, useActiveRoutines, useIfPrefs } from '../state.js';
import { LS_KEYS, APP_VERSION, USE_MOCK_DATA, NOTIFICATION_LEAD_TIME_MIN } from '../config.js';
import { getPushState, subscribeToPush, INSTALL_HELP } from '../lib/push.js';
import { Section } from '../components/shared.jsx';
import { m, glideIndicator, pressScale } from '../lib/motion';

/* P0b (2026-06-02) — "Reliable reminders" card. Explains the two delivery
   paths that ACTUALLY fire on a locked phone (calendar .ics + Web Push on an
   installed PWA) vs the in-app overlay which is foreground-only. */
function ReliableRemindersCard() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { let on = true; getPushState().then(s => { if (on) setState(s); }); return () => { on = false; }; }, []);

  const refresh = async () => setState(await getPushState());

  const enablePush = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await subscribeToPush();
      if (!r.ok && r.reason === 'ios-needs-install') {
        setMsg({ tone: 'warn', text: r.help });
      } else if (!r.ok) {
        setMsg({ tone: 'warn', text: 'Could not enable push (' + r.reason + ').' });
      } else if (r.reason === 'subscribed-local-only' || r.senderConfigured === false) {
        setMsg({ tone: 'warn', text: 'Subscribed on this device. The push SENDER is not live yet (one-time setup pending) — until then use "Add to phone calendar" for guaranteed lock-screen alerts.' });
      } else {
        setMsg({ tone: 'ok', text: 'Lock-screen push enabled on this device.' });
      }
    } finally {
      setBusy(false);
      refresh();
    }
  };

  if (!state) return null;
  const iosNeedsInstall = state.ios && !state.standalone;

  return (
    <Section title="Reminders that actually fire">
      <div className="card p-5 space-y-4">
        <div>
          <div className="font-display">1 · Add to phone calendar (most reliable)</div>
          <div className="text-muted text-xs mt-1">
            Tap the calendar icon on any timed stack to add it to your phone's own
            Calendar. The phone then alarms on the lock screen at the slot time —
            app fully closed, works on iPhone, Android and desktop, no install needed.
          </div>
        </div>

        <div className="border-t border-cream/10 pt-4">
          <div className="font-display">2 · Lock-screen push (installed app)</div>
          <div className="text-muted text-xs mt-1">
            {iosNeedsInstall
              ? INSTALL_HELP.ios
              : state.standalone
                ? 'Installed. Enable push to get reminders pushed to this device even when the app is closed.'
                : 'Install the app to your home screen first, then enable push for closed-app reminders.'}
          </div>
          {!iosNeedsInstall && state.supported && (
            <button onClick={enablePush} disabled={busy || state.subscribed} className="btn-accent mt-3 w-full">
              {state.subscribed ? '✓ Push enabled on this device' : busy ? 'Enabling…' : 'Enable lock-screen push'}
            </button>
          )}
          {!state.supported && (
            <div className="text-muted text-xs mt-3">This browser does not support Web Push.</div>
          )}
          {msg && (
            <div className="text-xs mt-3" style={{ color: msg.tone === 'ok' ? '#7CCB8E' : '#F5C56B' }}>{msg.text}</div>
          )}
          {!state.senderConfigured && (
            <div className="text-muted text-[11px] mt-3 leading-relaxed">
              Note: the off-device push sender (a free background service) is a
              one-time setup that's still pending. Until it's live, path 1
              (calendar) is the guaranteed option.
            </div>
          )}
        </div>

        <div className="border-t border-cream/10 pt-4">
          <div className="text-muted text-[11px] leading-relaxed">
            The in-app pop-up reminder only appears while the app is open in the
            foreground — it can't wake a locked phone. Use path 1 or 2 above for
            reminders that fire when the app is closed.
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   NEW — /settings
   ═══════════════════════════════════════════ */
function SettingsView() {
  const { choice: themeChoice, setChoice: setThemeChoice } = useTheme();
  const [perm, setPerm] = useState(getPermissionState());
  const [mockOverride, setMockOverride] = useLocalStorage(LS_KEYS.USE_MOCK_OVERRIDE, USE_MOCK_DATA ? 'true' : 'false');
  const [activeProtocols, setActiveProtocols] = useActiveProtocols();
  const [activeModules, setActiveModules] = useActiveModules();
  const [activeRoutines, setActiveRoutines] = useActiveRoutines();
  // Phase 3.1 (2026-05-23) — IF (Intermittent Fasting) eating-window prefs.
  const [ifPrefs, setIfPrefs] = useIfPrefs();

  const askPerm = async () => { const r = await requestPermission(); setPerm(r); };
  const clearAll = () => {
    setActiveProtocols([]);
    setActiveModules([]);
    setActiveRoutines({ savedZones: [], level: 'beginner', lifestyle: null, scheduledTime: '08:00' });
  };

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="text-muted text-sm inline-block hover:text-accent mb-4 transition-colors">← Today</Link>
      <div className="eyebrow mb-3">Configure</div>
      <h1 className="font-display text-4xl md:text-5xl mb-8 leading-[1.02]">Settings</h1>

      <Section title="Appearance">
        <div className="card p-5">
          <div className="font-display mb-1">Theme</div>
          <div className="text-muted text-xs mb-4">Light is neumorphic soft-UI · Dark is slate + orange · System follows your device.</div>
          {/* Liquid-glass (board 04, clip 3): the active state is ONE pill
              that GLIDES between the three options via layoutId. Buttons stay
              put; labels colour-fade. Pill is solid (it moves → no blur). */}
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Theme">
            {[
              { key: 'light',  label: 'Light',  icon: '☀' },
              { key: 'dark',   label: 'Dark',   icon: '☾' },
              { key: 'system', label: 'System', icon: '⌖' },
            ].map(opt => {
              const active = themeChoice === opt.key;
              return (
                <m.button
                  key={opt.key}
                  type="button"
                  onClick={() => setThemeChoice(opt.key)}
                  aria-pressed={active}
                  className="seg-opt py-3 rounded-2xl text-sm font-bold flex flex-col items-center gap-1"
                  style={{
                    background: 'var(--col-inset)',
                    color: active ? 'var(--col-on-accent)' : 'var(--col-ink)',
                    boxShadow: active ? 'none' : 'var(--elv-inset)',
                    border: '1px solid var(--hairline)',
                    transition: 'color var(--dur-mid) var(--ease)',
                  }}
                  {...pressScale()}
                >
                  {active && (
                    <m.span className="glide-pill" aria-hidden="true" style={{ borderRadius: 'var(--r-16)' }} {...glideIndicator('theme-seg')} />
                  )}
                  <span aria-hidden="true" style={{ fontSize: 18 }}>{opt.icon}</span>
                  <span className="seg-label">{opt.label}</span>
                </m.button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Notifications">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display">Daily reminders</div>
              <div className="text-muted text-xs">Fires {NOTIFICATION_LEAD_TIME_MIN} min before each scheduled item.</div>
            </div>
            <div className="text-xs text-accent">{perm}</div>
          </div>
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button onClick={askPerm} className="btn-accent mt-4 w-full">Enable notifications</button>
          )}
          {perm === 'unsupported' && <div className="text-muted text-xs mt-3">This browser does not support notifications.</div>}
          <div className="text-muted text-[11px] mt-3 leading-relaxed">In-app reminders only fire while the app is open. For lock-screen reminders with the app closed, see "Reminders that actually fire" below.</div>
        </div>
      </Section>

      <ReliableRemindersCard />

      <Section title="Intermittent Fasting">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="font-display">Auto-arrange food into eating window</div>
              <div className="text-muted text-xs mt-1">When enabled, food items outside the window move inside automatically. Notifications fire at open · 15 min pre-close · close.</div>
            </div>
            <m.button
              onClick={() => setIfPrefs(p => ({ ...p, enabled: !p.enabled }))}
              className={`px-4 py-2 rounded-full text-sm font-bold shrink-0 ${ifPrefs.enabled ? 'btn-accent' : 'btn-ghost'}`}
              aria-pressed={ifPrefs.enabled}
              {...pressScale()}
            >
              {ifPrefs.enabled ? '✓ On' : 'Off'}
            </m.button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted uppercase tracking-widest mb-1 block">Window opens</span>
              <input
                type="time"
                value={ifPrefs.windowStart}
                onChange={(e) => setIfPrefs(p => ({ ...p, windowStart: e.target.value }))}
                className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted uppercase tracking-widest mb-1 block">Window closes</span>
              <input
                type="time"
                value={ifPrefs.windowEnd}
                onChange={(e) => setIfPrefs(p => ({ ...p, windowEnd: e.target.value }))}
                className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
              />
            </label>
          </div>
        </div>
      </Section>

      <Section title="Data source">
        <div className="card p-5">
          <div className="font-display mb-2">Use mock protocol data</div>
          <div className="text-muted text-xs mb-4">Off = pull from the GitHub protocol repo. On = read /mock-protocol.json bundled with the app.</div>
          {/* Two-option glide segment (board 04) — same move as the theme
              control, one pill slides between Mock and Live. */}
          <div className="flex gap-2" role="group" aria-label="Data source">
            {[
              { key: 'true', label: 'Mock' },
              { key: 'false', label: 'Live' },
            ].map(opt => {
              const active = mockOverride === opt.key;
              return (
                <m.button
                  key={opt.key}
                  type="button"
                  onClick={() => setMockOverride(opt.key)}
                  aria-pressed={active}
                  className="seg-opt flex-1 py-2.5 rounded-full text-sm font-bold"
                  style={{
                    background: 'var(--col-inset)',
                    color: active ? 'var(--col-on-accent)' : 'var(--col-ink)',
                    border: '1px solid var(--hairline)',
                    boxShadow: active ? 'none' : 'var(--elv-inset)',
                    transition: 'color var(--dur-mid) var(--ease)',
                  }}
                  {...pressScale()}
                >
                  {active && (
                    <m.span className="glide-pill" aria-hidden="true" style={{ borderRadius: 'var(--r-pill)' }} {...glideIndicator('mock-seg')} />
                  )}
                  <span className="seg-label">{opt.label}</span>
                </m.button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Active state">
        <div className="card p-5 space-y-2 text-sm">
          <div>Protocols: <span className="text-accent">{activeProtocols.length}</span></div>
          <div>Audio modules: <span className="text-accent">{activeModules.length}</span></div>
          <div>Saved zones: <span className="text-accent">{activeRoutines.savedZones?.length || 0}</span></div>
          <button onClick={clearAll} className="btn-ghost w-full mt-4">Clear all activations</button>
        </div>
      </Section>

      <Section title="About">
        <div className="card p-5 text-sm space-y-1.5">
          <div>Version: <span className="text-accent">{APP_VERSION}</span></div>
          <div className="text-muted text-xs pt-2">Peak Performance Wellness · ppwellness.co</div>
        </div>
      </Section>
    </main>
  );
}

export default SettingsView;
export { ReliableRemindersCard };
