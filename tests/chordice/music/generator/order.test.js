import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyOrder, rotate, shuffle } from '../../../../chordice/music/generator/order.js';

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
