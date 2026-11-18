import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveState, isUnavailable } from '../../../chordice/js/core/state.js';
import { buildLibrary } from '../../../chordice/js/data/validate.js';
import { createSeeds, SEED_NAMES } from '../../../chordice/js/generator/utils.js';
import {
  applyAction,
  COOKIE_NAME,
  defaultState,
  parseCookie,
  reroll,
  sanitizeState,
  serializeCookie,
  setCount,
  cycleCount,
  openKeys,
  FLAGS,
  SECTIONS,
  setProbability,
  toggleVariation,
  toggleGroup,
  toggleKey,
  toggleProgression,
  toggleSection,
  toggleFlag,
  toggleTheme,
} from '../../../chordice/js/core/state.js';
import { VARIATION_NAMES } from '../../../chordice/js/theory/chords.js';

const LIBRARY = buildLibrary({
  Pop: { progressions: { A: ['I', 'V'], B: ['I', 'IV'] } },
  Rock: { progressions: { C: ['I', 'IV', 'V'] } },
});
const IDS = LIBRARY.map((progression) => progression.id);
const FIXED = () => 0.25;

test('defaults select everything, show colours and extended information, and rotate and permute 3 of 5 of the rows', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.deepEqual(state.keys, ['C']);
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
  assert.deepEqual(state.collapsed, ['progressions', 'progressionVariations', 'variations', 'bass', 'melody']);
});

test('the options sections are keys, progressions, number of progressions, chord variations, bass and melody variations', () => {
  assert.deepEqual(SECTIONS, ['keys', 'progressions', 'progressionVariations', 'variations', 'bass', 'melody']);
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
    rotation: 4,
    permutation: 2,
    variations: ['add9', 'nope'],
    variationProbability: 6,
    bassProbability: 1,
    view: 'weird',
    theme: 'dark',
    showOptions: false,
    seeds: { progression: -1 },
  }, LIBRARY, FIXED);
  assert.deepEqual(state.keys, ['D']);
  // The selection is always every progression, whatever the cookie stored.
  assert.deepEqual(state.selection, IDS);
  assert.equal(state.count, 2);
  assert.equal(state.rotation, 4);
  assert.equal(state.permutation, 2);
  assert.deepEqual(state.variations, ['add9']);
  assert.equal(state.variationProbability, 2);
  assert.equal(state.bassProbability, 1);
  assert.equal(state.colour, true);
  assert.equal(state.roman, true);
  assert.equal(state.tones, false);
  assert.equal(state.theme, 'dark');
  assert.equal(state.showOptions, false);
  assert.equal(typeof state.seeds.progression, 'number');
  assert.deepEqual(Object.keys(state.seeds).sort(), [...SEED_NAMES].sort());
});

test('sanitizeState repairs a stored count of 12, which is no longer offered, to the default of 2', () => {
  assert.equal(sanitizeState({ count: 12 }, LIBRARY, FIXED).count, 2);
  assert.equal(sanitizeState({ count: 8 }, LIBRARY, FIXED).count, 8);
});

test('sanitizeState repairs an unknown theme to the dark default', () => {
  assert.equal(sanitizeState({ theme: 'blue' }, LIBRARY, FIXED).theme, 'dark');
  assert.equal(sanitizeState({}, LIBRARY, FIXED).theme, 'dark');
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

test('a cookie from the single view setting sets colour and both extended switches: extended on, plain off', () => {
  const extended = sanitizeState({ view: 'extended' }, LIBRARY, FIXED);
  assert.deepEqual([extended.colour, extended.roman, extended.tones], [true, true, true]);
  const plain = sanitizeState({ view: 'plain' }, LIBRARY, FIXED);
  assert.equal(plain.colour, false);
  assert.equal(plain.roman, false);
  assert.equal(plain.tones, false);
});

test('a cookie with the old details switch sets the roman numerals and the tones together', () => {
  const off = sanitizeState({ colour: true, details: false }, LIBRARY, FIXED);
  assert.equal(off.roman, false);
  assert.equal(off.tones, false);
  assert.equal(sanitizeState({ details: true }, LIBRARY, FIXED).tones, true);
});

test('the switches in a cookie win over the old view and details settings', () => {
  const state = sanitizeState({ view: 'plain', colour: true, details: false, roman: true, tones: false }, LIBRARY, FIXED);
  assert.equal(state.colour, true);
  assert.equal(state.roman, true);
  assert.equal(state.tones, false);
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

test('sanitizeState keeps only known collapsed sections and at most one expanded section', () => {
  const state = sanitizeState({ collapsed: ['progressionVariations', 'view', 'keys'] }, LIBRARY, FIXED);
  // Three sections were open in the cookie; the first one in section order stays open.
  assert.deepEqual(state.collapsed, ['keys', 'progressionVariations', 'variations', 'bass', 'melody']);
  // A cookie with every section closed keeps them all closed.
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

test('sanitizeState selects every progression, even when the cookie holds an empty or partial selection, and keeps empty variations', () => {
  const empty = sanitizeState({ selection: [], variations: [] }, LIBRARY, FIXED);
  assert.deepEqual(empty.selection, IDS);
  assert.deepEqual(empty.variations, []);
  const missing = sanitizeState({}, LIBRARY, FIXED);
  assert.deepEqual(missing.selection, IDS);
  assert.deepEqual(missing.variations, VARIATION_NAMES);
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
  assert.equal(state.inversionProbability, undefined);
  assert.equal(setProbability(state, 'inversions', 30), state);
});

test('the melody button toggles the inversions on and off, and changes nothing else', () => {
  const state = defaultState(LIBRARY, FIXED);
  const on = applyAction(state, 'toggle-melody', {}, LIBRARY);
  assert.equal(on.inversions, true);
  assert.deepEqual({ ...on, inversions: false }, state);
  assert.equal(applyAction(on, 'toggle-melody', {}, LIBRARY).inversions, false);
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
  assert.equal(applyAction(state, 'cycle-count', {}, LIBRARY).count, 4);
  assert.equal(applyAction(state, 'toggle-colour', {}, LIBRARY).colour, false);
  assert.equal(applyAction(state, 'toggle-roman', {}, LIBRARY).roman, false);
  assert.equal(applyAction(state, 'toggle-tones', {}, LIBRARY).tones, true);
  assert.ok(applyAction(state, 'toggle-section', { section: 'keys' }, LIBRARY).collapsed.includes('keys'));
  assert.deepEqual(applyAction(state, 'open-keys', {}, LIBRARY).collapsed, SECTIONS.filter((section) => section !== 'keys'));
  assert.ok(!applyAction(state, 'toggle-section', { section: 'bass' }, LIBRARY).collapsed.includes('bass'));
  assert.equal(applyAction(state, 'toggle-options', {}, LIBRARY).showOptions, false);
  assert.equal(applyAction(state, 'toggle-theme', {}, LIBRARY).theme, 'light');
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

test('unknown groups, progressions, variations, flags, sections, keys and probabilities leave the state unchanged', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(toggleGroup(state, 'Jazz', LIBRARY), state);
  assert.equal(toggleProgression(state, 'Jazz / X', LIBRARY), state);
  assert.equal(toggleVariation(state, 'no-such-variation'), state);
  assert.equal(toggleFlag(state, 'no-such-flag'), state);
  assert.equal(toggleSection(state, 'no-such-section'), state);
  assert.equal(toggleKey(state, 'H'), state);
  assert.equal(setProbability(state, 'no-such-option', 3), state);
  assert.equal(setProbability(state, 'rotation', 'abc'), state);
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

test('foreign variations are on by default, listed as a flag, and kept by cookies', () => {
  assert.equal(defaultState(LIBRARY, FIXED).foreignVariations, true);
  assert.ok(FLAGS.includes('foreignVariations'));
  assert.equal(sanitizeState({ foreignVariations: false }, LIBRARY, FIXED).foreignVariations, false);
  assert.equal(sanitizeState({ foreignVariations: true }, LIBRARY, FIXED).foreignVariations, true);
  // A cookie without the switch, or with a broken value, keeps the default: on.
  assert.equal(sanitizeState({ rotation: 3 }, LIBRARY, FIXED).foreignVariations, true);
  assert.equal(sanitizeState({ foreignVariations: 'no' }, LIBRARY, FIXED).foreignVariations, true);
});

test('the foreign variations switch toggles on and off, and changes nothing else', () => {
  const state = { ...defaultState(LIBRARY, FIXED), variations: ['7'] };
  const off = applyAction(state, 'toggle-foreign-variations', {}, LIBRARY);
  assert.equal(off.foreignVariations, false);
  assert.deepEqual({ ...off, foreignVariations: true }, state);
  assert.equal(applyAction(off, 'toggle-foreign-variations', {}, LIBRARY).foreignVariations, true);
});

test('the instrument is the piano by default, and a tab sets it to the guitar or back, changing nothing else', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.instrument, 'piano');
  const guitar = applyAction(state, 'set-instrument', { instrument: 'guitar' }, LIBRARY);
  assert.equal(guitar.instrument, 'guitar');
  assert.deepEqual({ ...guitar, instrument: 'piano' }, state);
  assert.equal(applyAction(guitar, 'set-instrument', { instrument: 'piano' }, LIBRARY).instrument, 'piano');
});

test('an unknown instrument leaves the state unchanged', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(applyAction(state, 'set-instrument', { instrument: 'ukulele' }, LIBRARY), state);
});

test('the instrument is kept by cookies; a cookie without it, or with a broken value, is the piano', () => {
  assert.equal(sanitizeState({ instrument: 'guitar' }, LIBRARY, FIXED).instrument, 'guitar');
  assert.equal(sanitizeState({ instrument: 'piano' }, LIBRARY, FIXED).instrument, 'piano');
  assert.equal(sanitizeState({ rotation: 3 }, LIBRARY, FIXED).instrument, 'piano');
  assert.equal(sanitizeState({ instrument: 'harp' }, LIBRARY, FIXED).instrument, 'piano');
});

test('the guitar makes the bass amount and the inversions unavailable, and the other options stay available', () => {
  const guitar = { ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar' };
  assert.equal(isUnavailable(guitar, 'bassProbability'), true);
  assert.equal(isUnavailable(guitar, 'inversions'), true);
  assert.equal(isUnavailable(guitar, 'rotation'), false);
  assert.equal(isUnavailable({ ...guitar, instrument: 'piano' }, 'bassProbability'), false);
});

test('on the guitar the effective settings have no bass and no inversions, but the stored values stay in the state', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar', bassProbability: 4, inversions: true };
  const effective = effectiveState(state);
  assert.equal(effective.bassProbability, 0);
  assert.equal(effective.inversions, false);
  assert.equal(state.bassProbability, 4);
  assert.equal(state.inversions, true);
});

test('on the piano the effective settings are the stored ones', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), bassProbability: 4, inversions: true };
  assert.deepEqual(effectiveState(state), state);
});

test('switching back to the piano restores the bass amount and the inversions as they were set', () => {
  let state = { ...defaultState(LIBRARY, () => 0.5), bassProbability: 4, inversions: true };
  state = applyAction(state, 'set-instrument', { instrument: 'guitar' }, LIBRARY);
  assert.equal(effectiveState(state).bassProbability, 0);
  state = applyAction(state, 'set-instrument', { instrument: 'piano' }, LIBRARY);
  assert.equal(effectiveState(state).bassProbability, 4);
  assert.equal(effectiveState(state).inversions, true);
});

test('on the guitar the bass amount and the inversions cannot be changed, even by an action that reaches them', () => {
  const guitar = { ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar', bassProbability: 4, inversions: false };
  assert.equal(applyAction(guitar, 'toggle-melody', {}, LIBRARY), guitar);
  assert.equal(applyAction(guitar, 'set-probability', { option: 'bassProbability', value: '1' }, LIBRARY), guitar);
  const rotated = applyAction(guitar, 'set-probability', { option: 'rotation', value: '1' }, LIBRARY);
  assert.equal(rotated.rotation, 1);
});

test('on the guitar the bass variations cannot be opened or closed, but the other sections can', () => {
  const guitar = { ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar' };
  assert.equal(applyAction(guitar, 'toggle-section', { section: 'bass' }, LIBRARY), guitar);
  const rotations = applyAction(guitar, 'toggle-section', { section: 'progressionVariations' }, LIBRARY);
  assert.equal(rotations.collapsed.includes('progressionVariations'), !guitar.collapsed.includes('progressionVariations'));
  const piano = applyAction(guitar, 'set-instrument', { instrument: 'piano' }, LIBRARY);
  assert.equal(applyAction(piano, 'toggle-section', { section: 'bass' }, LIBRARY).collapsed.includes('bass'), !piano.collapsed.includes('bass'));
});

test('the melody amount is on the scale from 0 to 5, starts at 2, and is kept in the cookie', () => {
  const state = defaultState(LIBRARY, () => 0.5);
  assert.equal(state.melodyAmount, 2);
  assert.equal(setProbability(state, 'melodyAmount', 9).melodyAmount, 5);
  assert.equal(setProbability(state, 'melodyAmount', -1).melodyAmount, 0);
  assert.equal(sanitizeState({ melodyAmount: 4 }, LIBRARY, FIXED).melodyAmount, 4);
  assert.equal(sanitizeState({ melodyAmount: 'high' }, LIBRARY, FIXED).melodyAmount, 2);
  assert.equal(sanitizeState({}, LIBRARY, FIXED).melodyAmount, 2);
});

test('the melody variations section comes last, after bass, and an older cookie without it opens the section it had open', () => {
  assert.equal(SECTIONS.at(-1), 'melody');
  // A cookie from before the section existed had the bass section open: it stays open, and melody stays closed.
  const older = sanitizeState({ collapsed: ['keys', 'progressions', 'progressionVariations', 'variations'] }, LIBRARY, FIXED);
  assert.deepEqual(older.collapsed, ['keys', 'progressions', 'progressionVariations', 'variations', 'melody']);
});

test('on the guitar the melody amount cannot be changed and takes no effect, and the stored value comes back on the piano', () => {
  const guitar = { ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar', melodyAmount: 4, inversions: true };
  assert.equal(isUnavailable(guitar, 'melodyAmount'), true);
  assert.equal(effectiveState(guitar).melodyAmount, 0);
  assert.equal(applyAction(guitar, 'set-probability', { option: 'melodyAmount', value: '1' }, LIBRARY), guitar);
  assert.equal(applyAction(guitar, 'toggle-section', { section: 'melody' }, LIBRARY), guitar);
  const piano = applyAction(guitar, 'set-instrument', { instrument: 'piano' }, LIBRARY);
  assert.equal(effectiveState(piano).melodyAmount, 4);
  assert.equal(applyAction(piano, 'toggle-section', { section: 'melody' }, LIBRARY).collapsed.includes('melody'), !piano.collapsed.includes('melody'));
});

test('with the melody button off the melody amount is unavailable on the piano too, and the stored value comes back when it is switched on', () => {
  const off = { ...defaultState(LIBRARY, () => 0.5), instrument: 'piano', inversions: false, melodyAmount: 4 };
  assert.equal(isUnavailable(off, 'melodyAmount'), true);
  assert.equal(effectiveState(off).melodyAmount, 0);
  assert.equal(applyAction(off, 'set-probability', { option: 'melodyAmount', value: '1' }, LIBRARY), off);
  assert.equal(applyAction(off, 'toggle-section', { section: 'melody' }, LIBRARY), off);
  // Switching the melody button on is not blocked by the melody amount, and brings the stored amount back.
  const on = applyAction(off, 'toggle-melody', {}, LIBRARY);
  assert.equal(on.inversions, true);
  assert.equal(isUnavailable(on, 'melodyAmount'), false);
  assert.equal(effectiveState(on).melodyAmount, 4);
});
