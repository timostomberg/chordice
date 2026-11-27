import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSong } from '../../../../chordice/music/generator/song.js';
import { rowsForInstrument, sameSong, sanitizeSnapshot, snapshotOf } from '../../../../chordice/music/generator/snapshot.js';
import { createSeeds } from '../../../../chordice/music/generator/random.js';
import { BASS_PATTERNS, LIBRARY } from '../../../helpers/fixtures.js';

/** A song of the real library with bass notes, variations and inversions, so every field of a chord is used. */
function song(overrides = {}) {
  return generateSong({
    library: LIBRARY,
    bassPatterns: BASS_PATTERNS,
    selection: LIBRARY.map((progression) => progression.id),
    key: 'C',
    count: 8,
    rotation: 2,
    permutation: 2,
    variations: ['7', 'maj7', '6', 'add9', 'sus2', 'sus4'],
    variationProbability: 4,
    bassProbability: 3,
    melodyAmount: 2,
    inversions: true,
    foreignVariations: false,
    circleOfFifths: false,
    seeds: createSeeds(() => 0.3),
    ...overrides,
  });
}

test('a snapshot keeps the rows as plain data, with every field the song and the notes window show', () => {
  const rows = song();
  const snapshot = snapshotOf(rows, { showKey: false, melody: true });
  assert.equal(snapshot.melody, true);
  assert.equal(snapshot.showKey, false);
  assert.equal(snapshot.rows.length, rows.length);
  const [row] = snapshot.rows;
  assert.deepEqual(Object.keys(row).sort(), ['chords', 'group', 'name', 'permuted', 'rotated', 'tonic']);
  assert.deepEqual(row.chords[0], {
    roman: rows[0].chords[0].roman,
    function: rows[0].chords[0].function,
    root: rows[0].chords[0].root,
    quality: rows[0].chords[0].quality,
    variation: rows[0].chords[0].variation,
    symbol: rows[0].chords[0].symbol,
    tones: rows[0].chords[0].tones,
    inversion: rows[0].chords[0].inversion,
    bass: rows[0].chords[0].bass,
    displaySymbol: rows[0].chords[0].displaySymbol,
  });
  // It survives the local storage unchanged.
  assert.deepEqual(sanitizeSnapshot(JSON.parse(JSON.stringify(snapshot))), snapshot);
});

test('a snapshot does not share its arrays with the generated rows', () => {
  const rows = song({ count: 1 });
  const snapshot = snapshotOf(rows);
  rows[0].chords[0].tones.push('X');
  assert.ok(!snapshot.rows[0].chords[0].tones.includes('X'));
});

test('sameSong compares the chords and how they are shown, not where the snapshot came from', () => {
  const a = snapshotOf(song(), { melody: true });
  assert.ok(sameSong(a, snapshotOf(song(), { melody: true })));
  assert.ok(!sameSong(a, snapshotOf(song({ seeds: createSeeds(() => 0.7) }), { melody: true })));
  assert.ok(!sameSong(a, snapshotOf(song(), { melody: false })), 'the melody note is part of the song');
  assert.ok(!sameSong(a, null));
  assert.ok(!sameSong(null, null));
});

test('sanitizeSnapshot rejects what is not a snapshot, and repairs the flags of a row', () => {
  assert.equal(sanitizeSnapshot(null), null);
  assert.equal(sanitizeSnapshot({ rows: 'x' }), null);
  assert.equal(sanitizeSnapshot({ rows: [{ name: 'A', group: 'Pop', tonic: 'C', chords: [] }] }), null, 'a row has chords');
  const snapshot = snapshotOf(song({ count: 1 }));
  const broken = JSON.parse(JSON.stringify(snapshot));
  broken.rows[0].chords[0].tones = [];
  assert.equal(sanitizeSnapshot(broken), null, 'a chord has tones');
  const flags = JSON.parse(JSON.stringify(snapshot));
  flags.rows[0].rotated = 'yes';
  flags.showKey = 1;
  const repaired = sanitizeSnapshot(flags);
  assert.equal(repaired.rows[0].rotated, false);
  assert.equal(repaired.showKey, false);
  // An empty song (no progression selected) is a valid snapshot.
  assert.deepEqual(sanitizeSnapshot({ rows: [] }), { showKey: false, melody: false, rows: [] });
});

test('the guitar shows a snapshot without bass notes and inversions, as when the song is generated for it', () => {
  const snapshot = snapshotOf(song(), { melody: true });
  assert.ok(snapshot.rows.some((row) => row.chords.some((chord) => chord.bass !== null)), 'the sample has bass notes');
  assert.ok(snapshot.rows.some((row) => row.chords.some((chord) => chord.inversion > 0)), 'the sample has inversions');
  assert.equal(rowsForInstrument(snapshot, 'piano'), snapshot.rows);
  for (const row of rowsForInstrument(snapshot, 'guitar')) {
    for (const chord of row.chords) {
      assert.equal(chord.bass, null);
      assert.equal(chord.inversion, 0);
      assert.equal(chord.displaySymbol, chord.symbol);
    }
  }
  const guitar = snapshotOf(song({ bassProbability: 0, inversions: false }));
  assert.deepEqual(rowsForInstrument(snapshot, 'guitar').map((row) => row.chords.map((chord) => chord.symbol)),
    guitar.rows.map((row) => row.chords.map((chord) => chord.symbol)));
});

test('sanitizeSnapshot rejects chords and rows that the song and the notes window could not show', () => {
  const snapshot = snapshotOf(song({ count: 1, bassProbability: 5 }));
  const broken = (change) => {
    const copy = JSON.parse(JSON.stringify(snapshot));
    change(copy.rows[0], copy.rows[0].chords[0]);
    return sanitizeSnapshot(copy);
  };
  assert.notEqual(sanitizeSnapshot(snapshot), null, 'the unchanged snapshot is valid');
  assert.equal(broken((row, chord) => { chord.root = 'Zz'; }), null, 'a root that is no note');
  assert.equal(broken((row, chord) => { chord.tones = ['C', 'Xq']; }), null, 'a tone that is no note');
  assert.equal(broken((row, chord) => { chord.tones = ['C4', 'E4', 'G4']; }), null, 'a tone with an octave');
  assert.equal(broken((row, chord) => { chord.bass = '<b>'; }), null, 'a bass that is no note');
  assert.equal(broken((row, chord) => { chord.inversion = chord.tones.length; }), null, 'an inversion beyond the tones');
  assert.equal(broken((row) => { row.tonic = 'H'; }), null, 'a row in no key of the circle');
  assert.equal(broken((row) => { row.tonic = 'A#'; }), null, 'a key the circle does not have');
});

test('every song the generator makes is a valid snapshot, in one key and in all keys', () => {
  for (const circleOfFifths of [false, true]) {
    for (const value of [0.1, 0.5, 0.9]) {
      const rows = song({ circleOfFifths, bassProbability: 5, variationProbability: 5, foreignVariations: true, seeds: createSeeds(() => value) });
      const snapshot = snapshotOf(rows, { showKey: circleOfFifths, melody: true });
      assert.deepEqual(sanitizeSnapshot(JSON.parse(JSON.stringify(snapshot))), snapshot, `${circleOfFifths} ${value}`);
    }
  }
});
