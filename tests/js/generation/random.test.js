import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeeds, SEED_NAMES, unit } from '../../../chordice/js/generation/random.js';

test('unit returns values in [0, 1) that are roughly uniform', () => {
  let sum = 0;
  const samples = 20000;
  for (let i = 0; i < samples; i += 1) {
    const value = unit(12345, i);
    assert.ok(value >= 0 && value < 1);
    sum += value;
  }
  assert.ok(Math.abs(sum / samples - 0.5) < 0.02);
});

test('createSeeds provides every seed name', () => {
  const seeds = createSeeds(() => 0.5);
  assert.deepEqual(Object.keys(seeds).sort(), [...SEED_NAMES].sort());
});

