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

test('unselected keys of the circle of fifths are quiet wedges and turn medium blue under the mouse', () => {
  assert.ok(declarationsOf('.circle .key path.major').includes('fill: var(--wedge-major)'));
  assert.ok(declarationsOf('.circle .key path.minor').includes('fill: var(--wedge-minor)'));
  const rule = /\.circle \.key:not\(\.is-on, \.is-subdominant, \.is-dominant\):hover path \{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'hover rule for unselected keys');
  assert.ok(rule[1].includes('var(--hover-fill)'));
});

test('a disabled circle of fifths is greyed out and its keys show no pointer', () => {
  assert.ok(declarationsOf('.circle.is-disabled').includes('opacity: var(--faded)'));
  const keys = /\.circle\.is-disabled \.key,\s*\.circle\.is-disabled \.key path \{([^}]*)\}/.exec(CSS);
  assert.ok(keys, 'rule for the disabled keys and their wedges');
  assert.ok(keys[1].includes('cursor: default'));
  // A click must not reach the key, or it would be focused and framed while the mouse is down.
  assert.ok(keys[1].includes('pointer-events: none'));
  assert.ok(keys[1].includes('outline: none'));
  assert.ok(keys[1].includes('-webkit-tap-highlight-color: transparent'));
});

test('the selected key and its neighbours take the major colour outside and the minor colour inside', () => {
  for (const [state, role] of [['is-on', 'tonic'], ['is-subdominant', 'subdominant'], ['is-dominant', 'dominant']]) {
    assert.ok(declarationsOf(`.circle .key.${state} path.major`).includes(`fill: var(--${role}-major)`), state);
    assert.ok(declarationsOf(`.circle .key.${state} path.minor`).includes(`fill: var(--${role}-minor)`), state);
  }
});

test('under the mouse, the selected key, the subdominant and the dominant turn stronger in their own colour', () => {
  const hover = /@media \(hover: hover\)\s*\{([\s\S]*)\}\s*$/.exec(CSS)?.[1] ?? '';
  for (const [state, role] of [['on', 'tonic'], ['subdominant', 'subdominant'], ['dominant', 'dominant']]) {
    for (const band of ['major', 'minor']) {
      const rule = new RegExp(`\\.circle \\.key\\.is-${state}:hover path\\.${band} \\{([^}]*)\\}`).exec(hover);
      assert.ok(rule, `hover rule for the ${band} band of the ${role}`);
      assert.match(rule[1], new RegExp(`fill: color-mix\\(in srgb, var\\(--${role}-${band}\\) \\d+%, var\\(--text\\)\\)`));
    }
  }
});
