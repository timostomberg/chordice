import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chordAttributes, chordBoxHtml, chordCell } from '../../../chordice/js/progressions/chord.js';

const CHORD = {
  roman: 'V', function: 'dominant', root: 'G', quality: 'major', symbol: 'G7', displaySymbol: 'G7',
  tones: ['G', 'B', 'D', 'F'], inversion: 0, bass: null, variation: '7',
};

test('chordAttributes makes a chord open its notes window with its row and chord index', () => {
  const html = chordAttributes(2, 5);
  assert.ok(html.includes('data-action="show-notes"'));
  assert.ok(html.includes('data-row="2"'));
  assert.ok(html.includes('data-chord="5"'));
  assert.ok(html.includes('role="button"'));
});

test('chordBoxHtml shows the chord as a row does, without the click action', () => {
  const html = chordBoxHtml(CHORD, { colour: true, roman: true, tones: true }, 'C');
  assert.ok(html.startsWith('<li class="chord fn-dominant is-major has-tones"'));
  assert.ok(html.includes('<span class="roman">V</span>'));
  assert.ok(!html.includes('data-action'));
});

test('chordCell marks the box with has-tones only while the tones switch is on', () => {
  assert.ok(chordCell(CHORD, '', { colour: false, roman: true, tones: true }, 'C').startsWith('<li class="chord has-tones"'));
  assert.ok(!chordCell(CHORD, '', { colour: false, roman: true, tones: false }, 'C').includes('has-tones'));
});

test('chordCell without colour has no function classes', () => {
  const html = chordCell(CHORD, '', { colour: false, roman: false, tones: false }, 'C');
  assert.equal(html.startsWith('<li class="chord"'), true);
  assert.ok(!html.includes('fn-'));
});

test('chordCell with plain display shows the display symbol as text', () => {
  const html = chordCell({ ...CHORD, displaySymbol: 'G7/B' }, '', { colour: false, roman: false, tones: false }, 'C');
  assert.ok(html.includes('G7/B'));
  assert.ok(!html.includes('roman'));
  assert.ok(!html.includes('class="tones"'));
});

test('without a key the tones are not coloured, as the notes window of a chord without a key shows them', () => {
  const html = chordBoxHtml({ ...CHORD, tones: ['G', 'B', 'D', 'F'], inversion: 0 }, { colour: false, roman: false, tones: true, melody: true }, null);
  assert.ok(!html.includes('tone-foreign'));
  assert.ok(!html.includes('tone-variation'));
  assert.ok(html.includes('<span class="tone tone-top">f</span>'));
});
