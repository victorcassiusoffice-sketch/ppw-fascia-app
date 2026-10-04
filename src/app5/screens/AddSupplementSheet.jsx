// AddSupplementSheet — adding or editing one supplement.
//
// The form is deliberately boring. The interesting part is the live preview:
// every amount is converted as it is typed, and anything that would apply to
// THIS person shows up before they save, not afterwards on a meter. Telling
// someone after the fact is how an app gets ignored.
//
// Two places it asks instead of guessing, both because the engine refuses to:
//   • which form the label says, when knowing could relax the verdict
//   • which nutrient a doctor prescribed, when the product holds more than one
//     with a limit

import React from 'react';
import {
  useStore5, setHealth, closeSuppEdit, healthEngineData, todayKey,
} from '../store5.js';
import { emptyProduct, upsertProduct, removeProduct } from '../health5/cabinet.js';
import {
  convertLine, needsFormQuestion, formOptions, formatAmount, normaliseUnit,
} from '../health5/units.js';
import { flagsForProduct } from '../health5/flags.js';
import { limitFor, wouldExceed, productCaution } from '../health5/limits.js';
import { dayTotals, productContributions, supervisedScope } from '../health5/totals.js';
import { addAskDoctor } from '../health5/store.js';

// Sheets in this app are ABSOLUTE inside the phone stage with their own
// backdrop, not fixed to the window — a fixed sheet escapes the desktop stage
// and covers the whole browser. zIndex 38 sits above the edit-stack sheet (36).
//
// `--surface-strong` is a TRANSLUCENT gradient: it is only legible over a
// blurred backdrop, which is why every sheet in this app pairs it with
// `--blur-heavy`. Without that pair the page behind reads straight through the
// panel and the form becomes unreadable.
const WRAP = { position: 'absolute', inset: 0, zIndex: 38 };
const BACKDROP = { position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' };
const PANEL = {
  position: 'absolute', left: 14, right: 14,
  top: 'calc(42px + env(safe-area-inset-top, 0px))',
  bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
  overflowY: 'auto', borderRadius: 30, padding: '22px 20px 24px',
  background: 'var(--surface-strong)',
  backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)',
  border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)',
  transformOrigin: '50% 105%',
  animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both',
};
const LABEL = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const INPUT = {
  width: '100%', minHeight: 46, padding: '0 14px', borderRadius: 14,
  border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)',
  color: 'var(--ink)', outline: 'none', fontSize: 14, fontFamily: 'inherit',
};
const BTN = { minHeight: 48, borderRadius: 16, fontSize: 14.5, fontWeight: 600, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--ink)' };
const BTN_GO = { ...BTN, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)' };
const CHIP = (on) => ({
  minHeight: 44, padding: '0 14px', borderRadius: 999,
  border: `1px solid ${on ? 'var(--acc-rim)' : 'var(--rim)'}`,
  background: on ? 'var(--acc-surf)' : 'transparent',
  color: on ? 'var(--acc-ink)' : 'var(--ink)', fontSize: 13, fontWeight: 600,
});
const NOTE = { marginTop: 8, fontSize: 12, lineHeight: 1.5, color: 'var(--dim)' };
const WARN = { marginTop: 8, fontSize: 12, lineHeight: 1.5, color: 'var(--accent)' };

const REPEATS = [
  { k: 'daily', label: 'Every day' },
  { k: 'weekdays', label: 'Weekdays' },
  { k: 'weekly', label: 'Weekly' },
  { k: 'once', label: 'Just once' },
];

function Switch({ on, onTap, label }) {
  return (
    <button onClick={onTap} role="switch" aria-checked={on} aria-label={label} style={{ position: 'relative', width: 60, height: 34, flex: 'none', borderRadius: 999, border: `1px solid ${on ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: on ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)' }}>
      <span style={{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 999, background: 'var(--thumb)', border: '1px solid var(--rim)', transform: `translateX(${on ? 26 : 0}px)`, transition: 'transform .3s' }} />
    </button>
  );
}

/** Searchable picker over nutrients and ingredients, by any synonym. */
function IngredientPicker({ data, onPick, onClose }) {
  const [q, setQ] = React.useState('');
  const results = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const seen = new Set();
    const out = [];
    for (const [syn, hit] of data.bySynonym) {
      if (!syn.includes(term)) continue;
      const key = `${hit.kind}:${hit.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rec = hit.kind === 'nutrient' ? data.nutrientsById.get(hit.id) : data.ingredientsById.get(hit.id);
      if (rec) out.push({ ...hit, name: rec.name, unit: rec.unit });
      if (out.length >= 14) break;
    }
    return out;
  }, [q, data]);

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--track)' }}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search — vitamin D, magnesium, ashwagandha…" style={INPUT} />
      {results.map((r) => (
        <button key={`${r.kind}:${r.id}`} onClick={() => onPick(r)} style={{ width: '100%', minHeight: 44, marginTop: 8, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--rim)', background: 'var(--surface)', color: 'var(--ink)', textAlign: 'left', fontSize: 14 }}>
          {r.name}{r.unit ? <span style={{ color: 'var(--dim)', fontSize: 12 }}> · {r.unit}</span> : null}
        </button>
      ))}
      {q.trim() && !results.length && (
        <button onClick={() => onPick({ kind: 'other', id: 'other', name: q.trim() })} style={{ width: '100%', minHeight: 44, marginTop: 8, padding: '10px 12px', borderRadius: 12, border: '1px dashed var(--rim)', background: 'transparent', color: 'var(--dim)', fontSize: 13, textAlign: 'left' }}>
          Add “{q.trim()}” as something else
        </button>
      )}
      <button onClick={onClose} style={{ ...BTN, width: '100%', marginTop: 10, minHeight: 44 }}>Close</button>
    </div>
  );
}

export default function AddSupplementSheet() {
  const S = useStore5();
  const data = healthEngineData();
  const health = S.health || {};
  const editId = S.suppEditId;

  const existing = React.useMemo(
    () => (editId && editId !== 'new' ? (health.cabinet || []).find((p) => p.id === editId) : null),
    [editId, health.cabinet],
  );
  const [draft, setDraft] = React.useState(null);
  const [picking, setPicking] = React.useState(false);

  React.useEffect(() => {
    if (!editId) { setDraft(null); return; }
    setDraft(existing ? { ...existing, perServing: (existing.perServing || []).map((l) => ({ ...l })) } : emptyProduct());
    setPicking(false);
  }, [editId, existing]);

  if (!editId || !draft || !data) return null;

  const profile = health.profile || {};
  const age = profile.age ?? null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setLine = (i, patch) => setDraft((d) => {
    const lines = d.perServing.slice();
    lines[i] = { ...lines[i], ...patch };
    return { ...d, perServing: lines };
  });
  const dropLine = (i) => setDraft((d) => ({ ...d, perServing: d.perServing.filter((_, k) => k !== i) }));

  // Everything else the person already takes — so "this would put you over"
  // means over in their real day, not over on its own.
  const others = (health.cabinet || []).filter((p) => p.id !== draft.id);
  const otherTotals = dayTotals({ cabinet: others, data, scope: 'planned' }).byNutrient;
  const mine = productContributions(draft, data).byNutrient;

  const ctx = { data, profile, cabinet: [...others, draft], todayISO: todayKey() };
  const { action, flags } = flagsForProduct(draft, ctx);
  const sup = supervisedScope(draft, data);

  const preview = draft.perServing.map((line) => {
    const nutrient = data.nutrientsById.get(line.id);
    if (!nutrient) return { line, other: true, options: [] };
    const c = convertLine(nutrient, line);
    const lim = limitFor(nutrient, { age, form: c.form });
    const over = sup.ids.has(line.id) ? null : wouldExceed(nutrient, {
      currentTotals: otherTotals[line.id] || {},
      adding: mine[line.id] || {},
      age, form: c.form,
    });
    return {
      line, nutrient, c, lim, over,
      caution: productCaution(nutrient, c.ok ? c.meter : 0),
      asks: needsFormQuestion(nutrient, line),
      options: formOptions(nutrient),
    };
  });

  const anyAsks = preview.some((p) => p.asks);
  const canSave = draft.name.trim().length > 0;

  const save = () => {
    // An `avoid` product is kept, but never scheduled — and the reason goes on
    // the list of things to raise with a doctor so it does not just vanish.
    const next = action === 'avoid'
      ? { ...draft, name: draft.name.trim(), scheduled: false }
      : { ...draft, name: draft.name.trim() };
    setHealth((h) => {
      let updated = { ...h, cabinet: upsertProduct(h.cabinet || [], next) };
      if (action === 'avoid') {
        const why = flags.find((f) => f.action === 'avoid')?.why || `About ${next.name}`;
        updated = addAskDoctor(updated, `${next.name}: ${why}`, todayKey());
      }
      return updated;
    });
    closeSuppEdit();
  };

  const del = () => {
    setHealth((h) => ({ ...h, cabinet: removeProduct(h.cabinet || [], draft.id) }));
    closeSuppEdit();
  };

  return (
    <div style={WRAP}>
      <div onClick={closeSuppEdit} style={BACKDROP} />
      <div style={PANEL}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em' }}>
          {existing ? 'Edit supplement' : 'Add a supplement'}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={LABEL}>Name</div>
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="What is on the bottle" style={{ ...INPUT, marginTop: 8 }} />
        </div>

        {draft.needsCheck && draft.specText && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--track)', border: '1px solid var(--hairline)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
            Filled in from the shop listing: “{draft.specText}”. Check it against your own
            bottle — listings round, and give ranges.
          </div>
        )}

        {/* What is in it */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={LABEL}>What is in it</div>
            <button onClick={() => setPicking((p) => !p)} style={{ minHeight: 36, padding: '0 12px', borderRadius: 999, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600 }}>
              {picking ? 'Done' : 'Add ingredient'}
            </button>
          </div>

          {picking && (
            <IngredientPicker
              data={data}
              onClose={() => setPicking(false)}
              onPick={(hit) => {
                const rec = hit.kind === 'nutrient' ? data.nutrientsById.get(hit.id) : null;
                setDraft((d) => ({
                  ...d,
                  perServing: [...d.perServing, { id: hit.id, name: hit.name, amount: null, unit: rec?.unit || null, form: null }],
                }));
                setPicking(false);
              }}
            />
          )}

          {!draft.perServing.length && !picking && (
            <div style={NOTE}>
              Add what the label lists. Without amounts we cannot check it against a safe maximum.
            </div>
          )}

          {preview.map((p, i) => (
            <div key={i} style={{ marginTop: 10, padding: 12, borderRadius: 14, border: `1px solid ${p.over ? 'var(--accent)' : 'var(--rim)'}`, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, minWidth: 0 }}>{p.line.name || p.nutrient?.name || p.line.id}</div>
                <button onClick={() => dropLine(i)} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 12, minHeight: 32 }}>Remove</button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  inputMode="decimal" value={p.line.amount ?? ''} placeholder="Amount" aria-label="Amount"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '');
                    setLine(i, { amount: raw === '' ? null : Number(raw), range: null, fromSpec: false });
                  }}
                  style={{ ...INPUT, flex: 1 }}
                />
                <input
                  value={p.line.unit ?? ''} placeholder="Unit" aria-label="Unit"
                  onChange={(e) => setLine(i, { unit: e.target.value })}
                  style={{ ...INPUT, width: 104 }}
                />
              </div>

              {p.line.range && (
                <div style={NOTE}>
                  The listing said {p.line.range[0]}–{p.line.range[1]}. We used the higher
                  number, which is the cautious way round. Your bottle will say which.
                </div>
              )}

              {/* The converted amount, live. */}
              {p.c?.ok && (
                <div style={NOTE}>
                  Counts as {formatAmount(p.c.meter, p.nutrient.unit)} a day
                  {p.lim?.value != null && (
                    <> · {formatAmount(p.c.limit, p.lim.unit)} toward the {formatAmount(p.lim.value, p.lim.unit)} maximum</>
                  )}
                  {draft.servings > 1 && <> · ×{draft.servings} servings</>}
                </div>
              )}
              {!p.c?.ok && p.line.unit && !normaliseUnit(p.line.unit) && (
                <div style={WARN}>
                  We do not recognise “{p.line.unit}”. It stays on the label, but is not counted.
                </div>
              )}
              {!p.c?.ok && p.c?.reason === 'no_amount' && (
                <div style={NOTE}>No amount yet, so this one is not counted.</div>
              )}

              {p.over && (
                <div style={{ ...WARN, fontWeight: 600 }}>
                  With everything else you take, this comes to {formatAmount(p.over.after, p.over.unit)} a
                  day — over the {formatAmount(p.over.limit, p.over.unit)} maximum.
                </div>
              )}
              {p.caution && <div style={WARN}>{p.caution.text}</div>}

              {/* One question the engine refuses to answer for them. */}
              {p.asks && p.options.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: 'var(--track)', border: '1px solid var(--acc-rim)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>Which does the label say?</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
                    The safe maximum depends on the form. Until we know, we count it the
                    cautious way.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {p.options.map((o) => (
                      <button key={o.key} onClick={() => setLine(i, { form: o.label })} style={CHIP(false)}>
                        {o.label}
                      </button>
                    ))}
                    <button onClick={() => setLine(i, { form: null })} style={{ ...CHIP(false), color: 'var(--dim)' }}>
                      Not sure
                    </button>
                  </div>
                </div>
              )}
              {!p.asks && p.c?.formKnown && p.c.form && (
                <div style={{ ...NOTE, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Form: {String(p.c.form).replace(/_/g, ' ')}</span>
                  <button onClick={() => setLine(i, { form: null })} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 12, textDecoration: 'underline', minHeight: 32 }}>change</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* When */}
        <div style={{ marginTop: 20 }}>
          <div style={LABEL}>When</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="time" value={draft.time || ''} onChange={(e) => set({ time: e.target.value })} aria-label="Time" style={{ ...INPUT, flex: 1 }} />
            <input
              inputMode="numeric" value={draft.servings} aria-label="Servings"
              onChange={(e) => set({ servings: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
              style={{ ...INPUT, width: 92 }}
            />
          </div>
          <div style={{ ...NOTE, marginTop: 6 }}>
            {draft.servings > 1 ? `${draft.servings} at a time` : 'One at a time'} — tablets, capsules
            or scoops, whatever the label counts as a serving.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {REPEATS.map((r) => (
              <button key={r.k} onClick={() => set({ repeat: r.k })} style={CHIP(draft.repeat === r.k)}>{r.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ fontSize: 14 }}>With food</div>
            <Switch on={!!draft.withFood} onTap={() => set({ withFood: !draft.withFood })} label="With food" />
          </div>
        </div>

        {/* Doctor-prescribed */}
        <div style={{ marginTop: 20, padding: 14, borderRadius: 16, border: '1px solid var(--rim)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>My doctor prescribed this dose</div>
              <div style={{ marginTop: 2, fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
                We still show the amount and the maximum, and stop warning you about it.
              </div>
            </div>
            <Switch
              on={!!draft.supervised}
              onTap={() => set({
                supervised: !draft.supervised,
                supervisedFor: null,
                supervisedOn: draft.supervised ? null : todayKey(),
              })}
              label="Doctor prescribed"
            />
          </div>

          {/* The engine refuses to guess WHICH one was prescribed. So we ask. */}
          {draft.supervised && sup.ambiguous && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'var(--track)', border: '1px solid var(--acc-rim)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Which one did your doctor prescribe?</div>
              <div style={{ marginTop: 2, fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
                This has more than one thing with a safe maximum. Until you say, we keep
                checking all of them.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {(sup.candidates || []).map((id) => (
                  <button key={id} onClick={() => set({ supervisedFor: [id], supervisedOn: todayKey() })} style={CHIP(false)}>
                    {data.nutrientsById.get(id)?.name || id}
                  </button>
                ))}
              </div>
            </div>
          )}
          {draft.supervised && draft.supervisedFor?.length > 0 && (
            <div style={NOTE}>
              Doctor-supervised: {draft.supervisedFor.map((id) => data.nutrientsById.get(id)?.name || id).join(', ')}.
              Everything else in it is still checked.
            </div>
          )}
        </div>

        {/* What this means for this person — before they save. */}
        {flags.length > 0 && (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 16, border: `1px solid ${action === 'avoid' ? 'var(--accent)' : 'var(--rim)'}`, background: 'var(--surface)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: action === 'avoid' ? 'var(--accent)' : 'var(--ink)' }}>
              {action === 'avoid' ? 'Do not take this' : action === 'doctor_first' ? 'Ask your doctor first' : 'Worth knowing'}
            </div>
            {flags.slice(0, 3).map((f, i) => (
              <div key={i} style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.55, color: 'var(--dim)' }}>{f.why}</div>
            ))}
            {action === 'avoid' && (
              <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
                We will keep it in your supplements but never put it on your Stack, and never
                remind you to take it.
              </div>
            )}
          </div>
        )}

        {anyAsks && (
          <div style={{ ...NOTE, marginTop: 12 }}>
            Until the form questions above are answered, those amounts are counted the
            cautious way.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          {existing && (
            <button onClick={del} style={{ ...BTN, flex: 'none', width: 88, color: 'var(--dim)' }}>Delete</button>
          )}
          <button onClick={closeSuppEdit} style={{ ...BTN, flex: 1 }}>Cancel</button>
          <button onClick={save} disabled={!canSave} style={{ ...BTN_GO, flex: 1, opacity: canSave ? 1 : .45 }}>
            {action === 'avoid' ? 'Save, not scheduled' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
