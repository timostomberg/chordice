/**
 * The randomness of the generation. Every decision is a pure function of a seed and a slot index, and each option has its
 * own seed, so changing one option only changes that option's outcome, and the same settings always give the same rows.
 */

export const SEED_NAMES = [
  'progression',
  'variationActive',
  'variationChoice',
  'bassActive',
  'bassChoice',
  'melodyChoice',
  'permutationActive',
  'permutationOrder',
  'rotationActive',
  'rotationAmount',
  // The spelling of an enharmonic key (F# or Gb) with the circle of fifths switch on.
  'enharmonic',
];

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

/** One new seed for each name in SEED_NAMES: a whole number from 0 to 2^32 - 1, taken from `random`. */
export function createSeeds(random = Math.random) {
  const seeds = {};
  for (const name of SEED_NAMES) {
    seeds[name] = Math.floor(random() * 4294967296);
  }
  return seeds;
}
