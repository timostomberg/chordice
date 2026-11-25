import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, reroll, SECTIONS } from '../../../../chordice/app/state/state.js';
import { applyAction } from '../../../../chordice/app/state/actions.js';
import { FIXED, LIBRARY as APP_LIBRARY, SMALL_LIBRARY } from '../../../helpers/fixtures.js';

const LIBRARY = SMALL_LIBRARY;

test('applyAction dispatches UI actions and ignores unknown ones', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(applyAction(state, 'set-key', { key: 'D' }, LIBRARY).key, 'D');
  assert.equal(applyAction(state, 'cycle-count', {}, LIBRARY).count, 4);
  assert.equal(applyAction(state, 'toggle-colour', {}, LIBRARY).colour, false);
  assert.equal(applyAction(state, 'toggle-roman', {}, LIBRARY).roman, false);
  assert.equal(applyAction(state, 'toggle-tones', {}, LIBRARY).tones, true);
  assert.ok(applyAction(state, 'toggle-section', { section: 'keys' }, LIBRARY).collapsed.includes('keys'));
  assert.deepEqual(applyAction(state, 'open-keys', {}, LIBRARY).collapsed, SECTIONS.filter((section) => section !== 'keys'));
  assert.ok(!applyAction(state, 'toggle-section', { section: 'bass' }, LIBRARY).collapsed.includes('bass'));
  assert.equal(applyAction(state, 'toggle-options', {}, LIBRARY).showOptions, false);
  assert.deepEqual(['showOptions', 'panel'].map((key) => applyAction(state, 'toggle-exercises', {}, LIBRARY)[key]), [true, 'exercises']);
  const exercises = { ...state, panel: 'exercises' };
  assert.deepEqual(['showOptions', 'panel'].map((key) => applyAction(exercises, 'toggle-options', {}, LIBRARY)[key]), [true, 'options']);
  assert.deepEqual(['showOptions', 'panel'].map((key) => applyAction(exercises, 'toggle-panel', {}, LIBRARY)[key]), [false, 'exercises']);
  assert.deepEqual(['showOptions', 'panel'].map((key) => applyAction(exercises, 'toggle-help', {}, LIBRARY)[key]), [true, 'help']);
  assert.equal(applyAction(state, 'toggle-theme', {}, LIBRARY).theme, 'dark');
  assert.equal(applyAction(state, 'set-probability', { option: 'permutation', value: '2' }, LIBRARY).permutation, 2);
  assert.equal(applyAction(state, 'unknown', {}, LIBRARY), state);
});

test('applyAction also handles group, progression, variation, foreign-variation and reroll actions', () => {
  const state = { ...defaultState(LIBRARY, FIXED), selection: ['Rock / C'] };
  assert.deepEqual(applyAction(state, 'toggle-group', { group: 'Pop' }, LIBRARY).selection, ['Pop / A', 'Pop / B', 'Rock / C']);
  assert.deepEqual(applyAction(state, 'toggle-progression', { id: 'Pop / A' }, LIBRARY).selection, ['Pop / A', 'Rock / C']);
  assert.ok(!applyAction(state, 'toggle-variation', { variation: '7' }, LIBRARY).variations.includes('7'));
  assert.equal(applyAction(state, 'toggle-foreign-variations', {}, LIBRARY).foreignVariations, false);
  assert.equal(applyAction(state, 'toggle-melody', {}, LIBRARY).inversions, true);

  let counter = 0;
  const rerolled = applyAction(state, 'reroll', {}, LIBRARY, () => {
    counter += 1;
    return (counter * 0.137) % 1;
  });
  assert.notDeepEqual(rerolled.seeds, state.seeds);
  assert.deepEqual({ ...rerolled, seeds: null }, { ...state, seeds: null });
});

test('applyAction switches the circle of fifths, the instrument and the exercise, and ignores an unknown instrument', () => {
  const state = defaultState(LIBRARY, FIXED);
  const circle = applyAction(state, 'toggle-circle-of-fifths', {}, LIBRARY);
  assert.equal(circle.circleOfFifths, true);
  assert.equal(applyAction(circle, 'toggle-circle-of-fifths', {}, LIBRARY).circleOfFifths, false);
  const guitar = applyAction(state, 'set-instrument', { instrument: 'guitar' }, LIBRARY);
  assert.equal(guitar.instrument, 'guitar');
  assert.equal(applyAction(guitar, 'set-instrument', { instrument: 'piano' }, LIBRARY).instrument, 'piano');
  assert.equal(applyAction(state, 'set-instrument', { instrument: 'ukulele' }, LIBRARY), state);
  const exercise = applyAction(state, 'toggle-exercise', { exercise: 'circle-ii-v-i' }, LIBRARY);
  assert.equal(exercise.exercise, 'circle-ii-v-i');
  assert.equal(applyAction(exercise, 'toggle-exercise', { exercise: 'circle-ii-v-i' }, LIBRARY).exercise, null);
});

test('on the guitar the actions on the bass and the melody change nothing, while the other actions still work', () => {
  const guitar = { ...defaultState(LIBRARY, FIXED), instrument: 'guitar', bassProbability: 4, inversions: true };
  for (const [action, params] of [
    ['toggle-melody', {}],
    ['set-probability', { option: 'bassProbability', value: '1' }],
    ['set-probability', { option: 'melodyAmount', value: '1' }],
    ['toggle-section', { section: 'bass' }],
    ['toggle-section', { section: 'melody' }],
  ]) {
    assert.equal(applyAction(guitar, action, params, LIBRARY), guitar, action);
  }
  assert.equal(applyAction(guitar, 'set-probability', { option: 'rotation', value: '1' }, LIBRARY).rotation, 1);
  const opened = applyAction(guitar, 'toggle-section', { section: 'progressionVariations' }, LIBRARY);
  assert.ok(!opened.collapsed.includes('progressionVariations'));
  const piano = applyAction(guitar, 'set-instrument', { instrument: 'piano' }, LIBRARY);
  assert.ok(!applyAction(piano, 'toggle-section', { section: 'bass' }, LIBRARY).collapsed.includes('bass'));
});

test('with the melody button off the melody amount cannot be changed, but the button itself can be pressed', () => {
  const off = { ...defaultState(LIBRARY, FIXED), inversions: false };
  assert.equal(applyAction(off, 'set-probability', { option: 'melodyAmount', value: '1' }, LIBRARY), off);
  assert.equal(applyAction(off, 'toggle-section', { section: 'melody' }, LIBRARY), off);
  assert.equal(applyAction(off, 'toggle-melody', {}, LIBRARY).inversions, true);
});

test('with the circle of fifths switch on, the count and the key cannot be changed, and the song does not open Keys', () => {
  const state = { ...defaultState(LIBRARY, FIXED), count: 4, circleOfFifths: true };
  assert.equal(applyAction(state, 'cycle-count', {}, LIBRARY), state);
  assert.equal(applyAction(state, 'set-key', { key: 'D' }, LIBRARY), state);
  assert.equal(applyAction(state, 'open-keys', {}, LIBRARY), state);
  // The Keys section can still be opened and closed, to look at the circle.
  assert.ok(applyAction(state, 'toggle-section', { section: 'keys' }, LIBRARY).collapsed.includes('keys'));
  const off = applyAction(state, 'toggle-circle-of-fifths', {}, LIBRARY);
  assert.equal(applyAction(off, 'cycle-count', {}, LIBRARY).count, 8);
  assert.equal(applyAction(off, 'set-key', { key: 'D' }, LIBRARY).key, 'D');
});

test('while an exercise is on, the options it fixes cannot be changed; the melody variations can', () => {
  const state = { ...defaultState(APP_LIBRARY, FIXED), inversions: true, collapsed: [], exercise: 'circle-ii-v-i' };
  const blocked = [
    ['toggle-progression', { id: 'Pop / Pop Progression' }],
    ['toggle-group', { group: 'Jazz' }],
    ['toggle-circle-of-fifths', {}],
    ['set-key', { key: 'D' }],
    ['cycle-count', {}],
    ['toggle-variation', { variation: '9' }],
    ['clear-variations', {}],
    ['toggle-foreign-variations', {}],
    ['set-probability', { option: 'variationProbability', value: '1' }],
    ['set-probability', { option: 'rotation', value: '1' }],
    ['set-probability', { option: 'permutation', value: '1' }],
    ['set-probability', { option: 'bassProbability', value: '1' }],
    ['toggle-section', { section: 'bass' }],
    ['toggle-section', { section: 'keys' }],
    ['toggle-section', { section: 'progressions' }],
    ['toggle-section', { section: 'progressionVariations' }],
    ['toggle-section', { section: 'variations' }],
    ['open-keys', {}],
  ];
  for (const [action, params] of blocked) {
    assert.equal(applyAction(state, action, params, APP_LIBRARY), state, action);
  }
  assert.equal(applyAction(state, 'set-probability', { option: 'melodyAmount', value: '4' }, APP_LIBRARY).melodyAmount, 4);
  assert.equal(applyAction(state, 'toggle-melody', {}, APP_LIBRARY).inversions, false);
  assert.notEqual(applyAction(state, 'toggle-section', { section: 'melody' }, APP_LIBRARY), state);
});

test('the painting switch is on by default and toggle-painting switches only it', () => {
  const state = defaultState(SMALL_LIBRARY, FIXED);
  assert.equal(state.painting, true);
  const off = applyAction(state, 'toggle-painting', {}, SMALL_LIBRARY);
  assert.deepEqual(off, { ...state, painting: false });
  assert.equal(applyAction(off, 'toggle-painting', {}, SMALL_LIBRARY).painting, true);
});

test('clear-variations switches every chord variation off, and keeps the variation probability', () => {
  const state = { ...defaultState(LIBRARY, FIXED), variationProbability: 3 };
  const cleared = applyAction(state, 'clear-variations', {}, LIBRARY);
  assert.deepEqual(cleared.variations, []);
  assert.equal(cleared.variationProbability, 3);
  assert.deepEqual(applyAction(cleared, 'clear-variations', {}, LIBRARY).variations, []);
});

test('clear-exercise switches the exercise that is on off, and changes nothing when none is on', () => {
  const state = { ...defaultState(APP_LIBRARY, FIXED), exercise: 'circle-ii-v-i' };
  assert.equal(applyAction(state, 'clear-exercise', {}, APP_LIBRARY).exercise, null);
  const none = defaultState(APP_LIBRARY, FIXED);
  assert.equal(applyAction(none, 'clear-exercise', {}, APP_LIBRARY).exercise, null);
});
