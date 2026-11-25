import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allCss,
  declarationsOf as declarationsIn,
  readCss,
  themeBlock as themeBlockIn,
} from '../../helpers/stylesheets.js';

// These tests check the structure of header.css (variables, classes, rules), not its concrete values, so that design changes
// do not need test changes. Tests that span several stylesheets read all of them, in the order the pages link them (ALL).

const CSS = readCss('header.css');
const ALL = allCss();

test('the options and exercises buttons are one segmented switch, like the instrument tabs, the pressed one filled', () => {
  assert.ok(declarationsOf('.panel-tabs,\n.instrument-tabs').includes('display: flex'));
  assert.ok(declarationsOf('.panel-tabs .panel-tab:first-child,\n.instrument-tabs .instrument-tab:first-child').includes('border-radius'));
  assert.ok(declarationsOf('.panel-tabs .panel-tab:last-child,\n.instrument-tabs .instrument-tab:last-child').includes('margin-left: -1px'));
  assert.match(CSS, /\.toolbar \.exercises-toggle\[aria-expanded="true"\][^{]*\{[^}]*background: var\(--icon-blue\)/);
});

test('a gap separates the colour button from the music switches', () => {
  assert.match(CSS, /\.view-toggles \.colour-toggle \{[^}]*margin-left:/);
});
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const themeBlock = (selector) => themeBlockIn(CSS, selector);

test('an option the guitar does not use is greyed out, and so is its header switch while it is disabled', () => {
  // The greyed-out option is faded as a whole.
  assert.ok(declarationsIn(ALL, '.option.is-unavailable .section-toggle,\n.option.is-unavailable > :not(h2),\n.option.is-unavailable .chip:disabled:not(.is-on, .count-toggle)').includes('opacity'));
  const block = declarationsOf('.toolbar .instrument-tab:disabled');
  assert.ok(block.includes('background: none'));
  assert.ok(block.includes('color: var(--disabled-text)'));
});

test('a disabled header switch is faded by the same opacity as a greyed-out option', () => {
  assert.ok(declarationsOf('.toolbar .instrument-tab:disabled').includes('opacity: var(--faded)'));
  assert.ok(declarationsIn(ALL, '.option.is-unavailable .section-toggle,\n.option.is-unavailable > :not(h2),\n.option.is-unavailable .chip:disabled:not(.is-on, .count-toggle)').includes('opacity: var(--faded)'));
});

test('the instrument tabs turn medium blue on hover, the chosen one too, but not when disabled', () => {
  const rule = /\.toolbar \.instrument-tab:not\(:disabled\):hover\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'hover rule for the instrument tabs');
  assert.ok(rule[1].includes('var(--hover-fill)'));
});

test('a disabled header switch is not highlighted under the mouse', () => {
  assert.ok(!/\.toolbar \.instrument-tab:disabled:hover/.test(CSS));
  assert.ok(/button\[type="button"\]:not\(:disabled,/.test(ALL));
});

test('a button under the mouse gets a medium blue, mixed from the accent blue and the surface', () => {
  assert.ok(/--hover-fill:\s*color-mix\(in srgb, var\(--icon-blue\) \d+%, var\(--surface\)\)/.test(ALL));
});

// The colour, painting and dark mode switches on the right of the header stand at the same distance from each other: the
// gap of the toolbar, which the view switches share too.
test('the three switches on the right of the header are evenly spaced', () => {
  assert.ok(!/\.painting-toggle\s*\{[^}]*margin/.test(CSS), 'the painting switch has no margin of its own');
  assert.ok(!/\.theme-toggle\s*\{[^}]*margin/.test(CSS), 'nor has the dark mode switch');
  const toolbarGap = /\.toolbar\s*\{[^}]*gap:\s*([^;]+);/.exec(CSS)[1];
  const viewGap = /\.view-toggles\s*\{[^}]*gap:\s*([^;]+);/.exec(CSS)[1];
  assert.equal(viewGap, toolbarGap);
});

test('the buttons left and right of the title are two groups that wrap to the next row only as a whole', () => {
  const block = declarationsOf('.toolbar-start,\n.toolbar-end');
  assert.ok(block.includes('display: flex'));
  assert.ok(block.includes('flex-wrap: nowrap'));
  assert.ok(block.includes('flex: none'), 'a group does not shrink, so it wraps instead');
  const toolbarGap = /\.toolbar\s*\{[^}]*gap:\s*([^;]+);/.exec(CSS)[1];
  assert.ok(block.includes(`gap: ${toolbarGap}`), 'the buttons inside a group keep the gap of the toolbar');
  assert.ok(declarationsOf('.toolbar-end').includes('margin-left: auto'), 'the right group stays at the right edge');
});

test('the symbol of a header button sits in its middle, also when the minimum touch size widens the button', () => {
  const block = declarationsOf('.toolbar button');
  assert.ok(block.includes('display: inline-flex'));
  assert.ok(block.includes('align-items: center'));
  assert.ok(block.includes('justify-content: center'));
});

test('the dark mode switch looks active in the dark theme, like the other pressed switches, and inactive in the light theme', () => {
  assert.match(CSS, /\.toolbar \.theme-toggle\[aria-pressed="true"\][^{]*\{[^}]*background: var\(--icon-blue\)/);
  assert.ok(!/\.theme-toggle\[aria-pressed="false"\]/.test(CSS), 'unpressed, it keeps the plain look of an inactive switch');
});

test('in a low window (a phone held sideways) the header is thinner, and still keeps clear of the status bar', () => {
  const media = /@media \(max-height: (\d+)px\) \{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(media, 'a media query for low windows');
  assert.ok(Number(media[1]) >= 400);
  assert.ok(/\.toolbar\s*\{[^}]*padding-top: calc\([^;]*env\(safe-area-inset-top\)\)/.test(media[2]));
  assert.ok(/\.toolbar h1\s*\{[^}]*font-size/.test(media[2]));
  assert.ok(!media[2].includes('min-height'), 'the buttons keep their touch size');
});
