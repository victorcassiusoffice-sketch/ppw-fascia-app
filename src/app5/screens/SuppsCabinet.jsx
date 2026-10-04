// SuppsCabinet — "My supplements", above the shop list on the Supps tab.
//
// What a person actually takes, grouped the way the app schedules it: one card
// per slot, because that is what lands on their Stack. Below that, anything the
// data says to avoid — still listed, never scheduled, with the reason and the
// red badge, and a way to log it if they take it anyway so the limits can still
// see it.
//
// Nothing here is a recommendation. It is a record of what they told us.

import React from 'react';
import {
  useStore5, setHealth, openSuppEdit, healthEngineData, suppSlotCount,
} from '../store5.js';
import { FREE_STACK_CAP } from '../store5.js';
import {
  slotsFrom, unscheduled, slotTitle, takenToday, setSlotTaken, setProductTaken,
  logStillTaking, removeProduct, STILL_TAKING_SLOT, overMaxProducts,
} from '../health5/cabinet.js';
import { flagsForProduct } from '../health5/flags.js';
import { slotConflicts, conflictTip } from '../health5/timing.js';
import { formatAmount } from '../health5/units.js';
import { todayKey } from '../store5.js';
import { addAskDoctor } from '../health5/store.js';
import useHealthData from '../health5/useHealthData.js';

const CARD = {
  marginTop: 12, borderRadius: 24, background: 'var(--surface)',
  backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
  border: '1px solid var(--rim)', boxShadow: 'var(--elev)', overflow: 'hidden',
};
const DIV = <div style={{ height: 1, background: 'var(--hairline)', margin: '0 16px' }} />;

/** Colour and words for each action, straight from rules.actionOrder. */
const BADGE = {
  avoid: { label: 'Do not take', color: 'var(--accent)', strong: true },
  doctor_first: { label: 'Ask your doctor first', color: 'var(--accent)' },
  caution: { label: 'Take care', color: 'var(--dim)' },
  check_level: { label: 'A blood test is the way to know', color: 'var(--dim)' },
  may_need_more: { label: 'You may need more', color: 'var(--dim)' },
  info: { label: 'Worth knowing', color: 'var(--dim)' },
  // Not an `actionOrder` action — a dose verdict. It shares the strong
  // treatment because it is the same severity to the person holding the bottle.
  over_max: { label: 'Over the maximum', color: 'var(--accent)', strong: true },
};

function Badge({ action }) {
  const b = BADGE[action];
  if (!b) return null;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
      letterSpacing: '.02em', color: b.strong ? 'var(--acc-ink)' : b.color,
      background: b.strong ? 'var(--accent)' : 'transparent',
      border: `1px solid ${b.strong ? 'var(--accent)' : 'var(--rim)'}`,
    }}>{b.label}</span>
  );
}

function Check({ on, onTap, label }) {
  return (
    <button onClick={onTap} role="checkbox" aria-checked={on} aria-label={label} style={{
      width: 26, height: 26, flex: 'none', borderRadius: 8, background: on ? 'var(--acc-surf)' : 'transparent',
      border: `1.5px solid ${on ? 'var(--acc-rim)' : 'var(--rim)'}`, color: 'var(--acc-ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
    </button>
  );
}

export default function SuppsCabinet() {
  const S = useStore5();
  // The cabinet is the first surface that needs numbers, so it is the one that
  // pays for the data files.
  const data = useHealthData() || healthEngineData();
  const health = S.health || {};
  const cabinet = health.cabinet || [];
  const day = todayKey();
  const [open, setOpen] = React.useState({});     // expanded slots

  const ctx = { data, profile: health.profile || {}, todayISO: day };
  const slots = data ? slotsFrom(cabinet, ctx) : [];
  const notScheduled = data ? unscheduled(cabinet, ctx) : [];
  const taken = takenToday(health.doneSupps || {}, day);
  // Over a safe maximum is judged across the planned DAY, not per bottle — two
  // ordinary products can be over the line together while neither is alone.
  const overMax = data ? overMaxProducts(cabinet, ctx) : { ids: new Set(), byProduct: {} };

  const write = (fn) => setHealth((h) => fn(h));

  const toggleSlot = (slot) => {
    const all = slot.products.every((p) => taken.has(p.id));
    write((h) => ({ ...h, doneSupps: setSlotTaken(h.doneSupps || {}, day, slot, !all) }));
  };
  const toggleProduct = (slot, product) => {
    write((h) => ({ ...h, doneSupps: setProductTaken(h.doneSupps || {}, day, slot.id, product.id, !taken.has(product.id)) }));
  };
  const tookIt = (product) => {
    write((h) => ({ ...h, doneSupps: logStillTaking(h.doneSupps || {}, day, product.id) }));
  };
  const stillTake = (product) => {
    write((h) => ({
      ...h,
      cabinet: h.cabinet.map((p) => (p.id === product.id ? { ...p, stillTaking: true } : p)),
    }));
  };
  const drop = (product) => write((h) => ({ ...h, cabinet: removeProduct(h.cabinet, product.id) }));

  const slotCount = data ? suppSlotCount() : 0;
  const capNote = !S.premium && slotCount > 0
    ? `${slotCount} of your ${FREE_STACK_CAP} stacks — all your supplements at one time count as one.`
    : null;

  if (!data) {
    return (
      <div style={CARD}>
        <div style={{ padding: 18, fontSize: 13, color: 'var(--dim)' }}>Loading your supplement data…</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>My supplements</div>
        <button onClick={() => openSuppEdit('new')} style={{ minHeight: 44, padding: '0 14px', borderRadius: 999, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 13, fontWeight: 600 }}>
          Add
        </button>
      </div>

      {!cabinet.length && (
        <div style={CARD}>
          <div style={{ padding: '20px 18px' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Nothing here yet</div>
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, color: 'var(--dim)' }}>
              Add what you already take and the app will check it against safe maximums,
              your conditions and your medicines, and keep your meters honest.
            </div>
          </div>
        </div>
      )}

      {slots.map((slot) => {
        const allTaken = slot.products.every((p) => taken.has(p.id));
        const someTaken = slot.products.some((p) => taken.has(p.id));
        const isOpen = !!open[slot.id];
        const clashes = slotConflicts({ slotProducts: slot.products, medicines: health.profile?.medicines || [], data });
        return (
          <div key={slot.id} style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <Check on={allTaken} onTap={() => toggleSlot(slot)} label={`Mark ${slotTitle(slot)} taken`} />
              <button onClick={() => setOpen((o) => ({ ...o, [slot.id]: !isOpen }))} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', color: 'var(--ink)' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {slot.time ? `${slot.time} · ` : ''}{slotTitle(slot)}
                </div>
                <div style={{ marginTop: 2, fontSize: 12, color: 'var(--dim)' }}>
                  {slot.count} supplement{slot.count === 1 ? '' : 's'}
                  {someTaken && !allTaken ? ' · part taken' : ''}
                  {slot.withFood ? ' · with food' : ''}
                </div>
                {slot.products.some((p) => overMax.ids.has(p.id)) && (
                  <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--accent)' }}>
                    Over a safe maximum
                  </div>
                )}
              </button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--dim)', flex: 'none', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
            </div>

            {clashes.length > 0 && (
              <div style={{ margin: '0 16px 12px', padding: '10px 12px', borderRadius: 12, background: 'var(--track)', border: '1px solid var(--hairline)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
                {conflictTip(clashes[0])?.text} {clashes[0].why}
              </div>
            )}

            {isOpen && (
              <div style={{ padding: '0 16px 14px' }}>
                {slot.products.map((p) => {
                  const { action } = flagsForProduct(p, { ...ctx, cabinet });
                  return (
                    <React.Fragment key={p.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--hairline)' }}>
                      <Check on={taken.has(p.id)} onTap={() => toggleProduct(slot, p)} label={`Mark ${p.name} taken`} />
                      <button onClick={() => openSuppEdit(p.id)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', color: 'var(--ink)' }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name || 'Unnamed'}</div>
                        <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--dim)' }}>
                          {p.perServing?.length || 0} ingredient{(p.perServing?.length || 0) === 1 ? '' : 's'}
                          {p.supervised ? ' · doctor-prescribed' : ''}
                        </div>
                      </button>
                      {action && action !== 'info' && <Badge action={action} />}
                      {overMax.ids.has(p.id) && <Badge action="over_max" />}
                    </div>
                    {overMax.byProduct[p.id]?.slice(0, 2).map((o) => (
                      /* --ink, not --accent: the badge above already carries the
                         alarm, and accent body text at 11.5px washes out over the
                         bright end of the light glass gradient. The badge shouts;
                         this line is the evidence, and has to be readable. */
                      <div key={o.nutrientId} style={{ padding: '0 0 10px 38px', fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink)', fontWeight: 500 }}>
                        {o.name}: {formatAmount(o.counted, o.unit)} a day against a {formatAmount(o.limit, o.unit)} maximum.
                      </div>
                    ))}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {capNote && (
        <div style={{ marginTop: 8, padding: '0 4px', fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>{capNote}</div>
      )}

      {/* Not scheduled — the `avoid` list. Listed, never scheduled, never quiet. */}
      {notScheduled.length > 0 && (
        <>
          <div style={{ marginTop: 22, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            Not scheduled
          </div>
          {notScheduled.map(({ product, flags, stillTaking }) => (
            <div key={product.id} style={{ ...CARD, borderColor: 'var(--accent)' }}>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{product.name || 'Unnamed'}</div>
                  <Badge action="avoid" />
                </div>
                {flags.filter((f) => f.action === 'avoid').slice(0, 2).map((f, i) => (
                  <div key={i} style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.55, color: 'var(--dim)' }}>
                    {f.why}
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
                  This is not on your Stack and will not remind you. It is on your list of
                  questions for your doctor.
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  {!stillTaking ? (
                    <button onClick={() => stillTake(product)} style={{ minHeight: 44, padding: '0 14px', borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--ink)', fontSize: 13, fontWeight: 600 }}>
                      I still take this
                    </button>
                  ) : (
                    <button onClick={() => tookIt(product)} disabled={taken.has(product.id)} style={{ minHeight: 44, padding: '0 14px', borderRadius: 14, border: '1px solid var(--acc-rim)', background: taken.has(product.id) ? 'transparent' : 'var(--acc-surf)', color: taken.has(product.id) ? 'var(--dim)' : 'var(--acc-ink)', fontSize: 13, fontWeight: 600 }}>
                      {taken.has(product.id) ? 'Logged today' : 'Took it today'}
                    </button>
                  )}
                  <button onClick={() => drop(product)} style={{ minHeight: 44, padding: '0 14px', borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontSize: 13, fontWeight: 600 }}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
