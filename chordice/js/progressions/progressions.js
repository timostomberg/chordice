/**
 * The progression rows on the right: one row per generated progression, with its chords. Returns a string of HTML.
 */

import { escapeHtml } from '../escape.js';
import { chordAttributes, chordCell } from '../chord-view.js';

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

/**
 * Renders one row per generated progression, named after the progression. `display` holds the colour, roman, tones and melody
 * switches; the melody switch is the inversions switch.
 * With no progression selected there are no rows, so the content area stays empty.
 */
export function renderRows(rows, display) {
  return rows.map((row, rowIndex) => {
    const tags = activeTags(row);
    return `<section class="row">` +
      `<h2><span class="row-title">${escapeHtml(row.name)} <span class="meta">· ${escapeHtml(row.group)}</span></span>` +
      (tags ? `<span class="tags">${tags}</span>` : '') + '</h2>' +
      `<ol class="chords">${row.chords.map((chord, chordIndex) =>
        chordCell(chord, chordAttributes(rowIndex, chordIndex), display, row.tonic),
      ).join('')}</ol>` +
      '</section>';
  }).join('');
}
