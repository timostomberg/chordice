import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateHeader } from '../../../chordice/js/header/header.js';
import { buildLibrary } from '../../../chordice/js/data/validate.js';
import { defaultState } from '../../../chordice/js/core/state.js';

const LIBRARY = buildLibrary({
  Pop: { progressions: { 'Pop Progression': ['I', 'V'] } },
});

/** A header element as the page has it: attributes and a disabled flag, with the data attributes of its markup. */
function element(dataset = {}) {
  return { dataset, attributes: {}, disabled: false, setAttribute(name, value) { this.attributes[name] = value; } };
}

/** The header of the page: the view switches, the instrument tabs, the options button and the dark mode switch. */
function headerPage() {
  const flags = ['roman', 'tones', 'inversions', 'colour'].map((flag) => element({ flag }));
  const tabs = ['piano', 'guitar'].map((instrument) => element({ instrument }));
  const elements = { '.options-toggle': element(), '[data-action="toggle-theme"]': element() };
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

test('exactly the tab of the chosen instrument is pressed', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), instrument: 'guitar' }, page);
  assert.equal(page.tabs[0].attributes['aria-pressed'], 'false');
  assert.equal(page.tabs[1].attributes['aria-pressed'], 'true');
});

test('the options button shows whether the options are open', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), showOptions: true }, page);
  assert.equal(page.elements['.options-toggle'].attributes['aria-expanded'], 'true');
  updateHeader({ ...defaultState(LIBRARY), showOptions: false }, page);
  assert.equal(page.elements['.options-toggle'].attributes['aria-expanded'], 'false');
});

test('the dark mode switch is pressed in the dark theme only', () => {
  const page = headerPage();
  updateHeader({ ...defaultState(LIBRARY), theme: 'dark' }, page);
  assert.equal(page.elements['[data-action="toggle-theme"]'].attributes['aria-pressed'], 'true');
  updateHeader({ ...defaultState(LIBRARY), theme: 'light' }, page);
  assert.equal(page.elements['[data-action="toggle-theme"]'].attributes['aria-pressed'], 'false');
});
