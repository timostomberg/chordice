import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bassOf, intervalOf } from '../../../../chordice/music/theory/bass.js';

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

test('bassOf is the slash bass if the chord has one, otherwise its root, the first tone', () => {
  assert.equal(bassOf(['C', 'E', 'G']), 'C');
  assert.equal(bassOf(['C', 'E', 'G'], null), 'C');
  assert.equal(bassOf(['C', 'E', 'G'], 'E'), 'E');
});
