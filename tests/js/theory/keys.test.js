import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAJOR_KEYS,
  circleNameOf,
  isKeyName,
  keySignatureOf,
  majorKeyOf,
  minorNameOf,
  neighbourKeysOf,
  relativeMinorOf,
} from '../../../chordice/js/theory/keys.js';

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
