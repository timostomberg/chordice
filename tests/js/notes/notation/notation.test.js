import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chord, Note } from 'tonal';
import { accidentalBeforeNote, inversionOrders, lowestAtLeast, voicing, vexKey } from '../../../../chordice/js/notes/notation/notation.js';
import { keySignatureOf } from '../../../../chordice/js/theory/theory.js';

const BASS_RANGE = [43, 54]; // G2 to F#3

test('lowestAtLeast picks the lowest octave of a pitch class at or above the minimum', () => {
  assert.deepEqual(lowestAtLeast('C', 43), { name: 'C3', midi: 48 });
  assert.deepEqual(lowestAtLeast('G', 43), { name: 'G2', midi: 43 });
  assert.deepEqual(lowestAtLeast('E', 60), { name: 'E4', midi: 64 });
});

test('voicing of a root position triad: the fixed root in the bass, the chord tones above middle C', () => {
  assert.deepEqual(voicing(['C', 'E', 'G'], 'C'), { bass: 'C3', upper: ['C4', 'E4', 'G4'] });
});

test('voicing rotates the treble: the first tone of the order is the lowest treble note, the bass stays fixed', () => {
  assert.deepEqual(voicing(['E', 'G', 'C'], 'C'), { bass: 'C3', upper: ['E4', 'G4', 'C5'] });
  assert.deepEqual(voicing(['G', 'C', 'E'], 'C'), { bass: 'C3', upper: ['G4', 'C5', 'E5'] });
});

test('voicing of a slash chord puts the chord bass in the bass staff and in the treble', () => {
  assert.deepEqual(voicing(['C', 'E', 'G'], 'E'), { bass: 'E3', upper: ['C4', 'E4', 'G4'] });
});

test('voicing keeps accidentals in the spelling of the chord', () => {
  assert.deepEqual(voicing(['Bb', 'D', 'F'], 'Bb'), { bass: 'Bb2', upper: ['Bb4', 'D5', 'F5'] });
  assert.deepEqual(voicing(['F#', 'A', 'C#'], 'F#'), { bass: 'F#3', upper: ['F#4', 'A4', 'C#5'] });
});

test('the bass is the same in every inversion of a chord', () => {
  const tones = Chord.get('C7').notes;
  const { orders, bass } = inversionOrders(tones);
  for (const order of orders) {
    assert.equal(voicing(order, bass).bass, 'C3');
  }
});

test('every inversion of common chords keeps the bass in the bass staff range and the treble notes in the treble staff', () => {
  const symbols = ['C', 'Cm', 'C7', 'Cmaj7', 'Csus4', 'C13', 'F#m7b5', 'Bb', 'Ab7#9', 'Eb13'];
  for (const symbol of symbols) {
    const tones = Chord.get(symbol).notes;
    assert.ok(tones.length > 0, symbol);
    const { orders, bass } = inversionOrders(tones);
    for (const order of orders) {
      const placed = voicing(order, bass);
      const midi = Note.midi(placed.bass);
      assert.ok(midi >= BASS_RANGE[0] && midi <= BASS_RANGE[1], `${symbol} ${placed.bass}`);
      const upperMidi = placed.upper.map((name) => Note.midi(name));
      assert.ok(upperMidi.every((value) => value >= 60), `${symbol} ${placed.upper}`);
      assert.deepEqual(upperMidi, [...upperMidi].sort((a, b) => a - b), `${symbol} ${placed.upper}`);
    }
  }
});

test('every inversion uses exactly the chord tones in the treble, one per pitch class', () => {
  const tones = Chord.get('C7').notes;
  const { orders, bass } = inversionOrders(tones);
  for (const order of orders) {
    const pitchClasses = voicing(order, bass).upper.map((name) => Note.get(name).pc);
    assert.deepEqual([...pitchClasses].sort(), [...tones].sort());
  }
});

test('inversionOrders without a chord bass gives all inversions, one per tone, and the bass stays the root in every inversion', () => {
  const root = inversionOrders(['C', 'E', 'G']);
  assert.equal(root.start, 0);
  assert.equal(root.bass, 'C');
  assert.deepEqual(root.orders, [['C', 'E', 'G'], ['E', 'G', 'C'], ['G', 'C', 'E']]);

  const firstInversion = inversionOrders(['C', 'E', 'G'], 1);
  assert.equal(firstInversion.start, 1);
  assert.equal(firstInversion.bass, 'C');
  assert.deepEqual(firstInversion.orders, root.orders);
});

test('inversionOrders starts at the chord\'s own inversion, even when a chord bass is given', () => {
  const { orders, start, bass } = inversionOrders(['C', 'E', 'G'], 2, 'G');
  assert.equal(start, 2);
  assert.equal(bass, 'G');
  assert.deepEqual(orders[start], ['G', 'C', 'E']);
});

test('inversionOrders keeps the chord bass as the fixed bass in every inversion, including the root position', () => {
  assert.deepEqual(inversionOrders(['C', 'E', 'G'], 0, 'E'), {
    orders: [['C', 'E', 'G'], ['E', 'G', 'C'], ['G', 'C', 'E']],
    start: 0,
    bass: 'E',
  });
  assert.equal(inversionOrders(['C', 'E', 'G'], 1, 'C').bass, 'C');
});

test('inversionOrders keeps a bass that is not a chord tone as the fixed bass, with the chord tones in the treble', () => {
  const { orders, start, bass } = inversionOrders(['C', 'E', 'G'], 1, 'D');
  assert.equal(start, 1);
  assert.equal(bass, 'D');
  assert.equal(orders.length, 3);
});

test('inversionOrders rejects an inversion the chord does not have', () => {
  assert.throws(() => inversionOrders(['C', 'E', 'G'], 3), /does not exist/);
});

test('inversionOrders rejects a chord without tones', () => {
  assert.throws(() => inversionOrders([]), /at least one tone/);
});

test('vexKey converts a spelled pitch into the VexFlow key and its accidental', () => {
  assert.deepEqual(vexKey('C4'), { key: 'c/4', accidental: null });
  assert.deepEqual(vexKey('Bb3'), { key: 'bb/3', accidental: 'b' });
  assert.deepEqual(vexKey('F#4'), { key: 'f#/4', accidental: '#' });
});

test('vexKey rejects a pitch without an octave', () => {
  assert.throws(() => vexKey('C'), /octave/);
});

test('the melody note shown for a chord is the top note of its notes window in the same inversion', async () => {
  const { melodyTopOf } = await import('../../../../chordice/js/theory/theory.js');
  const symbols = ['C', 'Cm', 'C7', 'Cmaj7', 'Csus4', 'C13', 'F#m7b5', 'Bb', 'Ab7#9', 'Eb13'];
  for (const symbol of symbols) {
    const tones = Chord.get(symbol).notes;
    const { orders, bass } = inversionOrders(tones);
    orders.forEach((order, inversion) => {
      const top = voicing(order, bass).upper.at(-1);
      assert.equal(Note.get(top).pc, melodyTopOf(tones, inversion), `${symbol} inversion ${inversion}`);
    });
  }
});

test('accidentalBeforeNote writes no sign for a tone the key signature already shows', () => {
  assert.equal(accidentalBeforeNote('F#4', keySignatureOf('G')), null);
  assert.equal(accidentalBeforeNote('Bb3', keySignatureOf('Bb')), null);
  assert.equal(accidentalBeforeNote('Eb4', keySignatureOf('Bb')), null);
  assert.equal(accidentalBeforeNote('C4', keySignatureOf('C')), null);
});

test('accidentalBeforeNote writes the sign of a tone foreign to the key', () => {
  assert.equal(accidentalBeforeNote('F#4', keySignatureOf('C')), '#');
  assert.equal(accidentalBeforeNote('Eb4', keySignatureOf('C')), 'b');
  assert.equal(accidentalBeforeNote('Bb4', keySignatureOf('G')), 'b');
});

test('accidentalBeforeNote writes a natural for a natural that the key signature alters', () => {
  assert.equal(accidentalBeforeNote('F4', keySignatureOf('G')), 'n');
  assert.equal(accidentalBeforeNote('B4', keySignatureOf('Bb')), 'n');
});

test('accidentalBeforeNote without a key signature writes every altered tone, as in C', () => {
  assert.equal(accidentalBeforeNote('F#4'), '#');
  assert.equal(accidentalBeforeNote('F4'), null);
});

test('accidentalBeforeNote rejects a pitch without octave', () => {
  assert.throws(() => accidentalBeforeNote('F#'), /without octave/);
});
