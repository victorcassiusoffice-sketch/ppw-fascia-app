// welcomeSteps — the two dialogue boxes a brand-new user meets once, right
// after the wizard, before they have done anything.
//
// This REPLACES the old five-step TOUR_STEPS auto-fire. Five boxes of reading
// before you have touched anything is a wall, not a welcome; the teaching now
// lives in the eight quests, where it happens on the real screen with the
// user's own hands. All the welcome has to do is name the screen and point at
// the guide.
//
// tourSteps.js is kept (the file, not the auto-fire) so nothing that still
// imports TOUR_STEPS breaks.

import { markTourSeen } from './CoachMarks.jsx';
import { startQuest } from './quests5.js';
import { maybeHint } from './hints5.js';
import { markGuideWelcomed } from '../store5.js';

export const WELCOME_STEPS = [
  {
    target: null,
    title: 'Your Stack — the real one.',
    body: 'The one you watched build in the pitch was a demo. This one is yours: everything you mean to do today, in one list, in order — the top card is always the next thing. We put four examples in so it is not empty; tick them off or clear them.',
  },
  {
    target: 'guide',
    title: 'Your guide lives here.',
    body: 'Eight short quests. Each one teaches the app by doing the real thing, and takes about a minute. Do them in any order, stop any time, replay them forever.',
    buttons: [
      {
        label: 'Start the first quest',
        // The welcome runs UNCONTROLLED (it predates any quest), so it marks
        // itself seen and hands over. startQuest opens the controlled coach,
        // which takes the screen from here.
        action: () => { markTourSeen(); markGuideWelcomed(); setTimeout(() => startQuest('tick'), 60); },
      },
      {
        label: 'Later',
        // Not a nag — one soft pulse of the disc, five seconds later, so
        // "later" has somewhere to point when it arrives. Once, ever.
        action: () => { markTourSeen(); markGuideWelcomed(); setTimeout(() => maybeHint('guide-pulse'), 5000); },
      },
    ],
  },
];

export default WELCOME_STEPS;
