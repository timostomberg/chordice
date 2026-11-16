import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);

test('index.html at the root redirects to the main page, which exists', () => {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  const target = /url=([^"]+)"/.exec(html)?.[1];
  assert.equal(target, 'chordice/html/main.html');
  assert.ok(existsSync(fileURLToPath(new URL(target, ROOT))));
});
