import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLibrary, createSeeds, generate, SEED_NAMES, unit } from '../../chordice/js/generator.js';
import { EXTENSION_NAMES } from '../../chordice/js/theory.js';

const DATA = [
  {
    group: 'Pop',
    progressions: [
      {
        name: 'Pop Progression',
        progression: ['I', 'V', 'vi', 'IV'],
        // YAML parses 6, 7 and 9 as numbers; the library must normalise them.
        chord_extensions: { I: [6, 'add9'], V: [7, 'sus4'], vi: [9], IV: [6] },
        bass_notes: { I: ['III', 'V'], V: ['III', 'V'], vi: ['III', 'V'], IV: ['III', 'V'] },
      },
      {
        name: 'Minor Cadence',
        progression: ['ii', 'III', 'vi'],
        chord_extensions: { III: [7] },
        bass_notes: { ii: ['I'], vi: ['I', 'III'] },
      },
    ],
  },
];

const LIBRARY = buildLibrary(DATA);
const POP = 'Pop / Pop Progression';
const MINOR = 'Pop / Minor Cadence';
// Deterministic pseudo-random source (Park-Miller) so that every seed differs.
let lcgState = 1;
const SEEDS = createSeeds(() => {
  lcgState = (lcgState * 16807) % 2147483647;
  return lcgState / 2147483647;
});

function settings(overrides = {}) {
  return {
    library: LIBRARY,
    selection: [POP, MINOR],
    keys: ['C'],
    count: 4,
    rotation: 0,
    permutation: 0,
    extensions: [...EXTENSION_NAMES],
    extensionProbability: 0,
    bassProbability: 0,
    inversions: false,
    seeds: SEEDS,
    ...overrides,
  };
}

test('buildLibrary normalises YAML numbers to extension strings', () => {
  const pop = LIBRARY.find((progression) => progression.id === POP);
  assert.deepEqual(pop.chordExtensions.I, ['6', 'add9']);
  assert.deepEqual(pop.chordExtensions.vi, ['9']);
});

test('buildLibrary rejects unknown extensions and numerals', () => {
  const base = { name: 'X', progression: ['I'] };
  const wrap = (entry) => [{ group: 'G', progressions: [entry] }];
  assert.throws(() => buildLibrary(wrap({ ...base, chord_extensions: { I: ['7b5'] } })));
  assert.throws(() => buildLibrary(wrap({ ...base, progression: ['H'] })));
  assert.throws(() => buildLibrary(wrap({ ...base, chord_extensions: { V: ['7'] } })));
});

test('without probabilities the progressions stay plain and in the key of the selection', () => {
  const rows = generate(settings({ selection: [POP], count: 1 }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Pop Progression');
  assert.equal(rows[0].tonic, 'C');
  assert.deepEqual(rows[0].chords.map((chord) => chord.displaySymbol), ['C', 'G', 'Am', 'F']);
});

test('the number of rows equals count and follows the selection', () => {
  for (const count of [1, 2, 4, 8, 12, 16]) {
    assert.equal(generate(settings({ count })).length, count);
  }
  assert.deepEqual(generate(settings({ selection: [] })), []);
  assert.deepEqual(generate(settings({ keys: [] })), []);
});

test('a key pair places each progression in one of the two selected major keys', () => {
  const tonics = new Set(generate(settings({ selection: [POP, MINOR], count: 16, keys: ['C', 'G'] })).map((row) => row.tonic));
  assert.deepEqual([...tonics].sort(), ['C', 'G']);
});

test('extension and bass probability of 100 stay within the allowed options', () => {
  const rows = generate(settings({
    selection: [POP],
    count: 16,
    extensionProbability: 100,
    bassProbability: 100,
  }));
  // Mirrors the bass_notes and chord_extensions of "Pop Progression" in the YAML (C major: III = E, V = G).
  const allowedBass = { I: ['E', 'G'], V: ['E', 'G'], vi: ['E', 'G'], IV: ['E', 'G'] };
  const allowedExtensions = {
    I: ['6', 'add9', 'sus2', 'sus4', 'maj9'],
    V: ['7', 'add9', 'sus2', 'sus4', '9', '7sus4'],
    vi: ['6', 'add9', 'sus2', 'sus4', '9'],
    IV: ['6', 'add9', 'sus2', 'sus4', 'maj9'],
  };
  let extended = 0;
  let inverted = 0;
  for (const row of rows) {
    for (const chord of row.chords) {
      if (chord.extension !== null) {
        extended += 1;
        assert.ok(allowedExtensions[chord.roman].includes(chord.extension));
      }
      if (chord.bass !== null) {
        inverted += 1;
        assert.ok(allowedBass[chord.roman].includes(chord.bass), `${chord.roman} over ${chord.bass}`);
        assert.equal(chord.displaySymbol, `${chord.symbol}/${chord.bass}`);
      }
    }
  }
  assert.ok(extended > 0);
  assert.ok(inverted > 0);
});

test('an empty extension list gives plain chords, even at 100% probability', () => {
  const rows = generate(settings({
    selection: [POP],
    count: 16,
    extensionProbability: 100,
    extensions: [],
  }));
  assert.ok(rows.length > 0);
  for (const row of rows) {
    for (const chord of row.chords) {
      assert.equal(chord.extension, null);
    }
  }
});

test('extensions are limited to the selected extension names', () => {
  const rows = generate(settings({
    selection: [POP],
    count: 16,
    extensionProbability: 100,
    extensions: ['add9'],
  }));
  for (const row of rows) {
    for (const chord of row.chords) {
      assert.ok(chord.extension === null || chord.extension === 'add9');
    }
  }
});

test('changing the bass probability keeps the progression and the extensions', () => {
  const base = { selection: [POP], count: 8, extensionProbability: 60 };
  const without = generate(settings({ ...base, bassProbability: 0 }));
  const withBass = generate(settings({ ...base, bassProbability: 100 }));
  assert.deepEqual(
    withBass.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol])),
    without.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol])),
  );
});

test('changing the extension probability keeps the bass notes', () => {
  const base = { selection: [POP], count: 8, bassProbability: 70 };
  const without = generate(settings({ ...base, extensionProbability: 0 }));
  const withExtensions = generate(settings({ ...base, extensionProbability: 100 }));
  assert.deepEqual(
    withExtensions.map((row) => row.chords.map((chord) => chord.bass)),
    without.map((row) => row.chords.map((chord) => chord.bass)),
  );
});

test('changing the count keeps the rows that were already there', () => {
  const short = generate(settings({ count: 2, rotation: 50, extensionProbability: 50 }));
  const long = generate(settings({ count: 8, rotation: 50, extensionProbability: 50 }));
  assert.equal(JSON.stringify(long.slice(0, 2)), JSON.stringify(short));
});

test('generation is deterministic for the same settings', () => {
  const options = settings({ count: 12, rotation: 40, permutation: 30, extensionProbability: 50, bassProbability: 50 });
  assert.equal(JSON.stringify(generate(options)), JSON.stringify(generate(options)));
});

test('rotation of 100 percent yields a rotation of the original order', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const doubled = [...original, ...original].join(' ');
  const rows = generate(settings({ selection: [POP], count: 16, rotation: 100 }));
  for (const row of rows) {
    const romans = row.chords.map((chord) => chord.roman);
    assert.ok(doubled.includes(romans.join(' ')), romans.join(' '));
  }
});

test('permutation of 100 percent keeps the same chords in a new order', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const rows = generate(settings({ selection: [POP], count: 16, permutation: 100 }));
  for (const row of rows) {
    const romans = row.chords.map((chord) => chord.roman);
    assert.deepEqual([...romans].sort(), [...original].sort());
  }
});

test('zero rotation and permutation never change the chord order', () => {
  const rows = generate(settings({ selection: [POP], count: 16, rotation: 0, permutation: 0 }));
  for (const row of rows) {
    assert.deepEqual(row.chords.map((chord) => chord.roman), ['I', 'V', 'vi', 'IV']);
  }
});

test('unit returns values in [0, 1) that are roughly uniform', () => {
  let sum = 0;
  const samples = 20000;
  for (let i = 0; i < samples; i += 1) {
    const value = unit(12345, i);
    assert.ok(value >= 0 && value < 1);
    sum += value;
  }
  assert.ok(Math.abs(sum / samples - 0.5) < 0.02);
});

test('createSeeds provides every seed name', () => {
  const seeds = createSeeds(() => 0.5);
  assert.deepEqual(Object.keys(seeds).sort(), [...SEED_NAMES].sort());
});

test('rows report a rotation or permutation only if the chord order really changed', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const romans = (row) => row.chords.map((chord) => chord.roman);
  const rotated = generate(settings({ selection: [POP], count: 16, rotation: 100 }));
  for (const row of rotated) {
    assert.equal(row.rotated, romans(row).join() !== original.join(), `row ${row.index}`);
    assert.equal(row.permuted, false);
  }
  assert.ok(rotated.some((row) => row.rotated) && rotated.some((row) => !row.rotated));

  const permuted = generate(settings({ selection: [POP], count: 16, permutation: 100 }));
  for (const row of permuted) {
    assert.equal(row.permuted, romans(row).join() !== original.join(), `row ${row.index}`);
    assert.equal(row.rotated, false);
  }
  assert.ok(permuted.some((row) => row.permuted) && permuted.some((row) => !row.permuted));
});

test('without rotation or permutation no row is flagged', () => {
  for (const row of generate(settings({ selection: [POP], count: 8 }))) {
    assert.equal(row.rotated, false);
    assert.equal(row.permuted, false);
  }
});

test('chords carry their quality, so major and minor chords can be told apart', () => {
  const [row] = generate(settings({ selection: [POP], count: 1 }));
  assert.deepEqual(row.chords.map((chord) => [chord.roman, chord.quality]), [
    ['I', 'major'], ['V', 'major'], ['vi', 'minor'], ['IV', 'major'],
  ]);
});

test('with inversions off every chord stays in root position', () => {
  for (const row of generate(settings({ selection: [POP, MINOR], count: 16, inversions: false }))) {
    assert.ok(row.chords.every((chord) => chord.inversion === 0));
  }
});

test('with inversions on every chord is in one of its own positions, and the root position is one of them', () => {
  const chords = generate(settings({ selection: [POP, MINOR], count: 16, inversions: true })).flatMap((row) => row.chords);
  for (const chord of chords) {
    assert.ok(Number.isInteger(chord.inversion) && chord.inversion >= 0 && chord.inversion < chord.tones.length, chord.symbol);
  }
  assert.ok(chords.some((chord) => chord.inversion === 0));
  assert.ok(chords.some((chord) => chord.inversion > 0));
});

test('with inversions on, extended chords get all their positions, including the highest ones', () => {
  const chords = generate(settings({ selection: [POP], count: 32, inversions: true, extensionProbability: 100 }))
    .flatMap((row) => row.chords);
  const fourToned = chords.filter((chord) => chord.tones.length === 4).map((chord) => chord.inversion);
  assert.ok(fourToned.length > 0, 'the extensions must add tones for this test');
  assert.deepEqual([...new Set(fourToned)].sort(), [0, 1, 2, 3]);
});

test('a triad with inversions on can take the root position and both inversions', () => {
  const inversions = new Set(generate(settings({ selection: [POP], count: 16, inversions: true }))
    .flatMap((row) => row.chords.filter((chord) => chord.tones.length === 3).map((chord) => chord.inversion)));
  assert.deepEqual([...inversions].sort(), [0, 1, 2]);
});

test('switching inversions on keeps the progression, extensions and bass notes', () => {
  const base = { selection: [POP, MINOR], count: 8, extensionProbability: 60, bassProbability: 60 };
  const without = generate(settings({ ...base, inversions: false }));
  const withInversions = generate(settings({ ...base, inversions: true }));
  const outline = (rows) => rows.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol, chord.bass]));
  assert.deepEqual(outline(withInversions), outline(without));
});

test('changing the bass probability keeps the inversions', () => {
  const base = { selection: [POP], count: 8, inversions: true, extensionProbability: 0 };
  const plain = generate(settings({ ...base, bassProbability: 0 }));
  const varied = generate(settings({ ...base, bassProbability: 100 }));
  assert.deepEqual(
    varied.map((row) => row.chords.map((chord) => chord.inversion)),
    plain.map((row) => row.chords.map((chord) => chord.inversion)),
  );
});
