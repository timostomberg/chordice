import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
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

test('the help page covers the circle of fifths, every options section, the view and the notes window', () => {
  const html = help();
  const topics = [
    'The circle of fifths',
    'Progressions',
    'Progression variations',
    'Chord variations',
    'Bass variations',
    'Melody variations',
    'Exercises',
    'View',
    'New Song',
    'Viewing the chords',
  ];
  for (const topic of topics) {
    // A heading may start with the icon of its button.
    assert.ok(new RegExp(`<h[23][^>]*>(?:<span class="help-icon"><svg[^]*?</svg></span>)*${topic}</h[23]>`).test(html), `a heading for ${topic}`);
  }
});

test('the help page explains the controls of the page by their labels', () => {
  const html = help();
  for (const label of ['Rotations', 'Permutations', 'Amount', '#b', 'Options button', 'Exercises button', 'Roman numerals button',
    'Chord tones button', 'Colours button', 'Dark mode button', 'Piano', 'Guitar', 'Melody button']) {
    assert.ok(html.includes(label), label);
  }
});

test('the help links only to the imprint, the privacy policy and back to Chordice, not to its own sections', () => {
  const main = /<main class="help">[\s\S]*?<\/main>/.exec(help())[0];
  const links = [...main.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, ['imprint.html', 'privacy.html', '../../../index.html']);
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
 * The theme the help page picks, by running its theme script in a page of jsdom with the given cookie and stored copy of
 * the state (each an object, or null when absent). `refuse` makes the local storage throw, as a private window may.
 */
function themeOf({ cookie = null, stored = null, refuse = false } = {}) {
  const script = /<script>([\s\S]*?)<\/script>/.exec(help())[1];
  const { window } = new JSDOM('<!DOCTYPE html><html></html>', { url: 'https://example.github.io/chordice/', runScripts: 'outside-only' });
  if (cookie) {
    window.document.cookie = `chordice_state=${encodeURIComponent(JSON.stringify(cookie))}`;
  }
  if (stored) {
    window.localStorage.setItem('chordice_state', JSON.stringify(stored));
  }
  if (refuse) {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } });
  }
  window.eval(script);
  return window.document.documentElement.dataset.theme;
}

test('the help page takes the theme from the cookie, and from the stored copy once the cookie is gone', () => {
  assert.equal(themeOf(), 'light');
  assert.equal(themeOf({ cookie: { theme: 'dark' } }), 'dark');
  assert.equal(themeOf({ stored: { theme: 'dark' } }), 'dark');
  assert.equal(themeOf({ cookie: { theme: 'light' }, stored: { theme: 'dark' } }), 'light', 'the cookie wins');
  assert.equal(themeOf({ refuse: true }), 'light', 'a refused storage leaves the default');
});

test('the help page tells how Chordice works on a phone or tablet: the home screen, offline, the screen, swipes', () => {
  const html = help();
  for (const words of ['Add to Home Screen', 'offline', 'the screen stays on', 'swipe']) {
    assert.ok(html.includes(words), words);
  }
});

test('the help gives one progression example in the text, from the library, with its chords in C as tonal spells them', async () => {
  const { Progression } = await import('tonal');
  const text = new JSDOM(help()).window.document.querySelector('main').textContent.replace(/\s+/g, ' ');
  assert.equal(new JSDOM(help()).window.document.querySelector('table'), null, 'no table');
  const [, name, romans, chords] = /e\.g\. the (.+?) (I[^,]+), in C: ([^.]+)\./.exec(text);
  assert.equal(romans, PROGRESSIONS_DATA.Pop.progressions[name].join(' – '));
  assert.equal(chords, Progression.fromRomanNumerals('C', romans.split(' – ')).join(' – '));
});

test('the help page shows the icon of every control in the View list, and the icon is drawn by an svg', () => {
  const html = help();
  const list = /<ul class="help-controls">[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
  const items = list.split('<li>').slice(1);
  assert.equal(items.length, 6);
  assert.ok(!list.includes('Help button'), 'the Help button needs no words');
  for (const item of items) {
    assert.match(item, /^<span class="help-icon"><svg /);
  }
});

test('the melody icon matches the one on the Melody button in the app', () => {
  const options = readFileSync(new URL('chordice/app/options/options.js', ROOT), 'utf8');
  // The icon is one JS expression joined over several lines, from its declaration to the semicolon.
  const melody = /const MELODY_ICON = ([^;]+);/.exec(options)?.[1];
  assert.ok(melody);
  const icon = /The Melody button <span class="help-icon">(<svg[^]*?<\/svg>)<\/span> shows/.exec(help())?.[1];
  assert.ok(icon, 'the text shows the icon right after the Melody button');
  // The app's icon is written in a JS string with ' + ' joins; compare its drawing parts.
  for (const part of ['translate(3 0)', 'cx="7" cy="17.5"', 'M9.8 17V4c0 0 .4 3.2 4.2 5.2']) {
    assert.ok(melody.includes(part) && icon.includes(part), part);
  }
});


test('the chord tones icon matches the one on the chord tones button in the header, and the help says it is greyed out on the guitar', () => {
  const index = readFileSync(new URL('index.html', ROOT), 'utf8');
  const button = /<button[^>]*class="tones-toggle"[\s\S]*?<\/button>/.exec(index)?.[0] ?? '';
  const icon = /<li><span class="help-icon">(<svg(?:(?!<li>)[^])*?<\/svg>)<\/span><strong>Chord tones button<\/strong>([^<]*)/.exec(help());
  assert.ok(icon, 'the chord tones item shows the icon');
  const drawing = (svg) => [...svg.matchAll(/<(?:path|ellipse) [^>]*?\/>/g)].map((match) => match[0]);
  assert.equal(drawing(button).length, 4);
  assert.deepEqual(drawing(icon[1]), drawing(button));
  assert.match(icon[2], /Greyed out on the guitar/);
});

test('the help page explains the circle of fifths beside the chords and its arrow button, not a Keys section', () => {
  const html = help();
  assert.ok(!/<h[23][^>]*>Keys<\/h[23]>/.test(html));
  assert.ok(html.includes('left of the chords'));
  assert.ok(html.includes('arrow button in the middle of the circle'));
});

test('the help page says briefly what the account, signing out, deleting it and Reset settings do', () => {
  const text = new JSDOM(help()).window.document.querySelector('main').textContent.replace(/\s+/g, ' ');
  assert.ok(text.includes('Sign in with Google keeps your songs and settings in your account, on every device'));
  assert.ok(text.includes('Sign out leaves them in your account and removes the songs from this browser'));
  assert.ok(text.includes('after Google has asked you to sign in once more'));
  assert.ok(text.includes('Reset settings sets every setting back to its default. Your saved songs stay.'));
});

test('the help page is short: no paragraph or list item of it runs over three hundred characters', () => {
  const document = new JSDOM(help()).window.document;
  const long = [...document.querySelectorAll('main p, main li')]
    .map((element) => element.textContent.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 300);
  assert.deepEqual(long, []);
});

test('the View list names only the buttons that no section below explains, in the order of the header', () => {
  const index = readFileSync(new URL('index.html', ROOT), 'utf8');
  const toolbar = /<header class="toolbar"[\s\S]*?<\/header>/.exec(index)[0];
  const classes = [...toolbar.matchAll(/<button type="button" class="([\w-]+)/g)].map((match) => match[1]);
  const names = {
    'instrument-tab': 'Instrument tabs', 'roman-toggle': 'Roman numerals button', 'tones-toggle': 'Chord tones button',
    'colour-toggle': 'Colours button', 'painting-toggle': 'Painting button', 'theme-toggle': 'Dark mode button',
  };
  // The other buttons open a panel or choose a window that has a section of its own; its heading shows their icon.
  const inHeadings = {
    'options-toggle': 'The options panel', 'exercises-toggle': 'Exercises', 'songs-toggle': 'Saved songs',
    'account-toggle': 'Account',
  };
  // The Help button needs no words: it shows the help itself.
  const unnamed = ['help-toggle'];
  assert.deepEqual(classes.filter((name) => ![names, inHeadings].some((map) => Object.hasOwn(map, name)) && !unnamed.includes(name)), []);
  const expected = [...new Set(classes.filter((name) => Object.hasOwn(names, name)).map((name) => names[name]))];
  const list = /<ul class="help-controls">[\s\S]*?<\/ul>/.exec(help())[0];
  assert.deepEqual([...list.matchAll(/<strong>([^<]+)<\/strong>/g)].map((match) => match[1]), expected);
  const drawing = (svg) => [...svg.matchAll(/<(?:path|circle|rect|ellipse) [^>]*?\/>/g)].map((match) => match[0]);
  for (const [name, heading] of Object.entries(inHeadings)) {
    const buttons = [...toolbar.matchAll(new RegExp(`<button[^>]*class="${name}[\\s\\S]*?<\\/button>`, 'g'))].map((match) => match[0]);
    const icons = new RegExp(`<h2[^>]*>((?:<span class="help-icon"><svg(?:(?!<svg|<h2)[^])*?</svg></span>)+)${heading}</h2>`).exec(help())?.[1];
    assert.ok(icons, `the heading ${heading} shows the icon`);
    const shown = [...icons.matchAll(/<svg[^]*?<\/svg>/g)].map((match) => drawing(match[0]));
    assert.deepEqual(shown, buttons.map(drawing), heading);
  }
});

test('the help explains the view and the panels of the header first, and the rest after them', () => {
  const headings = [...help().matchAll(/<h2[^>]*>(?:<span class="help-icon"><svg(?:(?!<svg)[^])*?<\/svg><\/span>)*([^<]+)<\/h2>/g)].map((match) => match[1]);
  // First the view and the panels of the buttons in the header, then the rest.
  assert.deepEqual(headings, ['Help', 'View', 'The options panel', 'Exercises', 'Saved songs', 'Account',
    'The circle of fifths', 'Viewing the chords', 'New Song', 'On a phone or tablet', 'Legal']);
  assert.ok(!headings.includes('The toolbar') && !headings.includes('What Chordice does'));
});

test('the help starts with one sentence of what Chordice does', () => {
  const first = /<h2>Help<\/h2>\s*<p>([^]*?)<\/p>/.exec(help())[1];
  assert.equal(first, 'Chordice generates chord progressions for practice.');
});

test('the account part tells where the settings are kept, and Viewing the chords starts with the chord tones and the melody note', () => {
  const document = new JSDOM(help()).window.document;
  const after = (id) => {
    const texts = [];
    for (let node = document.getElementById(id).nextElementSibling; node && node.tagName !== 'H2'; node = node.nextElementSibling) {
      texts.push(node.textContent.replace(/\s+/g, ' ').trim());
    }
    return texts;
  };
  const account = after('account');
  assert.ok(account.some((text) => text.startsWith('Your settings are kept in this browser and, signed in, in your account.')));
  assert.ok(account.some((text) => text.startsWith('Reset settings sets every setting back to its default.')));
  const viewing = after('viewing-chords');
  assert.match(viewing[0], /^With the Chord tones button on, .* its melody note too\.$/);
  // The notes window is part of it, without a heading of its own.
  assert.ok(viewing.some((text) => text.startsWith('Click a chord to open its notes.')));
});
