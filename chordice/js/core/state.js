/**
 * Application state: defaults, validation, cookie persistence and pure state transitions.
 */

import { VARIATION_NAMES } from '../theory/chords.js';
import { SLOTS_COUNTERCLOCKWISE, isKeyName, majorKeyOf } from '../theory/keys.js';
import { PROBABILITY_MAX } from '../constants.js';
import { SEED_NAMES, createSeeds } from '../generator/utils.js';
import { exerciseById, exerciseSettings } from './exercises.js';

export const COOKIE_NAME = 'chordice_state';
export const COUNTS = [1, 2, 4, 8];
// With the circle of fifths switch on, there is one row per key of the circle, so the count is fixed at 12.
export const CIRCLE_COUNT = SLOTS_COUNTERCLOCKWISE.length;
export const PROBABILITY_OPTIONS = ['rotation', 'permutation', 'variationProbability', 'bassProbability', 'melodyAmount'];
export const FLAGS = ['showOptions', 'colour', 'roman', 'tones', 'inversions', 'foreignVariations', 'circleOfFifths'];
export const THEMES = ['light', 'dark'];
// The instrument whose notes window the chords open: notes for the piano, a diagram for the guitar.
export const INSTRUMENTS = ['piano', 'guitar'];
export const SECTIONS = ['keys', 'progressions', 'progressionVariations', 'variations', 'bass', 'melody', 'exercises'];
// The option each section belongs to; a section whose option is unavailable is greyed out and cannot be opened. Keys is
// unavailable while the circle of fifths switch is on; the progressions and the variation sections while an exercise fixes them.
export const SECTION_OPTIONS = {
  keys: 'keys',
  progressions: 'selection',
  progressionVariations: 'rotation',
  variations: 'variations',
  bass: 'bassProbability',
  melody: 'melodyAmount',
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
// Default for the probabilities, on the scale from 0 to 5 (2 means 40%).
const DEFAULT_PROBABILITY = 2;
const MAX_SEED = 4294967295;

export function defaultState(library, random = Math.random) {
  return {
    version: 1,
    keys: ['C'],
    selection: library.map((progression) => progression.id),
    count: 2,
    rotation: DEFAULT_PROBABILITY,
    permutation: DEFAULT_PROBABILITY,
    variations: [...VARIATION_NAMES],
    variationProbability: DEFAULT_PROBABILITY,
    bassProbability: DEFAULT_PROBABILITY,
    melodyAmount: DEFAULT_PROBABILITY,
    colour: true,
    roman: true,
    tones: false,
    inversions: false,
    // On: every chord variation is used. Off: only variations without tones foreign to the key.
    foreignVariations: true,
    // On: one row per key, counterclockwise on the circle of fifths from C, so the count is 12. Off: the selected key.
    circleOfFifths: false,
    // The id of the exercise that is on (see exercises.js), or null.
    exercise: null,
    theme: 'dark',
    instrument: 'piano',
    showOptions: true,
    // Only the key circle is expanded by default.
    collapsed: SECTIONS.filter((name) => name !== 'keys'),
    seeds: createSeeds(random),
  };
}

function toProbability(value, fallback) {
  if (Number.isInteger(value) && value >= 0 && value <= PROBABILITY_MAX) {
    return value;
  }
  return fallback;
}

function toSeed(value, fallback) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SEED ? value : fallback;
}

/** Returns a valid state built from untrusted input (e.g. a cookie), filling gaps with defaults. */
export function sanitizeState(raw, library, random = Math.random) {
  const fallback = defaultState(library, random);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }

  const rawKeys = Array.isArray(raw.keys) ? [...new Set(raw.keys.map(majorKeyOf).filter(Boolean))] : [];
  // Every progression is selected on start-up, whatever was stored, so the selection never depends on an older cookie.
  const selection = fallback.selection;
  const variations = Array.isArray(raw.variations)
    ? VARIATION_NAMES.filter((name) => raw.variations.includes(name))
    : fallback.variations;
  const seeds = {};
  for (const name of SEED_NAMES) {
    seeds[name] = toSeed(raw.seeds?.[name], fallback.seeds[name]);
  }

  // Cookies written before the split hold a single view; it sets both switches.
  const legacyView = raw.view === 'extended' || raw.view === 'plain' ? raw.view === 'extended' : undefined;
  // Cookies written before the split hold one extended switch, "details", for both the roman numeral and the tones.
  const legacyDetails = typeof raw.details === 'boolean' ? raw.details : legacyView;

  return {
    version: 1,
    keys: rawKeys.length > 0 ? rawKeys.slice(-1) : fallback.keys,
    selection,
    count: COUNTS.includes(raw.count) ? raw.count : fallback.count,
    rotation: toProbability(raw.rotation, fallback.rotation),
    permutation: toProbability(raw.permutation, fallback.permutation),
    variations,
    variationProbability: toProbability(raw.variationProbability, fallback.variationProbability),
    bassProbability: toProbability(raw.bassProbability, fallback.bassProbability),
    melodyAmount: toProbability(raw.melodyAmount, fallback.melodyAmount),
    colour: typeof raw.colour === 'boolean' ? raw.colour : (legacyView ?? fallback.colour),
    roman: typeof raw.roman === 'boolean' ? raw.roman : (legacyDetails ?? fallback.roman),
    tones: typeof raw.tones === 'boolean' ? raw.tones : (legacyDetails ?? fallback.tones),
    inversions: typeof raw.inversions === 'boolean' ? raw.inversions : fallback.inversions,
    foreignVariations: typeof raw.foreignVariations === 'boolean' ? raw.foreignVariations : fallback.foreignVariations,
    circleOfFifths: typeof raw.circleOfFifths === 'boolean' ? raw.circleOfFifths : fallback.circleOfFifths,
    exercise: exerciseById(raw.exercise)?.id ?? fallback.exercise,
    theme: THEMES.includes(raw.theme) ? raw.theme : fallback.theme,
    instrument: INSTRUMENTS.includes(raw.instrument) ? raw.instrument : fallback.instrument,
    showOptions: typeof raw.showOptions === 'boolean' ? raw.showOptions : fallback.showOptions,
    collapsed: Array.isArray(raw.collapsed)
      ? withAtMostOneExpanded(SECTIONS.filter((name) => raw.collapsed.includes(name)))
      : fallback.collapsed,
    seeds,
  };
}

/**
 * The cookie value of the state. The selection is left out, as JSON drops the undefined value: every progression is
 * selected on start-up whatever the cookie says (see sanitizeState), so the stored selection would never be read.
 */
export function serializeCookie(state) {
  const stored = JSON.stringify({ ...state, selection: undefined });
  return `${COOKIE_NAME}=${encodeURIComponent(stored)}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`;
}

/** Reads the raw state object from a document.cookie string. Returns null if absent or broken. */
export function parseCookie(cookieHeader) {
  for (const part of String(cookieHeader ?? '').split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator < 0 || trimmed.slice(0, separator) !== COOKIE_NAME) {
      continue;
    }
    try {
      return JSON.parse(decodeURIComponent(trimmed.slice(separator + 1)));
    } catch {
      return null;
    }
  }
  return null;
}

/** An empty selection is allowed: the rows then show no chords. */
function withSelection(state, nextSelection, library) {
  const selection = library
    .map((progression) => progression.id)
    .filter((id) => nextSelection.includes(id));
  return { ...state, selection };
}

/** Key: exactly one. Selecting a key replaces the current one; selecting the current key changes nothing. */
export function toggleKey(state, name) {
  if (!isKeyName(name) || state.keys.includes(name)) {
    return state;
  }
  return { ...state, keys: [name] };
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

/** Keeps at most one options section expanded: the first expanded one in section order. Used for collapsed lists from outside. */
function withAtMostOneExpanded(collapsed) {
  const expanded = SECTIONS.find((section) => !collapsed.includes(section));
  return SECTIONS.filter((section) => section !== expanded);
}

/**
 * Expands a collapsed options section, which collapses all others, or collapses the expanded one.
 * Only one section is expanded at a time. Unknown section names are ignored.
 */
export function toggleSection(state, name) {
  if (!SECTIONS.includes(name)) {
    return state;
  }
  if (state.collapsed.includes(name)) {
    return { ...state, collapsed: SECTIONS.filter((section) => section !== name) };
  }
  return { ...state, collapsed: SECTIONS.filter((section) => section === name || state.collapsed.includes(section)) };
}

/** Opens Keys and closes every other options section. */
export function openKeys(state) {
  return { ...state, collapsed: SECTIONS.filter((section) => section !== 'keys') };
}

/** True when Keys is the only options section open, so that opening Keys again would change nothing. */
export function onlyKeysOpen(state) {
  return SECTIONS.every((section) => state.collapsed.includes(section) === (section !== 'keys'));
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
 * The options the chosen instrument does not use: the guitar has no bass variations and no inversions, so no melody note.
 * They stay in the state with their values, and take effect again when the piano is chosen.
 */
export const GUITAR_UNAVAILABLE = ['bassProbability', 'inversions'];

/**
 * The state with the settings of the exercise that is on; the stored values of every other option. Its options show these
 * values, also while they are greyed out.
 */
export function exerciseState(state) {
  return { ...state, ...exerciseSettings(state) };
}

/** Whether the exercise that is on fixes the option, so that it is greyed out and cannot be changed. */
export function isLocked(state, option) {
  return Object.hasOwn(exerciseSettings(state), option);
}

/**
 * Whether an option is unavailable, so that it is greyed out and does not take effect, or takes the value of the exercise
 * that is on. The melody variations need the melody note: they are unavailable on the guitar, and on the piano while the
 * inversions switch (the melody button) is off. The number of progressions and the keys of the circle are unavailable
 * while the circle of fifths switch is on, also when an exercise switches it on.
 */
export function isUnavailable(state, option) {
  if (isLocked(state, option)) {
    return true;
  }
  // The circle of fifths switch fixes the number of progressions at one per key.
  if (option === 'count' || option === 'keys') {
    return exerciseState(state).circleOfFifths === true;
  }
  if (option === 'melodyAmount') {
    return state.instrument === 'guitar' || !state.inversions;
  }
  return state.instrument === 'guitar' && GUITAR_UNAVAILABLE.includes(option);
}

/**
 * The settings that take effect: the exercise that is on sets its options, and options the chosen instrument does not use
 * count as off; the stored values stay. With the circle of fifths switch on, the count is one row per key; the stored
 * count comes back when it is off.
 */
export function effectiveState(state) {
  const fixed = exerciseState(state);
  const offForInstrument = (option) => !isLocked(state, option) && isUnavailable(state, option);
  return {
    ...fixed,
    count: isUnavailable(state, 'count') ? CIRCLE_COUNT : state.count,
    bassProbability: offForInstrument('bassProbability') ? 0 : fixed.bassProbability,
    melodyAmount: offForInstrument('melodyAmount') ? 0 : fixed.melodyAmount,
    inversions: fixed.inversions && !offForInstrument('inversions'),
  };
}

/** Switches the exercise on, or off when it is the one that is on. Another exercise that is on is switched off. */
export function toggleExercise(state, id) {
  if (!exerciseById(id)) {
    return state;
  }
  return { ...state, exercise: state.exercise === id ? null : id };
}

/**
 * Switches one of the on/off flags: the options panel, the colours of the chords, the roman numerals, the chord tones,
 * the inversions, the foreign chord variations or the circle of fifths.
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
