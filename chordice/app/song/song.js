/**
 * The song on the right: one row per generated progression, with its chords (see music/generator/song.js). Returns a string
 * of HTML.
 */

import { escapeHtml } from '../escape.js';
import { nameHtml } from '../names.js';
import { chordAttributes, chordCell } from '../chord.js';
import { minorNameOf } from '../../music/theory/keys.js';

/** Tags for the transformations that were applied to the row. Inactive ones are not shown. */
function activeTags(row) {
  const labels = [];
  if (row.rotated) {
    labels.push('Rotation');
  }
  if (row.permuted) {
    labels.push('Permutation');
  }
  return labels.map((label) => `<span class="tag">${escapeHtml(label)}</span>`).join('');
}

/** From this many rows on, the song is shown in two columns. */
export const TWO_COLUMNS_FROM = 8;

/** One row of the song: its heading and its chords. `rowIndex` is its place in the whole song. */
function renderRow(row, rowIndex, display, showKey) {
  const tags = activeTags(row);
  const key = showKey ? `${nameHtml(row.tonic)} (${nameHtml(minorNameOf(row.tonic))}) · ` : '';
  return `<section class="row">` +
    `<h2><span class="row-title">${key}${escapeHtml(row.name)} <span class="meta">· ${escapeHtml(row.group)}</span></span>` +
    (tags ? `<span class="tags">${tags}</span>` : '') + '</h2>' +
    `<ol class="chords">${row.chords.map((chord, chordIndex) =>
      chordCell(chord, chordAttributes(rowIndex, chordIndex), display, row.tonic),
    ).join('')}</ol>` +
    '</section>';
}

/**
 * Renders the song: one row per generated progression, named after the progression. `display` holds the colour, roman,
 * tones and melody switches; the melody switch is the inversions switch.
 * With no progression selected there are no rows, so the song stays empty. With `showKey` (the circle of fifths
 * switch), each row starts with its key and the relative minor, e.g. "C (Am) · Pop Progression", in the font of the name.
 * From TWO_COLUMNS_FROM rows on, the rows are split in half: the first half in the left column, the second in the right
 * one (with an odd number, the left column has one more).
 */
export function renderSong(rows, display, { showKey = false } = {}) {
  const html = rows.map((row, rowIndex) => renderRow(row, rowIndex, display, showKey));
  if (rows.length < TWO_COLUMNS_FROM) {
    return html.join('');
  }
  const half = Math.ceil(rows.length / 2);
  const column = (part) => `<div class="song-column">${part.join('')}</div>`;
  return `<div class="song-columns">${column(html.slice(0, half))}${column(html.slice(half))}</div>`;
}
