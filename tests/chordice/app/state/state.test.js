import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState,
  reroll,
  setCount,
  cycleCount,
  onlyKeysOpen,
  openKeys,
  FLAGS,
  SECTIONS,
  EXERCISE_SECTIONS,
  ALL_SECTIONS,
  PANELS,
  choosePanel,
  setProbability,
  toggleVariation,
  toggleGroup,
  setKey,
  toggleProgression,
  toggleSection,
  toggleFlag,
  toggleTheme,
  setInstrument,
  toggleExercise,
} from '../../../../chordice/app/state/state.js';
import { VARIATION_NAMES } from '../../../../chordice/music/theory/chords.js';
import { FIXED, SMALL_LIBRARY } from '../../../helpers/fixtures.js';

const LIBRARY = SMALL_LIBRARY;
const IDS = LIBRARY.map((progression) => progression.id);

test('defaults select everything, show colours and extended information, and rotate and permute 3 of 5 of the rows', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.key, 'C');
  assert.deepEqual(state.selection, IDS);
  assert.equal(state.count, 2);
  assert.deepEqual(state.variations, VARIATION_NAMES);
  assert.equal(state.colour, true);
  assert.equal(state.roman, true);
  assert.equal(state.tones, false);
  assert.equal(state.permutation, 2);
  assert.equal(state.rotation, 2);
  assert.equal(state.variationProbability, 2);
  assert.equal(state.bassProbability, 2);
  assert.equal(state.theme, 'dark');
  assert.equal(state.showOptions, true);
  assert.equal(state.panel, 'options');
  assert.deepEqual(state.collapsed, ['progressions', 'progressionVariations', 'variations', 'bass', 'melody']);
  assert.equal(state.exercise, null);
});

test('the options sections are keys, progressions, number of progressions, chord variations, bass and melody variations', () => {
  assert.deepEqual(SECTIONS, ['keys', 'progressions', 'progressionVariations', 'variations', 'bass', 'melody']);
});

test('the side panel shows the options, the exercises or the help', () => {
  assert.deepEqual(PANELS, ['options', 'exercises', 'help']);
});

test('choosePanel shows the other panel in place of the one shown, and closes the side panel for the one shown', () => {
  const state = defaultState(LIBRARY, FIXED);
  const exercises = choosePanel(state, 'exercises');
  assert.equal(exercises.showOptions, true);
  assert.equal(exercises.panel, 'exercises');
  const options = choosePanel(exercises, 'options');
  assert.equal(options.showOptions, true);
  assert.equal(options.panel, 'options');
  // The panel that is shown closes the side panel; it keeps its panel.
  const closed = choosePanel(exercises, 'exercises');
  assert.equal(closed.showOptions, false);
  assert.equal(closed.panel, 'exercises');
  // While the side panel is closed, either button opens it with its panel.
  assert.deepEqual([choosePanel(closed, 'exercises').showOptions, choosePanel(closed, 'exercises').panel], [true, 'exercises']);
  assert.deepEqual([choosePanel(closed, 'options').showOptions, choosePanel(closed, 'options').panel], [true, 'options']);
  assert.equal(choosePanel(exercises, 'help').panel, 'help');
  assert.equal(choosePanel(state, 'unknown'), state);
});

test('colour, roman numerals and chord tones are independent switches', () => {
  const state = defaultState(LIBRARY, FIXED);
  const noColour = toggleFlag(state, 'colour');
  assert.equal(noColour.colour, false);
  assert.equal(noColour.roman, true);
  assert.equal(noColour.tones, false);
  const noRoman = toggleFlag(state, 'roman');
  assert.equal(noRoman.colour, true);
  assert.equal(noRoman.roman, false);
  assert.equal(noRoman.tones, false);
  const withTones = toggleFlag(state, 'tones');
  assert.equal(withTones.roman, true);
  assert.equal(withTones.tones, true);
  assert.equal(toggleFlag(noColour, 'colour').colour, true);
  assert.equal(toggleFlag(state, 'unknown'), state);
});

test('toggleSection expands one section and collapses all others, so only one section is open at a time', () => {
  const state = defaultState(LIBRARY, FIXED);
  // Keys is open by default; opening bass closes it.
  const bass = toggleSection(state, 'bass');
  assert.deepEqual(bass.collapsed, ['keys', 'progressions', 'progressionVariations', 'variations', 'melody']);
  const progressions = toggleSection(bass, 'progressions');
  assert.deepEqual(progressions.collapsed, ['keys', 'progressionVariations', 'variations', 'bass', 'melody']);
  assert.equal(toggleSection(state, 'unknown'), state);
});

test('the boxes of the options and of the exercises open and close independently, one open box per panel', () => {
  const state = defaultState(LIBRARY, FIXED);
  // By default Keys and the Exercises box are open.
  assert.ok(!state.collapsed.includes('keys') && !state.collapsed.includes('exercises'));
  assert.deepEqual(EXERCISE_SECTIONS, ['exercises']);
  assert.deepEqual(ALL_SECTIONS, [...SECTIONS, 'exercises']);
  // Closing the Exercises box leaves Keys open; opening Bass leaves the Exercises box as it is.
  const closed = toggleSection(state, 'exercises');
  assert.deepEqual(closed.collapsed, [...state.collapsed, 'exercises']);
  assert.ok(toggleSection(closed, 'bass').collapsed.includes('exercises'));
  assert.ok(!toggleSection(state, 'bass').collapsed.includes('exercises'));
  assert.ok(!toggleSection(closed, 'exercises').collapsed.includes('exercises'));
  assert.ok(!toggleSection(closed, 'exercises').collapsed.includes('keys'));
  // Opening Keys from a click on the song leaves the Exercises box as it is.
  assert.ok(openKeys(closed).collapsed.includes('exercises'));
  assert.ok(!openKeys(state).collapsed.includes('exercises'));
});

test('toggleSection collapsing the open section leaves every section closed, with no exception for Keys', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.deepEqual(toggleSection(state, 'keys').collapsed, SECTIONS);
  const variations = toggleSection(state, 'variations');
  assert.deepEqual(toggleSection(variations, 'variations').collapsed, SECTIONS);
});

test('openKeys expands Keys and collapses every other section', () => {
  const state = { ...defaultState(LIBRARY, FIXED), collapsed: SECTIONS };
  assert.deepEqual(openKeys(state).collapsed, SECTIONS.filter((section) => section !== 'keys'));
  const bass = toggleSection(defaultState(LIBRARY, FIXED), 'bass');
  assert.deepEqual(openKeys(bass).collapsed, SECTIONS.filter((section) => section !== 'keys'));
});

test('toggleTheme switches between dark and light and leaves the other settings alone', () => {
  const state = defaultState(LIBRARY, FIXED);
  const light = toggleTheme(state);
  assert.equal(light.theme, 'light');
  assert.deepEqual({ ...light, theme: 'dark' }, state);
  assert.equal(toggleTheme(light).theme, 'dark');
});

test('setKey selects the key, replacing the current one', () => {
  let state = defaultState(LIBRARY, FIXED);
  state = setKey(state, 'G');
  assert.equal(state.key, 'G');
  state = setKey(state, 'Gb');
  assert.equal(state.key, 'Gb');
  // Selecting the current key changes nothing, so the selection is never empty.
  assert.equal(setKey(state, 'Gb'), state);
  // Minor keys and unknown names are not selectable.
  assert.equal(setKey(state, 'Am'), state);
  assert.equal(setKey(state, 'H'), state);
});

test('toggleGroup selects or clears all progressions of a group', () => {
  let state = { ...defaultState(LIBRARY, FIXED), selection: ['Rock / C'] };
  state = toggleGroup(state, 'Pop', LIBRARY);
  assert.deepEqual(state.selection, ['Pop / A', 'Pop / B', 'Rock / C']);
  state = toggleGroup(state, 'Pop', LIBRARY);
  assert.deepEqual(state.selection, ['Rock / C']);
  // Clearing the last group leaves no progression selected, which is allowed.
  const onlyRock = toggleGroup({ ...state, selection: ['Rock / C'] }, 'Rock', LIBRARY);
  assert.deepEqual(onlyRock.selection, []);
});

test('toggleProgression keeps the library order and allows an empty selection', () => {
  const state = defaultState(LIBRARY, FIXED);
  const without = toggleProgression(state, 'Pop / A', LIBRARY);
  assert.deepEqual(without.selection, ['Pop / B', 'Rock / C']);
  const back = toggleProgression(without, 'Pop / A', LIBRARY);
  assert.deepEqual(back.selection, IDS);
  const single = { ...state, selection: ['Pop / B'] };
  assert.deepEqual(toggleProgression(single, 'Pop / B', LIBRARY).selection, []);
});

test('toggleProgression with nothing selected leaves the other options as they are', () => {
  const state = { ...defaultState(LIBRARY, FIXED), selection: ['Pop / B'], count: 8, rotation: 30 };
  const cleared = toggleProgression(state, 'Pop / B', LIBRARY);
  assert.deepEqual(cleared.selection, []);
  assert.equal(cleared.count, 8);
  assert.equal(cleared.rotation, 30);
});

test('cycleCount goes through 1, 2, 4, 8 and back to 1, and leaves the other settings alone', () => {
  let state = { ...defaultState(LIBRARY, FIXED), count: 1, rotation: 5 };
  const seen = [];
  for (let i = 0; i < 4; i++) {
    state = cycleCount(state);
    seen.push(state.count);
  }
  assert.deepEqual(seen, [2, 4, 8, 1]);
  assert.equal(state.rotation, 5);
});

test('setCount accepts only the allowed counts', () => {
  const state = defaultState(LIBRARY, FIXED);
  for (const count of [1, 2, 4, 8]) {
    assert.equal(setCount(state, count).count, count);
  }
  assert.equal(setCount(state, 3), state);
  assert.equal(setCount(state, 12), state);
  assert.equal(setCount(state, 16), state);
});

test('toggleVariation keeps the canonical order and allows an empty list', () => {
  let state = { ...defaultState(LIBRARY, FIXED), variations: ['7'] };
  state = toggleVariation(state, 'maj7');
  assert.deepEqual(state.variations, ['7', 'maj7']);
  state = toggleVariation(state, '7');
  assert.deepEqual(state.variations, ['maj7']);
  // Removing the last variation empties the list; the variation probability stays where it is.
  const emptied = toggleVariation({ ...state, variationProbability: 70 }, 'maj7');
  assert.deepEqual(emptied.variations, []);
  assert.equal(emptied.variationProbability, 70);
});

test('setProbability rounds to whole steps of the 0 to 5 scale and clamps to 0..5', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(setProbability(state, 'rotation', '3.6').rotation, 4);
  assert.equal(setProbability(state, 'rotation', 150).rotation, 5);
  assert.equal(setProbability(state, 'bassProbability', -2).bassProbability, 0);
  assert.equal(setProbability(state, 'rotation', 'abc'), state);
  assert.equal(setProbability(state, 'count', 50), state);
});

test('inversions are an on/off switch, off by default, and not a probability', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.inversions, false);
  assert.ok(FLAGS.includes('inversions'));
  assert.equal(setProbability(state, 'inversions', 30), state);
});

test('the inversions switch toggles on and off, and changes nothing else', () => {
  const state = defaultState(LIBRARY, FIXED);
  const on = toggleFlag(state, 'inversions');
  assert.equal(on.inversions, true);
  assert.deepEqual({ ...on, inversions: false }, state);
  assert.equal(toggleFlag(on, 'inversions').inversions, false);
});

test('reroll changes only the seeds', () => {
  const state = defaultState(LIBRARY, FIXED);
  let counter = 0;
  const next = reroll(state, () => {
    counter += 1;
    return (counter * 0.137) % 1;
  });
  assert.notDeepEqual(next.seeds, state.seeds);
  assert.deepEqual({ ...next, seeds: null }, { ...state, seeds: null });
});

test('unknown groups, progressions, variations, flags, sections, keys and probabilities leave the state unchanged', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(toggleGroup(state, 'Jazz', LIBRARY), state);
  assert.equal(toggleProgression(state, 'Jazz / X', LIBRARY), state);
  assert.equal(toggleVariation(state, 'no-such-variation'), state);
  assert.equal(toggleFlag(state, 'no-such-flag'), state);
  assert.equal(toggleSection(state, 'no-such-section'), state);
  assert.equal(setKey(state, 'H'), state);
  assert.equal(setProbability(state, 'no-such-option', 3), state);
  assert.equal(setProbability(state, 'rotation', 'abc'), state);
});

test('the foreign variations switch is on by default, toggles on and off, and changes nothing else', () => {
  const state = { ...defaultState(LIBRARY, FIXED), variations: ['7'] };
  assert.equal(state.foreignVariations, true);
  const off = toggleFlag(state, 'foreignVariations');
  assert.equal(off.foreignVariations, false);
  assert.deepEqual({ ...off, foreignVariations: true }, state);
  assert.equal(toggleFlag(off, 'foreignVariations').foreignVariations, true);
});

test('the circle of fifths switch is off by default and toggles on and off', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.circleOfFifths, false);
  const on = toggleFlag(state, 'circleOfFifths');
  assert.equal(on.circleOfFifths, true);
  assert.equal(toggleFlag(on, 'circleOfFifths').circleOfFifths, false);
});

test('the melody amount starts at 2 and is clamped to the scale from 0 to 5', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.melodyAmount, 2);
  assert.equal(setProbability(state, 'melodyAmount', 9).melodyAmount, 5);
  assert.equal(setProbability(state, 'melodyAmount', -1).melodyAmount, 0);
});

test('no exercise is on by default; toggleExercise switches it on and off, and an unknown exercise changes nothing', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.exercise, null);
  const on = toggleExercise(state, 'circle-ii-v-i');
  assert.equal(on.exercise, 'circle-ii-v-i');
  assert.deepEqual({ ...on, exercise: null }, state);
  assert.equal(toggleExercise(on, 'circle-ii-v-i').exercise, null);
  assert.equal(toggleExercise(state, 'unknown'), state);
});

test('the instrument is the piano by default, and a tab sets it to the guitar or back, changing nothing else', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.instrument, 'piano');
  const guitar = setInstrument(state, 'guitar');
  assert.equal(guitar.instrument, 'guitar');
  assert.deepEqual({ ...guitar, instrument: 'piano' }, state);
  assert.equal(setInstrument(guitar, 'piano').instrument, 'piano');
});

test('an unknown instrument leaves the state unchanged', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(setInstrument(state, 'ukulele'), state);
});

test('onlyKeysOpen is true exactly when Keys is the one section that is open', () => {
  const state = defaultState(LIBRARY, () => 0.5);
  assert.equal(onlyKeysOpen(state), true);
  assert.equal(onlyKeysOpen(openKeys(state)), true);
  assert.equal(onlyKeysOpen(toggleSection(state, 'bass')), false);
  assert.equal(onlyKeysOpen({ ...state, collapsed: [] }), false);
  assert.equal(onlyKeysOpen({ ...state, collapsed: SECTIONS.filter((section) => section !== 'keys') }), true);
});
