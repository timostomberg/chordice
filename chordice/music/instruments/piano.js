/**
 * Piano voicings of a chord on a grand staff, free of any rendering. The bass note is fixed for all inversions: the
 * chord's slash bass, or its root. The treble staff shows all chord tones, stacked upwards.
 * An inversion is a rotation of the chord tones (see invertedTones): its first tone is the lowest treble note.
 *
 * Pitches are spelled names with octave, e.g. "Bb3", as tonal spells them.
 */

import { Note } from 'tonal';
import { bassOf } from '../theory/bass.js';
import { invertedTones } from '../theory/melody.js';

// Bass notes stay within G2 to F#3, which sits on and around the bass staff.
const BASS_LOWEST = 43;
// Treble notes start at C4 (middle C), so they stay in the treble clef.
const TREBLE_LOWEST = 60;

/** The lowest pitch with the given pitch class that is at least `minimum` (a MIDI number). */
export function lowestAtLeast(tone, minimum) {
  let best = null;
  for (let octave = 0; octave <= 8; octave += 1) {
    const name = `${tone}${octave}`;
    const midi = Note.midi(name);
    if (midi !== null && midi >= minimum && (best === null || midi < best.midi)) {
      best = { name, midi };
    }
  }
  if (best === null) {
    throw new Error(`Cannot place ${tone} at or above MIDI ${minimum}`);
  }
  return best;
}

/**
 * The inversions of a chord: each is the chord tones in one rotation, the first one being the lowest treble note.
 * `start` is the inversion shown first, i.e. the chord's own inversion. `bass` is the fixed bass tone of the whole
 * window: the chord's slash bass if it has one, otherwise the root. The inversion does not change the bass.
 */
export function inversionOrders(tones, inversion = 0, bass = null) {
  if (tones.length === 0) {
    throw new Error('A chord needs at least one tone');
  }
  if (!Number.isInteger(inversion) || inversion < 0 || inversion >= tones.length) {
    throw new Error(`Inversion ${inversion} does not exist for ${tones.length} chord tones`);
  }
  const orders = tones.map((_, index) => invertedTones(tones, index));
  return { orders, start: inversion, bass: bassOf(tones, bass) };
}

/**
 * Places one inversion: the bass tone in the bass staff, the tones of the order stacked upwards in the treble staff,
 * each one the lowest occurrence of its pitch class above the previous treble note.
 * Returns { bass, upper } with spelled pitches, the upper notes in ascending order.
 */
export function voicing(order, bassTone) {
  if (order.length === 0) {
    throw new Error('A voicing needs at least one tone');
  }
  const bass = lowestAtLeast(bassTone, BASS_LOWEST).name;
  const upper = [];
  let floor = TREBLE_LOWEST;
  for (const tone of order) {
    const placed = lowestAtLeast(tone, floor);
    upper.push(placed.name);
    floor = placed.midi + 1;
  }
  return { bass, upper };
}

/**
 * The accidental to write directly before a note, given the key signature (its accidentals, e.g. ['F#'] for G, as
 * keySignatureOf gives them). A note whose sign the key signature already shows gets none. A natural that the key
 * signature alters gets a natural sign. Returns the VexFlow accidental ('#', 'b', 'n', ...) or null.
 */
export function accidentalBeforeNote(name, signature = []) {
  const note = Note.get(name);
  if (note.empty || note.oct === undefined) {
    throw new Error(`Pitch without octave: ${name}`);
  }
  const signed = signature.find((accidental) => accidental[0] === note.letter);
  const keyAccidental = signed ? signed.slice(1) : '';
  if (note.acc === keyAccidental) {
    return null;
  }
  return note.acc || 'n';
}
