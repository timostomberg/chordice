import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildChord } from '../../../../chordice/music/theory/chords.js';
import { fingeringOf } from '../../../../chordice/music/instruments/guitar.js';
import { captionOf, diagramOf } from '../../../../chordice/app/notes/diagram.js';

// The chord database as the app loads it from the CDN, here from the copy installed with the dependencies.
const DB = JSON.parse(readFileSync(new URL('../../../../node_modules/@tombatossals/chords-db/lib/guitar.json', import.meta.url), 'utf8'));

/** A chord as the generator makes it: root, quality, variation and tones, without a bass. */
function chordOf(root, quality = 'major', variation = null) {
  const built = buildChord(root, quality, variation);
  return { root, quality, variation, symbol: built.symbol, tones: built.tones, bass: null, inversion: 0 };
}

// renderFingering needs a browser for svguitar's measurements, so the test checks the setting in the source.
const SOURCE = readFileSync(new URL('../../../../chordice/app/notes/diagram.js', import.meta.url), 'utf8');

test('the grid keeps its height with or without muted strings above it, so a shape without them is not drawn larger', () => {
  assert.match(SOURCE, /fixedDiagramPosition: true/);
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
