/**
 * The options panel on the left: the keys on the circle, the progressions, the chord and bass variations and the
 * probability sliders. Every function returns a string of HTML.
 */

import { VARIATION_NAMES } from '../theory/chords.js';
import { keySignatureOf, minorNameOf } from '../theory/keys.js';
import { SECTIONS, SECTION_OPTIONS, isUnavailable } from '../core/state.js';
import { PROBABILITY_MAX } from '../generator/utils.js';
import { escapeHtml } from '../core/escape.js';
import { renderCircleSvg } from './circle-of-fifths.js';

const SECTION_TITLES = {
  keys: 'Keys',
  progressions: 'Progressions',
  progressionVariations: 'Progression variations',
  variations: 'Chord variations',
  bass: 'Bass variations',
  melody: 'Melody variations',
};

const PROBABILITY_LABELS = {
  rotation: 'Rotations',
  permutation: 'Permutations',
  variationProbability: 'Amount',
  bassProbability: 'Amount',
  melodyAmount: 'Amount',
};

function toggleButton(label, attributes, pressed, disabled = false) {
  return `<button type="button" class="chip${pressed ? ' is-on' : ''}" aria-pressed="${pressed}" ${attributes}${disabled ? ' disabled' : ''}>` +
    `${escapeHtml(label)}</button>`;
}

/** The value an option shows: an option the chosen instrument does not use shows 0, as it takes no effect. */
function shownValue(option, state) {
  return isUnavailable(state, option) ? 0 : state[option];
}

/** A slider from 0 to PROBABILITY_MAX, where PROBABILITY_MAX means 100%. The value is shown as the number on that scale. */
function probabilitySlider(option, value, disabled = false) {
  const fill = (value / PROBABILITY_MAX) * 100;
  return `<label class="slider"><span>${PROBABILITY_LABELS[option]} <output>${value}</output></span>` +
    `<input type="range" min="0" max="${PROBABILITY_MAX}" step="1" value="${value}" data-option="${option}" style="--fill: ${fill}%"${disabled ? ' disabled' : ''}></label>`;
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
      return probabilitySlider('bassProbability', shownValue('bassProbability', state), isUnavailable(state, 'bassProbability'));
    case 'melody':
      return probabilitySlider('melodyAmount', shownValue('melodyAmount', state), isUnavailable(state, 'melodyAmount'));
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
    case 'melody':
      return [probabilitySummary('melodyAmount', state)];
    default:
      return [];
  }
}

/** One probability as a summary line, e.g. "Rotation: 2" with the label in blue. */
function probabilitySummary(option, state) {
  return `<span class="summary-label">${escapeHtml(PROBABILITY_LABELS[option])}</span>: ` +
    `<span class="summary-value">${shownValue(option, state)}</span>`;
}

/**
 * The number of progressions as a button that cycles through 1, 2, 4, 8. It sits beside the Progressions heading, not inside
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

// The note of the melody button: a symbol of a note with its stem, as the header showed the inversions before.
const MELODY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<g transform="translate(3 0)">' +
  '<ellipse cx="7" cy="17.5" rx="3" ry="2.3" transform="rotate(-20 7 17.5)" fill="currentColor"/>' +
  '<path d="M9.8 17V4c0 0 .4 3.2 4.2 5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</g></svg>';

/**
 * The melody button beside the Melody variations heading, a chip with the note symbol. It switches the inversions (the
 * flag data-flag names), so it is pressed while they are on, and greyed out on the guitar.
 */
function melodyButton(state) {
  const disabled = isUnavailable(state, 'inversions');
  return `<button type="button" class="chip melody-toggle${state.inversions ? ' is-on' : ''}" aria-pressed="${state.inversions}" ` +
    `data-action="toggle-melody" data-flag="inversions" aria-label="Melody" title="Melody"${disabled ? ' disabled' : ''}>${MELODY_ICON}</button>`;
}

function optionSection(name, state, library) {
  // A section whose option the chosen instrument does not use is greyed out and cannot be opened; it stays collapsed.
  const unavailable = Object.hasOwn(SECTION_OPTIONS, name) && isUnavailable(state, SECTION_OPTIONS[name]);
  const expanded = !state.collapsed.includes(name) && !unavailable;
  const lines = sectionSummary(name, state, library).join('<br>');
  const summary = expanded ? '' : `<span class="section-summary">${lines}</span>`;
  const toggle = `<button type="button" class="section-toggle" data-action="toggle-section" ` +
    `data-section="${name}" aria-expanded="${expanded}"${unavailable ? ' disabled' : ''}>` +
    `<span class="section-title">${SECTION_TITLES[name]}</span>${summary}</button>`;
  // The headings with a button beside them draw their arrow after that button, so the arrow is on the header, not on the toggle.
  const sideButton = name === 'progressions' ? countButton(state)
    : name === 'variations' ? foreignButton(state)
      : name === 'melody' ? melodyButton(state) : '';
  const header = sideButton
    ? `<h2 class="section-header${expanded ? ' is-expanded' : ''}">${toggle}${sideButton}</h2>`
    : `<h2>${toggle}</h2>`;
  const body = expanded ? sectionBody(name, state, library) : '';
  const classes = `option${expanded ? '' : ' is-collapsed'}${unavailable ? ' is-unavailable' : ''}`;
  return `<section class="${classes}">${header}${body}</section>`;
}

/** Renders the options panel: one collapsible section per option group. */
export function renderOptions(state, library) {
  return SECTIONS.map((name) => {
    const section = optionSection(name, state, library);
    // One heading "Variations" stands above the three variation sections, which are Progression, Chord and Bass variations.
    return name === 'progressionVariations' ? `<h2 class="options-heading">Variations</h2>${section}` : section;
  }).join('');
}