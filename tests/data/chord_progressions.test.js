import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { buildLibrary } from '../../chordice/js/generator.js';
import { EXTENSION_NAMES } from '../../chordice/js/theory.js';

const YAML_TEXT = readFileSync(new URL('../../chordice/data/chord_progressions.yaml', import.meta.url), 'utf8');
const LIBRARY = buildLibrary(load(YAML_TEXT));

test('chord_progressions.yaml is valid and fully supported by the generator', () => {
  assert.ok(LIBRARY.length > 0);
});

test('every group of the file is present', () => {
  const groups = [...new Set(LIBRARY.map((progression) => progression.group))];
  assert.deepEqual(groups, ['Classical', 'Pop', 'Rock', 'Jazz', 'Flamenco']);
});

test('progression ids are unique and there are twelve progressions', () => {
  const ids = LIBRARY.map((progression) => progression.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 12);
});

test('every progression has chords', () => {
  for (const progression of LIBRARY) {
    assert.ok(progression.progression.length > 0, progression.id);
  }
});

test('numeric YAML values such as 7 are read as extension names', () => {
  const classical = LIBRARY.find((progression) => progression.name === 'Classical Cadence');
  assert.deepEqual(classical.chordExtensions.V, ['7', '7sus4']);
});

test('all extensions used in the file are listed in the extension order', () => {
  for (const progression of LIBRARY) {
    for (const extensions of Object.values(progression.chordExtensions)) {
      for (const extension of extensions) {
        assert.ok(EXTENSION_NAMES.includes(extension), `${progression.id}: ${extension}`);
      }
    }
  }
});
