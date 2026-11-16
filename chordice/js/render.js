/**
 * HTML rendering for the options panel and the progression rows. All functions return strings.
 */

import { EXTENSION_NAMES, bassOf, invertedTones, keySignatureOf, melodyTopOf, minorNameOf } from './theory.js';
import { COUNTS, SECTIONS } from './state.js';
import { escapeHtml } from './escape.js';
import { renderCircleSvg } from './circle.js';

const SECTION_TITLES = {
  keys: 'Keys',
  progressions: 'Progressions',
  count: 'Number of progressions',
  extensions: 'Chord extensions',
  probabilities: 'Probabilities',
};

const PROBABILITY_LABELS = {
  rotation: 'Rotation',
  permutation: 'Permutation',
  extensionProbability: 'Chord extensions',
  bassProbability: 'Bass notes',
};

function toggleButton(label, attributes, pressed) {
  return `<button type="button" class="chip${pressed ? ' is-on' : ''}" aria-pressed="${pressed}" ${attributes}>` +
    `${escapeHtml(label)}</button>`;
}

function probabilitySlider(option, value) {
  return `<label class="slider"><span>${PROBABILITY_LABELS[option]} <output>${value}%</output></span>` +
    `<input type="range" min="0" max="100" step="10" value="${value}" data-option="${option}" style="--fill: ${value}%"></label>`;
}

function progressionGroups(state, library) {
  const selected = new Set(state.selection);
  const groups = [...new Set(library.map((progression) => progression.group))];
  return groups.map((group) => {
    const members = library.filter((progression) => progression.group === group);
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
    case 'count':
      return `<div class="chips">${COUNTS.map((count) =>
        toggleButton(String(count), `data-action="set-count" data-count="${count}"`, state.count === count),
      ).join('')}</div>`;
    case 'extensions':
      return `<div class="chips">${EXTENSION_NAMES.map((extension) =>
        toggleButton(extension, `data-action="toggle-extension" data-extension="${escapeHtml(extension)}"`, state.extensions.includes(extension)),
      ).join('')}</div>`;
    case 'probabilities':
      return Object.keys(PROBABILITY_LABELS).map((option) => probabilitySlider(option, state[option])).join('');
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
      return [...new Set(library.map((progression) => progression.group))].flatMap((group) => {
        const names = library
          .filter((progression) => progression.group === group && state.selection.includes(progression.id))
          .map((progression) => escapeHtml(progression.name));
        return names.length > 0 ? [`<span class="summary-label">${escapeHtml(group)}</span>: ${names.join(' · ')}`] : [];
      });
    case 'count':
      return [`<span class="tag is-on">${escapeHtml(String(state.count))}</span>`];
    case 'extensions':
      return [escapeHtml(state.extensions.length === EXTENSION_NAMES.length ? 'all' : state.extensions.join(', '))];
    case 'probabilities':
      return Object.keys(PROBABILITY_LABELS).map((option) =>
        `<span class="summary-label">${escapeHtml(PROBABILITY_LABELS[option])}</span>: ` +
        `<span class="summary-value">${state[option]}%</span>`);
    default:
      return [];
  }
}

function optionSection(name, state, library) {
  const expanded = !state.collapsed.includes(name);
  const lines = sectionSummary(name, state, library).join('<br>');
  const summary = expanded ? '' : `<span class="section-summary">${lines}</span>`;
  const header = `<h2><button type="button" class="section-toggle" data-action="toggle-section" ` +
    `data-section="${name}" aria-expanded="${expanded}">` +
    `<span class="section-title">${SECTION_TITLES[name]}</span>${summary}</button></h2>`;
  const body = expanded ? sectionBody(name, state, library) : '';
  return `<section class="option${expanded ? '' : ' is-collapsed'}">${header}${body}</section>`;
}

/** Renders the options panel: one collapsible section per option group. */
export function renderOptions(state, library) {
  return SECTIONS.map((name) => optionSection(name, state, library)).join('');
}

/** Attributes that make a chord open its notes window when clicked. */
function chordAttributes(rowIndex, chordIndex) {
  return `role="button" tabindex="0" data-action="show-notes" data-row="${rowIndex}" data-chord="${chordIndex}"`;
}

/**
 * The bass, then the chord tones of the inversion stacked upwards, e.g. "e | c · e · g". The bass is the slash bass or
 * the root and does not change with the inversion; only the upper tones follow the inversion.
 */
function tonesText(chord) {
  const bass = bassOf(chord.tones, chord.bass);
  return `${bass} | ${invertedTones(chord.tones, chord.inversion).join(' · ')}`.toLowerCase();
}

/**
 * The chord symbol split into the chord name (root and minor sign, e.g. "C" or "Cm"), the extension after it (e.g. "7")
 * and the bass after a slash (e.g. "/E" for G/E). Only the name is bold.
 */
function symbolHtml(chord) {
  const extension = chord.extension && chord.symbol.endsWith(chord.extension) ? chord.extension : '';
  const name = chord.symbol.slice(0, chord.symbol.length - extension.length);
  return `<span class="symbol"><span class="chord-name">${escapeHtml(name)}</span>` +
    (extension ? `<span class="extension">${escapeHtml(extension)}</span>` : '') +
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
  const top = melodyTopOf(chord.tones, chord.inversion).toLowerCase();
  return `<span class="symbol-row">${symbol}<span class="melody" title="Top melody note">${escapeHtml(top)}</span></span>`;
}

/**
 * One chord. The colour switch adds the colour of the harmonic function. The details switch adds the roman numeral
 * above the chord symbol, split into name, extension and bass, and the chord tones in lower case below it.
 * The melody switch adds the top melody note to the right of the chord symbol.
 */
function chordCell(chord, attributes, { colour, details, melody }) {
  const classes = ['chord'];
  if (colour) {
    classes.push(chord.function ? `fn-${chord.function}` : 'fn-none', chord.quality === 'major' ? 'is-major' : 'is-minor');
  }
  if (!details) {
    return `<li class="${classes.join(' ')}" ${attributes}>${symbolWithMelody(escapeHtml(chord.displaySymbol), chord, melody)}</li>`;
  }
  return `<li class="${classes.join(' ')}" ${attributes}>` +
    `<span class="roman">${escapeHtml(chord.roman)}</span>` +
    symbolWithMelody(symbolHtml(chord), chord, melody) +
    `<span class="tones">${escapeHtml(tonesText(chord))}</span></li>`;
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
 * Renders one row per generated progression, named after the progression. `display` holds the colour, details and melody
 * switches; the melody switch is the inversions switch.
 * With no progression selected there are no rows, so the content area stays empty.
 */
export function renderRows(rows, display) {
  return rows.map((row, rowIndex) => {
    const tags = activeTags(row);
    return `<section class="row">` +
      `<h2><span class="row-title">${escapeHtml(row.name)} <span class="meta">· ${escapeHtml(row.group)}</span></span>` +
      (tags ? `<span class="tags">${tags}</span>` : '') + '</h2>' +
      `<ol class="chords">${row.chords.map((chord, chordIndex) => chordCell(chord, chordAttributes(rowIndex, chordIndex), display)).join('')}</ol>` +
      '</section>';
  }).join('');
}
