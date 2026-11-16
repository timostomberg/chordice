import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTENSION_NAMES,
  buildChord,
  circleNameOf,
  neighbourKeysOf,
  degree,
  harmonicFunction,
  invertedTones,
  isKeyName,
  keySignatureOf,
  majorKeyOf,
  MAJOR_KEYS,
  melodyTopOf,
  minorNameOf,
  parseNumeral,
  relativeMinorOf,
} from '../../chordice/js/theory.js';

test('degree places roman numerals in the major scale of the tonic', () => {
  assert.deepEqual(degree('C', 'I'), { root: 'C', quality: 'major' });
  assert.deepEqual(degree('C', 'vi'), { root: 'A', quality: 'minor' });
  assert.deepEqual(degree('C', 'iii'), { root: 'E', quality: 'minor' });
  assert.deepEqual(degree('C', 'VI'), { root: 'A', quality: 'major' });
  assert.deepEqual(degree('C', 'bVII'), { root: 'Bb', quality: 'major' });
  assert.deepEqual(degree('C', '#IV'), { root: 'F#', quality: 'major' });
  assert.deepEqual(degree('F#', 'bVI'), { root: 'D', quality: 'major' });
  assert.deepEqual(degree('Eb', 'IV'), { root: 'Ab', quality: 'major' });
});

test('parseNumeral rejects invalid numerals', () => {
  assert.throws(() => parseNumeral('H'));
  assert.throws(() => parseNumeral('IIX'));
  assert.throws(() => parseNumeral('Vi'));
  assert.throws(() => parseNumeral(''));
});

test('buildChord creates symbols and tones for the supported extensions', () => {
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
  ];
  for (const [root, quality, extension, symbol, tones] of cases) {
    const chord = buildChord(root, quality, extension);
    assert.equal(chord.symbol, symbol, `symbol for ${root} ${quality} ${extension}`);
    assert.deepEqual(chord.tones, tones, `tones for ${root} ${quality} ${extension}`);
  }
});

test('buildChord follows tonal where its voicing differs, e.g. a dominant 11 without the third', () => {
  assert.deepEqual(buildChord('C', 'major', '11').tones, ['C', 'G', 'Bb', 'D', 'F']);
  assert.deepEqual(buildChord('G', 'major', '7b13').tones, ['G', 'B', 'F', 'Eb']);
});

test('buildChord rejects unknown extensions and combinations tonal cannot spell', () => {
  assert.throws(() => buildChord('C', 'major', '7b5'));
  assert.throws(() => buildChord('C', 'major', 'add11'));
  assert.throws(() => buildChord('C', 'minor', 'maj7'));
  assert.throws(() => buildChord('C', 'minor', '7b9'));
});

test('harmonic functions follow the roman numeral', () => {
  assert.equal(harmonicFunction('I'), 'tonic');
  assert.equal(harmonicFunction('vi'), 'tonic');
  assert.equal(harmonicFunction('ii'), 'subdominant');
  assert.equal(harmonicFunction('bVI'), 'subdominant');
  assert.equal(harmonicFunction('V'), 'dominant');
  assert.equal(harmonicFunction('bVII'), 'dominant');
  assert.equal(harmonicFunction('xyz'), null);
});

test('the extension list matches the order in the specification, without add11', () => {
  assert.deepEqual(EXTENSION_NAMES, [
    '7', 'maj7', '6', 'add9', 'sus2', 'sus4', '9', 'maj9', '11', 'maj11', '13', 'maj13',
    '7sus4', '7b9', '7#9', '7b13', '7#5',
  ]);
});

test('keys are the 13 major keys; minor keys are shown on the circle only', () => {
  assert.equal(MAJOR_KEYS.length, 13);
  assert.ok(isKeyName('Gb'));
  assert.ok(!isKeyName('Am'));
  assert.equal(relativeMinorOf('C'), 'A');
  assert.equal(minorNameOf('Gb'), 'Ebm');
  assert.equal(minorNameOf('F#'), 'D#m');
});

test('majorKeyOf accepts major keys and maps minor names to their relative major', () => {
  assert.equal(majorKeyOf('C'), 'C');
  assert.equal(majorKeyOf('Am'), 'C');
  assert.equal(majorKeyOf('Ebm'), 'Gb');
  assert.equal(majorKeyOf('Gm'), 'Bb');
  assert.equal(majorKeyOf('H'), null);
});

test('neighbourKeysOf gives the dominant and subdominant spelled as the key spells them', () => {
  assert.deepEqual(neighbourKeysOf('C'), { dominant: 'G', subdominant: 'F' });
  assert.deepEqual(neighbourKeysOf('Db'), { dominant: 'Ab', subdominant: 'Gb' });
  assert.deepEqual(neighbourKeysOf('B'), { dominant: 'F#', subdominant: 'E' });
  assert.deepEqual(neighbourKeysOf('Gb'), { dominant: 'Db', subdominant: 'B' });
});

test('circleNameOf keeps a spelling that is on the circle and maps other spellings to the slot of the same pitch', () => {
  assert.equal(circleNameOf('Gb'), 'Gb');
  assert.equal(circleNameOf('F#'), 'F#');
  assert.equal(circleNameOf('Cb'), 'B');
  assert.equal(circleNameOf('C#'), 'Db');
});

test('keySignatureOf lists the sharps or flats of a major key in signature order', () => {
  assert.deepEqual(keySignatureOf('C'), []);
  assert.deepEqual(keySignatureOf('G'), ['F#']);
  assert.deepEqual(keySignatureOf('D'), ['F#', 'C#']);
  assert.deepEqual(keySignatureOf('F#'), ['F#', 'C#', 'G#', 'D#', 'A#', 'E#']);
  assert.deepEqual(keySignatureOf('F'), ['Bb']);
  assert.deepEqual(keySignatureOf('Bb'), ['Bb', 'Eb']);
  assert.deepEqual(keySignatureOf('Gb'), ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);
});

test('invertedTones gives the root position for 0 and puts the tone at the inversion index at the bottom', () => {
  assert.deepEqual(invertedTones(['C', 'E', 'G']), ['C', 'E', 'G']);
  assert.deepEqual(invertedTones(['C', 'E', 'G'], 1), ['E', 'G', 'C']);
  assert.deepEqual(invertedTones(['C', 'E', 'G'], 2), ['G', 'C', 'E']);
  assert.deepEqual(invertedTones(['G', 'B', 'D', 'F'], 3), ['F', 'G', 'B', 'D']);
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
