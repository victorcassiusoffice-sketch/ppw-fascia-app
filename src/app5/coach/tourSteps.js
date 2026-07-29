// tourSteps — the 5 dialogue boxes shown over the real UI after onboarding.
// Plain language, one idea each, no jargon. `target` matches a [data-tour="…"]
// attribute in App5; a step with no target is centred.

export const TOUR_STEPS = [
  {
    target: null,
    title: 'This is your Stack',
    body: 'Everything you mean to do today, in one list, in order. Tick things off as you go — tomorrow it rebuilds itself.',
  },
  {
    target: 'next-up',
    title: 'Next up is what matters now',
    body: 'The top card is the one thing to do next. Tap Done when you finish it, or Snooze to push it later.',
  },
  {
    target: 'add',
    title: 'Add anything here',
    body: 'A video, a note to yourself, a supplement, a protocol — or let your own AI plan the whole day for you, free.',
  },
  {
    target: 'library',
    title: 'Your Library holds it all',
    body: 'Everything you can drop into a day lives here: routines, media, protocols and supplements.',
  },
  {
    target: 'calendar',
    title: 'Plan any day',
    body: 'Every date keeps its own stack. Tap a day to fill it in advance — your week, sorted.',
  },
];
