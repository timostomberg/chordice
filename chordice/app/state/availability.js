/**
 * Which options are available, and the settings that take effect. An option can be unavailable because the chosen
 * instrument does not use it, because the circle of fifths switch fixes it, or because the exercise that is on fixes it.
 * An unavailable option is greyed out and cannot be changed; its stored value stays in the state and comes back once it is
 * available again. Every function here is pure and derives its result from the stored state.
 */

import { CIRCLE_COUNT } from './state.js';
import { exerciseSettings } from './exercises.js';

/**
 * The options the guitar does not use: it has no bass variations, no inversions, so no melody note, and no chord tones
 * column. They stay in the state with their values, and take effect again when the piano is chosen.
 */
const GUITAR_UNAVAILABLE = ['bassProbability', 'inversions', 'tones'];

/**
 * The state with the settings of the exercise that is on; the stored values of every other option. Its options show these
 * values, also while they are greyed out.
 */
export function exerciseState(state) {
  return { ...state, ...exerciseSettings(state) };
}

/** Whether the exercise that is on fixes the option, so that it is greyed out and cannot be changed. */
export function isLocked(state, option) {
  return Object.hasOwn(exerciseSettings(state), option);
}

/**
 * Whether an option is unavailable, so that it is greyed out and does not take effect, or takes the value of the exercise
 * that is on. The melody variations need the melody note: they are unavailable on the guitar, and on the piano while the
 * inversions switch (the melody button) is off. The number of progressions and the key on the circle are unavailable
 * while the circle of fifths switch is on, also when an exercise switches it on.
 */
export function isUnavailable(state, option) {
  if (isLocked(state, option)) {
    return true;
  }
  // The circle of fifths switch fixes the number of progressions at one per key.
  if (option === 'count' || option === 'key') {
    return exerciseState(state).circleOfFifths === true;
  }
  if (option === 'melodyAmount') {
    return state.instrument === 'guitar' || !state.inversions;
  }
  return state.instrument === 'guitar' && GUITAR_UNAVAILABLE.includes(option);
}

/**
 * The settings that take effect: the exercise that is on sets its options, and options the chosen instrument does not use
 * count as off; the stored values stay. With the circle of fifths switch on, the count is one row per key; the stored
 * count comes back when it is off.
 */
export function effectiveState(state) {
  const fixed = exerciseState(state);
  const offForInstrument = (option) => !isLocked(state, option) && isUnavailable(state, option);
  return {
    ...fixed,
    count: isUnavailable(state, 'count') ? CIRCLE_COUNT : state.count,
    bassProbability: offForInstrument('bassProbability') ? 0 : fixed.bassProbability,
    melodyAmount: offForInstrument('melodyAmount') ? 0 : fixed.melodyAmount,
    inversions: fixed.inversions && !offForInstrument('inversions'),
    tones: fixed.tones && !offForInstrument('tones'),
  };
}

/**
 * The display switches of the chords, which the rows and the chord box of the notes window both follow: the colours, the
 * roman numerals, the chord tones, and the melody note (shown while the inversions take effect).
 */
export function displaySwitches(state) {
  const effective = effectiveState(state);
  return { colour: effective.colour, roman: effective.roman, tones: effective.tones, melody: effective.inversions };
}
