import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDiatonic,
  isDiatonicChord,
  isVariationTone,
  toneKind,
} from '../../../chordice/js/theory/tones.js';

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
