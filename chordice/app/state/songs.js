/**
 * The saved songs. A saved song keeps two things: its recipe (the options that make the song, and their seeds) and its
 * snapshot (the rows as they were shown, see music/generator/snapshot.js).
 *
 * Loading a song puts its recipe into the state, so the song is generated anew and every option works on it as usual. If
 * the generator or the progression data have changed since, the recipe gives another song than the one saved: the song is
 * then frozen. The state names it in `frozen`, the page shows its snapshot, and the options that make the song are fixed
 * until the song is generated anew (or New Song is pressed). Either way the song that was saved is never lost.
 *
 * The songs live in the state (`songs`), but not in its cookie: they are kept in the browser's local storage under a key of
 * their own, as they would soon be too large for a cookie.
 */

import { generateSong } from '../../music/generator/song.js';
import { rowsForInstrument, sameSong, sanitizeSnapshot, snapshotOf } from '../../music/generator/snapshot.js';
import { isKeyName, minorNameOf } from '../../music/theory/keys.js';
import { effectiveState } from './availability.js';
import { sanitizeState } from './persistence.js';
import { RECIPE_OPTIONS } from './state.js';

/** The key of the saved songs in the browser's local storage. */
export const SONGS_KEY = 'chordice_songs';

/** The longest name a saved song can have. */
export const NAME_LIMIT = 60;

/**
 * The most songs that can be saved. The songs of an account are kept in one document (see app/account.js), which holds at
 * most 1 MiB; the largest song (12 rows, every progression chosen) takes about 10 KB, so 75 of them leave room to spare.
 */
export const SONG_LIMIT = 75;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The recipe of the state: the options that make the song, and the seeds. */
export function recipeOf(state) {
  const recipe = {};
  for (const option of RECIPE_OPTIONS) {
    recipe[option] = state[option];
  }
  return { ...structuredClone(recipe), seeds: { ...state.seeds } };
}

/** A date as the songs show it, year first, e.g. "2026 Nov 27". */
export function formatDate(date) {
  return `${date.getFullYear()} ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/**
 * The key of a recipe as the songs list shows it: "C (Am)", or "All keys" with the circle of fifths switch. A key the page
 * does not know (e.g. from another version) is shown as "Unknown key"; loading the song then falls back to the default.
 */
export function keyLabel(recipe) {
  if (recipe.circleOfFifths === true) {
    return 'All keys';
  }
  return isKeyName(recipe.key) ? `${recipe.key} (${minorNameOf(recipe.key)})` : 'Unknown key';
}

/**
 * Only the recipe of a stored recipe: the options that make the song and the seeds. Anything else it holds (e.g. the
 * instrument or the theme, from another version or edited by hand) is left out, so that loading a song cannot change it.
 */
function recipeFields(raw) {
  const recipe = {};
  for (const option of RECIPE_OPTIONS) {
    if (Object.hasOwn(raw, option)) {
      recipe[option] = raw[option];
    }
  }
  if (Object.hasOwn(raw, 'seeds')) {
    recipe.seeds = raw.seeds;
  }
  return recipe;
}

/** The name a song gets when it is saved without one: the date and time it was saved, e.g. "2026 Nov 27 · 14:30". */
export function defaultSongName(date) {
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${formatDate(date)} · ${time}`;
}

/** The saved song that is shown frozen, or null when the song is generated from the options. */
export function frozenSong(state) {
  return state.frozen ? state.songs?.find((song) => song.id === state.frozen) ?? null : null;
}

/**
 * The song the state shows, for the chosen instrument: the snapshot of the frozen song, or the song generated from the
 * options. Returns its rows, whether each row is headed by its key, and whether the melody note is shown.
 */
export function shownSong(state, library, bassPatterns) {
  const frozen = frozenSong(state);
  if (frozen) {
    return {
      rows: rowsForInstrument(frozen.song, state.instrument),
      showKey: frozen.song.showKey,
      melody: frozen.song.melody && state.instrument !== 'guitar',
    };
  }
  const effective = effectiveState(state);
  return {
    rows: generateSong({ ...effective, library, bassPatterns }),
    showKey: effective.circleOfFifths,
    melody: effective.inversions,
  };
}

/**
 * The snapshot of the song the state shows, as the piano shows it, so that it keeps the bass notes and inversions also when
 * it is saved while the guitar is chosen.
 */
export function songSnapshot(state, library, bassPatterns) {
  const frozen = frozenSong(state);
  if (frozen) {
    return frozen.song;
  }
  const { rows, showKey, melody } = shownSong({ ...state, instrument: 'piano' }, library, bassPatterns);
  return snapshotOf(rows, { showKey, melody });
}

/** Whether as many songs are saved as can be (see SONG_LIMIT), so that no other can be saved. */
export function songsFull(state) {
  return state.songs.length >= SONG_LIMIT;
}

/**
 * Saves the song the state shows under `name` (a default name when it is empty), with the id and the date it is given.
 * The new song is the first of the list. Once SONG_LIMIT songs are saved, nothing is saved.
 */
export function saveSong(state, { id, name, date, library, bassPatterns }) {
  if (songsFull(state)) {
    return state;
  }
  const trimmed = String(name ?? '').trim().slice(0, NAME_LIMIT);
  const song = {
    id,
    name: trimmed || defaultSongName(date),
    savedAt: date.toISOString(),
    recipe: recipeOf(state),
    song: songSnapshot(state, library, bassPatterns),
  };
  return { ...state, songs: [song, ...state.songs] };
}

/**
 * Renames the saved song with the id. The name is trimmed and cut to NAME_LIMIT; an empty name, or an unknown id, changes
 * nothing. The song keeps its place in the list.
 */
export function renameSong(state, id, name) {
  const trimmed = String(name ?? '').trim().slice(0, NAME_LIMIT);
  const song = state.songs.find((saved) => saved.id === id);
  if (!song || !trimmed || trimmed === song.name) {
    return state;
  }
  return { ...state, songs: state.songs.map((saved) => (saved.id === id ? { ...saved, name: trimmed } : saved)) };
}

/** Deletes the saved song with the id. A frozen song that is deleted is generated from the options again. */
export function deleteSong(state, id) {
  if (!state.songs.some((song) => song.id === id)) {
    return state;
  }
  return {
    ...state,
    songs: state.songs.filter((song) => song.id !== id),
    frozen: state.frozen === id ? null : state.frozen,
  };
}

/**
 * Loads the saved song with the id: its recipe takes the place of the options that make the song; every other setting
 * (the view, the instrument, the panel) stays. A recipe value the page no longer knows falls back to its default. If the
 * recipe now gives another song than the one saved, the saved song is frozen.
 */
export function loadSong(state, id, library, bassPatterns) {
  const saved = state.songs.find((song) => song.id === id);
  if (!saved) {
    return state;
  }
  const loaded = { ...sanitizeState({ ...state, ...recipeFields(saved.recipe) }, library), songs: state.songs, frozen: null };
  const same = sameSong(songSnapshot(loaded, library, bassPatterns), saved.song);
  return same ? loaded : { ...loaded, frozen: id };
}

/** Generates the frozen song anew from its options, which can then be changed again. */
export function unfreezeSong(state) {
  return state.frozen === null ? state : { ...state, frozen: null };
}

/** The saved songs, as text for the local storage. */
export function serializeSongs(songs) {
  return JSON.stringify(songs);
}

function sanitizeSong(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || raw.id === '') {
    return null;
  }
  const song = sanitizeSnapshot(raw.song);
  const savedAt = typeof raw.savedAt === 'string' && !Number.isNaN(Date.parse(raw.savedAt)) ? raw.savedAt : null;
  if (!song || !savedAt || !raw.recipe || typeof raw.recipe !== 'object' || Array.isArray(raw.recipe)) {
    return null;
  }
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, NAME_LIMIT) : 'Song';
  // Only its fields are kept; their values are checked when the song is loaded (see loadSong), against the progressions
  // of that day.
  return { id: raw.id, name, savedAt, recipe: recipeFields(raw.recipe), song };
}

/**
 * The saved songs from their text in the local storage. A broken text gives no songs; a broken song is left out, and so is
 * a second song with the same id.
 */
export function parseSongs(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const songs = [];
  for (const song of raw.map(sanitizeSong)) {
    if (song && !songs.some((other) => other.id === song.id)) {
      songs.push(song);
    }
  }
  return songs;
}

/** The state with the saved songs. A frozen song that is not among them is generated from the options again. */
export function withSongs(state, songs) {
  const frozen = songs.some((song) => song.id === state.frozen) ? state.frozen : null;
  return { ...state, songs, frozen };
}

/** Newest first, as the list shows the songs; songs saved at the same time keep the order of their ids. */
function newestFirst(a, b) {
  return Date.parse(b.savedAt) - Date.parse(a.savedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * The saved songs as the document of an account keeps them: a record from the id of each song to the song. Kept by id, one
 * song can be written or removed without touching the others, also when two devices change the songs at once.
 */
export function songsRecord(songs) {
  return Object.fromEntries(songs.map((song) => [song.id, song]));
}

/**
 * The saved songs from the record of an account (see songsRecord), newest first. A broken record gives no songs; a broken
 * song is left out, as is a song whose id is not its key.
 */
export function songsFromRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return [];
  }
  return Object.entries(record)
    .map(([id, raw]) => (raw?.id === id ? sanitizeSong(raw) : null))
    .filter((song) => song !== null)
    .sort(newestFirst);
}

/**
 * What changed from the songs `before` to the songs `after`: the songs to write (new ones and changed ones) and the ids of
 * the songs to remove. The order of the songs does not count.
 */
export function songChanges(before, after) {
  const old = new Map(before.map((song) => [song.id, JSON.stringify(song)]));
  const kept = new Set(after.map((song) => song.id));
  return {
    put: after.filter((song) => old.get(song.id) !== JSON.stringify(song)),
    remove: before.filter((song) => !kept.has(song.id)).map((song) => song.id),
  };
}

/** Whether a change of songChanges changes anything. */
export function hasChanges(changes) {
  return changes.put.length > 0 || changes.remove.length > 0;
}

/**
 * Joins the songs saved in this browser into the songs of an account, when someone signs in. The account keeps all of its
 * songs; the songs of the browser it does not have yet are added, newest first, as long as fewer than `limit` songs are
 * saved. Returns the songs of the account then (newest first), the songs to `upload` to it, and the songs that did not fit
 * and stay in the browser (`left`), so that none is lost. A song of the browser that the account has already (by its id)
 * was uploaded before; the account's copy counts.
 */
export function mergeSongs(account, device, limit = SONG_LIMIT) {
  const ids = new Set(account.map((song) => song.id));
  const upload = [];
  const left = [];
  for (const song of [...device].sort(newestFirst)) {
    if (ids.has(song.id)) {
      continue;
    }
    if (account.length + upload.length < limit) {
      upload.push(song);
    } else {
      left.push(song);
    }
  }
  return { songs: [...account, ...upload].sort(newestFirst), upload, left };
}
