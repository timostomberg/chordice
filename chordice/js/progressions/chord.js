/**
 * One chord as the rows and the notes window show it: the symbol with its roman numeral, tones and melody note, and the
 * colours of its function. Shared by the progression rows (progressions.js) and the chord box of the notes window (notes/notes.js).
 */

import { invertedTones, melodyTopOf, toneKind } from "../theory/theory.js";
import { escapeHtml } from "../core/escape.js";

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
 * One tone below a chord. A tone foreign to the key is red, a tone the chord variation adds is blue; both are circled.
 * Foreign takes precedence when a tone is both.
 */
function toneHtml(tone, chord, tonic) {
  const kind = toneKind(tone, chord, tonic);
  const classes = kind ? ` tone-${kind}` : '';
  return `<span class="tone${classes}">${escapeHtml(noteName(tone))}</span>`;
}

/**
 * The chord tones of the inversion stacked upwards, e.g. "c · e · g" for C in root position. The bass is not shown here:
 * the slash bass is part of the chord symbol.
 */
function tonesHtml(chord, tonic) {
  return invertedTones(chord.tones, chord.inversion).map((tone) => toneHtml(tone, chord, tonic)).join(' · ');
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
 * The symbol of a chord with, when the melody switch is on, its top melody note to the right of it, inside the box.
 * The top note is the highest tone of the chord in its inversion, in lower case; root position shows the highest chord tone.
 */
function symbolWithMelody(symbol, chord, melody) {
  if (!melody) {
    return symbol;
  }
  const top = noteName(melodyTopOf(chord.tones, chord.inversion));
  return `<span class="symbol-row">${symbol}<span class="melody" title="Top melody note">${escapeHtml(top)}</span></span>`;
}

/**
 * One chord. The colour switch adds the colour of the harmonic function. The roman switch adds the roman numeral above
 * the chord symbol, the tones switch the chord tones in lower case below it, judged against the key `tonic` of the row.
 * With either switch on, the chord symbol is split into name, variation and bass. The melody switch adds the top melody
 * note to the right of the chord symbol.
 */
export function chordCell(chord, attributes, { colour, roman, tones, melody }, tonic) {
  const classes = ['chord'];
  if (colour) {
    classes.push(chord.function ? `fn-${chord.function}` : 'fn-none', chord.quality === 'major' ? 'is-major' : 'is-minor');
  }
  // Without roman numerals and tones the symbol is plain text; otherwise it is split into name, variation and bass.
  const plain = !roman && !tones;
  const symbol = symbolWithMelody(plain ? escapeHtml(chord.displaySymbol) : symbolHtml(chord), chord, melody);
  return `<li class="${classes.join(' ')}" ${attributes}>` +
    (roman ? `<span class="roman">${escapeHtml(chord.roman)}</span>` : '') +
    symbol +
    (tones ? `<span class="tones">${tonesHtml(chord, tonic)}</span>` : '') + '</li>';
}

/**
 * The chord box exactly as a row shows it, without the click action, for the notes window above its staff.
 * `display` has the same switches as for the rows, and `tonic` is the key of the row.
 */
export function chordBoxHtml(chord, display = {}, tonic = null) {
  return chordCell(chord, '', display, tonic);
}
