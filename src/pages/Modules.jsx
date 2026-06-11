// /modules (extracted verbatim from App.jsx, 2026-06-11 liquid-glass
// redesign — zero logic change).
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useActiveModules } from '../state.js';
import { loadMedia, moduleMediaPath } from '../data.js';
import { requestPermission } from '../notifications.js';
import { DirectMediaPlayer } from '../MediaPlayer.jsx';
import { KNOWN_AUDIO_MODULES } from '../constants/knownAudioModules.js';

/* ═══════════════════════════════════════════
   NEW — /modules
   ═══════════════════════════════════════════ */
function ModulesList() {
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
    <main className="px-5 py-8 max-w-3xl mx-auto pb-16">
      <Link to="/today" className="text-muted text-sm inline-block hover:text-accent mb-4 transition-colors">← Today</Link>
      <div className="eyebrow mb-3">Listen</div>
      <h1 className="font-display text-4xl md:text-5xl mb-3 leading-[1.02]">Audio &amp; Modules</h1>
      <p className="text-muted mb-8 max-w-xl leading-relaxed">Meditative, passive, screen-off-friendly. Add to your daily routine.</p>

      <div className="space-y-4 fade-in fade-in-stagger is-visible">
        {KNOWN_AUDIO_MODULES.map(m => {
          const media = resolved[m.slug];
          const isActive = activeModules.includes(m.slug);
          return (
            <div key={m.slug} className={`card protocol-tile p-6 ${isActive ? 'border-accent' : ''}`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-accent uppercase tracking-widest mb-1">🎧 audio · default {m.defaultTime}</div>
                  <div className="font-display text-lg">{media?.title || m.label}</div>
                  {media && <div className="text-muted text-xs">{Math.round(media.duration_sec / 60)} min</div>}
                </div>
                <button onClick={() => toggle(m.slug)} className={`px-4 py-2 rounded-full text-sm font-bold shrink-0 ${isActive ? 'bg-cream/10 text-cream border border-accent' : 'btn-accent'}`}>
                  {isActive ? '✓ Active' : 'Add to my routine'}
                </button>
              </div>
              {media && <DirectMediaPlayer media={media} />}
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default ModulesList;
