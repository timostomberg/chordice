/**
 * Roman numerals: parsing them, placing them in a key and their harmonic function. All progressions are written in major.
 */

import { Note, RomanNumeral } from 'tonal';

/**
 * Parses a roman numeral such as "V", "bVII" or "vi". Uppercase means major chord quality,
 * lowercase minor. An optional "b" or "#" prefix alters the scale degree.
 */
export function parseNumeral(numeral) {
  const parsed = RomanNumeral.get(numeral);
  // tonal keeps unknown trailing characters (e.g. "IIX") in chordType, and the app does not support chord suffixes here.
  if (parsed.empty || parsed.chordType !== '') {
    throw new Error(`Invalid roman numeral: ${numeral}`);
  }
  return parsed;
}

/** Root and chord quality of a roman numeral, placed in the given major tonic. */
export function degree(tonic, numeral) {
  const parsed = parseNumeral(numeral);
  return { root: Note.transpose(tonic, parsed.interval), quality: parsed.major ? 'major' : 'minor' };
}

const FUNCTIONS = {
  I: 'tonic', iii: 'tonic', III: 'tonic', vi: 'tonic', VI: 'tonic',
  ii: 'subdominant', IV: 'subdominant', iv: 'subdominant', bVI: 'subdominant',
  V: 'dominant', vii: 'dominant', VII: 'dominant', bVII: 'dominant',
};

/** The harmonic functions a chord can have; a chord of none has null. */
export const HARMONIC_FUNCTIONS = Object.freeze(['tonic', 'subdominant', 'dominant']);

/** Whether `value` is a harmonic function (see HARMONIC_FUNCTIONS). */
export function isHarmonicFunction(value) {
  return HARMONIC_FUNCTIONS.includes(value);
}

/** Harmonic function of a roman numeral: "tonic", "subdominant", "dominant" or null. */
export function harmonicFunction(numeral) {
  return FUNCTIONS[numeral] ?? null;
}
