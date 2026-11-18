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
      '#notes-chord': new FakeNode(),
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
    // As in a browser, closing the dialog fires its close event, however it was closed.
    this.emit('close');
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
  assert.deepEqual(drawn[0], { key: null, bass: 'E3', upper: ['E4', 'G4', 'C5'] });
});

test('without a slash bass, the bass stays the root while the upper tones start on the inversion', () => {
  const { drawn, notes } = setup();
  notes.open({ displaySymbol: 'C', tones: ['C', 'E', 'G'], bass: null, inversion: 1 });
  assert.deepEqual(drawn[0], { key: null, bass: 'C3', upper: ['E4', 'G4', 'C5'] });
});

test('a slash chord in root position opens in root position, with its bass in the bass staff', () => {
  const { drawn, notes } = setup();
  notes.open({ displaySymbol: 'C/E', tones: ['C', 'E', 'G'], bass: 'E', inversion: 0 });
  assert.deepEqual(drawn[0], { key: null, bass: 'E3', upper: ['C4', 'E4', 'G4'] });
});

test('each click on the staff shows the next inversion with the same bass, and wraps back to the root position', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(E_OVER_C);
  dialog.parts['#notes-staff'].emit('click');
  dialog.parts['#notes-staff'].emit('click');
  dialog.parts['#notes-staff'].emit('click');
  assert.deepEqual(drawn.map((voicing) => voicing.bass), ['E3', 'E3', 'E3', 'E3']);
  assert.deepEqual(drawn.map((voicing) => voicing.upper[0]), ['E4', 'G4', 'C4', 'E4']);
  assert.deepEqual(drawn[3], { key: null, bass: 'E3', upper: ['E4', 'G4', 'C5'] });
});

test('reopening a chord starts again at its own bass, not at the last inversion shown', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(E_OVER_C);
  dialog.parts['#notes-staff'].emit('click');
  notes.open({ displaySymbol: 'C', tones: ['C', 'E', 'G'], bass: null });
  assert.deepEqual(drawn.at(-1), { key: null, bass: 'C3', upper: ['C4', 'E4', 'G4'] });
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

/** A chord element that records its classes, as the DOM's classList does. */
function fakeChordElement() {
  const classes = new Set();
  return {
    classes,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
  };
}

test('opening a chord frames the chord element whose notes are open', () => {
  const { notes } = setup();
  const element = fakeChordElement();
  notes.open(E_OVER_C, element);
  assert.equal(element.classList.contains('is-open'), true);
});

test('a click outside the notes window closes it and removes the frame from the chord', () => {
  const { dialog, notes } = setup();
  const element = fakeChordElement();
  notes.open(E_OVER_C, element);
  dialog.emit('click', { target: dialog });
  assert.equal(element.classList.contains('is-open'), false);
});

test('closing the window with Escape also removes the frame, as the browser fires the close event', () => {
  const { dialog, notes } = setup();
  const element = fakeChordElement();
  notes.open(E_OVER_C, element);
  dialog.emit('close');
  assert.equal(element.classList.contains('is-open'), false);
});

test('opening another chord moves the frame to it', () => {
  const { dialog, notes } = setup();
  const first = fakeChordElement();
  const second = fakeChordElement();
  notes.open(E_OVER_C, first);
  dialog.close();
  notes.open(E_OVER_C, second);
  assert.equal(first.classList.contains('is-open'), false);
  assert.equal(second.classList.contains('is-open'), true);
});

test('opening without an element still shows the notes', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(E_OVER_C);
  assert.equal(dialog.isOpen, true);
  assert.equal(drawn.length, 1);
});

// C7 as the chord of the row in the key of F: the Bb is added by the seventh and diatonic to F.
const C7 = { displaySymbol: 'C7', root: 'C', quality: 'major', variation: '7', tones: ['C', 'E', 'G', 'Bb'], bass: null, inversion: 0 };

test('the notes are coloured by how their tones are judged in the key of the row, in the bass and in every inversion', () => {
  const dialog = new FakeDialog();
  const kinds = [];
  const notes = createNotesDialog(dialog, (_, voicing, colours) => kinds.push(colours));
  notes.open(C7, null, 'F');
  // Root position: C, E, G, Bb. The Bb is the one the seventh adds.
  assert.deepEqual(kinds[0], { bass: '', upper: ['', '', '', 'variation'] });
  dialog.parts['#notes-staff'].emit('click');
  // First inversion: E, G, Bb, C. The colours follow the tones, not their positions.
  assert.deepEqual(kinds[1], { bass: '', upper: ['', '', 'variation', ''] });
});

test('the key of the row is passed to the staff, and a chord opened without one has no key', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(C7, null, 'F');
  assert.equal(drawn[0].key, 'F');
  notes.open(C7);
  assert.equal(drawn[1].key, null);
});

test('a tone foreign to the key of the row is coloured foreign, and without a key nothing is coloured', () => {
  const { dialog } = setup();
  const kinds = [];
  const notes = createNotesDialog(dialog, (_, voicing, colours) => kinds.push(colours));
  notes.open(C7, null, 'C');
  assert.deepEqual(kinds[0].upper, ['', '', '', 'foreign']);
  notes.open(C7);
  assert.deepEqual(kinds[1], { bass: '', upper: ['', '', '', ''] });
});

test('opening a chord shows its chord box above the staff, drawn with the display switches and the key of the row', () => {
  const dialog = new FakeDialog();
  const boxes = [];
  const notes = createNotesDialog(dialog, () => {}, (chord, display, tonic) => {
    boxes.push({ chord, display, tonic });
    return '<li>box</li>';
  });
  const display = { colour: true, roman: false, tones: false, melody: true };
  notes.open(C7, null, 'F', display);
  assert.deepEqual(boxes, [{ chord: C7, display, tonic: 'F' }]);
  assert.equal(dialog.parts['#notes-chord'].innerHTML, '<li>box</li>');
});

test('the chord box is the chord as the rows show it, with its top melody note when the inversions switch is on', () => {
  const { dialog, notes } = setup();
  notes.open(E_OVER_C, null, null, { colour: false, roman: false, tones: false, melody: true });
  const box = dialog.parts['#notes-chord'].innerHTML;
  assert.ok(box.includes('C/E'), 'the chord symbol is in the box');
  assert.ok(box.includes('<span class="melody"'), 'the melody note is in the box');
  assert.ok(box.includes('>c</span>'), 'the top melody note of the first inversion is C');
  assert.ok(!box.includes('onclick') && !box.includes('data-action'), 'the box has no click action of its own');
});

test('the chord box follows the inversion on the staff, with the top melody note of each inversion', () => {
  const { dialog, notes } = setup();
  const melody = () => /<span class="melody"[^>]*>([^<]*)<\/span>/.exec(dialog.parts['#notes-chord'].innerHTML)[1];
  notes.open(E_OVER_C, null, null, { melody: true });
  // First inversion E, G, C: top note C.
  assert.equal(melody(), 'c');
  dialog.parts['#notes-staff'].emit('click');
  // Second inversion G, C, E: top note E.
  assert.equal(melody(), 'e');
  dialog.parts['#notes-staff'].emit('click');
  // Root position C, E, G: top note G.
  assert.equal(melody(), 'g');
});

test('the chord box shows the inversion that the staff shows, and reopening starts again at the chord own inversion', () => {
  const { dialog, notes } = setup();
  notes.open(E_OVER_C, null, null, { melody: true });
  dialog.parts['#notes-staff'].emit('click');
  assert.ok(dialog.parts['#notes-chord'].innerHTML.includes('>e</span>'));
  notes.open(E_OVER_C, null, null, { melody: true });
  assert.ok(dialog.parts['#notes-chord'].innerHTML.includes('>c</span>'));
});
