import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withInversions } from '../../../chordice/js/generator/inversion.js';
import { createSeeds, PROBABILITY_MAX } from '../../../chordice/js/generator/utils.js';
import { melodyChoices, melodyTopOf, pitchDistance } from '../../../chordice/js/theory/melody.js';

const CHORDS = [
  { roman: 'I', tones: ['C', 'E', 'G'], inversion: 0 },
  { roman: 'V', tones: ['G', 'B', 'D'], inversion: 0 },
  { roman: 'vi', tones: ['A', 'C', 'E'], inversion: 0 },
];

test('with inversions off every chord stays in root position', () => {
  const settings = { inversions: false, melodyAmount: 0, seeds: createSeeds(() => 0.3) };
  const result = withInversions(CHORDS.map((chord) => ({ ...chord, inversion: 2 })), settings, 0);
  assert.deepEqual(result.map((chord) => chord.inversion), [0, 0, 0]);
});

test('with inversions on every chord takes one of its own inversions', () => {
  const settings = { inversions: true, melodyAmount: PROBABILITY_MAX, seeds: createSeeds(() => 0.3) };
  const result = withInversions(CHORDS, settings, 4);
  result.forEach((chord, j) => {
    assert.ok(Number.isInteger(chord.inversion));
    assert.ok(chord.inversion >= 0 && chord.inversion < chord.tones.length, `chord ${j} inversion ${chord.inversion}`);
  });
});

test('at melody amount 0 each chord takes the melody note nearest to the one before', () => {
  const settings = { inversions: true, melodyAmount: 0, seeds: createSeeds(() => 0.7) };
  const result = withInversions(CHORDS, settings, 2);
  for (let j = 1; j < result.length; j += 1) {
    const previous = melodyTopOf(result[j - 1].tones, result[j - 1].inversion);
    const chosen = melodyTopOf(result[j].tones, result[j].inversion);
    const nearest = Math.min(...melodyChoices(result[j].tones).map(({ melody }) => pitchDistance(melody, previous)));
    assert.equal(pitchDistance(chosen, previous), nearest);
  }
});

test('the first chord of a row takes its inversion from the melody choice alone', () => {
  const settings = { inversions: true, melodyAmount: 0, seeds: createSeeds(() => 0.7) };
  const first = withInversions(CHORDS, settings, 0)[0];
  const again = withInversions([CHORDS[0]], settings, 0)[0];
  assert.equal(first.inversion, again.inversion);
});

test('setting inversions keeps every other field of the chords', () => {
  const settings = { inversions: true, melodyAmount: 2, seeds: createSeeds(() => 0.1) };
  const result = withInversions(CHORDS, settings, 1);
  result.forEach((chord, j) => {
    const { inversion, ...rest } = chord;
    assert.deepEqual(rest, { roman: CHORDS[j].roman, tones: CHORDS[j].tones });
  });
});
