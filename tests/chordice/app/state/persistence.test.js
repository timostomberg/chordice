import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COOKIE_NAME, cookiePathOf, parseCookie, sanitizeState, serializeCookie } from '../../../../chordice/app/state/persistence.js';
import { defaultState, SECTIONS } from '../../../../chordice/app/state/state.js';
import { SEED_NAMES } from '../../../../chordice/music/generator/random.js';
import { VARIATION_NAMES } from '../../../../chordice/music/theory/chords.js';
import { FIXED, SMALL_LIBRARY } from '../../../helpers/fixtures.js';

const LIBRARY = SMALL_LIBRARY;
const IDS = LIBRARY.map((progression) => progression.id);

test('sanitizeState falls back to defaults for missing or broken input', () => {
  const defaults = defaultState(LIBRARY, FIXED);
  assert.deepEqual(sanitizeState(null, LIBRARY, FIXED), defaults);
  assert.deepEqual(sanitizeState('oops', LIBRARY, FIXED), defaults);
});

test('sanitizeState keeps valid values and repairs invalid ones', () => {
  const state = sanitizeState({
    key: 'D',
    selection: ['Pop / A', 'Unknown / Z'],
    count: 3,
    rotation: 4,
    permutation: 2,
    variations: ['add9', 'nope'],
    variationProbability: 6,
    bassProbability: 1,
    colour: 'yes',
    theme: 'dark',
    showOptions: false,
    seeds: { progression: -1 },
  }, LIBRARY, FIXED);
  assert.equal(state.key, 'D');
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

test('sanitizeState keeps only a major key, and repairs a count that is not offered to the default of 2', () => {
  assert.equal(sanitizeState({ key: 'Gb' }, LIBRARY, FIXED).key, 'Gb');
  assert.equal(sanitizeState({ key: 'Am' }, LIBRARY, FIXED).key, 'C');
  assert.equal(sanitizeState({ key: ['G'] }, LIBRARY, FIXED).key, 'C');
  assert.equal(sanitizeState({ count: 12 }, LIBRARY, FIXED).count, 2);
  assert.equal(sanitizeState({ count: 8 }, LIBRARY, FIXED).count, 8);
});

test('sanitizeState repairs an unknown theme to the light default', () => {
  assert.equal(sanitizeState({ theme: 'blue' }, LIBRARY, FIXED).theme, 'light');
  assert.equal(sanitizeState({}, LIBRARY, FIXED).theme, 'light');
});

test('sanitizeState keeps only known collapsed sections and at most one expanded section', () => {
  const state = sanitizeState({ collapsed: ['progressionVariations', 'unknown', 'keys'] }, LIBRARY, FIXED);
  // Three sections were open in the cookie; the first one in section order stays open.
  assert.deepEqual(state.collapsed, ['keys', 'progressionVariations', 'variations', 'bass', 'melody']);
  // A cookie with every section closed keeps them all closed.
  assert.deepEqual(sanitizeState({ collapsed: SECTIONS }, LIBRARY, FIXED).collapsed, SECTIONS);
  assert.deepEqual(sanitizeState({ collapsed: 'keys' }, LIBRARY, FIXED).collapsed, defaultState(LIBRARY, FIXED).collapsed);
});

test('sanitizeState selects every progression, even when the cookie holds an empty or partial selection, and keeps empty variations', () => {
  const empty = sanitizeState({ selection: [], variations: [] }, LIBRARY, FIXED);
  assert.deepEqual(empty.selection, IDS);
  assert.deepEqual(empty.variations, []);
  const missing = sanitizeState({}, LIBRARY, FIXED);
  assert.deepEqual(missing.selection, IDS);
  assert.deepEqual(missing.variations, VARIATION_NAMES);
});

test('the inversions switch is kept by cookies; a cookie without it, or with a broken value, is off', () => {
  assert.equal(sanitizeState({ inversions: true }, LIBRARY, FIXED).inversions, true);
  assert.equal(sanitizeState({ inversions: 'yes' }, LIBRARY, FIXED).inversions, false);
  assert.equal(sanitizeState({ rotation: 20 }, LIBRARY, FIXED).inversions, false);
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

test('foreign variations are kept by cookies', () => {
  assert.equal(sanitizeState({ foreignVariations: false }, LIBRARY, FIXED).foreignVariations, false);
  assert.equal(sanitizeState({ foreignVariations: true }, LIBRARY, FIXED).foreignVariations, true);
  // A cookie without the switch, or with a broken value, keeps the default: on.
  assert.equal(sanitizeState({ rotation: 3 }, LIBRARY, FIXED).foreignVariations, true);
  assert.equal(sanitizeState({ foreignVariations: 'no' }, LIBRARY, FIXED).foreignVariations, true);
});

test('the instrument is kept by cookies; a cookie without it, or with a broken value, is the piano', () => {
  assert.equal(sanitizeState({ instrument: 'guitar' }, LIBRARY, FIXED).instrument, 'guitar');
  assert.equal(sanitizeState({ instrument: 'piano' }, LIBRARY, FIXED).instrument, 'piano');
  assert.equal(sanitizeState({ rotation: 3 }, LIBRARY, FIXED).instrument, 'piano');
  assert.equal(sanitizeState({ instrument: 'harp' }, LIBRARY, FIXED).instrument, 'piano');
});

test('the melody amount is kept in the cookie, and a broken or missing one is the default', () => {
  assert.equal(sanitizeState({ melodyAmount: 4 }, LIBRARY, FIXED).melodyAmount, 4);
  assert.equal(sanitizeState({ melodyAmount: 'high' }, LIBRARY, FIXED).melodyAmount, 2);
  assert.equal(sanitizeState({}, LIBRARY, FIXED).melodyAmount, 2);
});

test('a cookie that does not list a section as collapsed keeps its one open section open, and closes the section it does not know', () => {
  // The cookie lists every section but bass and melody: bass, the first of them, stays open, and melody is closed.
  const older = sanitizeState({ collapsed: ['keys', 'progressions', 'progressionVariations', 'variations'] }, LIBRARY, FIXED);
  assert.deepEqual(older.collapsed, ['keys', 'progressions', 'progressionVariations', 'variations', 'melody']);
});

test('sanitizeState keeps the Exercises box closed or open as stored, apart from the options sections', () => {
  assert.deepEqual(sanitizeState({ collapsed: ['exercises', 'progressions'] }, LIBRARY, FIXED).collapsed, [...SECTIONS.filter((name) => name !== 'keys'), 'exercises']);
  assert.ok(!sanitizeState({ collapsed: SECTIONS }, LIBRARY, FIXED).collapsed.includes('exercises'));
  const stored = sanitizeState(parseCookie(serializeCookie({ ...defaultState(LIBRARY, FIXED), collapsed: [...SECTIONS, 'exercises'] }).split(';')[0]), LIBRARY, FIXED);
  assert.deepEqual(stored.collapsed, [...SECTIONS, 'exercises']);
});

test('sanitizeState keeps the panel of the side panel, and falls back to the options for an unknown or missing one', () => {
  assert.equal(sanitizeState({ panel: 'exercises' }, LIBRARY, FIXED).panel, 'exercises');
  assert.equal(sanitizeState({ panel: 'options' }, LIBRARY, FIXED).panel, 'options');
  assert.equal(sanitizeState({ panel: 'help' }, LIBRARY, FIXED).panel, 'help');
  assert.equal(sanitizeState({ panel: 'notes' }, LIBRARY, FIXED).panel, 'options');
  assert.equal(sanitizeState({}, LIBRARY, FIXED).panel, 'options');
});

test('a cookie with every options section collapsed opens none of them', () => {
  const older = sanitizeState({ collapsed: ['keys', 'progressions', 'progressionVariations', 'variations', 'bass', 'melody'] }, LIBRARY, FIXED);
  assert.deepEqual(older.collapsed, SECTIONS);
});

test('the cookie leaves out the selection, which start-up never reads back, and keeps everything else', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), selection: ['Pop / A'], count: 4 };
  const cookie = serializeCookie(state);
  const stored = JSON.parse(decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1, cookie.indexOf(';'))));
  assert.equal('selection' in stored, false);
  assert.equal(stored.count, 4);
  assert.deepEqual(sanitizeState(parseCookie(cookie), LIBRARY, () => 0.5).selection, LIBRARY.map((progression) => progression.id));
});

test('the circle of fifths switch is kept in the cookie, and a broken one is off', () => {
  const on = { ...defaultState(LIBRARY, FIXED), circleOfFifths: true };
  assert.equal(sanitizeState(parseCookie(serializeCookie(on)), LIBRARY, FIXED).circleOfFifths, true);
  assert.equal(sanitizeState({ circleOfFifths: 'yes' }, LIBRARY, FIXED).circleOfFifths, false);
});

test('the enharmonic seed is created and kept in the cookie like the other seeds', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.ok(Number.isInteger(state.seeds.enharmonic));
  assert.equal(sanitizeState(parseCookie(serializeCookie(state)), LIBRARY, FIXED).seeds.enharmonic, state.seeds.enharmonic);
});

test('cookiePathOf is the folder of the page, so the cookie does not reach other projects on the same host', () => {
  assert.equal(cookiePathOf('/chordice/index.html'), '/chordice/');
  assert.equal(cookiePathOf('/chordice/'), '/chordice/');
  assert.equal(cookiePathOf('/index.html'), '/');
  assert.equal(cookiePathOf('/'), '/');
  // Without a path (e.g. about:blank) the cookie is kept for "/".
  assert.equal(cookiePathOf('blank'), '/');
  assert.equal(cookiePathOf(undefined), '/');
});

test('serializeCookie keeps the state for the path it is given, "/" by default', () => {
  const state = defaultState(LIBRARY, () => 0.5);
  assert.ok(serializeCookie(state, '/chordice/').includes('; Path=/chordice/;'));
  assert.ok(serializeCookie(state).includes('; Path=/;'));
});

test('the exercise is kept in the cookie, and an unknown exercise in the cookie is dropped', () => {
  const on = { ...defaultState(LIBRARY, FIXED), exercise: 'circle-ii-v-i' };
  assert.equal(sanitizeState(parseCookie(serializeCookie(on)), LIBRARY, FIXED).exercise, 'circle-ii-v-i');
  assert.equal(sanitizeState({ exercise: 'unknown' }, LIBRARY, FIXED).exercise, null);
  assert.equal(sanitizeState({}, LIBRARY, FIXED).exercise, null);
});

test('the painting switch is kept in the cookie, and is on when the cookie does not say', () => {
  const off = { ...defaultState(SMALL_LIBRARY, FIXED), painting: false };
  assert.equal(sanitizeState(parseCookie(serializeCookie(off)), SMALL_LIBRARY, FIXED).painting, false);
  assert.equal(sanitizeState({}, SMALL_LIBRARY, FIXED).painting, true);
  assert.equal(sanitizeState({ painting: 'maybe' }, SMALL_LIBRARY, FIXED).painting, true);
});
