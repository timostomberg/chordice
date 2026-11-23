/**
 * The header bar: the options, exercises and help buttons, the instrument tabs, the view switches (roman numerals, chord
 * tones and colours) and the dark mode switch. The melody button sits beside the Melody variations heading in the options.
 * The markup is in index.html; updateHeader shows the state on its buttons.
 */

import { exerciseState, isUnavailable } from './state/availability.js';
import { PANELS } from './state/state.js';

/** Shows the state on the header: pressed switches, the chosen instrument and the panel the side panel shows. */
export function updateHeader(state, root = document) {
  // Each view switch names its flag in data-flag, so its pressed state follows the state.
  for (const button of root.querySelectorAll('[data-flag]')) {
    // A switch the exercise that is on fixes shows the exercise's value.
    button.setAttribute('aria-pressed', String(exerciseState(state)[button.dataset.flag]));
    // A switch the chosen instrument does not use is greyed out. Its pressed state still shows the stored value.
    button.disabled = isUnavailable(state, button.dataset.flag);
  }
  // The instrument tabs: exactly the tab of the chosen instrument is pressed.
  for (const button of root.querySelectorAll('[data-instrument]')) {
    button.setAttribute('aria-pressed', String(button.dataset.instrument === state.instrument));
  }
  // The options, exercises and help buttons are one switch, like the instrument tabs: the button of the panel that is shown
  // is pressed, and none while the side panel is closed. Each button has the class of its panel, e.g. .help-toggle.
  for (const panel of PANELS) {
    root.querySelector(`.${panel}-toggle`).setAttribute('aria-expanded', String(state.showOptions && state.panel === panel));
  }
  root.querySelector('[data-action="toggle-theme"]').setAttribute('aria-pressed', String(state.theme === 'dark'));
}
