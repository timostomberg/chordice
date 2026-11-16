/**
 * The notes window: shows a chord's voicing in a grand staff. The bass stays the same; each click on the staff
 * shows the next inversion in the treble. The window closes with Escape or a click outside its content.
 */

import { inversionOrders, voicing } from './notation.js';
import { renderScore } from './score.js';

/**
 * Connects the dialog element to its parts. Returns an object with open(chord), which takes a chord from the
 * generator (with displaySymbol, tones and bass). The staff is drawn by `drawStaff`, by default with VexFlow.
 */
export function createNotesDialog(dialog, drawStaff = renderScore) {
  const staff = dialog.querySelector('#notes-staff');
  let current = null;

  function show() {
    const { orders, index, bass, symbol } = current;
    drawStaff(staff, { symbol, ...voicing(orders[index], bass) });
  }

  function open(chord) {
    const { orders, start, bass } = inversionOrders(chord.tones, chord.inversion, chord.bass);
    current = { orders, index: start, bass, symbol: chord.displaySymbol };
    show();
    dialog.showModal();
  }

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
