import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotesDialog } from '../../chordice/js/notes-dialog.js';

// Minimal stand-ins for the dialog parts. The staff is drawn by an injected function, so no VexFlow or DOM is needed.
class FakeNode {
  constructor() {
    this.textContent = '';
    this.listeners = {};
  }

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  emit(type, event = {}) {
    for (const listener of this.listeners[type] ?? []) {
      listener(event);
    }
  }
}

class FakeDialog extends FakeNode {
  constructor() {
    super();
    this.isOpen = false;
    this.parts = {
      '#notes-staff': new FakeNode(),
    };
  }

  querySelector(selector) {
    return this.parts[selector];
  }

  showModal() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }
}

// The first inversion of C, shown over its bass E.
const E_OVER_C = { displaySymbol: 'C/E', tones: ['C', 'E', 'G'], bass: 'E', inversion: 1 };

function setup() {
  const dialog = new FakeDialog();
  const drawn = [];
  const notes = createNotesDialog(dialog, (_, voicing) => drawn.push(voicing));
  return { dialog, drawn, notes };
}

test('opening a chord shows its inversion first, with the treble starting on its lowest tone and the bass staff on the same tone', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(E_OVER_C);
  assert.equal(dialog.isOpen, true);
  assert.equal(drawn[0].symbol, 'C/E');
  assert.deepEqual(drawn[0], { symbol: 'C/E', bass: 'E3', upper: ['E4', 'G4', 'C5'] });
});

test('without a slash bass, the bass stays the root while the upper tones start on the inversion', () => {
  const { drawn, notes } = setup();
  notes.open({ displaySymbol: 'C', tones: ['C', 'E', 'G'], bass: null, inversion: 1 });
  assert.deepEqual(drawn[0], { symbol: 'C', bass: 'C3', upper: ['E4', 'G4', 'C5'] });
});

test('a slash chord in root position opens in root position, with its bass in the bass staff', () => {
  const { drawn, notes } = setup();
  notes.open({ displaySymbol: 'C/E', tones: ['C', 'E', 'G'], bass: 'E', inversion: 0 });
  assert.deepEqual(drawn[0], { symbol: 'C/E', bass: 'E3', upper: ['C4', 'E4', 'G4'] });
});

test('each click on the staff shows the next inversion with the same bass, and wraps back to the root position', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(E_OVER_C);
  dialog.parts['#notes-staff'].emit('click');
  dialog.parts['#notes-staff'].emit('click');
  dialog.parts['#notes-staff'].emit('click');
  assert.deepEqual(drawn.map((voicing) => voicing.bass), ['E3', 'E3', 'E3', 'E3']);
  assert.deepEqual(drawn.map((voicing) => voicing.upper[0]), ['E4', 'G4', 'C4', 'E4']);
  assert.deepEqual(drawn[3], { symbol: 'C/E', bass: 'E3', upper: ['E4', 'G4', 'C5'] });
});

test('reopening a chord starts again at its own bass, not at the last inversion shown', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(E_OVER_C);
  dialog.parts['#notes-staff'].emit('click');
  notes.open({ displaySymbol: 'C', tones: ['C', 'E', 'G'], bass: null });
  assert.deepEqual(drawn.at(-1), { symbol: 'C', bass: 'C3', upper: ['C4', 'E4', 'G4'] });
});

test('a click on the backdrop closes the window', () => {
  const { dialog, notes } = setup();
  notes.open(E_OVER_C);
  dialog.emit('click', { target: dialog });
  assert.equal(dialog.isOpen, false);
});

test('a click inside the content does not close the window', () => {
  const { dialog, notes } = setup();
  notes.open(E_OVER_C);
  dialog.emit('click', { target: { closest: () => null } });
  assert.equal(dialog.isOpen, true);
});
