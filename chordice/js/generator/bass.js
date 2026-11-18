/**
 * Chooses the bass note of a chord from the bass patterns (see validate.js). A chord without a bass note keeps its
 * standard bass, the root. Every choice is taken from the seeds in utils.js.
 */

import { Note } from 'tonal';
import { PROBABILITY_MAX } from '../constants.js';
import { unit, weightedPick } from './utils.js';

// No bass patterns: every chord keeps its standard bass.
export const NO_BASS_PATTERNS = { degrees: {}, variations: {} };

/**
 * The bass notes a chord can take: the entries of its roman numeral and of its chord variation, each with its commonness.
 * A bass note must be a tone of the chord; the entry "1" is the standard bass (the root).
 */
export function bassCandidates(bassPatterns, root, numeral, variation, tones) {
  const entries = [
    ...(bassPatterns.degrees[numeral] ?? []),
    ...(variation === null ? [] : bassPatterns.variations[variation] ?? []),
  ];
  const chromas = new Set(tones.map((tone) => Note.chroma(tone)));
  return entries
    .map(({ interval, weight }) => ({ value: Note.transpose(root, interval), weight }))
    .filter((candidate) => chromas.has(Note.chroma(candidate.value)));
}

/**
 * The bass note of one chord, or null if the chord keeps its standard bass. The chord gets a bass note with the
 * probability `bassProbability` (on the scale of PROBABILITY_MAX), and the note is chosen by its commonness.
 * A bass note equal to the root is the standard bass, so it is not returned as a bass note.
 */
export function chooseBass({ bassPatterns, bassProbability, seeds, slot, root, numeral, variation, tones }) {
  if (unit(seeds.bassActive, slot) >= bassProbability / PROBABILITY_MAX) {
    return null;
  }
  const picked = weightedPick(bassCandidates(bassPatterns, root, numeral, variation, tones), seeds.bassChoice, slot);
  if (picked === null || Note.chroma(picked.value) === Note.chroma(root)) {
    return null;
  }
  return picked.value;
}
