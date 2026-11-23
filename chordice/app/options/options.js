/**
 * The side panel on the left: the options panel (the keys on the circle, the progressions, the chord and bass variations
 * and the probability sliders) and the exercises panel; the Options, Exercises and Help buttons in the header choose which
 * one is shown, and the help panel is in help/. Every function returns a string of HTML.
 * While an exercise is on, the options it fixes show its values and are greyed out (see exerciseState in app/state/availability.js).
 */

import { VARIATION_NAMES } from '../../music/theory/chords.js';
import { keySignatureOf, minorNameOf } from '../../music/theory/keys.js';
import { EXERCISE_SECTIONS, SECTIONS, SECTION_OPTIONS } from '../state/state.js';
import { effectiveState, exerciseState, isUnavailable } from '../state/availability.js';
import { EXERCISES } from '../state/exercises.js';
import { PROBABILITY_MAX } from '../../music/constants.js';
import { escapeHtml } from '../escape.js';
import { renderCircleSvg } from './circle-of-fifths.js';
import { nameHtml } from '../names.js';

const SECTION_TITLES = {
  keys: 'Keys',
  progressions: 'Progressions',
  progressionVariations: 'Progression variations',
  variations: 'Chord variations',
  bass: 'Bass variations',
  melody: 'Melody variations',
  exercises: 'Exercises',
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

/**
 * The value an option shows: an option the chosen instrument does not use shows 0, as it takes no effect, and an option
 * the exercise that is on fixes shows the exercise's value.
 */
function shownValue(option, state) {
  return effectiveState(state)[option];
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
  const selected = new Set(exerciseState(state).selection);
  const disabled = isUnavailable(state, 'selection');
  return groupsOf(library).map(({ group, members }) => {
    const allSelected = members.every((progression) => selected.has(progression.id));
    const chips = members.map((progression) =>
      toggleButton(progression.name, `data-action="toggle-progression" data-id="${escapeHtml(progression.id)}"`, selected.has(progression.id), disabled),
    ).join('');
    return `<fieldset class="group"><legend>` +
      toggleButton(group, `data-action="toggle-group" data-group="${escapeHtml(group)}"`, allSelected, disabled) +
      `</legend><div class="chips">${chips}</div></fieldset>`;
  }).join('');
}

/** The accidentals of a key as tones, in lower case like the tones beside the chords, each in the same oval tag as the row
 * tags, e.g. "f♯" with a raised sign; empty for C. */
function keySignatureTags(major) {
  return keySignatureOf(major)
    .map((accidental) => `<span class="tag">${nameHtml(accidental.toLowerCase())}</span>`)
    .join('');
}

/** The slider of a probability option with the value it shows, greyed out while the option is unavailable. */
function slider(option, state) {
  return probabilitySlider(option, shownValue(option, state), isUnavailable(state, option));
}

/** The content of one options section, shown while the section is expanded. */
function sectionBody(name, state, library) {
  switch (name) {
    case 'keys':
      // With the circle of fifths switch on, the section cannot be opened (see SECTION_OPTIONS), so the circle is not drawn.
      return `<div class="circle-wrap">${renderCircleSvg(state.key)}</div>` +
        (keySignatureOf(state.key).length > 0 ? `<p class="key-signature">${keySignatureTags(state.key)}</p>` : '');
    case 'progressions':
      return `<div class="progression-list">${progressionGroups(state, library)}</div>`;
    case 'progressionVariations':
      return slider('rotation', state) + slider('permutation', state);
    case 'variations': {
      const variations = exerciseState(state).variations;
      const disabled = isUnavailable(state, 'variations');
      return slider('variationProbability', state) +
        `<div class="chips">${VARIATION_NAMES.map((variation) =>
          toggleButton(variation, `data-action="toggle-variation" data-variation="${escapeHtml(variation)}"`, variations.includes(variation), disabled),
        ).join('')}</div>`;
    }
    case 'bass':
      return slider('bassProbability', state);
    case 'melody':
      return slider('melodyAmount', state);
    case 'exercises':
      return `<div class="chips">${EXERCISES.map((exercise) =>
        toggleButton(exercise.name, `data-action="toggle-exercise" data-exercise="${escapeHtml(exercise.id)}"`, state.exercise === exercise.id),
      ).join('')}</div>`;
    default:
      return '';
  }
}

/**
 * A short, muted list of what is selected in a section, one entry per line, already escaped as HTML.
 * Shown only while the section is collapsed. Progressions are listed per category as "Category: Name · Name".
 */
function sectionSummary(name, state, library) {
  const shown = exerciseState(state);
  switch (name) {
    case 'keys':
      // With the circle of fifths switch on, every key is used, one row each.
      if (shown.circleOfFifths) {
        return ['all'];
      }
      return [`${nameHtml(state.key)} (${nameHtml(minorNameOf(state.key))})`];
    case 'progressions':
      if (library.every((progression) => shown.selection.includes(progression.id))) {
        return ['all'];
      }
      return groupsOf(library).flatMap(({ group, members }) => {
        const names = members
          .filter((progression) => shown.selection.includes(progression.id))
          .map((progression) => escapeHtml(progression.name));
        return names.length > 0 ? [`<span class="summary-label">${escapeHtml(group)}</span>: ${names.join(' · ')}`] : [];
      });
    case 'progressionVariations':
      return [probabilitySummary('rotation', state), probabilitySummary('permutation', state)];
    case 'variations': {
      const names = shown.variations.length === VARIATION_NAMES.length ? 'all' : shown.variations.join(', ');
      return [probabilitySummary('variationProbability', state),
        `<span class="summary-label">Variations</span>: ${escapeHtml(names)}`];
    }
    case 'bass':
      return [probabilitySummary('bassProbability', state)];
    case 'melody':
      return [probabilitySummary('melodyAmount', state)];
    case 'exercises':
      // The exercise that is on, or nothing.
      return EXERCISES.filter((exercise) => exercise.id === state.exercise).map((exercise) => escapeHtml(exercise.name));
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
  // With the circle of fifths switch on, the count is fixed at one per key: it shows 12 and is greyed out.
  const disabled = isUnavailable(state, 'count');
  return `<button type="button" class="chip count-toggle" data-action="cycle-count" aria-label="Number of progressions" ` +
    `title="Number of progressions"${disabled ? ' disabled' : ''}>${effectiveState(state).count}</button>`;
}

// The arrow of the circle of fifths button: an open circle running counterclockwise from the top, round the left and the
// bottom, up the right side, where its head points up.
const CIRCLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M9.78 5.11A7 7 0 1 0 18 12V9.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M15.2 11.2 18 8.4l2.8 2.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

/**
 * The circle of fifths button beside the Keys heading, a chip with a counterclockwise arrow. Pressed, every key gets one
 * row, counterclockwise from C (C, F, Bb, ...), so there are 12 rows; not pressed (the default), the selected key is used.
 */
function circleButton(state) {
  const on = exerciseState(state).circleOfFifths;
  const disabled = isUnavailable(state, 'circleOfFifths');
  return `<button type="button" class="chip circle-toggle${on ? ' is-on' : ''}" aria-pressed="${on}" ` +
    'data-action="toggle-circle-of-fifths" data-flag="circleOfFifths" aria-label="All keys, counterclockwise on the circle of fifths" ' +
    `title="All keys, counterclockwise on the circle of fifths"${disabled ? ' disabled' : ''}>${CIRCLE_ICON}</button>`;
}

/**
 * The "#b" switch beside the Chord variations heading, a chip like the other switches. Pressed (the default) means every
 * chord variation is used; not pressed means only the variations without tones foreign to the key are used.
 */
function foreignButton(state) {
  return toggleButton('#b', 'data-action="toggle-foreign-variations" aria-label="Chord variations with tones foreign to the key" ' +
    'title="Chord variations with tones foreign to the key"', exerciseState(state).foreignVariations, isUnavailable(state, 'foreignVariations'));
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
  // Like the other buttons beside a heading, it shows the value of the exercise that is on, if that fixes the inversions.
  const on = exerciseState(state).inversions;
  const disabled = isUnavailable(state, 'inversions');
  return `<button type="button" class="chip melody-toggle${on ? ' is-on' : ''}" aria-pressed="${on}" ` +
    `data-action="toggle-melody" data-flag="inversions" aria-label="Melody" title="Melody"${disabled ? ' disabled' : ''}>${MELODY_ICON}</button>`;
}

/** The button beside the heading of a section, by the name of the section; the other sections have none. */
const SIDE_BUTTONS = {
  keys: circleButton,
  progressions: countButton,
  variations: foreignButton,
  melody: melodyButton,
};

function optionSection(name, state, library) {
  // A section whose option is unavailable (for the instrument, the circle of fifths switch or the exercise) is greyed out
  // and cannot be opened; it stays collapsed. The button beside its heading keeps its own look, as it may still be pressed.
  const unavailable = Object.hasOwn(SECTION_OPTIONS, name) && isUnavailable(state, SECTION_OPTIONS[name]);
  const expanded = !state.collapsed.includes(name) && !unavailable;
  const lines = sectionSummary(name, state, library).join('<br>');
  const summary = expanded ? '' : `<span class="section-summary">${lines}</span>`;
  const toggle = `<button type="button" class="section-toggle" data-action="toggle-section" ` +
    `data-section="${name}" aria-expanded="${expanded}"${unavailable ? ' disabled' : ''}>` +
    `<span class="section-title">${SECTION_TITLES[name]}</span>${summary}</button>`;
  // The headings with a button beside them draw their arrow after that button, so the arrow is on the header, not on the toggle.
  const sideButton = SIDE_BUTTONS[name]?.(state) ?? '';
  const header = sideButton
    ? `<h2 class="section-header${expanded ? ' is-expanded' : ''}">${toggle}${sideButton}</h2>`
    : `<h2>${toggle}</h2>`;
  const body = expanded ? sectionBody(name, state, library) : '';
  const classes = `option${expanded ? '' : ' is-collapsed'}${unavailable ? ' is-unavailable' : ''}`;
  return `<section class="${classes}">${header}${body}</section>`;
}

/** The headings that stand above a section, by the name of the first section under them. */
const HEADINGS = { progressionVariations: 'Variations' };

/** Renders the options panel: one collapsible section per option group. */
export function renderOptions(state, library) {
  return SECTIONS.map((name) => {
    const section = optionSection(name, state, library);
    // One heading "Variations" stands above the variation sections (Progression, Chord, Bass and Melody variations).
    const heading = HEADINGS[name];
    return heading ? `<h2 class="options-heading">${heading}</h2>${section}` : section;
  }).join('');
}

/**
 * Renders the exercises panel: collapsible boxes like those of the options panel. The Exercises box holds one switch per
 * exercise, the one that is on pressed; only one exercise is on at a time, and a click on it switches it off again. While
 * the box is collapsed, its summary names the exercise that is on.
 */
export function renderExercises(state, library) {
  return EXERCISE_SECTIONS.map((name) => optionSection(name, state, library)).join('');
}
