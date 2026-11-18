import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../../chordice/js/escape.js';

test('escapeHtml escapes markup characters', () => {
  assert.equal(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});

test('escapeHtml leaves plain text unchanged', () => {
  assert.equal(escapeHtml('F#m7 / Bb'), 'F#m7 / Bb');
});

test('escapeHtml converts non-string values to text first', () => {
  assert.equal(escapeHtml(7), '7');
  assert.equal(escapeHtml(null), 'null');
});

test('escapeHtml escapes every occurrence, not only the first', () => {
  assert.equal(escapeHtml('<<>>'), '&lt;&lt;&gt;&gt;');
});
