import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotesDialog } from '../../chordice/js/notes-dialog.js';
import { diagramOf } from '../../chordice/js/guitar.js';

// Minimal stand-ins for the dialog parts. The staff is drawn by an injected function, so no VexFlow or DOM is needed.
class FakeNode {
  constructor() {
    this.textContent = '';
    this.listeners = {};
    this.classes = new Set();
    this.classList = {
      toggle: (name, force) => {
        if (force) {
          this.classes.add(name);
        } else {
          this.classes.delete(name);
        }
      },
    };
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
      '#notes-caption': new FakeNode(),
    };
  }

  querySelector(selector) {
    return this.parts[selector];
  }

  // The window is 400 px wide, from x = 0 to 400, as the stylesheet sizes it at most.
  getBoundingClientRect() {
    return { left: 0, width: 400 };
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

// The x positions of a click in the left and in the right half of the 400 px wide window.
const BACK = 100;
const FORWARD = 300;

/** A click on the window at the given x position, which lands on the content and not on the backdrop. */
function click(dialog, clientX) {
  dialog.emit('click', { target: { closest: () => null }, clientX });
}

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
  click(dialog, FORWARD);
  click(dialog, FORWARD);
  click(dialog, FORWARD);
  assert.deepEqual(drawn.map((voicing) => voicing.bass), ['E3', 'E3', 'E3', 'E3']);
  assert.deepEqual(drawn.map((voicing) => voicing.upper[0]), ['E4', 'G4', 'C4', 'E4']);
  assert.deepEqual(drawn[3], { key: null, bass: 'E3', upper: ['E4', 'G4', 'C5'] });
});

test('reopening a chord starts again at its own bass, not at the last inversion shown', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(E_OVER_C);
  click(dialog, FORWARD);
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
  click(dialog, FORWARD);
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
  click(dialog, FORWARD);
  // Second inversion G, C, E: top note E.
  assert.equal(melody(), 'e');
  click(dialog, FORWARD);
  // Root position C, E, G: top note G.
  assert.equal(melody(), 'g');
});

test('the chord box shows the inversion that the staff shows, and reopening starts again at the chord own inversion', () => {
  const { dialog, notes } = setup();
  notes.open(E_OVER_C, null, null, { melody: true });
  click(dialog, FORWARD);
  assert.ok(dialog.parts['#notes-chord'].innerHTML.includes('>e</span>'));
  notes.open(E_OVER_C, null, null, { melody: true });
  assert.ok(dialog.parts['#notes-chord'].innerHTML.includes('>c</span>'));
});

// Two shapes of C: the open one, and the one at the third fret with a barre, so that the diagrams tell them apart.
const OPEN_C = { frets: [-1, 3, 2, 0, 1, 0], barres: [], baseFret: 1, midi: [48, 52, 55, 60, 64] };
const THIRD_FRET_C = { frets: [1, 1, 3, 3, 3, 1], barres: [1], baseFret: 3, midi: [43, 48, 55, 60, 64, 67] };
const C_SHAPES = { name: 'C', requested: 'C', exact: true, shapes: [OPEN_C, THIRD_FRET_C] };

/** A dialog for the guitar: the staff and the diagram are drawn by fakes that record what they get. */
function guitarSetup() {
  const dialog = new FakeDialog();
  const staffVoicings = [];
  const diagrams = [];
  const notes = createNotesDialog(
    dialog,
    (_, voicing) => staffVoicings.push(voicing),
    () => '',
    (_, diagram) => diagrams.push(diagram),
  );
  return { dialog, notes, staffVoicings, diagrams };
}

test('the guitar opens the first shape of the chord as a diagram, and draws no staff', () => {
  const { dialog, notes, staffVoicings, diagrams } = guitarSetup();
  // E_OVER_C has its first inversion, but the guitar starts at the first shape.
  notes.open(E_OVER_C, null, null, {}, { instrument: 'guitar', fingering: C_SHAPES });
  assert.equal(dialog.isOpen, true);
  assert.deepEqual(staffVoicings, []);
  assert.deepEqual(diagrams, [diagramOf(C_SHAPES, 0)]);
});

test('each click on the diagram shows the next shape, and wraps back to the first one', () => {
  const { dialog, notes, diagrams } = guitarSetup();
  notes.open(E_OVER_C, null, null, {}, { instrument: 'guitar', fingering: C_SHAPES });
  click(dialog, FORWARD);
  click(dialog, FORWARD);
  // The open shape is at position 1, the barre shape at position 3.
  assert.deepEqual(diagrams.map((diagram) => diagram.position), [1, 3, 1]);
});

test('the caption under the guitar diagram names the shape, and changes with each click', () => {
  const { dialog, notes } = guitarSetup();
  notes.open(E_OVER_C, null, null, {}, { instrument: 'guitar', fingering: C_SHAPES });
  assert.equal(dialog.parts['#notes-caption'].textContent, '1 / 2');
  click(dialog, FORWARD);
  assert.equal(dialog.parts['#notes-caption'].textContent, '2 / 2');
});

test('a chord shown as a stand-in names the chord it stands in for in the caption', () => {
  const { dialog, notes } = guitarSetup();
  const standIn = { name: 'Cm9', requested: 'Cm13', exact: false, shapes: [OPEN_C] };
  notes.open({ ...E_OVER_C, displaySymbol: 'Cm13', tones: ['C', 'Eb', 'G'] }, null, null, {}, { instrument: 'guitar', fingering: standIn });
  assert.equal(dialog.parts['#notes-caption'].textContent, 'Cm13 is not in the chord database; showing Cm9. 1 / 1');
});

test('a chord without any shape in the database opens with a caption that says so, and no diagram', () => {
  const { dialog, notes, diagrams } = guitarSetup();
  notes.open(E_OVER_C, null, null, {}, { instrument: 'guitar', fingering: null });
  assert.equal(dialog.isOpen, true);
  assert.deepEqual(diagrams, []);
  assert.equal(dialog.parts['#notes-caption'].textContent, 'No shape for this chord in the chord database.');
});

test('opening a chord for the piano draws the staff again, with its inversion numbered in the caption instead of the guitar shape', () => {
  const { dialog, notes, staffVoicings } = guitarSetup();
  notes.open(E_OVER_C, null, null, {}, { instrument: 'guitar', fingering: C_SHAPES });
  notes.open(E_OVER_C, null, null, {}, { instrument: 'piano' });
  assert.equal(staffVoicings.length, 1);
  assert.equal(dialog.parts['#notes-caption'].textContent, '2 / 3');
});

test('the caption of the piano numbers the inversion shown, and changes with each click in either half', () => {
  const { dialog, notes } = guitarSetup();
  notes.open(E_OVER_C, null, null, {}, { instrument: 'piano' });
  assert.equal(dialog.parts['#notes-caption'].textContent, '2 / 3');
  click(dialog, FORWARD);
  assert.equal(dialog.parts['#notes-caption'].textContent, '3 / 3');
  click(dialog, BACK);
  click(dialog, BACK);
  assert.equal(dialog.parts['#notes-caption'].textContent, '1 / 3');
});

test('a click in the left half of the window shows the previous inversion, and the first one goes back to the last', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(E_OVER_C);
  click(dialog, BACK);
  assert.deepEqual(drawn.map((voicing) => voicing.upper[0]), ['E4', 'C4']);
});

test('a click in the right half of the window shows the next inversion, as a click anywhere in the window does', () => {
  const { dialog, drawn, notes } = setup();
  notes.open(E_OVER_C);
  click(dialog, FORWARD);
  assert.deepEqual(drawn.map((voicing) => voicing.upper[0]), ['E4', 'G4']);
});

test('a click in the left half of the window shows the previous shape of the guitar, and the first one goes back to the last', () => {
  const { dialog, notes, diagrams } = guitarSetup();
  notes.open(E_OVER_C, null, null, {}, { instrument: 'guitar', fingering: C_SHAPES });
  click(dialog, BACK);
  assert.deepEqual(diagrams.map((diagram) => diagram.position), [1, 3]);
  assert.equal(dialog.parts['#notes-caption'].textContent, '2 / 2');
});

test('the staff box is marked for the guitar only while it shows a diagram, so the piano keeps its own size', () => {
  const { dialog, notes } = guitarSetup();
  const staff = dialog.parts['#notes-staff'];
  notes.open(E_OVER_C, null, null, {}, { instrument: 'guitar', fingering: C_SHAPES });
  assert.ok(staff.classes.has('is-guitar'));
  notes.open(E_OVER_C, null, null, {}, { instrument: 'piano' });
  assert.ok(!staff.classes.has('is-guitar'));
});

test('a click on the diagram keeps the staff box marked, so the window does not change size', () => {
  const { dialog, notes } = guitarSetup();
  notes.open(E_OVER_C, null, null, {}, { instrument: 'guitar', fingering: C_SHAPES });
  click(dialog, FORWARD);
  assert.ok(dialog.parts['#notes-staff'].classes.has('is-guitar'));
});

test('the first diagram is drawn while the window is already open, as the later ones are', () => {
  const dialog = new FakeDialog();
  const openWhenDrawn = [];
  const notes = createNotesDialog(dialog, () => {}, () => '', () => openWhenDrawn.push(dialog.isOpen));
  notes.open(E_OVER_C, null, null, {}, { instrument: 'guitar', fingering: C_SHAPES });
  click(dialog, FORWARD);
  assert.deepEqual(openWhenDrawn, [true, true]);
});

test('without options the chord opens for the piano, as before', () => {
  const { dialog, notes, staffVoicings } = guitarSetup();
  notes.open(E_OVER_C);
  assert.equal(staffVoicings.length, 1);
  assert.equal(dialog.parts['#notes-caption'].textContent, '2 / 3');
});
