/**
 * The side panel on the left: the options panel (the progressions, the chord and bass variations and the probability
 * sliders) and the exercises panel; the Options, Exercises and Help buttons in the header choose which
 * one is shown, and the help panel is in help/. Every function returns a string of HTML.
 * While an exercise is on, the options it fixes show its values and are greyed out (see exerciseState in app/state/availability.js).
 */

import { VARIATION_NAMES } from '../../music/theory/chords.js';
import { EXERCISE_SECTIONS, SECTIONS, SECTION_OPTIONS, probabilityMaxOf } from '../state/state.js';
import { effectiveState, exerciseState, isUnavailable, isUnavailableForSettings } from '../state/availability.js';
import { EXERCISES } from '../state/exercises.js';
import { PROBABILITY_MAX, VARIATIONS_ONLY } from '../../music/constants.js';
import { escapeHtml } from '../escape.js';

const SECTION_TITLES = {
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
  melodyAmount: 'Strength',
};

/** The short note at the bottom of each section while it is open, in the small, pale type of the notes of the panels. */
const SECTION_HINTS = {
  progressions: 'The rows are drawn from the progressions picked here.',
  progressionVariations: 'Rotations: how often a row starts on another chord. Permutations: how often its chords are shuffled.',
  variations: 'Amount: how often a chord gets one of the variations picked here; at 5+ always, without the plain chord.',
  bass: 'How often a chord gets another bass note.',
  melody: 'How far the melody may jump.',
  exercises: 'An exercise fixes some options to practise one thing.',
};

/** A short note in the small, pale type of the notes of the panels. */
function hint(text) {
  return `<p class="option-hint">${escapeHtml(text)}</p>`;
}

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

/** A probability as it is shown: the number on its scale, and VARIATIONS_ONLY, the step after PROBABILITY_MAX, as "5+". */
export function probabilityLabel(value) {
  return value === VARIATIONS_ONLY ? `${PROBABILITY_MAX}+` : String(value);
}

/**
 * A slider from 0 to the highest value of its option (see probabilityMaxOf), where PROBABILITY_MAX means 100%. The value
 * is shown as the number on that scale.
 */
function probabilitySlider(option, value, disabled = false) {
  const max = probabilityMaxOf(option);
  const fill = (value / max) * 100;
  return `<label class="slider"><span>${PROBABILITY_LABELS[option]} <output>${probabilityLabel(value)}</output></span>` +
    `<input type="range" min="0" max="${max}" step="1" value="${value}" data-option="${option}" style="--fill: ${fill}%"${disabled ? ' disabled' : ''}></label>`;
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
      toggleButton(
        group,
        `data-action="toggle-group" data-group="${escapeHtml(group)}" title="All ${escapeHtml(group)} progressions"`,
        allSelected,
        disabled,
      ) +
      `</legend><div class="chips">${chips}</div></fieldset>`;
  }).join('');
}


/** The slider of a probability option with the value it shows, greyed out while the option is unavailable. */
function slider(option, state) {
  return probabilitySlider(option, shownValue(option, state), isUnavailable(state, option));
}

/** The content of one options section, shown while the section is expanded. */
function sectionBody(name, state, library) {
  switch (name) {
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
        ).join('')}${clearVariationsButton(state)}</div>`;
    }
    case 'bass':
      return slider('bassProbability', state);
    case 'melody':
      return slider('melodyAmount', state);
    case 'exercises': {
      // A frozen song fixes the exercise too (see isFrozen in availability.js).
      const disabled = isUnavailable(state, 'exercise');
      return `<div class="chips">${EXERCISES.map((exercise) =>
        toggleButton(exercise.name, `data-action="toggle-exercise" data-exercise="${escapeHtml(exercise.id)}"`, state.exercise === exercise.id, disabled),
      ).join('')}${clearExerciseButton(disabled)}</div>`;
    }
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
    `<span class="summary-value">${probabilityLabel(shownValue(option, state))}</span>`;
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
    `title="Number of progressions: 1, 2, 4 or 8"${disabled ? ' disabled' : ''}>${effectiveState(state).count}</button>`;
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
    'data-action="toggle-melody" data-flag="inversions" aria-label="Melody" ' +
    `title="Melody: each chord in an inversion by its top note"${disabled ? ' disabled' : ''}>${MELODY_ICON}</button>`;
}

/**
 * A button that switches everything of a section off at once, e.g. every chord variation. It is the last chip of the
 * section's chips. It is not a switch, so it has no pressed state, and a click when everything is already off changes nothing.
 */
function clearButton(attributes, label, disabled) {
  return `<button type="button" class="chip clear-toggle" ${attributes} aria-label="${escapeHtml(label)}" ` +
    `title="${escapeHtml(label)}"${disabled ? ' disabled' : ''}>unselect all</button>`;
}

/** The last chip of the Chord variations section, which switches every chord variation off. */
function clearVariationsButton(state) {
  return clearButton('data-action="clear-variations"', 'Switch off all chord variations', isUnavailable(state, 'variations'));
}

/** The last chip of the Exercises section, which switches the exercise that is on off. */
function clearExerciseButton(disabled = false) {
  return clearButton('data-action="clear-exercise"', 'Switch off all exercises', disabled);
}

/** The buttons beside the heading of a section, by the name of the section; the other sections have none. */
const SIDE_BUTTONS = {
  progressions: [countButton],
  variations: [foreignButton],
  melody: [melodyButton],
};

function optionSection(name, state, library) {
  // A section whose option is unavailable (for the instrument or the exercise) is greyed out
  // and cannot be opened; it stays collapsed. The button beside its heading keeps its own look, as it may still be pressed.
  // A section whose option a frozen song fixes is greyed out too, but can be opened: it shows its values, which cannot be
  // changed (its controls are disabled).
  const option = SECTION_OPTIONS[name];
  const hasOption = Object.hasOwn(SECTION_OPTIONS, name);
  const unavailable = hasOption && isUnavailable(state, option);
  const closed = hasOption && isUnavailableForSettings(state, option);
  const expanded = !state.collapsed.includes(name) && !closed;
  const lines = sectionSummary(name, state, library).join('<br>');
  const summary = expanded ? '' : `<span class="section-summary">${lines}</span>`;
  const toggle = `<button type="button" class="section-toggle" data-action="toggle-section" ` +
    `data-section="${name}" aria-expanded="${expanded}"${closed ? ' disabled' : ''}>` +
    `<span class="section-title">${SECTION_TITLES[name]}</span>${summary}</button>`;
  // The headings with a button beside them draw their arrow after that button, so the arrow is on the header, not on the toggle.
  const sideButton = (SIDE_BUTTONS[name] ?? []).map((button) => button(state)).join('');
  const header = sideButton
    ? `<h2 class="section-header${expanded ? ' is-expanded' : ''}">${toggle}${sideButton}</h2>`
    : `<h2>${toggle}</h2>`;
  const body = expanded ? sectionBody(name, state, library) + hint(SECTION_HINTS[name]) : '';
  const classes = `option${expanded ? '' : ' is-collapsed'}${unavailable ? ' is-unavailable' : ''}`;
  return `<section class="${classes}">${header}${body}</section>`;
}

/** The headings that stand above a section, by the name of the first section under them. */
const HEADINGS = { progressions: 'Progressions', variations: 'Chords', bass: 'Bass', melody: 'Melody', exercises: 'Exercises' };

/** One section with the heading that stands above it, if any. */
function withHeading(name, section) {
  const heading = HEADINGS[name];
  return heading ? `<h2 class="options-heading">${heading}</h2>${section}` : section;
}

/** Renders the options panel: one collapsible section per option group. */
export function renderOptions(state, library) {
  // A heading stands above each group of sections: Progressions (with its variations), Chords, Bass and Melody.
  return SECTIONS.map((name) => withHeading(name, optionSection(name, state, library))).join('');
}

/**
 * Renders the exercises panel: collapsible boxes like those of the options panel. The Exercises box holds one switch per
 * exercise, the one that is on pressed; only one exercise is on at a time, and a click on it switches it off again. While
 * the box is collapsed, its summary names the exercise that is on.
 */
export function renderExercises(state, library) {
  // The heading Exercises stands above the box, like the headings of the options.
  return EXERCISE_SECTIONS.map((name) => withHeading(name, optionSection(name, state, library))).join('');
}
