import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chordSlot,
  classifyOrder,
  CHORDS_PER_ROW_LIMIT,
  createSeeds,
  rotate,
  SEED_NAMES,
  shuffle,
  unit,
  weightedPick,
} from '../../../chordice/js/generator/utils.js';

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

test('rotate shifts the items to the left, and an amount of the length gives the same order', () => {
  assert.deepEqual(rotate([1, 2, 3, 4], 1), [2, 3, 4, 1]);
  assert.deepEqual(rotate([1, 2, 3, 4], 3), [4, 1, 2, 3]);
  assert.deepEqual(rotate([1, 2, 3, 4], 4), [1, 2, 3, 4]);
});

test('rotate returns a new list and leaves the input unchanged', () => {
  const items = [1, 2, 3];
  rotate(items, 1);
  assert.deepEqual(items, [1, 2, 3]);
});

test('shuffle keeps the same items and is deterministic for the same seed and row', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];
  const first = shuffle(items, 12345, 3);
  assert.deepEqual([...first].sort(), [...items].sort());
  assert.deepEqual(shuffle(items, 12345, 3), first);
});

test('shuffle gives different orders for different rows', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const orders = new Set();
  for (let row = 0; row < 20; row += 1) {
    orders.add(shuffle(items, 987654, row).join(''));
  }
  assert.ok(orders.size > 1);
});

const chord = (roman) => ({ roman });
const predefined = ['I', 'V', 'vi', 'IV'].map(chord);

test('classifyOrder reports no change for the same order', () => {
  assert.deepEqual(classifyOrder(predefined, [...predefined]), { permuted: false, rotated: false });
});

test('classifyOrder reports a rotation for a cyclic shift of the predefined order', () => {
  assert.deepEqual(classifyOrder(predefined, rotate(predefined, 2)), { permuted: false, rotated: true });
});

test('classifyOrder reports a permutation for any other order', () => {
  const swapped = ['I', 'vi', 'V', 'IV'].map(chord);
  assert.deepEqual(classifyOrder(predefined, swapped), { permuted: true, rotated: false });
});
