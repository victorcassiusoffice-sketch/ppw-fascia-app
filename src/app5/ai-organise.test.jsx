// Vic, 2026-10-17: "a JSON engine that takes the AI's reply on all the stacks
// and organises them; recommended YouTube videos per stack the user can add; a
// little tutorial — would you like to add a video or link to this?"
//
// End to end through the real sheets, with YouTube's oEmbed answered by a stub:
// a real id answers 200 with a title, anything else 400 — the two answers the
// app has to tell apart.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import {
  setState, getState, applyPlanDiff, undoPlanDiff, attachMedia, detachMedia, videoable,
  openVideoPicker, dateKeyFromOffset,
} from './store5.js';
import { refMapFor } from './assistant/aiPrompt.js';
import AiBridgeSheet, { recsFor } from './assistant/AiBridgeSheet.jsx';
import VideoPicker from './screens/VideoPicker.jsx';

const REAL = { yLDAHd_C7G0: { title: '10 MIN DAILY STRETCH', author_name: 'MadFit' }, tybOi4hjZFQ: { title: 'Guided Wim Hof Method Breathing', author_name: 'Wim Hof' } };
function stubYouTube() {
  const f = vi.fn(async (url) => {
    const m = /watch%3Fv%3D([A-Za-z0-9_-]{11})/.exec(String(url));
    const hit = m && REAL[m[1]];
    return hit ? new Response(JSON.stringify(hit), { status: 200 }) : new Response('Bad Request', { status: 400 });
  });
  vi.stubGlobal('fetch', f);
  return f;
}

const DECK = () => ([
  { id: 'a', title: 'Morning stretch', meta: '10 min', time: '07:30', repeat: 'daily', anchor: dateKeyFromOffset(-5) },
  { id: 'b', title: 'Box breathing', time: '13:00', repeat: 'daily', anchor: dateKeyFromOffset(-2), url: 'https://www.youtube.com/watch?v=tybOi4hjZFQ', auto: true },
  { id: 'c', title: 'Long run', time: '18:00', repeat: 'weekly', anchor: dateKeyFromOffset(-3) },
  { id: 'n', title: 'I am doing enough.', time: '21:30', repeat: 'daily', kind: 'note' },
]);

beforeEach(() => {
  localStorage.clear();
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  setState({ deckItems: DECK(), doneByDate: {}, aiOpen: false, videoFor: null, aiRefs: null, onboarded: true, selectedIds: [], premium: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('applyPlanDiff / undoPlanDiff', () => {
  it('changes in place, adds, removes — and Undo puts every one back', () => {
    const before = getState().deckItems;
    const res = applyPlanDiff({
      updates: [{ id: 'a', patch: { time: '06:45', recs: [{ yt: 'yLDAHd_C7G0', title: 'x', author: 'y' }], id: 'HACK', url: 'javascript:alert(1)' } }],
      adds: [{ title: 'Evening walk', time: '19:00', _day: 0, _repeat: 'daily', _ref: 's9', _videos: [{ q: 'walk' }] }],
      removeIds: ['c'],
    });
    expect(res.ok).toBe(true);
    const S = getState();
    const a = S.deckItems.find((x) => x.id === 'a');
    expect(a.time).toBe('06:45');
    expect(a.recs).toHaveLength(1);
    expect(a.url).toBeUndefined();            // only whitelisted fields reach a stack
    expect(S.deckItems.find((x) => x.id === 'HACK')).toBeUndefined();
    const walk = S.deckItems.find((x) => x.title === 'Evening walk');
    expect(walk && Object.keys(walk).some((k) => k.startsWith('_'))).toBe(false);
    expect(S.deckItems.find((x) => x.id === 'c')).toBeUndefined();
    // Box breathing kept its video and AUTO — it was never touched
    expect(S.deckItems.find((x) => x.id === 'b').auto).toBe(true);

    undoPlanDiff(res);
    const back = getState().deckItems;
    expect(back.map((x) => x.id).sort()).toEqual(before.map((x) => x.id).sort());
    expect(back.find((x) => x.id === 'a').time).toBe('07:30');
    expect(back.find((x) => x.id === 'a').recs).toBeUndefined();
  });

  it('a stack that only gains suggestions keeps its example badge; a changed one loses it', () => {
    setState({ deckItems: [{ ...DECK()[0], example: true }, { ...DECK()[2], example: true }] });
    applyPlanDiff({ updates: [
      { id: 'a', patch: { recs: [{ yt: 'yLDAHd_C7G0', title: 't', author: 'a' }] }, keepExample: true },
      { id: 'c', patch: { time: '17:00' } },
    ] });
    const S = getState();
    expect(S.deckItems.find((x) => x.id === 'a').example).toBe(true);
    expect(S.deckItems.find((x) => x.id === 'c').example).toBeUndefined();
  });
});

describe('a video on a stack', () => {
  it('attaches only an https link, and comes off cleanly', () => {
    expect(attachMedia('a', { url: 'javascript:alert(1)' }).ok).toBe(false);
    expect(attachMedia('a', { url: 'https://www.youtube.com/watch?v=yLDAHd_C7G0', embed: 'https://www.youtube.com/embed/yLDAHd_C7G0?playsinline=1&rel=0', thumb: 'yt', title: '10 MIN DAILY STRETCH', author: 'MadFit' }).ok).toBe(true);
    let a = getState().deckItems.find((x) => x.id === 'a');
    expect(a.title).toBe('Morning stretch');           // the stack keeps its own name
    expect(a.mediaTitle).toBe('10 MIN DAILY STRETCH');
    detachMedia('a');
    a = getState().deckItems.find((x) => x.id === 'a');
    expect(a.url).toBeUndefined();
    expect(a.auto).toBe(false);
  });
  it('notes, documents, protocols and supplement slots never take one', () => {
    expect(videoable({ id: 'x' })).toBe(true);
    for (const kind of ['note', 'doc', 'pdf', 'supp']) expect(videoable({ id: 'x', kind })).toBe(false);
  });
  it('keeps only suggestions YouTube confirmed, with YouTube\'s words', () => {
    const { recs, recQ } = recsFor(
      [{ q: 'stretch', yt: 'yLDAHd_C7G0' }, { q: 'fake', yt: 'AAAAAAAAAAA' }, { q: 'no id' }],
      [{ state: 'ok', id: 'yLDAHd_C7G0', title: 'Real title', author: 'MadFit' }, { state: 'no' }],
    );
    expect(recs).toEqual([{ yt: 'yLDAHd_C7G0', title: 'Real title', author: 'MadFit' }]);
    expect(recQ).toBe('stretch');
  });
});

describe('Talk to your AI — organise, end to end', () => {
  const reply = (refs) => [
    'Here is your organised week.',
    '```ppw-routine',
    JSON.stringify({ ppw: 'routine', v: 3, name: 'Calmer week', items: [
      { ref: refs.a, title: 'Morning stretch', time: '06:45', repeat: 'daily', videos: [{ q: 'morning stretch 10 min', yt: 'yLDAHd_C7G0' }, { q: 'fake', yt: 'ZZZZZZZZZZZ' }] },
      { ref: refs.b, title: 'Box breathing', time: '13:00', repeat: 'daily' },
      { title: 'Evening walk', meta: '20 min', time: '19:00', repeat: 'daily', videos: [{ q: 'evening walk' }] },
    ] }),
    '```',
  ].join('\n');

  it('defaults to organising, previews each change, applies, offers a video, and undoes', async () => {
    stubYouTube();
    act(() => setState({ aiOpen: true }));
    render(<><AiBridgeSheet /><VideoPicker /></>);
    // organise is the default with stacks on the day
    expect(screen.getByText('Organise my stacks').closest('button').getAttribute('aria-pressed')).toBe('true');
    act(() => { fireEvent.click(screen.getByText('I’ve already got a reply →')); });
    // the refs were remembered the moment the user moved on
    const remembered = getState().aiRefs.map;
    expect(remembered).toEqual(refMapFor(DECK()).map);
    const ids = Object.fromEntries(Object.entries(remembered).map(([ref, id]) => [id, ref]));

    fireEvent.change(screen.getByLabelText('Paste your AI\'s reply'), { target: { value: reply({ a: ids.a, b: ids.b }) } });
    act(() => { fireEvent.click(screen.getByText('See my plan')); });

    expect(screen.getByText('Changes to your stacks')).toBeTruthy();
    expect(screen.getByText('07:30 → 06:45')).toBeTruthy();
    expect(screen.getByText('New stacks')).toBeTruthy();
    expect(screen.getByText('Evening walk')).toBeTruthy();
    expect(screen.getByText('To remove')).toBeTruthy();
    expect(screen.getByText('Long run')).toBeTruthy();
    expect(screen.getByText(/1 stack stays the same/)).toBeTruthy();   // astra-tester P3, 18 Oct: was "stay"
    await waitFor(() => expect(screen.getByText(/1 of 2 videos found/)).toBeTruthy());

    // removing asks twice
    act(() => { fireEvent.click(screen.getByText('Apply 3 changes')); });
    expect(screen.getByText(/Tap again to confirm/)).toBeTruthy();
    act(() => { fireEvent.click(screen.getByText('Yes — apply 3 changes')); });

    const S = getState();
    const a = S.deckItems.find((x) => x.id === 'a');
    expect(a.time).toBe('06:45');
    expect(a.recs).toEqual([{ yt: 'yLDAHd_C7G0', title: '10 MIN DAILY STRETCH', author: 'MadFit' }]);
    expect(a.url).toBeUndefined();               // suggested, never attached by itself
    expect(S.deckItems.find((x) => x.id === 'b').auto).toBe(true);
    expect(S.deckItems.find((x) => x.id === 'c')).toBeUndefined();
    expect(S.deckItems.find((x) => x.id === 'n')).toBeTruthy();   // the private note is never touched
    const walk = S.deckItems.find((x) => x.title === 'Evening walk');
    expect(walk.recQ).toBe('evening walk');

    // the little tutorial
    expect(screen.getByText('Your stacks are organised')).toBeTruthy();
    expect(screen.getByText('Would you like to add a video or link to these?')).toBeTruthy();
    expect(screen.getByText('1 suggested by your AI')).toBeTruthy();
    const addBtns = screen.getAllByText('Add a video');
    act(() => { fireEvent.click(addBtns[0]); });
    expect(getState().videoFor).toBeTruthy();
    expect(screen.getByText('Suggested by your AI')).toBeTruthy();
    expect(screen.getByText('10 MIN DAILY STRETCH')).toBeTruthy();
    act(() => { fireEvent.click(screen.getAllByText('Add')[0]); });
    const after = getState().deckItems.find((x) => x.id === 'a');
    expect(after.url).toBe('https://www.youtube.com/watch?v=yLDAHd_C7G0');
    expect(after.embed).toContain('/embed/yLDAHd_C7G0');
    expect(after.embed).not.toContain('autoplay=1');

    // Undo puts it all back, including the removed run
    act(() => { fireEvent.click(screen.getByText('Undo — put it all back')); });
    const back = getState().deckItems;
    expect(back.find((x) => x.id === 'c')).toBeTruthy();
    expect(back.find((x) => x.title === 'Evening walk')).toBeUndefined();
    expect(back.find((x) => x.id === 'a').time).toBe('07:30');
  });

  // astra-tester P3, 18 Oct: the last step said "✓ Video added" for a stack that
  // had its video before the organise (Full-body stretch on the live demo).
  it('says a moved stack that already had its video "Has a video", not "Video added"', async () => {
    stubYouTube();
    act(() => setState({ aiOpen: true }));
    render(<><AiBridgeSheet /><VideoPicker /></>);
    act(() => { fireEvent.click(screen.getByText('I’ve already got a reply →')); });
    const ids = Object.fromEntries(Object.entries(getState().aiRefs.map).map(([ref, id]) => [id, ref]));
    const moved = ['```ppw-routine', JSON.stringify({ ppw: 'routine', v: 3, name: 'Later breathing', items: [
      { ref: ids.a, title: 'Morning stretch', time: '07:30', repeat: 'daily' },
      { ref: ids.b, title: 'Box breathing', time: '14:00', repeat: 'daily' },
      { ref: ids.c, title: 'Long run', time: '18:00', repeat: 'weekly' },
    ] }), '```'].join('\n');
    fireEvent.change(screen.getByLabelText('Paste your AI\'s reply'), { target: { value: moved } });
    act(() => { fireEvent.click(screen.getByText('See my plan')); });
    expect(screen.getByText('13:00 → 14:00')).toBeTruthy();
    expect(screen.getByText(/2 stacks stay the same/)).toBeTruthy();
    act(() => { fireEvent.click(screen.getByText('Apply 1 change')); });
    expect(screen.getByText('Would you like to add a video or link to these?')).toBeTruthy();
    expect(screen.getByText('✓ Has a video')).toBeTruthy();
    expect(screen.queryByText(/Video added/)).toBeNull();
  });
});

describe('Talk to your AI — keep what I have, add new things', () => {
  it('adds the new stacks with their checked videos as suggestions, then offers to add one', async () => {
    stubYouTube();
    act(() => setState({ aiOpen: true }));
    render(<><AiBridgeSheet /><VideoPicker /></>);
    act(() => { fireEvent.click(screen.getByText('Keep them, add new things')); });
    act(() => { fireEvent.click(screen.getByText('I’ve already got a reply →')); });
    const text = '```ppw-routine\n' + JSON.stringify({ ppw: 'routine', v: 3, name: 'Extras', items: [
      { title: 'Lunch breathing', time: '12:30', repeat: 'daily', videos: [{ q: 'wim hof breathing', yt: 'tybOi4hjZFQ' }] },
      { title: 'Walk after dinner', time: '19:30', repeat: 'daily' },
    ] }) + '\n```';
    fireEvent.change(screen.getByLabelText('Paste your AI\'s reply'), { target: { value: text } });
    act(() => { fireEvent.click(screen.getByText('See my plan')); });
    await waitFor(() => expect(screen.getByText(/1 of 1 video found/)).toBeTruthy());
    act(() => { fireEvent.click(screen.getByText('Add 2 to my day')); });
    const S = getState();
    const lunch = S.deckItems.find((x) => x.title === 'Lunch breathing');
    expect(lunch.recs).toEqual([{ yt: 'tybOi4hjZFQ', title: 'Guided Wim Hof Method Breathing', author: 'Wim Hof' }]);
    expect(lunch.url).toBeUndefined();
    expect(S.deckItems.find((x) => x.id === 'c')).toBeTruthy();          // nothing removed in this mode
    expect(screen.getByText('Added to your day')).toBeTruthy();
    expect(screen.getByText('Would you like to add a video or link to these?')).toBeTruthy();
    expect(screen.getByText('1 suggested by your AI')).toBeTruthy();
  });
});

describe('a YouTube link pasted in the Add sheet', () => {
  it('takes YouTube\'s own title and channel, and never overwrites a rename', async () => {
    const { addCustomUrl, titleFromYouTube } = await import('./store5.js');
    const r = addCustomUrl('https://youtu.be/yLDAHd_C7G0');
    expect(r.item.title).toBe('YouTube video');
    titleFromYouTube(r.item.id, '10 MIN DAILY STRETCH', 'MadFit');
    let it = getState().deckItems.find((x) => x.id === r.item.id);
    expect(it.title).toBe('10 MIN DAILY STRETCH');
    expect(it.meta).toBe('YouTube · MadFit');
    const r2 = addCustomUrl('https://youtu.be/tybOi4hjZFQ');
    setState({ deckItems: getState().deckItems.map((x) => (x.id === r2.item.id ? { ...x, title: 'My breathing' } : x)) });
    titleFromYouTube(r2.item.id, 'Guided Wim Hof Method Breathing', 'Wim Hof');
    it = getState().deckItems.find((x) => x.id === r2.item.id);
    expect(it.title).toBe('My breathing');
  });
});

describe('the video picker on its own', () => {
  it('searches YouTube for the stack and checks a pasted link with YouTube', async () => {
    stubYouTube();
    act(() => openVideoPicker('a'));
    render(<VideoPicker />);
    const search = screen.getByText(/Search YouTube for/).closest('a');
    expect(search.getAttribute('href')).toBe('https://www.youtube.com/results?search_query=Morning%20stretch');
    fireEvent.change(screen.getByLabelText('Paste a video or link'), { target: { value: 'https://youtu.be/ZZZZZZZZZZZ' } });
    await waitFor(() => expect(screen.getByText(/YouTube says that video is not available/)).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Paste a video or link'), { target: { value: 'https://youtu.be/yLDAHd_C7G0' } });
    await waitFor(() => expect(screen.getByText('10 MIN DAILY STRETCH')).toBeTruthy());
    // "Morning stretch" also matches the PPW stretch picks, so there is more than
    // one Add on screen: take the one in the pasted video's own row.
    const row = screen.getByText('10 MIN DAILY STRETCH').parentElement.parentElement;
    act(() => { fireEvent.click(within(row).getByText('Add')); });
    expect(getState().deckItems.find((x) => x.id === 'a').mediaTitle).toBe('10 MIN DAILY STRETCH');
  });
  it('offers PPW picks that match the stack, and adds one', () => {
    act(() => openVideoPicker('a'));   // "Morning stretch"
    render(<VideoPicker />);
    expect(screen.getByText('PPW picks')).toBeTruthy();
    const pick = screen.getByText('10 Minute Total Body Stretch! [Daily Flexibility Routine for Beginners]').parentElement.parentElement;
    act(() => { fireEvent.click(within(pick).getByText('Add')); });
    const a = getState().deckItems.find((x) => x.id === 'a');
    expect(a.url).toBe('https://www.youtube.com/watch?v=COO2S7lPBzA');
    expect(a.mediaBy).toBe('Tone and Tighten');
  });
  it('a Spotify link is added as a link', () => {
    act(() => openVideoPicker('c'));
    render(<VideoPicker />);
    fireEvent.change(screen.getByLabelText('Paste a video or link'), { target: { value: 'https://open.spotify.com/playlist/37i9dQZF1DX4PP3DA4J0N8' } });
    act(() => { fireEvent.click(screen.getByText('Add this link')); });
    const c = getState().deckItems.find((x) => x.id === 'c');
    expect(c.url).toBe('https://open.spotify.com/playlist/37i9dQZF1DX4PP3DA4J0N8');
    expect(c.thumb).toBe('sp');
  });
  it('closes on Escape', () => {
    act(() => openVideoPicker('a'));
    render(<VideoPicker />);
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(getState().videoFor).toBeNull();
  });
});
