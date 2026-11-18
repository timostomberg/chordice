import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

// rhythm_patterns.yaml is an empty placeholder: no patterns exist yet, so nothing is loaded from it. This test
// keeps the placeholder honest. Once real patterns are added, it fails, and the tests for them are written then.
test('rhythm_patterns.yaml is still an empty placeholder without patterns', () => {
  const data = load(readFileSync(new URL('../../chordice/data/rhythm_patterns.yaml', import.meta.url), 'utf8'));
  assert.ok(data == null);
});
