import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../../chordice/app/state/state.js';
import { effectiveState } from '../../chordice/app/state/availability.js';
import { applyAction } from '../../chordice/app/state/actions.js';
import { generateSong } from '../../chordice/music/generator/song.js';
import { SLOTS_COUNTERCLOCKWISE } from '../../chordice/music/theory/keys.js';
import { LIBRARY } from '../helpers/fixtures.js';

// The exercise Circle around ii7-V7-Imaj7 from end to end: switched on by its action, it fixes the settings that take effect
// and generates its song; switched off, the stored settings come back. The parts are tested in the files of their modules.

const CIRCLE = 'circle-ii-v-i';
const FIXED = () => 0.5;

/** A state with the stored options set apart from the exercise's values, so that the test sees which one is shown. */
function storedState() {
  return {
    ...defaultState(LIBRARY, FIXED),
    key: 'G',
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

test('the exercise generates the Jazz Cadence in every key of the circle, unrotated, with only 7 and maj7, and no bass notes', () => {
  const effective = effectiveState(withExercise(storedState()));
  const rows = generateSong({ ...effective, library: LIBRARY });
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
