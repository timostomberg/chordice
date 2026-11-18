import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chord, Note } from 'tonal';
import {
  VARIATION_NAMES,
  buildChord,
  circleNameOf,
  isDiatonic,
  isDiatonicChord,
  isVariationTone,
  toneKind,
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
  intervalOf,
  relativeMinorOf,
} from '../../../chordice/js/theory/theory.js';

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

test('harmonic functions follow the roman numeral', () => {
  assert.equal(harmonicFunction('I'), 'tonic');
  assert.equal(harmonicFunction('vi'), 'tonic');
  assert.equal(harmonicFunction('ii'), 'subdominant');
  assert.equal(harmonicFunction('bVI'), 'subdominant');
  assert.equal(harmonicFunction('V'), 'dominant');
  assert.equal(harmonicFunction('bVII'), 'dominant');
  assert.equal(harmonicFunction('xyz'), null);
});

test('the variation list follows the specification: the fixed order first, then the rest, without add11', () => {
  assert.deepEqual(VARIATION_NAMES, [
    '7', 'maj7', '6', 'add9', 'sus2', 'sus4', '9', 'maj9', '11', 'maj11', '13', 'maj13', '6/9', '5',
    '7sus4', '7b9', '7#9', '7b13', '7#5', '7b5', '7#11',
  ]);
});

test('intervalOf turns bass pattern degrees into tonal intervals, with b and # as diminished, minor or augmented', () => {
  assert.equal(intervalOf('1'), '1P');
  assert.equal(intervalOf('3'), '3M');
  assert.equal(intervalOf('b3'), '3m');
  assert.equal(intervalOf('5'), '5P');
  assert.equal(intervalOf('b5'), '5d');
  assert.equal(intervalOf('#5'), '5A');
  assert.equal(intervalOf('b7'), '7m');
  assert.equal(intervalOf('7'), '7M');
  assert.equal(intervalOf('#9'), '9A');
  assert.equal(intervalOf('b9'), '9m');
  assert.equal(intervalOf('11'), '11P');
  assert.equal(intervalOf('#11'), '11A');
  assert.equal(intervalOf('b13'), '13m');
});

test('intervalOf rejects tokens that are not chord degrees', () => {
  assert.throws(() => intervalOf('x'));
  assert.throws(() => intervalOf('8'));
  assert.throws(() => intervalOf('0'));
  assert.throws(() => intervalOf('b0'));
  assert.throws(() => intervalOf('bb3'));
  assert.throws(() => intervalOf(''));
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

test('isDiatonic is true for the notes of the major scale of the key and false for foreign notes', () => {
  assert.equal(isDiatonic('F', 'C'), true);
  assert.equal(isDiatonic('Bb', 'F'), true);
  assert.equal(isDiatonic('Bb', 'C'), false);
  assert.equal(isDiatonic('F#', 'C'), false);
  // Spelling does not matter: A# is Bb in the key of Bb, and Gb is F# in the key of G.
  assert.equal(isDiatonic('A#', 'Bb'), true);
  assert.equal(isDiatonic('Gb', 'G'), true);
  assert.equal(isDiatonic('Gb', 'C'), false);
});

test('isVariationTone is true for a tone outside the base triad of the chord', () => {
  // G7 has the triad G B D; the F is added by the seventh.
  assert.equal(isVariationTone('F', 'G', 'major'), true);
  assert.equal(isVariationTone('B', 'G', 'major'), false);
  // Cm7 has the triad C Eb G; the Bb is added by the seventh.
  assert.equal(isVariationTone('Bb', 'C', 'minor'), true);
  assert.equal(isVariationTone('Eb', 'C', 'minor'), false);
  // A bass that is the root or a triad tone is not a variation tone.
  assert.equal(isVariationTone('C', 'C', 'major'), false);
});

test('isDiatonicChord is true only when every tone of the chord with its variation is in the key', () => {
  // C major: I7 adds Bb, which is foreign; I add9 adds D, which is diatonic.
  assert.equal(isDiatonicChord('C', 'major', '7', 'C'), false);
  assert.equal(isDiatonicChord('C', 'major', 'add9', 'C'), true);
  // G7 in C major is G B D F, all diatonic; G7b9 adds Ab, which is foreign.
  assert.equal(isDiatonicChord('G', 'major', '7', 'C'), true);
  assert.equal(isDiatonicChord('G', 'major', '7b9', 'C'), false);
  // The chord is judged in the key of the row: F7 (F A C Eb) has Eb, which is foreign to F major.
  assert.equal(isDiatonicChord('F', 'major', '7', 'F'), false);
  assert.equal(isDiatonicChord('F', 'major', 'add9', 'F'), true);
  // A chord that is foreign already, such as bVII (Bb) in C, has no diatonic variation.
  assert.equal(isDiatonicChord('Bb', 'major', null, 'C'), false);
});

test('toneKind is foreign for a tone outside the key, variation for a tone the chord variation adds, and plain otherwise', () => {
  // F7 in the key of F: the Eb is foreign to F, and the Bb of the seventh is diatonic but added by the variation.
  const F7 = { root: 'F', quality: 'major', variation: '7' };
  assert.equal(toneKind('Eb', F7, 'F'), 'foreign');
  assert.equal(toneKind('Bb', F7, 'F'), 'variation');
  assert.equal(toneKind('F', F7, 'F'), '');
  assert.equal(toneKind('C', F7, 'F'), '');
});

test('toneKind gives foreign precedence when a tone is both foreign and added by the variation', () => {
  // C7 in the key of C: the Bb is added by the seventh and foreign to C, so it is foreign.
  assert.equal(toneKind('Bb', { root: 'C', quality: 'major', variation: '7' }, 'C'), 'foreign');
});
