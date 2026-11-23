import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { EXERCISES, exerciseById, exerciseSettings } from '../../../chordice/js/core/exercises.js';
import {
  defaultState,
  effectiveState,
  exerciseState,
  isLocked,
  isUnavailable,
  parseCookie,
  sanitizeState,
  serializeCookie,
  toggleExercise,
} from '../../../chordice/js/core/state.js';
import { applyAction } from '../../../chordice/js/core/actions.js';
import { buildLibrary } from '../../../chordice/js/data/validate.js';
import { generate } from '../../../chordice/js/generator/generator.js';
import { renderOptions } from '../../../chordice/js/options/options.js';
import { updateHeader } from '../../../chordice/js/header/header.js';
import { SLOTS_COUNTERCLOCKWISE } from '../../../chordice/js/theory/keys.js';

const LIBRARY = buildLibrary(load(readFileSync(new URL('../../../chordice/data/chord_progressions.yaml', import.meta.url), 'utf8')));
const CIRCLE = 'circle-ii-v-i';
const FIXED = () => 0.5;

/** A state with the stored options set apart from the exercise's values, so that the test sees which one is shown. */
function storedState() {
  return {
    ...defaultState(LIBRARY, FIXED),
    keys: ['G'],
    count: 4,
    rotation: 3,
    permutation: 4,
    variations: ['6', 'add9'],
    variationProbability: 1,
    bassProbability: 3,
    melodyAmount: 2,
    foreignVariations: false,
    circleOfFifths: false,
    inversions: true,
    collapsed: [],
  };
}

const withExercise = (state) => ({ ...state, exercise: CIRCLE });

test('the exercise Circle around ii7-V7-Imaj7 fixes the Jazz Cadence, every key, 7 and maj7 at amount 5, and no rotation, permutation or bass', () => {
  const exercise = exerciseById(CIRCLE);
  assert.equal(exercise.name, 'Circle around ii7-V7-Imaj7');
  assert.deepEqual(exercise.settings, {
    selection: ['Jazz / Jazz Cadence'],
    circleOfFifths: true,
    variations: ['7', 'maj7'],
    variationProbability: 5,
    foreignVariations: true,
    rotation: 0,
    permutation: 0,
    bassProbability: 0,
  });
  assert.equal(exerciseById('unknown'), null);
  assert.deepEqual(exerciseSettings({ exercise: null }), {});
});

test('every exercise selects progressions that exist in chord_progressions.yaml', () => {
  const ids = LIBRARY.map((progression) => progression.id);
  for (const exercise of EXERCISES) {
    for (const id of exercise.settings.selection ?? []) {
      assert.ok(ids.includes(id), `${exercise.name}: ${id}`);
    }
  }
});

test('no exercise is on by default; toggleExercise switches it on and off, and unknown exercises change nothing', () => {
  const state = defaultState(LIBRARY, FIXED);
  assert.equal(state.exercise, null);
  const on = toggleExercise(state, CIRCLE);
  assert.equal(on.exercise, CIRCLE);
  assert.equal(toggleExercise(on, CIRCLE).exercise, null);
  assert.equal(toggleExercise(state, 'unknown'), state);
  assert.equal(applyAction(state, 'toggle-exercise', { exercise: CIRCLE }, LIBRARY).exercise, CIRCLE);
});

test('the exercise is kept in the cookie, and an unknown exercise in the cookie is dropped', () => {
  const on = withExercise(defaultState(LIBRARY, FIXED));
  const cookie = serializeCookie(on).split(';')[0];
  assert.equal(sanitizeState(parseCookie(cookie), LIBRARY, FIXED).exercise, CIRCLE);
  assert.equal(sanitizeState({ exercise: 'unknown' }, LIBRARY, FIXED).exercise, null);
  assert.equal(sanitizeState({}, LIBRARY, FIXED).exercise, null);
});

test('while the exercise is on, its settings take effect and the stored values stay and come back when it is off', () => {
  const stored = storedState();
  const effective = effectiveState(withExercise(stored));
  assert.deepEqual(effective.selection, ['Jazz / Jazz Cadence']);
  assert.equal(effective.circleOfFifths, true);
  assert.equal(effective.count, 12);
  assert.deepEqual(effective.variations, ['7', 'maj7']);
  assert.equal(effective.variationProbability, 5);
  assert.equal(effective.rotation, 0);
  assert.equal(effective.permutation, 0);
  assert.equal(effective.bassProbability, 0);
  // The melody variations stay free.
  assert.equal(effective.inversions, true);
  assert.equal(effective.melodyAmount, 2);

  const off = applyAction(withExercise(stored), 'toggle-exercise', { exercise: CIRCLE }, LIBRARY);
  assert.deepEqual(effectiveState(off), effectiveState(stored));
});

test('while the exercise is on, the options it fixes cannot be changed; the melody variations can', () => {
  const state = withExercise(storedState());
  const blocked = [
    ['toggle-progression', { id: 'Pop / Pop Progression' }],
    ['toggle-group', { group: 'Jazz' }],
    ['toggle-circle-of-fifths', {}],
    ['toggle-key', { key: 'D' }],
    ['cycle-count', {}],
    ['toggle-variation', { variation: '9' }],
    ['toggle-foreign-variations', {}],
    ['set-probability', { option: 'variationProbability', value: '1' }],
    ['set-probability', { option: 'rotation', value: '1' }],
    ['set-probability', { option: 'permutation', value: '1' }],
    ['set-probability', { option: 'bassProbability', value: '1' }],
    ['toggle-section', { section: 'bass' }],
    ['toggle-section', { section: 'keys' }],
    ['toggle-section', { section: 'progressions' }],
    ['toggle-section', { section: 'progressionVariations' }],
    ['toggle-section', { section: 'variations' }],
    ['open-keys', {}],
  ];
  for (const [action, params] of blocked) {
    assert.equal(applyAction(state, action, params, LIBRARY), state, action);
  }
  assert.equal(applyAction(state, 'set-probability', { option: 'melodyAmount', value: '4' }, LIBRARY).melodyAmount, 4);
  assert.equal(applyAction(state, 'toggle-melody', {}, LIBRARY).inversions, false);
  assert.notEqual(applyAction(state, 'toggle-section', { section: 'melody' }, LIBRARY), state);
  assert.equal(isUnavailable(state, 'melodyAmount'), false);
  assert.equal(isLocked(state, 'melodyAmount'), false);
  assert.equal(isLocked(state, 'variationProbability'), true);
  assert.equal(isLocked(storedState(), 'variationProbability'), false);
});

test('the exercise generates the Jazz Cadence in every key of the circle, unrotated, with only 7 and maj7, and no bass notes', () => {
  const effective = effectiveState(withExercise(storedState()));
  const rows = generate({ ...effective, library: LIBRARY });
  assert.equal(rows.length, 12);
  rows.forEach((row, index) => {
    assert.equal(row.name, 'Jazz Cadence');
    assert.ok(SLOTS_COUNTERCLOCKWISE[index].includes(row.tonic));
    assert.deepEqual(row.chords.map((chord) => chord.roman), ['ii', 'V', 'I']);
    assert.equal(row.rotated || row.permuted, false);
    for (const chord of row.chords) {
      assert.ok([null, '7', 'maj7'].includes(chord.variation), chord.variation);
      assert.equal(chord.bass, null);
    }
  });
});

test('while the exercise is on, the options panel shows its values greyed out and the melody variations free', () => {
  const html = renderOptions(withExercise(storedState()), LIBRARY);
  const sections = html.match(/<section class="option[\s\S]*?<\/section>/g);
  const [keys, progressions, progressionVariations, variations, bass, melody, exercises] = sections;
  // Keys: the circle of fifths is on, filled grey and disabled; the section is greyed out and closed.
  assert.ok(keys.startsWith('<section class="option is-collapsed is-unavailable">'));
  assert.ok(keys.includes('class="chip circle-toggle is-on" aria-pressed="true"'));
  assert.ok(/circle-toggle[^>]*disabled/.test(keys));
  assert.ok(!keys.includes('<svg class="circle'));
  // Progressions: greyed out and closed, with only the Jazz Cadence in the summary; the count shows a disabled 12.
  assert.ok(progressions.startsWith('<section class="option is-collapsed is-unavailable">'));
  assert.ok(progressions.includes('data-section="progressions" aria-expanded="false" disabled>'));
  assert.ok(progressions.includes('<span class="section-summary"><span class="summary-label">Jazz</span>: Jazz Cadence</span>'));
  assert.ok(!progressions.includes('data-action="toggle-progression"'));
  assert.ok(/count-toggle[^>]*disabled>12</.test(progressions));
  // Progression variations: greyed out and closed, with 0 for both in the summary.
  assert.ok(progressionVariations.startsWith('<section class="option is-collapsed is-unavailable">'));
  assert.ok(progressionVariations.includes('data-section="progressionVariations" aria-expanded="false" disabled>'));
  assert.ok(progressionVariations.includes('<span class="summary-label">Rotations</span>: <span class="summary-value">0</span><br><span class="summary-label">Permutations</span>: <span class="summary-value">0</span>'));
  assert.ok(!progressionVariations.includes('data-option'));
  // Chord variations: greyed out and closed, amount 5 with 7 and maj7 in the summary, and the #b switch disabled.
  assert.ok(variations.startsWith('<section class="option is-collapsed is-unavailable">'));
  assert.ok(variations.includes('data-section="variations" aria-expanded="false" disabled>'));
  assert.ok(variations.includes('<span class="summary-value">5</span><br><span class="summary-label">Variations</span>: 7, maj7'));
  assert.ok(!variations.includes('data-action="toggle-variation"'));
  assert.ok(/data-action="toggle-foreign-variations"[^>]*disabled>/.test(variations));
  // Bass variations: greyed out and closed, with the amount 0 in its summary.
  assert.ok(bass.startsWith('<section class="option is-collapsed is-unavailable">'));
  assert.ok(bass.includes('<span class="summary-value">0</span>'));
  // Melody variations: free.
  assert.ok(melody.startsWith('<section class="option">'));
  assert.ok(melody.includes('value="2" data-option="melodyAmount" style="--fill: 40%">'));
  assert.ok(!/melody-toggle[^>]*disabled/.test(melody));
  // Exercises: the exercise is pressed and can be switched off.
  assert.ok(exercises.includes('class="chip is-on" aria-pressed="true" data-action="toggle-exercise" data-exercise="circle-ii-v-i">Circle around ii7-V7-Imaj7</button>'));
});

test('without an exercise, the Exercises section lists the exercise unpressed and nothing is locked', () => {
  const html = renderOptions(storedState(), LIBRARY);
  assert.ok(html.includes('class="chip" aria-pressed="false" data-action="toggle-exercise" data-exercise="circle-ii-v-i">Circle around ii7-V7-Imaj7</button>'));
  assert.ok(!html.includes('is-unavailable'));
  assert.ok(!html.includes('" disabled>'));
});

test('the summaries of collapsed sections show the values of the exercise, and the Exercises summary names it', () => {
  const collapsed = ['keys', 'progressions', 'progressionVariations', 'variations', 'bass', 'melody', 'exercises'];
  const html = renderOptions({ ...withExercise(storedState()), collapsed }, LIBRARY);
  assert.ok(html.includes('<span class="section-summary">all</span>'));
  assert.ok(html.includes('<span class="section-summary"><span class="summary-label">Jazz</span>: Jazz Cadence</span>'));
  assert.ok(html.includes('<span class="summary-label">Rotations</span>: <span class="summary-value">0</span>'));
  assert.ok(html.includes('<span class="summary-label">Amount</span>: <span class="summary-value">5</span><br><span class="summary-label">Variations</span>: 7, maj7'));
  assert.ok(html.includes('<span class="section-summary">Circle around ii7-V7-Imaj7</span>'));
  const none = renderOptions({ ...storedState(), collapsed }, LIBRARY);
  assert.ok(none.includes('<span class="section-title">Exercises</span><span class="section-summary"></span>'));
});

test('the header shows the circle of fifths switch pressed and disabled while the exercise switches it on', () => {
  const circle = { dataset: { flag: 'circleOfFifths' }, attributes: {}, disabled: false, setAttribute(name, value) { this.attributes[name] = value; } };
  const melody = { dataset: { flag: 'inversions' }, attributes: {}, disabled: false, setAttribute(name, value) { this.attributes[name] = value; } };
  const other = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const page = {
    querySelectorAll: (selector) => (selector === '[data-flag]' ? [circle, melody] : []),
    querySelector: () => other,
  };
  updateHeader(withExercise(storedState()), page);
  assert.equal(circle.attributes['aria-pressed'], 'true');
  assert.equal(circle.disabled, true);
  assert.equal(melody.attributes['aria-pressed'], 'true');
  assert.equal(melody.disabled, false);
  assert.deepEqual(exerciseState(storedState()).selection, storedState().selection);
});
