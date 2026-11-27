/**
 * Keeps the state in a cookie, and a copy of it in the browser's local storage: writes it, reads it back, and turns the
 * untrusted value that comes back into a valid state.
 * A value the page does not know, also one an older version of the page wrote, falls back to its default.
 */

import { VARIATION_NAMES } from '../../music/theory/chords.js';
import { isKeyName } from '../../music/theory/keys.js';
import { PROBABILITY_MAX } from '../../music/constants.js';
import { SEED_NAMES } from '../../music/generator/random.js';
import { exerciseById } from './exercises.js';
import { ALL_SECTIONS, COUNTS, INSTRUMENTS, PANELS, THEMES, defaultState } from './state.js';

export const COOKIE_NAME = 'chordice_state';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const MAX_SEED = 4294967295;

function toProbability(value, fallback) {
  return Number.isInteger(value) && value >= 0 && value <= PROBABILITY_MAX ? value : fallback;
}

function toSeed(value, fallback) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SEED ? value : fallback;
}

function toBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * The stored selection, in the order of the library, without the progressions the library no longer has. An empty selection
 * is kept; a selection of which no progression is left (e.g. after the progressions were renamed) falls back to the default.
 */
function toSelection(value, library, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const selection = library.map((progression) => progression.id).filter((id) => value.includes(id));
  return selection.length === 0 && value.length > 0 ? fallback : selection;
}

/** Returns a valid state built from untrusted input (e.g. a cookie), filling gaps with defaults. */
export function sanitizeState(raw, library, random = Math.random) {
  const fallback = defaultState(library, random);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }

  const variations = Array.isArray(raw.variations)
    ? VARIATION_NAMES.filter((name) => raw.variations.includes(name))
    : fallback.variations;
  const seeds = {};
  for (const name of SEED_NAMES) {
    seeds[name] = toSeed(raw.seeds?.[name], fallback.seeds[name]);
  }

  return {
    version: fallback.version,
    key: isKeyName(raw.key) ? raw.key : fallback.key,
    selection: toSelection(raw.selection, library, fallback.selection),
    count: COUNTS.includes(raw.count) ? raw.count : fallback.count,
    rotation: toProbability(raw.rotation, fallback.rotation),
    permutation: toProbability(raw.permutation, fallback.permutation),
    variations,
    variationProbability: toProbability(raw.variationProbability, fallback.variationProbability),
    bassProbability: toProbability(raw.bassProbability, fallback.bassProbability),
    melodyAmount: toProbability(raw.melodyAmount, fallback.melodyAmount),
    colour: toBoolean(raw.colour, fallback.colour),
    roman: toBoolean(raw.roman, fallback.roman),
    tones: toBoolean(raw.tones, fallback.tones),
    inversions: toBoolean(raw.inversions, fallback.inversions),
    foreignVariations: toBoolean(raw.foreignVariations, fallback.foreignVariations),
    circleOfFifths: toBoolean(raw.circleOfFifths, fallback.circleOfFifths),
    painting: toBoolean(raw.painting, fallback.painting),
    exercise: exerciseById(raw.exercise)?.id ?? fallback.exercise,
    theme: THEMES.includes(raw.theme) ? raw.theme : fallback.theme,
    instrument: INSTRUMENTS.includes(raw.instrument) ? raw.instrument : fallback.instrument,
    showOptions: toBoolean(raw.showOptions, fallback.showOptions),
    panel: PANELS.includes(raw.panel) ? raw.panel : fallback.panel,
    collapsed: Array.isArray(raw.collapsed)
      ? ALL_SECTIONS.filter((name) => raw.collapsed.includes(name))
      : fallback.collapsed,
    seeds,
    // The saved songs are not kept in the cookie but in the local storage of their own (see songs.js).
    songs: [],
    frozen: typeof raw.frozen === 'string' && raw.frozen !== '' ? raw.frozen : null,
  };
}

/**
 * The path the cookie is kept for: the folder of the page, e.g. "/chordice/" for "/chordice/index.html". On GitHub Pages
 * every project of an account shares one host, so a cookie for "/" would reach the pages of all of them.
 */
export function cookiePathOf(pathname) {
  const path = String(pathname ?? '');
  return path.startsWith('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '/';
}

/** The state as it is kept: without the saved songs, which have a storage of their own (see songs.js). */
function storedState(state) {
  return JSON.stringify({ ...state, songs: undefined });
}

/** The cookie value of the state, kept for `path` (see cookiePathOf). */
export function serializeCookie(state, path = '/') {
  const stored = storedState(state);
  return `${COOKIE_NAME}=${encodeURIComponent(stored)}; Max-Age=${ONE_YEAR_SECONDS}; Path=${path}; SameSite=Lax`;
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

/**
 * The key of the copy of the state in the browser's local storage. Safari keeps a cookie that a script writes for at most
 * seven days, but the local storage until the page has gone unused for seven days, so the copy outlasts the cookie on
 * iPhones and iPads. A page added to the home screen keeps both.
 */
export const STORAGE_KEY = 'chordice_state';

/** The stored copy of the state, as text. */
export function serializeStored(state) {
  return storedState(state);
}

/** Reads the raw state object from its stored copy. Returns null if absent or broken. */
export function parseStored(text) {
  if (typeof text !== 'string') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The raw state the page starts from: the cookie's, or, once Safari has dropped the cookie, the stored copy. */
export function readState(cookieHeader, storedText) {
  return parseCookie(cookieHeader) ?? parseStored(storedText);
}
