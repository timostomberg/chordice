/**
 * Tones and chords judged against a key: diatonic tones, tones a chord variation adds, and tones foreign to the key.
 *
 * Notes are spelled as strings such as "C", "F#" or "Bb".
 */

import { Note } from 'tonal';
import { buildChord } from './chords.js';

// Semitones from the tonic of the seven notes of a major scale.
const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

/** True if a tone belongs to the major scale of the tonic, i.e. is not foreign to the key. Spelling does not matter. */
export function isDiatonic(tone, tonic) {
  const steps = (Note.chroma(tone) - Note.chroma(tonic) + 12) % 12;
  return MAJOR_SCALE_STEPS.includes(steps);
}

/**
 * True if the chord with its variation has no tone foreign to the key `tonic`, i.e. every tone is in the major scale.
 * The base triad counts too: a chord that is foreign already, such as bVII in C, has no such variation.
 */
export function isDiatonicChord(root, quality, variation, tonic) {
  return buildChord(root, quality, variation).tones.every((tone) => isDiatonic(tone, tonic));
}

/** True if a tone is not part of the base triad (root, third, fifth) of the chord, i.e. the chord variation adds it. */
export function isVariationTone(tone, root, quality) {
  const triad = buildChord(root, quality, null).tones.map((name) => Note.chroma(name));
  return !triad.includes(Note.chroma(tone));
}

/**
 * How a chord tone is judged in the key `tonic`: 'foreign' if it is not in the major scale of the key, 'variation' if the
 * chord variation adds it, and '' otherwise. Foreign takes precedence when a tone is both. Shown as red or blue.
 */
export function toneKind(tone, chord, tonic) {
  if (!isDiatonic(tone, tonic)) {
    return 'foreign';
  }
  return isVariationTone(tone, chord.root, chord.quality) ? 'variation' : '';
}
