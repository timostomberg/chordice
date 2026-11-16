/**
 * Application state: defaults, validation, cookie persistence and pure state transitions.
 */

import { EXTENSION_NAMES, isKeyName, majorKeyOf } from './theory.js';
import { SEED_NAMES, createSeeds } from './generator.js';

export const COOKIE_NAME = 'chordice_state';
export const COUNTS = [1, 2, 4, 8, 12, 16];
export const PROBABILITY_OPTIONS = ['rotation', 'permutation', 'extensionProbability', 'bassProbability'];
export const FLAGS = ['showOptions', 'colour', 'details'];
export const THEMES = ['light', 'dark'];
export const SECTIONS = ['keys', 'progressions', 'count', 'extensions', 'probabilities'];

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const MAX_SEED = 4294967295;

function unique(items) {
  return [...new Set(items)];
}

export function defaultState(library, random = Math.random) {
  return {
    version: 1,
    keys: ['C'],
    selection: library.map((progression) => progression.id),
    count: 4,
    rotation: 50,
    permutation: 50,
    extensions: [...EXTENSION_NAMES],
    extensionProbability: 50,
    bassProbability: 50,
    colour: true,
    details: true,
    theme: 'dark',
    showOptions: true,
    // Only the key circle is expanded by default.
    collapsed: SECTIONS.filter((name) => name !== 'keys'),
    seeds: createSeeds(random),
  };
}

function toProbability(value, fallback) {
  if (Number.isInteger(value) && value >= 0 && value <= 100 && value % 10 === 0) {
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

  const rawKeys = Array.isArray(raw.keys) ? unique(raw.keys.map(majorKeyOf).filter(Boolean)) : [];
  const ids = new Set(library.map((progression) => progression.id));
  const rawSelection = Array.isArray(raw.selection) ? raw.selection : [];
  const selection = library
    .map((progression) => progression.id)
    .filter((id) => rawSelection.includes(id) && ids.has(id));
  const rawExtensions = Array.isArray(raw.extensions) ? raw.extensions : [];
  const extensions = EXTENSION_NAMES.filter((name) => rawExtensions.includes(name));
  const seeds = {};
  for (const name of SEED_NAMES) {
    seeds[name] = toSeed(raw.seeds?.[name], fallback.seeds[name]);
  }

  // Cookies written before the split hold a single view; it sets both switches.
  const legacyView = raw.view === 'extended' || raw.view === 'plain' ? raw.view === 'extended' : undefined;

  return {
    version: 1,
    keys: rawKeys.length > 0 ? rawKeys.slice(-1) : fallback.keys,
    selection: selection.length > 0 ? selection : fallback.selection,
    count: COUNTS.includes(raw.count) ? raw.count : fallback.count,
    rotation: toProbability(raw.rotation, fallback.rotation),
    permutation: toProbability(raw.permutation, fallback.permutation),
    extensions: extensions.length > 0 ? extensions : fallback.extensions,
    extensionProbability: toProbability(raw.extensionProbability, fallback.extensionProbability),
    bassProbability: toProbability(raw.bassProbability, fallback.bassProbability),
    colour: typeof raw.colour === 'boolean' ? raw.colour : (legacyView ?? fallback.colour),
    details: typeof raw.details === 'boolean' ? raw.details : (legacyView ?? fallback.details),
    theme: THEMES.includes(raw.theme) ? raw.theme : fallback.theme,
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

function withSelection(state, nextSelection, library) {
  const selection = library
    .map((progression) => progression.id)
    .filter((id) => nextSelection.includes(id));
  // The spec asks for one or more progressions, so an empty selection is ignored.
  return selection.length > 0 ? { ...state, selection } : state;
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

export function toggleExtension(state, name) {
  if (!EXTENSION_NAMES.includes(name)) {
    return state;
  }
  const next = state.extensions.includes(name)
    ? state.extensions.filter((extension) => extension !== name)
    : [...state.extensions, name];
  const extensions = EXTENSION_NAMES.filter((extension) => next.includes(extension));
  return extensions.length > 0 ? { ...state, extensions } : state;
}

export function setProbability(state, option, value) {
  if (!PROBABILITY_OPTIONS.includes(option)) {
    return state;
  }
  const rounded = Math.round(Number(value) / 10) * 10;
  if (!Number.isFinite(rounded)) {
    return state;
  }
  return { ...state, [option]: Math.min(100, Math.max(0, rounded)) };
}

/**
 * Keeps at most one options section expanded: the first expanded one in section order. Used for collapsed lists from outside.
 */
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

/** Switches between the light and the dark theme. */
export function toggleTheme(state) {
  const next = THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length];
  return { ...state, theme: next };
}

/** Switches one of the on/off flags: the options panel, the colours of the chords or the extended information. */
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

/** Maps a UI action (from data-attributes) onto a state transition. */
export function applyAction(state, action, params, library, random = Math.random) {
  switch (action) {
    case 'toggle-key':
      return toggleKey(state, params.key);
    case 'toggle-group':
      return toggleGroup(state, params.group, library);
    case 'toggle-progression':
      return toggleProgression(state, params.id, library);
    case 'set-count':
      return setCount(state, Number(params.count));
    case 'toggle-extension':
      return toggleExtension(state, params.extension);
    case 'set-probability':
      return setProbability(state, params.option, params.value);
    case 'toggle-colour':
      return toggleFlag(state, 'colour');
    case 'toggle-details':
      return toggleFlag(state, 'details');
    case 'toggle-section':
      return toggleSection(state, params.section);
    case 'toggle-options':
      return toggleFlag(state, 'showOptions');
    case 'toggle-theme':
      return toggleTheme(state);
    case 'reroll':
      return reroll(state, random);
    default:
      return state;
  }
}
