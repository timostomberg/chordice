/**
 * Builds the progression library from chord_progressions.yaml and generates practice rows.
 *
 * Randomness is stateless: every decision is a pure function of a seed and a slot index.
 * Each option has its own seed, so changing one option only changes that option's outcome.
 */

import { Note } from 'tonal';
import {
  EXTENSION_NAMES,
  buildChord,
  degree,
  harmonicFunction,
  parseNumeral,
} from './theory.js';

export const SEED_NAMES = [
  'progression',
  'key',
  'extensionActive',
  'extensionChoice',
  'bassActive',
  'bassChoice',
  'inversionChoice',
  'permutationActive',
  'permutationOrder',
  'rotationActive',
  'rotationAmount',
];

const CHORDS_PER_ROW_LIMIT = 100;

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

function pick(seed, index, count) {
  return Math.floor(unit(seed, index) * count);
}

export function createSeeds(random = Math.random) {
  const seeds = {};
  for (const name of SEED_NAMES) {
    seeds[name] = Math.floor(random() * 4294967296);
  }
  return seeds;
}

function requireObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

function buildProgression(groupName, entry) {
  requireObject(entry, `Invalid progression entry in group ${groupName}`);
  const { name, progression } = entry;
  const where = `${groupName} / ${name}`;
  if (typeof name !== 'string') {
    throw new Error(`Progression without name in group ${groupName}`);
  }
  if (!Array.isArray(progression) || progression.length === 0) {
    throw new Error(`Empty progression for ${where}`);
  }
  // YAML parses numbers such as 7 or 9 as numbers, so every value is normalised to a string.
  const numerals = progression.map(String);
  numerals.forEach((numeral) => parseNumeral(numeral));

  const chordExtensions = {};
  for (const [numeral, extensions] of Object.entries(entry.chord_extensions ?? {})) {
    if (!numerals.includes(numeral)) {
      throw new Error(`Extension for unknown chord ${numeral} in ${where}`);
    }
    chordExtensions[numeral] = extensions.map(String);
    chordExtensions[numeral].forEach((extension) => {
      if (!EXTENSION_NAMES.includes(extension)) {
        throw new Error(`Unknown chord extension ${extension} in ${where}`);
      }
    });
  }

  const bassNotes = {};
  for (const [numeral, notes] of Object.entries(entry.bass_notes ?? {})) {
    if (!numerals.includes(numeral)) {
      throw new Error(`Bass notes for unknown chord ${numeral} in ${where}`);
    }
    notes.forEach((note) => parseNumeral(String(note)));
    bassNotes[numeral] = notes.map(String);
  }

  return { id: where, group: groupName, name, progression: numerals, chordExtensions, bassNotes };
}

/** Validates the parsed YAML and returns a flat list of progressions. */
export function buildLibrary(data) {
  if (!Array.isArray(data)) {
    throw new Error('chord_progressions must be a list of groups');
  }
  const library = [];
  for (const group of data) {
    requireObject(group, 'Invalid group entry');
    if (typeof group.group !== 'string' || !Array.isArray(group.progressions)) {
      throw new Error('Each group needs a name and a list of progressions');
    }
    for (const entry of group.progressions) {
      library.push(buildProgression(group.group, entry));
    }
  }
  const ids = new Set(library.map((progression) => progression.id));
  if (ids.size !== library.length) {
    throw new Error('Progression names must be unique within a group');
  }
  return library;
}

function unique(items) {
  return [...new Set(items)];
}

function chordEntry(progression, numeral, tonic, slot, settings) {
  const { seeds } = settings;
  const { root, quality } = degree(tonic, numeral);

  let extension = null;
  const allowed = (progression.chordExtensions[numeral] ?? []).filter((name) =>
    settings.extensions.includes(name),
  );
  if (allowed.length > 0 && unit(seeds.extensionActive, slot) < settings.extensionProbability / 100) {
    const choices = [null, ...allowed];
    extension = choices[pick(seeds.extensionChoice, slot, choices.length)];
  }
  const chord = buildChord(root, quality, extension);

  let bass = null;
  const bassChoices = progression.bassNotes[numeral] ?? [];
  if (bassChoices.length > 0 && unit(seeds.bassActive, slot) < settings.bassProbability / 100) {
    const choices = [null, ...bassChoices];
    const picked = choices[pick(seeds.bassChoice, slot, choices.length)];
    if (picked !== null) {
      const bassNote = degree(tonic, picked).root;
      // A bass note equal to the root is the standard bass, so it is not shown as an inversion.
      if (Note.chroma(bassNote) !== Note.chroma(root)) {
        bass = bassNote;
      }
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
    extension,
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
 * Generates `count` rows. Each row is one progression from the selection, placed in one of the
 * selected keys, with optional permutation, rotation, chord extensions and bass notes.
 */
export function generate(settings) {
  const { library, selection, keys, count, seeds } = settings;
  const pool = library.filter((progression) => selection.includes(progression.id));
  if (pool.length === 0 || keys.length === 0) {
    return [];
  }

  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const progression = pool[pick(seeds.progression, i, pool.length)];
    const tonics = unique(keys);
    const tonic = tonics[pick(seeds.key, i, tonics.length)];

    let chords = progression.progression.map((numeral, j) =>
      chordEntry(progression, numeral, tonic, i * CHORDS_PER_ROW_LIMIT + j, settings),
    );
    // A row counts as permuted or rotated only if its chord order really differs from the predefined progression.
    let permuted = false;
    if (unit(seeds.permutationActive, i) < settings.permutation / 100) {
      const shuffled = shuffle(chords, seeds.permutationOrder, i);
      permuted = changesOrder(chords, shuffled);
      chords = shuffled;
    }
    let rotated = false;
    if (unit(seeds.rotationActive, i) < settings.rotation / 100) {
      const turned = rotate(chords, pick(seeds.rotationAmount, i, chords.length));
      rotated = changesOrder(chords, turned);
      chords = turned;
    }

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
