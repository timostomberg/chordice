import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, exerciseById, exerciseSettings } from '../../../../chordice/app/state/exercises.js';
import { LIBRARY } from '../../../helpers/fixtures.js';

const CIRCLE = 'circle-ii-v-i';

test('the exercise Circle around ii7-V7-Imaj7 fixes the Jazz Cadence, every key, 7 and maj7 at amount 5, and no rotation, permutation or bass', () => {
  const exercise = exerciseById(CIRCLE);
  assert.equal(exercise.name, 'Circle around ii7-V7-Imaj7');
  assert.deepEqual(exercise.settings, {
    selection: ['Jazz / Jazz Cadence'],
    circleOfFifths: true,
    variations: ['7', 'maj7'],
    variationProbability: 5,
    foreignVariations: true,
    rotation: 0,
    permutation: 0,
    bassProbability: 0,
  });
  assert.equal(exerciseById('unknown'), null);
  assert.deepEqual(exerciseSettings({ exercise: null }), {});
});

test('every exercise selects progressions that exist in chord_progressions.yaml', () => {
  const ids = LIBRARY.map((progression) => progression.id);
  for (const exercise of EXERCISES) {
    for (const id of exercise.settings.selection ?? []) {
      assert.ok(ids.includes(id), `${exercise.name}: ${id}`);
    }
  }
});

