import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, PROBABILITY_MAX } from '../../../chordice/music/constants.js';

import { PROGRESSIONS_DATA as progressions } from '../../helpers/fixtures.js';

test('BASE is the key of the variation without a chord variation, which every chord in the data file has', () => {
  assert.equal(BASE, 'base');
  for (const group of Object.values(progressions)) {
    for (const weights of Object.values(group.chord_variations ?? {})) {
      assert.ok(Object.hasOwn(weights, BASE));
    }
  }
});

test('PROBABILITY_MAX is the top of the commonness scale the data file uses, so a slider at the top means the most common', () => {
  const weights = Object.values(progressions)
    .flatMap((group) => Object.values(group.chord_variations ?? {}))
    .flatMap((variations) => Object.values(variations));
  assert.equal(Math.max(...weights), PROBABILITY_MAX);
});
