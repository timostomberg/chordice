/**
 * The exercises: fixed settings for one kind of practice. While an exercise is on, the options it fixes take its values
 * and are greyed out; the stored values stay and come back when the exercise is off. Only one exercise is on at a time.
 */

import { PROBABILITY_MAX } from '../constants.js';

export const EXERCISES = [
  {
    id: 'circle-ii-v-i',
    name: 'Circle around ii7-V7-Imaj7',
    // The Jazz Cadence through every key of the circle, with only the seventh chords as variations, always chosen.
    settings: {
      selection: ['Jazz / Jazz Cadence'],
      circleOfFifths: true,
      variations: ['7', 'maj7'],
      variationProbability: PROBABILITY_MAX,
      foreignVariations: true,
      rotation: 0,
      permutation: 0,
      bassProbability: 0,
    },
  },
];

/** The exercise with the id, or null. */
export function exerciseById(id) {
  return EXERCISES.find((exercise) => exercise.id === id) ?? null;
}

/** The settings the exercise that is on fixes, or an empty object when no exercise is on. */
export function exerciseSettings(state) {
  return exerciseById(state.exercise)?.settings ?? {};
}
