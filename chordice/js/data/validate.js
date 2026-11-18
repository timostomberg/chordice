/**
 * Validates the parsed data files: the progression library from chord_progressions.yaml and the bass patterns from
 * bass_patterns.yaml. Invalid data throws, so the app never generates from a broken file.
 */

import { intervalOf, parseNumeral, VARIATION_NAMES } from '../theory/theory.js';
import { PROBABILITY_MAX } from '../generation/random.js';

/** Key of the standard variation in chord_progressions.yaml, which has no chord variation. */
export const BASE = 'base';

function requireObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

function requireWeight(weight, where) {
  if (!Number.isInteger(weight) || weight < 1 || weight > PROBABILITY_MAX) {
    throw new Error(`Commonness must be a whole number from 1 to ${PROBABILITY_MAX} in ${where}`);
  }
}

/**
 * Validates the chord variations of one genre: numeral → { base: weight, variation: weight, ... }. Every numeral needs a
 * base weight, and every variation must be a known chord variation.
 */
function buildVariations(map, groupName) {
  requireObject(map, `chord_variations of group ${groupName} must be a map of chords`);
  const variations = {};
  for (const [numeral, weights] of Object.entries(map)) {
    parseNumeral(numeral);
    const where = `${groupName} / ${numeral}`;
    requireObject(weights, `Chord variations for ${where} must be a map`);
    if (!Object.hasOwn(weights, BASE)) {
      throw new Error(`Chord variations for ${where} need a base commonness`);
    }
    variations[numeral] = {};
    for (const [name, weight] of Object.entries(weights)) {
      if (name !== BASE && !VARIATION_NAMES.includes(name)) {
        throw new Error(`Unknown chord variation ${name} in ${where}`);
      }
      requireWeight(weight, where);
      variations[numeral][name] = weight;
    }
  }
  return variations;
}

function buildProgression(groupName, name, numerals, variations) {
  const where = `${groupName} / ${name}`;
  if (!Array.isArray(numerals) || numerals.length === 0) {
    throw new Error(`Empty progression for ${where}`);
  }
  // YAML may parse a numeral such as 5 as a number, so every value is normalised to a string.
  const progression = numerals.map(String);
  progression.forEach((numeral) => parseNumeral(numeral));
  return { id: where, group: groupName, name, progression, chordVariations: variations };
}

/**
 * Validates the parsed chord_progressions.yaml: a map from genre to its chord variations and progressions, where each
 * progression is a name with a list of roman numerals. Returns a flat list of progressions.
 */
export function buildLibrary(data) {
  requireObject(data, 'chord_progressions must be a map of groups');
  const library = [];
  for (const [groupName, group] of Object.entries(data)) {
    requireObject(group, `Invalid group ${groupName}`);
    requireObject(group.progressions, `Group ${groupName} needs a map of progressions`);
    const variations = buildVariations(group.chord_variations ?? {}, groupName);
    const members = Object.entries(group.progressions).map(([name, numerals]) =>
      buildProgression(groupName, name, numerals, variations),
    );
    // Every chord with variations must occur in one of the group's progressions.
    for (const numeral of Object.keys(variations)) {
      if (!members.some((progression) => progression.progression.includes(numeral))) {
        throw new Error(`Chord variations for unknown chord ${numeral} in group ${groupName}`);
      }
    }
    library.push(...members);
  }
  return library;
}

/**
 * Validates the parsed bass_patterns.yaml. `chord_degrees` lists the bass notes of each roman numeral and
 * `chord_variations` those of each chord variation; every bass note is a chord degree relative to the chord root
 * with its commonness. Returns { degrees, variations } with the intervals converted for tonal.
 */
export function buildBassPatterns(data) {
  requireObject(data, 'bass_patterns must have chord_degrees and chord_variations');
  const convert = (map, label, isValidKey) => {
    requireObject(map, `${label} must be a map`);
    const result = {};
    for (const [key, notes] of Object.entries(map)) {
      if (!isValidKey(key)) {
        throw new Error(`Unknown key ${key} in ${label}`);
      }
      requireObject(notes, `Bass notes for ${key} in ${label} must be a map`);
      result[key] = Object.entries(notes).map(([token, weight]) => {
        requireWeight(weight, `${label} / ${key}`);
        return { interval: intervalOf(token), weight };
      });
    }
    return result;
  };
  return {
    degrees: convert(data.chord_degrees, 'chord_degrees', (key) => { parseNumeral(key); return true; }),
    variations: convert(data.chord_variations, 'chord_variations', (key) => VARIATION_NAMES.includes(key)),
  };
}
