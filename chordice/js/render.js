/**
 * HTML rendering for the options panel and the progression rows. All functions return strings.
 */

import {
  VARIATION_NAMES,
  invertedTones,
  keySignatureOf,
  melodyTopOf,
  minorNameOf,
  toneKind,
} from './theory.js';
import { SECTIONS } from './state.js';
import { PROBABILITY_MAX } from './random.js';
import { escapeHtml } from './escape.js';
import { renderCircleSvg } from './circle.js';

const SECTION_TITLES = {
  keys: 'Keys',
  progressions: 'Progressions',
  progressionVariations: 'Progression variations',
  variations: 'Chord variations',
  bass: 'Bass variations',
};

const PROBABILITY_LABELS = {
  rotation: 'Rotations',
  permutation: 'Permutations',
  variationProbability: 'Amount',
  bassProbability: 'Amount',
};

function toggleButton(label, attributes, pressed) {
  return `<button type="button" class="chip${pressed ? ' is-on' : ''}" aria-pressed="${pressed}" ${attributes}>` +
    `${escapeHtml(label)}</button>`;
}

/** A slider from 0 to PROBABILITY_MAX, where PROBABILITY_MAX means 100%. The value is shown as the number on that scale. */
function probabilitySlider(option, value) {
  const fill = (value / PROBABILITY_MAX) * 100;
  return `<label class="slider"><span>${PROBABILITY_LABELS[option]} <output>${value}</output></span>` +
    `<input type="range" min="0" max="${PROBABILITY_MAX}" step="1" value="${value}" data-option="${option}" style="--fill: ${fill}%"></label>`;
}

/** The progressions of the library, one list per genre, in library order. */
function groupsOf(library) {
  return [...new Set(library.map((progression) => progression.group))].map((group) => ({
    group,
    members: library.filter((progression) => progression.group === group),
  }));
}

function progressionGroups(state, library) {
  const selected = new Set(state.selection);
  return groupsOf(library).map(({ group, members }) => {
    const allSelected = members.every((progression) => selected.has(progression.id));
    const chips = members.map((progression) =>
      toggleButton(progression.name, `data-action="toggle-progression" data-id="${escapeHtml(progression.id)}"`, selected.has(progression.id)),
    ).join('');
    return `<fieldset class="group"><legend>` +
      toggleButton(group, `data-action="toggle-group" data-group="${escapeHtml(group)}"`, allSelected) +
      `</legend><div class="chips">${chips}</div></fieldset>`;
  }).join('');
}

/** The accidentals of a key, each in the same oval tag as the row tags, e.g. "F♯"; empty for C. */
function keySignatureTags(major) {
  return keySignatureOf(major)
    .map((accidental) => `<span class="tag">${escapeHtml(accidental.replace('#', '♯').replace('b', '♭'))}</span>`)
    .join('');
}

/** The content of one options section, shown while the section is expanded. */
function sectionBody(name, state, library) {
  switch (name) {
    case 'keys':
      return `<div class="circle-wrap">${renderCircleSvg(state.keys)}</div>` +
        state.keys
          .map((key) => keySignatureTags(key))
          .filter((tags) => tags !== '')
          .map((tags) => `<p class="key-signature">${tags}</p>`)
          .join('');
    case 'progressions':
      return `<div class="progression-list">${progressionGroups(state, library)}</div>`;
    case 'progressionVariations':
      return probabilitySlider('rotation', state.rotation) + probabilitySlider('permutation', state.permutation);
    case 'variations':
      return probabilitySlider('variationProbability', state.variationProbability) +
        `<div class="chips">${VARIATION_NAMES.map((variation) =>
          toggleButton(variation, `data-action="toggle-variation" data-variation="${escapeHtml(variation)}"`, state.variations.includes(variation)),
        ).join('')}</div>`;
    case 'bass':
      return probabilitySlider('bassProbability', state.bassProbability);
    default:
      return '';
  }
}

/**
 * A short, muted list of what is selected in a section, one entry per line, already escaped as HTML.
 * Shown only while the section is collapsed. Progressions are listed per category as "Category: Name · Name".
 */
function sectionSummary(name, state, library) {
  switch (name) {
    case 'keys':
      return state.keys.map((key) => escapeHtml(`${key} (${minorNameOf(key)})`));
    case 'progressions':
      if (library.every((progression) => state.selection.includes(progression.id))) {
        return ['all'];
      }
      return groupsOf(library).flatMap(({ group, members }) => {
        const names = members
          .filter((progression) => state.selection.includes(progression.id))
          .map((progression) => escapeHtml(progression.name));
        return names.length > 0 ? [`<span class="summary-label">${escapeHtml(group)}</span>: ${names.join(' · ')}`] : [];
      });
    case 'progressionVariations':
      return [probabilitySummary('rotation', state), probabilitySummary('permutation', state)];
    case 'variations': {
      const names = state.variations.length === VARIATION_NAMES.length ? 'all' : state.variations.join(', ');
      return [probabilitySummary('variationProbability', state),
        `<span class="summary-label">Variations</span>: ${escapeHtml(names)}`];
    }
    case 'bass':
      return [probabilitySummary('bassProbability', state)];
    default:
      return [];
  }
}

/** One probability as a summary line, e.g. "Rotation: 2" with the label in blue. */
function probabilitySummary(option, state) {
  return `<span class="summary-label">${escapeHtml(PROBABILITY_LABELS[option])}</span>: ` +
    `<span class="summary-value">${state[option]}</span>`;
}

/**
 * The number of progressions as a button that cycles through 1, 2, 4, 8, 12. It sits beside the Progressions heading, not inside
 * it, so it stays clickable while the section is collapsed. It is a chip like the other buttons, but not a switch, so it
 * has no pressed state: its look is always the filled, active one (see .count-toggle in the stylesheet).
 */
function countButton(state) {
  return `<button type="button" class="chip count-toggle" data-action="cycle-count" aria-label="Number of progressions" ` +
    `title="Number of progressions">${state.count}</button>`;
}

/**
 * The "#b" switch beside the Chord variations heading, a chip like the other switches. Pressed (the default) means every
 * chord variation is used; not pressed means only the variations without tones foreign to the key are used.
 */
function foreignButton(state) {
  return toggleButton('#b', 'data-action="toggle-foreign-variations" aria-label="Chord variations with tones foreign to the key" ' +
    'title="Chord variations with tones foreign to the key"', state.foreignVariations);
}

function optionSection(name, state, library) {
  const expanded = !state.collapsed.includes(name);
  const lines = sectionSummary(name, state, library).join('<br>');
  const summary = expanded ? '' : `<span class="section-summary">${lines}</span>`;
  const toggle = `<button type="button" class="section-toggle" data-action="toggle-section" ` +
    `data-section="${name}" aria-expanded="${expanded}">` +
    `<span class="section-title">${SECTION_TITLES[name]}</span>${summary}</button>`;
  // The headings with a button beside them draw their arrow after that button, so the arrow is on the header, not on the toggle.
  const sideButton = name === 'progressions' ? countButton(state) : name === 'variations' ? foreignButton(state) : '';
  const header = sideButton
    ? `<h2 class="section-header${expanded ? ' is-expanded' : ''}">${toggle}${sideButton}</h2>`
    : `<h2>${toggle}</h2>`;
  const body = expanded ? sectionBody(name, state, library) : '';
  return `<section class="option${expanded ? '' : ' is-collapsed'}">${header}${body}</section>`;
}

/** Renders the options panel: one collapsible section per option group. */
export function renderOptions(state, library) {
  return SECTIONS.map((name) => {
    const section = optionSection(name, state, library);
    // One heading "Variations" stands above the three variation sections, which are Progression, Chord and Bass variations.
    return name === 'progressionVariations' ? `<h2 class="options-heading">Variations</h2>${section}` : section;
  }).join('');
}

/** Attributes that make a chord open its notes window when clicked. */
function chordAttributes(rowIndex, chordIndex) {
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
function chordCell(chord, attributes, { colour, roman, tones, melody }, tonic) {
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
