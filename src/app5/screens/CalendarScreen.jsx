// CalendarScreen — New Design Calendar (month grid, faithful port).
//
// Month grid (Mon-first) with an accent dot on any day that has scheduled stack
// items; tap a day → selected-day panel listing that date's items (done ones
// dimmed) + "Open in Stack" which views that date's own stack (per-date model).

import React, { useState } from 'react';
import { useStore5, itemsForDate, openStackForDate } from '../store5.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const keyOf = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const toMin = (t) => { const [h, m] = String(t || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

const chev = (d) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function CalendarScreen() {
  useStore5(); // subscribe so dots refresh when items change
  const today = new Date();
  const [monthOff, setMonthOff] = useState(0);
  const [selKey, setSelKey] = useState(keyOf(today));

  const view = new Date(today.getFullYear(), today.getMonth() + monthOff, 1);
  const y = view.getFullYear(), mo = view.getMonth();
  const monthLabel = MONTHS[mo] + ' ' + y;

  // Mon-first leading blanks
  const firstDow = (new Date(y, mo, 1).getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selItems = [...itemsForDate(selKey)].sort((a, b) => toMin(a.time) - toMin(b.time));
  const selDate = (() => { const p = selKey.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); })();
  const selLabel = selDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '28px 20px 140px', animation: 'ppwScreenIn .38s cubic-bezier(.26,1,.4,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>{monthLabel}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setMonthOff((m) => m - 1)} aria-label="Previous month" style={{ width: 44, height: 44, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>{chev('M15 6l-6 6 6 6')}</button>
          <button onClick={() => setMonthOff((m) => m + 1)} aria-label="Next month" style={{ width: 44, height: 44, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>{chev('M9 6l6 6-6 6')}</button>
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 20, borderRadius: 28, padding: '18px 14px 14px', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', textAlign: 'center', paddingBottom: 8 }}>
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={'b' + i} style={{ height: 46 }} />;
            const k = y + '-' + (mo + 1) + '-' + d;
            const isSel = k === selKey;
            const isToday = k === keyOf(today);
            const hasItems = itemsForDate(k).length > 0;
            return (
              <button key={k} onClick={() => setSelKey(k)} style={{ position: 'relative', height: 46, borderRadius: 14, border: `1px solid ${isSel ? 'var(--acc-rim)' : 'transparent'}`, background: isSel ? 'var(--acc-surf)' : 'transparent', color: isSel ? 'var(--acc-ink)' : 'var(--ink)', fontSize: 14, fontWeight: isToday ? 800 : 500, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s, border-color .2s' }}>
                {d}
                {hasItems && !isSel && <span style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 4.5, height: 4.5, borderRadius: 999, background: 'var(--accent)' }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 18, borderRadius: 26, padding: 20, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', animation: 'ppwRise .4s cubic-bezier(.3,1.2,.4,1) both' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>{selLabel}</div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selItems.length ? selItems.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: s.done ? 0.45 : 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: s.done ? 'var(--dim)' : 'var(--accent)', flex: 'none' }} />
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</span>
              <span style={{ fontSize: 16, color: 'var(--dim)' }}>{s.time}</span>
            </div>
          )) : (
            <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>Nothing scheduled — open this day and add to its stack.</div>
          )}
        </div>
        <button onClick={() => openStackForDate(selKey)} style={{ marginTop: 16, height: 46, width: '100%', borderRadius: 15, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Open in Stack</button>
      </div>
    </div>
  );
}
