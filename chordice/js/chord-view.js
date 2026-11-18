/**
 * One chord as the rows and the notes window show it: the symbol with its roman numeral, tones and melody note, and the
 * colours of its function. Shared by the progression rows (progressions.js) and the chord box of the notes window (notes/notes.js).
 */

import { bassOf } from './theory/bass.js';
import { toneKind } from './theory/tones.js';
import { invertedTones } from './theory/melody.js';
import { escapeHtml } from './escape.js';

/** Attributes that make a chord open its notes window when clicked. */
export function chordAttributes(rowIndex, chordIndex) {
  return `role="button" tabindex="0" data-action="show-notes" data-row="${rowIndex}" data-chord="${chordIndex}"`;
}

/** A note name in lower case, where the natural B is written h (German usage): "h" for B, but "bb" stays B flat. */
function noteName(name) {
  const lower = name.toLowerCase();
  return lower === 'b' ? 'h' : lower;
}

/**
 * One tone beside a chord. A tone foreign to the key is red, a tone the chord variation adds is blue; both are circled.
 * Foreign takes precedence when a tone is both. The top tone of the stack (`top`) is circled too, in the colour of the symbol.
 * `judged` says whether the tone is judged in the key: a melody note standing alone is not, so it keeps its colour.
 */
function toneHtml(tone, chord, tonic, { top = false, judged = true } = {}) {
  // Without a key the tones are not judged, so they are not coloured.
  const kind = tonic === null || !judged ? '' : toneKind(tone, chord, tonic);
  const classes = [top ? 'tone-top' : '', kind ? `tone-${kind}` : ''].filter(Boolean).map((name) => ` ${name}`).join('');
  return `<span class="tone${classes}">${escapeHtml(noteName(tone))}</span>`;
}

/**
 * The bass tone of the chord (its slash bass, or the root), set below the other tones, without a box or brackets.
 * It is the tone of the bass staff in the notes window. Shown only with the tones switch.
 */
function bassHtml(chord, tonic) {
  return `<span class="bass-line">${toneHtml(bassOf(chord.tones, chord.bass), chord, tonic)}</span>`;
}

/**
 * The tones of the inversion beside the chord, lowest first, the last one being the top tone. With `all`, every chord tone
 * is listed (the tones switch), followed by the bass; without it, only the top tone is (the melody switch
 * alone). The top tone is circled when the melody switch is on, as it is then the melody note. The column is stacked
 * upwards, so the bass, written first, sits at the bottom.
 */
function tonesHtml(chord, tonic, { all, melody }) {
  const order = invertedTones(chord.tones, chord.inversion);
  const last = order.length - 1;
  const shown = all ? order.map((tone, index) => [tone, index]) : [[order[last], last]];
  const bass = all ? bassHtml(chord, tonic) : '';
  return bass + shown.map(([tone, index]) => toneHtml(tone, chord, tonic, { top: melody && index === last, judged: all })).join('');
}

/**
 * The chord symbol split into the chord name (root and minor sign, e.g. "C" or "Cm"), the variation after it (e.g. "7")
 * and the bass after a slash (e.g. "/E" for G/E). Only the name is bold.
 */
function symbolHtml(chord) {
  const variation = chord.variation && chord.symbol.endsWith(chord.variation) ? chord.variation : '';
  const name = chord.symbol.slice(0, chord.symbol.length - variation.length);
  return `<span class="symbol"><span class="chord-name">${escapeHtml(name)}</span>` +
    (variation ? `<span class="variation">${escapeHtml(variation)}</span>` : '') +
    (chord.bass ? `<span class="bass">/${escapeHtml(chord.bass)}</span>` : '') + '</span>';
}

/**
 * One chord. The colour switch adds the colour of the harmonic function. The roman switch adds the roman numeral above
 * the chord symbol. The tones switch adds the chord tones in lower case in a column beside the chord, judged against the
 * key `tonic` of the row. The melody switch alone adds only the top melody note, in the same column and style, circled.
 * The `has-tones` class marks a chord with such a column, which the stylesheet places beside the chord. With either
 * switch on, the chord symbol is split into name, variation and bass. With both, the top tone is circled and is the melody.
 */
export function chordCell(chord, attributes, { colour, roman, tones, melody }, tonic) {
  const classes = ['chord'];
  if (colour) {
    classes.push(chord.function ? `fn-${chord.function}` : 'fn-none', chord.quality === 'major' ? 'is-major' : 'is-minor');
  }
  const column = tones || melody;
  if (column) {
    classes.push('has-tones');
  }
  // Without roman numerals and a column the symbol is plain text; otherwise it is split into name, variation and bass.
  const symbol = !roman && !column ? escapeHtml(chord.displaySymbol) : symbolHtml(chord);
  const numeral = roman ? `<span class="roman">${escapeHtml(chord.roman)}</span>` : '';
  // With a column, the numeral and the symbol are wrapped together, so that their distance stays fixed whatever the height
  // of the column beside them is.
  if (column) {
    return `<li class="${classes.join(' ')}" ${attributes}>` +
      `<span class="chord-main">${numeral}${symbol}</span>` +
      `<span class="tones">${tonesHtml(chord, tonic, { all: tones, melody })}</span></li>`;
  }
  return `<li class="${classes.join(' ')}" ${attributes}>${numeral}${symbol}</li>`;
}

/**
 * The chord box exactly as a row shows it, without the click action, for the notes window above its staff.
 * `display` has the same switches as for the rows, and `tonic` is the key of the row.
 */
export function chordBoxHtml(chord, display = {}, tonic = null) {
  return chordCell(chord, '', display, tonic);
}
