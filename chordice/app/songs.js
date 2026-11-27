/**
 * The songs panel of the side panel: a field to save the song that is shown under a name, and the list of saved songs,
 * each of which loads with a click and can be renamed or deleted. Renaming and the question before deleting happen in the
 * entry of the song itself, without a dialog of the browser, which some browsers block. Where the page has an account, the
 * panel offers to sign in with Google, so that the songs are kept in the account, and to sign out or delete the account.
 * While a saved song is shown frozen (see app/state/songs.js), a note
 * says so above the options, the exercises and the songs, with a button that generates the song anew. Every function
 * returns a string of HTML.
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

// The G of the Sign in with Google button, in the colours of Google's own button.
const GOOGLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4"/>' +
  '<path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853"/>' +
  '<path d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9z" fill="#FBBC05"/>' +
  '<path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" fill="#EA4335"/></svg>';

/**
 * The privacy policy, from the page (index.html), which the account section links to. A click shows it in the side panel
 * (see help/help.js); the address is there for opening it on its own, e.g. in a new tab.
 */
export const PRIVACY_PATH = 'chordice/app/help/privacy.html';

/** Who is signed in, as the account section names them: their name and email address, or what there is of them. */
function personLabel(person) {
  const name = escapeHtml(person.name);
  const email = escapeHtml(person.email);
  if (name && email) {
    return `<strong>${name}</strong> (${email})`;
  }
  return name || email ? `<strong>${name || email}</strong>` : 'your Google account';
}

/** A message of the account section (e.g. why the account could not be deleted), or nothing. */
function accountNotice(account) {
  return account.notice ? `<p class="account-notice" role="status">${escapeHtml(account.notice)}</p>` : '';
}

/** The invitation to sign in with Google: the button in the middle, and under it a quiet note of what it is for. */
function signInSection(account) {
  return '<section class="account" aria-label="Account">' +
    `<button type="button" class="chip account-sign-in" data-action="sign-in">${GOOGLE_ICON}<span>Sign in with Google</span></button>` +
    '<p class="account-text account-hint">Sign in to keep your songs in your account and find them on every device. ' +
    `See the <a href="${PRIVACY_PATH}" data-action="show-help-page" data-page="privacy">privacy policy</a> for what ` +
    'this means for your data.</p>' +
    accountNotice(account) + '</section>';
}

/**
 * The account section at the bottom of the songs panel, under the heading Account: an invitation to sign in, or who is
 * signed in, with buttons to sign out and to delete the account. Deleting it asks first, in the section itself. Empty
 * where the page has no account.
 */
function accountSection(account, deletingAccount) {
  if (!account) {
    return '';
  }
  return '<h2 class="options-heading">Account</h2>' + accountCard(account, deletingAccount);
}

/** The card of the account section (see accountSection). */
function accountCard(account, deletingAccount) {
  if (!account.person) {
    return signInSection(account);
  }
  if (deletingAccount) {
    return '<section class="account is-deleting" aria-label="Account">' +
      '<p class="account-text">Delete your account and every song saved in it? This cannot be undone.</p>' +
      '<div class="account-buttons">' +
      '<button type="button" class="chip is-on" data-action="confirm-delete-account">Delete account</button>' +
      '<button type="button" class="chip" data-action="cancel-delete-account">Keep it</button></div></section>';
  }
  return '<section class="account" aria-label="Account">' +
    `<p class="account-text">Signed in as ${personLabel(account.person)}.</p>` +
    '<div class="account-buttons">' +
    '<button type="button" class="chip" data-action="sign-out">Sign out</button>' +
    '<button type="button" class="chip" data-action="delete-account">Delete account</button></div>' +
    accountNotice(account) + '</section>';
}

/** The list of saved songs, or a note while there are none, or while the songs of the account have not come yet. */
function songList(state, editing, account) {
  if (account?.loading) {
    return '<p class="songs-empty">Loading the songs of your account…</p>';
  }
  if (state.songs.length === 0) {
    return '<p class="songs-empty">No saved songs yet. Save the song that is shown to find it here again.</p>';
  }
  return `<ul class="saved-songs">${state.songs.map((song) => songItem(song, state, editing)).join('')}</ul>`;
}

/**
 * Renders the songs panel. `draft` is the name typed into the field so far, kept over a re-render; the field is empty
 * after a song is saved. `editing` names the saved song that is being renamed (`renaming`) or is about to be deleted
 * (`deleting`), by its id, and whether the panel asks whether to delete the account (`deletingAccount`). `account` is
 * null where the page has no account, else the person who is signed in (null if no one), whether their songs are still
 * `loading`, and a `notice` of the account section (e.g. why the account could not be deleted). Once SONG_LIMIT songs are saved, or while the songs load, the Save button is greyed out.
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
    (full ? `<p class="songs-full">At most ${SONG_LIMIT} songs can be saved. Delete one to save another.</p>` : '');
  return save + '<h2 class="options-heading">Saved songs</h2>' + songList(state, editing, account) +
    accountSection(account, editing.deletingAccount === true);
}
