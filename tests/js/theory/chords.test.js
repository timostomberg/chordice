import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIATION_NAMES, buildChord } from '../../../chordice/js/theory/chords.js';

test('buildChord creates symbols and tones for the supported variations', () => {
  const cases = [
    ['C', 'major', null, 'C', ['C', 'E', 'G']],
    ['A', 'minor', null, 'Am', ['A', 'C', 'E']],
    ['C', 'major', '7', 'C7', ['C', 'E', 'G', 'Bb']],
    ['A', 'minor', '7', 'Am7', ['A', 'C', 'E', 'G']],
    ['C', 'major', 'maj7', 'Cmaj7', ['C', 'E', 'G', 'B']],
    ['C', 'major', '6', 'C6', ['C', 'E', 'G', 'A']],
    ['A', 'minor', '6', 'Am6', ['A', 'C', 'E', 'F#']],
    ['C', 'major', '9', 'C9', ['C', 'E', 'G', 'Bb', 'D']],
    ['G', 'major', '7b9', 'G7b9', ['G', 'B', 'D', 'F', 'Ab']],
    ['G', 'major', '7#5', 'G7#5', ['G', 'B', 'D#', 'F']],
    ['D', 'minor', '9', 'Dm9', ['D', 'F', 'A', 'C', 'E']],
    ['A', 'minor', 'add9', 'Amadd9', ['A', 'C', 'E', 'B']],
    ['C', 'major', 'sus2', 'Csus2', ['C', 'D', 'G']],
    ['C', 'major', 'sus4', 'Csus4', ['C', 'F', 'G']],
    ['C', 'major', '7sus4', 'C7sus4', ['C', 'F', 'G', 'Bb']],
    ['A', 'minor', 'sus4', 'Asus4', ['A', 'D', 'E']],
    ['D', 'minor', '11', 'Dm11', ['D', 'F', 'A', 'C', 'E', 'G']],
    ['C', 'major', '5', 'C5', ['C', 'G']],
    ['C', 'major', '6/9', 'C6/9', ['C', 'E', 'G', 'A', 'D']],
    ['C', 'major', '7b5', 'C7b5', ['C', 'E', 'Gb', 'Bb']],
    ['C', 'major', '7#11', 'C7#11', ['C', 'E', 'G', 'Bb', 'F#']],
  ];
  for (const [root, quality, variation, symbol, tones] of cases) {
    const chord = buildChord(root, quality, variation);
    assert.equal(chord.symbol, symbol, `symbol for ${root} ${quality} ${variation}`);
    assert.deepEqual(chord.tones, tones, `tones for ${root} ${quality} ${variation}`);
  }
});

test('buildChord follows tonal where its voicing differs, e.g. a dominant 11 without the third', () => {
  assert.deepEqual(buildChord('C', 'major', '11').tones, ['C', 'G', 'Bb', 'D', 'F']);
  assert.deepEqual(buildChord('G', 'major', '7b13').tones, ['G', 'B', 'F', 'Eb']);
});

test('buildChord rejects unknown variations and combinations tonal cannot spell', () => {
  assert.throws(() => buildChord('C', 'major', 'add11'));
  assert.throws(() => buildChord('C', 'minor', 'maj7'));
  assert.throws(() => buildChord('C', 'minor', '7b9'));
});

test('the variation list follows the specification: the fixed order first, then the rest, without add11', () => {
  assert.deepEqual(VARIATION_NAMES, [
    '7', 'maj7', '6', 'add9', 'sus2', 'sus4', '9', 'maj9', '11', 'maj11', '13', 'maj13', '6/9', '5',
    '7sus4', '7b9', '7#9', '7b13', '7#5', '7b5', '7#11',
  ]);
});
