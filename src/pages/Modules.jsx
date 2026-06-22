// /modules — audio & modules library.
// 2026-06-23 whole-app redesign: the list is extracted into <ModulesBody/> so
// it can be folded into the Stack screen's "Audio" tab (Vic: Modules is one
// library tab, not a top-level nav slot). The /modules route stays as a thin
// wrapper for back-compat (deep links, the Add sheet's Audio tile).
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useActiveModules } from '../state.js';
import { loadMedia, moduleMediaPath } from '../data.js';
import { requestPermission } from '../notifications.js';
import { DirectMediaPlayer } from '../MediaPlayer.jsx';
import { KNOWN_AUDIO_MODULES } from '../constants/knownAudioModules.js';
import { m, staggerContainer, enterRow, settleEmoji, pressScale } from '../lib/motion';
import { IconArrowLeft } from '../components/icons.jsx';

/* The audio-module list — no page chrome, reusable inside the Stack tabs. */
export function ModulesBody() {
  const [activeModules, setActiveModules] = useActiveModules();
  const [resolved, setResolved] = useState({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(KNOWN_AUDIO_MODULES.map(async m => [m.slug, await loadMedia(moduleMediaPath('audio', m.slug))]))
      .then(arr => { if (!cancelled) setResolved(Object.fromEntries(arr)); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (slug) => {
    setActiveModules(cur => cur.includes(slug) ? cur.filter(x => x !== slug) : [...cur, slug]);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') requestPermission();
  };

  return (
    <m.div className="space-y-3.5" variants={staggerContainer()} initial="hidden" animate="show">
      {KNOWN_AUDIO_MODULES.map(mod => {
        const media = resolved[mod.slug];
        const isActive = activeModules.includes(mod.slug);
        return (
          <m.div key={mod.slug} variants={enterRow} className={`card protocol-tile p-5 ${isActive ? 'border-accent' : ''}`}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-accent uppercase tracking-widest mb-1">
                  <m.span variants={settleEmoji} className="inline-block" aria-hidden="true">🎧</m.span> audio · default {mod.defaultTime}
                </div>
                <div className="font-display text-lg">{media?.title || mod.label}</div>
                {media && <div className="text-muted text-xs">{Math.round(media.duration_sec / 60)} min</div>}
              </div>
              <m.button onClick={() => toggle(mod.slug)} className={`px-4 py-2 rounded-full text-sm font-bold shrink-0 ${isActive ? 'bg-cream/10 text-cream border border-accent' : 'btn-accent'}`} aria-label={isActive ? 'Active — tap to remove from your routine' : 'Add to my routine'} {...pressScale()}>
                {isActive ? '✓ Active' : 'Add'}
              </m.button>
            </div>
            {media && <DirectMediaPlayer media={media} />}
          </m.div>
        );
      })}
    </m.div>
  );
}

/* /modules route wrapper (back-compat). */
function ModulesList() {
  return (
    <main className="px-5 py-8 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="glass-disc mb-5" style={{ width: 40, height: 40, color: 'var(--col-ink)' }} aria-label="Back to Today" title="Back to Today"><IconArrowLeft /></Link>
      <div className="eyebrow mb-3">Listen</div>
      <h1 className="font-display text-4xl md:text-5xl mb-3 leading-[1.02]">Audio &amp; Modules</h1>
      <p className="text-muted mb-8 max-w-xl leading-relaxed">Meditative, passive, screen-off-friendly. Add to your daily routine.</p>
      <ModulesBody />
    </main>
  );
}

export default ModulesList;
