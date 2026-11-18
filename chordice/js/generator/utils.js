/**
 * Helpers of the generation. Randomness: every decision is a pure function of a seed and a slot index, and each option
 * has its own seed, so changing one option only changes that option's outcome. Order: permutation (shuffling), rotation
 * (cyclic shift), and the classification of the final chord order against the predefined one. Every choice is taken
 * from the seeds defined here.
 */

export const SEED_NAMES = [
  'progression',
  'key',
  'variationActive',
  'variationChoice',
  'bassActive',
  'bassChoice',
  'melodyChoice',
  'permutationActive',
  'permutationOrder',
  'rotationActive',
  'rotationAmount',
];

/** Probabilities are chosen on a scale from 0 to PROBABILITY_MAX; PROBABILITY_MAX means 100%. */
export const PROBABILITY_MAX = 5;

/** Deterministic pseudo-random number in [0, 1) for a seed and an index (murmur3 finalizer). */
export function unit(seed, index) {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1)) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Deterministic whole number in [0, count) for a seed and an index. */
export function pick(seed, index, count) {
  return Math.floor(unit(seed, index) * count);
}

/** The most chords a row can hold. The slot of a chord is its row times this limit, plus its position in the row. */
export const CHORDS_PER_ROW_LIMIT = 100;

/** The slot index of the chord at position `chordIndex` in the row `rowIndex`, used as the index for its seeds. */
export function chordSlot(rowIndex, chordIndex) {
  return rowIndex * CHORDS_PER_ROW_LIMIT + chordIndex;
}

/**
 * Picks one option with the probability given by its weight (the commonness). Returns the option, or null if no
 * option has a weight.
 */
export function weightedPick(options, seed, index) {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  if (total === 0) {
    return null;
  }
  let threshold = unit(seed, index) * total;
  for (const option of options) {
    threshold -= option.weight;
    if (threshold < 0) {
      return option;
    }
  }
  return options.at(-1);
}

export function createSeeds(random = Math.random) {
  const seeds = {};
  for (const name of SEED_NAMES) {
    seeds[name] = Math.floor(random() * 4294967296);
  }
  return seeds;
}

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
export function changesOrder(before, after) {
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
