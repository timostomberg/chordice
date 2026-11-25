import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displaySwitches, effectiveState, exerciseState, isLocked, isUnavailable } from '../../../../chordice/app/state/availability.js';
import { defaultState, setInstrument, toggleFlag } from '../../../../chordice/app/state/state.js';
import { FIXED, SMALL_LIBRARY } from '../../../helpers/fixtures.js';

const LIBRARY = SMALL_LIBRARY;
const CIRCLE = 'circle-ii-v-i';

test('the guitar makes the bass amount and the inversions unavailable, and the other options stay available', () => {
  const guitar = { ...defaultState(LIBRARY, FIXED), instrument: 'guitar' };
  assert.equal(isUnavailable(guitar, 'bassProbability'), true);
  assert.equal(isUnavailable(guitar, 'inversions'), true);
  assert.equal(isUnavailable(guitar, 'rotation'), false);
  assert.equal(isUnavailable({ ...guitar, instrument: 'piano' }, 'bassProbability'), false);
});

test('on the guitar the effective settings have no bass and no inversions, but the stored values stay in the state', () => {
  const state = { ...defaultState(LIBRARY, FIXED), instrument: 'guitar', bassProbability: 4, inversions: true };
  const effective = effectiveState(state);
  assert.equal(effective.bassProbability, 0);
  assert.equal(effective.inversions, false);
  assert.equal(state.bassProbability, 4);
  assert.equal(state.inversions, true);
});

test('on the guitar the chord tones are unavailable and off, and come back on the piano', () => {
  const guitar = { ...defaultState(LIBRARY, FIXED), instrument: 'guitar', tones: true };
  assert.equal(isUnavailable(guitar, 'tones'), true);
  assert.equal(effectiveState(guitar).tones, false);
  assert.equal(guitar.tones, true);
  const piano = setInstrument(guitar, 'piano');
  assert.equal(isUnavailable(piano, 'tones'), false);
  assert.equal(effectiveState(piano).tones, true);
});

test('on the piano the effective settings are the stored ones', () => {
  const state = { ...defaultState(LIBRARY, FIXED), bassProbability: 4, inversions: true };
  assert.deepEqual(effectiveState(state), state);
});

test('switching back to the piano restores the bass amount and the inversions as they were set', () => {
  const piano = { ...defaultState(LIBRARY, FIXED), bassProbability: 4, inversions: true };
  const guitar = setInstrument(piano, 'guitar');
  assert.equal(effectiveState(guitar).bassProbability, 0);
  const back = setInstrument(guitar, 'piano');
  assert.equal(effectiveState(back).bassProbability, 4);
  assert.equal(effectiveState(back).inversions, true);
});

test('on the guitar the melody amount is unavailable and takes no effect, and the stored value comes back on the piano', () => {
  const guitar = { ...defaultState(LIBRARY, FIXED), instrument: 'guitar', melodyAmount: 4, inversions: true };
  assert.equal(isUnavailable(guitar, 'melodyAmount'), true);
  assert.equal(effectiveState(guitar).melodyAmount, 0);
  const piano = setInstrument(guitar, 'piano');
  assert.equal(isUnavailable(piano, 'melodyAmount'), false);
  assert.equal(effectiveState(piano).melodyAmount, 4);
});

test('with the melody button off the melody amount is unavailable on the piano too, and the stored value comes back when it is switched on', () => {
  const off = { ...defaultState(LIBRARY, FIXED), instrument: 'piano', inversions: false, melodyAmount: 4 };
  assert.equal(isUnavailable(off, 'melodyAmount'), true);
  assert.equal(effectiveState(off).melodyAmount, 0);
  // The melody button itself stays available, and switching it on brings the stored amount back.
  assert.equal(isUnavailable(off, 'inversions'), false);
  const on = toggleFlag(off, 'inversions');
  assert.equal(isUnavailable(on, 'melodyAmount'), false);
  assert.equal(effectiveState(on).melodyAmount, 4);
});

test('with the circle of fifths switch on, the count takes effect as 12 and is unavailable; the stored count comes back when it is off', () => {
  const state = { ...defaultState(LIBRARY, FIXED), count: 4, circleOfFifths: true };
  assert.equal(isUnavailable(state, 'count'), true);
  assert.equal(effectiveState(state).count, 12);
  assert.equal(state.count, 4);
  const off = toggleFlag(state, 'circleOfFifths');
  assert.equal(isUnavailable(off, 'count'), false);
  assert.equal(effectiveState(off).count, 4);
});

test('with the circle of fifths switch on, the key is unavailable', () => {
  const state = { ...defaultState(LIBRARY, FIXED), circleOfFifths: true };
  assert.equal(isUnavailable(state, 'key'), true);
  assert.equal(isUnavailable({ ...state, circleOfFifths: false }, 'key'), false);
});

test('an exercise locks the options it fixes, shows its values for them and keeps the stored values', () => {
  const stored = { ...defaultState(LIBRARY, FIXED), rotation: 3, variations: ['6'], melodyAmount: 1 };
  const on = { ...stored, exercise: CIRCLE };
  assert.equal(isLocked(on, 'rotation'), true);
  assert.equal(isLocked(on, 'melodyAmount'), false);
  assert.equal(isLocked(stored, 'rotation'), false);
  assert.equal(exerciseState(on).rotation, 0);
  assert.deepEqual(exerciseState(on).variations, ['7', 'maj7']);
  assert.equal(exerciseState(on).melodyAmount, 1);
  assert.deepEqual(exerciseState(stored), stored);
  assert.equal(on.rotation, 3);
});

test('an exercise that switches the circle of fifths on makes the count and the key unavailable, though the stored switch is off', () => {
  const on = { ...defaultState(LIBRARY, FIXED), circleOfFifths: false, exercise: CIRCLE };
  assert.equal(isUnavailable(on, 'count'), true);
  assert.equal(isUnavailable(on, 'key'), true);
  assert.equal(effectiveState(on).count, 12);
});

test('displaySwitches gives the colour, roman and tones switches, and the melody switch while the inversions take effect', () => {
  const state = { ...defaultState(LIBRARY, FIXED), colour: false, roman: true, tones: true, inversions: true };
  assert.deepEqual(displaySwitches(state), { colour: false, roman: true, tones: true, melody: true });
  assert.equal(displaySwitches({ ...state, inversions: false }).melody, false);
  // On the guitar the inversions take no effect, so there is no melody note; the stored switch stays on.
  const guitar = { ...state, instrument: 'guitar' };
  assert.equal(displaySwitches(guitar).melody, false);
  assert.equal(guitar.inversions, true);
});
