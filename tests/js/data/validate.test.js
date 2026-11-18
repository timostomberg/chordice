import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBassPatterns, buildLibrary } from '../../../chordice/js/data/validate.js';

const DATA = {
  Pop: {
    chord_variations: { I: { base: 5, 6: 4, add9: 4 } },
    progressions: { 'Pop Progression': ['I', 'V'] },
  },
};

// Shaped like bass_patterns.yaml: intervals relative to the chord root, with their commonness.
const BASS_DATA = {
  chord_degrees: {
    I: { 1: 5, 3: 2, 5: 3 },
    vi: { 1: 5, b3: 2, 5: 3 },
  },
  chord_variations: {
    7: { b7: 2 },
  },
};

test('buildLibrary reads the genres, progressions and chord variations, and keeps the commonness of each variation', () => {
  const [pop] = buildLibrary(DATA);
  assert.equal(pop.id, 'Pop / Pop Progression');
  assert.equal(pop.group, 'Pop');
  assert.equal(pop.name, 'Pop Progression');
  assert.deepEqual(pop.progression, ['I', 'V']);
  assert.deepEqual(pop.chordVariations.I, { base: 5, 6: 4, add9: 4 });
  // Integer-like keys come first in a JavaScript object, so the numeral 6 precedes base; the commonness is kept either way.
  assert.equal(pop.chordVariations.I['6'], 4);
});

test('buildBassPatterns converts the bass notes into intervals and keeps their commonness', () => {
  const bass = buildBassPatterns(BASS_DATA);
  assert.deepEqual(bass.degrees.vi, [
    { interval: '1P', weight: 5 },
    { interval: '5P', weight: 3 },
    { interval: '3m', weight: 2 },
  ]);
  assert.deepEqual(bass.variations['7'], [{ interval: '7m', weight: 2 }]);
});

test('buildLibrary rejects unknown variations, unknown numerals and bad commonness', () => {
  const wrap = (group) => ({ Pop: group });
  const progressions = { X: ['I'] };
  assert.throws(() => buildLibrary(wrap({ chord_variations: { I: { base: 5, '7b5x': 2 } }, progressions })));
  assert.throws(() => buildLibrary(wrap({ progressions: { X: ['H'] } })));
  assert.throws(() => buildLibrary(wrap({ chord_variations: { I: { base: 5, 7: 0 } }, progressions })), /1 to 5/);
  assert.throws(() => buildLibrary(wrap({ chord_variations: { I: { base: 5, 7: 6 } }, progressions })), /1 to 5/);
  assert.throws(() => buildLibrary(wrap({ chord_variations: { I: { 7: 2 } }, progressions })), /base/);
  // A chord with variations must occur in one of the group's progressions.
  assert.throws(() => buildLibrary(wrap({ chord_variations: { V: { base: 5, 7: 2 } }, progressions })));
  assert.throws(() => buildLibrary(wrap({ progressions: { X: [] } })));
});

test('buildBassPatterns rejects unknown keys, invalid degrees and commonness outside 1 to 5', () => {
  assert.throws(() => buildBassPatterns({ chord_degrees: { H: { 1: 5 } }, chord_variations: {} }));
  assert.throws(() => buildBassPatterns({ chord_degrees: { I: { x: 5 } }, chord_variations: {} }));
  assert.throws(() => buildBassPatterns({ chord_degrees: { I: { 1: 0 } }, chord_variations: {} }));
  assert.throws(() => buildBassPatterns({ chord_degrees: {}, chord_variations: { 'nope': { 3: 2 } } }));
  assert.throws(() => buildBassPatterns(null));
});

