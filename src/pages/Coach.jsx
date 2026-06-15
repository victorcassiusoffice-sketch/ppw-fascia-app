// /coach (2026-06-16) — in-app surface for the PPW Wellness Assistant.
//
// LOCKED ARCHITECTURE: this app NEVER embeds the Assistant. The Assistant is a
// separate paid service (own Vercel app + Neon DB + Anthropic key) and sets
// X-Frame-Options: DENY, so it cannot be iframed and we never thin-client its
// API cross-origin (no CORS for that). This page is a DOORWAY: it links out to
// the live coach chat in a new tab. The Assistant owns auth + entitlement (paid
// gate + guest pass), so opening it always lands the user on its own
// sign-in / guest / subscribe flow — a free user can never spend tokens here.
//
// The separate D2 plan-sync (Settings → "Wellness Assistant" pairing card) pulls
// the coach's schedule additions into Today via a read-only device token. That
// feature — and ONLY that feature — needs the app origin on the Assistant's CORS
// allow-list. The link-out built here works today with zero Assistant changes.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { coachUrl, FEATURE_ASSISTANT_LAUNCH } from '../config.js';
import { isPaired } from '../lib/assistantSync.js';
import { HelixLogo } from '../chrome.jsx';
import { m, staggerContainer, enterRow, pressScale } from '../lib/motion';
import {
  IconArrowLeft, IconMessageSquare, IconExternalLink, IconSparkle, IconLink2,
} from '../components/icons.jsx';

function openCoach() {
  // New tab, no opener handle back to this window (security hygiene).
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(coachUrl(), '_blank', 'noopener,noreferrer');
  }
}

export default function CoachView() {
  const nav = useNavigate();
  const paired = isPaired();

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto pb-28">
      <button
        type="button"
        onClick={() => nav('/today')}
        className="glass-disc mb-5"
        style={{ width: 40, height: 40, color: 'var(--col-ink)' }}
        aria-label="Back to Today"
        title="Back to Today"
      >
        <IconArrowLeft />
      </button>

      <div className="eyebrow mb-3">Guidance</div>
      <h1 className="font-display text-4xl md:text-5xl mb-3 leading-[1.02]">
        Your Wellness Coach
      </h1>
      <p className="text-muted mb-8 max-w-xl leading-relaxed">
        A private, evidence-grounded coach that knows the PPW protocols — ask about
        recovery, fascia, capacity, fasting and your routine, any time.
      </p>

      {!FEATURE_ASSISTANT_LAUNCH ? (
        <div className="card p-6">
          <div className="font-display text-lg mb-1">Coming soon</div>
          <div className="text-muted text-sm">
            Your Wellness Coach isn’t open from the app yet. Check back shortly.
          </div>
        </div>
      ) : (
        <m.div className="space-y-4" variants={staggerContainer()} initial="hidden" animate="show">
          {/* Hero / launch pane */}
          <m.div variants={enterRow} className="card liquid-refract p-6">
            <div className="flex items-start gap-4 mb-4">
              <span
                className="shrink-0 grid place-items-center"
                style={{ width: 48, height: 48, color: 'var(--col-accent)' }}
                aria-hidden="true"
              >
                <HelixLogo size={40} />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-accent uppercase tracking-widest mb-1">
                  <span className="inline-flex items-center gap-1" aria-hidden="true">
                    <IconSparkle /> Live coach
                  </span>
                </div>
                <div className="font-display text-lg leading-snug">
                  Talk to your coach
                </div>
                <div className="text-muted text-xs mt-1 leading-relaxed">
                  Opens the PPW Wellness Assistant in a new tab. Sign in, use a guest
                  pass, or subscribe there — it’s a separate PPW membership.
                </div>
              </div>
            </div>

            <m.button
              type="button"
              onClick={openCoach}
              className="btn-lime w-full inline-flex items-center justify-center gap-2"
              aria-label="Open your Wellness Coach in a new tab"
              {...pressScale()}
            >
              <IconMessageSquare />
              Open your Wellness Coach
              <IconExternalLink />
            </m.button>
          </m.div>

          {/* Plan-sync pane — the D2 bridge, surfaced as a follow-on */}
          <m.div variants={enterRow} className="card p-6">
            <div className="flex items-start gap-3 mb-2">
              <span
                className={'shrink-0 ' + (paired ? 'text-accent' : 'text-muted')}
                aria-hidden="true"
              >
                <IconLink2 />
              </span>
              <div className="min-w-0">
                <div className="font-display text-base leading-snug">
                  {paired ? 'Plan sync connected ✓' : 'Sync your coach’s plan into Today'}
                </div>
                <div className="text-muted text-xs mt-1 leading-relaxed">
                  {paired
                    ? 'Schedule additions from your coach flow into Today automatically, marked with a small helix chip.'
                    : 'Pair this app once to let your coach add stacks, routines and fasting windows straight into Today.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => nav('/settings')}
              className="btn-ghost w-full mt-2"
            >
              {paired ? 'Manage connection' : 'Pair in Settings'}
            </button>
          </m.div>

          <p className="text-muted text-[11px] leading-relaxed px-1">
            The Wellness Coach is a separate, paid PPW service. This app links out to
            it and never sees your messages or health details. Opens in a new tab.
          </p>
        </m.div>
      )}
    </main>
  );
}
