import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withInversions } from '../../../../chordice/music/generator/inversion.js';
import { createSeeds } from '../../../../chordice/music/generator/random.js';
import { PROBABILITY_MAX } from '../../../../chordice/music/constants.js';
import { melodyChoices, melodyTopOf, pitchDistance } from '../../../../chordice/music/theory/melody.js';

const CHORDS = [
  { roman: 'I', tones: ['C', 'E', 'G'], inversion: 0 },
  { roman: 'V', tones: ['G', 'B', 'D'], inversion: 0 },
  { roman: 'vi', tones: ['A', 'C', 'E'], inversion: 0 },
];

/** A row with the given index and chords, shaped like a row of buildRow. */
function row(index, chords = CHORDS) {
  return { index, name: 'Test', tonic: 'C', chords };
}

/** Asserts that every chord after the first of `chords` takes a melody note nearest to the one before. */
function assertNearest(chords) {
  for (let j = 1; j < chords.length; j += 1) {
    const previous = melodyTopOf(chords[j - 1].tones, chords[j - 1].inversion);
    const chosen = melodyTopOf(chords[j].tones, chords[j].inversion);
    const nearest = Math.min(...melodyChoices(chords[j].tones).map(({ melody }) => pitchDistance(melody, previous)));
    assert.equal(pitchDistance(chosen, previous), nearest, `chord ${j}`);
  }
}

test('with inversions off every chord stays in root position', () => {
  const settings = { inversions: false, melodyAmount: 0, seeds: createSeeds(() => 0.3) };
  const rows = [row(0, CHORDS.map((chord) => ({ ...chord, inversion: 2 }))), row(1)];
  const result = withInversions(rows, settings);
  assert.deepEqual(result.map((r) => r.chords.map((chord) => chord.inversion)), [[0, 0, 0], [0, 0, 0]]);
});

test('with inversions on every chord takes one of its own inversions', () => {
  const settings = { inversions: true, melodyAmount: PROBABILITY_MAX, seeds: createSeeds(() => 0.3) };
  const [result] = withInversions([row(4)], settings);
  result.chords.forEach((chord, j) => {
    assert.ok(Number.isInteger(chord.inversion));
    assert.ok(chord.inversion >= 0 && chord.inversion < chord.tones.length, `chord ${j} inversion ${chord.inversion}`);
  });
});

test('at melody amount 0 each chord takes the melody note nearest to the one before', () => {
  const settings = { inversions: true, melodyAmount: 0, seeds: createSeeds(() => 0.7) };
  const [result] = withInversions([row(2)], settings);
  assertNearest(result.chords);
});

test('at melody amount 0 the melody runs on from the last chord of a row into the first chord of the next', () => {
  for (const value of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const settings = { inversions: true, melodyAmount: 0, seeds: createSeeds(() => value) };
    const result = withInversions([row(0), row(1), row(2)], settings);
    assertNearest(result.flatMap((r) => r.chords));
  }
});

test('the first chord of a row is chosen by the row before, not at random as on its own', () => {
  // On its own, the first chord of row 1 takes any inversion; after row 0 it must lie nearest to row 0's last note.
  const differs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].some((value) => {
    const settings = { inversions: true, melodyAmount: 0, seeds: createSeeds(() => value) };
    const alone = withInversions([row(1)], settings)[0].chords[0].inversion;
    const after = withInversions([row(0), row(1)], settings)[1].chords[0].inversion;
    return alone !== after;
  });
  assert.ok(differs);
});

test('only the first chord of the song takes its inversion from the melody choice alone', () => {
  const settings = { inversions: true, melodyAmount: 0, seeds: createSeeds(() => 0.7) };
  const first = withInversions([row(0)], settings)[0].chords[0];
  const again = withInversions([row(0, [CHORDS[0]])], settings)[0].chords[0];
  assert.equal(first.inversion, again.inversion);
});

test('the rows before a row decide its inversions, the rows after it do not', () => {
  const settings = { inversions: true, melodyAmount: 3, seeds: createSeeds(() => 0.4) };
  const short = withInversions([row(0), row(1)], settings);
  const long = withInversions([row(0), row(1), row(2), row(3)], settings);
  assert.deepEqual(long.slice(0, 2), short);
});

test('setting inversions keeps every other field of the rows and chords', () => {
  const settings = { inversions: true, melodyAmount: 2, seeds: createSeeds(() => 0.1) };
  const rows = [row(0), row(1)];
  const result = withInversions(rows, settings);
  result.forEach((r, i) => {
    const { chords, ...rest } = r;
    const { chords: original, ...expected } = rows[i];
    assert.deepEqual(rest, expected);
    chords.forEach((chord, j) => {
      const { inversion, ...fields } = chord;
      assert.deepEqual(fields, { roman: original[j].roman, tones: original[j].tones });
    });
  });
});
