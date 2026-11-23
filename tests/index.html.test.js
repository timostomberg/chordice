import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LIBRARY } from './helpers/fixtures.js';
import { applyAction } from '../chordice/app/state/actions.js';
import { defaultState, FLAGS } from '../chordice/app/state/state.js';

const APP = new URL('../chordice/app/', import.meta.url);
const STYLES = new URL('../chordice/styles/', import.meta.url);
const read = (path) => readFileSync(new URL(path, APP), 'utf8');
const readIndex = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html loads the stylesheet, the app module and the YAML library from the CDN', () => {
  const html = readIndex();
  assert.ok(html.includes('href="chordice/styles/main.css"'));
  assert.ok(existsSync(fileURLToPath(new URL('main.css', STYLES))));
  assert.ok(html.includes('src="chordice/app/main.js"'));
  assert.ok(html.includes('"js-yaml": "https://cdn.jsdelivr.net/npm/js-yaml@4.3.2/+esm"'));
  assert.ok(html.includes('"tonal": "https://cdn.jsdelivr.net/npm/tonal@6.6.0/+esm"'));
  assert.ok(html.includes('"vexflow": "https://cdn.jsdelivr.net/npm/vexflow@5.0.0/+esm"'));
});

test('index.html has the notes window with the parts that notes.js fills in', () => {
  const html = readIndex();
  for (const id of ['notes', 'notes-staff']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok(html.includes('<dialog id="notes"'));
  assert.ok(!html.includes('notes-close'), 'the notes window has no close button');
});

test('every element that app.js looks up exists in index.html', () => {
  const html = readIndex();
  const app = read('app.js');
  const selectors = [...app.matchAll(/querySelector\('([^']+)'\)/g)].map((match) => match[1]);
  assert.ok(selectors.length >= 3);
  for (const selector of selectors) {
    if (selector.startsWith('#')) {
      assert.ok(html.includes(`id="${selector.slice(1)}"`), selector);
    } else if (selector.startsWith('.')) {
      // Classes are either in the markup or rendered by options.js or song/song.js (e.g. the progression list).
      const rendered = read('options/options.js') + read('song/song.js');
      assert.ok(new RegExp(`class="[^"]*\\b${selector.slice(1)}\\b`).test(html + rendered), selector);
    } else {
      const action = /data-action="([^"]+)"/.exec(selector)?.[1];
      assert.ok(html.includes(`data-action="${action}"`), selector);
    }
  }
});

// One sample parameter set per action, in the shape the markup and the render functions pass to applyAction.
const ACTION_PARAMS = {
  'set-key': { key: 'D' },
  'toggle-group': { group: 'Pop' },
  'toggle-progression': { id: 'Pop / Pop Progression' },
  'cycle-count': {},
  'toggle-variation': { variation: '7' },
  'set-probability': { option: 'rotation', value: '3' },
  'toggle-section': { section: 'bass' },
  'toggle-exercise': { exercise: 'circle-ii-v-i' },
  'open-keys': {},
  'toggle-foreign-variations': {},
  'toggle-circle-of-fifths': {},
  'toggle-colour': {},
  'toggle-painting': {},
  'toggle-roman': {},
  'toggle-tones': {},
  'toggle-melody': {},
  'toggle-options': {},
  'toggle-exercises': {},
  'toggle-help': {},
  'toggle-panel': {},
  'toggle-theme': {},
  'set-instrument': { instrument: 'guitar' },
  'reroll': {},
};

test('every action of the page and of the rendered markup changes the state when applyAction runs it', () => {
  const actions = new Set([
    ...[...readIndex().matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]),
    ...[...read('options/options.js').matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]),
    ...[...read('song/song.js').matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]),
    ...[...read('options/circle-of-fifths.js').matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]),
  ]);
  // show-notes is handled by app.js, which opens the notes window instead of changing the state.
  actions.delete('show-notes');
  assert.ok(actions.size > 0);
  const library = LIBRARY;
  const state = defaultState(library);
  for (const action of actions) {
    assert.ok(Object.hasOwn(ACTION_PARAMS, action), `${action} has sample parameters in this test`);
    assert.notEqual(applyAction(state, action, ACTION_PARAMS[action], library), state, `${action} changes the state`);
  }
});

test('the toolbar starts with Options and the title, then the roman, tones, colour and theme buttons', () => {
  const html = readIndex();
  const toolbar = /<header class="toolbar"[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';
  const order = ['data-action="toggle-options"', '<h1>', 'data-action="toggle-roman"', 'data-action="toggle-tones"', 'data-action="toggle-colour"', 'data-action="toggle-painting"', 'data-action="toggle-theme"'];
  const positions = order.map((marker) => toolbar.indexOf(marker));
  assert.ok(positions.every((position) => position >= 0), positions.join());
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('Options is an icon-only button with the three-line symbol and an accessible name', () => {
  const html = readIndex();
  assert.ok(html.includes('class="options-toggle panel-tab" data-action="toggle-options" aria-controls="options" aria-label="Options"'));
  assert.ok(html.includes('<path d="M4 6h16M4 12h11M4 18h7"'));
});

test('the colour button shows a spiral of dots, not the options symbol', () => {
  const html = readIndex();
  const colour = /<button[^>]*class="colour-toggle"[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';
  assert.equal(colour.split('<circle').length - 1, 7);
  assert.ok(!colour.includes('<path'));
});

test('the roman and tones buttons sit left of the colour button, in one group', () => {
  const html = readIndex();
  const group = /<div class="view-toggles">[\s\S]*?<\/div>/.exec(html)?.[0] ?? '';
  assert.ok(group.indexOf('toggle-roman') < group.indexOf('toggle-tones'));
  assert.ok(group.indexOf('toggle-tones') < group.indexOf('toggle-colour'));
  assert.ok(!group.includes('toggle-theme'));
});

test('Generate is a floating button after the main content, so it sits at the bottom right', () => {
  const html = readIndex();
  const generate = html.indexOf('class="generate" data-action="reroll">Generate</button>');
  assert.ok(generate > html.indexOf('</main>'));
  assert.ok(generate < html.indexOf('</body>'));
  assert.ok(!html.slice(0, html.indexOf('</header>')).includes('Generate'));
});

test('the theme button shows a half-filled circle and is labelled for screen readers', () => {
  const html = readIndex();
  assert.ok(html.includes('<circle cx="12" cy="12" r="9" fill="none"'));
  assert.ok(html.includes('<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'));
  assert.ok(html.includes('aria-label="Dark mode"'));
});

test('the colour, roman and tones buttons are symbol buttons that show their switches as pressed', () => {
  const html = readIndex();
  assert.ok(html.includes('class="colour-toggle" data-action="toggle-colour" aria-label="Colours" aria-pressed="true"'));
  assert.ok(html.includes('class="roman-toggle" data-action="toggle-roman" aria-label="Roman numerals" aria-pressed="true"'));
  assert.ok(html.includes('class="tones-toggle" data-action="toggle-tones" aria-label="Chord tones" aria-pressed="false"'));
  assert.equal(html.split('data-action="toggle-colour"').length - 1, 1);
  assert.equal(html.split('data-action="toggle-roman"').length - 1, 1);
  assert.equal(html.split('data-action="toggle-tones"').length - 1, 1);
  assert.ok(!html.includes('toggle-details'));
});

test('the roman button shows the IV symbol, the tones button three stacked noteheads on one stem, neither in a circle', () => {
  const html = readIndex();
  const roman = /<button[^>]*class="roman-toggle"[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';
  const tones = /<button[^>]*class="tones-toggle"[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';
  assert.ok(roman.includes('font-size="14"') && roman.includes('>IV</text>'));
  assert.ok(!roman.includes('<circle'));
  assert.equal(tones.split('<ellipse').length - 1, 3);
  assert.ok(tones.includes('<path d="M10.2 18V1"'));
  assert.ok(tones.includes('<g transform="translate(3.8 0)">'));
  assert.ok(!tones.includes('<circle'));
  assert.ok(!tones.includes('<text'));
});

test('a click on the header, e.g. the title, opens or closes the side panel, which keeps its panel', () => {
  const html = readIndex();
  assert.ok(html.includes('<header class="toolbar" data-action="toggle-panel">'));
});

test('the exercises and help buttons sit directly right of the options button, the three one switch like the instrument tabs', () => {
  const html = readIndex();
  const toolbar = /<header class="toolbar"[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';
  const tabs = /<div class="panel-tabs"[\s\S]*?<\/div>/.exec(toolbar)?.[0] ?? '';
  assert.ok(toolbar.startsWith('<header class="toolbar" data-action="toggle-panel">\n    <!--'), 'the panel tabs come first');
  assert.ok(toolbar.indexOf('class="panel-tabs"') < toolbar.indexOf('class="instrument-tabs"'));
  const buttons = [...tabs.matchAll(/<button[^>]*data-action="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(buttons, ['toggle-options', 'toggle-exercises', 'toggle-help']);
  assert.ok(tabs.includes('class="exercises-toggle panel-tab" data-action="toggle-exercises" aria-controls="options" aria-label="Exercises" title="Exercises"'));
  const exercises = /<button[^>]*toggle-exercises[\s\S]*?<\/button>/.exec(tabs)?.[0] ?? '';
  assert.ok(exercises.includes('<svg') && !exercises.includes('<text'), 'the button is a symbol, not a word');
  // The help button shows a circled i: a ring, the stem and the dot.
  assert.ok(tabs.includes('class="help-toggle panel-tab" data-action="toggle-help" aria-controls="options" aria-label="Help" title="Help"'));
  const help = /<button[^>]*toggle-help[\s\S]*?<\/button>/.exec(tabs)?.[0] ?? '';
  assert.equal(help.split('<circle').length - 1, 2);
  assert.ok(help.includes('fill="none"') && help.includes('<path d="M12 11v6"'));
  assert.ok(!help.includes('<text'), 'the i is drawn, not a letter');
});

test('the instrument tabs sit right of the options button, before the title: piano on the left, guitar on the right', () => {
  const html = readIndex();
  const toolbar = /<header class="toolbar"[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';
  const tabs = /<div class="instrument-tabs"[\s\S]*?<\/div>\s*<h1>/.exec(toolbar)?.[0] ?? '';
  assert.ok(tabs.length > 0, 'the tabs are between the options button and the title');
  assert.ok(toolbar.indexOf('toggle-options') < toolbar.indexOf('instrument-tabs'));
  assert.ok(tabs.indexOf('data-instrument="piano"') < tabs.indexOf('data-instrument="guitar"'));
  // Both tabs switch the instrument, and the piano starts pressed, as the default instrument is the piano.
  assert.equal(tabs.split('data-action="set-instrument"').length - 1, 2);
  assert.ok(tabs.includes('class="instrument-tab" data-action="set-instrument" data-instrument="piano" aria-pressed="true"'));
  assert.ok(tabs.includes('class="instrument-tab" data-action="set-instrument" data-instrument="guitar" aria-pressed="false"'));
  // Each tab shows its instrument as a symbol: a keyboard with black keys, and a guitar.
  const piano = /<button[^>]*data-instrument="piano"[\s\S]*?<\/button>/.exec(tabs)?.[0] ?? '';
  const guitar = /<button[^>]*data-instrument="guitar"[\s\S]*?<\/button>/.exec(tabs)?.[0] ?? '';
  assert.ok(piano.split('<rect').length - 1 >= 6, 'the keyboard has its frame and black keys');
  assert.ok(guitar.includes('<path') && guitar.includes('<rect'), 'the guitar has its body and neck');
  assert.ok(!piano.includes('<text') && !guitar.includes('<text'), 'the tabs are symbols, not words');
});

test('the notes window has a caption under the score, which names the guitar shape', () => {
  const html = readIndex();
  assert.ok(html.includes('<p id="notes-caption" class="notes-caption"'));
  const notes = /<dialog id="notes"[\s\S]*?<\/dialog>/.exec(html)?.[0] ?? '';
  assert.ok(notes.indexOf('id="notes-staff"') < notes.indexOf('id="notes-caption"'));
});

test('the import map loads svguitar for the guitar diagrams', () => {
  const html = readIndex();
  assert.ok(html.includes('"svguitar": "https://cdn.jsdelivr.net/npm/svguitar@2.11.0/+esm"'));
});

test('the CDN versions in the import map match the packages in package.json', () => {
  const html = readIndex();
  const importMap = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
  // The browser loads the packages from the CDN, so they are listed as dev dependencies: the tests resolve them from node_modules.
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const versions = { ...manifest.dependencies, ...manifest.devDependencies };
  const names = Object.keys(importMap);
  assert.ok(names.length > 0);
  for (const name of names) {
    assert.ok(versions[name], `${name} is in package.json`);
    assert.ok(importMap[name].includes(`${name}@${versions[name]}/`), `${name} is ${versions[name]} in the import map`);
  }
});

test('every data-flag in the page names a switch of the state, so app.js can set its pressed state from it', () => {
  const html = readIndex();
  const flags = [...html.matchAll(/data-flag="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(flags.length >= 3);
  for (const flag of flags) {
    assert.ok(FLAGS.includes(flag), flag);
  }
});

// The app is served from index.html itself (GitHub Pages cannot rewrite URLs), so the address in the browser
// does not change. The page must not redirect anywhere, and the files it loads must exist.

const ROOT = new URL('../', import.meta.url);

test('index.html at the root is the app itself, without a redirect', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  assert.ok(!/http-equiv="refresh"/i.test(html), 'no meta refresh');
});

test('index.html loads its base stylesheet from chordice/styles/ and its app module from chordice/app/, and they exist', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  const css = /<link rel="stylesheet" href="([^"]+)"/.exec(html)?.[1];
  const script = /<script type="module" src="([^"]+)"/.exec(html)?.[1];
  assert.equal(css, 'chordice/styles/main.css');
  assert.equal(script, 'chordice/app/main.js');
  assert.ok(existsSync(fileURLToPath(new URL(css, ROOT))));
  assert.ok(existsSync(fileURLToPath(new URL(script, ROOT))));
});

test('the painting switch with its mountains sits left of the dark mode switch, a flag that is on by default', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const button = /<button[^>]*data-action="toggle-painting"[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(button.includes('class="painting-toggle"'));
  assert.ok(button.includes('data-flag="painting"'));
  assert.ok(button.includes('aria-pressed="true"'));
  assert.ok(button.includes('aria-label="Painting"'));
  const theme = html.indexOf('data-action="toggle-theme"');
  assert.ok(html.indexOf('data-action="toggle-painting"') < theme);
  // No other button stands between them: the only button opened in between is the theme button itself.
  assert.equal(html.slice(html.indexOf('data-action="toggle-painting"'), theme).split('<button').length - 1, 1);
});
