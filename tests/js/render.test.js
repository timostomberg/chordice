import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOptions, renderRows } from '../../chordice/js/render.js';
import { buildLibrary } from '../../chordice/js/library.js';
import { defaultState } from '../../chordice/js/state.js';

const LIBRARY = buildLibrary({
  Pop: { progressions: { 'Pop Progression': ['I', 'V'] } },
});

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
/** The tones line of a chord: the chord tones of its inversion, without the bass. */
const tones = (upper) => `<span class="tones">${upper.join(' · ')}</span>`;

test('renderRows names each row after its progression', () => {
  const html = renderRows(ROWS, PLAIN);
  assert.ok(html.includes('<h2><span class="row-title">Pop Progression'));
  assert.ok(html.includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0">C/E</li>'));
  assert.ok(html.includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="1">G7</li>'));
});

test('renderRows shows the chord tones in the order of the inversion, lowest first, and the slash bass after them', () => {
  const firstInversion = { ...ROWS[0].chords[0], inversion: 1 };
  assert.ok(renderRows([{ ...ROWS[0], chords: [firstInversion] }], EXTENDED).includes(tones([tone('e'), tone('g'), tone('c')])));
  const seventh = { ...ROWS[0].chords[1], inversion: 3 };
  assert.ok(renderRows([{ ...ROWS[0], chords: [seventh] }], EXTENDED).includes(tones([tone('f', ' tone-variation'), tone('g'), tone('h'), tone('d')])));
});

test('renderRows with the melody switch on shows the top melody note inside every chord box, right of the symbol, in lower case', () => {
  const [first, second] = ROWS[0].chords;
  const html = renderRows([{ ...ROWS[0], chords: [first, { ...second, inversion: 2 }] }], MELODY);
  // Root position C/E: the highest chord tone G. G7 in its second inversion (D F G B) has B on top.
  assert.ok(html.includes('data-chord="0"><span class="symbol-row">C/E<span class="melody" title="Top melody note">g</span></span></li>'));
  assert.ok(html.includes('data-chord="1"><span class="symbol-row">G7<span class="melody" title="Top melody note">h</span></span></li>'));
});

test('renderRows in the extended view puts the melody note right of the chord symbol, above the tones', () => {
  const html = renderRows([{ ...ROWS[0], chords: [{ ...ROWS[0].chords[0], inversion: 1 }] }], { ...EXTENDED, melody: true });
  assert.ok(html.includes(
    '<span class="symbol-row"><span class="symbol"><span class="chord-name">C</span><span class="bass">/E</span></span>' +
    '<span class="melody" title="Top melody note">c</span></span>' + tones([tone('e'), tone('g'), tone('c')]) + '</li>',
  ));
});

test('renderRows keeps accidentals of the melody note, in lower case', () => {
  // Ab7 in its third inversion is Gb Ab C Eb: the top note is Eb, shown as eb.
  const flat = { ...ROWS[0].chords[1], symbol: 'Ab7', displaySymbol: 'Ab7', tones: ['Ab', 'C', 'Eb', 'Gb'], inversion: 3 };
  const html = renderRows([{ ...ROWS[0], chords: [flat] }], { ...PLAIN, melody: true });
  assert.ok(html.includes('<span class="melody" title="Top melody note">eb</span>'));
});

test('renderRows without the melody switch shows no melody note in either view', () => {
  for (const display of [PLAIN, EXTENDED]) {
    const html = renderRows(ROWS, display);
    assert.ok(!html.includes('Top melody note'));
  }
});

test('renderRows in extended view shows the roman numeral above the chord symbol, then the tones in lower case', () => {
  const html = renderRows(ROWS, EXTENDED);
  assert.ok(html.includes('chord fn-tonic is-major'));
  assert.ok(html.includes('<span class="roman">I</span><span class="symbol"><span class="chord-name">C</span><span class="bass">/E</span></span>' + tones([tone('c'), tone('e'), tone('g')]) + ''));
  assert.ok(html.includes('<span class="roman">V</span><span class="symbol"><span class="chord-name">G</span><span class="variation">7</span></span>' + tones([tone('g'), tone('h'), tone('d'), tone('f', ' tone-variation')]) + ''));
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

test('renderOptions shows progressions and groups as chips, not checkboxes', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  assert.ok(!html.includes('checkbox'));
  assert.ok(html.includes('class="chip is-on" aria-pressed="true" data-action="toggle-progression" data-id="Pop / Pop Progression">Pop Progression</button>'));
  assert.ok(html.includes('class="chip is-on" aria-pressed="true" data-action="toggle-group" data-group="Pop">Pop</button>'));
});

test('renderOptions shows unselected progressions and groups as not pressed', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), selection: [], collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  assert.ok(html.includes('class="chip" aria-pressed="false" data-action="toggle-progression" data-id="Pop / Pop Progression">Pop Progression</button>'));
  assert.ok(html.includes('class="chip" aria-pressed="false" data-action="toggle-group" data-group="Pop">Pop</button>'));
});

test('the sliders sit in their own sections: rotation and permutation in Progression variations, the amount slider above the chord variation chips, and the bass amount alone in Bass variations', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [] }, LIBRARY);
  const sections = html.match(/<section class="option[\s\S]*?<\/section>/g);
  assert.equal(sections.length, 5);
  const [, , progressionVariations, variations, bass] = sections;
  assert.deepEqual(progressionVariations.match(/data-option="\w+"/g), ['data-option="rotation"', 'data-option="permutation"']);
  assert.deepEqual(variations.match(/data-option="\w+"/g), ['data-option="variationProbability"']);
  assert.ok(variations.indexOf('data-option="variationProbability"') < variations.indexOf('data-action="toggle-variation"'));
  assert.deepEqual(bass.match(/data-option="\w+"/g), ['data-option="bassProbability"']);
  assert.ok(!html.includes('Probabilities'));
});

test('renderOptions keeps the probability sliders, each with the fill set to its value', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  // The fill follows the value on the scale from 0 to 5: 2 of 5 is 40%.
  assert.ok(html.includes(`data-option="rotation" style="--fill: ${(state.rotation / 5) * 100}%"`));
  assert.ok(html.includes('min="0" max="5" step="1"'));
  assert.ok(html.includes('data-option="rotation"'));
  assert.ok(html.includes('data-option="bassProbability"'));
  assert.ok(!html.includes('inversionProbability'));
  assert.ok(!html.includes('set-view'));
});

test('renderOptions has no key chips, keys are chosen on the circle only', () => {
  const html = renderOptions(defaultState(LIBRARY, () => 0.5), LIBRARY);
  // The only key buttons are the circle's own elements, rendered inside the Keys section.
  assert.ok(html.includes('<svg class="circle"'));
  assert.ok(!html.includes('<h2>Key</h2>'));
  assert.ok(!html.includes('class="chip" aria-pressed="false" data-action="toggle-key"'));
});

test('renderOptions puts the circle of fifths under the Keys section, which is expanded by default', () => {
  const html = renderOptions(defaultState(LIBRARY, () => 0.5), LIBRARY);
  assert.ok(!defaultState(LIBRARY, () => 0.5).collapsed.includes('keys'));
  const keys = /<section class="option">[\s\S]*?<\/section>/.exec(html)[0];
  assert.ok(keys.includes('<span class="section-title">Keys</span>'));
  assert.ok(keys.includes('<svg class="circle"'));
  assert.ok(html.includes('aria-expanded="true"'));
});

test('renderOptions lists the options sections in order', () => {
  const html = renderOptions(defaultState(LIBRARY, () => 0.5), LIBRARY);
  const titles = ['Keys', 'Progressions', 'Progression variations', 'Chord variations', 'Bass variations'];
  const positions = titles.map((title) => html.indexOf(`<span class="section-title">${title}</span>`));
  assert.ok(positions.every((position) => position >= 0), positions.join());
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  // One heading "Variations" stands above the three variation sections.
  const heading = html.indexOf('<h2 class="options-heading">Variations</h2>');
  assert.ok(heading > 0);
  assert.ok(heading < html.indexOf('<span class="section-title">Progression variations</span>'));
  assert.equal(html.split('class="options-heading"').length - 1, 1);
});

test('a collapsed section shows only a muted summary of what is selected', () => {
  const state = {
    ...defaultState(LIBRARY, () => 0.5),
    keys: ['G'],
    count: 8,
    collapsed: ['keys', 'progressionVariations', 'variations', 'bass'],
  };
  const html = renderOptions(state, LIBRARY);
  assert.ok(html.includes('<span class="section-summary">G (Em)</span>'));
  assert.ok(html.includes('<span class="section-summary"><span class="summary-label">Rotations</span>: <span class="summary-value">2</span><br><span class="summary-label">Permutations</span>: <span class="summary-value">2</span></span>'));
  assert.ok(html.includes('<span class="section-summary"><span class="summary-label">Amount</span>: <span class="summary-value">2</span></span>'));
  assert.ok(!html.includes('circle'));
  assert.ok(!html.includes('data-action="set-count"'));
  assert.ok(html.includes('class="option is-collapsed"'));
  assert.ok(html.includes('aria-expanded="false"'));
});

test('the progression summary lists each category on its own line as Category: Name, with names separated by a middle dot', () => {
  const library = buildLibrary({
    Pop: { progressions: { 'Pop A': ['I', 'V'], 'Pop B': ['I', 'IV'] } },
    Jazz: { progressions: { 'Jazz A': ['ii', 'V'], 'Jazz B': ['ii', 'V', 'I'] } },
  });
  // Jazz B is not selected, so the summary lists the categories instead of saying all.
  const state = { ...defaultState(library, () => 0.5), selection: [library[0].id, library[1].id, library[2].id], collapsed: ['progressions'] };
  const html = renderOptions(state, library);
  assert.ok(html.includes('<span class="section-summary"><span class="summary-label">Pop</span>: Pop A · Pop B<br><span class="summary-label">Jazz</span>: Jazz A</span>'));
});

test('the variation summary says all when all are selected', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: ['variations'] };
  // The amount comes first, then the list, which starts with the blue "Variations:" label.
  assert.ok(renderOptions(state, LIBRARY).includes('<span class="section-summary"><span class="summary-label">Amount</span>: <span class="summary-value">2</span><br><span class="summary-label">Variations</span>: all</span>'));
});

test('the progression summary says all when every progression is selected', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), selection: LIBRARY.map((progression) => progression.id), collapsed: ['progressions'] };
  assert.ok(renderOptions(state, LIBRARY).includes('<span class="section-summary">all</span>'));
});

test('a collapsed section with nothing selected has an empty summary', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), selection: [], collapsed: ['progressions'] };
  const html = renderOptions(state, LIBRARY);
  assert.ok(html.includes('<span class="section-summary"></span>'));
});

test('renderRows separates the progression name from its category with a middle dot', () => {
  const heading = /<h2>[\s\S]*?<\/h2>/.exec(renderRows(ROWS, PLAIN))[0];
  assert.ok(heading.startsWith('<h2><span class="row-title">Pop Progression <span class="meta">· Pop</span></span>'));
});

test('the progressions section wraps its groups in a list that scrolls on its own', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [] }, LIBRARY);
  const list = /<div class="progression-list">([\s\S]*?)<\/div><\/section>/.exec(html)?.[1] ?? '';
  assert.ok(list.includes('<fieldset class="group">'));
});

test('the colour switch alone colours the chords by harmonic function and keeps the plain symbols', () => {
  const html = renderRows(ROWS, { colour: true, roman: false, tones: false });
  assert.ok(html.includes('<li class="chord fn-tonic is-major" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0">C/E</li>'));
  assert.ok(!html.includes('class="roman"'));
  assert.ok(!html.includes('class="tones"'));
});

test('the roman and tones switches alone add the roman numerals and the tones without colours', () => {
  const html = renderRows(ROWS, { colour: false, roman: true, tones: true });
  assert.ok(html.includes('<li class="chord" role="button"'));
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

test('the keys section shows the key signature of the selected key under the circle', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), keys: ['Bb'], collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  assert.ok(html.includes('<p class="key-signature"><span class="tag">B♭</span><span class="tag">E♭</span></p>'));
});

test('a key without accidentals says so, and a single sharp is singular', () => {
  const c = renderOptions({ ...defaultState(LIBRARY, () => 0.5), keys: ['C'], collapsed: [] }, LIBRARY);
  assert.ok(!c.includes('class="key-signature"'));
  const g = renderOptions({ ...defaultState(LIBRARY, () => 0.5), keys: ['G'], collapsed: [] }, LIBRARY);
  assert.ok(g.includes('<p class="key-signature"><span class="tag">F♯</span></p>'));
});

test('a natural B is written h in the tones and in the melody note, but B flat stays bb, and chord symbols keep their names', () => {
  const cmaj7 = { roman: 'I', function: 'tonic', root: 'C', quality: 'major', symbol: 'Cmaj7', displaySymbol: 'Cmaj7', tones: ['C', 'E', 'G', 'B'], inversion: 0, bass: null, variation: 'maj7' };
  const html = renderRows([{ ...ROWS[0], chords: [cmaj7] }], { colour: false, roman: true, tones: true, melody: true });
  assert.ok(html.includes('<span class="melody" title="Top melody note">h</span>'));
  assert.ok(html.includes(tones([tone('c'), tone('e'), tone('g'), tone('h', ' tone-variation')])));
  assert.ok(!html.includes('>b<'));

  const bflat = { roman: 'IV', function: 'subdominant', root: 'Bb', quality: 'major', symbol: 'Bb', displaySymbol: 'Bb', tones: ['Bb', 'D', 'F'], inversion: 0, bass: null, variation: null };
  const flatHtml = renderRows([{ ...ROWS[0], tonic: 'Bb', chords: [bflat] }], { colour: false, roman: true, tones: true, melody: true });
  assert.ok(flatHtml.includes('<span class="chord-name">Bb</span>'));
  assert.ok(flatHtml.includes('<span class="melody" title="Top melody note">f</span>'));
  assert.ok(flatHtml.includes(tones([tone('bb'), tone('d'), tone('f')])));
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

test('the tones line lists the chord tones only, separated by middle dots', () => {
  const html = renderRows(ROWS, EXTENDED);
  assert.ok(html.includes(tones([tone('c'), tone('e'), tone('g')])));
  assert.ok(!html.includes('&nbsp;|&nbsp;'));
});

test('the count button sits beside the Progressions heading, outside the toggle, so it is clickable when collapsed', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), count: 8, collapsed: ['progressions'] };
  const html = renderOptions(state, LIBRARY);
  const header = /<h2 class="section-header[^"]*">[\s\S]*?<\/h2>/.exec(html)?.[0] ?? '';
  assert.ok(header.includes('class="section-toggle"'));
  assert.ok(header.includes('data-action="cycle-count"'));
  assert.ok(header.includes('aria-label="Number of progressions"'));
  assert.ok(header.includes('>8</button>'));
  // A button inside a button is invalid HTML, so the count must come after the toggle has closed.
  assert.ok(header.indexOf('class="section-toggle"') < header.indexOf('count-toggle"'));
  assert.ok(header.indexOf('</button>') < header.indexOf('count-toggle"'));
});

test('the count button is shown in the Progressions section while it is expanded too', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), count: 2, collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  assert.equal(html.split('count-toggle"').length - 1, 1);
  assert.ok(html.includes('>2</button>'));
});

test('only the Progressions and Chord variations headings carry a button; the other sections keep a plain heading', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [] }, LIBRARY);
  assert.equal(html.split('class="section-header').length - 1, 2);
  assert.equal(html.split('<h2><button type="button" class="section-toggle"').length - 1, 3);
});

test('the Progressions heading carries the expanded state, so its arrow can sit after the count button', () => {
  const open = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [] }, LIBRARY);
  const closed = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: ['progressions'] }, LIBRARY);
  assert.ok(open.includes('<h2 class="section-header is-expanded">'));
  assert.ok(closed.includes('<h2 class="section-header">'));
});

test('renderOptions shows the #b switch beside the Chord variations heading, pressed by default, as a chip', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  const button = '<button type="button" class="chip is-on" aria-pressed="true" data-action="toggle-foreign-variations" ' +
    'aria-label="Chord variations with tones foreign to the key" title="Chord variations with tones foreign to the key">#b</button>';
  assert.ok(html.includes(button));
  // It sits in the Chord variations section, after its heading and before the Bass variations section.
  const at = html.indexOf(button);
  assert.ok(html.indexOf('Chord variations') < at);
  assert.ok(at < html.indexOf('Bass variations'));
});

test('renderOptions shows the #b switch as not pressed when foreign variations are off', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), foreignVariations: false, collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  assert.ok(html.includes('class="chip" aria-pressed="false" data-action="toggle-foreign-variations"'));
  assert.ok(!html.includes('is-on" aria-pressed="true" data-action="toggle-foreign-variations'));
});

test('the count button and the #b switch are chips, so they share the look of the other buttons', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [] }, LIBRARY);
  assert.ok(html.includes('<button type="button" class="chip count-toggle" data-action="cycle-count"'));
  assert.ok(html.includes('class="chip is-on" aria-pressed="true" data-action="toggle-foreign-variations"'));
  assert.ok(!html.includes('accidental-toggle'));
  // The count is a number, not a switch, so it never has aria-pressed.
  assert.ok(!/count-toggle"[^>]*aria-pressed/.test(html));
  // It always looks active, so it never carries the is-on class either; the stylesheet fills it.
  assert.ok(!/count-toggle"[^>]*is-on/.test(html));
});
