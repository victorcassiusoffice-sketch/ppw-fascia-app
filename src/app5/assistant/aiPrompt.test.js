// aiPrompt — what we actually tell the user's own AI about them.
//
// This file had no coverage before the Tier 1 correctness pass (2026-09-19).
// Two classes of bug lived here and both were user-visible:
//   • INVENTED FACTS. dayT / obBody / obInterests ship with defaults
//     (store5.js:129-133) and no app5 screen sets them, so every prompt asserted,
//     in the user's own voice, that they wake at 07:00, want to work on "Stress"
//     and enjoy "Meditation".
//   • A LYING HEADROOM. Math.max(1, cap - used) told a user sitting at the cap
//     there was "room for 1 more thing". They went out to their AI, came back,
//     and Apply refused — because addItemsToPlan checks used + adds > cap.
import { describe, it, expect } from 'vitest';
import { buildPrompt, PROMPT_VERSION } from './aiPrompt.js';

const DEFAULTS = {
  dayT: { wake: '07:00', bed: '22:30', ws: '09:00', we: '17:00' },
  obBody: ['Stress'],
  obInterests: ['Meditation'],
};

describe('buildPrompt — only facts the user actually gave us', () => {
  it('says nothing about an untouched profile', () => {
    const p = buildPrompt({ deckItems: [], premium: false, ...DEFAULTS });
    expect(p).not.toContain('usually up at');
    expect(p).not.toContain('I want to work on');
    expect(p).not.toContain('I enjoy');
  });

  it('includes wake and bed once the user has changed them', () => {
    const p = buildPrompt({ ...DEFAULTS, deckItems: [], premium: false, dayT: { wake: '05:45', bed: '21:00' } });
    expect(p).toContain('usually up at 05:45');
    expect(p).toContain('in bed by 21:00');
  });

  it('includes focus areas and interests once they differ from the defaults', () => {
    const p = buildPrompt({ ...DEFAULTS, deckItems: [], premium: false, obBody: ['Lower back', 'Shoulders'], obInterests: ['Cycling'] });
    expect(p).toContain('I want to work on: Lower back, Shoulders.');
    expect(p).toContain('I enjoy: Cycling.');
  });

  it('sends the fasting window, which the user CAN set and we used to drop', () => {
    const p = buildPrompt({ ...DEFAULTS, deckItems: [], premium: false, fastOn: true, eatOpen: '12:00', eatClose: '20:00' });
    expect(p).toContain('I eat between 12:00 and 20:00');
    expect(p).toContain('food-related inside that window');
  });

  it('omits the fasting window when fasting is off', () => {
    const p = buildPrompt({ ...DEFAULTS, deckItems: [], premium: false, fastOn: false, eatOpen: '12:00', eatClose: '20:00' });
    expect(p).not.toContain('I eat between');
  });
});

describe('buildPrompt — headroom tells the truth', () => {
  it('offers the whole free cap on an empty deck, over today and tomorrow', () => {
    const p = buildPrompt({ deckItems: [], premium: false });
    expect(p).toContain('room for 10 more things');
    expect(p).toContain('today and tomorrow');
    expect(p).not.toContain('the next 1 day');
  });

  it('counts real headroom against a part-full deck', () => {
    const deckItems = Array.from({ length: 7 }, (_, i) => ({ id: 'i' + i, title: 't' + i }));
    const p = buildPrompt({ deckItems, premium: false });
    expect(p).toContain('room for 3 more things');
    expect(p).toContain('at most 3 items');
  });

  it('refuses to claim room for 1 when the deck is full', () => {
    const deckItems = Array.from({ length: 10 }, (_, i) => ({ id: 'i' + i, title: 't' + i }));
    const p = buildPrompt({ deckItems, premium: false });
    expect(p).not.toContain('room for 1 more thing');
    expect(p).toContain('completely full');
    expect(p).toContain('do not send me a plan block yet');
  });

  it('treats an over-full deck as full rather than going negative', () => {
    const deckItems = Array.from({ length: 14 }, (_, i) => ({ id: 'i' + i, title: 't' + i }));
    const p = buildPrompt({ deckItems, premium: false });
    expect(p).toContain('completely full');
    expect(p).not.toContain('-4');
  });

  it('gives a premium user the full week', () => {
    const p = buildPrompt({ deckItems: [], premium: true });
    expect(p).toContain('room for 60 more things');
    expect(p).toContain('today and the next 6 days');
  });
});

describe('buildPrompt — the strict output half survives', () => {
  // v6: the blanket URL ban is lifted for ONE field, and only because every id
  // is now checked against YouTube before it is shown (assistant/verifyVideo.js).
  // Everything else stays banned — the ban existed because models fabricate ids.
  it('bans every link except the one video field it can verify', () => {
    const p = buildPrompt({ deckItems: [], premium: false });
    expect(p).toContain('NEVER write any other link, URL, image address or embed');
    expect(p).toContain('Only the video field');
  });

  it('tells the model an unverified id is worse than none', () => {
    const p = buildPrompt({ deckItems: [], premium: false });
    expect(p).toContain('A wrong id is worse than no id');
    expect(p).toContain('I check every id against YouTube');
  });

  it('keeps suggested videos out of medical territory', () => {
    const p = buildPrompt({ deckItems: [], premium: false });
    expect(p).toContain('Never suggest one for treating a condition');
    expect(p).toContain('not medical advice');
  });

  it('still pins the four repeat tokens and the padded time format', () => {
    const p = buildPrompt({ deckItems: [], premium: false });
    expect(p).toContain('"daily"');
    expect(p).toContain('"weekly"');
    expect(p).toContain('"once"');
    expect(p).toContain('Write "07:30"');
  });

  it('carries a version so a prompt change is traceable', () => {
    expect(PROMPT_VERSION).toBeGreaterThanOrEqual(4);
  });
});

// v5: a plan cannot be timed sensibly without knowing when the person sleeps and
// when they work. The open intake (v3) had dropped the questions entirely and
// left it to "only if something essential is genuinely missing".
describe('buildPrompt — it establishes work and sleep before it plans', () => {
  it('names the three things it must know first', () => {
    const p = buildPrompt({ deckItems: [], premium: false });
    expect(p).toContain('when I usually wake up and go to bed');
    expect(p).toContain('what hours I work, and which days');
    expect(p).toContain('already fixed by someone else');
  });

  it('keeps the open intake — sentences, never a form', () => {
    const p = buildPrompt({ deckItems: [], premium: false });
    expect(p).toContain('ordinary sentences');
    expect(p).toContain('never as a numbered form');
    expect(p).toContain('Do NOT ask a numbered questionnaire');
  });

  it('refuses to schedule over sleep or work', () => {
    const p = buildPrompt({ deckItems: [], premium: false });
    expect(p).toContain('Nothing lands while I am asleep or at work');
  });

  it('keeps meals inside the hours the user actually eats', () => {
    const p = buildPrompt({ deckItems: [], premium: false });
    expect(p).toContain('sit with a meal goes inside');
  });
});
