// SchedulePicker — Library "Add to Stack" calendar window (Vic item 2).
//
// Tapping Add on a Routine / Media / Protocol row opens this: a compact month
// grid; picking a day schedules the item (or the whole routine) onto that
// date's stack. Routines fan out via applyRoutineToDate; single items land as
// repeat-once anchored stacks.

import React, { useState } from 'react';
import { useStore5, closeSchedule, addItemToDate, applyRoutineToDate, todayKey } from '../store5.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const keyOf = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

export default function SchedulePicker() {
  const S = useStore5();
  const [monthOff, setMonthOff] = useState(0);
  const [msg, setMsg] = useState(null);
  const t = S.scheduleTarget;
  if (!t) return null;

  const today = new Date();
  const view = new Date(today.getFullYear(), today.getMonth() + monthOff, 1);
  const y = view.getFullYear(), mo = view.getMonth();
  const firstDow = (new Date(y, mo, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const todayK = todayKey();

  const title = t.type === 'routine' ? (t.name || 'Routine') : (t.item && t.item.title) || 'Stack';

  const pick = (dateKey) => {
    let res;
    if (t.type === 'routine') res = applyRoutineToDate(t.id, dateKey);
    else res = addItemToDate(t.item, dateKey);
    if (res.upsell) { closeSchedule(); return; }
    if (res.ok) {
      const label = dateKey === todayK ? 'today' : new Date(...dateKey.split('-').map((v, i) => i === 1 ? +v - 1 : +v)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      setMsg(`Added to ${label}`);
      setTimeout(() => { setMsg(null); closeSchedule(); }, 900);
    }
  };

  const chev = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div onClick={closeSchedule} style={{ position: 'absolute', inset: 0, background: 'rgba(20,26,38,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 360, borderRadius: 26, padding: '18px 16px 16px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .4s cubic-bezier(.3,1.3,.4,1) both' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Add to Stack</div>
        <div style={{ marginTop: 4, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--dim)' }}>Pick the day it should appear on.</div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, textShadow: 'var(--emboss)' }}>{MONTHS[mo]} {y}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMonthOff((m) => m - 1)} aria-label="Previous month" style={{ width: 36, height: 36, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>{chev('M15 6l-6 6 6 6')}</button>
            <button onClick={() => setMonthOff((m) => m + 1)} aria-label="Next month" style={{ width: 36, height: 36, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>{chev('M9 6l6 6-6 6')}</button>
          </div>
        </div>

        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', textAlign: 'center' }}>
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={'b' + i} style={{ height: 40 }} />;
            const k = y + '-' + (mo + 1) + '-' + d;
            const isToday = k === todayK;
            return (
              <button key={k} onClick={() => pick(k)} style={{ height: 40, borderRadius: 12, border: `1px solid ${isToday ? 'var(--acc-rim)' : 'transparent'}`, background: isToday ? 'var(--acc-surf)' : 'transparent', color: isToday ? 'var(--acc-ink)' : 'var(--ink)', fontSize: 13.5, fontWeight: isToday ? 800 : 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</button>
            );
          })}
        </div>

        {msg && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', textAlign: 'center', animation: 'ppwRise .25s ease both' }}>{msg}</div>}
        <button onClick={closeSchedule} style={{ marginTop: 10, width: '100%', height: 44, background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600 }}>Cancel</button>
      </div>
    </div>
  );
}
