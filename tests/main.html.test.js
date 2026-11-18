import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { buildLibrary } from '../chordice/js/data/validate.js';
import { applyAction, defaultState, FLAGS } from '../chordice/js/core/state.js';

const SITE = new URL('../chordice/', import.meta.url);
const read = (path) => readFileSync(new URL(path, SITE), 'utf8');

test('main.html loads the stylesheet, the app module and the YAML library from the CDN', () => {
  const html = read('main.html');
  assert.ok(html.includes('href="main.css"'));
  assert.ok(existsSync(fileURLToPath(new URL('main.css', SITE))));
  assert.ok(html.includes('src="js/main.js"'));
  assert.ok(html.includes('"js-yaml": "https://cdn.jsdelivr.net/npm/js-yaml@4.3.2/+esm"'));
  assert.ok(html.includes('"tonal": "https://cdn.jsdelivr.net/npm/tonal@6.6.0/+esm"'));
  assert.ok(html.includes('"vexflow": "https://cdn.jsdelivr.net/npm/vexflow@5.0.0/+esm"'));
});

test('main.html has the notes window with the parts that notes.js fills in', () => {
  const html = read('main.html');
  for (const id of ['notes', 'notes-staff']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok(html.includes('<dialog id="notes"'));
  assert.ok(!html.includes('notes-close'), 'the notes window has no close button');
});

test('every element that app.js looks up exists in main.html', () => {
  const html = read('main.html');
  const app = read('js/core/app.js');
  const selectors = [...app.matchAll(/querySelector\('([^']+)'\)/g)].map((match) => match[1]);
  assert.ok(selectors.length >= 3);
  for (const selector of selectors) {
    if (selector.startsWith('#')) {
      assert.ok(html.includes(`id="${selector.slice(1)}"`), selector);
    } else if (selector.startsWith('.')) {
      // Classes are either in the markup or rendered by options.js or progressions.js (e.g. the progression list).
      const rendered = read('js/options/options.js') + read('js/progressions/progressions.js');
      assert.ok(new RegExp(`class="[^"]*\\b${selector.slice(1)}\\b`).test(html + rendered), selector);
    } else {
      const action = /data-action="([^"]+)"/.exec(selector)?.[1];
      assert.ok(html.includes(`data-action="${action}"`), selector);
    }
  }
});

// One sample parameter set per action, in the shape the markup and the render functions pass to applyAction.
const ACTION_PARAMS = {
  'toggle-key': { key: 'D' },
  'toggle-group': { group: 'Pop' },
  'toggle-progression': { id: 'Pop / Pop Progression' },
  'cycle-count': {},
  'toggle-variation': { variation: '7' },
  'set-probability': { option: 'rotation', value: '3' },
  'toggle-section': { section: 'bass' },
  'open-keys': {},
  'toggle-foreign-variations': {},
  'toggle-colour': {},
  'toggle-roman': {},
  'toggle-tones': {},
  'toggle-inversions': {},
  'toggle-options': {},
  'toggle-theme': {},
  'set-instrument': { instrument: 'guitar' },
  'reroll': {},
};

test('every action of the page and of the rendered markup changes the state when applyAction runs it', () => {
  const actions = new Set([
    ...[...read('main.html').matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]),
    ...[...read('js/options/options.js').matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]),
    ...[...read('js/progressions/progressions.js').matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]),
    ...[...read('js/options/circle-of-fifths.js').matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]),
  ]);
  // show-notes is handled by app.js, which opens the notes window instead of changing the state.
  actions.delete('show-notes');
  assert.ok(actions.size > 0);
  const library = buildLibrary(load(readFileSync(new URL('../chordice/data/chord_progressions.yaml', import.meta.url), 'utf8')));
  const state = defaultState(library);
  for (const action of actions) {
    assert.ok(Object.hasOwn(ACTION_PARAMS, action), `${action} has sample parameters in this test`);
    assert.notEqual(applyAction(state, action, ACTION_PARAMS[action], library), state, `${action} changes the state`);
  }
});

test('the options panel no longer has its own circle markup; the circle is rendered in the Keys section', () => {
  const html = read('main.html');
  assert.ok(!html.includes('id="circle"'));
  assert.ok(!html.includes('toggle-circle'));
  assert.ok(html.includes('<div id="option-list"></div>'));
});

test('the toolbar starts with Options and the title, then the roman, tones, colour and theme buttons', () => {
  const html = read('main.html');
  const toolbar = /<header class="toolbar"[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';
  const order = ['data-action="toggle-options"', '<h1>', 'data-action="toggle-roman"', 'data-action="toggle-tones"', 'data-action="toggle-colour"', 'data-action="toggle-theme"'];
  const positions = order.map((marker) => toolbar.indexOf(marker));
  assert.ok(positions.every((position) => position >= 0), positions.join());
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.ok(!html.includes('New progressions'));
});

test('Options is an icon-only button with the three-line symbol and an accessible name', () => {
  const html = read('main.html');
  assert.ok(html.includes('class="options-toggle" data-action="toggle-options" aria-controls="options" aria-label="Options"'));
  assert.ok(html.includes('<path d="M4 6h16M4 12h11M4 18h7"'));
});

test('the colour button shows a spiral of dots, not the options symbol', () => {
  const html = read('main.html');
  const colour = /<button[^>]*class="colour-toggle"[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';
  assert.equal(colour.split('<circle').length - 1, 7);
  assert.ok(!colour.includes('<path'));
});

test('the roman and tones buttons sit left of the colour button, in one group', () => {
  const html = read('main.html');
  const group = /<div class="view-toggles">[\s\S]*?<\/div>/.exec(html)?.[0] ?? '';
  assert.ok(group.indexOf('toggle-roman') < group.indexOf('toggle-tones'));
  assert.ok(group.indexOf('toggle-tones') < group.indexOf('toggle-colour'));
  assert.ok(!group.includes('toggle-theme'));
});

test('the number of progressions is not in the toolbar; it is rendered in the Progressions section of the options panel', () => {
  const html = read('main.html');
  const toolbar = /<header class="toolbar"[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';
  assert.ok(!toolbar.includes('count-toggle'));
  assert.ok(!html.includes('set-count'));
});

test('Generate is a floating button after the main content, so it sits at the bottom right', () => {
  const html = read('main.html');
  const generate = html.indexOf('class="generate" data-action="reroll">Generate</button>');
  assert.ok(generate > html.indexOf('</main>'));
  assert.ok(generate < html.indexOf('</body>'));
  assert.ok(!html.slice(0, html.indexOf('</header>')).includes('Generate'));
});

test('the theme button shows a half-filled circle and is labelled for screen readers', () => {
  const html = read('main.html');
  assert.ok(html.includes('<circle cx="12" cy="12" r="9" fill="none"'));
  assert.ok(html.includes('<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'));
  assert.ok(html.includes('aria-label="Dark mode"'));
});

test('the colour, roman and tones buttons are symbol buttons that show their switches as pressed', () => {
  const html = read('main.html');
  assert.ok(html.includes('class="colour-toggle" data-action="toggle-colour" aria-label="Colours" aria-pressed="true"'));
  assert.ok(html.includes('class="roman-toggle" data-action="toggle-roman" aria-label="Roman numerals" aria-pressed="true"'));
  assert.ok(html.includes('class="tones-toggle" data-action="toggle-tones" aria-label="Chord tones" aria-pressed="true"'));
  assert.equal(html.split('data-action="toggle-colour"').length - 1, 1);
  assert.equal(html.split('data-action="toggle-roman"').length - 1, 1);
  assert.equal(html.split('data-action="toggle-tones"').length - 1, 1);
  assert.ok(!html.includes('toggle-details'));
});

test('the roman button shows the IV symbol, the tones button three stacked noteheads on one stem, neither in a circle', () => {
  const html = read('main.html');
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

test('the inversions button is a symbol button that starts unpressed, and sits in the view switches', () => {
  const html = read('main.html');
  assert.ok(html.includes('class="inversions-toggle" data-action="toggle-inversions" aria-label="Inversions" aria-pressed="false"'));
  assert.equal(html.split('data-action="toggle-inversions"').length - 1, 1);
  const group = /<div class="view-toggles">[\s\S]*?<\/div>/.exec(html)?.[0] ?? '';
  assert.ok(group.includes('toggle-inversions'));
  // Order in the header: roman numerals, chord tones, inversions (melody note), then a gap, then colours.
  assert.ok(group.indexOf('toggle-roman') < group.indexOf('toggle-tones'));
  assert.ok(group.indexOf('toggle-tones') < group.indexOf('toggle-inversions'));
  assert.ok(group.indexOf('toggle-inversions') < group.indexOf('toggle-colour'));
});

test('a gap separates the colour button from the music switches', () => {
  const css = read('main.css');
  assert.match(css, /\.view-toggles \.colour-toggle \{[^}]*margin-left: 0\.6rem/);
});

test('a click on the header, e.g. the title, toggles the options panel, like the options button', () => {
  const html = read('main.html');
  assert.ok(html.includes('<header class="toolbar" data-action="toggle-options">'));
});

test('the instrument tabs sit right of the options button, before the title: piano on the left, guitar on the right', () => {
  const html = read('main.html');
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
  const html = read('main.html');
  assert.ok(html.includes('<p id="notes-caption" class="notes-caption"'));
  const notes = /<dialog id="notes"[\s\S]*?<\/dialog>/.exec(html)?.[0] ?? '';
  assert.ok(notes.indexOf('id="notes-staff"') < notes.indexOf('id="notes-caption"'));
});

test('the import map loads svguitar for the guitar diagrams', () => {
  const html = read('main.html');
  assert.ok(html.includes('"svguitar": "https://cdn.jsdelivr.net/npm/svguitar@2.11.0/+esm"'));
});

// The chord database is not imported as a module: it has no module entry point, so app.js fetches its lib/guitar.json instead.
const FETCHED_DEPENDENCIES = ['@tombatossals/chords-db'];

test('the CDN versions in the import map match the dependencies in package.json', () => {
  const html = read('main.html');
  const importMap = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).dependencies;
  const names = Object.keys(manifest).filter((name) => !FETCHED_DEPENDENCIES.includes(name));
  assert.ok(names.length > 0);
  for (const name of names) {
    assert.ok(importMap[name], `${name} is in the import map`);
    assert.ok(importMap[name].includes(`${name}@${manifest[name]}/`), `${name} is ${manifest[name]} in the import map`);
  }
  assert.deepEqual(Object.keys(importMap).sort(), names.sort());
});

test('the guitar shapes are fetched from the chord database at the version in package.json', () => {
  const app = read('js/core/app.js');
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).dependencies;
  const url = /const GUITAR_URL = '([^']+)'/.exec(app)?.[1] ?? '';
  assert.ok(url.includes(`/@tombatossals/chords-db@${manifest['@tombatossals/chords-db']}/lib/guitar.json`), url);
});

test('every data-flag in the page names a switch of the state, so app.js can set its pressed state from it', () => {
  const html = read('main.html');
  const flags = [...html.matchAll(/data-flag="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(flags.length >= 4);
  for (const flag of flags) {
    assert.ok(FLAGS.includes(flag), flag);
  }
});

test('main.js is the page entry point and starts the app, while app.js has no start-up code of its own', () => {
  const entry = read('js/main.js');
  assert.ok(entry.includes("import { startApp } from './core/app.js';"));
  assert.ok(/^startApp\(\);$/m.test(entry), 'main.js calls startApp');
  const app = read('js/core/app.js');
  assert.ok(app.includes('export function startApp()'));
  assert.ok(!/^(loadData|startApp)\(/m.test(app), 'app.js calls nothing at the top level');
});
