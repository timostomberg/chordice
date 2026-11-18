/**
 * The header bar: the options button, the instrument tabs, the view switches (roman numerals, chord tones, inversions and
 * colours) and the dark mode switch. The markup is in main.html; updateHeader shows the state on its buttons.
 */

import { isUnavailable } from '../core/state.js';

/** Shows the state on the header: pressed switches, the chosen instrument and the options button. */
export function updateHeader(state, root = document) {
  // Each view switch names its flag in data-flag, so its pressed state follows the state.
  for (const button of root.querySelectorAll('[data-flag]')) {
    button.setAttribute('aria-pressed', String(state[button.dataset.flag]));
    // A switch the chosen instrument does not use is greyed out. Its pressed state still shows the stored value.
    button.disabled = isUnavailable(state, button.dataset.flag);
  }
  // The instrument tabs: exactly the tab of the chosen instrument is pressed.
  for (const button of root.querySelectorAll('[data-instrument]')) {
    button.setAttribute('aria-pressed', String(button.dataset.instrument === state.instrument));
  }
  // The options button is the element with the class; the header carries the same action but is not the button.
  root.querySelector('.options-toggle').setAttribute('aria-expanded', String(state.showOptions));
  root.querySelector('[data-action="toggle-theme"]').setAttribute('aria-pressed', String(state.theme === 'dark'));
}
