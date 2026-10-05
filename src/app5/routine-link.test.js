// Practitioner -> client routine sharing, by LINK (2026-10-05).
//
// The file rail could never reach the person it was built for. A .md tapped in
// WhatsApp cannot open this app on either phone platform, so "share the
// programme with your client" only ever worked if the client had a desktop. The
// deliverable is now a link, and the whole programme rides in its fragment.
//
// Which makes this codec the correctness heart of the feature, and the reason
// these tests are round trips through the REAL item shapes rather than unit
// checks on the encoder. If a routine round-trips wrong, a practitioner hands a
// client a six-week programme and the client silently gets something else —
// nothing on either end would show that it had happened.
import { describe, it, expect, beforeEach } from 'vitest';
import { routineToLink, parseRoutineLink, routineToMd, parseRoutineMd, LINK_MAX_URL, PLAN_MAX_ITEMS, SHARE_MAX_OFFSET } from './store5.js';

beforeEach(() => { localStorage.clear(); });

// Built independently of the module under test: these tests should fail if the
// wire format changes, not quietly follow it.
function payload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const linkFor = (obj) => '#r=' + payload(obj);

// Every field a stack can carry, including the two that are deliberately NOT
// transmitted (embed, thumbUrl) and the one that is internal (fileId).
const FULL = {
  id: 'rt1',
  title: 'Pendulum swings — right shoulder',
  meta: '2 min each arm, loose',
  thumb: 'yt',
  url: 'https://www.youtube.com/watch?v=v7AYKMP6rOE',
  embed: 'https://www.youtube.com/embed/v7AYKMP6rOE?autoplay=1&playsinline=1&rel=0',
  thumbUrl: 'https://i.ytimg.com/vi/v7AYKMP6rOE/hqdefault.jpg',
  fileId: 'local-blob-42',
  anchor: '2026-10-5',
  time: '08:00',
  repeat: 'daily',
  dayOffset: 0,
};
const PROGRAMME = {
  name: 'Shoulder rehab — weeks 1-6',
  items: [
    FULL,
    { title: 'Wall slides' },
    { title: 'Review with the clinic', time: '10:00', repeat: 'weekly', dayOffset: 7 },
  ],
};

// A real programme, not sixty bare titles. What decides whether a link fits is
// the meta and the url on each stack, and a practitioner's export has both.
const bulk = (n) => ({
  name: 'Progressive loading — six weeks',
  items: Array.from({ length: n }, (_, i) => ({
    title: 'Mobility flow — thoracic spine, set ' + (i + 1),
    meta: '3 x 10 each side, slow and controlled',
    thumb: 'yt',
    url: 'https://www.youtube.com/watch?v=v7AYKMP6rOE',
    embed: 'https://www.youtube.com/embed/v7AYKMP6rOE?autoplay=1&playsinline=1&rel=0',
    thumbUrl: 'https://i.ytimg.com/vi/v7AYKMP6rOE/hqdefault.jpg',
    time: '08:00',
    repeat: 'daily',
    dayOffset: i % 28,
  })),
});

describe('the link a practitioner sends carries the whole programme', () => {
  it('survives the round trip out and back', () => {
    const back = parseRoutineLink(routineToLink(PROGRAMME));

    expect(back.ok).toBe(true);
    expect(back.name).toBe('Shoulder rehab — weeks 1-6');
    expect(back.items.map((i) => i.title)).toEqual([
      'Pendulum swings — right shoulder', 'Wall slides', 'Review with the clinic',
    ]);
    expect(back.items.map((i) => i.time)).toEqual(['08:00', undefined, '10:00']);
    expect(back.items.map((i) => i.repeat)).toEqual(['daily', undefined, 'weekly']);
    // the whole point of a six-week programme: week two is still week two
    expect(back.items[2]._day).toBe(7);
    expect(back.items[0]._day).toBe(0);
  });

  it('carries a stack that has almost nothing on it', () => {
    const back = parseRoutineLink(routineToLink({ name: 'Bare', items: [{ title: 'Just breathe' }] }));
    expect(back.ok).toBe(true);
    expect(back.items).toHaveLength(1);
    expect(back.items[0].title).toBe('Just breathe');
    expect(back.items[0].url).toBeUndefined();
    expect(back.items[0].time).toBeUndefined();
  });

  it('keeps the name a human typed, accents and dashes and all', () => {
    const name = 'Récupération — épaule · 6 semaines';
    const back = parseRoutineLink(routineToLink({ name, items: [{ title: 'Étirement doux' }] }));
    expect(back.name).toBe(name);
    expect(back.items[0].title).toBe('Étirement doux');
  });

  it('takes the internal day name too, so a parsed item can be re-shared', () => {
    // An item that just came off a link or a file carries `_day`, not
    // `dayOffset` — re-sharing it must not reset the programme to day one.
    const back = parseRoutineLink(routineToLink({ name: 'Re-share', items: [{ title: 'Late stack', _day: 21 }] }));
    expect(back.items[0]._day).toBe(21);
  });

  it('gives a YouTube stack back a playable video it never sent', () => {
    // embed and thumbUrl are not on the wire at all — they are derived from the
    // url on arrival. That is most of the size saving, and it means a sender
    // chooses which page a link points at, never what lands in an <iframe src>.
    const link = routineToLink(PROGRAMME);
    expect(link).not.toContain('youtube.com/embed');

    const got = parseRoutineLink(link).items[0];
    expect(got.url).toBe('https://www.youtube.com/watch?v=v7AYKMP6rOE');
    expect(got.embed).toContain('youtube.com/embed/v7AYKMP6rOE');
    expect(got.thumbUrl).toContain('i.ytimg.com/vi/v7AYKMP6rOE');
    expect(got.thumb).toBe('yt');
  });

  it('leaves the sender private things behind', () => {
    // fileId points at the SENDER's IndexedDB and could never have travelled;
    // anchor is the sender's own calendar, not the recipient's.
    const link = routineToLink(PROGRAMME);
    const got = parseRoutineLink(link).items[0];
    expect(link).not.toContain('local-blob-42');
    expect('fileId' in got).toBe(false);
    expect('anchor' in got).toBe(false);
  });
});

describe('a link and a file hand over the same thing', () => {
  it('produces the item shape the file rail already produces', () => {
    // The receive sheet and addItemsToToday read one shape, whichever rail the
    // routine arrived on. If this diverges, a link and a file quietly behave
    // differently on the same screen and nothing says so.
    const viaLink = parseRoutineLink(routineToLink(PROGRAMME));
    const viaFile = parseRoutineMd(routineToMd(PROGRAMME));

    expect(Object.keys(viaLink.items[0]).sort()).toEqual(Object.keys(viaFile.items[0]).sort());
    expect(viaLink.items.map((i) => i.title)).toEqual(viaFile.items.map((i) => i.title));
    expect(viaLink.items.map((i) => i._day)).toEqual(viaFile.items.map((i) => i._day));
    expect(viaLink.items.map((i) => i.repeat)).toEqual(viaFile.items.map((i) => i.repeat));
    expect(viaLink.items.map((i) => i.url)).toEqual(viaFile.items.map((i) => i.url));
  });
});

describe('the link is a link, not a path or a query', () => {
  it('points at this build root with the programme in the fragment', () => {
    const link = routineToLink(PROGRAMME);
    expect(link.startsWith(window.location.origin + '/')).toBe(true);
    expect(link).toContain('#r=');
    // No path beyond the root: every other path on the host is an HTTP 404, so a
    // path-based link gets no preview card and is never cached by the SW.
    expect(link.slice(0, link.indexOf('#'))).toBe(window.location.origin + '/');
  });

  it('spends no characters on base64 that needs escaping', () => {
    // The payload only — the origin legitimately contains '/'. A '+' or '=' in
    // the fragment is what a messenger's link detector trips over.
    const body = routineToLink(PROGRAMME).split('#r=')[1];
    expect(body).not.toMatch(/[+/=]/);
  });

  it('reads a bare fragment and a bare payload, not only a whole URL', () => {
    const link = routineToLink(PROGRAMME);
    const body = link.split('#r=')[1];
    expect(parseRoutineLink('#r=' + body).name).toBe('Shoulder rehab — weeks 1-6');
    expect(parseRoutineLink(body).name).toBe('Shoulder rehab — weeks 1-6');
  });

  it('survives a messenger wrapping the link across lines', () => {
    const body = routineToLink(PROGRAMME).split('#r=')[1];
    const wrapped = '#r=' + body.slice(0, 20) + '\n   ' + body.slice(20);
    expect(parseRoutineLink(wrapped).ok).toBe(true);
  });
});

describe('a link from a stranger cannot smuggle a url', () => {
  // Extends url-safety.test.js's "the item still imports, just neutered"
  // contract to the fourth untrusted source named in safeUrl's header.
  it('blanks every dangerous scheme and keeps the stack', () => {
    const r = parseRoutineLink(linkFor({
      p: 'ppwr', v: 1, n: 'Trap',
      i: [
        { t: 'Tap me', u: 'javascript:alert(1)' },
        { t: 'And me', u: 'data:text/html,<script>alert(1)</script>' },
        { t: 'Protocol relative', u: '//evil.example/x' },
        { t: 'Backslash', u: 'https:/\\/evil.example' },
      ],
    }));

    expect(r.ok).toBe(true);
    expect(r.items.map((i) => i.title)).toEqual(['Tap me', 'And me', 'Protocol relative', 'Backslash']);
    for (const it of r.items) {
      expect(it.url, it.title).toBeUndefined();
      expect(it.embed, it.title).toBeUndefined();
      expect(it.thumbUrl, it.title).toBeUndefined();
    }
  });

  it('refuses to be handed an embed or a thumbnail directly', () => {
    // Even if a crafted payload carries them, they are not read: the only way to
    // get an <iframe src> is a url this app's own itemFromUrl recognises.
    const r = parseRoutineLink(linkFor({
      p: 'ppwr', v: 1, n: 'Trap',
      i: [{ t: 'Sneak', embed: 'https://evil.example/frame', thumbUrl: 'https://evil.example/pic.jpg' }],
    }));
    expect(r.items[0].embed).toBeUndefined();
    expect(r.items[0].thumbUrl).toBeUndefined();
  });

  it('keeps a real, curated https video', () => {
    const r = parseRoutineLink(linkFor({ p: 'ppwr', v: 1, n: 'Ok', i: [{ t: 'Ok', u: 'https://youtu.be/v7AYKMP6rOE' }] }));
    expect(r.items[0].url).toBe('https://youtu.be/v7AYKMP6rOE');
  });

  it('never trusts a repeat value it does not recognise', () => {
    const r = parseRoutineLink(linkFor({ p: 'ppwr', v: 1, n: 'Odd', i: [{ t: 'Thing', r: 'whenever-you-like' }] }));
    expect(r.items[0].repeat).toBeUndefined(); // the default is applied downstream, never the sender's word
  });

  it('clamps an absurd day offset instead of hiding the stack forever', () => {
    // The ceiling is SHARE_MAX_OFFSET, not the AI bridge's four-week
    // PLAN_MAX_OFFSET, which used to govern here and collapsed weeks 5 and 6 of
    // a real six-week programme onto day 27 (share-store-guards.test.jsx).
    const r = parseRoutineLink(linkFor({ p: 'ppwr', v: 1, n: 'Far', i: [{ t: 'Someday', d: 99999 }, { t: 'Negative', d: -5 }] }));
    expect(r.items[0]._day).toBe(SHARE_MAX_OFFSET);
    expect(r.items[1]._day).toBe(0);
  });

  it('drops a nameless stack rather than importing a blank row', () => {
    const r = parseRoutineLink(linkFor({ p: 'ppwr', v: 1, n: 'Mixed', i: [{ t: '' }, 'not an object', null, { t: 'Real' }] }));
    expect(r.ok).toBe(true);
    expect(r.items.map((i) => i.title)).toEqual(['Real']);
  });
});

describe('a programme too long for a link is refused, never truncated', () => {
  it('fits a twenty-stack six-week programme', () => {
    // This is the test that pins the slimming. Every bulk() item carries an
    // embed and a thumbUrl; put those on the wire instead of deriving them and
    // twenty stacks come to roughly 8,450 characters, over budget, and this
    // returns null.
    const link = routineToLink(bulk(20));
    expect(link).not.toBeNull();
    expect(link.length).toBeLessThanOrEqual(LINK_MAX_URL);
    expect(parseRoutineLink(link).items).toHaveLength(20);
  });

  it('returns null when the payload itself is over the URL budget', () => {
    // This test used to be called "returns null for the sixty-stack ceiling"
    // and claimed to pin the sender's item cap. It never did: bulk() items each
    // carry a meta and a url, so sixty of them blow the 8,000-character budget
    // and THAT is what returned null. The item cap is the test below, where the
    // payload is small enough that only a count check can refuse it.
    const link = routineToLink(bulk(60));
    expect(link).toBeNull();
    expect(bulk(60).items).toHaveLength(60); // i.e. not refused for being empty
  });

  it('refuses to BUILD a link over the stack ceiling, however small it would be', () => {
    // Short daily cues: 61 of them fit one URL comfortably, so for three months
    // the sender encoded all of them and the decoder below silently kept 60.
    // The sender refuses instead, and shareRoutine falls back to the .md file,
    // which has no item cap and carries the whole programme.
    const cues = (n) => ({ name: 'Daily cues', items: Array.from({ length: n }, (_, i) => ({ title: 'Day ' + (i + 1) + ' cue' })) });
    const atCeiling = routineToLink(cues(PLAN_MAX_ITEMS));
    expect(atCeiling).not.toBeNull();
    expect(atCeiling.length).toBeLessThan(LINK_MAX_URL / 2); // one more would have fitted
    expect(routineToLink(cues(PLAN_MAX_ITEMS + 1))).toBeNull();
  });

  it('refuses to import more stacks than the app allows, and says how many it left', () => {
    // The decoder keeps its ceiling as the hostile-input guard — a payload the
    // app's own sender would not have built — but the count is now reported, so
    // the receive sheet can say so instead of printing a shortened programme as
    // though it were the whole thing.
    const many = Array.from({ length: 70 }, (_, i) => ({ t: 'Stack ' + i }));
    const r = parseRoutineLink(linkFor({ p: 'ppwr', v: 1, n: 'Flood', i: many }));
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(PLAN_MAX_ITEMS);
    expect(r.dropped).toBe(10);
  });

  it('returns null for a routine with nothing in it', () => {
    expect(routineToLink({ name: 'Empty', items: [] })).toBeNull();
    expect(routineToLink({ name: 'Blank rows', items: [{ title: '  ' }] })).toBeNull();
    expect(routineToLink(null)).toBeNull();
  });
});

describe('a link that is not ours fails quietly', () => {
  const cases = [
    ['nothing at all', ''],
    ['a plain app url', 'https://app.ppwellness.co/'],
    ['someone else\'s fragment', '#login_token=abc'],
    ['outright garbage', '!!!!not-base-64-at-all!!!!'],
    ['valid base64 of something that is not JSON', payload('just a sentence')],
    ['the .md file payload, which has its own trust rules', payload({ ppw: 'routine', v: 1, name: 'x', items: [{ title: 'a' }] })],
    ['our envelope with no stacks', payload({ p: 'ppwr', v: 1, n: 'x', i: [] })],
    ['our envelope with stacks that are not stacks', payload({ p: 'ppwr', v: 1, n: 'x', i: [null, 7] })],
  ];

  for (const [what, input] of cases) {
    it('refuses ' + what, () => {
      const r = parseRoutineLink(input);
      expect(r.ok).toBe(false);
      expect(typeof r.reason).toBe('string');
    });
  }

  it('refuses a payload cut short in transit', () => {
    const body = routineToLink(PROGRAMME).split('#r=')[1];
    expect(parseRoutineLink('#r=' + body.slice(0, body.length - 12)).ok).toBe(false);
  });

  it('refuses a payload longer than this app could ever have produced', () => {
    expect(parseRoutineLink('A'.repeat(LINK_MAX_URL + 1)).ok).toBe(false);
  });

  it('throws for nothing, however it is called', () => {
    for (const input of [undefined, null, 42, {}, [], '   ', '#', '#r=']) {
      expect(() => parseRoutineLink(input)).not.toThrow();
      expect(parseRoutineLink(input).ok).toBe(false);
    }
  });
});
