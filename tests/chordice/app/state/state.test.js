import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState,
  reroll,
  setCount,
  cycleCount,
  FLAGS,
  SECTIONS,
  EXERCISE_SECTIONS,
  ALL_SECTIONS,
  PANELS,
  choosePanel,
  setProbability,
  probabilityMaxOf,
  toggleVariation,
  toggleGroup,
  setKey,
  toggleProgression,
  toggleSection,
  toggleFlag,
  toggleTheme,
  setInstrument,
  toggleExercise,
  resetSettings,
  defaultSelection,
  DEFAULT_GROUP,
} from '../../../../chordice/app/state/state.js';
import { VARIATION_NAMES } from '../../../../chordice/music/theory/chords.js';
import { FIXED, SMALL_LIBRARY } from '../../../helpers/fixtures.js';

const LIBRARY = SMALL_LIBRARY;
const IDS = LIBRARY.map((progression) => progression.id);

test('defaults select the Pop progressions, show colours and extended information, and use four progressions, the common chord variations and no melody', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.key, 'C');
  assert.deepEqual(state.selection, ['Pop / A', 'Pop / B']);
  assert.equal(state.count, 4);
  assert.deepEqual(state.variations, ['7', 'maj7', '6', 'add9', 'sus2', 'sus4']);
  assert.equal(state.foreignVariations, false);
  assert.equal(state.inversions, false);
  assert.equal(state.colour, true);
  assert.equal(state.roman, true);
  assert.equal(state.tones, false);
  assert.equal(state.permutation, 1);
  assert.equal(state.rotation, 2);
  assert.equal(state.variationProbability, 4);
  assert.equal(state.bassProbability, 0);
  assert.equal(state.melodyAmount, 1);
  assert.equal(state.theme, 'light');
  assert.equal(state.showOptions, true);
  assert.equal(state.panel, 'options');
  assert.deepEqual(state.collapsed, ['progressions', 'progressionVariations', 'variations', 'bass', 'melody']);
  assert.equal(state.exercise, null);
});

test('the options sections are progressions, progression variations, chord variations, bass and melody variations; the key is chosen beside the chords', () => {
  assert.deepEqual(SECTIONS, ['progressions', 'progressionVariations', 'variations', 'bass', 'melody']);
});

test('the side panel shows the options, the exercises, the songs, the help or the account', () => {
  assert.deepEqual(PANELS, ['options', 'exercises', 'songs', 'help', 'account']);
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

test('toggleSection expands a section and leaves the others as they are, so several sections can be open at once', () => {
  const state = defaultState(LIBRARY, FIXED);
  const bass = toggleSection(state, 'bass');
  assert.deepEqual(bass.collapsed, ['progressions', 'progressionVariations', 'variations', 'melody']);
  const progressions = toggleSection(bass, 'progressions');
  assert.deepEqual(progressions.collapsed, ['progressionVariations', 'variations', 'melody']);
  assert.deepEqual(toggleSection(progressions, 'bass').collapsed, ['progressionVariations', 'variations', 'bass', 'melody']);
  assert.equal(toggleSection(state, 'unknown'), state);
  assert.equal(toggleSection(state, 'keys'), state, 'the Keys section is gone');
});

test('the boxes of the options and of the exercises open and close independently', () => {
  const state = defaultState(LIBRARY, FIXED);
  // By default every options box is closed and the Exercises box is open.
  assert.ok(state.collapsed.includes('progressions') && !state.collapsed.includes('exercises'));
  assert.deepEqual(EXERCISE_SECTIONS, ['exercises']);
  assert.deepEqual(ALL_SECTIONS, [...SECTIONS, 'exercises']);
  // Closing the Exercises box leaves Progressions as it is; opening Bass leaves the Exercises box as it is.
  const closed = toggleSection(state, 'exercises');
  assert.deepEqual(closed.collapsed, [...state.collapsed, 'exercises']);
  assert.ok(toggleSection(closed, 'bass').collapsed.includes('exercises'));
  assert.ok(!toggleSection(state, 'bass').collapsed.includes('exercises'));
  assert.ok(!toggleSection(closed, 'exercises').collapsed.includes('exercises'));
  assert.ok(toggleSection(closed, 'exercises').collapsed.includes('progressions'));
});

test('toggleSection collapsing an open section leaves the other open sections open', () => {
  const state = { ...defaultState(LIBRARY, FIXED), collapsed: [] };
  assert.deepEqual(toggleSection(state, 'bass').collapsed, ['bass']);
  const closed = defaultState(LIBRARY, FIXED);
  const bass = toggleSection(closed, 'bass');
  assert.deepEqual(toggleSection(bass, 'bass').collapsed, SECTIONS);
});

test('toggleTheme switches between dark and light and leaves the other settings alone', () => {
  const state = defaultState(LIBRARY, FIXED);
  const dark = toggleTheme(state);
  assert.equal(dark.theme, 'dark');
  assert.deepEqual({ ...dark, theme: 'light' }, state);
  assert.equal(toggleTheme(dark).theme, 'light');
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
  const state = { ...defaultState(LIBRARY, FIXED), selection: IDS };
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

test('the chord variations go one step further, to 5+ (6); the other probabilities stop at 5', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(setProbability(state, 'variationProbability', 6).variationProbability, 6);
  assert.equal(setProbability(state, 'variationProbability', 99).variationProbability, 6);
  assert.equal(setProbability(state, 'bassProbability', 6).bassProbability, 5);
  assert.equal(probabilityMaxOf('variationProbability'), 6);
  assert.equal(probabilityMaxOf('rotation'), 5);
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

test('the foreign variations switch is off by default, toggles on and off, and changes nothing else', () => {
  const state = { ...defaultState(LIBRARY, FIXED), variations: ['7'] };
  assert.equal(state.foreignVariations, false);
  const on = toggleFlag(state, 'foreignVariations');
  assert.equal(on.foreignVariations, true);
  assert.deepEqual({ ...on, foreignVariations: false }, state);
  assert.equal(toggleFlag(on, 'foreignVariations').foreignVariations, false);
});

test('the circle of fifths switch is off by default and toggles on and off', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.circleOfFifths, false);
  const on = toggleFlag(state, 'circleOfFifths');
  assert.equal(on.circleOfFifths, true);
  assert.equal(toggleFlag(on, 'circleOfFifths').circleOfFifths, false);
});

test('the melody amount starts at 1 and is clamped to the scale from 0 to 5', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.melodyAmount, 1);
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

test('the default selection is the Pop group, or every progression when the library has no Pop group', () => {
  assert.equal(DEFAULT_GROUP, 'Pop');
  assert.deepEqual(defaultSelection(LIBRARY), ['Pop / A', 'Pop / B']);
  const noPop = LIBRARY.filter((progression) => progression.group !== 'Pop');
  assert.deepEqual(defaultSelection(noPop), ['Rock / C']);
  assert.deepEqual(defaultSelection([]), []);
});

test('the default selection of the real library is every Pop progression', async () => {
  const { LIBRARY: REAL } = await import('../../../helpers/fixtures.js');
  const pop = REAL.filter((progression) => progression.group === 'Pop').map((progression) => progression.id);
  assert.ok(pop.length > 0);
  assert.deepEqual(defaultState(REAL, FIXED).selection, pop);
});

test('resetSettings sets every setting back to its default, keeps the saved songs and the panel, and gives new seeds', () => {
  const songs = [{ id: 'kept' }];
  const changed = {
    ...defaultState(LIBRARY, FIXED),
    key: 'D',
    count: 8,
    variations: [],
    theme: 'dark',
    instrument: 'guitar',
    exercise: 'circle-ii-v-i',
    painting: false,
    collapsed: [],
    frozen: 'kept',
    panel: 'account',
    songs,
  };
  const reset = resetSettings(changed, LIBRARY, () => 0.7);
  const fresh = defaultState(LIBRARY, () => 0.7);
  assert.deepEqual(reset, { ...fresh, panel: 'account', songs });
  assert.equal(reset.songs, songs);
  assert.notDeepEqual(reset.seeds, changed.seeds);
  // The side panel stays as it is, closed too.
  assert.equal(resetSettings({ ...changed, showOptions: false }, LIBRARY).showOptions, false);
});
