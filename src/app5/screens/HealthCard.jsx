// HealthCard — the Settings entry point for everything health.
//
// Phase 1 ships the card and the two things that must exist before any meter
// does: the age gate, and a delete that genuinely deletes. The rows that open
// detail screens are wired in later phases and say so plainly rather than
// opening an empty sheet.
//
// "Delete my health data" is deliberately the most prominent destructive action
// in the app. Someone who has told an app about their medicines and their
// operation date deserves to be able to take it all back in two taps, and to be
// told exactly what went.

import React from 'react';
import { useStore5, setState } from '../store5.js';
import {
  loadHealth, saveHealth, deleteHealth, emptyHealth, healthAgeState, MIN_AGE,
} from '../health5/store.js';

const ROW = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 18px', minHeight: 60, gap: 12, background: 'none', border: 'none',
  color: 'var(--ink)', textAlign: 'left',
};
const DIV = <div style={{ height: 1, background: 'var(--hairline)', margin: '0 18px' }} />;
const CARD = {
  marginTop: 12, borderRadius: 24, background: 'var(--surface)',
  backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
  border: '1px solid var(--rim)', boxShadow: 'var(--elev)', overflow: 'hidden',
};
const Chev = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--dim)', flex: 'none' }}><path d="M9 6l6 6-6 6" /></svg>
);

function Switch({ on, onTap, label }) {
  return (
    <button onClick={onTap} aria-label={label} role="switch" aria-checked={on} style={{ position: 'relative', width: 60, height: 34, flex: 'none', borderRadius: 999, border: `1px solid ${on ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: on ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', transition: 'background .3s' }}>
      <span style={{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 999, background: 'var(--thumb)', border: '1px solid var(--rim)', boxShadow: '0 3px 8px rgba(40,50,70,.25)', transform: `translateX(${on ? 26 : 0}px)`, transition: 'transform .38s cubic-bezier(.3,1.3,.4,1)' }} />
    </button>
  );
}

function Row({ title, sub, onTap, right, danger }) {
  const body = (
    <>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: danger ? 'var(--accent)' : 'var(--ink)' }}>{title}</div>
        {sub && <div style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.45, color: 'var(--dim)' }}>{sub}</div>}
      </div>
      {right !== undefined ? right : <Chev />}
    </>
  );
  if (!onTap) return <div style={ROW}>{body}</div>;
  return <button onClick={onTap} style={ROW}>{body}</button>;
}

export default function HealthCard() {
  const S = useStore5();
  const [health, setHealth] = React.useState(() => loadHealth());
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const persist = (next) => { setHealth(next); saveHealth(next); };
  const gate = healthAgeState(health.profile);

  const answerAge = (isAdult) => {
    persist({ ...health, profile: { ...health.profile, ageConfirmed: isAdult } });
  };

  const toggleMacros = () => {
    persist({ ...health, settings: { ...health.settings, trackMacros: !health.settings.trackMacros } });
  };

  const doDelete = () => {
    const { voiceFileIds } = deleteHealth(health);
    // Voice notes live in IndexedDB, not localStorage, so they are removed
    // separately — the slice alone would leave the recordings behind.
    if (voiceFileIds?.length) {
      import('../files5.js').then((f) => voiceFileIds.forEach((id) => f.deleteFile?.(id))).catch(() => {});
    }
    setHealth(emptyHealth());
    setConfirmDelete(false);
    setToast('Your health data has been deleted from this device.');
    setTimeout(() => setToast(null), 3200);
  };

  const askedCount = (health.askDoctor || []).filter((q) => !q.done).length;
  const suppCount = (health.cabinet || []).length;

  return (
    <div>
      {/* The age gate comes first and blocks the rest. Health features are for
          adults; the data's limits are all adult values. */}
      {gate.ask && (
        <div style={{ ...CARD, borderColor: 'var(--acc-rim)' }}>
          <div style={{ padding: '18px' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Are you {MIN_AGE} or over?</div>
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
              The supplement and nutrient features use adult amounts, so we need to ask once.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => answerAge(true)} style={{ flex: 1, minHeight: 44, borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14 }}>
                Yes, I am {MIN_AGE} or over
              </button>
              <button onClick={() => answerAge(false)} style={{ flex: 1, minHeight: 44, borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {!gate.allowed && !gate.ask && (
        <div style={CARD}>
          <div style={{ padding: '18px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)' }}>
            The supplement and nutrient features are for people aged {MIN_AGE} and over. Everything
            else in the app works as normal.
          </div>
        </div>
      )}

      {gate.allowed && (
        <div style={CARD}>
          <Row
            title="My health details"
            sub="Your day, conditions, medicines and test results"
            onTap={() => setToast('Coming in the next step.')}
          />
          {DIV}
          <Row
            title="Track protein & carbs"
            sub="Adds protein, carbs and fibre bars to your health screen"
            right={<Switch on={!!health.settings.trackMacros} onTap={toggleMacros} label="Track protein and carbs" />}
          />
          {DIV}
          <Row
            title="Questions for my doctor"
            sub={askedCount ? `${askedCount} saved` : 'Anything the app suggests you ask'}
            onTap={() => setToast('Coming in the next step.')}
          />
          {DIV}
          <Row
            title="My supplements"
            sub={suppCount ? `${suppCount} in your cabinet` : 'Nothing added yet'}
            onTap={() => setToast('Coming in the next step.')}
          />
        </div>
      )}

      {/* Delete — always available, even to someone who answered "no" above, so
          an under-18 who entered something can still clear it. */}
      <div style={{ ...CARD, borderColor: confirmDelete ? 'var(--accent)' : 'var(--rim)' }}>
        {!confirmDelete ? (
          <Row
            title="Delete my health data"
            sub="Removes everything health-related from this device"
            danger
            onTap={() => setConfirmDelete(true)}
            right={null}
          />
        ) : (
          <div style={{ padding: '18px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>Delete your health data?</div>
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, color: 'var(--dim)' }}>
              This removes your health details, supplements, test results, questions for your
              doctor and any health voice notes from this device. Your stacks, routines and
              everything else stay. It cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={doDelete} style={{ flex: 1, minHeight: 44, borderRadius: 14, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>
                Delete it
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, minHeight: 44, borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14 }}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, padding: '0 4px', fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
        Your health details stay on this device. They are never sent to us.
      </div>

      {toast && (
        <div role="status" style={{ marginTop: 10, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--rim)', background: 'var(--track)', boxShadow: 'var(--inset)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
