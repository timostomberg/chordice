import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAME_LIMIT,
  SONGS_KEY,
  SONG_LIMIT,
  defaultSongName,
  deleteSong,
  formatDate,
  frozenSong,
  hasChanges,
  keyLabel,
  loadSong,
  mergeSongs,
  parseSongs,
  recipeOf,
  renameSong,
  saveSong,
  serializeSongs,
  shownSong,
  songChanges,
  songSnapshot,
  songsFromRecord,
  songsFull,
  songsRecord,
  unfreezeSong,
  withSongs,
} from '../../../../chordice/app/state/songs.js';
import { RECIPE_OPTIONS, defaultState, reroll } from '../../../../chordice/app/state/state.js';
import { isUnavailable, effectiveState } from '../../../../chordice/app/state/availability.js';
import { applyAction } from '../../../../chordice/app/state/actions.js';
import { buildLibrary } from '../../../../chordice/music/data/validate.js';
import { BASS_PATTERNS, LIBRARY } from '../../../helpers/fixtures.js';

const DATE = new Date(2026, 10, 27, 9, 5);

/** A state with bass notes, variations and inversions on, so a saved song holds every kind of choice. */
function richState(library = LIBRARY) {
  return {
    ...defaultState(library, () => 0.3),
    bassProbability: 3,
    variationProbability: 4,
    inversions: true,
    melodyAmount: 2,
    count: 8,
  };
}

function saved(state, { id = 'a', name = 'My song', library = LIBRARY } = {}) {
  return saveSong(state, { id, name, date: DATE, library, bassPatterns: BASS_PATTERNS });
}

/** The chord symbols of the song a state shows. */
function symbols(state, library = LIBRARY) {
  return shownSong(state, library, BASS_PATTERNS).rows.map((row) => row.chords.map((chord) => chord.displaySymbol));
}

test('the saved songs have a key of their own in the local storage', () => {
  assert.equal(SONGS_KEY, 'chordice_songs');
});

test('the recipe holds the options that make the song and the seeds, and nothing of the view', () => {
  const state = richState();
  const recipe = recipeOf(state);
  assert.deepEqual(Object.keys(recipe).sort(), [...RECIPE_OPTIONS, 'seeds'].sort());
  assert.deepEqual(recipe.seeds, state.seeds);
  assert.notEqual(recipe.selection, state.selection, 'a copy, not the array of the state');
  for (const view of ['theme', 'instrument', 'colour', 'roman', 'tones', 'painting', 'panel', 'showOptions']) {
    assert.ok(!(view in recipe), view);
  }
});

test('a song saved without a name is named after the date and time it was saved, year first, without its key', () => {
  assert.equal(formatDate(DATE), '2026 Nov 27');
  assert.equal(formatDate(new Date(2026, 0, 3)), '2026 Jan 3');
  assert.equal(keyLabel({ key: 'Eb', circleOfFifths: false }), 'Eb (Cm)');
  assert.equal(keyLabel({ key: 'C', circleOfFifths: true }), 'All keys');
  assert.equal(defaultSongName(DATE), '2026 Nov 27 · 09:05');
  assert.equal(defaultSongName(new Date(2026, 0, 3, 23, 0)), '2026 Jan 3 · 23:00');
  const state = saved({ ...defaultState(LIBRARY, () => 0.3), key: 'G' }, { name: '   ' });
  assert.equal(state.songs[0].name, '2026 Nov 27 · 09:05');
});

test('saveSong puts the song first in the list, with its recipe, its snapshot and the date', () => {
  const first = saved(richState(), { id: 'a', name: '  First  ' });
  const both = saved(first, { id: 'b', name: 'x'.repeat(NAME_LIMIT + 10) });
  assert.deepEqual(both.songs.map((song) => song.id), ['b', 'a']);
  assert.equal(first.songs[0].name, 'First');
  assert.equal(both.songs[0].name.length, NAME_LIMIT);
  assert.equal(first.songs[0].savedAt, DATE.toISOString());
  assert.deepEqual(first.songs[0].recipe, recipeOf(richState()));
  assert.deepEqual(first.songs[0].song, songSnapshot(richState(), LIBRARY, BASS_PATTERNS));
  // Saving changes nothing else.
  assert.deepEqual({ ...first, songs: [] }, { ...richState(), songs: [] });
});

test('a song saved while the guitar is chosen keeps its bass notes and inversions for the piano', () => {
  const piano = saved(richState()).songs[0].song;
  const guitar = saved({ ...richState(), instrument: 'guitar' }).songs[0].song;
  assert.deepEqual(guitar, piano);
  assert.ok(piano.rows.some((row) => row.chords.some((chord) => chord.bass !== null)));
  assert.equal(piano.melody, true);
});

test('loading a song brings back its options and seeds, and keeps the view, the instrument and the panel', () => {
  const original = richState();
  const withSong = saved(original);
  const changed = {
    ...reroll(withSong, () => 0.9),
    key: 'A',
    count: 2,
    bassProbability: 0,
    theme: 'dark',
    instrument: 'guitar',
    panel: 'songs',
    roman: false,
  };
  const loaded = loadSong(changed, 'a', LIBRARY, BASS_PATTERNS);
  for (const option of RECIPE_OPTIONS) {
    assert.deepEqual(loaded[option], original[option], option);
  }
  assert.deepEqual(loaded.seeds, original.seeds);
  assert.equal(loaded.theme, 'dark');
  assert.equal(loaded.instrument, 'guitar');
  assert.equal(loaded.panel, 'songs');
  assert.equal(loaded.roman, false);
  assert.equal(loaded.songs, changed.songs);
  // The song is the same, so it is not frozen: every option works on it as usual.
  assert.equal(loaded.frozen, null);
  assert.deepEqual(symbols({ ...loaded, instrument: 'piano' }), symbols(original));
});

test('an unknown song id loads nothing', () => {
  const state = saved(richState());
  assert.equal(loadSong(state, 'unknown', LIBRARY, BASS_PATTERNS), state);
});

/** The library of an older version: the same progressions, but Pop / A has other chords. */
const OLD = buildLibrary({
  Pop: { progressions: { A: ['I', 'V', 'vi', 'IV'], B: ['I', 'IV'] } },
  Rock: { progressions: { C: ['I', 'IV', 'V'] } },
});
const NEW = buildLibrary({
  Pop: { progressions: { A: ['I', 'vi', 'IV', 'V'], B: ['I', 'IV'] } },
  Rock: { progressions: { C: ['I', 'IV', 'V'] } },
});

test('a song whose options now give another song, as the progressions have changed, is loaded frozen and shown as saved', () => {
  const state = { ...defaultState(OLD, () => 0.3), selection: ['Pop / A'], count: 2 };
  const withSong = saveSong(state, { id: 'a', name: 'Old', date: DATE, library: OLD, bassPatterns: BASS_PATTERNS });
  const before = symbols(withSong, OLD);

  // A newer version of the page: the progression has other chords now.
  const loaded = loadSong({ ...withSong, key: 'D' }, 'a', NEW, BASS_PATTERNS);
  assert.equal(loaded.frozen, 'a');
  assert.equal(frozenSong(loaded), withSong.songs[0]);
  assert.deepEqual(symbols(loaded, NEW), before, 'the song shown is the one saved');
  assert.notDeepEqual(symbols(unfreezeSong(loaded), NEW), before, 'the options alone now give another song');
  // Its options are those of the recipe, also while frozen.
  assert.equal(loaded.key, 'C');
});

test('a song whose progression is gone falls back to the default selection and is loaded frozen', () => {
  const state = { ...defaultState(OLD, () => 0.3), selection: ['Rock / C'] };
  const withSong = saveSong(state, { id: 'a', name: 'Rock', date: DATE, library: OLD, bassPatterns: BASS_PATTERNS });
  const gone = buildLibrary({ Pop: { progressions: { A: ['I', 'V'] } } });
  const loaded = loadSong(withSong, 'a', gone, BASS_PATTERNS);
  assert.deepEqual(loaded.selection, ['Pop / A']);
  assert.equal(loaded.frozen, 'a');
  assert.equal(shownSong(loaded, gone, BASS_PATTERNS).rows[0].name, 'C');
});

test('a song of an exercise that is gone is loaded frozen, without the exercise', () => {
  const state = { ...richState(), exercise: 'circle-ii-v-i' };
  const withSong = saved(state);
  const song = { ...withSong.songs[0], recipe: { ...withSong.songs[0].recipe, exercise: 'gone' } };
  // The recipe names an exercise the page no longer has; the snapshot is still that of the exercise.
  const loaded = loadSong({ ...withSong, songs: [song] }, 'a', LIBRARY, BASS_PATTERNS);
  assert.equal(loaded.exercise, null);
  assert.equal(loaded.frozen, 'a');
  assert.equal(shownSong(loaded, LIBRARY, BASS_PATTERNS).showKey, true, 'the rows keep their keys as saved');
  assert.equal(shownSong(loaded, LIBRARY, BASS_PATTERNS).rows.length, 12);
});

test('while a song is frozen, the options that make the song are fixed, but keep their values; the view is not fixed', () => {
  const frozen = { ...saved(richState()), frozen: 'a' };
  for (const option of RECIPE_OPTIONS) {
    assert.equal(isUnavailable(frozen, option), true, option);
  }
  for (const option of ['colour', 'roman', 'tones', 'painting', 'theme', 'instrument']) {
    assert.equal(isUnavailable(frozen, option), false, option);
  }
  // Fixing does not change what the options are: the count is not that of the circle, the bass amount is not 0.
  assert.equal(effectiveState(frozen).count, 8);
  assert.equal(effectiveState(frozen).bassProbability, 3);
  assert.equal(applyAction(frozen, 'cycle-count', {}, LIBRARY), frozen);
  assert.equal(applyAction(frozen, 'toggle-exercise', { exercise: 'circle-ii-v-i' }, LIBRARY), frozen);
  assert.equal(applyAction(frozen, 'set-key', { key: 'D' }, LIBRARY), frozen);
  assert.equal(applyAction(frozen, 'toggle-roman', {}, LIBRARY).roman, false);
});

test('a frozen song on the guitar has no bass notes and no melody note, and gets them back on the piano', () => {
  const frozen = { ...saved(richState()), frozen: 'a' };
  const guitar = shownSong({ ...frozen, instrument: 'guitar' }, LIBRARY, BASS_PATTERNS);
  assert.equal(guitar.melody, false);
  assert.ok(guitar.rows.every((row) => row.chords.every((chord) => chord.bass === null && chord.inversion === 0)));
  const piano = shownSong(frozen, LIBRARY, BASS_PATTERNS);
  assert.equal(piano.melody, true);
  assert.deepEqual(piano.rows, frozen.songs[0].song.rows);
});

test('New Song and Generate anew end the frozen song; generating anew keeps its options', () => {
  const frozen = { ...saved(richState()), frozen: 'a' };
  assert.equal(reroll(frozen, () => 0.9).frozen, null);
  const anew = unfreezeSong(frozen);
  assert.equal(anew.frozen, null);
  assert.deepEqual(recipeOf(anew), recipeOf(frozen));
  const live = saved(richState());
  assert.equal(unfreezeSong(live), live);
});

test('deleteSong removes the song; a frozen song that is deleted is generated from its options again', () => {
  const two = saved(saved(richState(), { id: 'a' }), { id: 'b' });
  assert.deepEqual(deleteSong(two, 'a').songs.map((song) => song.id), ['b']);
  assert.equal(deleteSong(two, 'unknown'), two);
  assert.equal(deleteSong({ ...two, frozen: 'a' }, 'a').frozen, null);
  assert.equal(deleteSong({ ...two, frozen: 'b' }, 'a').frozen, 'b');
});

test('the saved songs survive the local storage', () => {
  const state = saved(saved(richState(), { id: 'a' }), { id: 'b', name: 'Second' });
  assert.deepEqual(parseSongs(serializeSongs(state.songs)), state.songs);
});

test('parseSongs leaves out broken songs and second songs with the same id, and gives no songs for a broken text', () => {
  const [song] = saved(richState()).songs;
  assert.deepEqual(parseSongs(null), []);
  assert.deepEqual(parseSongs('{oops'), []);
  assert.deepEqual(parseSongs('{"a": 1}'), []);
  const raw = [
    song,
    { ...song, name: 'Same id' },
    { ...song, id: '' },
    { ...song, id: 'no-song', song: { rows: 'x' } },
    { ...song, id: 'no-date', savedAt: 'yesterday' },
    { ...song, id: 'no-recipe', recipe: null },
    { ...song, id: 'no-name', name: '  ' },
    42,
  ];
  const songs = parseSongs(JSON.stringify(raw));
  assert.deepEqual(songs.map((entry) => entry.id), ['a', 'no-name']);
  assert.equal(songs[0].name, 'My song');
  assert.equal(songs[1].name, 'Song');
});

test('withSongs puts the saved songs into the state, and ends a frozen song that is not among them', () => {
  const [song] = saved(richState()).songs;
  const state = defaultState(LIBRARY, () => 0.3);
  assert.deepEqual(withSongs({ ...state, frozen: 'a' }, [song]).frozen, 'a');
  assert.deepEqual(withSongs({ ...state, frozen: 'a' }, [song]).songs, [song]);
  assert.equal(withSongs({ ...state, frozen: 'gone' }, [song]).frozen, null);
});

test('renameSong gives the song a new name, trimmed and cut, and keeps its place and everything else', () => {
  const two = saved(saved(richState(), { id: 'a', name: 'First' }), { id: 'b', name: 'Second' });
  const renamed = renameSong(two, 'a', '  New name  ');
  assert.deepEqual(renamed.songs.map((song) => [song.id, song.name]), [['b', 'Second'], ['a', 'New name']]);
  assert.deepEqual({ ...renamed.songs[1], name: 'First' }, two.songs[1]);
  assert.equal(renameSong(two, 'a', 'x'.repeat(NAME_LIMIT + 5)).songs[1].name.length, NAME_LIMIT);
});

test('renameSong changes nothing for an empty name, a cancelled question, the same name or an unknown song', () => {
  const state = saved(richState(), { id: 'a', name: 'First' });
  assert.equal(renameSong(state, 'a', '   '), state);
  assert.equal(renameSong(state, 'a', null), state);
  assert.equal(renameSong(state, 'a', 'First'), state);
  assert.equal(renameSong(state, 'unknown', 'Other'), state);
});

test('keyLabel names the key with its relative minor, all keys for the circle, and a key it does not know as unknown', () => {
  assert.equal(keyLabel({ key: 'C', circleOfFifths: false }), 'C (Am)');
  assert.equal(keyLabel({ key: 'C', circleOfFifths: true }), 'All keys');
  assert.equal(keyLabel({ key: '<b>', circleOfFifths: false }), 'Unknown key');
  assert.equal(keyLabel({}), 'Unknown key');
  assert.equal(keyLabel({ key: 'C', circleOfFifths: 'yes' }), 'C (Am)', 'only true is the circle');
});

test('parseSongs keeps only the recipe of a stored recipe: the options that make the song and the seeds', () => {
  const [song] = saved(richState()).songs;
  const stored = { ...song, recipe: { ...song.recipe, instrument: 'guitar', theme: 'dark', showOptions: false, panel: 'help' } };
  const [parsed] = parseSongs(JSON.stringify([stored]));
  assert.deepEqual(parsed.recipe, JSON.parse(JSON.stringify(song.recipe)));
});

test('loading a song whose recipe holds more than the recipe changes nothing else of the state', () => {
  const state = { ...saved(richState()), instrument: 'piano', theme: 'light', showOptions: true, panel: 'songs' };
  const [song] = state.songs;
  const extra = { ...song, recipe: { ...song.recipe, instrument: 'guitar', theme: 'dark', showOptions: false, panel: 'help', roman: false } };
  const loaded = loadSong({ ...state, songs: [extra] }, 'a', LIBRARY, BASS_PATTERNS);
  assert.equal(loaded.instrument, 'piano');
  assert.equal(loaded.theme, 'light');
  assert.equal(loaded.showOptions, true);
  assert.equal(loaded.panel, 'songs');
  assert.equal(loaded.roman, state.roman);
  assert.equal(loaded.frozen, null);
});

test('a frozen song lets its sections be opened and closed, but not its options be changed', () => {
  const frozen = { ...saved(richState()), frozen: 'a', collapsed: ['progressions'] };
  const opened = applyAction(frozen, 'toggle-section', { section: 'progressions' }, LIBRARY);
  assert.ok(!opened.collapsed.includes('progressions'));
  assert.ok(applyAction(opened, 'toggle-section', { section: 'progressions' }, LIBRARY).collapsed.includes('progressions'));
  // A section closed by the exercise stays closed.
  const exercise = { ...frozen, frozen: null, exercise: 'circle-ii-v-i' };
  assert.equal(applyAction(exercise, 'toggle-section', { section: 'progressions' }, LIBRARY), exercise);
});

/** A saved song of the real library with the id, saved at the minute `minute` of DATE's hour. */
function songAt(id, minute, name = id) {
  const date = new Date(2026, 10, 27, 9, minute);
  return saveSong(richState(), { id, name, date, library: LIBRARY, bassPatterns: BASS_PATTERNS }).songs[0];
}

test('the song limit keeps the songs of an account below the 1 MiB of its document, with the largest songs', () => {
  // The largest song: 12 rows (one per key), every progression chosen, every kind of choice on.
  const largest = saved({ ...richState(), circleOfFifths: true });
  assert.equal(largest.songs[0].song.rows.length, 12);
  const size = JSON.stringify(songsRecord(Array.from({ length: SONG_LIMIT }, () => largest.songs[0]))).length;
  assert.ok(size < 0.85 * 1024 * 1024, `${SONG_LIMIT} songs take ${size} characters`);
});

test('once the songs are full, saving changes nothing', () => {
  const songs = Array.from({ length: SONG_LIMIT }, (_, index) => ({ ...songAt('x', 0), id: `s${index}` }));
  const full = { ...richState(), songs };
  assert.equal(songsFull(full), true);
  assert.equal(songsFull({ ...full, songs: songs.slice(1) }), false);
  assert.equal(saved(full, { id: 'new' }), full);
  assert.equal(saved({ ...full, songs: songs.slice(1) }, { id: 'new' }).songs.length, SONG_LIMIT);
});

test('the record of an account keeps each song under its id, and gives the songs back newest first', () => {
  const older = songAt('older', 1);
  const newer = songAt('newer', 2);
  const record = songsRecord([older, newer]);
  assert.deepEqual(Object.keys(record).sort(), ['newer', 'older']);
  assert.equal(record.older, older);
  assert.deepEqual(songsFromRecord(record), [newer, older]);
  // Through JSON, as the database gives the record back, nothing is lost.
  assert.deepEqual(songsFromRecord(JSON.parse(JSON.stringify(record))), [newer, older]);
});

test('songsFromRecord leaves out broken songs and songs under another id, and gives no songs for a broken record', () => {
  const song = songAt('a', 1);
  assert.deepEqual(songsFromRecord({ a: song, b: song, c: { id: 'c' }, d: null }), [song]);
  for (const broken of [null, undefined, 'text', 3, [song]]) {
    assert.deepEqual(songsFromRecord(broken), [], String(broken));
  }
});

test('a song with markup in its snapshot is left out, from the account as from the browser', () => {
  const song = songAt('a', 1);
  const evil = JSON.parse(JSON.stringify(song));
  evil.id = 'evil';
  evil.song.rows[0].chords[0].function = '"><img src=x onerror=alert(1)>';
  assert.deepEqual(songsFromRecord({ a: song, evil }), [song]);
  assert.deepEqual(parseSongs(JSON.stringify([song, evil])), [song]);
});

test('songChanges finds the new, the changed and the removed songs, but not a new order', () => {
  const a = songAt('a', 1);
  const b = songAt('b', 2);
  const c = songAt('c', 3);
  const renamed = { ...b, name: 'Renamed' };
  const changes = songChanges([a, b], [c, renamed]);
  assert.deepEqual(changes, { put: [c, renamed], remove: ['a'] });
  assert.equal(hasChanges(changes), true);
  const none = songChanges([a, b], [b, a]);
  assert.deepEqual(none, { put: [], remove: [] });
  assert.equal(hasChanges(none), false);
  assert.equal(hasChanges({ put: [], remove: ['a'] }), true);
});

test('mergeSongs adds the songs of the browser to the account, newest first, and skips those it has already', () => {
  const account = [songAt('a', 5), songAt('b', 1)];
  const device = [songAt('b', 1, 'B in the browser'), songAt('c', 3), songAt('d', 7)];
  const { songs, upload, left } = mergeSongs(account, device);
  assert.deepEqual(songs.map((song) => song.id), ['d', 'a', 'c', 'b']);
  assert.deepEqual(upload.map((song) => song.id), ['d', 'c']);
  assert.deepEqual(left, []);
  // The account's copy of a song both have counts.
  assert.equal(songs.find((song) => song.id === 'b').name, 'b');
});

test('mergeSongs keeps the songs that do not fit into the account in the browser, so that none is lost', () => {
  const account = [songAt('a', 1), songAt('b', 2)];
  const device = [songAt('c', 3), songAt('d', 4), songAt('e', 5)];
  const { songs, upload, left } = mergeSongs(account, device, 4);
  assert.deepEqual(upload.map((song) => song.id), ['e', 'd']);
  assert.deepEqual(left.map((song) => song.id), ['c']);
  assert.equal(songs.length, 4);
  // An account that is full already takes none.
  assert.deepEqual(mergeSongs(account, device, 2).upload, []);
  assert.equal(mergeSongs(account, device, 2).left.length, 3);
  assert.deepEqual(mergeSongs([], []), { songs: [], upload: [], left: [] });
});
