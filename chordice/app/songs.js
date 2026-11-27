/**
 * The songs panel of the side panel: a field to save the song that is shown under a name, and the list of saved songs,
 * each of which loads with a click and can be renamed or deleted. Renaming and the question before deleting happen in the
 * entry of the song itself, without a dialog of the browser, which some browsers block. Signing in, so that the songs are
 * kept in the account, is in the account panel (see account-panel.js). While a saved song is shown frozen (see
 * app/state/songs.js), a note says so above the options, the exercises and the songs, with a button that generates the
 * song anew. Every function returns a string of HTML.
 */

import { escapeHtml } from './escape.js';
import { nameHtml } from './names.js';
import { SONG_LIMIT, formatDate, frozenSong, keyLabel, songsFull } from './state/songs.js';

/** The id of the name field, which app.js reads when the song is saved. */
export const NAME_FIELD_ID = 'song-name';

/** The id of the field of a song that is being renamed, which app.js focuses and reads. */
export const RENAME_FIELD_ID = 'rename-name';

/**
 * The note above the panels while a saved song is shown frozen: the song was saved by another version of the page, so it
 * is shown as it was saved and its options are fixed. Empty while no song is frozen.
 */
export function renderFrozenNote(state) {
  const song = frozenSong(state);
  if (!song) {
    return '';
  }
  return `<div class="frozen-note" role="note"><p><strong>${escapeHtml(song.name)}</strong> is shown as it was saved: ` +
    'Chordice has changed since, and its options would now give another song. They are fixed while it is shown.</p>' +
    '<button type="button" class="chip" data-action="unfreeze-song">Generate anew</button></div>';
}

/** The row count of a saved song, e.g. "4 rows". */
function rowCount(song) {
  const count = song.song.rows.length;
  return `${count} ${count === 1 ? 'row' : 'rows'}`;
}

// The floppy disk of the Save button: its body with the cut corner, the shutter at the top and the label below.
const SAVE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M4 5a1 1 0 0 1 1-1h11.5L20 7.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M8 4v5h7V4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
  '<rect x="7.5" y="13" width="9" height="5" rx="0.5" fill="currentColor"/></svg>';

// The pencil of the rename button.
const RENAME_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M4 20l1-4L16 5l3 3L8 19z M14 7l3 3" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * A saved song that is being renamed: a field with its name in place of the name, with an OK button that renames it (Enter
 * does too) and a cross that leaves the name as it was (Escape does too).
 */
function renameItem(song, shown) {
  const id = escapeHtml(song.id);
  return `<li class="saved-song is-renaming${shown ? ' is-shown' : ''}">` +
    `<form class="rename-song" data-form="rename-song" data-id="${id}">` +
    `<input type="text" id="${RENAME_FIELD_ID}" class="song-name" name="name" maxlength="60" autocomplete="off" ` +
    `aria-label="New name of ${escapeHtml(song.name)}" value="${escapeHtml(song.name)}">` +
    '<button type="submit" class="chip is-on">OK</button>' +
    '<button type="button" class="chip" data-action="cancel-rename" aria-label="Keep the name" title="Keep the name">×</button>' +
    '</form></li>';
}

/**
 * A saved song that is about to be deleted: the question in place of its name, with a Delete button that deletes it and a
 * cross that keeps it.
 */
function deleteItem(song, shown) {
  const id = escapeHtml(song.id);
  return `<li class="saved-song is-deleting${shown ? ' is-shown' : ''}">` +
    `<p class="delete-question">Delete <strong>${escapeHtml(song.name)}</strong>?</p>` +
    `<button type="button" class="chip is-on" data-action="confirm-delete" data-id="${id}">Delete</button>` +
    '<button type="button" class="chip" data-action="cancel-delete" aria-label="Keep the song" title="Keep the song">×</button>' +
    '</li>';
}

/**
 * One saved song: a button that loads it, with its name and what it holds, and buttons that rename and delete it. The song
 * with the id `renaming` shows its name in a field instead, and the song with the id `deleting` the question whether to
 * delete it.
 */
function songItem(song, state, { renaming = null, deleting = null } = {}) {
  const shown = state.frozen === song.id;
  if (song.id === renaming) {
    return renameItem(song, shown);
  }
  if (song.id === deleting) {
    return deleteItem(song, shown);
  }
  const meta = [nameHtml(keyLabel(song.recipe)), escapeHtml(rowCount(song)), escapeHtml(formatDate(new Date(song.savedAt)))]
    .join(' · ');
  const id = escapeHtml(song.id);
  return `<li class="saved-song${shown ? ' is-shown' : ''}">` +
    `<button type="button" class="saved-song-load" data-action="load-song" data-id="${id}">` +
    `<span class="saved-song-name">${escapeHtml(song.name)}</span><span class="saved-song-meta">${meta}</span></button>` +
    `<button type="button" class="chip saved-song-rename" data-action="rename-song" data-id="${id}" ` +
    `aria-label="Rename ${escapeHtml(song.name)}" title="Rename">${RENAME_ICON}</button>` +
    `<button type="button" class="chip saved-song-delete" data-action="delete-song" data-id="${id}" ` +
    `aria-label="Delete ${escapeHtml(song.name)}" title="Delete">×</button></li>`;
}

/**
 * The list of saved songs with a short note under it, or a note while there are none, or while the songs of the account
 * have not come yet.
 */
function songList(state, editing, account) {
  if (account?.loading) {
    return '<p class="songs-empty">Loading the songs of your account…</p>';
  }
  if (state.songs.length === 0) {
    return '<p class="songs-empty">No saved songs yet. Save the song that is shown to find it here again.</p>';
  }
  return `<ul class="saved-songs">${state.songs.map((song) => songItem(song, state, editing)).join('')}</ul>` +
    '<p class="songs-hint">Click a song to load it with its options.</p>';
}

/**
 * Renders the songs panel. `draft` is the name typed into the field so far, kept over a re-render; the field is empty
 * after a song is saved. `editing` names the saved song that is being renamed (`renaming`) or is about to be deleted
 * (`deleting`), by its id. `account` is null where the page has no account, else whether the songs of the person who is
 * signed in are still `loading`. Once SONG_LIMIT songs are saved, or while the songs load, the Save button is greyed out.
 */
export function renderSongs(state, draft = '', editing = {}, account = null) {
  const full = songsFull(state);
  const blocked = full || account?.loading === true;
  const save = '<h2 class="options-heading">Save</h2>' +
    '<form class="save-song" data-form="save-song">' +
    `<input type="text" id="${NAME_FIELD_ID}" class="song-name" name="name" maxlength="60" autocomplete="off" ` +
    `placeholder="Name (optional)" aria-label="Name of the song" value="${escapeHtml(draft)}">` +
    `<button type="submit" class="chip is-on save-song-button" aria-label="Save song" title="Save song"${blocked ? ' disabled' : ''}>` +
    `${SAVE_ICON}</button></form>` +
    '<p class="songs-hint">Saves the song shown.</p>' +
    (full ? `<p class="songs-full">At most ${SONG_LIMIT} songs can be saved. Delete one to save another.</p>` : '');
  return save + '<h2 class="options-heading">Saved songs</h2>' + songList(state, editing, account);
}
