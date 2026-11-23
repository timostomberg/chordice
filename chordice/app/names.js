/**
 * Musical names (keys, chord symbols, tones, roman numerals) as markup. Accidentals are shown as the signs ♯ and ♭, raised
 * and a little smaller than the letters, and the minor sign m after the root is a little smaller than the root, e.g.
 * "F♯m". Only musical names go through here, never prose: a "b" in a word would be taken for a flat.
 */

import { escapeHtml } from './escape.js';

const SIGNS = { '#': '♯', b: '♭' };

/**
 * Whether the "b" at `index` is a flat rather than the note B: it follows a note letter ("Bb", "eb", "bb" for the tone B flat)
 * or comes before a degree ("7b9", "bVII"). A "#" is always a sharp.
 */
function isAccidental(text, index) {
  const char = text[index];
  if (char === '#') {
    return true;
  }
  if (char !== 'b') {
    return false;
  }
  return /[A-Ha-h]/.test(text[index - 1] ?? '') || /[0-9IViv]/.test(text[index + 1] ?? '');
}

/**
 * The index of the minor sign of a name, or -1: an "m" right after the root and its accidentals at the start ("Am",
 * "F#m7", "Cmmaj7"), but not the m of "maj" ("Cmaj7").
 */
function minorSignIndex(text) {
  const root = /^[A-G][#b]*/.exec(text);
  if (!root) {
    return -1;
  }
  const index = root[0].length;
  return text[index] === 'm' && !text.startsWith('aj', index + 1) ? index : -1;
}

/**
 * Splits a musical name into runs of plain text, accidental signs and the minor sign, in order, each with its `kind`
 * ('text', 'accidental' or 'minor'), e.g. "F#m" into F (text), ♯ (accidental) and m (minor).
 */
export function nameParts(text) {
  const value = String(text);
  const minor = minorSignIndex(value);
  const parts = [];
  for (let index = 0; index < value.length; index += 1) {
    const kind = index === minor ? 'minor' : isAccidental(value, index) ? 'accidental' : 'text';
    const char = kind === 'accidental' ? SIGNS[value[index]] : value[index];
    const last = parts.at(-1);
    if (last && last.kind === kind) {
      last.text += char;
    } else {
      parts.push({ text: char, kind });
    }
  }
  return parts;
}

const CLASSES = { accidental: 'accidental', minor: 'minor-sign' };

/**
 * A musical name as escaped HTML: "F#m" gives F<span class="accidental">♯</span><span class="minor-sign">m</span>.
 */
export function nameHtml(text) {
  return nameParts(text)
    .map((part) => (part.kind === 'text' ? escapeHtml(part.text) : `<span class="${CLASSES[part.kind]}">${part.text}</span>`))
    .join('');
}
