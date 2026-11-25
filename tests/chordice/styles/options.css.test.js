import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allCss,
  declarationsOf as declarationsIn,
  readCss,
  themeBlock as themeBlockIn,
} from '../../helpers/stylesheets.js';

// These tests check the structure of options.css (variables, classes, rules), not its concrete values, so that design changes
// do not need test changes. Tests that span several stylesheets read all of them, in the order the pages link them (ALL).

const CSS = readCss('options.css');
const ALL = allCss();
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const themeBlock = (selector) => themeBlockIn(CSS, selector);

test('the count button is always filled in the accent blue, like an active chip', () => {
  const block = declarationsOf('.chip.count-toggle');
  assert.ok(block.includes('background: var(--icon-blue)'));
  assert.ok(block.includes('border-color: var(--icon-blue)'));
  assert.ok(block.includes('color: var(--surface)'));
});

test('the section headings (Keys, Progressions, ...) are not highlighted on hover, disabled or not', () => {
  assert.ok(!/\.option \.section-toggle:disabled:hover/.test(CSS));
  assert.ok(!/\.section-toggle:hover\s*\{/.test(CSS));
  // A disabled heading has no background and grey text.
  assert.ok(declarationsOf('.option .section-toggle:disabled').includes('background: none'));
  assert.ok(declarationsOf('.option .section-toggle:disabled').includes('color: var(--disabled-text)'));
});

test('the circle of fifths button shows its arrow as a block, at the size of the note of the melody button', () => {
  const size = (selector) => ['width', 'height'].map((property) => new RegExp(`${property}:\s*([^;]+);`).exec(declarationsOf(selector))?.[1]);
  for (const selector of ['.melody-toggle svg', '.circle-toggle svg']) {
    assert.ok(declarationsOf(selector).includes('display: block'), selector);
  }
  assert.ok(size('.melody-toggle svg').every(Boolean));
  assert.deepEqual(size('.circle-toggle svg'), size('.melody-toggle svg'));
});

test('a disabled chip keeps the blue of its state: no rule turns a pressed or filled disabled chip grey', () => {
  assert.ok(!CSS.includes('.chip.is-on:disabled'));
  assert.ok(!CSS.includes('.chip.count-toggle:disabled'));
  assert.ok(!/\.chip[^{]*:disabled[^{]*\{[^}]*--disabled-text/.test(CSS));
});

test('a greyed-out option fades its heading and content, but not a clickable button beside its heading', () => {
  // The melody button beside a greyed-out Melody variations heading keeps the normal blue outline while it can be pressed;
  // a disabled one is faded by the general rule for buttons.
  assert.equal(declarationsOf('.option.is-unavailable'), '');
  const faded = declarationsOf('.option.is-unavailable .section-toggle,\n.option.is-unavailable > :not(h2)');
  assert.ok(faded.includes('opacity: var(--faded)'));
  assert.ok(!/\.option\.is-unavailable \.chip/.test(CSS));
});

test('the track and the knob of the sliders carry the soft clouds of the washes', () => {
  for (const selector of [
    '.slider input::-webkit-slider-runnable-track',
    '.slider input::-webkit-slider-thumb',
    '.slider input::-moz-range-track',
    '.slider input::-moz-range-progress',
    '.slider input::-moz-range-thumb',
  ]) {
    assert.match(declarationsOf(selector), /background: var\(--mottle\), /, selector);
  }
});

test('the circle of fifths button beside the chords is filled blue when on, like the option chips, but has no blue outline when off', () => {
  assert.ok(/\.options \.chip\.is-on,\s*\.song-circle \.chip\.is-on \{[^}]*background: var\(--icon-blue\)/.test(CSS));
  assert.ok(/\.options \.chip \{[^}]*border-color: var\(--icon-blue\)/.test(CSS));
  assert.ok(!/\.song-circle \.chip \{/.test(CSS) && !/\.song-circle \.chip,/.test(CSS));
});
