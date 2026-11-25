import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSong } from '../../../../chordice/app/song/song.js';

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

/** A tone below a chord, as renderSong writes it; kind is '' or the class of a circled tone. */
const tone = (name, kind = '') => `<span class="tone${kind}">${name}</span>`;
/** A raised flat and sharp, as accidentals.js sets them in tones and chord symbols. */
const FLAT = '<span class="accidental">♭</span>';
const SHARP = '<span class="accidental">♯</span>';
const MINOR = '<span class="minor-sign">m</span>';
/** The top tone of a chord's column, which is circled; kind is the kind classes of the tone, as for tone(). */
const top = (name, kind = '') => tone(name, ` tone-top${kind}`);
/**
 * The tones column of a chord: the chord tones of its inversion, lowest first. The last one is the top tone. The bass, a tone
 * as tone() writes it, is set first in the column, below the other tones and a line; without a bass there is no line.
 */
const tones = (upper, bass = null) =>
  `<span class="tones">${bass === null ? '' : `<span class="bass-line">${bass}</span>`}${upper.join('')}</span>`;

test('renderSong names each row after its progression', () => {
  const html = renderSong(ROWS, PLAIN);
  assert.ok(html.includes('<h2><span class="row-title">Pop Progression'));
  assert.ok(html.includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0"><span class="symbol"><span class="chord-name">C</span><span class="bass"><span class="slash">/</span>E</span></span></li>'));
  assert.ok(html.includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="1"><span class="symbol"><span class="chord-name">G</span><span class="variation">7</span></span></li>'));
});

test('renderSong shows the chord tones in the order of the inversion, lowest first, and the bass below them', () => {
  const firstInversion = { ...ROWS[0].chords[0], inversion: 1 };
  assert.ok(renderSong([{ ...ROWS[0], chords: [firstInversion] }], EXTENDED).includes(tones([tone('e'), tone('g'), tone('c')], tone('e'))));
  const seventh = { ...ROWS[0].chords[1], inversion: 3 };
  assert.ok(renderSong([{ ...ROWS[0], chords: [seventh] }], EXTENDED).includes(tones([tone('f', ' tone-variation'), tone('g'), tone('h'), tone('d')], tone('g'))));
});

test('the bass is not shown with the melody switch alone, which lists only the top melody note', () => {
  const html = renderSong(ROWS, MELODY);
  assert.ok(!html.includes('bass-line'));
});

test('renderSong with the melody switch alone shows the top melody note alone beside the chord, circled, as the tones are shown', () => {
  const [first, second] = ROWS[0].chords;
  const html = renderSong([{ ...ROWS[0], chords: [first, { ...second, inversion: 2 }] }], MELODY);
  // Root position C/E: the highest chord tone G. G7 in its second inversion (D F G B) has B on top.
  assert.ok(html.includes(
    '<span class="chord-main"><span class="symbol"><span class="chord-name">C</span><span class="bass"><span class="slash">/</span>E</span></span></span>' +
    '<span class="tones"><span class="tone tone-top">g</span></span></li>',
  ));
  assert.ok(html.includes(
    '<span class="chord-main"><span class="symbol"><span class="chord-name">G</span><span class="variation">7</span></span></span>' +
    '<span class="tones"><span class="tone tone-top">h</span></span></li>',
  ));
  assert.ok(!html.includes('symbol-row'));
  assert.ok(!html.includes('title="Top melody note"'));
});

test('renderSong with the tones shown hides the melody note, circles the top tone instead, and leaves the symbol without a melody', () => {
  const html = renderSong([{ ...ROWS[0], chords: [{ ...ROWS[0].chords[0], inversion: 1 }] }], { ...EXTENDED, melody: true });
  assert.ok(!html.includes('symbol-row'));
  assert.ok(html.includes(
    '<li class="chord fn-tonic is-major has-tones" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0">' +
    '<span class="chord-main"><span class="roman">I</span><span class="symbol"><span class="chord-name">C</span><span class="bass"><span class="slash">/</span>E</span></span></span>' +
    tones([tone('e'), tone('g'), top('c')], tone('e')) + '</li>',
  ));
});

test('renderSong keeps accidentals of the melody note, in lower case with a raised sign', () => {
  // Ab7 in its third inversion is Gb Ab C Eb: the top note is Eb, shown as e♭.
  const flat = { ...ROWS[0].chords[1], symbol: 'Ab7', displaySymbol: 'Ab7', tones: ['Ab', 'C', 'Eb', 'Gb'], inversion: 3 };
  const html = renderSong([{ ...ROWS[0], chords: [flat] }], { ...PLAIN, melody: true });
  // Eb is foreign to C, but the melody note standing alone is not coloured.
  assert.ok(html.includes(`<span class="tone tone-top">e${FLAT}</span>`));
  assert.ok(!html.includes('tone-foreign'));
});

test('renderSong without the melody switch shows no melody note in either view', () => {
  for (const display of [PLAIN, EXTENDED]) {
    const html = renderSong(ROWS, display);
    assert.ok(!html.includes('tone-top'));
  }
});

test('renderSong in extended view shows the roman numeral above the chord symbol, then the tones in lower case', () => {
  const html = renderSong(ROWS, EXTENDED);
  assert.ok(html.includes('chord fn-tonic is-major'));
  assert.ok(html.includes('<span class="chord-main"><span class="roman">I</span><span class="symbol"><span class="chord-name">C</span><span class="bass"><span class="slash">/</span>E</span></span></span>' + tones([tone('c'), tone('e'), tone('g')], tone('e')) + ''));
  assert.ok(html.includes('<span class="chord-main"><span class="roman">V</span><span class="symbol"><span class="chord-name">G</span><span class="variation">7</span></span></span>' + tones([tone('g'), tone('h'), tone('d'), tone('f', ' tone-variation')], tone('g')) + ''));
});

test('renderSong in extended view wraps only the chord name in its own span, the variation follows it unbolded', () => {
  const minor = { ...ROWS[0], chords: [{ ...ROWS[0].chords[0], symbol: 'F#m7', variation: '7', quality: 'minor', roman: 'vi', bass: null }] };
  const html = renderSong([minor], EXTENDED);
  assert.ok(html.includes(`<span class="symbol"><span class="chord-name">F${SHARP}${MINOR}</span><span class="variation">7</span></span>`));
});

test('renderSong in extended view shows the bass after the variation, e.g. G7/B, and no bass when there is none', () => {
  const withBass = { ...ROWS[0], chords: [{ ...ROWS[0].chords[0], symbol: 'G7', variation: '7', bass: 'B', roman: 'V' }] };
  const html = renderSong([withBass], EXTENDED);
  assert.ok(html.includes('<span class="symbol"><span class="chord-name">G</span><span class="variation">7</span><span class="bass"><span class="slash">/</span>B</span></span>'));
  const withoutBass = renderSong(ROWS, EXTENDED);
  assert.ok(!withoutBass.includes('<span class="bass"><span class="slash">/</span>G</span>'));
});

test('renderSong marks minor chords so that they get the paler colour', () => {
  const minor = { ...ROWS[0], chords: [{ ...ROWS[0].chords[0], roman: 'vi', function: 'tonic', quality: 'minor' }] };
  const html = renderSong([minor], EXTENDED);
  assert.ok(html.includes('chord fn-tonic is-minor'));
  assert.ok(!html.includes('is-major'));
});

test('renderSong shows only the active rotation or permutation tags in the heading, and no key', () => {
  const heading = (rows) => /<h2>[\s\S]*?<\/h2>/.exec(renderSong(rows, PLAIN))[0];
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

test('renderSong renders no chords when no progression is selected', () => {
  assert.equal(renderSong([], PLAIN), '');
});

test('renderSong escapes progression names', () => {
  const html = renderSong([{ ...ROWS[0], name: '<script>' }], PLAIN);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('renderSong separates the progression name from its category with a middle dot', () => {
  const heading = /<h2>[\s\S]*?<\/h2>/.exec(renderSong(ROWS, PLAIN))[0];
  assert.ok(heading.startsWith('<h2><span class="row-title">Pop Progression <span class="meta">· Pop</span></span>'));
});

test('the colour switch alone colours the chords by harmonic function and keeps the split symbols', () => {
  const html = renderSong(ROWS, { colour: true, roman: false, tones: false });
  assert.ok(html.includes('<li class="chord fn-tonic is-major" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0"><span class="symbol"><span class="chord-name">C</span><span class="bass"><span class="slash">/</span>E</span></span></li>'));
  assert.ok(!html.includes('class="roman"'));
  assert.ok(!html.includes('class="tones"'));
});

test('the roman and tones switches alone add the roman numerals and the tones without colours', () => {
  const html = renderSong(ROWS, { colour: false, roman: true, tones: true });
  assert.ok(html.includes('<li class="chord has-tones" role="button"'));
  assert.ok(!html.includes('fn-'));
  assert.ok(html.includes('<span class="roman">I</span>'));
  assert.ok(html.includes(tones([tone('c'), tone('e'), tone('g')], tone('e'))));
});

test('the roman switch alone adds the roman numeral and no tones, the tones switch alone adds the tones and no roman numeral', () => {
  const roman = renderSong(ROWS, { colour: false, roman: true, tones: false });
  assert.ok(roman.includes('<span class="roman">I</span>'));
  assert.ok(!roman.includes('class="tones"'));
  const tonesOnly = renderSong(ROWS, { colour: false, roman: false, tones: true });
  assert.ok(!tonesOnly.includes('class="roman"'));
  assert.ok(tonesOnly.includes(tones([tone('c'), tone('e'), tone('g')], tone('e'))));
  // The symbol is split into name and bass whichever switches are on, also with both off.
  assert.ok(tonesOnly.includes('<span class="chord-name">C</span><span class="bass"><span class="slash">/</span>E</span>'));
  assert.ok(renderSong(ROWS, PLAIN).includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0"><span class="symbol"><span class="chord-name">C</span><span class="bass"><span class="slash">/</span>E</span></span></li>'));
});

test('a natural B is written h in the tones and in the melody note, but B flat stays b♭, and chord symbols keep their names', () => {
  const cmaj7 = { roman: 'I', function: 'tonic', root: 'C', quality: 'major', symbol: 'Cmaj7', displaySymbol: 'Cmaj7', tones: ['C', 'E', 'G', 'B'], inversion: 0, bass: null, variation: 'maj7' };
  const html = renderSong([{ ...ROWS[0], chords: [cmaj7] }], { colour: false, roman: true, tones: true, melody: true });
  assert.ok(!html.includes('Top melody note'));
  assert.ok(html.includes(tones([tone('c'), tone('e'), tone('g'), top('h', ' tone-variation')], tone('c'))));
  assert.ok(!html.includes('>b<'));

  const bflat = { roman: 'IV', function: 'subdominant', root: 'Bb', quality: 'major', symbol: 'Bb', displaySymbol: 'Bb', tones: ['Bb', 'D', 'F'], inversion: 0, bass: null, variation: null };
  const flatHtml = renderSong([{ ...ROWS[0], tonic: 'Bb', chords: [bflat] }], { colour: false, roman: true, tones: true, melody: true });
  assert.ok(flatHtml.includes(`<span class="chord-name">B${FLAT}</span>`));
  assert.ok(!flatHtml.includes('Top melody note'));
  assert.ok(flatHtml.includes(tones([tone(`b${FLAT}`), tone('d'), top('f')], tone(`b${FLAT}`))));
});

test('with the tones shown and the melody switch off, the top tone is not circled, while red and blue tones still are', () => {
  const html = renderSong([{ ...ROWS[0], chords: [{ ...ROWS[0].chords[0], inversion: 1 }] }], EXTENDED);
  assert.ok(!html.includes('tone-top'));
  assert.ok(html.includes(tones([tone('e'), tone('g'), tone('c')], tone('e'))));
  const bflat = { roman: 'bVI', function: 'subdominant', root: 'Ab', quality: 'major', symbol: 'Ab', displaySymbol: 'Ab', tones: ['Ab', 'C', 'Eb'], inversion: 0, bass: null, variation: null };
  assert.ok(renderSong([{ ...ROWS[0], tonic: 'C', chords: [bflat] }], EXTENDED).includes(tones([tone(`a${FLAT}`, ' tone-foreign'), tone('c'), tone(`e${FLAT}`, ' tone-foreign')], tone(`a${FLAT}`, ' tone-foreign'))));
});

test('a tone the chord variation adds is circled in blue, and the chord tones of the base triad are not', () => {
  const html = renderSong(ROWS, EXTENDED);
  assert.ok(html.includes(tones([tone('g'), tone('h'), tone('d'), tone('f', ' tone-variation')], tone('g'))));
});

test('a tone foreign to the key is circled in red, judged by the key of the row', () => {
  const bflat = { roman: 'bVI', function: 'subdominant', root: 'Ab', quality: 'major', symbol: 'Ab', displaySymbol: 'Ab', tones: ['Ab', 'C', 'Eb'], inversion: 0, bass: null, variation: null };
  // Ab and Eb are foreign to C, so they are red; C is in the key.
  const inC = renderSong([{ ...ROWS[0], tonic: 'C', chords: [bflat] }], EXTENDED);
  assert.ok(inC.includes(tones([tone(`a${FLAT}`, ' tone-foreign'), tone('c'), tone(`e${FLAT}`, ' tone-foreign')], tone(`a${FLAT}`, ' tone-foreign'))));
  // In the key of Ab the same chord has no foreign tone.
  const inAb = renderSong([{ ...ROWS[0], tonic: 'Ab', chords: [bflat] }], EXTENDED);
  assert.ok(!inAb.includes('tone-foreign'));
});

test('a foreign tone that the variation adds is red, not blue', () => {
  // Bb7 in C: the Ab is the seventh, added by the variation and foreign to C; red takes precedence.
  const bb7 = { roman: 'V', function: 'dominant', root: 'Bb', quality: 'major', symbol: 'Bb7', displaySymbol: 'Bb7', tones: ['Bb', 'D', 'F', 'Ab'], inversion: 0, bass: null, variation: '7' };
  const html = renderSong([{ ...ROWS[0], tonic: 'C', chords: [bb7] }], EXTENDED);
  assert.ok(html.includes(tone(`a${FLAT}`, ' tone-foreign')));
  assert.ok(!html.includes(tone(`a${FLAT}`, ' tone-variation')));
});

test('the slash bass is shown below the tones after a line, and stays in the symbol too', () => {
  const g7OverF = { roman: 'V', function: 'dominant', root: 'G', quality: 'major', symbol: 'G7', displaySymbol: 'G7/F', tones: ['G', 'B', 'D', 'F'], inversion: 0, bass: 'F', variation: '7' };
  const html = renderSong([{ ...ROWS[0], tonic: 'C', chords: [g7OverF] }], EXTENDED);
  assert.ok(html.includes('<span class="bass"><span class="slash">/</span>F</span>'));
  assert.ok(html.includes(tones([tone('g'), tone('h'), tone('d'), tone('f', ' tone-variation')], tone('f', ' tone-variation'))));
  assert.ok(!html.includes('|'));
});

test('a foreign chord tone over a slash bass is red in the tones column', () => {
  const c7OverBb = { roman: 'I', function: 'tonic', root: 'C', quality: 'major', symbol: 'C7', displaySymbol: 'C7/Bb', tones: ['C', 'E', 'G', 'Bb'], inversion: 0, bass: 'Bb', variation: '7' };
  const html = renderSong([{ ...ROWS[0], tonic: 'C', chords: [c7OverBb] }], EXTENDED);
  assert.ok(html.includes(tone(`b${FLAT}`, ' tone-foreign')));
});

test('the tones column lists the chord tones, then the bass after a line, without other separators', () => {
  const html = renderSong(ROWS, EXTENDED);
  assert.ok(html.includes(tones([tone('c'), tone('e'), tone('g')], tone('e'))));
  assert.ok(!html.includes('&nbsp;|&nbsp;'));
});

test('renderSong starts each row with its key and relative minor, in the font of the name and set off by a middle dot, only when showKey is on', () => {
  const rows = [{ ...ROWS[0], tonic: 'F' }];
  assert.ok(renderSong(rows, PLAIN, { showKey: true })
    .includes('<span class="row-title">F (D<span class="minor-sign">m</span>) · Pop Progression <span class="meta">· Pop</span></span>'));
  assert.ok(!renderSong(rows, PLAIN).includes('F (Dm)'));
  assert.ok(!renderSong(rows, PLAIN, { showKey: false }).includes('F (Dm)'));
});

test('renderSong raises the accidentals of the key at the start of a row', () => {
  const html = renderSong([{ ...ROWS[0], tonic: 'F#' }], PLAIN, { showKey: true });
  assert.ok(html.includes(`<span class="row-title">F${SHARP} (D${SHARP}${MINOR}) · `));
});
