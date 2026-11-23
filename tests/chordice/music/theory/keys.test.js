import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLOTS_COUNTERCLOCKWISE,
  MAJOR_KEYS,
  circleNameOf,
  isKeyName,
  keySignatureOf,
  minorNameOf,
  neighbourKeysOf,
  relativeMinorOf,
} from '../../../../chordice/music/theory/keys.js';

test('keys are the 13 major keys; minor keys are shown on the circle only', () => {
  assert.equal(MAJOR_KEYS.length, 13);
  assert.ok(isKeyName('Gb'));
  assert.ok(!isKeyName('Am'));
  assert.equal(relativeMinorOf('C'), 'A');
  assert.equal(minorNameOf('Gb'), 'Ebm');
  assert.equal(minorNameOf('F#'), 'D#m');
});

test('relativeMinorOf rejects a name that is not a major key', () => {
  assert.throws(() => relativeMinorOf('H'), /Unknown major key/);
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

test('SLOTS_COUNTERCLOCKWISE runs once round the circle of fifths counterclockwise from C, with F# and Gb in one slot', () => {
  assert.deepEqual(SLOTS_COUNTERCLOCKWISE,
    [['C'], ['F'], ['Bb'], ['Eb'], ['Ab'], ['Db'], ['F#', 'Gb'], ['B'], ['E'], ['A'], ['D'], ['G']]);
  assert.ok(SLOTS_COUNTERCLOCKWISE.flat().every(isKeyName));
});
