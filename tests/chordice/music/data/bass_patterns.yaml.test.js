import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'js-yaml';
import { buildBassPatterns } from '../../../../chordice/music/data/validate.js';

import { BASS_TEXT as YAML_TEXT, LIBRARY } from '../../../helpers/fixtures.js';

const PATTERNS = buildBassPatterns(load(YAML_TEXT));

test('bass_patterns.yaml is valid and fully supported by the generator', () => {
  assert.ok(Object.keys(PATTERNS.degrees).length > 0);
  assert.ok(Object.keys(PATTERNS.variations).length > 0);
});

test('every chord degree with a bass pattern is a roman numeral of the progressions', () => {
  const numerals = new Set(LIBRARY.flatMap((progression) => progression.progression));
  for (const numeral of Object.keys(PATTERNS.degrees)) {
    assert.ok(numerals.has(numeral), numeral);
  }
});

test('every chord variation of the progressions has a bass pattern', () => {
  for (const progression of LIBRARY) {
    for (const variations of Object.values(progression.chordVariations)) {
      for (const name of Object.keys(variations)) {
        if (name !== 'base') {
          assert.ok(PATTERNS.variations[name], `${progression.id}: ${name}`);
        }
      }
    }
  }
});

test('every bass note of the file is a chord degree with a commonness from 1 to 5', () => {
  const entries = [...Object.values(PATTERNS.degrees), ...Object.values(PATTERNS.variations)].flat();
  assert.ok(entries.length > 0);
  for (const { interval, weight } of entries) {
    assert.match(interval, /^\d+(P|M|m|d|A)$/);
    assert.ok(Number.isInteger(weight) && weight >= 1 && weight <= 5, interval);
  }
});

test('the standard bass of a degree, the root, is listed with the highest commonness', () => {
  for (const [numeral, notes] of Object.entries(PATTERNS.degrees)) {
    const root = notes.find((note) => note.interval === '1P');
    assert.ok(root, numeral);
    assert.equal(root.weight, 5, numeral);
  }
});

test('every chord degree of the progressions has a bass pattern, so no chord is left without its bass notes', () => {
  const numerals = new Set(LIBRARY.flatMap((progression) => progression.progression));
  for (const numeral of numerals) {
    assert.ok(PATTERNS.degrees[numeral], numeral);
  }
});
