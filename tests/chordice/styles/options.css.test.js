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

test('a disabled chip that is pressed or filled (the count of 12) is filled grey, not blue', () => {
  const rule = /\.options \.chip\.is-on:disabled,\s*\.options \.chip\.count-toggle:disabled \{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'rule for disabled filled chips');
  assert.ok(rule[1].includes('background: var(--disabled-text)'));
  assert.ok(rule[1].includes('border-color: var(--disabled-text)'));
  // It comes after the blue fill of the count button and the pressed chips, so it wins over them.
  assert.ok(CSS.indexOf('.options .chip.is-on:disabled') > CSS.indexOf('.chip.count-toggle {'));
  assert.ok(CSS.indexOf('.options .chip.is-on:disabled') > CSS.indexOf('.options .chip.is-on {'));
});

test('a greyed-out option fades its heading and content, but not a clickable button beside its heading', () => {
  // The melody button beside a greyed-out Melody variations heading keeps the normal blue outline while it can be pressed.
  assert.equal(declarationsOf('.option.is-unavailable'), '');
  const faded = declarationsOf('.option.is-unavailable .section-toggle,\n.option.is-unavailable > :not(h2),\n.option.is-unavailable .chip:disabled:not(.is-on, .count-toggle)');
  assert.ok(faded.includes('opacity: var(--faded)'));
});

test('a filled disabled button beside a greyed-out heading, such as the count of 12, is not faded, so its label stays readable', () => {
  assert.ok(CSS.includes('.option.is-unavailable .chip:disabled:not(.is-on, .count-toggle) {'));
  assert.ok(!/\.option\.is-unavailable \.chip:disabled\s*[,{]/.test(CSS));
  const filled = declarationsOf('.options .chip.is-on:disabled,\n.options .chip.count-toggle:disabled');
  assert.ok(filled.includes('background: var(--disabled-text)'));
  assert.ok(filled.includes('color: var(--surface)'));
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
