/**
 * Constants shared by the data, the generator, the state and the page. They live here so that no layer has to
 * import a constant from another layer (e.g. the generator from the data).
 */

/** Key of the standard variation in chord_progressions.yaml, which has no chord variation. */
export const BASE = 'base';

/** Probabilities are chosen on a scale from 0 to PROBABILITY_MAX; PROBABILITY_MAX means 100%. */
export const PROBABILITY_MAX = 5;
