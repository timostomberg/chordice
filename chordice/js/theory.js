/**
 * Music theory helpers built on tonal: roman numerals, chord construction, keys and the circle of fifths.
 *
 * Notes are spelled as strings such as "C", "F#" or "Bb". All progressions are written in major.
 */

import { Chord, Key, Note, RomanNumeral } from 'tonal';

/** Chord extensions as listed in chord_progressions.yaml, in display order. */
export const EXTENSION_NAMES = [
  '7', 'maj7', '6', 'add9', 'sus2', 'sus4', '9', 'maj9', '11', 'maj11', '13', 'maj13',
  '7sus4', '7b9', '7#9', '7b13', '7#5',
];

const SUSPENDED = new Set(['sus2', 'sus4', '7sus4']);

/** Circle of fifths, clockwise from the top. Slots with two names are enharmonic. */
export const KEY_CIRCLE = [
  ['C'], ['G'], ['D'], ['A'], ['E'], ['B'], ['F#', 'Gb'], ['Db'], ['Ab'], ['Eb'], ['Bb'], ['F'],
];

export const MAJOR_KEYS = KEY_CIRCLE.flat();

export function relativeMinorOf(major) {
  const minor = Key.majorKey(major).minorRelative;
  if (!minor) {
    throw new Error(`Unknown major key: ${major}`);
  }
  return minor;
}

export function minorNameOf(major) {
  return `${relativeMinorOf(major)}m`;
}

/** Selectable keys are the major keys; each one is shown with its relative minor on the circle. */
export function isKeyName(name) {
  return MAJOR_KEYS.includes(name);
}

/** Maps a key name to its major key. Minor names (from older settings) map to their relative major; unknown names give null. */
export function majorKeyOf(name) {
  if (isKeyName(name)) {
    return name;
  }
  return MAJOR_KEYS.find((major) => minorNameOf(major) === name) ?? null;
}

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

/**
 * Builds a chord from its root, quality ("major" or "minor") and optional extension.
 * Returns the chord symbol (e.g. "Am7") and the chord tones as spelled by tonal.
 * Throws for combinations that tonal cannot spell.
 */
export function buildChord(root, quality, extension = null) {
  if (extension !== null && !EXTENSION_NAMES.includes(extension)) {
    throw new Error(`Unknown chord extension: ${extension}`);
  }
  const suspended = extension !== null && SUSPENDED.has(extension);
  const symbol = root + (quality === 'minor' && !suspended ? 'm' : '') + (extension ?? '');
  const chord = Chord.get(symbol);
  if (chord.empty) {
    throw new Error(`Unsupported chord: ${symbol}`);
  }
  return { root, quality, extension, symbol, tones: chord.notes };
}

/**
 * The chord tones in the order of one inversion, the lowest note first. Inversion 0 is the root position; inversion k
 * puts the tone at index k at the bottom, followed by the remaining tones in their order.
 */
export function invertedTones(tones, inversion = 0) {
  if (!Number.isInteger(inversion) || inversion < 0 || inversion >= tones.length) {
    throw new Error(`Inversion ${inversion} does not exist for ${tones.length} chord tones`);
  }
  return [...tones.slice(inversion), ...tones.slice(0, inversion)];
}

/** The fixed bass of a chord: its slash bass if it has one, otherwise the root (the first tone). Inversions do not change it. */
export function bassOf(tones, slashBass = null) {
  return slashBass ?? tones[0];
}

/** The top melody note of a chord in one inversion: the highest tone of its stacked order, which is the last one. */
export function melodyTopOf(tones, inversion = 0) {
  return invertedTones(tones, inversion).at(-1);
}

const FUNCTIONS = {
  I: 'tonic', iii: 'tonic', III: 'tonic', vi: 'tonic', VI: 'tonic',
  ii: 'subdominant', IV: 'subdominant', iv: 'subdominant', bVI: 'subdominant',
  V: 'dominant', vii: 'dominant', VII: 'dominant', bVII: 'dominant',
};

/** Harmonic function of a roman numeral: "tonic", "subdominant", "dominant" or null. */
export function harmonicFunction(numeral) {
  return FUNCTIONS[numeral] ?? null;
}

/**
 * The circle slot's name for a note: the spelling the circle shows for it, if that spelling is on the circle,
 * otherwise the circle's name for the same pitch (e.g. Cb is shown as B).
 */
export function circleNameOf(spelled) {
  const chroma = Note.chroma(spelled);
  const slot = KEY_CIRCLE.find((names) => Note.chroma(names[0]) === chroma);
  return slot.includes(spelled) ? spelled : slot[0];
}

/**
 * Dominant and subdominant of a major key, as names on the circle. The spelling follows the key,
 * so Db has the subdominant Gb and B has the dominant F#, not the other way round.
 */
export function neighbourKeysOf(major) {
  return {
    dominant: circleNameOf(Note.transpose(major, '5P')),
    subdominant: circleNameOf(Note.transpose(major, '4P')),
  };
}

// Order in which the sharps and the flats appear in a key signature.
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Accidentals of a major key in signature order, e.g. G → ['F#'], Bb → ['Bb', 'Eb'], C → []. */
export function keySignatureOf(major) {
  const signature = Key.majorKey(major).keySignature;
  const sharp = signature.startsWith('#');
  const order = sharp ? SHARP_ORDER : FLAT_ORDER;
  const suffix = sharp ? '#' : 'b';
  return order.slice(0, signature.length).map((letter) => `${letter}${suffix}`);
}
