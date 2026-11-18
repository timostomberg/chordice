/**
 * Chords: the supported variations and how a chord is built from its root and quality.
 *
 * Notes are spelled as strings such as "C", "F#" or "Bb".
 */

import { Chord } from 'tonal';

/** Chord variations (variations) as listed in the data files, in display order. `base` is not one of them. */
export const VARIATION_NAMES = [
  '7', 'maj7', '6', 'add9', 'sus2', 'sus4', '9', 'maj9', '11', 'maj11', '13', 'maj13', '6/9', '5',
  '7sus4', '7b9', '7#9', '7b13', '7#5', '7b5', '7#11',
];

const SUSPENDED = new Set(['sus2', 'sus4', '7sus4']);

/**
 * Builds a chord from its root, quality ("major" or "minor") and optional variation.
 * Returns the chord symbol (e.g. "Am7") and the chord tones as spelled by tonal.
 * Throws for combinations that tonal cannot spell.
 */
export function buildChord(root, quality, variation = null) {
  if (variation !== null && !VARIATION_NAMES.includes(variation)) {
    throw new Error(`Unknown chord variation: ${variation}`);
  }
  const suspended = variation !== null && SUSPENDED.has(variation);
  const symbol = root + (quality === 'minor' && !suspended ? 'm' : '') + (variation ?? '');
  const chord = Chord.get(symbol);
  if (chord.empty) {
    throw new Error(`Unsupported chord: ${symbol}`);
  }
  return { root, quality, variation, symbol, tones: chord.notes };
}
