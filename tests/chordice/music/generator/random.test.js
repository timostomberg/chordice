import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chordSlot,
  CHORDS_PER_ROW_LIMIT,
  createSeeds,
  pick,
  SEED_NAMES,
  unit,
  weightedPick,
} from '../../../../chordice/music/generator/random.js';

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

test('chord slots are unique across rows and positions within a row', () => {
  assert.equal(chordSlot(0, 0), 0);
  assert.equal(chordSlot(2, 3), 2 * CHORDS_PER_ROW_LIMIT + 3);
  const slots = new Set();
  for (let row = 0; row < 5; row += 1) {
    for (let position = 0; position < 8; position += 1) {
      slots.add(chordSlot(row, position));
    }
  }
  assert.equal(slots.size, 40);
});

test('weightedPick chooses an option by its weight and returns null without weights', () => {
  const options = [
    { value: 'a', weight: 3 },
    { value: 'b', weight: 1 },
  ];
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 4000; i += 1) {
    counts[weightedPick(options, 42, i).value] += 1;
  }
  assert.ok(Math.abs(counts.a / 4000 - 0.75) < 0.03);
  assert.equal(weightedPick([{ value: 'x', weight: 0 }], 42, 0), null);
});

test('pick returns whole numbers in [0, count) that are roughly uniform, and the same for the same seed and index', () => {
  const counts = [0, 0, 0];
  for (let index = 0; index < 3000; index += 1) {
    const value = pick(12345, index, 3);
    assert.ok(Number.isInteger(value) && value >= 0 && value < 3, String(value));
    counts[value] += 1;
  }
  assert.ok(counts.every((count) => count > 850 && count < 1150), counts.join());
  assert.equal(pick(99, 7, 5), pick(99, 7, 5));
  assert.equal(pick(99, 7, 1), 0);
});
