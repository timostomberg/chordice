import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COOKIE_NAME,
  DEVICE_SETTINGS,
  STORAGE_KEY,
  cookiePathOf,
  parseCookie,
  parseStored,
  readState,
  sanitizeState,
  serializeCookie,
  serializeSettings,
  serializeStored,
  withSettings,
} from '../../../../chordice/app/state/persistence.js';
import { defaultState, SECTIONS } from '../../../../chordice/app/state/state.js';
import { SEED_NAMES } from '../../../../chordice/music/generator/random.js';
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
  // The stored selection is kept, without the progressions the library does not have.
  assert.deepEqual(state.selection, ['Pop / A']);
  assert.equal(state.count, 4);
  assert.equal(state.rotation, 4);
  assert.equal(state.permutation, 2);
  assert.deepEqual(state.variations, ['add9']);
  assert.equal(state.variationProbability, 4);
  assert.equal(state.bassProbability, 1);
  assert.equal(state.colour, true);
  assert.equal(state.roman, true);
  assert.equal(state.tones, false);
  assert.equal(state.theme, 'dark');
  assert.equal(state.showOptions, false);
  assert.equal(typeof state.seeds.progression, 'number');
  assert.deepEqual(Object.keys(state.seeds).sort(), [...SEED_NAMES].sort());
});

test('sanitizeState keeps only a major key, and repairs a count that is not offered to the default of 4', () => {
  assert.equal(sanitizeState({ key: 'Gb' }, LIBRARY, FIXED).key, 'Gb');
  assert.equal(sanitizeState({ key: 'Am' }, LIBRARY, FIXED).key, 'C');
  assert.equal(sanitizeState({ key: ['G'] }, LIBRARY, FIXED).key, 'C');
  assert.equal(sanitizeState({ count: 12 }, LIBRARY, FIXED).count, 4);
  assert.equal(sanitizeState({ count: 8 }, LIBRARY, FIXED).count, 8);
});

test('sanitizeState repairs an unknown theme to the light default', () => {
  assert.equal(sanitizeState({ theme: 'blue' }, LIBRARY, FIXED).theme, 'light');
  assert.equal(sanitizeState({}, LIBRARY, FIXED).theme, 'light');
});

test('sanitizeState keeps only known collapsed sections, and every open section open', () => {
  // 'keys' was the Keys section of the options, which is gone (the key is chosen beside the chords).
  const state = sanitizeState({ collapsed: ['progressionVariations', 'unknown', 'keys', 'bass'] }, LIBRARY, FIXED);
  // Three sections were open in the cookie; they all stay open.
  assert.deepEqual(state.collapsed, ['progressionVariations', 'bass']);
  // A cookie with every section closed keeps them all closed.
  assert.deepEqual(sanitizeState({ collapsed: SECTIONS }, LIBRARY, FIXED).collapsed, SECTIONS);
  assert.deepEqual(sanitizeState({ collapsed: 'keys' }, LIBRARY, FIXED).collapsed, defaultState(LIBRARY, FIXED).collapsed);
});

test('sanitizeState keeps the stored selection, also an empty one, and keeps empty variations', () => {
  const empty = sanitizeState({ selection: [], variations: [] }, LIBRARY, FIXED);
  assert.deepEqual(empty.selection, []);
  assert.deepEqual(empty.variations, []);
  // The stored order does not matter: the selection follows the order of the library.
  assert.deepEqual(sanitizeState({ selection: ['Rock / C', 'Pop / A'] }, LIBRARY, FIXED).selection, ['Pop / A', 'Rock / C']);
  const missing = sanitizeState({}, LIBRARY, FIXED);
  assert.deepEqual(missing.selection, ['Pop / A', 'Pop / B']);
  assert.deepEqual(missing.variations, ['7', 'maj7', '6', 'add9', 'sus2', 'sus4']);
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
  // A cookie without the switch, or with a broken value, keeps the default: off.
  assert.equal(sanitizeState({ rotation: 3 }, LIBRARY, FIXED).foreignVariations, false);
  assert.equal(sanitizeState({ foreignVariations: 'no' }, LIBRARY, FIXED).foreignVariations, false);
});

test('the instrument is kept by cookies; a cookie without it, or with a broken value, is the piano', () => {
  assert.equal(sanitizeState({ instrument: 'guitar' }, LIBRARY, FIXED).instrument, 'guitar');
  assert.equal(sanitizeState({ instrument: 'piano' }, LIBRARY, FIXED).instrument, 'piano');
  assert.equal(sanitizeState({ rotation: 3 }, LIBRARY, FIXED).instrument, 'piano');
  assert.equal(sanitizeState({ instrument: 'harp' }, LIBRARY, FIXED).instrument, 'piano');
});

test('the melody amount is kept in the cookie, and a broken or missing one is the default', () => {
  assert.equal(sanitizeState({ melodyAmount: 4 }, LIBRARY, FIXED).melodyAmount, 4);
  assert.equal(sanitizeState({ melodyAmount: 'high' }, LIBRARY, FIXED).melodyAmount, 1);
  assert.equal(sanitizeState({}, LIBRARY, FIXED).melodyAmount, 1);
});

test('a cookie that does not list a section as collapsed keeps that section open', () => {
  // The cookie lists every section but bass and melody: both stay open.
  const older = sanitizeState({ collapsed: ['keys', 'progressions', 'progressionVariations', 'variations'] }, LIBRARY, FIXED);
  assert.deepEqual(older.collapsed, ['progressions', 'progressionVariations', 'variations']);
});

test('sanitizeState keeps the Exercises box closed or open as stored, apart from the options sections', () => {
  assert.deepEqual(sanitizeState({ collapsed: ['exercises', 'progressions'] }, LIBRARY, FIXED).collapsed, ['progressions', 'exercises']);
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

test('the cookie keeps the selection with everything else', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), selection: ['Rock / C'], count: 4 };
  const cookie = serializeCookie(state);
  const stored = JSON.parse(decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1, cookie.indexOf(';'))));
  assert.deepEqual(stored.selection, ['Rock / C']);
  assert.equal(stored.count, 4);
  assert.deepEqual(sanitizeState(parseCookie(cookie), LIBRARY, () => 0.5).selection, ['Rock / C']);
});

test('a stored selection of which the library has no progression left falls back to the default selection', () => {
  assert.deepEqual(sanitizeState({ selection: ['Gone / X', 'Gone / Y'] }, LIBRARY, FIXED).selection, ['Pop / A', 'Pop / B']);
  assert.deepEqual(sanitizeState({ selection: 'Pop / A' }, LIBRARY, FIXED).selection, ['Pop / A', 'Pop / B']);
});

test('the cookie with every progression of the real library selected stays well below the 4 KB cookie limit', async () => {
  const { LIBRARY: REAL } = await import('../../../helpers/fixtures.js');
  const state = { ...defaultState(REAL, FIXED), selection: REAL.map((progression) => progression.id) };
  assert.ok(serializeCookie(state, '/chordice/').length < 3000);
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

test('the stored copy of the state survives a round trip, and keeps the selection like the cookie', () => {
  const state = { ...defaultState(LIBRARY, FIXED), count: 8, theme: 'dark', selection: ['Rock / C'] };
  const raw = parseStored(serializeStored(state));
  assert.deepEqual(raw.selection, ['Rock / C']);
  assert.deepEqual(sanitizeState(raw, LIBRARY), sanitizeState(parseCookie(serializeCookie(state)), LIBRARY));
  assert.equal(raw.count, 8);
});

test('a missing or broken stored copy reads as null', () => {
  assert.equal(parseStored(null), null);
  assert.equal(parseStored(undefined), null);
  assert.equal(parseStored('{broken'), null);
});

test('the page starts from the cookie, and from the stored copy once the cookie is gone or broken', () => {
  const fromCookie = { ...defaultState(LIBRARY, FIXED), count: 1 };
  const fromStorage = { ...defaultState(LIBRARY, FIXED), count: 8 };
  assert.equal(readState(serializeCookie(fromCookie), serializeStored(fromStorage)).count, 1);
  assert.equal(readState('', serializeStored(fromStorage)).count, 8);
  assert.equal(readState(`${COOKIE_NAME}=%7Bbroken`, serializeStored(fromStorage)).count, 8);
  assert.equal(readState('', null), null);
});

test('the stored copy has the name of the cookie, which names Chordice, as the projects on one host share the local storage', () => {
  assert.equal(STORAGE_KEY, COOKIE_NAME);
});

test('the cookie and the stored copy leave out the saved songs, which have a storage of their own, and keep the frozen song', () => {
  const state = { ...defaultState(LIBRARY, FIXED), songs: [{ id: 'a' }], frozen: 'a' };
  const cookie = serializeCookie(state);
  const fromCookie = JSON.parse(decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1, cookie.indexOf(';'))));
  assert.equal('songs' in fromCookie, false);
  assert.equal(fromCookie.frozen, 'a');
  assert.equal('songs' in parseStored(serializeStored(state)), false);
  const read = sanitizeState(fromCookie, LIBRARY, FIXED);
  assert.deepEqual(read.songs, []);
  assert.equal(read.frozen, 'a');
});

test('a broken frozen song in the cookie is none', () => {
  assert.equal(sanitizeState({ frozen: 3 }, LIBRARY, FIXED).frozen, null);
  assert.equal(sanitizeState({ frozen: '' }, LIBRARY, FIXED).frozen, null);
  assert.equal(sanitizeState({}, LIBRARY, FIXED).frozen, null);
});

test('the settings of an account leave out the saved songs and whether the side panel is open and what it shows', () => {
  const state = { ...defaultState(LIBRARY, FIXED), key: 'E', showOptions: false, panel: 'songs', songs: [{ id: 'a' }] };
  const settings = JSON.parse(serializeSettings(state));
  assert.deepEqual(DEVICE_SETTINGS, ['showOptions', 'panel']);
  for (const name of [...DEVICE_SETTINGS, 'songs']) {
    assert.ok(!Object.hasOwn(settings, name), `${name} is left out`);
  }
  assert.equal(settings.key, 'E');
  // The song that is shown is synced across the devices.
  assert.deepEqual(settings.seeds, state.seeds);
});

test('withSettings takes the settings of an account, and keeps the songs and the side panel of the device', () => {
  const songs = [{ id: 'a' }];
  const here = { ...defaultState(LIBRARY, FIXED), showOptions: false, panel: 'account', songs };
  const there = { ...defaultState(LIBRARY, () => 0.9), key: 'A', theme: 'dark', instrument: 'guitar', showOptions: true, panel: 'help' };
  const next = withSettings(here, serializeSettings(there), LIBRARY);
  assert.deepEqual(next, { ...there, showOptions: false, panel: 'account', songs });
  assert.equal(next.songs, songs);
});

test('withSettings makes the settings of an account valid, and leaves the state as it is for broken ones', () => {
  const state = defaultState(LIBRARY, FIXED);
  const next = withSettings(state, JSON.stringify({ key: 'nowhere', theme: 'dark', count: 3 }), LIBRARY, FIXED);
  assert.equal(next.key, 'C');
  assert.equal(next.theme, 'dark');
  assert.equal(next.count, 4);
  for (const broken of ['{', '[]', 'null', '7', null]) {
    assert.equal(withSettings(state, broken, LIBRARY), state);
  }
});
