import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCss } from '../../helpers/stylesheets.js';

const CSS = readCss('account.css');

function block(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
}

test('the cards of the account panel are paper cards like the saved songs, with the accent border while they ask', () => {
  const card = block('.account');
  assert.match(card, /background: var\(--card\)/);
  assert.match(card, /box-shadow: var\(--shadow\)/);
  assert.match(card, /border-radius: 16px 12px 18px 13px \/ 13px 17px 12px 16px/);
  assert.match(block('.account.is-deleting,\n.account.is-resetting'), /border-color: var\(--accent\)/);
  // The buttons wrap on a narrow panel, and a long email address breaks rather than widening the panel.
  assert.match(block('.account-buttons'), /flex-wrap: wrap/);
  assert.match(block('.account-text'), /overflow-wrap: anywhere/);
  assert.match(block('.account-sign-in svg'), /width: 1\.2rem/);
});

test('the Sign in with Google button stands on the left, and the note under it is smaller and paler', () => {
  const button = block('.account-sign-in');
  assert.match(button, /display: flex/);
  assert.match(button, /width: fit-content/);
  assert.match(button, /margin: 0\.2rem 0 0\.6rem/, 'on the left, not in the middle');
  assert.doesNotMatch(button, /\bauto\b/);
  const hint = block('.account-hint');
  assert.match(hint, /font-size: 0\.85rem/);
  assert.match(hint, /color: var\(--muted\)/);
  // It comes after the text of the card, so that its size and colour win.
  assert.ok(CSS.indexOf('\n.account-hint {') > CSS.indexOf('\n.account-text {'));
});

test('the songs panel keeps no style of the account panel', () => {
  assert.doesNotMatch(readCss('songs.css'), /\.account/);
});

test('a note under a row of buttons keeps the gap of the note under Sign in with Google', () => {
  assert.match(block('.account-buttons + .account-hint'), /margin-top: 0\.6rem/);
});
