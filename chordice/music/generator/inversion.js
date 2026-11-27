/**
 * Sets the inversions of the chords of a song, once the order of every row is final. The choice itself is made in
 * music/theory/melody.js; this file only applies it to the rows, with the seeds and settings of the generator.
 */

import { chooseInversion, melodyTopOf } from '../theory/melody.js';
import { PROBABILITY_MAX } from '../constants.js';
import { chordSlot, unit } from './random.js';

/**
 * Sets the inversion of each chord of the song, row after row and in the order each row shows its chords. Without
 * inversions every chord stays in root position. With inversions on, the melody runs through the whole song: each chord
 * takes the inversion whose melody note is nearest to the melody note of the chord before (see melody.js), the amount
 * deciding how far the others may lie. The first chord of a row follows the last chord of the row before; only the
 * first chord of the song has none.
 */
export function withInversions(rows, settings) {
  if (!settings.inversions) {
    return rows.map((row) => ({ ...row, chords: row.chords.map((chord) => ({ ...chord, inversion: 0 })) }));
  }
  const share = settings.melodyAmount / PROBABILITY_MAX;
  let previousMelody = null;
  return rows.map((row) => ({
    ...row,
    chords: row.chords.map((chord, j) => {
      const u = unit(settings.seeds.melodyChoice, chordSlot(row.index, j));
      const inversion = chooseInversion(chord.tones, previousMelody, share, u);
      previousMelody = melodyTopOf(chord.tones, inversion);
      return { ...chord, inversion };
    }),
  }));
}
