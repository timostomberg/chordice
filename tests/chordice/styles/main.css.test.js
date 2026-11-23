import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  APP_STYLESHEETS,
  HELP_STYLESHEETS,
  allCss,
  declarationsOf as declarationsIn,
  declaredProperties,
  literalClassNames,
  readCss,
  sourceFiles,
  themeBlock as themeBlockIn,
} from '../../helpers/stylesheets.js';

// These tests check the structure of main.css (variables, classes, rules), not its concrete values, so that design changes
// do not need test changes. Tests that span several stylesheets read all of them, in the order the pages link them (ALL).

const CSS = readCss('main.css');
const ALL = allCss();
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const themeBlock = (selector) => themeBlockIn(CSS, selector);
// The tone colours sit in a rule of their own, shared by :root and the staff of the notes window.
const TONE_BLOCK = ':root,\\s*\\.notes-staff';
/** The variables of the light theme: those of :root and the tone colours. */
const lightProperties = () => [...declaredProperties(themeBlock(':root')), ...declaredProperties(themeBlock(TONE_BLOCK))];

test('every stylesheet has balanced braces', () => {
  for (const url of [...APP_STYLESHEETS, ...HELP_STYLESHEETS]) {
    const css = readFileSync(url, 'utf8');
    const opening = css.split('{').length - 1;
    assert.equal(opening, css.split('}').length - 1, url.pathname);
    assert.ok(opening > 0, url.pathname);
  }
});

test('every var() used in the stylesheets is defined in :root of main.css', () => {
  const defined = new Set(lightProperties());
  const used = [...ALL.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);
  assert.ok(used.length > 0);
  for (const name of used) {
    assert.ok(defined.has(name), name);
  }
});

test('every custom property is defined in main.css and used by a var() in one of the stylesheets', () => {
  const elsewhere = [...ALL.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]).filter((name) => !CSS.includes(`${name}:`));
  assert.deepEqual(elsewhere, []);
  const defined = new Set([...CSS.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
  const used = new Set([...ALL.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]));
  assert.ok(defined.size > 0);
  const unused = [...defined].filter((name) => !used.has(name));
  assert.deepEqual(unused, []);
});

test('the dark theme redefines every colour variable of the light theme', () => {
  const light = lightProperties().filter((name) => !['--touch', '--faded'].includes(name)).sort();
  const dark = declaredProperties(themeBlock(':root\\[data-theme="dark"\\]')).sort();
  assert.ok(light.length > 0);
  assert.deepEqual(dark, light);
});

test('every class used in the markup and scripts has a style rule', () => {
  const classes = literalClassNames();
  assert.ok(classes.includes('chip'));
  // Plain wrappers that need no styling of their own.
  const UNSTYLED_WRAPPERS = ['song-rows'];
  const unstyled = classes.filter((name) => !ALL.includes(`.${name}`) && !UNSTYLED_WRAPPERS.includes(name));
  assert.deepEqual(unstyled, []);
});

test('every class in the stylesheets is used by the markup or scripts', () => {
  const sources = sourceFiles().join('\n');
  // Classes built at runtime, e.g. fn-${function} or is-${role}, are found by their parts: fn-tonic by "tonic".
  const isUsed = (name) => sources.includes(name) || name.split('-').every((part) => new RegExp(`\\b${part}\\b`).test(sources));
  const selectorClasses = new Set([...ALL.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]));
  const unused = [...selectorClasses].filter((name) => !isUsed(name));
  assert.deepEqual(unused, []);
});

test('touch targets use the shared minimum size', () => {
  assert.ok(CSS.includes('min-height: var(--touch)'));
  assert.ok(CSS.includes('--touch:'));
});

test('the toolbar, the floating Generate button and the body keep clear of the iPhone safe areas', () => {
  assert.ok(/\.toolbar\s*\{[^}]*env\(safe-area-inset-top\)/.test(ALL));
  assert.ok(/body\s*\{[^}]*env\(safe-area-inset-bottom\)/.test(CSS));
  assert.ok(/body\s*\{[^}]*env\(safe-area-inset-left\)/.test(CSS));
  assert.ok(/\.generate\s*\{[^}]*env\(safe-area-inset-bottom\)/.test(CSS));
});

test('a pinch on the options and on the chords zooms that area, not the page', () => {
  assert.ok(/\.side-panel\s*\{[^}]*touch-action: pan-x pan-y/.test(CSS));
  assert.ok(/\.song\s*\{[^}]*touch-action: pan-x pan-y/.test(CSS));
});

test('phones in portrait stack the options above the chords', () => {
  const media = /@media \(max-width: 600px\) \{([\s\S]*)\}\s*$/.exec(CSS)?.[1] ?? '';
  assert.ok(media.includes('.layout'), 'media query styles the layout');
  assert.ok(/grid-template-columns: minmax\(0, 1fr\)/.test(media));
  assert.ok(/grid-template-rows: minmax\(0, 40%\) minmax\(0, 1fr\)/.test(media));
});

test('hiding the options hides the whole side panel', () => {
  assert.ok(/\.side-panel\[hidden\]\s*\{[^}]*display: none/.test(CSS));
});

test('the options panel and the chords scroll on their own', () => {
  assert.ok(/\.side-panel\s*\{[^}]*overflow-y: auto/.test(CSS));
  assert.ok(/\.song\s*\{[^}]*overflow-y: auto/.test(CSS));
});

test('the chord block is centred vertically and horizontally in the song area', () => {
  assert.ok(/\.song\s*\{[^}]*display: flex/.test(CSS));
  assert.ok(/\.song\s*\{[^}]*flex-direction: column/.test(CSS));
  assert.ok(/\.song-rows\s*\{[^}]*margin: auto/.test(CSS));
});

test('the grey text of a disabled button is defined in both themes, and differs from the text colour of the dark theme', () => {
  const light = themeBlock(':root');
  const dark = themeBlock(':root\\[data-theme="dark"\\]');
  for (const block of [light, dark]) {
    assert.match(block, /--disabled-text:\s*#[0-9a-fA-F]{6}/);
  }
  const darkMuted = /--muted:\s*(#\w+)/.exec(dark)[1];
  const darkDisabled = /--disabled-text:\s*(#\w+)/.exec(dark)[1];
  assert.notEqual(darkDisabled, darkMuted);
});

test('a button under the mouse turns medium blue, but only for real pointers, active buttons included', () => {
  const hover = /@media \(hover: hover\)\s*\{[\s\S]*?button\[type="button"\]:not\(([^)]*)\):hover\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(hover, 'button hover rule inside a (hover: hover) media query');
  // Disabled buttons and the section headings are excluded here; active buttons are not, so they turn medium blue too.
  assert.ok(hover[1].includes(':disabled'));
  assert.ok(hover[1].includes('.section-toggle'));
  assert.ok(!hover[1].includes('.is-on'));
  assert.ok(hover[2].includes('var(--hover-fill)'));
});

// The staff of the notes window is white paper in both themes, so its notes keep the light tone colours; staff.js reads
// them from the stylesheet. They are written once, in the rule that :root and the staff share.
test('the tone colours are defined once, for :root and the staff, which keeps them in the dark theme', () => {
  assert.deepEqual(declaredProperties(themeBlock(TONE_BLOCK)).sort(), ['--foreign-tone', '--variation-tone']);
  const dom = new JSDOM(`<!DOCTYPE html><html data-theme="dark"><head><style>${CSS}</style></head>` +
    '<body><div class="notes-staff" id="staff"></div><span id="page"></span></body></html>');
  const { document, getComputedStyle } = dom.window;
  const colour = (id, property) => getComputedStyle(document.getElementById(id)).getPropertyValue(property).trim();
  const light = Object.fromEntries(['--foreign-tone', '--variation-tone']
    .map((property) => [property, new RegExp(`${property}:\\s*(#[0-9a-fA-F]{6})`).exec(themeBlock(TONE_BLOCK))[1]]));
  for (const [property, value] of Object.entries(light)) {
    assert.equal(colour('staff', property), value, `the staff keeps the light ${property}`);
    assert.notEqual(colour('page', property), value, `the page takes the dark ${property}`);
  }
});
