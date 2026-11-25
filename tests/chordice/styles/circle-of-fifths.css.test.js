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

test('the circle of fifths fills its frame beside the chords, which sets its size', () => {
  assert.ok(declarationsOf('.circle').includes('width: 100%'));
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

test('the keys of the circle are washes of watercolour like the buttons, in the bloom and rim colours of the theme', () => {
  // The filter is set on each wedge by circle-of-fifths.js, one per copy of the circle; a rule here would override it.
  assert.ok(!declarationsOf('.circle .key path').includes('filter:'));
  assert.ok(declarationsOf('.circle .wash-bloom').includes('flood-color: var(--bloom)'));
  assert.ok(declarationsOf('.circle .wash-rim').includes('flood-color: var(--pigment-edge)'));
  assert.ok(declarationsOf('.circle .wash-clouds').includes('flood-color: var(--mottle-tint)'));
  // A thin line edges each key, like the border of a button.
  const key = declarationsOf('.circle .key path');
  assert.ok(key.includes('stroke: var(--line)'));
  assert.ok(key.includes('vector-effect: non-scaling-stroke'));
});

test('the circle beside the chords zooms with them, stays in view while the song scrolls, and moves above the chords where it is narrow', () => {
  const circle = declarationsOf('.song-circle');
  assert.ok(circle.includes('flex: 0 0 auto'));
  assert.ok(circle.includes('position: sticky'));
  const size = Number(/width: calc\(var\(--zoom\) \* ([\d.]+)rem\)/.exec(circle)?.[1]);
  assert.ok(size > 0);
  // Always in the vertical middle of the visible song area, not in the middle of the rows: as far from its top as from its
  // bottom (half the area less half the circle, which is as high as it is wide), while the rows scroll.
  assert.ok(circle.includes(`top: calc(50% - var(--zoom) * ${size / 2}rem)`));
  assert.ok(circle.includes(`bottom: calc(50% - var(--zoom) * ${size / 2}rem)`));
  const narrow = /@container \(max-width: [\d.]+rem\) \{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(narrow, 'a container query for a narrow song area');
  assert.match(narrow[1], /\.song-body \{[^}]*flex-direction: column/);
  assert.match(narrow[1], /\.song-circle \{[^}]*width: min\(calc\(var\(--zoom\) \* [\d.]+rem\), \d+%\)/);
});

test('the circle of fifths button is centred in the middle of the circle beside the chords, and round', () => {
  assert.ok(/position: (sticky|relative)/.test(declarationsOf('.song-circle')), 'the frame the button is placed in');
  const button = declarationsOf('.song-circle > .circle-toggle');
  assert.ok(button.includes('position: absolute'));
  assert.ok(button.includes('inset: 0'));
  assert.ok(button.includes('margin: auto'));
  // Not centred by a transform: a pressed button scales itself with one, which would move it out of the middle.
  assert.ok(!button.includes('transform'));
  assert.ok(button.includes('border-radius: 50%'));
  // The arrow sits in the middle of the button.
  assert.ok(button.includes('display: flex'));
  assert.ok(button.includes('align-items: center'));
  assert.ok(button.includes('justify-content: center'));
  assert.ok(button.includes('padding: 0'));
});

test('while it is off, the circle of fifths button looks like a key of the circle, not like the other buttons', () => {
  const off = declarationsOf('.song-circle > .circle-toggle:not(.is-on)');
  // The fill, the line and the label colour of a key (see .circle .key path and .circle .key text).
  assert.ok(declarationsOf('.circle .key path.major').includes('fill: var(--wedge-major)'));
  assert.ok(off.includes('background: var(--wedge-major)'));
  assert.ok(declarationsOf('.circle .key path').includes('stroke: var(--line)'));
  assert.ok(off.includes('border-color: var(--line)'));
  assert.ok(declarationsOf('.circle .key text').includes('fill: var(--muted)'));
  assert.ok(off.includes('color: var(--muted)'));
  assert.ok(off.includes('box-shadow: none'), 'flat like the keys');
});
