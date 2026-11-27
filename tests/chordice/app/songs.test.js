import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { NAME_FIELD_ID, RENAME_FIELD_ID, renderFrozenNote, renderSongs } from '../../../chordice/app/songs.js';
import { SONG_LIMIT, saveSong } from '../../../chordice/app/state/songs.js';
import { defaultState } from '../../../chordice/app/state/state.js';
import { BASS_PATTERNS, LIBRARY } from '../../helpers/fixtures.js';

const DATE = new Date(2026, 10, 27, 9, 5);

function withSongs(names) {
  let state = defaultState(LIBRARY, () => 0.3);
  names.forEach((name, index) => {
    state = saveSong(state, { id: `id-${index}`, name, date: DATE, library: LIBRARY, bassPatterns: BASS_PATTERNS });
  });
  return state;
}

function dom(html) {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document;
}

test('the songs panel has a name field with a Save button, and says when there are no saved songs', () => {
  const document = dom(renderSongs(withSongs([])));
  const form = document.querySelector('form[data-form="save-song"]');
  assert.ok(form);
  const field = form.querySelector(`#${NAME_FIELD_ID}`);
  assert.equal(field.type, 'text');
  assert.equal(field.value, '');
  assert.equal(field.getAttribute('maxlength'), '60');
  // The Save button submits the form, so Enter in the field saves too; it has no action of its own, so a click saves once.
  const button = form.querySelector('button');
  assert.equal(button.type, 'submit');
  assert.equal(button.dataset.action, undefined);
  // The Save button shows a floppy disk, not a word, and keeps its name for screen readers.
  assert.equal(button.textContent, '');
  assert.ok(button.querySelector('svg'));
  assert.equal(button.getAttribute('aria-label'), 'Save song');
  assert.equal(button.getAttribute('title'), 'Save song');
  assert.ok(document.querySelector('.songs-empty'));
  assert.equal(document.querySelector('.saved-songs'), null);
});

test('the name typed so far is kept over a re-render, escaped', () => {
  const document = dom(renderSongs(withSongs([]), 'My "song" <1>'));
  assert.equal(document.querySelector(`#${NAME_FIELD_ID}`).value, 'My "song" <1>');
});

test('each saved song loads with a click on its name and has a delete button, newest first', () => {
  const state = withSongs(['First', 'Second <b>']);
  const document = dom(renderSongs(state));
  const items = [...document.querySelectorAll('.saved-song')];
  assert.deepEqual(items.map((item) => item.querySelector('.saved-song-name').textContent), ['Second <b>', 'First']);
  const [newest] = items;
  assert.equal(newest.querySelector('[data-action="load-song"]').dataset.id, 'id-1');
  assert.equal(newest.querySelector('[data-action="delete-song"]').dataset.id, 'id-1');
  // The pencil renames the song; it sits between the name and the cross.
  const rename = newest.querySelector('[data-action="rename-song"]');
  assert.equal(rename.dataset.id, 'id-1');
  assert.equal(rename.getAttribute('aria-label'), 'Rename Second <b>');
  assert.ok(rename.querySelector('svg'));
  assert.deepEqual([...newest.querySelectorAll('button')].map((button) => button.dataset.action), ['load-song', 'rename-song', 'delete-song']);
  assert.equal(newest.querySelector('[data-action="delete-song"]').getAttribute('aria-label'), 'Delete Second <b>');
  // What the song holds: its key, its rows and the date it was saved.
  assert.equal(newest.querySelector('.saved-song-meta').textContent, 'C (Am) · 4 rows · 2026 Nov 27');
  assert.equal(document.querySelector('.songs-empty'), null);
});

test('the saved song that is shown frozen is marked in the list', () => {
  const state = { ...withSongs(['First', 'Second']), frozen: 'id-0' };
  const document = dom(renderSongs(state));
  const shown = [...document.querySelectorAll('.saved-song.is-shown')];
  assert.equal(shown.length, 1);
  assert.equal(shown[0].querySelector('.saved-song-name').textContent, 'First');
});

test('the frozen note names the song and offers to generate it anew; without a frozen song there is none', () => {
  const state = withSongs(['Old <song>']);
  assert.equal(renderFrozenNote(state), '');
  const document = dom(renderFrozenNote({ ...state, frozen: 'id-0' }));
  assert.equal(document.querySelector('.frozen-note strong').textContent, 'Old <song>');
  assert.ok(document.querySelector('.frozen-note button[data-action="unfreeze-song"]'));
  // A frozen id without its song shows no note.
  assert.equal(renderFrozenNote({ ...state, frozen: 'gone' }), '');
});

test('the song that is being renamed shows its name in a field with OK and a cross, the others stay as they are', () => {
  const state = withSongs(['First', 'Second "2"']);
  const document = dom(renderSongs(state, '', { renaming: 'id-1' }));
  const form = document.querySelector('form[data-form="rename-song"]');
  assert.equal(form.dataset.id, 'id-1');
  const field = form.querySelector(`#${RENAME_FIELD_ID}`);
  assert.equal(field.value, 'Second "2"');
  assert.equal(field.getAttribute('maxlength'), '60');
  const [ok, cancel] = form.querySelectorAll('button');
  assert.equal(ok.type, 'submit');
  assert.equal(ok.dataset.action, undefined);
  assert.equal(cancel.dataset.action, 'cancel-rename');
  // Only that song is being renamed.
  assert.equal(document.querySelectorAll('form[data-form="rename-song"]').length, 1);
  assert.equal(document.querySelectorAll('[data-action="load-song"]').length, 1);
  assert.equal(document.querySelector('[data-action="load-song"]').dataset.id, 'id-0');
});

test('the song that is about to be deleted asks in its entry, with Delete and a cross; the others stay as they are', () => {
  const state = withSongs(['First', 'Second <2>']);
  const document = dom(renderSongs(state, '', { deleting: 'id-1' }));
  const item = document.querySelector('.saved-song.is-deleting');
  assert.equal(item.querySelector('.delete-question').textContent, 'Delete Second <2>?');
  const [confirm, cancel] = item.querySelectorAll('button');
  assert.equal(confirm.dataset.action, 'confirm-delete');
  assert.equal(confirm.dataset.id, 'id-1');
  assert.equal(confirm.textContent, 'Delete');
  assert.equal(cancel.dataset.action, 'cancel-delete');
  assert.equal(document.querySelectorAll('.is-deleting').length, 1);
  assert.equal(document.querySelectorAll('[data-action="load-song"]').length, 1);
});

test('the songs panel shows no dialog of the browser', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['app.js', 'songs.js']) {
    const source = readFileSync(new URL(`../../../chordice/app/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\b(confirm|prompt|alert)\(/, file);
  }
});

test('a saved song with a key the page does not know is listed, without breaking the panel', () => {
  const state = withSongs(['Odd']);
  const odd = { ...state, songs: [{ ...state.songs[0], recipe: { ...state.songs[0].recipe, key: '<b>' } }] };
  const html = renderSongs(odd);
  assert.ok(html.includes('<span class="saved-song-name">Odd</span>'));
  assert.ok(html.includes('Unknown key'));
  assert.ok(!html.includes('<b>'));
});

const ADA = { name: 'Ada <L>', email: 'ada@example.org' };

test('the songs panel has no account section, with an account or without one (it is in the account panel)', () => {
  for (const account of [undefined, null, { person: null, loading: false }, { person: ADA, loading: false }]) {
    const document = dom(renderSongs(withSongs(['Song']), '', { deletingAccount: true }, account));
    assert.equal(document.querySelector('.account'), null);
    assert.equal(document.querySelector('[data-action="sign-in"]'), null);
  }
});

test('while the songs of the account load, the panel says so and the Save button is greyed out', () => {
  const document = dom(renderSongs(withSongs(['Old']), '', {}, { person: ADA, loading: true }));
  assert.match(document.querySelector('.songs-empty').textContent, /Loading the songs of your account/);
  assert.equal(document.querySelector('.saved-songs'), null);
  assert.equal(document.querySelector('.save-song-button').disabled, true);
  const loaded = dom(renderSongs(withSongs([]), '', {}, { person: ADA, loading: false }));
  assert.equal(loaded.querySelector('.save-song-button').disabled, false);
});

test('once the songs are full, the Save button is greyed out and a note says why', () => {
  const full = withSongs(Array.from({ length: SONG_LIMIT }, (_, index) => `Song ${index}`));
  assert.equal(full.songs.length, SONG_LIMIT);
  const document = dom(renderSongs(full));
  assert.equal(document.querySelector('.save-song-button').disabled, true);
  assert.equal(document.querySelector('.songs-full').textContent, `At most ${SONG_LIMIT} songs can be saved. Delete one to save another.`);
  const room = dom(renderSongs({ ...full, songs: full.songs.slice(1) }));
  assert.equal(room.querySelector('.save-song-button').disabled, false);
  assert.equal(room.querySelector('.songs-full'), null);
});

test('a short note stands under the Save button, and under the saved songs while there are any', () => {
  const empty = dom(renderSongs(withSongs([])));
  const notes = () => [...empty.querySelectorAll('.songs-hint')];
  assert.deepEqual(notes().map((note) => note.textContent), ['Saves the song shown.']);
  assert.equal(notes()[0].previousElementSibling.dataset.form, 'save-song');
  const full = dom(renderSongs(withSongs(['Song'])));
  const [, list] = full.querySelectorAll('.songs-hint');
  assert.equal(list.textContent, 'Click a song to load it with its options.');
  assert.ok(list.previousElementSibling.classList.contains('saved-songs'));
});
