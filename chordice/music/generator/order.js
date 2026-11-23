/**
 * The order of the chords of a row: permutation (shuffling), rotation (cyclic shift), and the classification of the final
 * order against the predefined one.
 */

import { chordSlot, pick } from './random.js';

/** Shuffles the chords of row `rowIndex` with the seed `seed`. Returns a new list. */
export function shuffle(items, seed, rowIndex) {
  const result = [...items];
  for (let k = result.length - 1; k > 0; k -= 1) {
    const j = pick(seed, chordSlot(rowIndex, k), k + 1);
    [result[k], result[j]] = [result[j], result[k]];
  }
  return result;
}

/** Shifts the items cyclically to the left by `amount` places. Returns a new list. */
export function rotate(items, amount) {
  const shift = amount % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

/** True if the roman numerals of two chord lists appear in a different order. */
function changesOrder(before, after) {
  return after.some((chord, k) => chord.roman !== before[k].roman);
}

/**
 * Classifies the final chord order against the predefined one. An order that is a cyclic shift of the predefined
 * order is a rotation, any other different order is a permutation, and the same order is neither.
 */
export function classifyOrder(predefined, chords) {
  if (!changesOrder(predefined, chords)) {
    return { permuted: false, rotated: false };
  }
  for (let shift = 1; shift < predefined.length; shift += 1) {
    if (!changesOrder(rotate(predefined, shift), chords)) {
      return { permuted: false, rotated: true };
    }
  }
  return { permuted: true, rotated: false };
}
