/**
 * The actions of the page: maps an action from the data attributes (e.g. "toggle-colour") onto a state transition.
 * The transitions themselves live in state.js; this module only names them and checks that the option an action
 * changes is available (for the chosen instrument, the count while the circle of fifths switch is on, or an option the
 * exercise that is on fixes).
 */

import {
  cycleCount,
  isUnavailable,
  openKeys,
  reroll,
  setInstrument,
  SECTION_OPTIONS,
  setProbability,
  toggleFlag,
  toggleExercise,
  toggleGroup,
  toggleKey,
  toggleProgression,
  toggleSection,
  toggleTheme,
  toggleVariation,
} from './state.js';

/** Actions that switch one flag; the action name is the flag's name in the data attributes. */
const FLAG_ACTIONS = {
  'toggle-colour': 'colour',
  'toggle-roman': 'roman',
  'toggle-tones': 'tones',
  'toggle-melody': 'inversions',
  'toggle-foreign-variations': 'foreignVariations',
  'toggle-circle-of-fifths': 'circleOfFifths',
  'toggle-options': 'showOptions',
};

/** The option of the actions that change one option, when that option can be unavailable. */
const ACTION_OPTIONS = {
  'toggle-melody': 'inversions',
  'cycle-count': 'count',
  'toggle-key': 'keys',
  // Keys cannot be opened while the circle of fifths switch is on, so a click on the chords area does nothing then.
  'open-keys': 'keys',
  'toggle-group': 'selection',
  'toggle-progression': 'selection',
  'toggle-variation': 'variations',
  'toggle-foreign-variations': 'foreignVariations',
  'toggle-circle-of-fifths': 'circleOfFifths',
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
  if (isUnavailable(state, optionOf(action, params))) {
    return state;
  }
  if (Object.hasOwn(FLAG_ACTIONS, action)) {
    return toggleFlag(state, FLAG_ACTIONS[action]);
  }
  const transitions = {
    'toggle-key': () => toggleKey(state, params.key),
    'toggle-group': () => toggleGroup(state, params.group, library),
    'toggle-progression': () => toggleProgression(state, params.id, library),
    'cycle-count': () => cycleCount(state),
    'toggle-variation': () => toggleVariation(state, params.variation),
    'set-probability': () => setProbability(state, params.option, params.value),
    'toggle-exercise': () => toggleExercise(state, params.exercise),
    'toggle-section': () => toggleSection(state, params.section),
    'open-keys': () => openKeys(state),
    'toggle-theme': () => toggleTheme(state),
    'set-instrument': () => setInstrument(state, params.instrument),
    'reroll': () => reroll(state, random),
  };
  return Object.hasOwn(transitions, action) ? transitions[action]() : state;
}
