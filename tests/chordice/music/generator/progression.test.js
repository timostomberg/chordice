import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRow,
  chooseProgressionAndKey,
  chordEntry,
  progressionPool,
} from '../../../../chordice/music/generator/progression.js';
import { NO_BASS_PATTERNS } from '../../../../chordice/music/generator/bass.js';
import { createSeeds } from '../../../../chordice/music/generator/random.js';
import { BASE, PROBABILITY_MAX, VARIATIONS_ONLY } from '../../../../chordice/music/constants.js';

const PROGRESSION = { id: 'pop', name: 'Pop', group: 'Pop', progression: ['I', 'V'], chordVariations: {} };
const OTHER = { id: 'jazz', name: 'Jazz', group: 'Jazz', progression: ['ii', 'V'], chordVariations: {} };

test('the pool holds the selected progressions in the order of the library', () => {
  assert.deepEqual(progressionPool([PROGRESSION, OTHER], ['jazz', 'pop']), [PROGRESSION, OTHER]);
  assert.deepEqual(progressionPool([PROGRESSION, OTHER], ['jazz']), [OTHER]);
});

test('the progression of a row is chosen from the pool, the same for the same seeds, and the row is in the selected key', () => {
  const seeds = createSeeds(() => 0.25);
  const choice = chooseProgressionAndKey([PROGRESSION, OTHER], 'G', seeds, 4);
  assert.ok([PROGRESSION, OTHER].includes(choice.progression));
  assert.equal(choice.tonic, 'G');
  assert.deepEqual(chooseProgressionAndKey([PROGRESSION, OTHER], 'G', seeds, 4), choice);
});

test('with the circle of fifths the key of a row is the slot of its index counterclockwise from C, not the selected key', () => {
  const seeds = createSeeds(() => 0.25);
  assert.equal(chooseProgressionAndKey([PROGRESSION], 'G', seeds, 0, true).tonic, 'C');
  assert.equal(chooseProgressionAndKey([PROGRESSION], 'G', seeds, 1, true).tonic, 'F');
  assert.ok(['F#', 'Gb'].includes(chooseProgressionAndKey([PROGRESSION], 'G', seeds, 6, true).tonic));
  assert.equal(chooseProgressionAndKey([PROGRESSION], 'G', seeds, 12, true).tonic, 'C');
});

function settings(overrides = {}) {
  return {
    seeds: createSeeds(() => 0.5),
    bassPatterns: NO_BASS_PATTERNS,
    variations: [],
    foreignVariations: true,
    variationProbability: 0,
    bassProbability: 0,
    permutation: 0,
    rotation: 0,
    inversions: false,
    melodyAmount: 0,
    ...overrides,
  };
}

test('a row carries its index, progression, key and the chords in the predefined order', () => {
  const row = buildRow(PROGRESSION, 'C', 3, settings());
  assert.equal(row.index, 3);
  assert.equal(row.name, 'Pop');
  assert.equal(row.group, 'Pop');
  assert.equal(row.tonic, 'C');
  assert.deepEqual(row.chords.map((chord) => chord.roman), ['I', 'V']);
  assert.deepEqual(row.chords.map((chord) => chord.root), ['C', 'G']);
});

test('without permutation and rotation the row is not flagged', () => {
  const row = buildRow(PROGRESSION, 'C', 0, settings());
  assert.equal(row.permuted, false);
  assert.equal(row.rotated, false);
});

// The chord of one numeral (chordEntry), with its own fixtures.
const CHORD_PROGRESSION = { chordVariations: { V: { [BASE]: 0, 7: 5 } } };
const CHORD_BASS_PATTERNS = { degrees: { V: [{ interval: '3M', weight: 1 }] }, variations: {} };

function chordSettings(overrides = {}) {
  return {
    seeds: createSeeds(() => 0.5),
    bassPatterns: { degrees: {}, variations: {} },
    variations: [],
    foreignVariations: true,
    variationProbability: 0,
    bassProbability: 0,
    ...overrides,
  };
}

test('without probabilities a chord is the plain chord of its numeral, in root position', () => {
  const chord = chordEntry(CHORD_PROGRESSION, 'V', 'C', 0, chordSettings());
  assert.equal(chord.roman, 'V');
  assert.equal(chord.root, 'G');
  assert.equal(chord.variation, null);
  assert.equal(chord.bass, null);
  assert.equal(chord.inversion, 0);
  assert.equal(chord.displaySymbol, chord.symbol);
});

test('at full bass probability the chord takes its bass note, shown as a slash', () => {
  const chord = chordEntry(CHORD_PROGRESSION, 'V', 'C', 0, chordSettings({ bassPatterns: CHORD_BASS_PATTERNS, bassProbability: PROBABILITY_MAX }));
  assert.equal(chord.bass, 'B');
  assert.equal(chord.displaySymbol, `${chord.symbol}/B`);
});

test('at full variation probability a chord takes a selected variation', () => {
  const chord = chordEntry(CHORD_PROGRESSION, 'V', 'C', 0, chordSettings({ variations: ['7'], variationProbability: PROBABILITY_MAX }));
  assert.equal(chord.variation, '7');
});

test('at 5+ a chord never stays the base chord while it has a variation to take', () => {
  // The base is far more common than the variation here, so without 5+ it would mostly be taken.
  const progression = { chordVariations: { V: { [BASE]: 5, 7: 1 } } };
  for (let slot = 0; slot < 50; slot += 1) {
    const chord = chordEntry(progression, 'V', 'C', slot, chordSettings({ variations: ['7'], variationProbability: VARIATIONS_ONLY }));
    assert.equal(chord.variation, '7');
  }
  const atFive = Array.from({ length: 50 }, (_, slot) =>
    chordEntry(progression, 'V', 'C', slot, chordSettings({ variations: ['7'], variationProbability: PROBABILITY_MAX })).variation);
  assert.ok(atFive.includes(null), 'at 5 the base chord is still taken');
});

test('at 5+ a chord without a variation to take stays the base chord', () => {
  const progression = { chordVariations: { V: { [BASE]: 5, 7: 1 }, I: { [BASE]: 5 } } };
  const settings = chordSettings({ variations: ['7'], variationProbability: VARIATIONS_ONLY });
  assert.equal(chordEntry(progression, 'I', 'C', 0, settings).variation, null, 'no variation in the YAML');
  assert.equal(chordEntry(progression, 'V', 'C', 0, { ...settings, variations: [] }).variation, null, 'no variation selected');
  assert.equal(chordEntry({ chordVariations: {} }, 'V', 'C', 0, settings).variation, null, 'the numeral is not in the YAML');
});

test('a variation that is not selected is never taken', () => {
  const chord = chordEntry(CHORD_PROGRESSION, 'V', 'C', 0, chordSettings({ variations: [], variationProbability: PROBABILITY_MAX }));
  assert.equal(chord.variation, null);
});
