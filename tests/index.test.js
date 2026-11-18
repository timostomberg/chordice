import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The app is served from index.html itself (GitHub Pages cannot rewrite URLs), so the address in the browser
// does not change. The page must not redirect anywhere, and the files it loads must exist.

const ROOT = new URL('../', import.meta.url);

test('index.html at the root is the app itself, without a redirect', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  assert.ok(!/http-equiv="refresh"/i.test(html), 'no meta refresh');
});

test('index.html loads its stylesheet and app module from chordice/, and they exist', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  const css = /<link rel="stylesheet" href="([^"]+)"/.exec(html)?.[1];
  const script = /<script type="module" src="([^"]+)"/.exec(html)?.[1];
  assert.equal(css, 'chordice/main.css');
  assert.equal(script, 'chordice/js/main.js');
  assert.ok(existsSync(fileURLToPath(new URL(css, ROOT))));
  assert.ok(existsSync(fileURLToPath(new URL(script, ROOT))));
});
