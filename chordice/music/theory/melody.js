/**
 * The melody note of a chord, chosen from its inversions. Every inversion has one top tone (see melodyTopOf), so choosing
 * the melody note chooses the inversion. The melody note is the nearer to the melody note of the chord before, the more
 * likely it is: the nearest one is always the most likely, and the amount decides how far the others may lie.
 */

import { Note } from 'tonal';

/**
 * The chord tones in the order of one inversion, the lowest note first. Inversion k puts the tone at index k at the
 * bottom, and the remaining tones follow in ascending order of their distance above it, so every tone lies within one
 * octave of the bass and no tone jumps over another. Inversion 0 is the root position and is voiced the same way.
 * For a triad this is the plain rotation of the chord tones.
 */
export function invertedTones(tones, inversion = 0) {
  if (!Number.isInteger(inversion) || inversion < 0 || inversion >= tones.length) {
    throw new Error(`Inversion ${inversion} does not exist for ${tones.length} chord tones`);
  }
  const bass = tones[inversion];
  const above = tones
    .filter((_, index) => index !== inversion)
    .map((tone, index) => ({ tone, steps: (Note.chroma(tone) - Note.chroma(bass) + 12) % 12, index }))
    .sort((a, b) => a.steps - b.steps || a.index - b.index)
    .map(({ tone }) => tone);
  return [bass, ...above];
}

/** The top melody note of a chord in one inversion: the highest tone of its stacked order, which is the last one. */
export function melodyTopOf(tones, inversion = 0) {
  return invertedTones(tones, inversion).at(-1);
}

/**
 * The distance between two notes in semitones, ignoring the octave: the shorter way round the twelve pitch classes,
 * so 0 to 6. A fifth (7 semitones) counts as a fourth (5).
 */
export function pitchDistance(a, b) {
  const steps = Math.abs(Note.chroma(a) - Note.chroma(b));
  return Math.min(steps, 12 - steps);
}

/** Every inversion of a chord with its melody note: the top tone of that inversion. */
export function melodyChoices(tones) {
  return tones.map((_, inversion) => ({ inversion, melody: melodyTopOf(tones, inversion) }));
}

/**
 * Chooses the inversion of a chord, and with it the melody note.
 *
 * `previousMelody` is the melody note of the chord before in the same row, or null for the first chord, which has nothing
 * to be near to: every inversion is then equally likely. Otherwise an inversion whose melody note lies `d` semitones from
 * the previous one (see pitchDistance) gets the weight share^(d - nearest), where `nearest` is the smallest such distance.
 * `share` is the amount on a scale from 0 to 1: at 0 only the nearest melody notes are chosen, at 1 every inversion is
 * equally likely. Inversions at the same distance share the same weight, so two equally near notes are chosen 50/50.
 *
 * `u` is a number in [0, 1) that decides the choice. Returns the index of the inversion.
 */
export function chooseInversion(tones, previousMelody, share, u) {
  const choices = melodyChoices(tones);
  if (previousMelody === null) {
    return choices[Math.min(Math.floor(u * choices.length), choices.length - 1)].inversion;
  }
  const distances = choices.map(({ melody }) => pitchDistance(melody, previousMelody));
  const nearest = Math.min(...distances);
  const weights = distances.map((distance) => share ** (distance - nearest));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = u * total;
  for (let k = 0; k < choices.length; k += 1) {
    threshold -= weights[k];
    if (threshold < 0) {
      return choices[k].inversion;
    }
  }
  return choices.at(-1).inversion;
}
