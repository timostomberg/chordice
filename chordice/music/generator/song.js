/**
 * Generates the song: the practice rows from a validated progression library and bass patterns (see validate.js), which
 * the page shows on the right. Every decision is taken from the seeds in random.js, so the same settings always give the
 * same song.
 * The progressions and keys are chosen in progression.js, and each row is built there as well.
 */

import { NO_BASS_PATTERNS } from './bass.js';
import { buildRow, chooseProgressionAndKey, progressionPool } from './progression.js';

/**
 * Generates the song of `count` rows. Each row is one progression from the selection, placed in the selected `key`, with
 * optional permutation, rotation, chord variations and bass notes. With `circleOfFifths` on, the rows run through the
 * keys counterclockwise on the circle of fifths from C instead of the selected key.
 */
export function generateSong(settings) {
  const { library, selection, key, count, seeds } = settings;
  const bassPatterns = settings.bassPatterns ?? NO_BASS_PATTERNS;
  const pool = progressionPool(library, selection);
  if (pool.length === 0) {
    return [];
  }

  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const { progression, tonic } = chooseProgressionAndKey(pool, key, seeds, i, settings.circleOfFifths === true);
    rows.push(buildRow(progression, tonic, i, { ...settings, bassPatterns }));
  }
  return rows;
}
