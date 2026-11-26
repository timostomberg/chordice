/**
 * Application state: its defaults and its pure transitions. Each transition returns a new state and changes only the
 * option it is about. Keeping the state in a cookie is in persistence.js; which options are available and which settings
 * take effect is in availability.js.
 */

import { VARIATION_NAMES } from '../../music/theory/chords.js';
import { SLOTS_COUNTERCLOCKWISE, isKeyName } from '../../music/theory/keys.js';
import { PROBABILITY_MAX } from '../../music/constants.js';
import { createSeeds } from '../../music/generator/random.js';
import { exerciseById } from './exercises.js';

export const COUNTS = [1, 2, 4, 8];
// With the circle of fifths switch on, there is one row per key of the circle, so the count is fixed at 12.
export const CIRCLE_COUNT = SLOTS_COUNTERCLOCKWISE.length;
const PROBABILITY_OPTIONS = ['rotation', 'permutation', 'variationProbability', 'bassProbability', 'melodyAmount'];
export const FLAGS = ['showOptions', 'colour', 'roman', 'tones', 'inversions', 'foreignVariations', 'circleOfFifths', 'painting'];
export const THEMES = ['light', 'dark'];
// The instrument whose notes window the chords open: notes for the piano, a diagram for the guitar.
export const INSTRUMENTS = ['piano', 'guitar'];
// What the side panel shows: the options, the exercises or the help. The Options, Exercises and Help buttons in the header
// choose it, like the instrument tabs, so exactly one of them is pressed while the panel is open.
export const PANELS = ['options', 'exercises', 'help'];
// The boxes of the options panel, and those of the exercises panel. Each box opens and closes on its own.
export const SECTIONS = ['progressions', 'progressionVariations', 'variations', 'bass', 'melody'];
export const EXERCISE_SECTIONS = ['exercises'];
export const ALL_SECTIONS = [...SECTIONS, ...EXERCISE_SECTIONS];
// The option each section belongs to; a section whose option is unavailable is greyed out and cannot be opened. The
// progressions and the variation sections are unavailable while an exercise fixes them. The key is not in the panel: it
// is chosen on the circle of fifths left of the chords.
export const SECTION_OPTIONS = {
  progressions: 'selection',
  progressionVariations: 'rotation',
  variations: 'variations',
  bass: 'bassProbability',
  melody: 'melodyAmount',
};

// The chord variations selected on start-up: the common ones.
export const DEFAULT_VARIATIONS = ['7', 'maj7', '6', 'add9', 'sus2', 'sus4'];

export function defaultState(library, random = Math.random) {
  return {
    version: 2,
    // The major key of the rows, chosen on the circle of fifths.
    key: 'C',
    selection: library.map((progression) => progression.id),
    count: 4,
    // The probabilities are on the scale from 0 to 5 (1 means 20%).
    rotation: 1,
    permutation: 1,
    variations: [...DEFAULT_VARIATIONS],
    variationProbability: 4,
    bassProbability: 1,
    melodyAmount: 1,
    colour: true,
    roman: true,
    tones: false,
    // The melody: the inversions of the chords.
    inversions: false,
    // On: every chord variation is used. Off: only variations without tones foreign to the key.
    foreignVariations: false,
    // On: one row per key, counterclockwise on the circle of fifths from C, so the count is 12. Off: the selected key.
    circleOfFifths: false,
    // The id of the exercise that is on (see exercises.js), or null.
    exercise: null,
    // On: the painting behind the app shows its landscape. Off: a plain background in the colour of the painting.
    painting: true,
    theme: 'light',
    instrument: 'piano',
    // Whether the side panel is open, and which panel it shows (see PANELS).
    showOptions: true,
    panel: 'options',
    // Every box of the options starts collapsed; the box of the exercises starts expanded.
    collapsed: [...SECTIONS],
    seeds: createSeeds(random),
  };
}

/** An empty selection is allowed: the rows then show no chords. */
function withSelection(state, nextSelection, library) {
  const selection = library
    .map((progression) => progression.id)
    .filter((id) => nextSelection.includes(id));
  return { ...state, selection };
}

/** Selects the key of the rows. Selecting the current key, or a name that is not a major key, changes nothing. */
export function setKey(state, name) {
  if (!isKeyName(name) || state.key === name) {
    return state;
  }
  return { ...state, key: name };
}

export function toggleGroup(state, group, library) {
  const groupIds = library.filter((progression) => progression.group === group).map((p) => p.id);
  if (groupIds.length === 0) {
    return state;
  }
  const allSelected = groupIds.every((id) => state.selection.includes(id));
  const next = allSelected
    ? state.selection.filter((id) => !groupIds.includes(id))
    : [...state.selection, ...groupIds];
  return withSelection(state, next, library);
}

export function toggleProgression(state, id, library) {
  if (!library.some((progression) => progression.id === id)) {
    return state;
  }
  const next = state.selection.includes(id)
    ? state.selection.filter((selected) => selected !== id)
    : [...state.selection, id];
  return withSelection(state, next, library);
}

export function setCount(state, count) {
  return COUNTS.includes(count) ? { ...state, count } : state;
}

/** Moves the number of progressions to the next value in 1, 2, 4, 8, and back to 1 after 8. */
export function cycleCount(state) {
  const next = COUNTS[(COUNTS.indexOf(state.count) + 1) % COUNTS.length];
  return setCount(state, next);
}

export function toggleVariation(state, name) {
  if (!VARIATION_NAMES.includes(name)) {
    return state;
  }
  const next = state.variations.includes(name)
    ? state.variations.filter((variation) => variation !== name)
    : [...state.variations, name];
  // An empty list is allowed: no chord variations are added, while the variation probability stays as it is.
  const variations = VARIATION_NAMES.filter((variation) => next.includes(variation));
  return { ...state, variations };
}

/** Switches every chord variation off at once; the variation probability stays as it is. */
export function clearVariations(state) {
  return { ...state, variations: [] };
}

export function setProbability(state, option, value) {
  if (!PROBABILITY_OPTIONS.includes(option)) {
    return state;
  }
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) {
    return state;
  }
  return { ...state, [option]: Math.min(PROBABILITY_MAX, Math.max(0, rounded)) };
}

/** Expands a collapsed section or collapses an expanded one; the other sections stay as they are. Unknown names are ignored. */
export function toggleSection(state, name) {
  if (!ALL_SECTIONS.includes(name)) {
    return state;
  }
  const opening = state.collapsed.includes(name);
  const collapsed = ALL_SECTIONS.filter((section) => (section === name ? !opening : state.collapsed.includes(section)));
  return { ...state, collapsed };
}

/** Switches between the light and the dark theme. */
export function toggleTheme(state) {
  const next = THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length];
  return { ...state, theme: next };
}

/** Chooses the instrument of the notes window. An unknown instrument leaves the state unchanged. */
export function setInstrument(state, instrument) {
  return INSTRUMENTS.includes(instrument) ? { ...state, instrument } : state;
}

/**
 * Chooses the panel of the side panel, as the Options, Exercises and Help buttons do: the other panel is shown in its place, and
 * choosing the panel that is shown closes the side panel. An unknown panel leaves the state unchanged.
 */
export function choosePanel(state, panel) {
  if (!PANELS.includes(panel)) {
    return state;
  }
  if (state.showOptions && state.panel === panel) {
    return { ...state, showOptions: false };
  }
  return { ...state, showOptions: true, panel };
}

/** Switches the exercise on, or off when it is the one that is on. Another exercise that is on is switched off. */
export function toggleExercise(state, id) {
  if (!exerciseById(id)) {
    return state;
  }
  return { ...state, exercise: state.exercise === id ? null : id };
}

/** Switches the exercise that is on off, if any. */
export function clearExercise(state) {
  return { ...state, exercise: null };
}

/**
 * Switches one of the on/off flags: the side panel (open or closed, keeping its panel), the colours of the chords, the roman numerals, the chord tones,
 * the inversions, the foreign chord variations, the circle of fifths or the painting behind the app.
 */
export function toggleFlag(state, flag) {
  if (!FLAGS.includes(flag)) {
    return state;
  }
  return { ...state, [flag]: !state[flag] };
}

/** New random outcomes for every option; all other settings stay as they are. */
export function reroll(state, random = Math.random) {
  return { ...state, seeds: createSeeds(random) };
}
