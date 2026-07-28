// Security regression — dangerous URLs must never reach an <a href> / <iframe src>.
// Reproduces the 2026-07-28 finding: parseRoutineMd (imported .md routine) and
// itemFromUrl (pasted share link) both stored raw urls that App5/MediaViewer
// render directly, so a javascript: url executed on tap.
import { describe, it, expect } from 'vitest';
import { safeUrl, parseRoutineMd, itemFromUrl } from './store5.js';

const BAD = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  '  javascript:alert(1)  ',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'blob:https://evil.example/x',
  '//evil.example/x',
  'file:///etc/passwd',
  'https:/\\/evil.example',
  'ftp://evil.example/x',
];
const GOOD = [
  'https://www.youtube.com/watch?v=abc',
  'http://example.com/a?b=c#d',
  'HTTPS://Example.com/UPPER',
];

describe('safeUrl', () => {
  it('rejects every dangerous scheme', () => {
    for (const u of BAD) expect(safeUrl(u), u).toBeUndefined();
  });
  it('allows absolute http(s)', () => {
    for (const u of GOOD) expect(safeUrl(u), u).toBe(u.trim());
  });
  it('rejects non-strings and empties', () => {
    for (const u of [undefined, null, 42, {}, '', '   ']) expect(safeUrl(u)).toBeUndefined();
  });
  it('caps length at 500', () => {
    expect(safeUrl('https://e.com/' + 'a'.repeat(900))).toHaveLength(500);
  });
});

describe('parseRoutineMd — imported routine cannot smuggle a url', () => {
  const md = (items) => '```ppw-routine\n' + JSON.stringify({ ppw: 'routine', v: 1, name: 'x', items }) + '\n```';

  it('strips javascript:/data: from url, embed and thumbUrl', () => {
    const r = parseRoutineMd(md([{
      title: 'Trap',
      url: 'javascript:alert(1)',
      embed: 'data:text/html,<script>alert(1)</script>',
      thumbUrl: 'javascript:alert(3)',
    }]));
    expect(r.ok).toBe(true);
    expect(r.items[0].url).toBeUndefined();
    expect(r.items[0].embed).toBeUndefined();
    expect(r.items[0].thumbUrl).toBeUndefined();
    expect(r.items[0].title).toBe('Trap'); // the item still imports, just neutered
  });

  it('keeps legitimate https urls intact', () => {
    const r = parseRoutineMd(md([{ title: 'Ok', url: 'https://youtu.be/abc' }]));
    expect(r.items[0].url).toBe('https://youtu.be/abc');
  });
});

describe('itemFromUrl — pasted link cannot smuggle a url', () => {
  it('returns null for dangerous schemes', () => {
    for (const u of BAD) expect(itemFromUrl(u), u).toBeNull();
  });
  it('still builds a normal item for http(s)', () => {
    const it = itemFromUrl('https://example.com/thing');
    expect(it).toBeTruthy();
    expect(it.url).toBe('https://example.com/thing');
  });
});
