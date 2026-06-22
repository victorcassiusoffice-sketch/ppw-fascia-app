// /calendar (2026-06-23, whole-app radical redesign — approved mock).
// A real date-planning destination promoted out of the cramped Today date
// strip. Clean month grid with NO frosted container box (Vic: "remove the
// frost box — pure clutter"); bare numerals on the moving liquid ground, an
// accent ring for today, an accent-glass cell for the selection, and a small
// dot on days that carry a recurring stack. Below: a read-only agenda for the
// selected day with "Open in Today ›" → the day view does the editing.
//
// Data: month dots come from the recurrence rules (ruleOccursOn) — the planned
// recurring stacks; the selected-day agenda also folds in that day's one-off
// user stacks. No new storage; nothing functional changes.
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecurrenceRules, useRecurrenceOverrides, useUserStacks, todayISO } from '../state.js';
import { ruleOccursOn, recurringStacksForDate } from '../recurrence.js';
import { m, staggerContainer, enterRow, pressScale } from '../lib/motion';

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;        // m is 0-based
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const labelOf = (s) => s?.title || s?.text || s?.url || 'Stack';

function ChevL() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 6l-6 6 6 6" /></svg>; }
function ChevR() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 6l6 6-6 6" /></svg>; }

export default function CalendarView() {
  const nav = useNavigate();
  const today = todayISO();
  const [view, setView] = useState(() => { const t = new Date(today + 'T12:00:00'); return { y: t.getFullYear(), m: t.getMonth() }; });
  const [selected, setSelected] = useState(today);

  const [recurrenceRules] = useRecurrenceRules();
  const overrides = useRecurrenceOverrides(selected);
  const { stacks: userStacks } = useUserStacks(selected);

  // Build the month matrix (Monday-start), with a planned-dot flag per day.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7;                 // Mon-start blanks
    const dim = new Date(view.y, view.m + 1, 0).getDate(); // days in month
    const out = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= dim; d++) {
      const dISO = iso(view.y, view.m, d);
      const planned = Array.isArray(recurrenceRules) && recurrenceRules.some((r) => ruleOccursOn(r, dISO));
      out.push({ d, dISO, planned });
    }
    return out;
  }, [view, recurrenceRules]);

  // Agenda for the selected day = recurring stacks (with this-day overrides) +
  // one-off user stacks, sorted by time. Read-only preview.
  const agenda = useMemo(() => {
    const rec = recurringStacksForDate(recurrenceRules, overrides, selected).map(({ stack }) => ({ label: labelOf(stack), time: stack?.time || '' }));
    const usr = (userStacks || []).map((s) => ({ label: labelOf(s), time: s?.time || '' }));
    return [...rec, ...usr].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }, [recurrenceRules, overrides, userStacks, selected]);

  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString(undefined, { month: 'long' });
  const selLabel = new Date(selected + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  const step = (delta) => setView((v) => { const t = new Date(v.y, v.m + delta, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  const goToday = () => { const t = new Date(today + 'T12:00:00'); setView({ y: t.getFullYear(), m: t.getMonth() }); setSelected(today); };

  const cell = (c) => {
    if (!c) return <div aria-hidden="true" />;
    const isToday = c.dISO === today;
    const isSel = c.dISO === selected;
    const base = { aspectRatio: '1', borderRadius: 14, fontSize: 14, fontWeight: 600, color: 'var(--col-ink)' };
    const style = isSel
      ? { ...base, backgroundColor: 'var(--accent-glass-bg)', backgroundImage: 'var(--glass-fill)', border: '1px solid var(--accent-glass-rim)', boxShadow: 'var(--accent-glass-glow), 0 1px 0 var(--glass-specular) inset', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.35)' }
      : isToday
        ? { ...base, border: '1px solid var(--accent-glass-rim)' }
        : base;
    return (
      <m.button
        type="button"
        onClick={() => setSelected(c.dISO)}
        className="relative grid place-items-center tnum"
        style={style}
        aria-label={`${c.d} ${monthLabel}${c.planned ? ', has stacks' : ''}`}
        aria-pressed={isSel}
        {...pressScale(0.9)}
      >
        {c.d}
        {c.planned && (
          <span
            aria-hidden="true"
            className="absolute"
            style={{ bottom: 5, width: 4, height: 4, borderRadius: '50%', background: isSel ? '#fff' : 'rgb(var(--c-alt-teal))' }}
          />
        )}
      </m.button>
    );
  };

  return (
    <main className="px-5 pt-1 pb-28 max-w-3xl mx-auto">
      {/* Heading: month + year (left), prev/next discs + Today pill (right). */}
      <div className="flex items-end justify-between mt-2 mb-3">
        <h1 className="font-display leading-none" style={{ fontSize: 30, letterSpacing: '-0.03em' }}>
          {monthLabel}<span className="text-muted ml-2" style={{ fontSize: 16, fontWeight: 500 }}>{view.y}</span>
        </h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} className="glass-disc" style={{ width: 38, height: 38, color: 'var(--col-ink)' }} aria-label="Previous month"><ChevL /></button>
          <button type="button" onClick={() => step(1)} className="glass-disc" style={{ width: 38, height: 38, color: 'var(--col-ink)' }} aria-label="Next month"><ChevR /></button>
          <button type="button" onClick={goToday} className="glass-capsule" style={{ height: 38, minHeight: 38, padding: '0 16px', fontSize: 13, fontWeight: 700, color: 'var(--col-ink)' }} aria-label="Jump to this month and today">Today</button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1.5 text-center mb-1">
        {DOW.map((d, i) => (
          <div key={i} style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--col-low)', fontWeight: 700 }}>{d}</div>
        ))}
      </div>

      {/* Clean month grid — NO frosted container box (Vic). */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {cells.map((c, i) => <React.Fragment key={i}>{cell(c)}</React.Fragment>)}
      </div>

      {/* Selected-day agenda (read-only preview; Today does the editing). */}
      <div className="flex items-center justify-between mt-7 mb-2 px-1">
        <div className="eyebrow">{selLabel} — {agenda.length} stack{agenda.length === 1 ? '' : 's'}</div>
        <m.button
          type="button"
          onClick={() => nav(`/today?date=${selected}`)}
          className="btn-accent inline-flex items-center gap-1"
          style={{ height: 34, padding: '0 14px', fontSize: 12.5 }}
          {...pressScale(0.96)}
        >Open in Today ▸</m.button>
      </div>

      {agenda.length === 0 ? (
        <div className="card text-center" style={{ padding: '22px 16px' }}>
          <div className="text-muted text-sm">No stacks planned for this day.</div>
          <m.button type="button" onClick={() => nav(`/today?date=${selected}`)} className="btn-accent mt-3 inline-flex items-center gap-1" style={{ height: 36, padding: '0 16px', fontSize: 13 }} {...pressScale(0.96)}>Add one ▸</m.button>
        </div>
      ) : (
        <m.div variants={staggerContainer(60)} initial="hidden" animate="show">
          {agenda.map((a, i) => (
            <m.div key={i} variants={enterRow} className="card flex items-center gap-3" style={{ padding: '12px 14px', borderRadius: 'var(--r-16)', marginBottom: 8 }}>
              <span className="tnum text-muted shrink-0" style={{ fontSize: 12.5, fontWeight: 700, width: 44 }}>{a.time || '—'}</span>
              <span className="min-w-0 flex-1 truncate" style={{ fontSize: 14.5, fontWeight: 600 }}>{a.label}</span>
            </m.div>
          ))}
        </m.div>
      )}
    </main>
  );
}
