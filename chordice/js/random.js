/**
 * Deterministic randomness: every decision is a pure function of a seed and a slot index.
 * Each option has its own seed, so changing one option only changes that option's outcome.
 */

export const SEED_NAMES = [
  'progression',
  'key',
  'variationActive',
  'variationChoice',
  'bassActive',
  'bassChoice',
  'inversionChoice',
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

export function createSeeds(random = Math.random) {
  const seeds = {};
  for (const name of SEED_NAMES) {
    seeds[name] = Math.floor(random() * 4294967296);
  }
  return seeds;
}
