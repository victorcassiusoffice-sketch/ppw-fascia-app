// AI-suggested YouTube — the safety layer (2026-09-20).
//
// The prompt banned links outright because models fabricate 11-character video
// ids that look completely real. Lifting that ban is only safe because of this
// module, so this is where the guarantee has to be pinned:
//   • a fabricated id never reaches an <iframe>
//   • the title always comes from YouTube, never from the model
//   • a failed CHECK is never treated as a failed VIDEO
//   • every outcome still leaves the user with a control that works
import { describe, it, expect, vi } from 'vitest';
import { verifyId, verifyAll, mediaFor, watchUrl, embedUrl, searchUrl, YT_ID } from './verifyVideo.js';

const REAL = 'v7AYKMP6rOE';   // Yoga With Adriene — the id the app already ships
const res = (status, body) => ({ status, json: async () => body });

describe('asking YouTube whether an id is real', () => {
  it('accepts a real id and takes the title from YouTube', async () => {
    const f = vi.fn(async () => res(200, { title: 'Yoga For Complete Beginners', author_name: 'Yoga With Adriene' }));
    const v = await verifyId(REAL, f);
    expect(v.state).toBe('ok');
    expect(v.title).toBe('Yoga For Complete Beginners');
    expect(v.author).toBe('Yoga With Adriene');
    expect(f.mock.calls[0][0]).toContain('youtube.com/oembed');
  });

  it('rejects a fabricated id (YouTube answers 400)', async () => {
    const v = await verifyId('ZZZZZZZZZZZ', vi.fn(async () => res(400)));
    expect(v.state).toBe('no');
  });

  it('rejects a well-formed but dead id (404)', async () => {
    const v = await verifyId('aaaaaaaaaaA', vi.fn(async () => res(404)));
    expect(v.state).toBe('no');
  });

  it('rejects a video that cannot be embedded (401/403)', async () => {
    expect((await verifyId(REAL, vi.fn(async () => res(401)))).state).toBe('no');
    expect((await verifyId(REAL, vi.fn(async () => res(403)))).state).toBe('no');
  });

  it('rejects anything that is not id-shaped without spending a request', async () => {
    const f = vi.fn();
    for (const bad of ['', null, undefined, 'short', 'way-too-long-to-be-an-id', 'has space!!']) {
      expect((await verifyId(bad, f)).state).toBe('no');
    }
    expect(f).not.toHaveBeenCalled();
  });

  // Offline, a corporate proxy, a region block, YouTube having a bad day — none
  // of those are evidence about the video, so none may be reported as 'no'.
  // (Note: passing null for fetchImpl deliberately falls back to the real global
  // fetch, so it is NOT used here — a unit test must not call YouTube.)
  it('treats a FAILED CHECK as unknown, never as a bad video', async () => {
    expect((await verifyId(REAL, vi.fn(async () => { throw new Error('offline'); }))).state).toBe('unk');
    expect((await verifyId(REAL, vi.fn(async () => res(500)))).state).toBe('unk');
    expect((await verifyId(REAL, vi.fn(async () => res(503)))).state).toBe('unk');
  });

  it('matches the id shape YouTube actually uses', () => {
    expect(YT_ID.test(REAL)).toBe(true);
    expect(YT_ID.test('_-aBcDeFgH1')).toBe(true);
    expect(YT_ID.test('tooshort')).toBe(false);
  });
});

describe('checking a whole plan', () => {
  it('spends no request on an item that claimed no video', async () => {
    const f = vi.fn(async () => res(200, { title: 't', author_name: 'a' }));
    const out = await verifyAll([REAL, null, null], 4, f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(out.map((v) => v.state)).toEqual(['ok', 'none', 'none']);
  });

  it('keeps results aligned with the items that asked for them', async () => {
    const f = vi.fn(async (u) => (u.includes('bbbbbbbbbbb') ? res(400) : res(200, { title: 'ok', author_name: 'a' })));
    const out = await verifyAll(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'], 2, f);
    expect(out.map((v) => v.state)).toEqual(['ok', 'no', 'ok']);
  });

  it('never runs more than the concurrency cap at once', async () => {
    let live = 0, peak = 0;
    const f = vi.fn(async () => {
      live++; peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 1));
      live--;
      return res(200, { title: 't', author_name: 'a' });
    });
    await verifyAll(Array.from({ length: 12 }, () => REAL), 4, f);
    expect(peak).toBeLessThanOrEqual(4);
    expect(f).toHaveBeenCalledTimes(12);
  });

  it('copes with an empty plan', async () => {
    expect(await verifyAll([], 4, vi.fn())).toEqual([]);
  });
});

describe('what the user actually ends up with', () => {
  it('a verified video plays, titled by YouTube and never autoplaying', () => {
    const m = mediaFor({ state: 'ok', id: REAL, title: 'Real Title', author: 'Real Channel' }, 'yoga', 'What the AI called it');
    expect(m.title).toBe('Real Title');            // YouTube's, not the model's
    expect(m.meta).toBe('YouTube · Real Channel');
    expect(m.url).toBe(watchUrl(REAL));
    expect(m.embed).toBe(embedUrl(REAL));
    expect(m.embed).not.toContain('autoplay');     // a stranger's audio never starts itself
    expect(m.thumbUrl).toContain(REAL);
  });

  it('a rejected id becomes a search, never a dead embed', () => {
    const m = mediaFor({ state: 'no' }, 'gentle hip opener', 'Hip opener');
    expect(m.embed).toBeUndefined();
    expect(m.url).toBe(searchUrl('gentle hip opener'));
    expect(m.meta).toBe('Find it on YouTube');
  });

  it('an unreachable check also degrades to a search rather than guessing', () => {
    const m = mediaFor({ state: 'unk' }, 'box breathing', 'Box breathing');
    expect(m.embed).toBeUndefined();
    expect(m.url).toContain('results?search_query=');
  });

  it('leaves an ordinary stack alone when nothing was claimed', () => {
    expect(mediaFor({ state: 'none' }, undefined, 'Walk')).toEqual({});
    expect(mediaFor(null, undefined, 'Walk')).toEqual({});
  });

  it('never lets a rejected id reach a url', () => {
    const m = mediaFor({ state: 'no', id: 'ZZZZZZZZZZZ' }, 'stretch', 'Stretch');
    expect(JSON.stringify(m)).not.toContain('ZZZZZZZZZZZ');
  });

  it('escapes the search query', () => {
    expect(searchUrl('neck & shoulders #2')).toBe('https://www.youtube.com/results?search_query=neck%20%26%20shoulders%20%232');
  });
});
