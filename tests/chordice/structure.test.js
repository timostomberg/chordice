import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The layering of chordice/. It is split into the music, the logic of the page and its styles:
// - music/ is the domain: the music theory, the data files, the generation of the song, and how a chord is voiced on the
//   piano and fingered on the guitar. It knows nothing of the page, so it would work the same behind any other front end.
// - app/ is the whole logic and markup of the web page. state/ holds the page's state (the options, the switches, the
//   cookie, which options are available) as pure functions; each window (the header, the options on the left, the song
//   on the right, the notes dialog, the help page) turns it into HTML and SVG and handles the window's elements, each
//   standing on its own and sharing only escape.js, names.js and chord.js; app.js loads the data and wires the events to the
//   state and the windows; main.js starts it. A part of one file is a file directly in app/ (e.g. header.js); only a
//   part of several files that belong together has a folder of its own (e.g. options/, notes/, help/).
// - styles/ is the look of the page: every stylesheet and nothing else, side by side without folders. main.css is the base
//   stylesheet; every other one is named after the module or page in app/ it styles (e.g. options.css for options.js).
// These rules keep the structure from eroding silently.

const JS = fileURLToPath(new URL('../../chordice/', import.meta.url));
const MUSIC_FOLDERS = ['theory', 'data', 'generator', 'instruments'];
// The windows of the app: a window of one file is that file in app/, a window of several files a folder.
const WINDOWS = { header: 'header.js', options: 'options', song: 'song', notes: 'notes', help: 'help', background: 'background' };
// The files that several windows share: the escaping, and the chord box that the rows and the notes window both show.
const SHARED = ['app/escape.js', 'app/names.js', 'app/chord.js'];
// device.js is what main.js asks of the device (the screen kept on, the service worker); it belongs to no window.
// panel.js makes the side panel a screen of its own (back button, swipes) for app.js; it belongs to no window either.
const APP_ENTRIES = ['app.js', 'main.js', 'device.js', 'panel.js', 'state', ...Object.values(WINDOWS), ...SHARED.map((path) => path.slice('app/'.length))];

function sourceFiles(dir = JS) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.js') ? [path] : [];
  });
}

/** The module specifiers a file imports from, as paths relative to chordice/ (external packages are left out). */
function internalImports(file) {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
  return specifiers
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => relative(JS, resolve(dirname(file), specifier)));
}

/** The window of app/ a path belongs to, or null: the window's file itself, or a file in the window's folder. */
function windowOf(path) {
  return Object.keys(WINDOWS).find((window) => path === `app/${WINDOWS[window]}` || path.startsWith(`app/${WINDOWS[window]}/`)) ?? null;
}

const RULES = [
  {
    description: 'the music imports nothing of the page',
    applies: (path) => path.startsWith('music/'),
    forbids: (target) => !target.startsWith('music/'),
  },
  {
    description: 'the theory imports nothing else of the music',
    applies: (path) => path.startsWith('music/theory/'),
    forbids: (target) => !target.startsWith('music/theory/'),
  },
  {
    description: 'the page state imports nothing else of the app',
    applies: (path) => path.startsWith('app/state/'),
    forbids: (target) => target.startsWith('app/') && !target.startsWith('app/state/'),
  },
  {
    description: 'the state does not depend on its persistence, its availability or the actions, which build on it',
    applies: (path) => path === 'app/state/state.js',
    forbids: (target) => ['persistence.js', 'availability.js', 'actions.js'].some((name) => target === `app/state/${name}`),
  },
  {
    description: 'the windows and the shared files do not import app.js',
    applies: (path) => windowOf(path) !== null || SHARED.includes(path),
    forbids: (target) => target === 'app/app.js',
  },
  {
    description: 'the shared files import only the music and each other',
    applies: (path) => SHARED.includes(path),
    forbids: (target) => !target.startsWith('music/') && !SHARED.includes(target),
  },
  {
    description: 'a window does not depend on another window',
    applies: (path) => windowOf(path) !== null,
    forbids: (target, path) => {
      const other = windowOf(target);
      return other !== null && other !== windowOf(path);
    },
  },
  {
    description: 'only the entry point starts the app',
    applies: (path) => path !== 'app/main.js',
    forbids: (target) => target === 'app/app.js',
  },
];

for (const rule of RULES) {
  test(`structure: ${rule.description}`, () => {
    const violations = [];
    for (const file of sourceFiles()) {
      const path = relative(JS, file);
      if (!rule.applies(path)) {
        continue;
      }
      for (const target of internalImports(file)) {
        if (rule.forbids(target, path)) {
          violations.push(`${path} imports ${target}`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });
}

const visible = (dir) => readdirSync(dir).filter((name) => !name.startsWith('.')).sort();

test('structure: chordice/ holds the music, the app and the styles, and the app its entry point, app, state, windows and shared files', () => {
  assert.deepEqual(visible(JS), ['app', 'music', 'styles']);
  assert.deepEqual(visible(join(JS, 'app')), [...APP_ENTRIES].sort());
});

test('structure: every folder of the music and every window of the app exists', () => {
  for (const folder of MUSIC_FOLDERS) {
    assert.ok(statSync(join(JS, 'music', folder)).isDirectory(), `music/${folder}/ is missing`);
  }
  for (const entry of Object.values(WINDOWS)) {
    assert.ok(existsSync(join(JS, 'app', entry)), `app/${entry} is missing`);
  }
});

test('structure: every folder of the app holds more than one file; a part of one file sits directly in app/', () => {
  const folders = readdirSync(join(JS, 'app')).filter((name) => statSync(join(JS, 'app', name)).isDirectory());
  assert.ok(folders.length > 0);
  const single = folders.filter((name) => visible(join(JS, 'app', name)).length < 2).map((name) => `app/${name}/`);
  assert.deepEqual(single, []);
});

const PAGE_APIS = /\b(document|window|HTMLElement|addEventListener|innerHTML|querySelector)\b/;
const RENDERERS = /from ['"](vexflow|svguitar)['"]/;
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('structure: neither the music nor the page state touches the page or a drawing library', () => {
  const touching = [...sourceFiles(join(JS, 'music')), ...sourceFiles(join(JS, 'app/state'))]
    .filter((file) => {
      const source = withoutComments(readFileSync(file, 'utf8'));
      return PAGE_APIS.test(source) || RENDERERS.test(source);
    })
    .map((file) => relative(JS, file));
  assert.deepEqual(touching, []);
});

test('structure: the shared files exist', () => {
  for (const file of SHARED) {
    assert.ok(statSync(join(JS, file)).isFile(), `${file} is missing`);
  }
});

// The tests mirror the repository: the test of <path> is tests/<path without .js>.test.js, e.g. chordice/app/state/state.js
// is tested in tests/chordice/app/state/state.test.js, and index.html in tests/index.html.test.js (likewise sw.js and
// manifest.webmanifest). Besides, this file tests
// the structure of chordice/ as a whole, tests/features/ holds the tests of a feature that spans several modules (e.g. an
// exercise from its action to its song), and tests/helpers/ the shared fixtures, which are no tests.
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const TESTS = join(REPO, 'tests');
const LINKED = (page) => [...readFileSync(join(REPO, page), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
  .map((match) => relative(REPO, resolve(dirname(join(REPO, page)), match[1])));

test('structure: styles/ holds only stylesheets, without folders, and no stylesheet sits anywhere else', () => {
  const styles = join(JS, 'styles');
  assert.deepEqual(visible(styles).filter((name) => !name.endsWith('.css') || statSync(join(styles, name)).isDirectory()), []);
  const elsewhere = filesUnder(JS)
    .filter((file) => file.endsWith('.css') && dirname(file) !== resolve(styles))
    .map((file) => relative(JS, file));
  assert.deepEqual(elsewhere, []);
});

test('structure: every stylesheet but main.css is named after the module or page in app/ it styles', () => {
  const stems = new Set(filesUnder(join(JS, 'app'))
    .filter((file) => /\.(js|html)$/.test(file))
    .map((file) => basename(file).replace(/\.[^.]+$/, '')));
  const unnamed = visible(join(JS, 'styles'))
    .filter((name) => name !== 'main.css' && !stems.has(name.replace(/\.css$/, '')));
  assert.deepEqual(unnamed, []);
});

test('structure: app/ holds no files of the same name, so parts of several files have a folder of their own', () => {
  const stems = readdirSync(join(JS, 'app'))
    .filter((name) => statSync(join(JS, 'app', name)).isFile())
    .map((name) => name.replace(/\.[^.]+$/, ''));
  assert.deepEqual(stems.filter((stem, index) => stems.indexOf(stem) !== index), []);
});

test('structure: every stylesheet is linked by a page, and both pages link main.css first', () => {
  const app = LINKED('index.html');
  const help = LINKED('chordice/app/help/help.html');
  assert.equal(app[0], 'chordice/styles/main.css');
  assert.equal(help[0], 'chordice/styles/main.css');
  const linked = new Set([...app, ...help]);
  const stylesheets = filesUnder(JS).filter((file) => file.endsWith('.css')).map((file) => relative(REPO, file));
  assert.deepEqual(stylesheets.filter((path) => !linked.has(path)), []);
  for (const path of linked) {
    assert.ok(existsSync(join(REPO, path)), `${path} is linked but missing`);
  }
});

const STRUCTURE_TEST = 'chordice/structure.test.js';
const FEATURES = 'features/';
const HELPERS = 'helpers/';
const TESTED = /\.(js|html|css|yaml|webmanifest)$/;
// The files of the page that sit next to index.html: the service worker and the manifest of the app on the home screen.
const ROOT_SOURCES = ['index.html', 'sw.js', 'manifest.webmanifest'];

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const testPathOf = (source) => `${source.replace(/\.js$/, '')}.test.js`;
const sources = () => [...ROOT_SOURCES, ...filesUnder(join(REPO, 'chordice')).map((file) => relative(REPO, file))]
  .filter((path) => TESTED.test(path));

test('structure: every source file has a test file at the mirrored path in tests/', () => {
  const missing = sources().filter((source) => !existsSync(join(TESTS, testPathOf(source))));
  assert.deepEqual(missing, []);
});

test('structure: every test file in tests/ belongs to a source file at the mirrored path', () => {
  const expected = new Set(sources().map(testPathOf));
  const orphans = filesUnder(TESTS)
    .map((file) => relative(TESTS, file))
    .filter((path) => path.endsWith('.test.js') && path !== STRUCTURE_TEST && !path.startsWith(FEATURES) && !expected.has(path));
  assert.deepEqual(orphans, []);
});

test('structure: tests/ holds the mirrored tests, the feature tests and the helpers, and the helpers hold no tests', () => {
  assert.deepEqual(visible(TESTS), ['chordice', 'features', 'helpers', ...ROOT_SOURCES.map(testPathOf)].sort());
  assert.deepEqual(visible(join(TESTS, HELPERS)).filter((name) => name.endsWith('.test.js')), []);
  const features = visible(join(TESTS, FEATURES));
  assert.ok(features.length > 0);
  assert.deepEqual(features.filter((name) => !name.endsWith('.test.js')), []);
});
