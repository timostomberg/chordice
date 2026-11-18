/**
 * Sets the inversions of the chords of a row, once the order of the row is final. The choice itself is made in
 * theory/melody.js; this file only applies it to the row, with the seeds and settings of the generator.
 */

import { chooseInversion, melodyTopOf } from '../theory/melody.js';
import { PROBABILITY_MAX } from '../constants.js';
import { chordSlot, unit } from './utils.js';

/**
 * Sets the inversion of each chord of a row, in the order the row shows them. Without inversions every chord stays in
 * root position. With inversions on, each chord takes the inversion whose melody note is nearest to the melody note of
 * the chord before (see melody.js), the amount deciding how far the others may lie. The first chord of a row has none.
 */
export function withInversions(chords, settings, rowIndex) {
  if (!settings.inversions) {
    return chords.map((chord) => ({ ...chord, inversion: 0 }));
  }
  const share = settings.melodyAmount / PROBABILITY_MAX;
  let previousMelody = null;
  return chords.map((chord, j) => {
    const u = unit(settings.seeds.melodyChoice, chordSlot(rowIndex, j));
    const inversion = chooseInversion(chord.tones, previousMelody, share, u);
    previousMelody = melodyTopOf(chord.tones, inversion);
    return { ...chord, inversion };
  });
}
