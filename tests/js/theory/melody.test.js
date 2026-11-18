import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chord, Note } from 'tonal';
import {
  chooseInversion,
  invertedTones,
  melodyChoices,
  melodyTopOf,
  pitchDistance,
} from '../../../chordice/js/theory/melody.js';

test('invertedTones puts the tone at the inversion index at the bottom, the root position included', () => {
  assert.deepEqual(invertedTones(['C', 'E', 'G']), ['C', 'E', 'G']);
  assert.deepEqual(invertedTones(['C', 'E', 'G'], 1), ['E', 'G', 'C']);
  assert.deepEqual(invertedTones(['C', 'E', 'G'], 2), ['G', 'C', 'E']);
  assert.deepEqual(invertedTones(['G', 'B', 'D', 'F'], 3), ['F', 'G', 'B', 'D']);
});

test('invertedTones of an extended chord puts each tone at the bottom once, with the others close above it', () => {
  // Every inversion, the root position included, is ascending within one octave above its bass.
  const c9 = ['C', 'E', 'G', 'Bb', 'D'];
  assert.deepEqual(invertedTones(c9, 0), ['C', 'D', 'E', 'G', 'Bb']);
  assert.deepEqual(invertedTones(c9, 1), ['E', 'G', 'Bb', 'C', 'D']);
  assert.deepEqual(invertedTones(c9, 2), ['G', 'Bb', 'C', 'D', 'E']);
  assert.deepEqual(invertedTones(c9, 3), ['Bb', 'C', 'D', 'E', 'G']);
  assert.deepEqual(invertedTones(c9, 4), ['D', 'E', 'G', 'Bb', 'C']);
});

test('every inversion of a chord has each tone once, its own tone at the bottom, and no gap wider than a perfect fourth', () => {
  const symbols = ['C7', 'Cmaj7', 'C6', 'Cadd9', 'Csus4', 'C9', 'Cmaj9', 'C11', 'C13', 'Cmaj13', 'C6/9', 'C7b9', 'C7#9', 'C7#11', 'C7b13', 'Cm7b5'];
  for (const symbol of symbols) {
    const tones = Chord.get(symbol).notes;
    tones.forEach((bass, inversion) => {
      const order = invertedTones(tones, inversion);
      assert.equal(order[0], bass, `${symbol} inversion ${inversion}`);
      assert.deepEqual([...order].sort(), [...tones].sort(), `${symbol} inversion ${inversion}`);
      const steps = order.map((tone) => (Note.chroma(tone) - Note.chroma(bass) + 12) % 12);
      assert.deepEqual(steps, [...steps].sort((a, b) => a - b), `${symbol} inversion ${inversion} is not ascending above the bass`);
      for (let index = 1; index < steps.length; index += 1) {
        assert.ok(steps[index] - steps[index - 1] <= 5, `${symbol} inversion ${inversion} jumps from ${order[index - 1]} to ${order[index]}`);
      }
    });
  }
});

test('invertedTones rejects an inversion the chord does not have', () => {
  assert.throws(() => invertedTones(['C', 'E', 'G'], 3), /does not exist/);
  assert.throws(() => invertedTones(['C', 'E', 'G'], -1), /does not exist/);
  assert.throws(() => invertedTones(['C', 'E', 'G'], 0.5), /does not exist/);
  assert.throws(() => invertedTones([], 0), /does not exist/);
});

test('melodyTopOf is the highest tone of the stacked inversion: the last tone of the root position, the tone below the bass otherwise', () => {
  assert.equal(melodyTopOf(['C', 'E', 'G']), 'G');
  assert.equal(melodyTopOf(['C', 'E', 'G'], 1), 'C');
  assert.equal(melodyTopOf(['C', 'E', 'G'], 2), 'E');
  assert.equal(melodyTopOf(['Bb', 'D', 'F', 'A'], 0), 'A');
  assert.equal(melodyTopOf(['Bb', 'D', 'F', 'A'], 2), 'D');
});

test('pitchDistance counts the semitones between two pitch classes the shorter way round, ignoring the octave', () => {
  assert.equal(pitchDistance('C', 'C'), 0);
  assert.equal(pitchDistance('C', 'B'), 1);
  assert.equal(pitchDistance('C', 'G'), 5, 'a fifth counts as a fourth');
  assert.equal(pitchDistance('C', 'F#'), 6);
  assert.equal(pitchDistance('E', 'C'), 4);
  assert.equal(pitchDistance('Bb', 'A'), 1);
});

test('melodyChoices gives each inversion of a chord its top tone', () => {
  assert.deepEqual(melodyChoices(['C', 'E', 'G']), [
    { inversion: 0, melody: 'G' },
    { inversion: 1, melody: 'C' },
    { inversion: 2, melody: 'E' },
  ]);
});

test('without a previous melody note the first chord of a row is equally likely in every inversion', () => {
  assert.equal(chooseInversion(['C', 'E', 'G'], null, 0, 0), 0);
  assert.equal(chooseInversion(['C', 'E', 'G'], null, 0, 0.4), 1);
  assert.equal(chooseInversion(['C', 'E', 'G'], null, 0, 0.99), 2);
});

test('at amount 0 the nearest melody note is always chosen', () => {
  // After E, the melody notes of C, E and G are G (3 semitones away), C (4) and E (0).
  for (const u of [0, 0.3, 0.7, 0.999]) {
    assert.equal(chooseInversion(['C', 'E', 'G'], 'E', 0, u), 2);
  }
});

test('at amount 0 two equally near melody notes are chosen 50/50', () => {
  // After D, the melody notes C and E are both 2 semitones away, G is 5 away.
  const counts = { 1: 0, 2: 0 };
  for (let k = 0; k < 1000; k += 1) {
    counts[chooseInversion(['C', 'E', 'G'], 'D', 0, k / 1000)] += 1;
  }
  assert.equal(counts[1], 500);
  assert.equal(counts[2], 500);
});

test('at amount 1 every inversion is equally likely', () => {
  const counts = [0, 0, 0];
  for (let k = 0; k < 900; k += 1) {
    counts[chooseInversion(['C', 'E', 'G'], 'E', 1, k / 900)] += 1;
  }
  assert.deepEqual(counts, [300, 300, 300]);
});

test('the higher the amount, the more often a melody note far from the previous one is chosen', () => {
  // After E the far note is C (4 semitones), the nearest E is 0 away. Measured over 1000 evenly spread choices.
  const farShare = (share) => {
    let far = 0;
    for (let k = 0; k < 1000; k += 1) {
      if (chooseInversion(['C', 'E', 'G'], 'E', share, k / 1000) === 1) {
        far += 1;
      }
    }
    return far / 1000;
  };
  assert.equal(farShare(0), 0);
  assert.ok(farShare(0.2) > 0);
  assert.ok(farShare(0.4) > farShare(0.2));
  assert.ok(farShare(0.8) > farShare(0.4));
});

test('the melody note chosen is always the top tone of the inversion it picks', () => {
  const tones = ['C', 'E', 'G', 'Bb'];
  for (let k = 0; k < 200; k += 1) {
    const inversion = chooseInversion(tones, 'G', 0.5, k / 200);
    assert.ok(inversion >= 0 && inversion < tones.length);
    assert.equal(melodyTopOf(tones, inversion), melodyChoices(tones)[inversion].melody);
  }
});

