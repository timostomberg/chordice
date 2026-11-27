/**
 * The snapshot of a song: its rows exactly as the generator made them, as plain data. A saved song keeps one next to its
 * settings, so it can be shown as it was saved, even after the generator or the progression data have changed and its
 * settings would give another song (see app/state/songs.js).
 */

import { Note } from 'tonal';
import { isKeyName } from '../theory/keys.js';

/** The fields of a chord the song and the notes window show, each with the type it must have. */
const CHORD_FIELDS = {
  roman: 'string',
  root: 'string',
  quality: 'string',
  symbol: 'string',
  displaySymbol: 'string',
};

/** The rows of a song as plain data: every row with its heading and its chords, nothing the generator only used. */
function plainRows(rows) {
  return rows.map((row) => ({
    name: row.name,
    group: row.group,
    tonic: row.tonic,
    permuted: row.permuted,
    rotated: row.rotated,
    chords: row.chords.map((chord) => ({
      roman: chord.roman,
      function: chord.function,
      root: chord.root,
      quality: chord.quality,
      variation: chord.variation,
      symbol: chord.symbol,
      tones: [...chord.tones],
      inversion: chord.inversion,
      bass: chord.bass,
      displaySymbol: chord.displaySymbol,
    })),
  }));
}

/**
 * The snapshot of the generated `rows`. `showKey` says whether each row is headed by its key (the circle of fifths), and
 * `melody` whether the melody note is shown (the inversions took effect).
 */
export function snapshotOf(rows, { showKey = false, melody = false } = {}) {
  return { showKey: showKey === true, melody: melody === true, rows: plainRows(rows) };
}

/** Whether two snapshots hold the same song: the same rows with the same chords, shown the same way. */
export function sameSong(a, b) {
  const plain = (snapshot) => (snapshot ? JSON.stringify(sanitizeSnapshot(snapshot)) : null);
  return plain(a) !== null && plain(a) === plain(b);
}

/** Whether a value is a note name without an octave, spelled as the generator spells it, e.g. "C", "F#", "Bb". */
function isNoteName(name) {
  return typeof name === 'string' && Note.get(name).pc === name;
}

function isChord(chord) {
  if (!chord || typeof chord !== 'object') {
    return false;
  }
  const typed = Object.entries(CHORD_FIELDS).every(([field, type]) => typeof chord[field] === type);
  return typed &&
    (chord.function === null || typeof chord.function === 'string') &&
    (chord.variation === null || typeof chord.variation === 'string') &&
    isNoteName(chord.root) &&
    (chord.bass === null || isNoteName(chord.bass)) &&
    Array.isArray(chord.tones) && chord.tones.length > 0 && chord.tones.every(isNoteName) &&
    Number.isInteger(chord.inversion) && chord.inversion >= 0 && chord.inversion < chord.tones.length;
}

function isRow(row) {
  return Boolean(row) && typeof row === 'object' &&
    typeof row.name === 'string' && typeof row.group === 'string' && isKeyName(row.tonic) &&
    Array.isArray(row.chords) && row.chords.length > 0 && row.chords.every(isChord);
}

/**
 * The snapshot from untrusted input (e.g. the local storage), or null if it is not a valid one. Besides the types, the
 * notes are checked: every row is in a key of the circle, and every chord has real note names and an inversion of its own
 * tones, so that the song and the notes window can show it.
 */
export function sanitizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.rows) || !raw.rows.every(isRow)) {
    return null;
  }
  return {
    showKey: raw.showKey === true,
    melody: raw.melody === true,
    rows: plainRows(raw.rows.map((row) => ({ ...row, permuted: row.permuted === true, rotated: row.rotated === true }))),
  };
}

/**
 * The rows of a snapshot as the chosen instrument shows them. The snapshot is saved as the piano shows it; the guitar has
 * no bass notes and no inversions, as when the song is generated for the guitar.
 */
export function rowsForInstrument(snapshot, instrument) {
  if (instrument !== 'guitar') {
    return snapshot.rows;
  }
  return snapshot.rows.map((row) => ({
    ...row,
    chords: row.chords.map((chord) => ({ ...chord, bass: null, inversion: 0, displaySymbol: chord.symbol })),
  }));
}
