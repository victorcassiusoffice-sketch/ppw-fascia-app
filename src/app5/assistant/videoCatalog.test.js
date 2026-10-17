// PPW picks — the checked list behind "Add a video or link" (2026-10-17).
// The ids were asked of YouTube's oEmbed when they were added (videoCatalog.js
// header); these tests hold the list to the rules it was built under, and pin
// how a stack is matched to it.
import { describe, it, expect } from 'vitest';
import { PPW_PICKS, TOPIC_WORDS, topicsFor, picksFor, searchWordsFor } from './videoCatalog.js';

describe('the list itself', () => {
  it('every pick is a well-formed YouTube id with YouTube\'s title and channel', () => {
    expect(PPW_PICKS.length).toBeGreaterThanOrEqual(12);
    const ids = new Set();
    for (const p of PPW_PICKS) {
      expect(p.yt).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(ids.has(p.yt)).toBe(false); ids.add(p.yt);
      expect(p.title.length).toBeGreaterThan(5);
      expect(p.author.length).toBeGreaterThan(1);
      expect(Object.keys(TOPIC_WORDS)).toContain(p.topic);
    }
  });
  it('keeps the app\'s content rules: no yoga', () => {
    for (const p of PPW_PICKS) expect(`${p.title} ${p.author}`.toLowerCase()).not.toContain('yoga');
  });
  it('every topic has at least one pick', () => {
    for (const t of Object.keys(TOPIC_WORDS)) expect(PPW_PICKS.some((p) => p.topic === t)).toBe(true);
  });
});

describe('matching a stack', () => {
  it('finds the topic in the title or the detail line', () => {
    expect(topicsFor({ title: 'Evening stretch' })).toEqual(['stretch']);
    expect(topicsFor({ title: 'HIIT workout', meta: '20 min' })).toEqual(['hiit']);
    expect(topicsFor({ title: 'Wind down', meta: 'body scan before bed' })[0]).toBe('sleep');
    expect(topicsFor({ title: 'Foam roller', meta: 'myofascial release' })).toEqual(['foam']);
  });
  it('offers nothing for a stack it knows nothing about', () => {
    expect(picksFor({ title: 'Face yoga routine' })).toEqual([]);
    expect(picksFor({ title: 'Call mum' })).toEqual([]);
  });
  it('offers the matched topic\'s picks, at most three', () => {
    const p = picksFor({ title: 'Evening stretch' });
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((x) => x.topic === 'stretch')).toBe(true);
    expect(picksFor({ title: 'Stretch, breathe, walk, sleep' }).length).toBe(3);
  });
  it('searches YouTube for the AI\'s words first, else the stack\'s name', () => {
    expect(searchWordsFor({ title: 'Evening stretch', recQ: '10 minute full body stretch' })).toBe('10 minute full body stretch');
    expect(searchWordsFor({ title: 'Evening stretch' })).toBe('Evening stretch');
  });
});
