/**
 * Application state: defaults, validation, cookie persistence and pure state transitions.
 */

import { VARIATION_NAMES, isKeyName, majorKeyOf } from './theory.js';
import { PROBABILITY_MAX, SEED_NAMES, createSeeds } from './random.js';

export const COOKIE_NAME = 'chordice_state';
export const COUNTS = [1, 2, 4, 8, 12];
export const PROBABILITY_OPTIONS = ['rotation', 'permutation', 'variationProbability', 'bassProbability'];
export const FLAGS = ['showOptions', 'colour', 'roman', 'tones', 'inversions', 'foreignVariations'];
export const THEMES = ['light', 'dark'];
// The instrument whose notes window the chords open: notes for the piano, a diagram for the guitar.
export const INSTRUMENTS = ['piano', 'guitar'];
export const SECTIONS = ['keys', 'progressions', 'progressionVariations', 'variations', 'bass'];

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
// Default for the probabilities, on the scale from 0 to 5 (2 means 40%).
const DEFAULT_PROBABILITY = 2;
const MAX_SEED = 4294967295;

export function defaultState(library, random = Math.random) {
  return {
    version: 1,
    keys: ['C'],
    selection: library.map((progression) => progression.id),
    count: 4,
    rotation: DEFAULT_PROBABILITY,
    permutation: DEFAULT_PROBABILITY,
    variations: [...VARIATION_NAMES],
    variationProbability: DEFAULT_PROBABILITY,
    bassProbability: DEFAULT_PROBABILITY,
    colour: true,
    roman: true,
    tones: true,
    inversions: false,
    // On: every chord variation is used. Off: only variations without tones foreign to the key.
    foreignVariations: true,
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
  // An empty selection or an empty variation list is valid: nothing is shown or added for it.
  const selection = Array.isArray(raw.selection)
    ? library.map((progression) => progression.id).filter((id) => raw.selection.includes(id))
    : fallback.selection;
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
    colour: typeof raw.colour === 'boolean' ? raw.colour : (legacyView ?? fallback.colour),
    roman: typeof raw.roman === 'boolean' ? raw.roman : (legacyDetails ?? fallback.roman),
    tones: typeof raw.tones === 'boolean' ? raw.tones : (legacyDetails ?? fallback.tones),
    inversions: typeof raw.inversions === 'boolean' ? raw.inversions : fallback.inversions,
    foreignVariations: typeof raw.foreignVariations === 'boolean' ? raw.foreignVariations : fallback.foreignVariations,
    theme: THEMES.includes(raw.theme) ? raw.theme : fallback.theme,
    instrument: INSTRUMENTS.includes(raw.instrument) ? raw.instrument : fallback.instrument,
    showOptions: typeof raw.showOptions === 'boolean' ? raw.showOptions : fallback.showOptions,
    collapsed: Array.isArray(raw.collapsed)
      ? withAtMostOneExpanded(SECTIONS.filter((name) => raw.collapsed.includes(name)))
      : fallback.collapsed,
    seeds,
  };
}

export function serializeCookie(state) {
  return `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(state))}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`;
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

/** Moves the number of progressions to the next value in 1, 2, 4, 8, 12, and back to 1 after 12. */
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

/** Whether an option is unavailable for the chosen instrument, so that it is greyed out and does not take effect. */
export function isUnavailable(state, option) {
  return state.instrument === 'guitar' && GUITAR_UNAVAILABLE.includes(option);
}

/** The settings that take effect for the chosen instrument: unavailable options count as off, the stored values stay. */
export function effectiveState(state) {
  return {
    ...state,
    bassProbability: isUnavailable(state, 'bassProbability') ? 0 : state.bassProbability,
    inversions: state.inversions && !isUnavailable(state, 'inversions'),
  };
}

/**
 * Switches one of the on/off flags: the options panel, the colours of the chords, the roman numerals, the chord tones,
 * the inversions or the foreign chord variations.
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

/** Actions that switch one flag; the action name is the flag's name in the data attributes. */
const FLAG_ACTIONS = {
  'toggle-colour': 'colour',
  'toggle-roman': 'roman',
  'toggle-tones': 'tones',
  'toggle-inversions': 'inversions',
  'toggle-foreign-variations': 'foreignVariations',
  'toggle-options': 'showOptions',
};

/** The option an action changes, when that option can be unavailable; null for every other action. */
function optionOf(action, params) {
  if (action === 'toggle-inversions') {
    return 'inversions';
  }
  if (action === 'toggle-section' && params.section === 'bass') {
    return 'bassProbability';
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
