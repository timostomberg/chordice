import { test } from 'node:test';
import assert from 'node:assert/strict';

// main.js starts the page as a side effect of being imported. The test installs a fake page whose data cannot be
// loaded, so the start ends in the error message in #rows, and checks that the import really started the app.

test('importing main.js starts the app, which reports a failed data load in the rows', async () => {
  const rows = { textContent: '' };
  const requested = [];
  globalThis.document = { querySelector: (selector) => (selector === '#rows' ? rows : null) };
  globalThis.fetch = async (url) => {
    requested.push(url);
    return { ok: false, status: 503 };
  };

  await import('../../chordice/js/main.js');
  // startApp is not awaited by main.js; let its promise chain settle.
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(requested.length > 0, 'the app requested its data');
  assert.match(rows.textContent, /^Chordice could not start: Could not load .+: 503$/);
});
