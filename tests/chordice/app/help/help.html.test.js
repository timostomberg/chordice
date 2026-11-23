import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROGRESSIONS_DATA } from '../../../helpers/fixtures.js';

// The help page is a static page in chordice/app/help/; its stylesheet is chordice/styles/help.css. The app shows its main
// part in the side panel when the Help button is pressed (see help.js); the page can still be opened on its own, and it
// links back to the app. The page is in English and covers every part of the app.

const ROOT = new URL('../../../../', import.meta.url);
const SITE = new URL('../../../../chordice/app/help/', import.meta.url);
const readRoot = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const help = () => readFileSync(new URL('help.html', SITE), 'utf8');
const index = () => readRoot('index.html');

test('help.html sits in chordice/app/help/ and is an English document without a redirect', () => {
  assert.ok(existsSync(fileURLToPath(new URL('help.html', SITE))));
  assert.ok(!existsSync(fileURLToPath(new URL('help.html', ROOT))), 'not at the root');
  const html = help();
  assert.match(html, /<html lang="en"/);
  assert.ok(!/http-equiv="refresh"/i.test(html), 'no meta refresh');
});

test('help.html loads the base stylesheet, the header\'s and its own, and they exist', () => {
  const links = [...help().matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual(links, ['../../styles/main.css', '../../styles/header.css', '../../styles/help.css']);
  for (const css of links) {
    assert.ok(existsSync(fileURLToPath(new URL(css, SITE))), css);
  }
});

test('help.html has no module script, so it needs no code of the app', () => {
  assert.ok(!/<script[^>]*type="module"/.test(help()));
  assert.ok(!/<script[^>]*src=/.test(help()));
});

test('the Help button in the toolbar shows the help', () => {
  const html = index();
  assert.ok(html.includes('data-action="toggle-help"'));
  // The app links the help stylesheet, so the help looks the same in the side panel as on its own page.
  assert.ok(html.includes('<link rel="stylesheet" href="chordice/styles/help.css">'));
});

test('the help page links back to the app', () => {
  const html = help();
  assert.ok(html.includes('href="../../../index.html"'));
  assert.ok(existsSync(fileURLToPath(new URL('../../../index.html', SITE))));
});

test('the help page covers every options section, the toolbar and the notes window', () => {
  const html = help();
  const topics = [
    'Keys',
    'Progressions',
    'Progression variations',
    'Chord variations',
    'Bass variations',
    'Melody variations',
    'Exercises',
    'The toolbar',
    'Generate',
    'Viewing the chords',
    'The notes window',
    'Saved settings',
  ];
  for (const topic of topics) {
    assert.ok(new RegExp(`<h[23][^>]*>${topic}</h[23]>`).test(html), `a heading for ${topic}`);
  }
});

test('the help page explains the controls of the page by their labels', () => {
  const html = help();
  for (const label of ['Rotations', 'Permutations', 'Amount', '#b', 'Options button', 'Exercises button', 'Help button', 'Roman numerals button',
    'Chord tones button', 'Colours button', 'Dark mode button', 'Piano', 'Guitar', 'Melody button']) {
    assert.ok(html.includes(label), label);
  }
});

test('every in-page link on the help page points to an id that exists on the page', () => {
  const html = help();
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.ok(targets.length >= 2, 'the page links to its own sections');
  for (const target of targets) {
    assert.ok(ids.has(target), target);
  }
});

test('every local link on the help page and in the app points to a file that exists', () => {
  // Links are resolved from the folder of the page they are on: the help page sits in chordice/app/help/, the app at the root.
  const pages = [[help(), SITE], [index(), ROOT]];
  for (const [html, base] of pages) {
    const local = [...html.matchAll(/href="([^"#][^"]*)"/g)].map((match) => match[1])
      .filter((href) => !/^(https?:|mailto:)/.test(href));
    for (const href of local) {
      assert.ok(existsSync(fileURLToPath(new URL(href, base))), href);
    }
  }
});

test('the help page uses no class that the stylesheet does not define', () => {
  // The stylesheets the help page links, as one text.
  const css = [...help().matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
    .map((match) => readFileSync(new URL(match[1], SITE), 'utf8')).join('\n');
  const classes = new Set();
  for (const [, value] of help().matchAll(/class="([^"]*)"/g)) {
    value.split(/\s+/).filter(Boolean).forEach((name) => classes.add(name));
  }
  assert.ok(classes.size > 0);
  for (const name of classes) {
    assert.ok(css.includes(`.${name}`), `.${name} is in a stylesheet of the help page`);
  }
});

test('the help page follows the stored theme and defaults to light, as the app does', () => {
  const html = help();
  assert.match(html, /data-theme="light"/);
  assert.ok(html.includes("chordice_state="));
  assert.ok(html.includes("theme === 'dark'"));
});

/**
 * The progression examples of the help page as [name, progression, genre, romans, chords], each cell as plain text, with the raised
 * accidentals written as # and b again, as the library and tonal spell them.
 */
const exampleRows = () => [...help().matchAll(/<tr data-progression="([^"]+)">([\s\S]*?)<\/tr>/g)].map(([, name, cells]) => [
  name,
  ...[...cells.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(([, cell]) => cell.replace(/<[^>]+>/g, '').replaceAll('♯', '#').replaceAll('♭', 'b')),
]);

test('the accidentals in the progression examples are raised signs, as in the app', () => {
  const html = help();
  assert.ok(html.includes('<td>I – <span class="accidental">♭</span>VII – IV</td>'));
  assert.ok(html.includes('<td>C – B<span class="accidental">♭</span> – F</td>'));
});

test('every progression example on the help page is a progression of the library, with the same roman numerals', () => {
  const library = PROGRESSIONS_DATA;
  const rows = exampleRows().map(([name, , , romans]) => [null, name, romans]);
  assert.ok(rows.length >= 5);
  for (const [, name, romans] of rows) {
    const group = Object.values(library).find((entry) => Object.hasOwn(entry.progressions ?? {}, name));
    assert.ok(group, `${name} is in the library`);
    assert.equal(romans, group.progressions[name].join(' – '), name);
  }
});

test('the chord symbols in the progression examples are the chords of the key of C, as tonal spells them', async () => {
  const { Progression } = await import('tonal');
  const rows = exampleRows().map(([name, , , romans, chords]) => [null, name, romans, chords]);
  assert.ok(rows.length >= 5);
  for (const [, name, romans, chords] of rows) {
    const numerals = romans.split(' – ');
    assert.equal(chords, Progression.fromRomanNumerals('C', numerals).join(' – '), name);
  }
});

test('the help page shows the icon of every control in the toolbar list, and the icon is drawn by an svg', () => {
  const html = help();
  const list = /<ul class="help-controls">[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
  const items = list.split('<li>').slice(1);
  assert.equal(items.length, 8);
  for (const item of items) {
    assert.match(item, /^<span class="help-icon"><svg /);
  }
});

test('the melody icon matches the one on the Melody button in the app', () => {
  const options = readFileSync(new URL('chordice/app/options/options.js', ROOT), 'utf8');
  // The icon is one JS expression joined over several lines, from its declaration to the semicolon.
  const melody = /const MELODY_ICON = ([^;]+);/.exec(options)?.[1];
  assert.ok(melody);
  const icon = /<span class="help-icon">(<svg[^]*?<\/svg>)<\/span>\s*The Melody button/.exec(help())?.[1];
  assert.ok(icon, 'the melody paragraph shows the icon');
  // The app's icon is written in a JS string with ' + ' joins; compare its drawing parts.
  for (const part of ['translate(3 0)', 'cx="7" cy="17.5"', 'M9.8 17V4c0 0 .4 3.2 4.2 5.2']) {
    assert.ok(melody.includes(part) && icon.includes(part), part);
  }
});

