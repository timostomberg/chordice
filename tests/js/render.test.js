import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOptions, renderRows } from '../../chordice/js/render.js';
import { buildLibrary } from '../../chordice/js/generator.js';
import { defaultState } from '../../chordice/js/state.js';

const LIBRARY = buildLibrary([
  { group: 'Pop', progressions: [{ name: 'Pop Progression', progression: ['I', 'V'] }] },
]);

const ROWS = [{
  index: 0,
  name: 'Pop Progression',
  group: 'Pop',
  tonic: 'C',
  permuted: false,
  rotated: true,
  chords: [
    { roman: 'I', function: 'tonic', quality: 'major', symbol: 'C', displaySymbol: 'C/E', tones: ['C', 'E', 'G'], bass: 'E', extension: null },
    { roman: 'V', function: 'dominant', quality: 'major', symbol: 'G7', displaySymbol: 'G7', tones: ['G', 'B', 'D', 'F'], bass: null, extension: '7' },
  ],
}];

const PLAIN = { colour: false, details: false };
const EXTENDED = { colour: true, details: true };

test('renderRows names each row after its progression', () => {
  const html = renderRows(ROWS, PLAIN);
  assert.ok(html.includes('<h2><span class="row-title">Pop Progression'));
  assert.ok(html.includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0">C/E</li>'));
  assert.ok(html.includes('<li class="chord" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="1">G7</li>'));
});

test('renderRows in extended view shows the roman numeral above the chord symbol, then the tones in lower case', () => {
  const html = renderRows(ROWS, EXTENDED);
  assert.ok(html.includes('chord fn-tonic is-major'));
  assert.ok(html.includes('<span class="roman">I</span><span class="symbol"><span class="chord-name">C</span><span class="bass">/E</span></span><span class="tones">c · e · g / e</span>'));
  assert.ok(html.includes('<span class="roman">V</span><span class="symbol"><span class="chord-name">G</span><span class="extension">7</span></span><span class="tones">g · b · d · f</span>'));
});

test('renderRows in extended view wraps only the chord name in its own span, the extension follows it unbolded', () => {
  const minor = { ...ROWS[0], chords: [{ ...ROWS[0].chords[0], symbol: 'F#m7', extension: '7', quality: 'minor', roman: 'vi', bass: null }] };
  const html = renderRows([minor], EXTENDED);
  assert.ok(html.includes('<span class="symbol"><span class="chord-name">F#m</span><span class="extension">7</span></span>'));
});

test('renderRows in extended view shows the bass after the extension, e.g. G7/B, and no bass when there is none', () => {
  const withBass = { ...ROWS[0], chords: [{ ...ROWS[0].chords[0], symbol: 'G7', extension: '7', bass: 'B', roman: 'V' }] };
  const html = renderRows([withBass], EXTENDED);
  assert.ok(html.includes('<span class="symbol"><span class="chord-name">G</span><span class="extension">7</span><span class="bass">/B</span></span>'));
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

test('renderRows shows a hint when nothing is selected', () => {
  assert.ok(renderRows([], PLAIN).includes('Select at least one'));
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

test('renderOptions keeps the probability sliders, each with the fill set to its value', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  assert.ok(html.includes(`data-option="rotation" style="--fill: ${state.rotation}%"`));
  assert.ok(html.includes('data-option="rotation"'));
  assert.ok(html.includes('data-option="bassProbability"'));
  assert.ok(html.includes('data-option="bassProbability"'));
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
  const titles = ['Keys', 'Progressions', 'Number of progressions', 'Chord extensions', 'Probabilities'];
  const positions = titles.map((title) => html.indexOf(`<span class="section-title">${title}</span>`));
  assert.ok(positions.every((position) => position >= 0), positions.join());
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('a collapsed section shows only a muted summary of what is selected', () => {
  const state = {
    ...defaultState(LIBRARY, () => 0.5),
    keys: ['G'],
    count: 8,
    collapsed: ['keys', 'count', 'probabilities'],
  };
  const html = renderOptions(state, LIBRARY);
  assert.ok(html.includes('<span class="section-summary">G (Em)</span>'));
  assert.ok(html.includes('<span class="section-summary"><span class="tag is-on">8</span></span>'));
  assert.ok(html.includes('<span class="section-summary"><span class="summary-label">Rotation</span>: <span class="summary-value">50%</span><br><span class="summary-label">Permutation</span>: <span class="summary-value">50%</span><br><span class="summary-label">Chord extensions</span>: <span class="summary-value">50%</span><br><span class="summary-label">Bass notes</span>: <span class="summary-value">50%</span></span>'));
  assert.ok(!html.includes('circle'));
  assert.ok(!html.includes('data-action="set-count"'));
  assert.ok(html.includes('class="option is-collapsed"'));
  assert.ok(html.includes('aria-expanded="false"'));
});

test('the progression summary lists each category on its own line as Category: Name, with names separated by a middle dot', () => {
  const library = buildLibrary([
    { group: 'Pop', progressions: [{ name: 'Pop A', progression: ['I', 'V'] }, { name: 'Pop B', progression: ['I', 'IV'] }] },
    { group: 'Jazz', progressions: [{ name: 'Jazz A', progression: ['ii', 'V'] }, { name: 'Jazz B', progression: ['ii', 'V', 'I'] }] },
  ]);
  // Jazz B is not selected, so the summary lists the categories instead of saying all.
  const state = { ...defaultState(library, () => 0.5), selection: [library[0].id, library[1].id, library[2].id], collapsed: ['progressions'] };
  const html = renderOptions(state, library);
  assert.ok(html.includes('<span class="section-summary"><span class="summary-label">Pop</span>: Pop A · Pop B<br><span class="summary-label">Jazz</span>: Jazz A</span>'));
});

test('the extension summary says all when all are selected', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: ['extensions'] };
  assert.ok(renderOptions(state, LIBRARY).includes('<span class="section-summary">all</span>'));
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
  const html = renderRows(ROWS, { colour: true, details: false });
  assert.ok(html.includes('<li class="chord fn-tonic is-major" role="button" tabindex="0" data-action="show-notes" data-row="0" data-chord="0">C/E</li>'));
  assert.ok(!html.includes('class="roman"'));
  assert.ok(!html.includes('class="tones"'));
});

test('the details switch alone adds roman numerals and tones without colours', () => {
  const html = renderRows(ROWS, { colour: false, details: true });
  assert.ok(html.includes('<li class="chord" role="button"'));
  assert.ok(!html.includes('fn-'));
  assert.ok(html.includes('<span class="roman">I</span>'));
  assert.ok(html.includes('<span class="tones">c · e · g / e</span>'));
});
