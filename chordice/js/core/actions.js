/**
 * The actions of the page: maps an action from the data attributes (e.g. "toggle-colour") onto a state transition.
 * The transitions themselves live in state.js; this module only names them and checks that the option an action
 * changes is available for the chosen instrument.
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
  'toggle-options': 'showOptions',
};

/** The option an action changes, when that option can be unavailable; null for every other action. */
function optionOf(action, params) {
  if (action === 'toggle-melody') {
    return 'inversions';
  }
  if (action === 'toggle-section' && Object.hasOwn(SECTION_OPTIONS, params.section)) {
    return SECTION_OPTIONS[params.section];
  }
  return action === 'set-probability' ? params.option : null;
}

/** Maps a UI action (from data-attributes) onto a state transition. Unknown actions leave the state unchanged. */
export function applyAction(state, action, params, library, random = Math.random) {
  // An option that is unavailable for the chosen instrument cannot be changed, even by an event that reaches it.
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
    'toggle-section': () => toggleSection(state, params.section),
    'open-keys': () => openKeys(state),
    'toggle-theme': () => toggleTheme(state),
    'set-instrument': () => setInstrument(state, params.instrument),
    'reroll': () => reroll(state, random),
  };
  return Object.hasOwn(transitions, action) ? transitions[action]() : state;
}
