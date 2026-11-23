import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allCss,
  declarationsOf as declarationsIn,
  readCss,
  themeBlock as themeBlockIn,
} from '../../helpers/stylesheets.js';

// These tests check the structure of circle-of-fifths.css (variables, classes, rules), not its concrete values, so that design changes
// do not need test changes. Tests that span several stylesheets read all of them, in the order the pages link them (ALL).

const CSS = readCss('circle-of-fifths.css');
const ALL = allCss();
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const themeBlock = (selector) => themeBlockIn(CSS, selector);

test('the circle of fifths has a maximum size, so it stays moderate when the options are above the chords', () => {
  assert.ok(/\.circle\s*\{[^}]*max-width:/.test(CSS));
});

test('unselected keys of the circle of fifths hide the grey ring behind them and turn medium blue under the mouse', () => {
  // The key disc is the panel colour, so the ring does not show through the key.
  assert.ok(declarationsOf('.circle .key circle').includes('fill: var(--surface)'));
  const rule = /\.circle \.key:not\(\.is-on, \.is-subdominant, \.is-dominant\):hover circle \{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'hover rule for unselected keys');
  assert.ok(rule[1].includes('var(--hover-fill)'));
});

test('a disabled circle of fifths is greyed out and its keys show no pointer', () => {
  assert.ok(declarationsOf('.circle.is-disabled').includes('opacity: var(--faded)'));
  const keys = /\.circle\.is-disabled \.key,\s*\.circle\.is-disabled \.key circle \{([^}]*)\}/.exec(CSS);
  assert.ok(keys, 'rule for the disabled keys and their discs');
  assert.ok(keys[1].includes('cursor: default'));
  // A click must not reach the key, or it would be focused and framed while the mouse is down.
  assert.ok(keys[1].includes('pointer-events: none'));
  assert.ok(keys[1].includes('outline: none'));
  assert.ok(keys[1].includes('-webkit-tap-highlight-color: transparent'));
});
