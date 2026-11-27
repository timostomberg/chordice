/**
 * Constants shared by the data, the generator, the state and the page. They live here so that no layer has to
 * import a constant from another layer (e.g. the generator from the data).
 */

/** Key of the standard variation in chord_progressions.yaml, which has no chord variation. */
export const BASE = 'base';

/** Probabilities are chosen on a scale from 0 to PROBABILITY_MAX; PROBABILITY_MAX means 100%. */
export const PROBABILITY_MAX = 5;

/**
 * The step after PROBABILITY_MAX on the scale of the chord variations, shown as "5+": every chord takes a variation, and
 * the base chord is left out, unless the chord has no variation to take.
 */
export const VARIATIONS_ONLY = PROBABILITY_MAX + 1;
