import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { keepFocus } from '../../../../chordice/app/options/focus.js';
import { renderOptions } from '../../../../chordice/app/options/options.js';
import { renderKeyCircle } from '../../../../chordice/app/options/circle-of-fifths.js';
import { buildLibrary } from '../../../../chordice/music/data/validate.js';
import { defaultState } from '../../../../chordice/app/state/state.js';
import { applyAction } from '../../../../chordice/app/state/actions.js';

const LIBRARY = buildLibrary({
  Pop: { progressions: { 'Pop Progression': ['I', 'V', 'vi', 'IV'] } },
  Jazz: { progressions: { 'Jazz Cadence': ['ii', 'V', 'I'] } },
});

/** A page with the option list, rendered for `state`, and a button outside it. */
function page(state) {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="option-list"></div><button id="outside">x</button></body>');
  const { document } = dom.window;
  const list = document.getElementById('option-list');
  list.innerHTML = renderOptions(state, LIBRARY);
  return { document, list };
}

/** Renders the next state into the list as app.js does, keeping the focus. */
function rerender(list, state) {
  keepFocus(list, () => {
    list.innerHTML = renderOptions(state, LIBRARY);
  });
}

test('after a re-render the focus is on the new element of the control that had it', () => {
  const state = {
    ...defaultState(LIBRARY, () => 0.5),
    selection: LIBRARY.map((progression) => progression.id),
    collapsed: ['progressionVariations', 'variations', 'bass', 'melody', 'exercises'],
  };
  const { document, list } = page(state);
  const chip = list.querySelector('[data-action="toggle-progression"][data-id="Jazz / Jazz Cadence"]');
  chip.focus();
  rerender(list, applyAction(state, 'toggle-progression', { id: 'Jazz / Jazz Cadence' }, LIBRARY));
  assert.ok(!list.contains(chip), 'the old chip is replaced');
  assert.equal(document.activeElement.dataset.action, 'toggle-progression');
  assert.equal(document.activeElement.dataset.id, 'Jazz / Jazz Cadence');
  assert.equal(document.activeElement.getAttribute('aria-pressed'), 'false', 'the new chip shows the new state');
});

test('the focus follows a section toggle and a slider, which are named by their section and option', () => {
  const state = defaultState(LIBRARY, () => 0.5);
  const { document, list } = page(state);
  list.querySelector('[data-section="bass"]').focus();
  const opened = applyAction(state, 'toggle-section', { section: 'bass' }, LIBRARY);
  rerender(list, opened);
  assert.equal(document.activeElement.dataset.section, 'bass');

  list.querySelector('[data-option="bassProbability"]').focus();
  rerender(list, applyAction(opened, 'set-probability', { option: 'bassProbability', value: '4' }, LIBRARY));
  assert.equal(document.activeElement.dataset.option, 'bassProbability');
  assert.equal(document.activeElement.value, '4');
});

test('nothing is focused when the focus was outside the list, or the control is gone', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: [] };
  const { document, list } = page(state);
  const outside = document.getElementById('outside');
  outside.focus();
  rerender(list, state);
  assert.equal(document.activeElement, outside, 'a focus outside the list stays where it is');

  // A progression chip is focused; collapsing Progressions means the chip is not drawn any more.
  list.querySelector('[data-action="toggle-progression"][data-id="Jazz / Jazz Cadence"]').focus();
  rerender(list, applyAction(state, 'toggle-section', { section: 'progressions' }, LIBRARY));
  assert.equal(list.querySelector('[data-id="Jazz / Jazz Cadence"]'), null);
  assert.ok(!list.contains(document.activeElement));
});

test('after a key of the circle of fifths is chosen, the focus stays on that key, so the keyboard keeps its place', () => {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="song-circle"></div></body>');
  const { document } = dom.window;
  const circle = document.getElementById('song-circle');
  const state = defaultState(LIBRARY, () => 0.5);
  circle.innerHTML = renderKeyCircle(state);
  const key = circle.querySelector('[data-action="set-key"][data-key="G"]');
  key.focus();
  assert.equal(document.activeElement, key, 'a key with a tabindex can be focused');
  const next = applyAction(state, 'set-key', { key: 'G' }, LIBRARY);
  keepFocus(circle, () => {
    circle.innerHTML = renderKeyCircle(next);
  });
  assert.ok(!circle.contains(key), 'the old key is replaced');
  assert.equal(document.activeElement.dataset.key, 'G');
  assert.equal(document.activeElement.getAttribute('aria-pressed'), 'true', 'the new key shows that it is chosen');
});
