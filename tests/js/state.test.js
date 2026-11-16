import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLibrary, createSeeds, SEED_NAMES } from '../../chordice/js/generator.js';
import {
  applyAction,
  COOKIE_NAME,
  defaultState,
  parseCookie,
  reroll,
  sanitizeState,
  serializeCookie,
  setCount,
  FLAGS,
  SECTIONS,
  setProbability,
  toggleExtension,
  toggleGroup,
  toggleKey,
  toggleProgression,
  toggleSection,
  toggleFlag,
  toggleTheme,
} from '../../chordice/js/state.js';
import { EXTENSION_NAMES } from '../../chordice/js/theory.js';

const LIBRARY = buildLibrary([
  { group: 'Pop', progressions: [{ name: 'A', progression: ['I', 'V'] }, { name: 'B', progression: ['I', 'IV'] }] },
  { group: 'Rock', progressions: [{ name: 'C', progression: ['I', 'IV', 'V'] }] },
]);
const IDS = LIBRARY.map((progression) => progression.id);
const FIXED = () => 0.25;

test('defaults select everything, show colours and extended information, and permute half of the rows', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.deepEqual(state.keys, ['C']);
  assert.deepEqual(state.selection, IDS);
  assert.equal(state.count, 4);
  assert.deepEqual(state.extensions, EXTENSION_NAMES);
  assert.equal(state.colour, true);
  assert.equal(state.details, true);
  assert.equal(state.permutation, 50);
  assert.equal(state.rotation, 50);
  assert.equal(state.theme, 'dark');
  assert.equal(state.showOptions, true);
  assert.deepEqual(state.collapsed, ['progressions', 'count', 'extensions', 'probabilities']);
});

test('sanitizeState falls back to defaults for missing or broken input', () => {
  const defaults = defaultState(LIBRARY, FIXED);
  assert.deepEqual(sanitizeState(null, LIBRARY, FIXED), defaults);
  assert.deepEqual(sanitizeState('oops', LIBRARY, FIXED), defaults);
});

test('sanitizeState keeps valid values and repairs invalid ones', () => {
  const state = sanitizeState({
    keys: ['H', 'C', 'G', 'D'],
    selection: ['Pop / A', 'Unknown / Z'],
    count: 3,
    rotation: 55,
    permutation: 30,
    extensions: ['add9', 'nope'],
    extensionProbability: 150,
    bassProbability: 20,
    view: 'weird',
    theme: 'dark',
    showOptions: false,
    seeds: { progression: -1 },
  }, LIBRARY, FIXED);
  assert.deepEqual(state.keys, ['D']);
  assert.deepEqual(state.selection, ['Pop / A']);
  assert.equal(state.count, 4);
  assert.equal(state.rotation, 50);
  assert.equal(state.permutation, 30);
  assert.deepEqual(state.extensions, ['add9']);
  assert.equal(state.extensionProbability, 50);
  assert.equal(state.bassProbability, 20);
  assert.equal(state.colour, true);
  assert.equal(state.details, true);
  assert.equal(state.theme, 'dark');
  assert.equal(state.showOptions, false);
  assert.equal(typeof state.seeds.progression, 'number');
  assert.deepEqual(Object.keys(state.seeds).sort(), [...SEED_NAMES].sort());
});

test('sanitizeState repairs an unknown theme to the dark default', () => {
  assert.equal(sanitizeState({ theme: 'blue' }, LIBRARY, FIXED).theme, 'dark');
  assert.equal(sanitizeState({}, LIBRARY, FIXED).theme, 'dark');
});

test('colour and extended information are independent switches', () => {
  const state = defaultState(LIBRARY, FIXED);
  const noColour = toggleFlag(state, 'colour');
  assert.equal(noColour.colour, false);
  assert.equal(noColour.details, true);
  const noDetails = toggleFlag(state, 'details');
  assert.equal(noDetails.colour, true);
  assert.equal(noDetails.details, false);
  assert.equal(toggleFlag(noColour, 'colour').colour, true);
  assert.equal(toggleFlag(state, 'unknown'), state);
});

test('a cookie from the single view setting sets both switches: extended on, plain off', () => {
  assert.deepEqual(
    [sanitizeState({ view: 'extended' }, LIBRARY, FIXED).colour, sanitizeState({ view: 'extended' }, LIBRARY, FIXED).details],
    [true, true],
  );
  const plain = sanitizeState({ view: 'plain' }, LIBRARY, FIXED);
  assert.equal(plain.colour, false);
  assert.equal(plain.details, false);
});

test('the switches in a cookie win over the old view setting', () => {
  const state = sanitizeState({ view: 'plain', colour: true, details: false }, LIBRARY, FIXED);
  assert.equal(state.colour, true);
  assert.equal(state.details, false);
});

test('toggleSection expands one section and collapses all others, so only one section is open at a time', () => {
  const state = defaultState(LIBRARY, FIXED);
  // Keys is open by default; opening probabilities closes it.
  const probabilities = toggleSection(state, 'probabilities');
  assert.deepEqual(probabilities.collapsed, ['keys', 'progressions', 'count', 'extensions']);
  const progressions = toggleSection(probabilities, 'progressions');
  assert.deepEqual(progressions.collapsed, ['keys', 'count', 'extensions', 'probabilities']);
  assert.equal(toggleSection(state, 'unknown'), state);
});

test('toggleSection collapses the open section, leaving every section closed', () => {
  const state = defaultState(LIBRARY, FIXED);
  const closed = toggleSection(state, 'keys');
  assert.deepEqual(closed.collapsed, SECTIONS);
  assert.deepEqual(toggleSection(closed, 'count').collapsed, ['keys', 'progressions', 'extensions', 'probabilities']);
});

test('sanitizeState keeps only known collapsed sections and at most one expanded section', () => {
  const state = sanitizeState({ collapsed: ['count', 'view', 'keys'] }, LIBRARY, FIXED);
  // Three sections were open in the cookie; the first one in section order stays open.
  assert.deepEqual(state.collapsed, ['keys', 'count', 'extensions', 'probabilities']);
  assert.deepEqual(sanitizeState({ collapsed: SECTIONS }, LIBRARY, FIXED).collapsed, SECTIONS);
  assert.deepEqual(sanitizeState({ collapsed: 'keys' }, LIBRARY, FIXED).collapsed, defaultState(LIBRARY, FIXED).collapsed);
});

test('toggleTheme switches between dark and light and leaves the other settings alone', () => {
  const state = defaultState(LIBRARY, FIXED);
  const light = toggleTheme(state);
  assert.equal(light.theme, 'light');
  assert.deepEqual({ ...light, theme: 'dark' }, state);
  assert.equal(toggleTheme(light).theme, 'dark');
});

test('toggleKey selects exactly one key, replacing the current one', () => {
  let state = defaultState(LIBRARY, FIXED);
  state = toggleKey(state, 'G');
  assert.deepEqual(state.keys, ['G']);
  state = toggleKey(state, 'Gb');
  assert.deepEqual(state.keys, ['Gb']);
  // Selecting the current key changes nothing, so the selection is never empty.
  assert.equal(toggleKey(state, 'Gb'), state);
  // Minor keys and unknown names are not selectable.
  assert.equal(toggleKey(state, 'Am'), state);
  assert.equal(toggleKey(state, 'H'), state);
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

test('setCount accepts only the allowed counts', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(setCount(state, 16).count, 16);
  assert.equal(setCount(state, 3), state);
});

test('toggleExtension keeps the canonical order and allows an empty list', () => {
  let state = { ...defaultState(LIBRARY, FIXED), extensions: ['7'] };
  state = toggleExtension(state, 'maj7');
  assert.deepEqual(state.extensions, ['7', 'maj7']);
  state = toggleExtension(state, '7');
  assert.deepEqual(state.extensions, ['maj7']);
  // Removing the last extension empties the list; the extension probability stays where it is.
  const emptied = toggleExtension({ ...state, extensionProbability: 70 }, 'maj7');
  assert.deepEqual(emptied.extensions, []);
  assert.equal(emptied.extensionProbability, 70);
});

test('sanitizeState keeps an empty selection and empty extensions, and defaults only lists that are missing', () => {
  const empty = sanitizeState({ selection: [], extensions: [] }, LIBRARY, FIXED);
  assert.deepEqual(empty.selection, []);
  assert.deepEqual(empty.extensions, []);
  const missing = sanitizeState({}, LIBRARY, FIXED);
  assert.deepEqual(missing.selection, IDS);
  assert.deepEqual(missing.extensions, EXTENSION_NAMES);
});

test('setProbability rounds to steps of 10 and clamps to 0..100', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(setProbability(state, 'rotation', '37').rotation, 40);
  assert.equal(setProbability(state, 'rotation', 150).rotation, 100);
  assert.equal(setProbability(state, 'bassProbability', -20).bassProbability, 0);
  assert.equal(setProbability(state, 'rotation', 'abc'), state);
  assert.equal(setProbability(state, 'count', 50), state);
});

test('inversions are an on/off switch, off by default, and not a probability', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.inversions, false);
  assert.ok(FLAGS.includes('inversions'));
  assert.equal(state.inversionProbability, undefined);
  assert.equal(setProbability(state, 'inversions', 30), state);
});

test('the inversions switch toggles on and off, and changes nothing else', () => {
  const state = defaultState(LIBRARY, FIXED);
  const on = applyAction(state, 'toggle-inversions', {}, LIBRARY);
  assert.equal(on.inversions, true);
  assert.deepEqual({ ...on, inversions: false }, state);
  assert.equal(applyAction(on, 'toggle-inversions', {}, LIBRARY).inversions, false);
});

test('the inversions switch is kept by cookies; a cookie without it, or with a broken value, is off', () => {
  assert.equal(sanitizeState({ inversions: true }, LIBRARY, FIXED).inversions, true);
  assert.equal(sanitizeState({ inversions: 'yes' }, LIBRARY, FIXED).inversions, false);
  assert.equal(sanitizeState({ rotation: 20 }, LIBRARY, FIXED).inversions, false);
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

test('applyAction dispatches UI actions and ignores unknown ones', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.deepEqual(applyAction(state, 'toggle-key', { key: 'D' }, LIBRARY).keys, ['D']);
  assert.equal(applyAction(state, 'set-count', { count: '8' }, LIBRARY).count, 8);
  assert.equal(applyAction(state, 'toggle-colour', {}, LIBRARY).colour, false);
  assert.equal(applyAction(state, 'toggle-details', {}, LIBRARY).details, false);
  assert.ok(applyAction(state, 'toggle-section', { section: 'keys' }, LIBRARY).collapsed.includes('keys'));
  assert.equal(applyAction(state, 'toggle-options', {}, LIBRARY).showOptions, false);
  assert.equal(applyAction(state, 'toggle-theme', {}, LIBRARY).theme, 'light');
  assert.equal(applyAction(state, 'set-probability', { option: 'permutation', value: '20' }, LIBRARY).permutation, 20);
  assert.equal(applyAction(state, 'unknown', {}, LIBRARY), state);
});

test('the state survives a round trip through the cookie', () => {
  const state = defaultState(LIBRARY, () => Math.random());
  const cookie = serializeCookie(state);
  assert.ok(cookie.startsWith(`${COOKIE_NAME}=`));
  assert.ok(!cookie.split(';')[0].includes(';'));
  const restored = sanitizeState(parseCookie(cookie.split(';')[0]), LIBRARY);
  assert.deepEqual(restored, state);
});

test('parseCookie ignores other cookies and broken values', () => {
  assert.equal(parseCookie('other=1; theme=dark'), null);
  assert.equal(parseCookie(`${COOKIE_NAME}=%7Bbroken`), null);
  assert.equal(parseCookie(''), null);
  assert.equal(parseCookie(undefined), null);
});

test('sanitizeState maps minor keys from older cookies to their relative major', () => {
  const state = sanitizeState({ keys: ['Am', 'G', 'Am'] }, LIBRARY, FIXED);
  assert.deepEqual(state.keys, ['G']);
});
