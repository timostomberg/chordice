/**
 * Builds the rows of practice: the progressions that are offered, the choice of one progression and key per row, and the row itself with its chords, their order (permutation and rotation) and their inversions. Every choice
 * is taken from the seeds in random.js.
 */

import { buildChord } from '../theory/chords.js';
import { degree, harmonicFunction } from '../theory/numerals.js';
import { isDiatonicChord } from '../theory/tones.js';
import { BASE, PROBABILITY_MAX } from '../constants.js';
import { SLOTS_COUNTERCLOCKWISE } from '../theory/keys.js';
import { withInversions } from './inversion.js';
import { chooseBass } from './bass.js';
import { chordSlot, pick, unit, weightedPick } from './random.js';
import { classifyOrder, rotate, shuffle } from './order.js';

/**
 * The chord of one roman numeral in the key `tonic`, with its variation and bass note. Its inversion is not set here,
 * since it depends on the order of the row (see inversion.js).
 */
export function chordEntry(progression, numeral, tonic, slot, settings) {
  const { seeds, bassPatterns } = settings;
  const { root, quality } = degree(tonic, numeral);

  // The variations of the chord, the base (no variation) included with its commonness. Unselected variations are left out.
  // With foreign variations off, a variation is left out if one of its tones is foreign to the key of the row.
  const variations = Object.entries(progression.chordVariations[numeral] ?? {})
    .filter(([name]) => name === BASE || settings.variations.includes(name))
    .filter(([name]) => settings.foreignVariations || name === BASE || isDiatonicChord(root, quality, name, tonic))
    .map(([name, weight]) => ({ value: name === BASE ? null : name, weight }));
  let variation = null;
  if (unit(seeds.variationActive, slot) < settings.variationProbability / PROBABILITY_MAX) {
    variation = weightedPick(variations, seeds.variationChoice, slot)?.value ?? null;
  }
  const chord = buildChord(root, quality, variation);

  const bass = chooseBass({
    bassPatterns,
    bassProbability: settings.bassProbability,
    seeds,
    slot,
    root,
    numeral,
    variation,
    tones: chord.tones,
  });

  return {
    roman: numeral,
    function: harmonicFunction(numeral),
    root,
    quality,
    variation,
    symbol: chord.symbol,
    tones: chord.tones,
    // The inversion is set once the order of the row is final, see inversion.js.
    inversion: 0,
    bass,
    displaySymbol: bass ? `${chord.symbol}/${bass}` : chord.symbol,
  };
}

/** The progressions of the library that are selected, in the order of the library. */
export function progressionPool(library, selection) {
  return library.filter((progression) => selection.includes(progression.id));
}

/** The key of row `rowIndex` with the circle of fifths switch on; an enharmonic slot is spelled by the seed. */
function circleKey(seeds, rowIndex) {
  const names = SLOTS_COUNTERCLOCKWISE[rowIndex % SLOTS_COUNTERCLOCKWISE.length];
  return names[pick(seeds.enharmonic, rowIndex, names.length)];
}

/**
 * The progression and the key of the row `rowIndex`. The progression is chosen from the pool by its seed. The key is the
 * selected key `tonic`, unless `circle` (the circle of fifths switch) is on: the rows then run counterclockwise round the
 * circle from C, so row 0 is in C, row 1 in F and so on. The enharmonic slot is F# or Gb, each with the same chance,
 * chosen by its own seed.
 */
export function chooseProgressionAndKey(pool, tonic, seeds, rowIndex, circle = false) {
  return {
    progression: pool[pick(seeds.progression, rowIndex, pool.length)],
    tonic: circle ? circleKey(seeds, rowIndex) : tonic,
  };
}

/**
 * The row with the index `rowIndex` for the progression `progression` in the key `tonic`. `settings` are the generator
 * settings, with the bass patterns already filled in.
 */
export function buildRow(progression, tonic, rowIndex, settings) {
  const { seeds } = settings;

  let chords = progression.progression.map((numeral, j) =>
    chordEntry(progression, numeral, tonic, chordSlot(rowIndex, j), settings),
  );
  const predefined = chords;
  if (unit(seeds.permutationActive, rowIndex) < settings.permutation / PROBABILITY_MAX) {
    chords = shuffle(chords, seeds.permutationOrder, rowIndex);
  }
  if (unit(seeds.rotationActive, rowIndex) < settings.rotation / PROBABILITY_MAX) {
    chords = rotate(chords, pick(seeds.rotationAmount, rowIndex, chords.length));
  }
  // The tags describe the final chord order, not the steps that produced it: a permutation that happens to be a
  // rotation of the predefined progression counts as a rotation, and a transformation undone by a later one is not shown.
  const { permuted, rotated } = classifyOrder(predefined, chords);
  chords = withInversions(chords, settings, rowIndex);

  return {
    index: rowIndex,
    name: progression.name,
    group: progression.group,
    tonic,
    permuted,
    rotated,
    chords,
  };
}
