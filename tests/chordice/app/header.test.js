import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateHeader } from '../../../chordice/app/header.js';
import { buildLibrary } from '../../../chordice/music/data/validate.js';
import { defaultState } from '../../../chordice/app/state/state.js';

const LIBRARY = buildLibrary({
  Pop: { progressions: { 'Pop Progression': ['I', 'V'] } },
});

/** A header element as the page has it: attributes and a disabled flag, with the data attributes of its markup. */
function element(dataset = {}) {
  return { dataset, attributes: {}, disabled: false, setAttribute(name, value) { this.attributes[name] = value; } };
}

/**
 * The header of the page: the view switches, the instrument tabs, the options, exercises, songs, account and help buttons
 * and the dark mode switch.
 */
function headerPage() {
  const flags = ['roman', 'tones', 'inversions', 'colour'].map((flag) => element({ flag }));
  const tabs = ['piano', 'guitar'].map((instrument) => element({ instrument }));
  const elements = { '.options-toggle': element(), '.exercises-toggle': element(), '.songs-toggle': element(), '.account-toggle': element(), '.help-toggle': element(), '[data-action="toggle-theme"]': element() };
  return {
    flags,
    tabs,
    elements,
    querySelectorAll(selector) {
      if (selector === '[data-flag]') {
        return flags;
      }
      return selector === '[data-instrument]' ? tabs : [];
    },
    querySelector(selector) {
      return elements[selector];
    },
  };
}

test('the view switches show their stored flags as pressed', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), roman: false, colour: true }, page);
  const pressed = Object.fromEntries(page.flags.map((flag) => [flag.dataset.flag, flag.attributes['aria-pressed']]));
  assert.equal(pressed.roman, 'false');
  assert.equal(pressed.colour, 'true');
});

test('on the piano every view switch is enabled', () => {
  const page = headerPage();
  updateHeader(defaultState(LIBRARY), page);
  assert.ok(page.flags.every((flag) => flag.disabled === false));
});

test('on the guitar the switches the instrument does not use are greyed out, and keep their stored pressed state', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), instrument: 'guitar', inversions: true }, page);
  const inversions = page.flags.find((flag) => flag.dataset.flag === 'inversions');
  assert.equal(inversions.disabled, true);
  assert.equal(inversions.attributes['aria-pressed'], 'true');
  assert.equal(page.flags.find((flag) => flag.dataset.flag === 'roman').disabled, false);
});

test('on the guitar the chord tones switch cannot be clicked, and keeps its stored pressed state', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), instrument: 'guitar', tones: true }, page);
  const tones = page.flags.find((flag) => flag.dataset.flag === 'tones');
  assert.equal(tones.disabled, true);
  assert.equal(tones.attributes['aria-pressed'], 'true');
  updateHeader({ ...defaultState(LIBRARY), instrument: 'piano', tones: true }, page);
  assert.equal(tones.disabled, false);
});

test('exactly the tab of the chosen instrument is pressed', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), instrument: 'guitar' }, page);
  assert.equal(page.tabs[0].attributes['aria-pressed'], 'false');
  assert.equal(page.tabs[1].attributes['aria-pressed'], 'true');
});

test('the options, exercises and help buttons are one switch: the button of the panel shown is pressed, none while it is closed', () => {
  const page = headerPage();
  const pressed = () => ['.options-toggle', '.exercises-toggle', '.help-toggle'].map((selector) => page.elements[selector].attributes['aria-expanded']);
  updateHeader({ ...defaultState(LIBRARY), showOptions: true, panel: 'options' }, page);
  assert.deepEqual(pressed(), ['true', 'false', 'false']);
  updateHeader({ ...defaultState(LIBRARY), showOptions: true, panel: 'exercises' }, page);
  assert.deepEqual(pressed(), ['false', 'true', 'false']);
  updateHeader({ ...defaultState(LIBRARY), showOptions: true, panel: 'help' }, page);
  assert.deepEqual(pressed(), ['false', 'false', 'true']);
  updateHeader({ ...defaultState(LIBRARY), showOptions: false, panel: 'help' }, page);
  assert.deepEqual(pressed(), ['false', 'false', 'false']);
});

test('the dark mode switch is pressed in the dark theme only', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), theme: 'dark' }, page);
  assert.equal(page.elements['[data-action="toggle-theme"]'].attributes['aria-pressed'], 'true');
  updateHeader({ ...defaultState(LIBRARY), theme: 'light' }, page);
  assert.equal(page.elements['[data-action="toggle-theme"]'].attributes['aria-pressed'], 'false');
});

test('the header shows the circle of fifths switch pressed and disabled while the exercise switches it on', () => {
  const circle = element({ flag: 'circleOfFifths' });
  const melody = element({ flag: 'inversions' });
  const page = {
    querySelectorAll: (selector) => (selector === '[data-flag]' ? [circle, melody] : []),
    querySelector: () => element(),
  };
  updateHeader({ ...defaultState(LIBRARY, () => 0.5), inversions: true, exercise: 'circle-ii-v-i' }, page);
  assert.equal(circle.attributes['aria-pressed'], 'true');
  assert.equal(circle.disabled, true);
  assert.equal(melody.attributes['aria-pressed'], 'true');
  assert.equal(melody.disabled, false);
});

test('the exercises button is highlighted while an exercise is on, whichever panel is shown', () => {
  const page = headerPage();
  const highlighted = () => page.elements['.exercises-toggle'].attributes['data-exercise-active'];
  updateHeader({ ...defaultState(LIBRARY), exercise: 'circle-ii-v-i', showOptions: true, panel: 'options' }, page);
  assert.equal(highlighted(), 'true');
  updateHeader({ ...defaultState(LIBRARY), exercise: 'circle-ii-v-i', showOptions: false }, page);
  assert.equal(highlighted(), 'true');
  updateHeader({ ...defaultState(LIBRARY), exercise: null }, page);
  assert.equal(highlighted(), 'false');
});

test('the header style fills the exercises button while an exercise is on, like a pressed switch', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../../../chordice/styles/header.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.toolbar .exercises-toggle[data-exercise-active="true"]'));
});

test('the highlighted exercises button is painted like every other filled toolbar button: darker bloom and accent border', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../../../chordice/styles/main.css', import.meta.url), 'utf8');
  assert.ok(/\.toolbar button\[aria-expanded="true"\]::before,\s*\.toolbar button\[data-exercise-active="true"\]::before \{/.test(css));
  assert.ok(/button\[aria-expanded="true"\],\s*button\[data-exercise-active="true"\] \{\s*border-color: var\(--accent\);/.test(css));
});

test('the songs button is pressed while the side panel shows the saved songs', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), showOptions: true, panel: 'songs' }, page);
  assert.equal(page.elements['.songs-toggle'].attributes['aria-expanded'], 'true');
  assert.equal(page.elements['.options-toggle'].attributes['aria-expanded'], 'false');
});

test('the account button is pressed while the side panel shows the account panel', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), showOptions: true, panel: 'account' }, page);
  assert.equal(page.elements['.account-toggle'].attributes['aria-expanded'], 'true');
  assert.equal(page.elements['.songs-toggle'].attributes['aria-expanded'], 'false');
  updateHeader({ ...defaultState(LIBRARY), showOptions: false, panel: 'account' }, page);
  assert.equal(page.elements['.account-toggle'].attributes['aria-expanded'], 'false');
});
