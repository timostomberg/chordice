import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bassCandidates, chooseBass } from '../../../chordice/js/generator/bass.js';
import { createSeeds } from '../../../chordice/js/generator/utils.js';

const PATTERNS = {
  degrees: { V: [{ interval: '1P', weight: 5 }, { interval: '3M', weight: 1 }] },
  variations: { sus4: [{ interval: '4P', weight: 2 }] },
};
const G_MAJOR = ['G', 'B', 'D'];

test('bass candidates are the entries of the numeral and the variation that are tones of the chord', () => {
  const candidates = bassCandidates(PATTERNS, 'G', 'V', null, G_MAJOR);
  assert.deepEqual(candidates, [
    { value: 'G', weight: 5 },
    { value: 'B', weight: 1 },
  ]);
});

test('a bass note that is not a tone of the chord is left out', () => {
  // A sus4 chord on G has C and D instead of B, so the third is not a candidate.
  const candidates = bassCandidates(PATTERNS, 'G', 'V', 'sus4', ['G', 'C', 'D']);
  assert.deepEqual(candidates.map((candidate) => candidate.value), ['G', 'C']);
});

test('without a bass probability the chord keeps its standard bass', () => {
  const seeds = createSeeds(() => 0.5);
  const bass = chooseBass({ bassPatterns: PATTERNS, bassProbability: 0, seeds, slot: 7, root: 'G', numeral: 'V', variation: null, tones: G_MAJOR });
  assert.equal(bass, null);
});

test('a bass note equal to the root is not returned, since the root is the standard bass', () => {
  const seeds = createSeeds(() => 0.5);
  const onlyRoot = { degrees: { V: [{ interval: '1P', weight: 1 }] }, variations: {} };
  const bass = chooseBass({ bassPatterns: onlyRoot, bassProbability: 5, seeds, slot: 0, root: 'G', numeral: 'V', variation: null, tones: G_MAJOR });
  assert.equal(bass, null);
});

test('at full probability a chord takes a bass note of its patterns', () => {
  const seeds = createSeeds(() => 0.5);
  const thirdOnly = { degrees: { V: [{ interval: '3M', weight: 1 }] }, variations: {} };
  const bass = chooseBass({ bassPatterns: thirdOnly, bassProbability: 5, seeds, slot: 0, root: 'G', numeral: 'V', variation: null, tones: G_MAJOR });
  assert.equal(bass, 'B');
});

test('a chord without patterns for its numeral and variation has no bass note', () => {
  const seeds = createSeeds(() => 0.5);
  const bass = chooseBass({ bassPatterns: { degrees: {}, variations: {} }, bassProbability: 5, seeds, slot: 0, root: 'G', numeral: 'V', variation: null, tones: G_MAJOR });
  assert.equal(bass, null);
});
