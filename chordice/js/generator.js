/**
 * Generates practice rows from a validated progression library and bass patterns (see library.js).
 * Every decision is taken from the seeds in random.js, so the same settings always give the same rows.
 */

import { Note } from 'tonal';
import { buildChord, degree, harmonicFunction, isDiatonicChord } from './theory.js';
import { PROBABILITY_MAX, pick, unit } from './random.js';
import { BASE } from './library.js';

const CHORDS_PER_ROW_LIMIT = 100;

// No bass patterns: every chord keeps its standard bass.
export const NO_BASS_PATTERNS = { degrees: {}, variations: {} };

/**
 * Picks one option with the probability given by its weight (the commonness). Returns the option, or null if no
 * option has a weight.
 */
function weightedPick(options, seed, index) {
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

/**
 * The bass notes a chord can take: the entries of its roman numeral and of its chord variation, each with its commonness.
 * A bass note must be a tone of the chord; the entry "1" is the standard bass (the root).
 */
function bassCandidates(bassPatterns, root, numeral, variation, tones) {
  const entries = [
    ...(bassPatterns.degrees[numeral] ?? []),
    ...(variation === null ? [] : bassPatterns.variations[variation] ?? []),
  ];
  const chromas = new Set(tones.map((tone) => Note.chroma(tone)));
  return entries
    .map(({ interval, weight }) => ({ value: Note.transpose(root, interval), weight }))
    .filter((candidate) => chromas.has(Note.chroma(candidate.value)));
}

function chordEntry(progression, numeral, tonic, slot, settings) {
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

  let bass = null;
  if (unit(seeds.bassActive, slot) < settings.bassProbability / PROBABILITY_MAX) {
    const picked = weightedPick(bassCandidates(bassPatterns, root, numeral, variation, chord.tones), seeds.bassChoice, slot);
    // A bass note equal to the root is the standard bass, so it is not shown as an inversion.
    if (picked && Note.chroma(picked.value) !== Note.chroma(root)) {
      bass = picked.value;
    }
  }

  // With inversions on, every position of the chord is equally likely, the root position (0) included.
  // The number of positions follows the chord's tones, so an extended chord has all of its inversions too.
  let inversion = 0;
  if (settings.inversions) {
    inversion = pick(seeds.inversionChoice, slot, chord.tones.length);
  }

  return {
    roman: numeral,
    function: harmonicFunction(numeral),
    root,
    quality,
    variation,
    symbol: chord.symbol,
    tones: chord.tones,
    inversion,
    bass,
    displaySymbol: bass ? `${chord.symbol}/${bass}` : chord.symbol,
  };
}

function shuffle(items, seed, rowIndex) {
  const result = [...items];
  for (let k = result.length - 1; k > 0; k -= 1) {
    const j = pick(seed, rowIndex * CHORDS_PER_ROW_LIMIT + k, k + 1);
    [result[k], result[j]] = [result[j], result[k]];
  }
  return result;
}

function rotate(items, amount) {
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
function classifyOrder(predefined, chords) {
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

/**
 * Generates `count` rows. Each row is one progression from the selection, placed in one of the
 * selected keys, with optional permutation, rotation, chord variations and bass notes.
 */
export function generate(settings) {
  const { library, selection, keys, count, seeds } = settings;
  const bassPatterns = settings.bassPatterns ?? NO_BASS_PATTERNS;
  const pool = library.filter((progression) => selection.includes(progression.id));
  if (pool.length === 0 || keys.length === 0) {
    return [];
  }
  const tonics = [...new Set(keys)];

  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const progression = pool[pick(seeds.progression, i, pool.length)];
    const tonic = tonics[pick(seeds.key, i, tonics.length)];

    let chords = progression.progression.map((numeral, j) =>
      chordEntry(progression, numeral, tonic, i * CHORDS_PER_ROW_LIMIT + j, { ...settings, bassPatterns }),
    );
    const predefined = chords;
    if (unit(seeds.permutationActive, i) < settings.permutation / PROBABILITY_MAX) {
      chords = shuffle(chords, seeds.permutationOrder, i);
    }
    if (unit(seeds.rotationActive, i) < settings.rotation / PROBABILITY_MAX) {
      chords = rotate(chords, pick(seeds.rotationAmount, i, chords.length));
    }
    // The tags describe the final chord order, not the steps that produced it: a permutation that happens to be a
    // rotation of the predefined progression counts as a rotation, and a transformation undone by a later one is not shown.
    const { permuted, rotated } = classifyOrder(predefined, chords);

    rows.push({
      index: i,
      name: progression.name,
      group: progression.group,
      tonic,
      permuted,
      rotated,
      chords,
    });
  }
  return rows;
}
