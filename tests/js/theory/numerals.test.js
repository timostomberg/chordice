import { test } from 'node:test';
import assert from 'node:assert/strict';
import { degree, harmonicFunction, parseNumeral } from '../../../chordice/js/theory/numerals.js';

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

test('harmonic functions follow the roman numeral', () => {
  assert.equal(harmonicFunction('I'), 'tonic');
  assert.equal(harmonicFunction('vi'), 'tonic');
  assert.equal(harmonicFunction('ii'), 'subdominant');
  assert.equal(harmonicFunction('bVI'), 'subdominant');
  assert.equal(harmonicFunction('V'), 'dominant');
  assert.equal(harmonicFunction('bVII'), 'dominant');
  assert.equal(harmonicFunction('xyz'), null);
});
