import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// renderFingering needs a browser for svguitar's measurements, so the test checks the setting in the source.
const SOURCE = readFileSync(new URL('../../../../chordice/js/notes/guitar/draw.js', import.meta.url), 'utf8');

test('the grid keeps its height with or without muted strings above it, so a shape without them is not drawn larger', () => {
  assert.match(SOURCE, /fixedDiagramPosition: true/);
});
