// CompletedSheet — New Design "Completed today" bottom sheet (faithful port).
//
// Opened from the check-disc in the Stack header. Lists today's done items
// (struck through, with scheduled time + done-at) and an Undo that restores the
// item to the stack for that day.

import React from 'react';
import { useStore5, closeCompleted, completedToday, undoDone, todayKey } from '../store5.js';

const hhmm = (ts) => { try { return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export default function CompletedSheet() {
  const S = useStore5();
  if (!S.completedOpen) return null;
  const key = S.viewDate || todayKey();
  const list = completedToday(key);
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 32 }}>
      <div onClick={closeCompleted} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', maxHeight: '70%', overflowY: 'auto', borderRadius: 30, padding: '22px 20px 20px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--accent)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5z" /><path d="M3.5 8.5 12 13l8.5-4.5M12 13v7" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Completed today</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{dateLabel} · resets at midnight</div>
          </div>
        </div>
        {list.length === 0 ? (
          <div style={{ marginTop: 20, padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--dim)' }}>Nothing completed yet. Tap <strong>Done</strong> on Next Up to log it here.</div>
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, border: '1px solid var(--rim)', background: 'var(--surface)' }}>
                <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 999, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', textDecoration: 'line-through', textDecorationColor: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                  <div style={{ marginTop: 2, fontSize: 12, color: 'var(--dim)' }}>Scheduled {c.time} · done {hhmm(c.at)}</div>
                </div>
                <button onClick={() => undoDone(c.id, key)} aria-label="Restore to stack" style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12.5, fontWeight: 600 }}>Undo</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
