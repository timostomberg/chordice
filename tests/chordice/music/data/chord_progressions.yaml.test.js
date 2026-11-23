import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'js-yaml';
import { buildLibrary } from '../../../../chordice/music/data/validate.js';
import { VARIATION_NAMES, buildChord } from '../../../../chordice/music/theory/chords.js';
import { MAJOR_KEYS } from '../../../../chordice/music/theory/keys.js';
import { degree } from '../../../../chordice/music/theory/numerals.js';

import { PROGRESSIONS_TEXT as YAML_TEXT } from '../../../helpers/fixtures.js';

const LIBRARY = buildLibrary(load(YAML_TEXT));

test('chord_progressions.yaml is valid and fully supported by the generator', () => {
  assert.ok(LIBRARY.length > 0);
});

test('every genre of the file is present, in the order of the file', () => {
  const groups = [...new Set(LIBRARY.map((progression) => progression.group))];
  assert.deepEqual(groups, ['Classical', 'Pop', 'Rock', 'Jazz', 'Flamenco']);
});

test('progression ids are unique and there are fourteen progressions', () => {
  const ids = LIBRARY.map((progression) => progression.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 14);
});

test('every progression has chords', () => {
  for (const progression of LIBRARY) {
    assert.ok(progression.progression.length > 0, progression.id);
  }
});

test('every chord variation of the file is listed in the variation order, and every chord has a base commonness', () => {
  for (const progression of LIBRARY) {
    for (const [numeral, variations] of Object.entries(progression.chordVariations)) {
      // Variations are shared by the progressions of a genre, so the chord must occur in one of them.
      assert.ok(LIBRARY.some((other) => other.group === progression.group && other.progression.includes(numeral)), `${progression.id}: ${numeral}`);
      assert.ok(Number.isInteger(variations.base), `${progression.id}: ${numeral} needs a base`);
      for (const [name, weight] of Object.entries(variations)) {
        assert.ok(name === 'base' || VARIATION_NAMES.includes(name), `${progression.id}: ${name}`);
        assert.ok(weight >= 1 && weight <= 5, `${progression.id}: ${name} commonness ${weight}`);
      }
    }
  }
});

test('the Classical Cadence is I IV V I, and its V has the sevenths with their commonness', () => {
  const classical = LIBRARY.find((progression) => progression.name === 'Classical Cadence');
  assert.deepEqual(classical.progression, ['I', 'IV', 'V', 'I']);
  assert.deepEqual(classical.chordVariations.V, { base: 5, 7: 5 });
});

test('numeric YAML keys such as 7 and 6 are read as variation names', () => {
  const pop = LIBRARY.find((progression) => progression.name === 'Pop Progression');
  assert.equal(pop.chordVariations.I['6'], 4);
  assert.equal(pop.chordVariations.I.base, 5);
});

test('every variation of the file can be built on every key, with the quality of its chord', () => {
  // Guards against combinations tonal cannot spell, e.g. a minor chord with a 5 (power chord) variation.
  for (const progression of LIBRARY) {
    for (const [numeral, variations] of Object.entries(progression.chordVariations)) {
      for (const name of Object.keys(variations)) {
        if (name === 'base') {
          continue;
        }
        for (const tonic of MAJOR_KEYS) {
          const { root, quality } = degree(tonic, numeral);
          assert.doesNotThrow(() => buildChord(root, quality, name), `${progression.id}: ${numeral} ${name} in ${tonic}`);
        }
      }
    }
  }
});

test('the Jazz cadence offers the slash chord 6/9 on the I chord and the altered dominants', () => {
  const jazz = LIBRARY.find((progression) => progression.name === 'Jazz Cadence');
  assert.equal(jazz.chordVariations.I['6/9'], 5);
  assert.equal(jazz.chordVariations.V['7b5'], 3);
  assert.equal(jazz.chordVariations.V['7#11'], 3);
});
