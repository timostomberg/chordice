import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, NO_BASS_PATTERNS } from '../../../chordice/js/generation/generator.js';
import { buildBassPatterns, buildLibrary } from '../../../chordice/js/data/validate.js';
import { createSeeds } from '../../../chordice/js/generation/random.js';
import { VARIATION_NAMES } from '../../../chordice/js/theory/theory.js';

// Shaped like chord_progressions.yaml: the YAML parses 5, 6, 7 and 9 as numbers, which the library must normalise.
const DATA = {
  Pop: {
    chord_variations: {
      I: { base: 5, 6: 4, add9: 4 },
      V: { base: 5, 7: 5, sus4: 3 },
      vi: { base: 5, 9: 3 },
      IV: { base: 5, 6: 4 },
      III: { base: 5, 7: 3 },
    },
    progressions: {
      'Pop Progression': ['I', 'V', 'vi', 'IV'],
      'Minor Cadence': ['ii', 'III', 'vi'],
    },
  },
};

// Shaped like bass_patterns.yaml: intervals relative to the chord root, with their commonness.
const BASS_DATA = {
  chord_degrees: {
    I: { 1: 5, 3: 2, 5: 3 },
    V: { 1: 5, 3: 2, 5: 3 },
    vi: { 1: 5, b3: 2, 5: 3 },
    IV: { 1: 5, 3: 2, 5: 3 },
    III: { 1: 5, 3: 2 },
  },
  chord_variations: {
    6: { 6: 2 },
    add9: { 9: 2 },
    7: { b7: 2 },
    sus4: { 4: 3 },
    9: { 9: 2 },
  },
};

const LIBRARY = buildLibrary(DATA);
const BASS = buildBassPatterns(BASS_DATA);
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
    bassPatterns: BASS,
    selection: [POP, MINOR],
    keys: ['C'],
    count: 4,
    rotation: 0,
    permutation: 0,
    variations: [...VARIATION_NAMES],
    variationProbability: 0,
    bassProbability: 0,
    inversions: false,
    foreignVariations: true,
    seeds: SEEDS,
    ...overrides,
  };
}

test('without probabilities the progressions stay plain and in the key of the selection', () => {
  const rows = generate(settings({ selection: [POP], count: 1 }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Pop Progression');
  assert.equal(rows[0].tonic, 'C');
  assert.deepEqual(rows[0].chords.map((chord) => chord.displaySymbol), ['C', 'G', 'Am', 'F']);
});

test('the number of rows equals count and follows the selection', () => {
  for (const count of [1, 2, 4, 8, 12]) {
    assert.equal(generate(settings({ count })).length, count);
  }
  assert.deepEqual(generate(settings({ selection: [] })), []);
  assert.deepEqual(generate(settings({ keys: [] })), []);
});

test('a key pair places each progression in one of the two selected major keys', () => {
  const tonics = new Set(generate(settings({ selection: [POP, MINOR], count: 16, keys: ['C', 'G'] })).map((row) => row.tonic));
  assert.deepEqual([...tonics].sort(), ['C', 'G']);
});

test('variation and bass probability of 5, which means 100%, stay within the allowed options', () => {
  const rows = generate(settings({
    selection: [POP],
    count: 16,
    variationProbability: 5,
    bassProbability: 5,
  }));
  // Variations of each chord, from the chord_variations above.
  const allowedVariations = { I: ['6', 'add9'], V: ['7', 'sus4'], vi: ['9'], IV: ['6'] };
  // Bass notes in C major: the degree notes (3 and 5 of the chord, and b3 of vi) and the variation notes.
  const allowedBass = { I: ['E', 'G', 'A', 'D'], V: ['B', 'D', 'F', 'C'], vi: ['C', 'E', 'B'], IV: ['A', 'C', 'D'] };
  let extended = 0;
  let slashed = 0;
  for (const row of rows) {
    for (const chord of row.chords) {
      if (chord.variation !== null) {
        extended += 1;
        assert.ok(allowedVariations[chord.roman].includes(chord.variation));
      }
      if (chord.bass !== null) {
        slashed += 1;
        assert.ok(allowedBass[chord.roman].includes(chord.bass), `${chord.roman} over ${chord.bass}`);
        assert.equal(chord.displaySymbol, `${chord.symbol}/${chord.bass}`);
      }
    }
  }
  assert.ok(extended > 0);
  assert.ok(slashed > 0);
});

test('a bass note must be a tone of the chord, so a sus4 chord never takes its third as bass', () => {
  const sus = buildBassPatterns({ chord_degrees: { V: { 3: 5 } }, chord_variations: { sus4: { 3: 5 } } });
  const rows = generate(settings({ selection: [POP], count: 16, variationProbability: 5, bassProbability: 5, variations: ['sus4'], bassPatterns: sus }));
  for (const chord of rows.flatMap((row) => row.chords)) {
    if (chord.variation === 'sus4') {
      assert.equal(chord.bass, null);
    }
  }
});

test('a single bass note is always used when the bass is on, and the root gives no slash', () => {
  const only = buildBassPatterns({ chord_degrees: { IV: { 5: 1 }, I: { 1: 5 } }, chord_variations: {} });
  const rows = generate(settings({ selection: [POP], count: 8, bassProbability: 5, bassPatterns: only }));
  for (const row of rows) {
    const iv = row.chords.find((chord) => chord.roman === 'IV');
    assert.equal(iv.bass, 'C');
    assert.equal(iv.displaySymbol, 'F/C');
    assert.equal(row.chords.find((chord) => chord.roman === 'I').bass, null);
  }
});

test('the bass notes are chosen by commonness: the standard bass 5 against the third 1 is about 5 to 1', () => {
  const weighted = buildBassPatterns({ chord_degrees: { I: { 1: 5, 3: 1 } }, chord_variations: {} });
  const rows = generate(settings({ selection: [POP], count: 400, bassProbability: 5, bassPatterns: weighted }));
  const chords = rows.flatMap((row) => row.chords.filter((chord) => chord.roman === 'I'));
  const thirds = chords.filter((chord) => chord.bass === 'E').length;
  assert.ok(thirds / chords.length > 0.1 && thirds / chords.length < 0.25, `${thirds} of ${chords.length}`);
});

test('the variations are chosen by commonness, the base included', () => {
  const weighted = buildLibrary({
    Pop: { chord_variations: { I: { base: 1, 7: 4 } }, progressions: { X: ['I'] } },
  });
  const rows = generate(settings({ library: weighted, selection: ['Pop / X'], count: 400, variationProbability: 5 }));
  const extended = rows.filter((row) => row.chords[0].variation === '7').length;
  assert.ok(extended / rows.length > 0.7 && extended / rows.length < 0.9, `${extended} of ${rows.length}`);
});

test('the probability scale is 0 to 5, so 1 means 20% of the outcomes can change', () => {
  const weighted = buildLibrary({
    Pop: { chord_variations: { I: { base: 5, 7: 5 } }, progressions: { X: ['I'] } },
  });
  const rows = generate(settings({ library: weighted, selection: ['Pop / X'], count: 800, variationProbability: 1 }));
  const extended = rows.filter((row) => row.chords[0].variation !== null).length;
  // 20% active, then half of those take the 7: about 10% of the chords.
  assert.ok(extended / rows.length > 0.06 && extended / rows.length < 0.14, `${extended} of ${rows.length}`);
});

test('without bass patterns every chord keeps its standard bass', () => {
  const rows = generate(settings({ selection: [POP], count: 8, bassProbability: 5, bassPatterns: NO_BASS_PATTERNS }));
  assert.ok(rows.flatMap((row) => row.chords).every((chord) => chord.bass === null));
});

test('an empty variation list gives plain chords, even at 100% probability', () => {
  const rows = generate(settings({
    selection: [POP],
    count: 16,
    variationProbability: 5,
    variations: [],
  }));
  assert.ok(rows.length > 0);
  for (const row of rows) {
    for (const chord of row.chords) {
      assert.equal(chord.variation, null);
    }
  }
});

test('variations are limited to the selected variation names', () => {
  const rows = generate(settings({
    selection: [POP],
    count: 16,
    variationProbability: 5,
    variations: ['add9'],
  }));
  for (const row of rows) {
    for (const chord of row.chords) {
      assert.ok(chord.variation === null || chord.variation === 'add9');
    }
  }
});

test('changing the bass probability keeps the progression and the variations', () => {
  const base = { selection: [POP], count: 8, variationProbability: 3 };
  const without = generate(settings({ ...base, bassProbability: 0 }));
  const withBass = generate(settings({ ...base, bassProbability: 5 }));
  assert.deepEqual(
    withBass.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol])),
    without.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol])),
  );
});

test('changing the variation probability keeps the bass notes of chords whose variation did not change', () => {
  const base = { selection: [POP], count: 8, bassProbability: 4 };
  const without = generate(settings({ ...base, variationProbability: 0 }));
  const withVariations = generate(settings({ ...base, variationProbability: 5 }));
  const pairs = withVariations.flatMap((row, i) => row.chords.map((chord, j) => [chord, without[i].chords[j]]));
  const unchanged = pairs.filter(([chord, plain]) => chord.variation === null && plain.variation === null);
  assert.ok(unchanged.length > 0);
  for (const [chord, plain] of unchanged) {
    assert.equal(chord.bass, plain.bass);
  }
});

test('changing the count keeps the rows that were already there', () => {
  const short = generate(settings({ count: 2, rotation: 3, variationProbability: 3 }));
  const long = generate(settings({ count: 8, rotation: 3, variationProbability: 3 }));
  assert.equal(JSON.stringify(long.slice(0, 2)), JSON.stringify(short));
});

test('generation is deterministic for the same settings', () => {
  const options = settings({ count: 12, rotation: 2, permutation: 2, variationProbability: 3, bassProbability: 3 });
  assert.equal(JSON.stringify(generate(options)), JSON.stringify(generate(options)));
});

test('rotation of 100 percent yields a rotation of the original order', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const doubled = [...original, ...original].join(' ');
  const rows = generate(settings({ selection: [POP], count: 16, rotation: 5 }));
  for (const row of rows) {
    const romans = row.chords.map((chord) => chord.roman);
    assert.ok(doubled.includes(romans.join(' ')), romans.join(' '));
  }
});

test('permutation of 100 percent keeps the same chords in a new order', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const rows = generate(settings({ selection: [POP], count: 16, permutation: 5 }));
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

test('rows report a rotation or permutation only if the chord order really changed', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const romans = (row) => row.chords.map((chord) => chord.roman);
  const rotated = generate(settings({ selection: [POP], count: 16, rotation: 5 }));
  for (const row of rotated) {
    assert.equal(row.rotated, romans(row).join() !== original.join(), `row ${row.index}`);
    assert.equal(row.permuted, false);
  }
  assert.ok(rotated.some((row) => row.rotated) && rotated.some((row) => !row.rotated));

  const permuted = generate(settings({ selection: [POP], count: 16, permutation: 5 }));
  for (const row of permuted) {
    assert.equal(row.permuted, romans(row).join() !== original.join(), `row ${row.index}`);
    assert.equal(row.rotated, false);
  }
  assert.ok(permuted.some((row) => row.permuted) && permuted.some((row) => !row.permuted));
});

test('with rotation and permutation both on, a row is flagged only if its final order differs from the predefined one', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const romans = (row) => row.chords.map((chord) => chord.roman);
  const rows = generate(settings({ selection: [POP], count: 64, rotation: 5, permutation: 5 }));
  for (const row of rows) {
    const differs = romans(row).join() !== original.join();
    assert.equal(row.rotated || row.permuted, differs, `row ${row.index}: ${romans(row).join(' ')}`);
  }
  assert.ok(rows.some((row) => row.rotated));
  assert.ok(rows.some((row) => row.permuted));
  assert.ok(rows.some((row) => !row.rotated && !row.permuted));
});

test('a permutation that yields a cyclic shift of the predefined order is flagged as a rotation', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const romans = (row) => row.chords.map((chord) => chord.roman);
  const shifts = [1, 2, 3].map((s) => [...original.slice(s), ...original.slice(0, s)].join());
  const rows = generate(settings({ selection: [POP], count: 64, permutation: 5 }));
  const asShift = rows.filter((row) => shifts.includes(romans(row).join()));
  assert.ok(asShift.length > 0);
  for (const row of asShift) {
    assert.equal(row.rotated, true, `row ${row.index}`);
    assert.equal(row.permuted, false, `row ${row.index}`);
  }
  const others = rows.filter((row) => romans(row).join() !== original.join() && !shifts.includes(romans(row).join()));
  assert.ok(others.length > 0);
  for (const row of others) {
    assert.equal(row.permuted, true, `row ${row.index}`);
    assert.equal(row.rotated, false, `row ${row.index}`);
  }
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
  const chords = generate(settings({ selection: [POP], count: 32, inversions: true, variationProbability: 5 }))
    .flatMap((row) => row.chords);
  const fourToned = chords.filter((chord) => chord.tones.length === 4).map((chord) => chord.inversion);
  assert.ok(fourToned.length > 0, 'the variations must add tones for this test');
  assert.deepEqual([...new Set(fourToned)].sort(), [0, 1, 2, 3]);
});

test('a triad with inversions on can take the root position and both inversions', () => {
  const inversions = new Set(generate(settings({ selection: [POP], count: 16, inversions: true }))
    .flatMap((row) => row.chords.filter((chord) => chord.tones.length === 3).map((chord) => chord.inversion)));
  assert.deepEqual([...inversions].sort(), [0, 1, 2]);
});

test('switching inversions on keeps the progression, variations and bass notes', () => {
  const base = { selection: [POP, MINOR], count: 8, variationProbability: 3, bassProbability: 3 };
  const without = generate(settings({ ...base, inversions: false }));
  const withInversions = generate(settings({ ...base, inversions: true }));
  const outline = (rows) => rows.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol, chord.bass]));
  assert.deepEqual(outline(withInversions), outline(without));
});

test('changing the bass probability keeps the inversions', () => {
  const base = { selection: [POP], count: 8, inversions: true, variationProbability: 0 };
  const plain = generate(settings({ ...base, bassProbability: 0 }));
  const varied = generate(settings({ ...base, bassProbability: 5 }));
  assert.deepEqual(
    varied.map((row) => row.chords.map((chord) => chord.inversion)),
    plain.map((row) => row.chords.map((chord) => chord.inversion)),
  );
});

test('with foreign variations off, a chord takes no variation with a tone foreign to the key of its row', () => {
  const library = buildLibrary({
    Pop: { chord_variations: { I: { base: 1, 7: 5, add9: 5 }, V: { base: 1, 7: 5 } }, progressions: { X: ['I', 'V'] } },
  });
  const off = generate(settings({ library, selection: ['Pop / X'], count: 64, variationProbability: 5, foreignVariations: false }))
    .flatMap((row) => row.chords);
  // I7 in C contains Bb, which is foreign; add9 and V7 (G B D F) are diatonic.
  assert.ok(off.every((chord) => !(chord.roman === 'I' && chord.variation === '7')));
  assert.ok(off.some((chord) => chord.roman === 'I' && chord.variation === 'add9'));
  assert.ok(off.some((chord) => chord.roman === 'V' && chord.variation === '7'));
});

test('the foreign check is judged in the key of the row: I7 is left out in F as well, and is used again when on', () => {
  const library = buildLibrary({
    Pop: { chord_variations: { I: { base: 1, 7: 5, add9: 5 } }, progressions: { X: ['I'] } },
  });
  const keyF = { library, selection: ['Pop / X'], keys: ['F'], count: 64, variationProbability: 5 };
  const off = generate(settings({ ...keyF, foreignVariations: false })).flatMap((row) => row.chords);
  // F major is F G A Bb C D E, so I7 (F A C Eb) has Eb, which is foreign.
  assert.ok(off.every((chord) => chord.variation !== '7'));
  assert.ok(off.some((chord) => chord.variation === 'add9'));
  const on = generate(settings({ ...keyF, foreignVariations: true })).flatMap((row) => row.chords);
  assert.ok(on.some((chord) => chord.variation === '7'));
});

test('changing the foreign variations switch keeps the progression and the rows', () => {
  const base = { selection: [POP], count: 8, variationProbability: 3, bassProbability: 3 };
  const on = generate(settings({ ...base, foreignVariations: true }));
  const off = generate(settings({ ...base, foreignVariations: false }));
  assert.deepEqual(
    off.map((row) => [row.name, row.tonic, row.chords.map((chord) => chord.roman)]),
    on.map((row) => [row.name, row.tonic, row.chords.map((chord) => chord.roman)]),
  );
});
