import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Note } from 'tonal';
import { buildChord } from '../../../../chordice/js/theory/theory.js';
import { CHORD_TYPES, STANDARD_TUNING, captionOf, chordTypeOf, diagramOf, fingeringOf } from '../../../../chordice/js/notes/guitar/fingering.js';

// The chord database as the app loads it from the CDN, here from the copy installed with the dependencies.
const DB = JSON.parse(readFileSync(new URL('../../../../node_modules/@tombatossals/chords-db/lib/guitar.json', import.meta.url), 'utf8'));
const DB_ROOT_KEYS = ['C', 'Csharp', 'D', 'Eb', 'E', 'F', 'Fsharp', 'G', 'Ab', 'A', 'Bb', 'B'];

/** A chord as the generator makes it: root, quality, variation, tones, bass and inversion. */
function chordOf(root, quality = 'major', variation = null, { bass = null, inversion = 0 } = {}) {
  const built = buildChord(root, quality, variation);
  return {
    root,
    quality,
    variation,
    symbol: built.symbol,
    tones: built.tones,
    bass,
    inversion,
    displaySymbol: bass ? `${built.symbol}/${bass}` : built.symbol,
  };
}

/** The pitch classes of the tones, sorted: the same chord in any spelling gives the same list. */
function pitchClasses(tones) {
  return [...new Set(tones.map((tone) => Note.chroma(tone)))].sort((a, b) => a - b);
}

test('every chord type is in the database for each of the twelve roots, and chordice can spell it', () => {
  for (const key of DB_ROOT_KEYS) {
    for (const type of CHORD_TYPES) {
      const entry = DB.chords[key].find((chord) => chord.suffix === type.suffix);
      assert.ok(entry?.positions.length > 0, `${key} ${type.suffix} has shapes`);
      assert.doesNotThrow(() => buildChord('C', type.quality, type.variation), `${type.suffix} can be spelled`);
    }
  }
});

// The database voices four extended chords with one tone more or less than tonal spells them: an eleventh with its third,
// a thirteenth with its eleventh, and a major eleventh and thirteenth as the database has them. Every other type matches exactly.
const ONE_TONE_OFF = new Set(['11', 'maj11', '13', 'maj13']);

test('the shapes of each chord type sound the tones that chordice builds for that type', () => {
  // A single shape may leave out a tone (e.g. the fifth), so the tones are taken over all shapes of the type.
  for (const type of CHORD_TYPES) {
    const expected = pitchClasses(buildChord('C', type.quality, type.variation).tones);
    const shapes = DB.chords.C.find((chord) => chord.suffix === type.suffix).positions;
    const sounded = [...new Set(shapes.flatMap((shape) => shape.midi.map((midi) => midi % 12)))].sort((a, b) => a - b);
    if (ONE_TONE_OFF.has(type.suffix)) {
      const differing = [...sounded.filter((pitch) => !expected.includes(pitch)), ...expected.filter((pitch) => !sounded.includes(pitch))];
      assert.equal(differing.length, 1, `${type.suffix} differs from chordice by one tone`);
    } else {
      assert.deepEqual(sounded, expected, `${type.suffix} sounds the tones of ${type.quality} ${type.variation}`);
    }
  }
});

test('a chord the database has exactly is shown as itself, in the database spelling of its root', () => {
  const cases = [
    ['C', 'major', null, 'C'],
    ['A', 'minor', '7', 'Am7'],
    ['D', 'major', '9', 'D9'],
    ['F#', 'minor', '9', 'F#m9'],
    ['Db', 'major', 'maj7', 'Dbmaj7'],
    ['C', 'major', '13', 'C13'],
    ['C', 'major', '7#5', 'C7#5'],
    // tonal spells C7b13 without a fifth: its tones C, E, Bb and Ab are those of C7#5, since Ab is G sharp.
    ['C', 'major', '7b13', 'C7#5'],
  ];
  for (const [root, quality, variation, name] of cases) {
    const type = chordTypeOf(chordOf(root, quality, variation), DB);
    assert.equal(type.name, name);
    assert.equal(type.exact, true, name);
  }
});

test('a chord the database has no shape for is replaced by the most similar chord type it contains', () => {
  // [root, quality, variation] of the chord, then the stand-in's quality and variation: its tones are all tones of the chord.
  const cases = [
    ['C', 'minor', '13', 'minor', '9'],
    ['C', 'major', '7#11', 'major', '7'],
  ];
  for (const [root, quality, variation, standInQuality, standInVariation] of cases) {
    const type = chordTypeOf(chordOf(root, quality, variation), DB);
    const standIn = buildChord(root, standInQuality, standInVariation);
    assert.equal(type.name, standIn.symbol, `${root}${quality}${variation}`);
    assert.equal(type.exact, false);
    const chordTones = pitchClasses(chordOf(root, quality, variation).tones);
    assert.ok(pitchClasses(standIn.tones).every((pitch) => chordTones.includes(pitch)), `${standIn.symbol} is contained`);
  }
});

test('a chord that no type contains falls back to the type that shares the most of its tones', () => {
  // A power chord has no type of its own: the major triad shares its root and fifth, as the minor triad does, and wins by order.
  assert.equal(chordTypeOf(chordOf('C', 'major', '5'), DB).name, 'C');
  // Cm7#5 has a G sharp; the minor seventh shares three of its four tones, the minor triad two.
  const type = chordTypeOf(chordOf('C', 'minor', '7#5'), DB);
  assert.equal(type.name, 'Cm7');
  assert.equal(type.exact, false);
});

test('chordTypeOf returns null when the database has no shape at all for the chord', () => {
  assert.equal(chordTypeOf(chordOf('C'), { chords: {} }), null);
});

test('a slash chord uses the database shapes for its bass, so every shape sounds the bass', () => {
  const fingering = fingeringOf(chordOf('C', 'major', null, { bass: 'E' }), DB);
  assert.equal(fingering.name, 'C/E');
  assert.equal(fingering.exact, true);
  assert.ok(fingering.shapes.length > 0);
  for (const shape of fingering.shapes) {
    assert.equal(Math.min(...shape.midi) % 12, Note.chroma('E'));
  }
});

test('without a database shape over the bass, the shapes of the chord come with the bass ones first', () => {
  // A small database with two shapes of C major: one sounds G in the bass, the other E.
  const db = {
    chords: {
      C: [{
        suffix: 'major',
        positions: [
          { frets: [3, 2, 0, 0, 1, 0], barres: [], baseFret: 1, midi: [43, 48, 52, 55, 60, 64] },
          { frets: [0, 3, 2, 0, 1, 0], barres: [], baseFret: 1, midi: [40, 48, 52, 55, 60, 64] },
        ],
      }],
    },
  };
  const fingering = fingeringOf(chordOf('C', 'major', null, { bass: 'E' }), db);
  assert.equal(fingering.name, 'C');
  assert.deepEqual(fingering.shapes.map((shape) => shape.midi[0]), [40, 43]);
});

test('without a slash bass the root is the bass, so the first shape of a chord sounds its root lowest', () => {
  const fingering = fingeringOf(chordOf('G'), DB);
  assert.equal(Math.min(...fingering.shapes[0].midi) % 12, Note.chroma('G'));
});

test('fingeringOf names the chord it stands in for, so the caption can say what is shown', () => {
  const fingering = fingeringOf(chordOf('C', 'minor', '13'), DB);
  assert.equal(fingering.requested, 'Cm13');
  assert.equal(fingering.name, 'Cm9');
  assert.equal(fingering.exact, false);
});

test('fingeringOf returns null when the database has no shape for the chord', () => {
  assert.equal(fingeringOf(chordOf('C'), { chords: {} }), null);
});

test('the first C shape becomes a diagram with a muted low E, open strings and no finger numbers; strings count from the high E', () => {
  const fingering = fingeringOf(chordOf('C'), DB);
  assert.deepEqual(diagramOf(fingering, 0), {
    strings: 6,
    frets: 4,
    position: 1,
    fingers: [[6, 'x'], [5, 3], [4, 2], [3, 0], [2, 1], [1, 0]],
    barres: [],
  });
});

test('a barre is drawn across the strings that hold its fret, without a finger number', () => {
  // A C shape at the third fret: the fret 1 is the barre, which runs from the low E (string 6) to the high E (string 1).
  const shape = { frets: [1, 1, 3, 3, 3, 1], barres: [1], baseFret: 3, midi: [43, 48, 55, 60, 64, 67] };
  const diagram = diagramOf({ name: 'C', requested: 'C', exact: true, shapes: [shape] }, 0);
  assert.deepEqual(diagram.barres, [{ fromString: 6, toString: 1, fret: 1 }]);
  // The strings under the barre get no finger of their own; the other three are pressed without a number.
  assert.deepEqual(diagram.fingers, [[4, 3], [3, 3], [2, 3]]);
  assert.equal(diagram.position, 3);
});

test('the diagram shows as many frets as the shape needs, and at least four', () => {
  const shape = { frets: [-1, 1, 2, 3, 4, 5], barres: [], baseFret: 1, midi: [] };
  assert.equal(diagramOf({ shapes: [shape] }, 0).frets, 5);
  assert.equal(diagramOf(fingeringOf(chordOf('C'), DB), 0).frets, 4);
});

test('diagramOf steps through the shapes and wraps around, so that every click shows the next one', () => {
  const fingering = fingeringOf(chordOf('C'), DB);
  const count = fingering.shapes.length;
  assert.deepEqual(diagramOf(fingering, count), diagramOf(fingering, 0));
  assert.deepEqual(diagramOf(fingering, 1), diagramOf(fingering, 1 + count));
});

test('diagramOf has no diagram without a fingering', () => {
  assert.equal(diagramOf(null, 0), null);
});

test('the caption names the shape and, for a stand-in, the chord it stands in for', () => {
  const exact = fingeringOf(chordOf('C'), DB);
  assert.equal(captionOf(exact, 0), '1 / 4');
  assert.equal(captionOf(exact, 1), '2 / 4');
  const standIn = fingeringOf(chordOf('C', 'minor', '13'), DB);
  assert.equal(captionOf(standIn, 0), 'Cm13 is not in the chord database; showing Cm9. 1 / 4');
  assert.equal(captionOf(null), 'No shape for this chord in the chord database.');
});

test('the strings are tuned to the standard tuning, listed from the low E on the left', () => {
  assert.deepEqual(STANDARD_TUNING, ['E', 'A', 'D', 'G', 'B', 'E']);
});
