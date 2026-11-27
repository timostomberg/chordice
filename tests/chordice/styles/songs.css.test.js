import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCss } from '../../helpers/stylesheets.js';

const CSS = readCss('songs.css');

function block(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
}

test('the name field is large enough that Safari on the iPhone does not zoom in, and has the touch height', () => {
  const field = block('.song-name');
  assert.match(field, /font-size: max\(1rem, 16px\)/);
  assert.match(field, /min-height: var\(--touch\)/);
});

test('the saved songs and the frozen note are paper cards like the options sections', () => {
  for (const selector of ['.saved-song', '.frozen-note']) {
    const card = block(selector);
    assert.match(card, /background: var\(--card\)/, selector);
    assert.match(card, /box-shadow: var\(--shadow\)/, selector);
    assert.match(card, /border-radius: 16px 12px 18px 13px \/ 13px 17px 12px 16px/, selector);
  }
  assert.match(block('.frozen-note'), /border: 1px solid var\(--accent\)/);
  assert.match(block('.saved-song.is-shown'), /border-color: var\(--accent\)/);
});

test('the name of a saved song is a heading of its card, not a painted button, and a long name is cut', () => {
  const load = block('.saved-song-load');
  assert.match(load, /background: transparent/);
  assert.match(load, /box-shadow: none/);
  assert.match(load, /min-height: var\(--touch\)/);
  assert.match(block('.saved-song-load::before'), /content: none/);
  assert.match(block('.saved-song-name'), /text-overflow: ellipsis/);
});

test('songs.css uses only the colours of the themes', () => {
  assert.doesNotMatch(CSS.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,6}\b|rgba?\(/i);
});

test('the rename and delete buttons keep their size beside the name, and the pencil is as large as the cross', () => {
  assert.match(block('.saved-song-rename,\n.saved-song-delete'), /flex: none/);
  assert.match(block('.saved-song-rename svg'), /width: 1\.1rem/);
});

test('the field of a song that is being renamed and its buttons share the row of the card', () => {
  const form = block('.rename-song');
  assert.match(form, /display: flex/);
  assert.match(form, /flex: 1/);
});

test('the floppy disk of the Save button has the size of the header symbols', () => {
  assert.match(block('.save-song-button svg'), /width: 1\.5rem/);
});

test('the question before deleting takes the place of the name, and a long name wraps', () => {
  const question = block('.delete-question');
  assert.match(question, /flex: 1/);
  assert.match(question, /overflow-wrap: anywhere/);
  assert.match(block('.saved-song.is-deleting'), /min-height: var\(--touch\)/);
});


test('the notes of the songs panel are small and pale, like the note under Sign in with Google', () => {
  const hint = block('.songs-hint');
  assert.match(hint, /font-size: 0\.85rem/);
  assert.match(hint, /color: var\(--muted\)/);
  assert.match(block('.save-song + .songs-hint'), /margin-top: -0\.6rem/);
});
