/**
 * The notes window: shows a chord's voicing in a grand staff for the piano, or its shape as a diagram for the guitar.
 * A click in the left half of the window shows the previous view, one in the right half the next: for the piano an
 * inversion with the same bass, for the guitar a shape. A swipe to the left shows the next view, one to the right the
 * previous, as pages turn. The arrow keys Left and Right step the same way. The window closes with Escape or a click
 * outside its content.
 */

import { inversionOrders, voicing } from '../../music/instruments/piano.js';
import { renderScore } from './staff.js';
import { chordBoxHtml } from '../chord.js';
import { captionHtml, diagramOf, renderFingering } from './diagram.js';
import { toneKind } from '../../music/theory/tones.js';

/** The class that frames the chord whose notes are open. */
const OPEN_CLASS = 'is-open';

/** The class on the staff box while it shows a guitar diagram. */
const GUITAR_CLASS = 'is-guitar';

/** How far, in pixels, a finger or the mouse must move sideways for a swipe; a shorter move is a click. */
export const SWIPE_DISTANCE = 40;

/**
 * Connects the dialog element to its parts. Returns an object with open(chord, element, tonic, display, options), which
 * takes a chord from the generator (with displaySymbol, tones, bass, root and quality), the element that shows it, the key
 * `tonic` of its row and the display switches of the rows. The chord box is drawn above the staff by `drawChord`, as the
 * row shows it. The element is framed while the window is open. Without a key, the tones are not coloured.
 *
 * `options` has the `instrument` ('piano' or 'guitar') and, for the guitar, the `fingering` of the chord (see music/instruments/guitar.js).
 * The piano staff is drawn by `drawStaff`, by default with VexFlow, which also gets how each tone is judged in the key (red,
 * blue or plain). The guitar diagram is drawn by `drawFingering`, by default with svguitar. The caption under the score
 * numbers the view shown, as "1 / 4" (the inversion for the piano, the shape for the guitar), and for the guitar also names
 * the stand-in chord when the database has no shape for the chord itself.
 */
export function createNotesDialog(dialog, drawStaff = renderScore, drawChord = chordBoxHtml, drawFingering = renderFingering) {
  const staff = dialog.querySelector('#notes-staff');
  const chordBox = dialog.querySelector('#notes-chord');
  const caption = dialog.querySelector('#notes-caption');
  let current = null;
  let framed = null;

  /** How many views a click steps through: the inversions for the piano, the shapes for the guitar. */
  function viewCount({ instrument, orders, fingering }) {
    return instrument === 'guitar' ? Math.max(1, fingering?.shapes.length ?? 0) : orders.length;
  }

  function show() {
    const { chord, tonic, orders, index, bass, display, instrument, fingering } = current;
    // The guitar diagram has a box of its own size in the stylesheet, so that the window keeps its size from shape to shape.
    staff.classList.toggle(GUITAR_CLASS, instrument === 'guitar');
    if (instrument === 'guitar') {
      // The chord box stays as the row shows it: a click changes the shape, not the inversion.
      chordBox.innerHTML = drawChord(chord, display, tonic);
      caption.innerHTML = captionHtml(fingering, index);
      const diagram = diagramOf(fingering, index);
      staff.textContent = '';
      if (diagram) {
        drawFingering(staff, diagram);
      }
      return;
    }
    const kindOf = (tone) => (tonic === null ? '' : toneKind(tone, chord, tonic));
    // The chord box follows the inversion on the staff, so it shows the top melody note of the inversion that is drawn.
    chordBox.innerHTML = drawChord({ ...chord, inversion: index }, display, tonic);
    // The number of the inversion shown, counted in the order of the inversions, as the rows count the chords of a group.
    caption.textContent = `${index + 1} / ${orders.length}`;
    drawStaff(
      staff,
      { key: tonic, ...voicing(orders[index], bass) },
      { bass: kindOf(bass), upper: orders[index].map(kindOf) },
    );
  }

  function unframe() {
    framed?.classList.remove(OPEN_CLASS);
    framed = null;
  }

  function open(chord, element = null, tonic = null, display = {}, { instrument = 'piano', fingering = null } = {}) {
    const { orders, start, bass } = inversionOrders(chord.tones, chord.inversion, chord.bass);
    current = {
      chord,
      tonic,
      orders,
      index: instrument === 'guitar' ? 0 : start,
      bass,
      display,
      instrument,
      fingering,
    };
    unframe();
    framed = element;
    framed?.classList.add(OPEN_CLASS);
    // The window is opened before the first view is drawn, so the first diagram is laid out like the ones after a click.
    dialog.showModal();
    show();
  }

  // Closing by a click on the backdrop or by Escape both end here, so the frame goes in every case, and no view is current.
  dialog.addEventListener('close', () => {
    unframe();
    current = null;
  });

  /** Steps to the previous (-1) or the next (1) view, and wraps around at the ends. */
  function step(direction) {
    if (!current) {
      return;
    }
    const count = viewCount(current);
    current.index = (current.index + direction + count) % count;
    show();
  }

  // A swipe steps through the views: to the left for the next one, to the right for the previous one. It counts when the
  // move is long enough and more sideways than up or down. The click the browser may send at the end of a swipe (a mouse
  // does, a finger mostly not) is not a step of its own, nor does it close the window; the next press starts afresh.
  let swipeStart = null;
  let swiped = false;
  dialog.addEventListener('pointerdown', (event) => {
    swipeStart = { x: event.clientX, y: event.clientY };
    swiped = false;
  });
  dialog.addEventListener('pointerup', (event) => {
    const start = swipeStart;
    swipeStart = null;
    if (!start || !current) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      step(dx < 0 ? 1 : -1);
    }
  });
  dialog.addEventListener('pointercancel', () => {
    swipeStart = null;
  });

  // A click on the backdrop, which is the dialog element itself, closes the window. Any other click inside the window steps
  // back when it lands in the left half, and forward in the right half.
  dialog.addEventListener('click', (event) => {
    if (swiped) {
      swiped = false;
      return;
    }
    if (event.target === dialog) {
      dialog.close();
      return;
    }
    const { left, width } = dialog.getBoundingClientRect();
    step(event.clientX < left + width / 2 ? -1 : 1);
  });

  // The same steps from the keyboard: Left goes to the previous view, Right to the next. The dialog has focus while it is
  // open (it is tabindex -1 in index.html), so its keys reach this listener.
  dialog.addEventListener('keydown', (event) => {
    if (!current) {
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });

  return { open };
}
