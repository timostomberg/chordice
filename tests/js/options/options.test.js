import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOptions } from '../../../chordice/js/options/options.js';
import { buildLibrary } from '../../../chordice/js/data/validate.js';
import { defaultState } from '../../../chordice/js/core/state.js';

const LIBRARY = buildLibrary({
  Pop: { progressions: { 'Pop Progression': ['I', 'V'] } },
});

const PLAIN = { colour: false, roman: false, tones: false };

/** A tone below a chord, as renderRows writes it; kind is '' or the class of a circled tone. */
const tone = (name, kind = '') => `<span class="tone${kind}">${name}</span>`;
/** The tones line of a chord: the chord tones of its inversion, without the bass. */
const tones = (upper) => `<span class="tones">${upper.join(' · ')}</span>`;

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
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [], inversions: true }, LIBRARY);
  const sections = html.match(/<section class="option[\s\S]*?<\/section>/g);
  assert.equal(sections.length, 6);
  const [, , progressionVariations, variations, bass, melody] = sections;
  assert.deepEqual(progressionVariations.match(/data-option="\w+"/g), ['data-option="rotation"', 'data-option="permutation"']);
  assert.deepEqual(variations.match(/data-option="\w+"/g), ['data-option="variationProbability"']);
  assert.ok(variations.indexOf('data-option="variationProbability"') < variations.indexOf('data-action="toggle-variation"'));
  assert.deepEqual(bass.match(/data-option="\w+"/g), ['data-option="bassProbability"']);
  assert.deepEqual(melody.match(/data-option="\w+"/g), ['data-option="melodyAmount"']);
  assert.ok(melody.includes('Melody variations'));
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

test('the progressions section wraps its groups in a list that scrolls on its own', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [] }, LIBRARY);
  const list = /<div class="progression-list">([\s\S]*?)<\/div><\/section>/.exec(html)?.[1] ?? '';
  assert.ok(list.includes('<fieldset class="group">'));
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

test('only the Progressions, Chord variations and Melody variations headings carry a button; the other sections keep a plain heading', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [] }, LIBRARY);
  assert.equal(html.split('class="section-header').length - 1, 3);
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

test('the bass variations are greyed out and cannot be opened while the guitar is chosen, and their amount shows 0', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: [], instrument: 'guitar', bassProbability: 4 };
  const html = renderOptions(state, LIBRARY);
  const bass = html.match(/<section class="option[^"]*is-unavailable[\s\S]*?<\/section>/)[0];
  assert.ok(bass.includes('Bass variations'));
  assert.ok(/<button[^>]*class="section-toggle"[^>]*\sdisabled/.test(bass));
  assert.ok(bass.includes('aria-expanded="false"'));
  assert.ok(!bass.includes('data-option="bassProbability"'), 'the amount is not drawn while the section cannot be opened');
  assert.ok(bass.includes('<span class="summary-label">Amount</span>: <span class="summary-value">0</span>'));
});

test('the bass amount is enabled on the piano, and no section is greyed out', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [], bassProbability: 4, inversions: true }, LIBRARY);
  assert.ok(!html.includes('is-unavailable'));
  assert.ok(!/<button[^>]*disabled/.test(html));
  assert.ok(/data-option="bassProbability"/.test(html));
  assert.ok(!/data-option="bassProbability"[^>]*\sdisabled/.test(html));
});

test('the melody variations section is titled, has the Amount slider from 0 to 5, and is greyed out on the guitar', () => {
  const piano = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [], melodyAmount: 3, inversions: true }, LIBRARY);
  assert.ok(piano.includes('Melody variations'));
  assert.ok(piano.includes('value="3" data-option="melodyAmount"'), 'the slider shows the stored amount');
  assert.ok(!/data-option="melodyAmount"[^>]*\sdisabled/.test(piano));
  const guitar = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [], instrument: 'guitar', melodyAmount: 3 }, LIBRARY);
  const section = guitar.split('<section').find((part) => part.includes('Melody variations'));
  assert.ok(section.includes('is-unavailable'), 'the melody section is greyed out');
  assert.ok(!section.includes('data-option="melodyAmount"'), 'the amount is not drawn while the section cannot be opened');
  assert.ok(section.includes('Amount</span>: <span class="summary-value">0</span>'), 'its amount shows 0 while the guitar is chosen');
});

test('with the melody button off the melody variations section is greyed out, and its amount shows 0', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [], inversions: false, melodyAmount: 4 }, LIBRARY);
  const section = html.split('<section').find((part) => part.includes('Melody variations'));
  assert.ok(section.includes('is-unavailable'), 'the melody section is greyed out');
  assert.ok(!section.includes('data-option="melodyAmount"'), 'the amount is not drawn while the section cannot be opened');
  assert.ok(section.includes('Amount</span>: <span class="summary-value">0</span>'), 'its amount shows 0');
  const on = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [], inversions: true, melodyAmount: 4 }, LIBRARY);
  const enabled = on.split('<section').find((part) => part.includes('Melody variations'));
  assert.ok(!enabled.includes('is-unavailable'));
  assert.ok(enabled.includes('value="4" data-option="melodyAmount"'));
});

test('the melody button sits beside the Melody variations heading, pressed with the inversions, and is greyed out on the guitar', () => {
  const piano = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [], inversions: true }, LIBRARY);
  const header = piano.split('<section').find((part) => part.includes('Melody variations'));
  assert.ok(header.includes('class="chip melody-toggle is-on" aria-pressed="true" data-action="toggle-melody" data-flag="inversions"'));
  assert.ok(header.includes('<svg'), 'the button shows the note symbol');
  assert.ok(!header.includes('>Melody<'), 'the button shows no text');
  assert.ok(!header.includes('disabled'));
  const guitar = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [], instrument: 'guitar' }, LIBRARY);
  const greyed = guitar.split('<section').find((part) => part.includes('Melody variations'));
  assert.ok(/data-flag="inversions"[^>]*\sdisabled/.test(greyed), 'the melody button is disabled on the guitar');
});
