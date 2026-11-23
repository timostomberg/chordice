import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allCss,
  declarationsOf as declarationsIn,
  readCss,
  themeBlock as themeBlockIn,
} from '../../helpers/stylesheets.js';

// These tests check the structure of notes.css (variables, classes, rules), not its concrete values, so that design changes
// do not need test changes. Tests that span several stylesheets read all of them, in the order the pages link them (ALL).

const CSS = readCss('notes.css');
const ALL = allCss();
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const themeBlock = (selector) => themeBlockIn(CSS, selector);

test('the notes window does not override the font of the music symbols in its SVG text', () => {
  assert.ok(!/\.notes-staff svg text/.test(CSS));
});

test('nothing in the notes window can be selected, since its clicks step through the views', () => {
  const block = declarationsOf('.notes');
  assert.ok(block.includes('user-select: none'));
  assert.ok(block.includes('-webkit-user-select: none'));
});

// The window must keep its size when a click shows another guitar shape, so the diagram's box has a fixed height, and the
// diagram fills the box instead of taking its own height from its frets.
test('the guitar diagram sits in a box of fixed height, and fills it, so the window does not change size between shapes', () => {
  assert.match(declarationsOf('.notes-staff.is-guitar'), /height:\s*min\(\s*240px\s*,\s*40vh\s*\)/);
  assert.ok(declarationsOf('.notes-staff.is-guitar svg').includes('height: 100%'));
});

// The notes staff must not force a fill or stroke on its drawing: VexFlow sets the colour of each note as an attribute,
// and a stylesheet rule would override it, so coloured tones would stay black.
test('the notes staff does not override the colours VexFlow gives its notes', () => {
  const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const forcing = rules.filter(([, selector, body]) => /notes-staff/.test(selector) && /\b(fill|stroke)\s*:/.test(body));
  assert.deepEqual(forcing.map(([, selector]) => selector.trim()), []);
});
