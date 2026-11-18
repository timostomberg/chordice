import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRow,
  chooseProgressionAndKey,
  chordEntry,
  keyChoices,
  progressionPool,
} from '../../../chordice/js/generator/progression.js';
import { NO_BASS_PATTERNS } from '../../../chordice/js/generator/bass.js';
import { createSeeds } from '../../../chordice/js/generator/utils.js';
import { BASE, PROBABILITY_MAX } from '../../../chordice/js/constants.js';

const PROGRESSION = { id: 'pop', name: 'Pop', group: 'Pop', progression: ['I', 'V'], chordVariations: {} };
const OTHER = { id: 'jazz', name: 'Jazz', group: 'Jazz', progression: ['ii', 'V'], chordVariations: {} };

test('the pool holds the selected progressions in the order of the library', () => {
  assert.deepEqual(progressionPool([PROGRESSION, OTHER], ['jazz', 'pop']), [PROGRESSION, OTHER]);
  assert.deepEqual(progressionPool([PROGRESSION, OTHER], ['jazz']), [OTHER]);
});

test('each key is offered once', () => {
  assert.deepEqual(keyChoices(['C', 'G', 'C']), ['C', 'G']);
});

test('the progression and key of a row are chosen from the pool and the keys, and are the same for the same seeds', () => {
  const seeds = createSeeds(() => 0.25);
  const choice = chooseProgressionAndKey([PROGRESSION, OTHER], ['C', 'G'], seeds, 4);
  assert.ok([PROGRESSION, OTHER].includes(choice.progression));
  assert.ok(['C', 'G'].includes(choice.tonic));
  assert.deepEqual(chooseProgressionAndKey([PROGRESSION, OTHER], ['C', 'G'], seeds, 4), choice);
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

test('with inversions off every chord of the row stays in root position', () => {
  const row = buildRow(PROGRESSION, 'C', 0, settings());
  assert.deepEqual(row.chords.map((chord) => chord.inversion), [0, 0]);
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

test('a variation that is not selected is never taken', () => {
  const chord = chordEntry(CHORD_PROGRESSION, 'V', 'C', 0, chordSettings({ variations: [], variationProbability: PROBABILITY_MAX }));
  assert.equal(chord.variation, null);
});
