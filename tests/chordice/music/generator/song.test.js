import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSong } from '../../../../chordice/music/generator/song.js';
import { NO_BASS_PATTERNS } from '../../../../chordice/music/generator/bass.js';
import { buildBassPatterns, buildLibrary } from '../../../../chordice/music/data/validate.js';
import { createSeeds } from '../../../../chordice/music/generator/random.js';
import { VARIATION_NAMES } from '../../../../chordice/music/theory/chords.js';
import { melodyTopOf, pitchDistance } from '../../../../chordice/music/theory/melody.js';

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
    key: 'C',
    count: 4,
    rotation: 0,
    permutation: 0,
    variations: [...VARIATION_NAMES],
    variationProbability: 0,
    bassProbability: 0,
    melodyAmount: 2,
    inversions: false,
    foreignVariations: true,
    seeds: SEEDS,
    ...overrides,
  };
}

test('without probabilities the progressions stay plain and in the key of the selection', () => {
  const rows = generateSong(settings({ selection: [POP], count: 1 }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Pop Progression');
  assert.equal(rows[0].tonic, 'C');
  assert.deepEqual(rows[0].chords.map((chord) => chord.displaySymbol), ['C', 'G', 'Am', 'F']);
});

test('the number of rows equals count and follows the selection', () => {
  for (const count of [1, 2, 4, 8]) {
    assert.equal(generateSong(settings({ count })).length, count);
  }
  assert.deepEqual(generateSong(settings({ selection: [] })), []);
});

test('variation and bass probability of 5, which means 100%, stay within the allowed options', () => {
  const rows = generateSong(settings({
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

test('the bass notes are chosen by commonness: the standard bass 5 against the third 1 is about 5 to 1', () => {
  const weighted = buildBassPatterns({ chord_degrees: { I: { 1: 5, 3: 1 } }, chord_variations: {} });
  const rows = generateSong(settings({ selection: [POP], count: 400, bassProbability: 5, bassPatterns: weighted }));
  const chords = rows.flatMap((row) => row.chords.filter((chord) => chord.roman === 'I'));
  const thirds = chords.filter((chord) => chord.bass === 'E').length;
  assert.ok(thirds / chords.length > 0.1 && thirds / chords.length < 0.25, `${thirds} of ${chords.length}`);
});

test('the variations are chosen by commonness, the base included', () => {
  const weighted = buildLibrary({
    Pop: { chord_variations: { I: { base: 1, 7: 4 } }, progressions: { X: ['I'] } },
  });
  const rows = generateSong(settings({ library: weighted, selection: ['Pop / X'], count: 400, variationProbability: 5 }));
  const extended = rows.filter((row) => row.chords[0].variation === '7').length;
  assert.ok(extended / rows.length > 0.7 && extended / rows.length < 0.9, `${extended} of ${rows.length}`);
});

test('the probability scale is 0 to 5, so 1 means 20% of the outcomes can change', () => {
  const weighted = buildLibrary({
    Pop: { chord_variations: { I: { base: 5, 7: 5 } }, progressions: { X: ['I'] } },
  });
  const rows = generateSong(settings({ library: weighted, selection: ['Pop / X'], count: 800, variationProbability: 1 }));
  const extended = rows.filter((row) => row.chords[0].variation !== null).length;
  // 20% active, then half of those take the 7: about 10% of the chords.
  assert.ok(extended / rows.length > 0.06 && extended / rows.length < 0.14, `${extended} of ${rows.length}`);
});

test('without bass patterns every chord keeps its standard bass', () => {
  const rows = generateSong(settings({ selection: [POP], count: 8, bassProbability: 5, bassPatterns: NO_BASS_PATTERNS }));
  assert.ok(rows.flatMap((row) => row.chords).every((chord) => chord.bass === null));
});

test('changing the bass probability keeps the progression and the variations', () => {
  const base = { selection: [POP], count: 8, variationProbability: 3 };
  const without = generateSong(settings({ ...base, bassProbability: 0 }));
  const withBass = generateSong(settings({ ...base, bassProbability: 5 }));
  assert.deepEqual(
    withBass.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol])),
    without.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol])),
  );
});

test('changing the variation probability keeps the bass notes of chords whose variation did not change', () => {
  const base = { selection: [POP], count: 8, bassProbability: 4 };
  const without = generateSong(settings({ ...base, variationProbability: 0 }));
  const withVariations = generateSong(settings({ ...base, variationProbability: 5 }));
  const pairs = withVariations.flatMap((row, i) => row.chords.map((chord, j) => [chord, without[i].chords[j]]));
  const unchanged = pairs.filter(([chord, plain]) => chord.variation === null && plain.variation === null);
  assert.ok(unchanged.length > 0);
  for (const [chord, plain] of unchanged) {
    assert.equal(chord.bass, plain.bass);
  }
});

test('changing the count keeps the rows that were already there', () => {
  const short = generateSong(settings({ count: 2, rotation: 3, variationProbability: 3 }));
  const long = generateSong(settings({ count: 8, rotation: 3, variationProbability: 3 }));
  assert.equal(JSON.stringify(long.slice(0, 2)), JSON.stringify(short));
});

test('generation is deterministic for the same settings', () => {
  const options = settings({ count: 12, rotation: 2, permutation: 2, variationProbability: 3, bassProbability: 3 });
  assert.equal(JSON.stringify(generateSong(options)), JSON.stringify(generateSong(options)));
});

test('rotation of 100 percent yields a rotation of the original order', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const doubled = [...original, ...original].join(' ');
  const rows = generateSong(settings({ selection: [POP], count: 16, rotation: 5 }));
  for (const row of rows) {
    const romans = row.chords.map((chord) => chord.roman);
    assert.ok(doubled.includes(romans.join(' ')), romans.join(' '));
  }
});

test('permutation of 100 percent keeps the same chords in a new order', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const rows = generateSong(settings({ selection: [POP], count: 16, permutation: 5 }));
  for (const row of rows) {
    const romans = row.chords.map((chord) => chord.roman);
    assert.deepEqual([...romans].sort(), [...original].sort());
  }
});

test('zero rotation and permutation never change the chord order', () => {
  const rows = generateSong(settings({ selection: [POP], count: 16, rotation: 0, permutation: 0 }));
  for (const row of rows) {
    assert.deepEqual(row.chords.map((chord) => chord.roman), ['I', 'V', 'vi', 'IV']);
  }
});

test('with rotation and permutation both on, a row is flagged only if its final order differs from the predefined one', () => {
  const original = ['I', 'V', 'vi', 'IV'];
  const romans = (row) => row.chords.map((chord) => chord.roman);
  const rows = generateSong(settings({ selection: [POP], count: 64, rotation: 5, permutation: 5 }));
  for (const row of rows) {
    const differs = romans(row).join() !== original.join();
    assert.equal(row.rotated || row.permuted, differs, `row ${row.index}: ${romans(row).join(' ')}`);
  }
  assert.ok(rows.some((row) => row.rotated));
  assert.ok(rows.some((row) => row.permuted));
  assert.ok(rows.some((row) => !row.rotated && !row.permuted));
});

test('chords carry their quality, so major and minor chords can be told apart', () => {
  const [row] = generateSong(settings({ selection: [POP], count: 1 }));
  assert.deepEqual(row.chords.map((chord) => [chord.roman, chord.quality]), [
    ['I', 'major'], ['V', 'major'], ['vi', 'minor'], ['IV', 'major'],
  ]);
});

test('with inversions on, extended chords get all their positions, including the highest ones', () => {
  const chords = generateSong(settings({ selection: [POP], count: 32, inversions: true, variationProbability: 5 }))
    .flatMap((row) => row.chords);
  const fourToned = chords.filter((chord) => chord.tones.length === 4).map((chord) => chord.inversion);
  assert.ok(fourToned.length > 0, 'the variations must add tones for this test');
  assert.deepEqual([...new Set(fourToned)].sort(), [0, 1, 2, 3]);
});

test('a triad with inversions on can take the root position and both inversions', () => {
  const inversions = new Set(generateSong(settings({ selection: [POP], count: 16, inversions: true }))
    .flatMap((row) => row.chords.filter((chord) => chord.tones.length === 3).map((chord) => chord.inversion)));
  assert.deepEqual([...inversions].sort(), [0, 1, 2]);
});

test('switching inversions on keeps the progression, variations and bass notes', () => {
  const base = { selection: [POP, MINOR], count: 8, variationProbability: 3, bassProbability: 3 };
  const without = generateSong(settings({ ...base, inversions: false }));
  const withInversions = generateSong(settings({ ...base, inversions: true }));
  const outline = (rows) => rows.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol, chord.bass]));
  assert.deepEqual(outline(withInversions), outline(without));
});

test('changing the bass probability keeps the inversions', () => {
  const base = { selection: [POP], count: 8, inversions: true, variationProbability: 0 };
  const plain = generateSong(settings({ ...base, bassProbability: 0 }));
  const varied = generateSong(settings({ ...base, bassProbability: 5 }));
  assert.deepEqual(
    varied.map((row) => row.chords.map((chord) => chord.inversion)),
    plain.map((row) => row.chords.map((chord) => chord.inversion)),
  );
});

/** For each chord after the first in a row: how far its melody note lies from the previous one, and the nearest possible distance. */
function melodyLeaps(rows) {
  const leaps = [];
  for (const row of rows) {
    row.chords.slice(1).forEach((chord, j) => {
      const previous = melodyTopOf(row.chords[j].tones, row.chords[j].inversion);
      const chosen = pitchDistance(melodyTopOf(chord.tones, chord.inversion), previous);
      const nearest = Math.min(...chord.tones.map((_, k) => pitchDistance(melodyTopOf(chord.tones, k), previous)));
      leaps.push({ chosen, nearest });
    });
  }
  return leaps;
}

test('at melody amount 5 melody notes further away than the nearest are chosen as well', () => {
  const rows = generateSong(settings({ selection: [POP, MINOR], count: 16, variationProbability: 5, inversions: true, melodyAmount: 5 }));
  assert.ok(melodyLeaps(rows).some(({ chosen, nearest }) => chosen > nearest));
});

test('changing the melody amount keeps the progression, variations and bass notes', () => {
  const base = { selection: [POP, MINOR], count: 8, inversions: true, variationProbability: 3, bassProbability: 3 };
  const outline = (rows) => rows.map((row) => row.chords.map((chord) => [chord.roman, chord.symbol, chord.bass]));
  const near = generateSong(settings({ ...base, melodyAmount: 0 }));
  const far = generateSong(settings({ ...base, melodyAmount: 5 }));
  assert.deepEqual(outline(far), outline(near));
});

test('with foreign variations off, a chord takes no variation with a tone foreign to the key of its row', () => {
  const library = buildLibrary({
    Pop: { chord_variations: { I: { base: 1, 7: 5, add9: 5 }, V: { base: 1, 7: 5 } }, progressions: { X: ['I', 'V'] } },
  });
  const off = generateSong(settings({ library, selection: ['Pop / X'], count: 64, variationProbability: 5, foreignVariations: false }))
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
  const keyF = { library, selection: ['Pop / X'], key: 'F', count: 64, variationProbability: 5 };
  const off = generateSong(settings({ ...keyF, foreignVariations: false })).flatMap((row) => row.chords);
  // F major is F G A Bb C D E, so I7 (F A C Eb) has Eb, which is foreign.
  assert.ok(off.every((chord) => chord.variation !== '7'));
  assert.ok(off.some((chord) => chord.variation === 'add9'));
  const on = generateSong(settings({ ...keyF, foreignVariations: true })).flatMap((row) => row.chords);
  assert.ok(on.some((chord) => chord.variation === '7'));
});

test('changing the foreign variations switch keeps the progression and the rows', () => {
  const base = { selection: [POP], count: 8, variationProbability: 3, bassProbability: 3 };
  const on = generateSong(settings({ ...base, foreignVariations: true }));
  const off = generateSong(settings({ ...base, foreignVariations: false }));
  assert.deepEqual(
    off.map((row) => [row.name, row.tonic, row.chords.map((chord) => chord.roman)]),
    on.map((row) => [row.name, row.tonic, row.chords.map((chord) => chord.roman)]),
  );
});

test('with the circle of fifths on, row i is in the i-th key counterclockwise from C', () => {
  const rows = generateSong(settings({ circleOfFifths: true, count: 12, key: 'D' }));
  const tonics = rows.map((row) => row.tonic);
  assert.deepEqual([...tonics.slice(0, 6), ...tonics.slice(7)], ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'B', 'E', 'A', 'D', 'G']);
  assert.ok(['F#', 'Gb'].includes(tonics[6]));
});

test('with the circle of fifths on, the enharmonic key is F# or Gb, each about half of the time, by its own seed', () => {
  let gb = 0;
  const runs = 400;
  let state = 7;
  for (let run = 0; run < runs; run += 1) {
    const seeds = createSeeds(() => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    });
    const tonic = generateSong(settings({ circleOfFifths: true, count: 12, seeds }))[6].tonic;
    assert.ok(['F#', 'Gb'].includes(tonic));
    gb += tonic === 'Gb' ? 1 : 0;
  }
  assert.ok(gb > runs * 0.35 && gb < runs * 0.65, `Gb in ${gb} of ${runs} runs`);
  // Only the enharmonic seed decides the spelling.
  const flat = generateSong(settings({ circleOfFifths: true, count: 12, seeds: { ...SEEDS, enharmonic: 0 } }))[6];
  const other = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
    generateSong(settings({ circleOfFifths: true, count: 12, seeds: { ...SEEDS, enharmonic: seed * 123456789 } }))[6].tonic);
  assert.ok(new Set([flat.tonic, ...other]).size === 2, 'changing the enharmonic seed can change the spelling');
});

test('the circle of fifths changes only the keys: the progressions and their transformations stay the same', () => {
  const base = { count: 12, rotation: 3, permutation: 3, variationProbability: 3, bassProbability: 3, inversions: true };
  const plain = generateSong(settings(base));
  const circle = generateSong(settings({ ...base, circleOfFifths: true }));
  assert.deepEqual(circle.map((row) => row.name), plain.map((row) => row.name));
  assert.deepEqual(circle.map((row) => [row.permuted, row.rotated]), plain.map((row) => [row.permuted, row.rotated]));
  assert.deepEqual(circle.map((row) => row.chords.map((chord) => chord.roman)), plain.map((row) => row.chords.map((chord) => chord.roman)));
  // Row 0 is in C either way, so it is identical.
  assert.deepEqual(circle[0], plain[0]);
});

test('the Pop Progression in F with the circle of fifths: the second row is transposed to F', () => {
  const rows = generateSong(settings({ selection: [POP], circleOfFifths: true, count: 12 }));
  assert.equal(rows[1].tonic, 'F');
  assert.deepEqual(rows[1].chords.map((chord) => chord.displaySymbol), ['F', 'C', 'Dm', 'Bb']);
});

/**
 * The golden song: fixed settings and seeds give exactly this song. A saved song keeps its settings and seeds and is
 * generated anew from them (see app/state/songs.js), so a change of the generator changes the saved songs too: they are
 * then shown frozen. This test makes such a change visible. If it is intended, update the expected song here.
 */
test('golden: fixed settings and seeds always give the same song, so saved songs keep their chords', () => {
  const seeds = Object.fromEntries(Object.keys(SEEDS).map((name, index) => [name, 1000003 * (index + 1)]));
  const rows = generateSong(settings({
    key: 'G',
    rotation: 3,
    permutation: 3,
    variationProbability: 3,
    bassProbability: 3,
    inversions: true,
    seeds,
  }));
  assert.deepEqual(rows.map((row) => `${row.name}: ${row.chords.map((chord) => `${chord.displaySymbol}@${chord.inversion}`).join(' ')}`), [
    'Minor Cadence: Am@2 B@1 Em/G@0',
    'Pop Progression: Dsus4/G@2 Em@2 C6@3 G@1',
    'Minor Cadence: Em@1 B/D#@0 Am@0',
    'Minor Cadence: Em@1 B@1 Am@2',
  ]);
});
