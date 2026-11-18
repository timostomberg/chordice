/**
 * Music theory helpers built on tonal: roman numerals, chord construction, keys and the circle of fifths.
 *
 * Notes are spelled as strings such as "C", "F#" or "Bb". All progressions are written in major.
 */

import { Chord, Key, Note, RomanNumeral } from 'tonal';

/** Chord variations (variations) as listed in the data files, in display order. `base` is not one of them. */
export const VARIATION_NAMES = [
  '7', 'maj7', '6', 'add9', 'sus2', 'sus4', '9', 'maj9', '11', 'maj11', '13', 'maj13', '6/9', '5',
  '7sus4', '7b9', '7#9', '7b13', '7#5', '7b5', '7#11',
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

// Quality of the simple interval numbers 1 to 7 when they are major/minor or perfect; 9, 11 and 13 are compound.
const SIMPLE_QUALITY = { 1: 'P', 2: 'M', 3: 'M', 4: 'P', 5: 'P', 6: 'M', 7: 'M' };

/**
 * Converts a bass pattern token, relative to the chord root, into a tonal interval: "1" → "1P", "b3" → "3m",
 * "#5" → "5A", "b7" → "7m", "9" → "9M", "#11" → "11A". Throws for tokens that are not such a degree.
 */
export function intervalOf(token) {
  const match = /^(b|#)?(\d+)$/.exec(token);
  const number = match ? Number(match[2]) : NaN;
  const simple = ((number - 1) % 7) + 1;
  const known = number <= 7 || [9, 11, 13].includes(number);
  if (!match || !known) {
    throw new Error(`Invalid chord degree in bass pattern: ${token}`);
  }
  const perfect = SIMPLE_QUALITY[simple] === 'P';
  const accidental = match[1];
  let quality = SIMPLE_QUALITY[simple];
  if (accidental === '#') {
    quality = 'A';
  } else if (accidental === 'b') {
    quality = perfect ? 'd' : 'm';
  }
  return `${number}${quality}`;
}

/** The fixed bass of a chord: its slash bass if it has one, otherwise the root (the first tone). Inversions do not change it. */
export function bassOf(tones, slashBass = null) {
  return slashBass ?? tones[0];
}

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
