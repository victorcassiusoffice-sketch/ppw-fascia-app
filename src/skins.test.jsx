// Background skins (2026-06-14, Vic feature pass) — registry + choice model.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SKINS, SKIN_BY_ID, skinAsset, getBackgroundChoice, setBackgroundChoice,
  resolveBackgroundKind, backgroundTone, BG_KEY,
} from './lib/background.js';

describe('background skins', () => {
  beforeEach(() => { try { localStorage.removeItem(BG_KEY); } catch (_) {} });

  it('exposes a curated skin set (6–12) with id/label/tone', () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(6);
    expect(SKINS.length).toBeLessThanOrEqual(12);
    for (const s of SKINS) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.label).toBe('string');
      expect(['dark', 'bright']).toContain(s.tone);
    }
    // ids are unique
    expect(new Set(SKINS.map(s => s.id)).size).toBe(SKINS.length);
  });

  it('skinAsset is base-path aware and serves full + thumb', () => {
    const id = SKINS[0].id;
    expect(skinAsset(id)).toContain(`assets/skins/${id}.jpg`);
    expect(skinAsset(id, true)).toContain(`assets/skins/thumb/${id}.jpg`);
  });

  it('persists + round-trips a valid skin choice', () => {
    setBackgroundChoice({ kind: 'skin', skinId: 'orbit' });
    const got = getBackgroundChoice();
    expect(got).toEqual({ kind: 'skin', skinId: 'orbit' });
  });

  it('rejects an unknown skin id (falls back to auto)', () => {
    localStorage.setItem(BG_KEY, JSON.stringify({ kind: 'skin', skinId: 'does-not-exist' }));
    expect(getBackgroundChoice()).toEqual({ kind: 'auto' });
  });

  it('resolves skin kind through and reports its scrim tone', () => {
    const dark = { kind: 'skin', skinId: SKINS.find(s => s.tone === 'dark').id };
    const bright = { kind: 'skin', skinId: SKINS.find(s => s.tone === 'bright').id };
    expect(resolveBackgroundKind(dark, 'dark')).toBe('skin');
    expect(backgroundTone(dark)).toBe('dark');
    expect(backgroundTone(bright)).toBe('bright');
    expect(backgroundTone({ kind: 'nature' })).toBe(null);
  });

  it('every skin id maps in SKIN_BY_ID', () => {
    for (const s of SKINS) expect(SKIN_BY_ID[s.id]).toBe(s);
  });
});
