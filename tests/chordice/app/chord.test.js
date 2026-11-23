import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chordAttributes, chordBoxHtml, chordCell } from '../../../chordice/app/chord.js';

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

test('chordCell with plain display shows the symbol as text, with the variation raised in a span of its own', () => {
  const html = chordCell({ ...CHORD, displaySymbol: 'G7/B', bass: 'B' }, '', { colour: false, roman: false, tones: false }, 'C');
  assert.ok(html.includes('>G<span class="variation">7</span><span class="bass"><span class="slash">/</span>B</span></li>'));
  assert.ok(!html.includes('chord-name'));
  assert.ok(!html.includes('roman'));
  assert.ok(!html.includes('class="tones"'));
});

test('without a key the tones are not coloured, as the notes window of a chord without a key shows them', () => {
  const html = chordBoxHtml({ ...CHORD, tones: ['G', 'B', 'D', 'F'], inversion: 0 }, { colour: false, roman: false, tones: true, melody: true }, null);
  assert.ok(!html.includes('tone-foreign'));
  assert.ok(!html.includes('tone-variation'));
  assert.ok(html.includes('<span class="tone tone-top">f</span>'));
});

test('chordCell sets the minor sign smaller and keeps an accidental of the variation inside the raised variation', () => {
  const chord = { ...CHORD, quality: 'minor', symbol: 'Bbm7b5', displaySymbol: 'Bbm7b5', variation: '7b5' };
  const flat = '<span class="accidental">♭</span>';
  const plain = chordCell(chord, '', { colour: false, roman: false, tones: false }, 'C');
  assert.ok(plain.includes(`>B${flat}<span class="minor-sign">m</span><span class="variation">7${flat}5</span></li>`));
  const split = chordCell(chord, '', { colour: false, roman: true, tones: false }, 'C');
  assert.ok(split.includes(`<span class="chord-name">B${flat}<span class="minor-sign">m</span></span><span class="variation">7${flat}5</span>`));
});

test('chordCell shows a chord given only by its display symbol as that symbol', () => {
  const html = chordCell({ displaySymbol: 'Am/C', tones: ['A', 'C', 'E'] }, '', {}, null);
  assert.ok(html.includes('>A<span class="minor-sign">m</span>/C</li>'));
  // Without a symbol the chord has no parts, so the bass is not set apart.
});

test('chordCell keeps the sus of a suspended chord on the line and raises only its numbers', () => {
  const sus4 = { ...CHORD, symbol: 'Csus4', displaySymbol: 'Csus4', variation: 'sus4' };
  const plain = chordCell(sus4, '', { colour: false, roman: false, tones: false }, 'C');
  assert.ok(plain.includes('>C<span class="sus">sus</span><span class="variation">4</span></li>'));
  const sevenSus4 = { ...CHORD, symbol: 'G7sus4', displaySymbol: 'G7sus4/D', variation: '7sus4', bass: 'D' };
  const split = chordCell(sevenSus4, '', { colour: false, roman: true, tones: false }, 'C');
  assert.ok(split.includes('<span class="chord-name">G</span><span class="variation">7</span><span class="sus">sus</span>' +
    '<span class="variation">4</span><span class="bass"><span class="slash">/</span>D</span>'));
});
