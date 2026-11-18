/**
 * The notes window: shows a chord's voicing in a grand staff. The bass stays the same; each click on the staff
 * shows the next inversion in the treble. The window closes with Escape or a click outside its content.
 */

import { inversionOrders, voicing } from './notation.js';
import { renderScore } from './score.js';
import { chordBoxHtml } from './render.js';
import { toneKind } from './theory.js';

/** The class that frames the chord whose notes are open. */
const OPEN_CLASS = 'is-open';

/**
 * Connects the dialog element to its parts. Returns an object with open(chord, element, tonic, display), which takes a chord
 * from the generator (with displaySymbol, tones, bass, root and quality), the element that shows it, the key `tonic` of its
 * row and the display switches of the rows. The chord box is drawn above the staff by `drawChord`, as the row shows it.
 * The element is framed while the window is open. Without a key, the tones are not coloured. The staff is drawn by
 * `drawStaff`, by default with VexFlow, which also gets how each tone is judged in the key (red, blue or plain).
 */
export function createNotesDialog(dialog, drawStaff = renderScore, drawChord = chordBoxHtml) {
  const staff = dialog.querySelector('#notes-staff');
  const chordBox = dialog.querySelector('#notes-chord');
  let current = null;
  let framed = null;

  function show() {
    const { chord, tonic, orders, index, bass, display } = current;
    const kindOf = (tone) => (tonic === null ? '' : toneKind(tone, chord, tonic));
    // The chord box follows the inversion on the staff, so it shows the top melody note of the inversion that is drawn.
    chordBox.innerHTML = drawChord({ ...chord, inversion: index }, display, tonic);
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

  function open(chord, element = null, tonic = null, display = {}) {
    const { orders, start, bass } = inversionOrders(chord.tones, chord.inversion, chord.bass);
    current = { chord, tonic, orders, index: start, bass, display };
    unframe();
    framed = element;
    framed?.classList.add(OPEN_CLASS);
    show();
    dialog.showModal();
  }

  // Closing by a click on the backdrop or by Escape both end here, so the frame goes in every case.
  dialog.addEventListener('close', unframe);

  staff.addEventListener('click', () => {
    current.index = (current.index + 1) % current.orders.length;
    show();
  });

  // A click on the backdrop, which is the dialog element itself, closes the window.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  return { open };
}
