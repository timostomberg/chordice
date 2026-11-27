/**
 * The actions of the page: maps an action from the data attributes (e.g. "toggle-colour") onto a state transition.
 * The transitions themselves live in state.js; this module only names them and checks (with availability.js) that the
 * option an action changes is available (for the chosen instrument, the count while the circle of fifths switch is on,
 * or an option the exercise that is on fixes).
 */

import {
  choosePanel,
  clearExercise,
  clearVariations,
  cycleCount,
  reroll,
  setInstrument,
  setKey,
  SECTION_OPTIONS,
  setProbability,
  toggleFlag,
  toggleExercise,
  toggleGroup,
  toggleProgression,
  toggleSection,
  toggleTheme,
  toggleVariation,
} from './state.js';
import { isUnavailable, isUnavailableForSettings } from './availability.js';

/** Actions that switch one flag; the action name is the flag's name in the data attributes. */
const FLAG_ACTIONS = {
  'toggle-colour': 'colour',
  'toggle-roman': 'roman',
  'toggle-tones': 'tones',
  'toggle-melody': 'inversions',
  'toggle-foreign-variations': 'foreignVariations',
  'toggle-circle-of-fifths': 'circleOfFifths',
  'toggle-painting': 'painting',
  // A click on the header outside its buttons opens or closes the side panel, which keeps the panel it shows.
  'toggle-panel': 'showOptions',
};

/** The option of the actions that change one option, when that option can be unavailable. */
const ACTION_OPTIONS = {
  'toggle-tones': 'tones',
  'toggle-melody': 'inversions',
  'cycle-count': 'count',
  'set-key': 'key',
  'toggle-group': 'selection',
  'toggle-progression': 'selection',
  'toggle-variation': 'variations',
  'clear-variations': 'variations',
  'toggle-foreign-variations': 'foreignVariations',
  'toggle-circle-of-fifths': 'circleOfFifths',
  'toggle-exercise': 'exercise',
  'clear-exercise': 'exercise',
};

/** The option an action changes, when that option can be unavailable; null for every other action. */
function optionOf(action, params) {
  if (Object.hasOwn(ACTION_OPTIONS, action)) {
    return ACTION_OPTIONS[action];
  }
  if (action === 'toggle-section' && Object.hasOwn(SECTION_OPTIONS, params.section)) {
    return SECTION_OPTIONS[params.section];
  }
  return action === 'set-probability' ? params.option : null;
}

/** Maps a UI action (from data-attributes) onto a state transition. Unknown actions leave the state unchanged. */
export function applyAction(state, action, params, library, random = Math.random) {
  // An option that is unavailable (for the chosen instrument, or fixed by the exercise) cannot be changed, even by an event
  // that reaches it.
  // A section whose option a frozen song fixes can still be opened and closed, to show the values (see options.js).
  const option = optionOf(action, params);
  const blocked = action === 'toggle-section' ? isUnavailableForSettings(state, option) : isUnavailable(state, option);
  if (blocked) {
    return state;
  }
  if (Object.hasOwn(FLAG_ACTIONS, action)) {
    return toggleFlag(state, FLAG_ACTIONS[action]);
  }
  const transitions = {
    'set-key': () => setKey(state, params.key),
    'toggle-group': () => toggleGroup(state, params.group, library),
    'toggle-progression': () => toggleProgression(state, params.id, library),
    'cycle-count': () => cycleCount(state),
    'toggle-variation': () => toggleVariation(state, params.variation),
    'clear-variations': () => clearVariations(state),
    'set-probability': () => setProbability(state, params.option, params.value),
    'toggle-exercise': () => toggleExercise(state, params.exercise),
    'clear-exercise': () => clearExercise(state),
    // The Options, Exercises, Songs and Help buttons: one switch of four, like the instrument tabs (see choosePanel).
    'toggle-options': () => choosePanel(state, 'options'),
    'toggle-exercises': () => choosePanel(state, 'exercises'),
    'toggle-songs': () => choosePanel(state, 'songs'),
    'toggle-help': () => choosePanel(state, 'help'),
    'toggle-section': () => toggleSection(state, params.section),
    'toggle-theme': () => toggleTheme(state),
    'set-instrument': () => setInstrument(state, params.instrument),
    'reroll': () => reroll(state, random),
  };
  return Object.hasOwn(transitions, action) ? transitions[action]() : state;
}
