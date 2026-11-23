/**
 * Generates practice rows from a validated progression library and bass patterns (see validate.js).
 * Every decision is taken from the seeds in utils.js, so the same settings always give the same rows.
 * The progressions and keys are chosen in progression.js, and each row is built there as well.
 */

import { NO_BASS_PATTERNS } from './bass.js';
import { buildRow, chooseProgressionAndKey, keyChoices, progressionPool } from './progression.js';

/**
 * Generates `count` rows. Each row is one progression from the selection, placed in one of the
 * selected keys, with optional permutation, rotation, chord variations and bass notes. With `circleOfFifths` on, the
 * rows run through the keys counterclockwise on the circle of fifths from C instead of the selected key.
 */
export function generate(settings) {
  const { library, selection, keys, count, seeds } = settings;
  const bassPatterns = settings.bassPatterns ?? NO_BASS_PATTERNS;
  const pool = progressionPool(library, selection);
  const tonics = keyChoices(keys);
  if (pool.length === 0 || tonics.length === 0) {
    return [];
  }

  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const { progression, tonic } = chooseProgressionAndKey(pool, tonics, seeds, i, settings.circleOfFifths === true);
    rows.push(buildRow(progression, tonic, i, { ...settings, bassPatterns }));
  }
  return rows;
}
