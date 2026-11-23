import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderExercises, renderOptions } from '../../../../chordice/app/options/options.js';
import { buildLibrary } from '../../../../chordice/music/data/validate.js';
import { defaultState, toggleSection } from '../../../../chordice/app/state/state.js';
import { EXERCISES } from '../../../../chordice/app/state/exercises.js';
import { LIBRARY as APP_DATA_LIBRARY } from '../../../helpers/fixtures.js';

const LIBRARY = buildLibrary({
  Pop: { progressions: { 'Pop Progression': ['I', 'V'] } },
});

test('renderOptions shows progressions and groups as pressed chips', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: [] };
  const html = renderOptions(state, LIBRARY);
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
});

test('renderOptions keeps the probability sliders, each with the fill set to its value', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  // The fill follows the value on the scale from 0 to 5: 2 of 5 is 40%.
  assert.ok(html.includes(`data-option="rotation" style="--fill: ${(state.rotation / 5) * 100}%"`));
  assert.ok(html.includes('min="0" max="5" step="1"'));
  assert.ok(html.includes('data-option="rotation"'));
  assert.ok(html.includes('data-option="bassProbability"'));
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
  const titles = ['Keys', 'Progressions', 'Progression variations', 'Chord variations', 'Bass variations', 'Melody variations'];
  const positions = titles.map((title) => html.indexOf(`<span class="section-title">${title}</span>`));
  assert.ok(positions.every((position) => position >= 0), positions.join());
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  // One heading "Variations" stands above the three variation sections.
  const heading = html.indexOf('<h2 class="options-heading">Variations</h2>');
  assert.ok(heading > 0);
  assert.ok(heading < html.indexOf('<span class="section-title">Progression variations</span>'));
  // The exercises have a panel of their own (see renderExercises), so the options panel has no Exercises section.
  assert.ok(!html.includes('Exercises'));
  assert.ok(!html.includes('data-action="toggle-exercise"'));
  assert.equal(html.split('class="options-heading"').length - 1, 1);
});

test('a collapsed section shows only a muted summary of what is selected', () => {
  const state = {
    ...defaultState(LIBRARY, () => 0.5),
    key: 'G',
    count: 8,
    collapsed: ['keys', 'progressionVariations', 'variations', 'bass'],
  };
  const html = renderOptions(state, LIBRARY);
  assert.ok(html.includes('<span class="section-summary">G (E<span class="minor-sign">m</span>)</span>'));
  assert.ok(html.includes('<span class="section-summary"><span class="summary-label">Rotations</span>: <span class="summary-value">2</span><br><span class="summary-label">Permutations</span>: <span class="summary-value">2</span></span>'));
  assert.ok(html.includes('<span class="section-summary"><span class="summary-label">Amount</span>: <span class="summary-value">2</span></span>'));
  // The circle itself is not drawn while Keys is collapsed; only the circle of fifths button beside its heading is.
  assert.ok(!html.includes('<svg class="circle"'));
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

test('the keys section shows the key signature of the selected key under the circle, as tones in lower case', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), key: 'Bb', collapsed: [] };
  const html = renderOptions(state, LIBRARY);
  assert.ok(html.includes('<p class="key-signature"><span class="tag">b<span class="accidental">♭</span></span><span class="tag">e<span class="accidental">♭</span></span></p>'));
});

test('a key without accidentals says so, and a single sharp is singular', () => {
  const c = renderOptions({ ...defaultState(LIBRARY, () => 0.5), key: 'C', collapsed: [] }, LIBRARY);
  assert.ok(!c.includes('class="key-signature"'));
  const g = renderOptions({ ...defaultState(LIBRARY, () => 0.5), key: 'G', collapsed: [] }, LIBRARY);
  assert.ok(g.includes('<p class="key-signature"><span class="tag">f<span class="accidental">♯</span></span></p>'));
});

test('the count button sits beside the Progressions heading, outside the toggle, so it is clickable when collapsed', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), count: 8, collapsed: ['progressions'] };
  const html = renderOptions(state, LIBRARY);
  const header = [...html.matchAll(/<h2 class="section-header[^"]*">[\s\S]*?<\/h2>/g)]
    .map((match) => match[0]).find((part) => part.includes('Progressions')) ?? '';
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

test('only the Keys, Progressions, Chord variations and Melody variations headings carry a button; the other sections keep a plain heading', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), collapsed: [] }, LIBRARY);
  assert.equal(html.split('class="section-header').length - 1, 4);
  assert.equal(html.split('<h2><button type="button" class="section-toggle"').length - 1, 2);
});

test('the circle of fifths button sits beside the Keys heading, not pressed by default, with an arrow and no text', () => {
  const html = renderOptions(defaultState(LIBRARY, () => 0.5), LIBRARY);
  const header = html.split('<section').find((part) => part.includes('>Keys<'));
  assert.ok(header.includes('<button type="button" class="chip circle-toggle" aria-pressed="false" ' +
    'data-action="toggle-circle-of-fifths" data-flag="circleOfFifths"'));
  assert.ok(header.includes('<svg'), 'the button shows the arrow');
  // A button inside a button is invalid HTML, so the switch comes after the toggle has closed.
  assert.ok(header.indexOf('</button>') < header.indexOf('circle-toggle'));
  const on = renderOptions({ ...defaultState(LIBRARY, () => 0.5), circleOfFifths: true }, LIBRARY);
  assert.ok(on.includes('class="chip circle-toggle is-on" aria-pressed="true" data-action="toggle-circle-of-fifths"'));
});

test('with the circle of fifths switch on, the count button shows 12 and is greyed out, and the stored count is kept', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), count: 4, circleOfFifths: true, collapsed: ['keys'] };
  const html = renderOptions(state, LIBRARY);
  assert.ok(/count-toggle"[^>]*\sdisabled>12<\/button>/.test(html));
  assert.ok(html.includes('<span class="section-summary">all</span>'), 'the collapsed Keys summary says every key is used');
  const off = renderOptions({ ...state, circleOfFifths: false }, LIBRARY);
  assert.ok(/count-toggle"[^>]*>4<\/button>/.test(off));
  assert.ok(!/count-toggle"[^>]*disabled/.test(off));
  assert.ok(off.includes('<span class="section-summary">C (A<span class="minor-sign">m</span>)</span>'));
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

test('with the circle of fifths switch on, Keys is greyed out and closed, and the circle button beside it stays clickable', () => {
  // Keys was the open section; it stays stored as open and opens again when the switch is off.
  const state = { ...defaultState(LIBRARY, () => 0.5), key: 'G', circleOfFifths: true };
  const html = renderOptions(state, LIBRARY);
  const keys = html.split('</section>')[0];
  assert.ok(keys.startsWith('<section class="option is-collapsed is-unavailable">'));
  assert.ok(keys.includes('data-section="keys" aria-expanded="false" disabled>'));
  assert.ok(keys.includes('<span class="section-summary">all</span>'));
  assert.ok(!html.includes('<svg class="circle'));
  assert.ok(!html.includes('class="key-signature"'));
  assert.ok(/class="chip circle-toggle is-on" aria-pressed="true"[^>]*title="[^"]*">/.test(keys), 'the circle button is not disabled');
  const off = renderOptions({ ...state, circleOfFifths: false }, LIBRARY);
  assert.ok(off.includes('<svg class="circle"'));
  assert.ok(!off.includes('aria-disabled'));
  assert.ok(off.includes('class="key is-on"'));
  assert.ok(off.includes('class="key-signature"'));
});

// No exercise fixes the inversions yet; one is added for this test only, so the melody button is checked like the
// circle of fifths and #b buttons, which show the value of the exercise that is on.
test('the melody button shows the inversions an exercise fixes, not the stored ones, in its class and its pressed state', () => {
  EXERCISES.push({ id: 'test-melody', name: 'Melody test', settings: { inversions: true } });
  try {
    const state = { ...defaultState(LIBRARY, () => 0.5), inversions: false, exercise: 'test-melody' };
    const button = /<button[^>]*class="chip melody-toggle[^"]*"[^>]*>/.exec(renderOptions(state, LIBRARY))[0];
    assert.ok(button.includes('melody-toggle is-on'), button);
    assert.ok(button.includes('aria-pressed="true"'), button);
    assert.ok(button.includes(' disabled'), 'the fixed switch is greyed out');
  } finally {
    EXERCISES.pop();
  }
});

// The options and the exercises panel with the exercise of the app, which selects a progression of the app's library.
const APP_LIBRARY = APP_DATA_LIBRARY;
const CIRCLE = 'circle-ii-v-i';
/** A state with the stored options set apart from the exercise's values, so that the test sees which one is shown. */
function storedState() {
  return {
    ...defaultState(APP_LIBRARY, () => 0.5),
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

test('while the exercise is on, the options panel shows its values greyed out and the melody variations free', () => {
  const html = renderOptions(withExercise(storedState()), APP_LIBRARY);
  const sections = html.match(/<section class="option[\s\S]*?<\/section>/g);
  const [keys, progressions, progressionVariations, variations, bass, melody] = sections;
  assert.equal(sections.length, 6);
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
});

test('the exercises panel shows the exercise that is on pressed, so it can be switched off', () => {
  const html = renderExercises(withExercise(storedState()));
  assert.ok(html.includes('class="chip is-on" aria-pressed="true" data-action="toggle-exercise" data-exercise="circle-ii-v-i">Circle around ii7-V7-Imaj7</button>'));
});

test('the exercises panel is a box like those of the options: the title Exercises inside it, open by default', () => {
  const html = renderExercises(storedState());
  assert.ok(html.startsWith('<section class="option"><h2><button type="button" class="section-toggle" data-action="toggle-section" data-section="exercises" aria-expanded="true">'));
  assert.ok(html.includes('<span class="section-title">Exercises</span>'));
  assert.ok(!html.includes('options-heading'), 'no heading above the box');
  assert.equal(html.split('<section').length - 1, 1);
});

test('the Exercises box can be closed and opened again; closed, its summary names the exercise that is on', () => {
  const closed = toggleSection(withExercise(storedState()), 'exercises');
  assert.ok(closed.collapsed.includes('exercises'));
  const html = renderExercises(closed);
  assert.ok(html.startsWith('<section class="option is-collapsed">'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes('<span class="section-summary">Circle around ii7-V7-Imaj7</span>'));
  assert.ok(!html.includes('data-action="toggle-exercise"'));
  assert.ok(renderExercises({ ...closed, exercise: null }).includes('<span class="section-title">Exercises</span><span class="section-summary"></span>'));
  const open = toggleSection(closed, 'exercises');
  assert.ok(renderExercises(open).includes('data-action="toggle-exercise"'));
});

test('without an exercise, the exercises panel lists the exercise unpressed and the options panel locks nothing', () => {
  assert.ok(renderExercises(storedState()).includes('class="chip" aria-pressed="false" data-action="toggle-exercise" data-exercise="circle-ii-v-i">Circle around ii7-V7-Imaj7</button>'));
  const html = renderOptions(storedState(), APP_LIBRARY);
  assert.ok(!html.includes('is-unavailable'));
  assert.ok(!html.includes('" disabled>'));
});

test('the exercises panel lists every exercise and has no sliders', () => {
  const html = renderExercises(storedState());
  assert.equal(html.split('data-action="toggle-exercise"').length - 1, EXERCISES.length);
  assert.ok(!html.includes('data-option'));
});

test('the summaries of collapsed sections show the values of the exercise', () => {
  const collapsed = ['keys', 'progressions', 'progressionVariations', 'variations', 'bass', 'melody'];
  const html = renderOptions({ ...withExercise(storedState()), collapsed }, APP_LIBRARY);
  assert.ok(html.includes('<span class="section-summary">all</span>'));
  assert.ok(html.includes('<span class="section-summary"><span class="summary-label">Jazz</span>: Jazz Cadence</span>'));
  assert.ok(html.includes('<span class="summary-label">Rotations</span>: <span class="summary-value">0</span>'));
  assert.ok(html.includes('<span class="summary-label">Amount</span>: <span class="summary-value">5</span><br><span class="summary-label">Variations</span>: 7, maj7'));
});

test('the summary of the collapsed keys section raises the accidentals of the key and its relative minor', () => {
  const html = renderOptions({ ...defaultState(LIBRARY, () => 0.5), key: 'Eb', collapsed: ['keys'] }, LIBRARY);
  const flat = '<span class="accidental">♭</span>';
  assert.ok(html.includes(`E${flat} (C<span class="minor-sign">m</span>)`));
  assert.ok(!html.includes('Eb (Cm)'));
});
