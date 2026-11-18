import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRows } from '../../../chordice/js/progressions/progressions.js';
import { defaultState } from '../../../chordice/js/core/state.js';

const ROWS = [{
  index: 0,
  name: 'Pop Progression',
  group: 'Pop',
  tonic: 'C',
  permuted: false,
  rotated: true,
  chords: [
    { roman: 'I', function: 'tonic', root: 'C', quality: 'major', symbol: 'C', displaySymbol: 'C/E', tones: ['C', 'E', 'G'], inversion: 0, bass: 'E', variation: null },
    { roman: 'V', function: 'dominant', quality: 'major', root: 'G', symbol: 'G7', displaySymbol: 'G7', tones: ['G', 'B', 'D', 'F'], inversion: 0, bass: null, variation: '7' },
  ],
}];

const PLAIN = { colour: false, roman: false, tones: false };
const EXTENDED = { colour: true, roman: true, tones: true };
const MELODY = { ...PLAIN, melody: true };

/** A tone below a chord, as renderRows writes it; kind is '' or the class of a circled tone. */
const tone = (name, kind = '') => `<span class="tone${kind}">${name}</span>`;
/** The top tone of a chord's column, which is circled; kind is the kind classes of the tone, as for tone(). */
const top = (name, kind = '') => tone(name, ` tone-top${kind}`);
/** The tones column of a chord: the chord tones of its inversion, lowest first, without the bass. The last one is the top tone. */
const tones = (upper) => `<span class="tones">${upper.join('')}</span>`;

test('renderRows names each row after its progression', () => {
  const html = renderRows(ROWS, PLAIN);
  assert.ok(html.includes('<h2><span class="row-title">Pop Progression'));
  assert.ok(html.includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0">C/E</li>'));
  assert.ok(html.includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="1">G7</li>'));
});

test('renderRows shows the chord tones in the order of the inversion, lowest first, and leaves out the slash bass', () => {
  const firstInversion = { ...ROWS[0].chords[0], inversion: 1 };
  assert.ok(renderRows([{ ...ROWS[0], chords: [firstInversion] }], EXTENDED).includes(tones([tone('e'), tone('g'), tone('c')])));
  const seventh = { ...ROWS[0].chords[1], inversion: 3 };
  assert.ok(renderRows([{ ...ROWS[0], chords: [seventh] }], EXTENDED).includes(tones([tone('f', ' tone-variation'), tone('g'), tone('h'), tone('d')])));
});

test('renderRows with the melody switch alone shows the top melody note alone beside the chord, circled, as the tones are shown', () => {
  const [first, second] = ROWS[0].chords;
  const html = renderRows([{ ...ROWS[0], chords: [first, { ...second, inversion: 2 }] }], MELODY);
  // Root position C/E: the highest chord tone G. G7 in its second inversion (D F G B) has B on top.
  assert.ok(html.includes(
    '<span class="chord-main"><span class="symbol"><span class="chord-name">C</span><span class="bass">/E</span></span></span>' +
    '<span class="tones"><span class="tone tone-top">g</span></span></li>',
  ));
  assert.ok(html.includes(
    '<span class="chord-main"><span class="symbol"><span class="chord-name">G</span><span class="variation">7</span></span></span>' +
    '<span class="tones"><span class="tone tone-top">h</span></span></li>',
  ));
  assert.ok(!html.includes('symbol-row'));
  assert.ok(!html.includes('title="Top melody note"'));
});

test('renderRows with the tones shown hides the melody note, circles the top tone instead, and leaves the symbol without a melody', () => {
  const html = renderRows([{ ...ROWS[0], chords: [{ ...ROWS[0].chords[0], inversion: 1 }] }], { ...EXTENDED, melody: true });
  assert.ok(!html.includes('symbol-row'));
  assert.ok(html.includes(
    '<li class="chord fn-tonic is-major has-tones" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0">' +
    '<span class="chord-main"><span class="roman">I</span><span class="symbol"><span class="chord-name">C</span><span class="bass">/E</span></span></span>' +
    tones([tone('e'), tone('g'), top('c')]) + '</li>',
  ));
});

test('renderRows keeps accidentals of the melody note, in lower case', () => {
  // Ab7 in its third inversion is Gb Ab C Eb: the top note is Eb, shown as eb.
  const flat = { ...ROWS[0].chords[1], symbol: 'Ab7', displaySymbol: 'Ab7', tones: ['Ab', 'C', 'Eb', 'Gb'], inversion: 3 };
  const html = renderRows([{ ...ROWS[0], chords: [flat] }], { ...PLAIN, melody: true });
  // Eb is foreign to C, but the melody note standing alone is not coloured.
  assert.ok(html.includes('<span class="tone tone-top">eb</span>'));
  assert.ok(!html.includes('tone-foreign'));
});

test('renderRows without the melody switch shows no melody note in either view', () => {
  for (const display of [PLAIN, EXTENDED]) {
    const html = renderRows(ROWS, display);
    assert.ok(!html.includes('tone-top'));
  }
});

test('renderRows in extended view shows the roman numeral above the chord symbol, then the tones in lower case', () => {
  const html = renderRows(ROWS, EXTENDED);
  assert.ok(html.includes('chord fn-tonic is-major'));
  assert.ok(html.includes('<span class="chord-main"><span class="roman">I</span><span class="symbol"><span class="chord-name">C</span><span class="bass">/E</span></span></span>' + tones([tone('c'), tone('e'), tone('g')]) + ''));
  assert.ok(html.includes('<span class="chord-main"><span class="roman">V</span><span class="symbol"><span class="chord-name">G</span><span class="variation">7</span></span></span>' + tones([tone('g'), tone('h'), tone('d'), tone('f', ' tone-variation')]) + ''));
});

test('renderRows in extended view wraps only the chord name in its own span, the variation follows it unbolded', () => {
  const minor = { ...ROWS[0], chords: [{ ...ROWS[0].chords[0], symbol: 'F#m7', variation: '7', quality: 'minor', roman: 'vi', bass: null }] };
  const html = renderRows([minor], EXTENDED);
  assert.ok(html.includes('<span class="symbol"><span class="chord-name">F#m</span><span class="variation">7</span></span>'));
});

test('renderRows in extended view shows the bass after the variation, e.g. G7/B, and no bass when there is none', () => {
  const withBass = { ...ROWS[0], chords: [{ ...ROWS[0].chords[0], symbol: 'G7', variation: '7', bass: 'B', roman: 'V' }] };
  const html = renderRows([withBass], EXTENDED);
  assert.ok(html.includes('<span class="symbol"><span class="chord-name">G</span><span class="variation">7</span><span class="bass">/B</span></span>'));
  const withoutBass = renderRows(ROWS, EXTENDED);
  assert.ok(!withoutBass.includes('<span class="bass">/G</span>'));
});

test('renderRows marks minor chords so that they get the paler colour', () => {
  const minor = { ...ROWS[0], chords: [{ ...ROWS[0].chords[0], roman: 'vi', function: 'tonic', quality: 'minor' }] };
  const html = renderRows([minor], EXTENDED);
  assert.ok(html.includes('chord fn-tonic is-minor'));
  assert.ok(!html.includes('is-major'));
});

test('renderRows shows only the active rotation or permutation tags in the heading, and no key', () => {
  const heading = (rows) => /<h2>[\s\S]*?<\/h2>/.exec(renderRows(rows, PLAIN))[0];
  const rotatedOnly = heading(ROWS);
  assert.ok(rotatedOnly.includes('<span class="tag">Rotation</span>'));
  assert.ok(!rotatedOnly.includes('Permutation'));
  assert.ok(rotatedOnly.includes('<span class="meta">· Pop</span>'));
  assert.ok(!rotatedOnly.includes('C'));

  const both = heading([{ ...ROWS[0], permuted: true }]);
  assert.ok(both.includes('<span class="tag">Rotation</span><span class="tag">Permutation</span>'));

  const neither = heading([{ ...ROWS[0], rotated: false, permuted: false }]);
  assert.ok(!neither.includes('tag'));
  assert.ok(!neither.includes('tags'));
});

test('renderRows renders no chords when no progression is selected', () => {
  assert.equal(renderRows([], PLAIN), '');
});

test('renderRows escapes progression names', () => {
  const html = renderRows([{ ...ROWS[0], name: '<script>' }], PLAIN);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('renderRows separates the progression name from its category with a middle dot', () => {
  const heading = /<h2>[\s\S]*?<\/h2>/.exec(renderRows(ROWS, PLAIN))[0];
  assert.ok(heading.startsWith('<h2><span class="row-title">Pop Progression <span class="meta">· Pop</span></span>'));
});

test('the colour switch alone colours the chords by harmonic function and keeps the plain symbols', () => {
  const html = renderRows(ROWS, { colour: true, roman: false, tones: false });
  assert.ok(html.includes('<li class="chord fn-tonic is-major" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0">C/E</li>'));
  assert.ok(!html.includes('class="roman"'));
  assert.ok(!html.includes('class="tones"'));
});

test('the roman and tones switches alone add the roman numerals and the tones without colours', () => {
  const html = renderRows(ROWS, { colour: false, roman: true, tones: true });
  assert.ok(html.includes('<li class="chord has-tones" role="button"'));
  assert.ok(!html.includes('fn-'));
  assert.ok(html.includes('<span class="roman">I</span>'));
  assert.ok(html.includes(tones([tone('c'), tone('e'), tone('g')])));
});

test('the roman switch alone adds the roman numeral and no tones, the tones switch alone adds the tones and no roman numeral', () => {
  const roman = renderRows(ROWS, { colour: false, roman: true, tones: false });
  assert.ok(roman.includes('<span class="roman">I</span>'));
  assert.ok(!roman.includes('class="tones"'));
  const tonesOnly = renderRows(ROWS, { colour: false, roman: false, tones: true });
  assert.ok(!tonesOnly.includes('class="roman"'));
  assert.ok(tonesOnly.includes(tones([tone('c'), tone('e'), tone('g')])));
  // The symbol is split into name and bass with either switch on, and kept whole with both off.
  assert.ok(tonesOnly.includes('<span class="chord-name">C</span><span class="bass">/E</span>'));
  assert.ok(renderRows(ROWS, PLAIN).includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0">C/E</li>'));
});

test('a natural B is written h in the tones and in the melody note, but B flat stays bb, and chord symbols keep their names', () => {
  const cmaj7 = { roman: 'I', function: 'tonic', root: 'C', quality: 'major', symbol: 'Cmaj7', displaySymbol: 'Cmaj7', tones: ['C', 'E', 'G', 'B'], inversion: 0, bass: null, variation: 'maj7' };
  const html = renderRows([{ ...ROWS[0], chords: [cmaj7] }], { colour: false, roman: true, tones: true, melody: true });
  assert.ok(!html.includes('Top melody note'));
  assert.ok(html.includes(tones([tone('c'), tone('e'), tone('g'), top('h', ' tone-variation')])));
  assert.ok(!html.includes('>b<'));

  const bflat = { roman: 'IV', function: 'subdominant', root: 'Bb', quality: 'major', symbol: 'Bb', displaySymbol: 'Bb', tones: ['Bb', 'D', 'F'], inversion: 0, bass: null, variation: null };
  const flatHtml = renderRows([{ ...ROWS[0], tonic: 'Bb', chords: [bflat] }], { colour: false, roman: true, tones: true, melody: true });
  assert.ok(flatHtml.includes('<span class="chord-name">Bb</span>'));
  assert.ok(!flatHtml.includes('Top melody note'));
  assert.ok(flatHtml.includes(tones([tone('bb'), tone('d'), top('f')])));
});

test('with the tones shown and the melody switch off, the top tone is not circled, while red and blue tones still are', () => {
  const html = renderRows([{ ...ROWS[0], chords: [{ ...ROWS[0].chords[0], inversion: 1 }] }], EXTENDED);
  assert.ok(!html.includes('tone-top'));
  assert.ok(html.includes(tones([tone('e'), tone('g'), tone('c')])));
  const bflat = { roman: 'bVI', function: 'subdominant', root: 'Ab', quality: 'major', symbol: 'Ab', displaySymbol: 'Ab', tones: ['Ab', 'C', 'Eb'], inversion: 0, bass: null, variation: null };
  assert.ok(renderRows([{ ...ROWS[0], tonic: 'C', chords: [bflat] }], EXTENDED).includes(tones([tone('ab', ' tone-foreign'), tone('c'), tone('eb', ' tone-foreign')])));
});

test('a tone the chord variation adds is circled in blue, and the chord tones of the base triad are not', () => {
  const html = renderRows(ROWS, EXTENDED);
  assert.ok(html.includes(tones([tone('g'), tone('h'), tone('d'), tone('f', ' tone-variation')])));
});

test('a tone foreign to the key is circled in red, judged by the key of the row', () => {
  const bflat = { roman: 'bVI', function: 'subdominant', root: 'Ab', quality: 'major', symbol: 'Ab', displaySymbol: 'Ab', tones: ['Ab', 'C', 'Eb'], inversion: 0, bass: null, variation: null };
  // Ab and Eb are foreign to C, so they are red; C is in the key.
  const inC = renderRows([{ ...ROWS[0], tonic: 'C', chords: [bflat] }], EXTENDED);
  assert.ok(inC.includes(tones([tone('ab', ' tone-foreign'), tone('c'), tone('eb', ' tone-foreign')])));
  // In the key of Ab the same chord has no foreign tone.
  const inAb = renderRows([{ ...ROWS[0], tonic: 'Ab', chords: [bflat] }], EXTENDED);
  assert.ok(!inAb.includes('tone-foreign'));
});

test('a foreign tone that the variation adds is red, not blue', () => {
  // Bb7 in C: the Ab is the seventh, added by the variation and foreign to C; red takes precedence.
  const bb7 = { roman: 'V', function: 'dominant', root: 'Bb', quality: 'major', symbol: 'Bb7', displaySymbol: 'Bb7', tones: ['Bb', 'D', 'F', 'Ab'], inversion: 0, bass: null, variation: '7' };
  const html = renderRows([{ ...ROWS[0], tonic: 'C', chords: [bb7] }], EXTENDED);
  assert.ok(html.includes(tone('ab', ' tone-foreign')));
  assert.ok(!html.includes(tone('ab', ' tone-variation')));
});

test('the bass is not shown in the tones line, neither its name nor a bar, while the slash bass stays in the symbol', () => {
  const g7OverF = { roman: 'V', function: 'dominant', root: 'G', quality: 'major', symbol: 'G7', displaySymbol: 'G7/F', tones: ['G', 'B', 'D', 'F'], inversion: 0, bass: 'F', variation: '7' };
  const html = renderRows([{ ...ROWS[0], tonic: 'C', chords: [g7OverF] }], EXTENDED);
  assert.ok(html.includes('<span class="bass">/F</span>'));
  assert.ok(html.includes(tones([tone('g'), tone('h'), tone('d'), tone('f', ' tone-variation')])));
  assert.ok(!html.includes('|'));
});

test('a foreign chord tone under a chord is red, the same as before the bass was removed', () => {
  const c7OverBb = { roman: 'I', function: 'tonic', root: 'C', quality: 'major', symbol: 'C7', displaySymbol: 'C7/Bb', tones: ['C', 'E', 'G', 'Bb'], inversion: 0, bass: 'Bb', variation: '7' };
  const html = renderRows([{ ...ROWS[0], tonic: 'C', chords: [c7OverBb] }], EXTENDED);
  assert.ok(html.includes(tone('bb', ' tone-foreign')));
});

test('the tones column lists the chord tones only, without separators', () => {
  const html = renderRows(ROWS, EXTENDED);
  assert.ok(html.includes(tones([tone('c'), tone('e'), tone('g')])));
  assert.ok(!html.includes('&nbsp;|&nbsp;'));
});
