import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The layering of chordice/js. The page is split by window (header, options on the left, progressions on the right,
// the notes dialog). Each window stands on its own. The windows share only the files shared with them (the chord view,
// the escaping, the constants), which sit directly in js/; the music theory, the data and the generation know nothing of
// the page. These rules keep the structure from eroding silently.

const JS = fileURLToPath(new URL('../../chordice/js/', import.meta.url));
const WINDOWS = ['header', 'options', 'progressions', 'notes'];
const LAYERS = ['theory', 'data', 'generator', 'core'];
// The files that several parts of the page share. They sit in js/ itself and may import only the theory and each other.
const SHARED = ['constants.js', 'escape.js', 'chord-view.js'];

function sourceFiles(dir = JS) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.js') ? [path] : [];
  });
}

/** The module specifiers a file imports from, as paths relative to js/ (external packages are left out). */
function internalImports(file) {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
  return specifiers
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => relative(JS, resolve(dirname(file), specifier)));
}

/** The window a path of js/ belongs to, or null. */
function windowOf(path) {
  return WINDOWS.find((window) => path.startsWith(`${window}/`)) ?? null;
}

const RULES = [
  {
    description: 'theory imports nothing of the app',
    applies: (path) => path.startsWith('theory/'),
    forbids: (target) => !target.startsWith('theory/'),
  },
  {
    description: 'the shared files import only the theory and each other',
    applies: (path) => SHARED.includes(path),
    forbids: (target) => !target.startsWith('theory/') && !SHARED.includes(target),
  },
  {
    description: 'data and generation do not depend on the page, the windows or the core',
    applies: (path) => path.startsWith('data/') || path.startsWith('generator/'),
    forbids: (target) => /^(core|header|options|progressions|notes)\//.test(target),
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
    description: 'the state does not depend on the actions, the windows or the app',
    applies: (path) => path === 'core/state.js',
    forbids: (target) => target === 'core/app.js' || target === 'core/actions.js' || windowOf(target) !== null,
  },
  {
    description: 'the actions do not depend on the windows or the app',
    applies: (path) => path === 'core/actions.js',
    forbids: (target) => target === 'core/app.js' || windowOf(target) !== null,
  },
  {
    description: 'only the entry point and the app module start the page',
    applies: (path) => path !== 'main.js' && path !== 'core/app.js',
    forbids: (target) => target === 'core/app.js',
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

test('structure: every window and layer folder exists', () => {
  for (const folder of [...WINDOWS, ...LAYERS]) {
    assert.ok(statSync(join(JS, folder)).isDirectory(), `${folder}/ is missing`);
  }
});

test('structure: the shared files exist in js/', () => {
  for (const file of SHARED) {
    assert.ok(statSync(join(JS, file)).isFile(), `${file} is missing`);
  }
});
