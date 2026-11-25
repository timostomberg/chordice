import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// main.js starts the page as a side effect of being imported. The test installs a fake page whose data cannot be
// loaded, so the start ends in the error message in #song-rows, and checks that the import really started the app.

test('importing main.js starts the app, which reports a failed data load in the song', async () => {
  const rows = { textContent: '' };
  const requested = [];
  globalThis.document = { querySelector: (selector) => (selector === '#song-rows' ? rows : null) };
  globalThis.fetch = async (url) => {
    requested.push(url);
    return { ok: false, status: 503 };
  };

  await import('../../../chordice/app/main.js');
  // startApp is not awaited by main.js; let its promise chain settle.
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(requested.length > 0, 'the app requested its data');
  assert.match(rows.textContent, /^Chordice could not start: Could not load .+: 503$/);
});

test('main.js only imports startApp from app.js and calls it', () => {
  const entry = readFileSync(new URL('../../../chordice/app/main.js', import.meta.url), 'utf8');
  assert.ok(entry.includes("import { startApp } from './app.js';"));
  assert.ok(/^startApp\(\);$/m.test(entry), 'main.js calls startApp');
});

test('main.js keeps the screen on and registers the service worker, after starting the app', () => {
  const entry = readFileSync(new URL('../../../chordice/app/main.js', import.meta.url), 'utf8');
  assert.ok(entry.includes("import { keepScreenAwake, registerServiceWorker } from './device.js';"));
  const calls = ['startApp();', 'keepScreenAwake();', 'registerServiceWorker();'].map((call) => entry.indexOf(`\n${call}`));
  assert.ok(calls.every((index) => index > 0), 'main.js makes every call');
  assert.deepEqual([...calls].sort((a, b) => a - b), calls, 'in this order');
});
