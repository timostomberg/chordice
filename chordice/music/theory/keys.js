/**
 * Keys and the circle of fifths: the major keys, their relative minors, key signatures and neighbouring keys.
 *
 * Notes are spelled as strings such as "C", "F#" or "Bb". Keys are named by their major key.
 */

import { Key, Note } from 'tonal';

/** Circle of fifths, clockwise from the top. Slots with two names are enharmonic. */
export const KEY_CIRCLE = [
  ['C'], ['G'], ['D'], ['A'], ['E'], ['B'], ['F#', 'Gb'], ['Db'], ['Ab'], ['Eb'], ['Bb'], ['F'],
];

export const MAJOR_KEYS = KEY_CIRCLE.flat();

/**
 * The slots of the circle, counterclockwise from C: C, F, Bb, Eb, Ab, Db, F#/Gb, B, E, A, D, G. Each slot lists its
 * major keys; the enharmonic slot has two (F# and Gb).
 */
export const SLOTS_COUNTERCLOCKWISE = [KEY_CIRCLE[0], ...KEY_CIRCLE.slice(1).reverse()];

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
