// parsePlan — tested against what real AI replies actually look like.
// Every fixture here is a shape ChatGPT / Claude / Gemini genuinely produce.
import { describe, it, expect } from 'vitest';
import { extractPlanCandidates } from './parsePlan.js';

const plan = (items, name = 'My week') => ({ ppw: 'routine', v: 2, name, items });
const J = (o) => JSON.stringify(o, null, 2);
const ITEMS = [
  { title: 'Morning walk', meta: '20 min', time: '07:30', dayOffset: 0, repeat: 'daily' },
  { title: 'Box breathing', meta: '5 min', time: '13:00', dayOffset: 0, repeat: 'daily' },
];

describe('extractPlanCandidates — real AI output shapes', () => {
  it('1. clean ```ppw-routine fence', () => {
    const r = extractPlanCandidates('Here is your plan.\n\n```ppw-routine\n' + J(plan(ITEMS)) + '\n```');
    expect(r.ok).toBe(true);
    expect(r.data.items).toHaveLength(2);
    expect(r.tier).toBe(1);
  });

  it('2. ```json label instead (Gemini habit)', () => {
    const r = extractPlanCandidates('Sure!\n\n```json\n' + J(plan(ITEMS)) + '\n```\n\nLet me know!');
    expect(r.ok).toBe(true);
    expect(r.data.items).toHaveLength(2);
  });

  it('3. BARE json, no fence (ChatGPT Copy button strips fences)', () => {
    const r = extractPlanCandidates('Here you go:\n\n' + J(plan(ITEMS)) + '\n\nHope that helps.');
    expect(r.ok).toBe(true);
    expect(r.data.items).toHaveLength(2);
    expect(r.tier).toBe(3);
  });

  it('4. smart/curly DOUBLE quotes are repaired', () => {
    const raw = J(plan(ITEMS)).replace(/"/g, '“');
    const r = extractPlanCandidates('```ppw-routine\n' + raw + '\n```');
    expect(r.ok).toBe(true);
    expect(r.data.items).toHaveLength(2);
  });

  it('5. trailing commas are repaired', () => {
    const bad = '{"ppw":"routine","v":2,"name":"x","items":[{"title":"A","time":"07:00"},]}';
    const r = extractPlanCandidates('```ppw-routine\n' + bad + '\n```');
    expect(r.ok).toBe(true);
    expect(r.data.items).toHaveLength(1);
  });

  it('6. // comments outside strings are stripped', () => {
    const bad = '{"ppw":"routine","v":2,"name":"x", // the plan\n"items":[{"title":"A"}]}';
    const r = extractPlanCandidates('```ppw-routine\n' + bad + '\n```');
    expect(r.ok).toBe(true);
  });

  it('7. TRUNCATED block reports truncated, never a partial import', () => {
    const cut = J(plan(ITEMS)).slice(0, 60);
    const r = extractPlanCandidates('```ppw-routine\n' + cut);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('truncated');
  });

  it('8. TWO distinct plans → picks the richer AND flags alternates', () => {
    const small = plan([ITEMS[0]], 'Draft');
    const big = plan(ITEMS.concat({ title: 'Evening stretch', time: '20:00' }), 'Final');
    const r = extractPlanCandidates(
      'First draft:\n```ppw-routine\n' + J(small) + '\n```\n\nBetter:\n```ppw-routine\n' + J(big) + '\n```'
    );
    expect(r.ok).toBe(true);
    expect(r.data.items).toHaveLength(3);
    expect(r.alternates.length).toBeGreaterThan(0); // preview must ask
  });

  it('9. the same plan echoed twice is NOT an ambiguity', () => {
    const b = '```ppw-routine\n' + J(plan(ITEMS)) + '\n```';
    const r = extractPlanCandidates(b + '\n\nagain:\n\n' + b);
    expect(r.ok).toBe(true);
    expect(r.alternates).toHaveLength(0);
  });

  it('10. prose only → no-block', () => {
    const r = extractPlanCandidates('Sure! Wake at 7, walk 20 minutes, then breathe.');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-block');
  });

  it('11. empty / whitespace → no-block', () => {
    expect(extractPlanCandidates('').reason).toBe('no-block');
    expect(extractPlanCandidates('   \n  ').reason).toBe('no-block');
  });

  it('12. right shape but items missing → bad-shape', () => {
    const r = extractPlanCandidates('```ppw-routine\n{"ppw":"routine","v":2,"name":"x"}\n```');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bad-shape');
  });

  it('13. zero-width chars (copy/paste artefacts) survive', () => {
    const r = extractPlanCandidates('​```ppw-routine​\n' + J(plan(ITEMS)) + '\n```');
    expect(r.ok).toBe(true);
  });

  it('14. non-breaking spaces survive', () => {
    const r = extractPlanCandidates('```ppw-routine\n' + J(plan(ITEMS)).replace(/ /g, ' ') + '\n```');
    expect(r.ok).toBe(true);
  });

  it('15. curly APOSTROPHES inside titles are preserved, not corrupted', () => {
    const r = extractPlanCandidates('```ppw-routine\n' + J(plan([{ title: 'Dad’s walk', time: '08:00' }])) + '\n```');
    expect(r.ok).toBe(true);
    expect(r.data.items[0].title).toBe('Dad’s walk');
  });

  it('16. huge paste is scanned from the END, where the block lives', () => {
    const r = extractPlanCandidates('filler '.repeat(50000) + '\n```ppw-routine\n' + J(plan(ITEMS)) + '\n```');
    expect(r.ok).toBe(true);
  });
});
