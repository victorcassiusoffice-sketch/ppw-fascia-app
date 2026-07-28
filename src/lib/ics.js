// P0a (2026-06-02) — client-side .ics generation for "Add to phone calendar".
//
// Why this exists: the in-app setTimeout + new Notification() reminder freezes
// when the tab is backgrounded/locked and does not exist at all on iOS. A
// downloaded .ics handed to the phone's own Calendar app fires a reliable
// alert on the lock screen, app fully closed, on every platform — zero backend.
//
// Times are emitted as FLOATING local time (no TZID, no Z suffix) so the
// device interprets them in its own local timezone. This is the most portable
// choice across iOS Calendar, Google Calendar and desktop clients.

// Escape a text value per RFC 5545 (commas, semicolons, backslashes, newlines).
function escapeText(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// 'YYYY-MM-DD' + 'HH:MM' -> 'YYYYMMDDTHHMMSS' floating local timestamp.
function toFloating(dateISO, hh, mm) {
  const d = String(dateISO).replace(/-/g, '');
  const h = String(hh).padStart(2, '0');
  const m = String(mm).padStart(2, '0');
  return `${d}T${h}${m}00`;
}

// Stamp used for DTSTAMP. We can't use Date.now in some sandboxes, but at
// runtime in the browser new Date() is fine; guard just in case.
function stampNow() {
  try {
    const n = new Date();
    const pad = (x) => String(x).padStart(2, '0');
    return (
      `${n.getUTCFullYear()}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}` +
      `T${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}Z`
    );
  } catch (_) {
    return '19700101T000000Z';
  }
}

// Fold a single content line at 75 octets per RFC 5545 (simple char-based fold).
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let i = 0;
  parts.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join('\r\n');
}

/**
 * Build an .ics document body for a single timed slot with an at-time alarm.
 * @param {Object} o
 * @param {string} o.uid       stable unique id
 * @param {string} o.title     SUMMARY
 * @param {string} o.dateISO   'YYYY-MM-DD'
 * @param {string} o.time      'HH:MM'
 * @param {number} [o.durationMin=15]
 * @param {string} [o.description]
 * @returns {string} full VCALENDAR text (CRLF line endings)
 */
export function buildSlotIcs({ uid, title, dateISO, time, durationMin = 15, description = '' }) {
  const [hh, mm] = String(time).split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error('buildSlotIcs: invalid time ' + time);
  }
  const dtStart = toFloating(dateISO, hh, mm);
  // Keep DTEND on the same date and never before DTSTART (some calendars reject
  // a wrapped/negative event). Cap at 23:59 if the duration would cross midnight.
  const endTotal = Math.min(23 * 60 + 59, hh * 60 + mm + (Number(durationMin) || 15));
  const endH = Math.floor(endTotal / 60);
  const endM = endTotal % 60;
  const dtEnd = toFloating(dateISO, endH, endM);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Peak Performance Wellness//PPWellness Lifestyle App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stampNow()}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText('PPW · ' + title)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText('PPW · ' + title)}`,
    // Fire AT the slot time. RELATED=START + zero offset.
    'TRIGGER;RELATED=START:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Build a stable UID for a slot on a given date.
 */
export function slotUid(itemId, dateISO, time) {
  const safe = String(itemId || 'slot').replace(/[^a-zA-Z0-9_-]/g, '');
  return `ppw-${safe}-${String(dateISO).replace(/-/g, '')}-${String(time).replace(':', '')}@ppwellness.co`;
}

/**
 * Trigger a client-side download of an .ics file for a slot. iOS Safari opens
 * it directly in the Calendar add-event sheet; Android/desktop download then
 * import. Returns true on success.
 *
 * iOS NOTE: iOS Safari frequently ignores a Blob URL + `download` attribute and
 * will NOT hand the file to Calendar — the tap appears to do nothing. The
 * reliable iOS path is to NAVIGATE to a `data:text/calendar` URL, which iOS
 * recognises and opens in the "Add Event" sheet. So we branch on iOS.
 */
function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function downloadSlotIcs({ itemId, title, dateISO, time, durationMin, description }) {
  try {
    const uid = slotUid(itemId, dateISO, time);
    const ics = buildSlotIcs({ uid, title, dateISO, time, durationMin, description });

    // iOS: navigate to a data: URL so Safari opens the Calendar add-event sheet.
    if (isIOSDevice()) {
      const dataUrl = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      // A real anchor click (user-gesture context) is the most reliable trigger.
      const a = document.createElement('a');
      a.href = dataUrl;
      a.rel = 'noopener';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Fallback: if the anchor click was swallowed, force navigation.
      setTimeout(() => {
        try {
          if (document.visibilityState === 'visible') window.location.href = dataUrl;
        } catch (_) {}
      }, 350);
      return true;
    }

    // Android / desktop: Blob download then the OS offers to import to Calendar.
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fname = `ppw-${String(title || 'reminder').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.ics`;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke a touch later so the click has landed.
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 4000);
    return true;
  } catch (e) {
    try { console.warn('downloadSlotIcs failed', e); } catch (_) {}
    return false;
  }
}
