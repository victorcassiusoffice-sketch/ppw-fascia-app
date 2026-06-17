// Soft tactile pure-logic guard (2026-06-17, staged).
import { describe, it, expect } from 'vitest';
import { gainForLevel, vibrateMsForLevel, DEFAULT_TACTILE } from './lib/softTactile.js';

describe('gainForLevel', () => {
  it('is silent when sound disabled or Level off', () => {
    expect(gainForLevel('firm', 'down', false)).toBe(0);
    expect(gainForLevel('off', 'down', true)).toBe(0);
  });
  it('Firm is louder than Soft on the down-thock', () => {
    expect(gainForLevel('firm', 'down', true)).toBeGreaterThan(gainForLevel('soft', 'down', true));
  });
  it('up-tick is lighter than the down-thock at the same Level', () => {
    expect(gainForLevel('firm', 'up', true)).toBeLessThan(gainForLevel('firm', 'down', true));
  });
});

describe('vibrateMsForLevel', () => {
  it('is 0 when haptics off or Level off', () => {
    expect(vibrateMsForLevel('firm', false)).toBe(0);
    expect(vibrateMsForLevel('off', true)).toBe(0);
  });
  it('Firm vibrates longer than Soft', () => {
    expect(vibrateMsForLevel('firm', true)).toBeGreaterThan(vibrateMsForLevel('soft', true));
  });
});

describe('defaults (Vic 2026-06-17: sound ON, off toggle in Settings)', () => {
  it('sound is ON by default; visual Soft; haptics on', () => {
    expect(DEFAULT_TACTILE.sound).toBe(true);
    expect(DEFAULT_TACTILE.level).toBe('soft');
    expect(DEFAULT_TACTILE.haptics).toBe(true);
  });
});
