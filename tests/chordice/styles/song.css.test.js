import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allCss,
  declarationsOf as declarationsIn,
  readCss,
  themeBlock as themeBlockIn,
} from '../../helpers/stylesheets.js';

// These tests check the structure of song.css (variables, classes, rules), not its concrete values, so that design changes
// do not need test changes. Tests that span several stylesheets read all of them, in the order the pages link them (ALL).

const CSS = readCss('song.css');
const ALL = allCss();
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const themeBlock = (selector) => themeBlockIn(CSS, selector);

test('the progression heading centres its title and the tags on one line', () => {
  assert.ok(/\.row h2\s*\{[^}]*display: flex/.test(CSS));
  assert.ok(/\.row h2\s*\{[^}]*align-items: center/.test(CSS));
});

test('two columns of rows stand side by side, each from the top, and one below the other where the song area is narrow', () => {
  const columns = declarationsOf('.song-columns');
  assert.ok(columns.includes('display: flex'));
  assert.ok(columns.includes('align-items: flex-start'));
  assert.ok(columns.includes('flex-wrap: wrap'), 'the right column moves below where they do not fit side by side');
  assert.ok(/column-gap: calc\(var\(--zoom\) \* /.test(columns), 'the gap zooms with the chords');
  assert.ok(declarationsOf('.song-column').includes('min-width: 0'));
  const narrow = /@container \(max-width: ([\d.]+)rem\) \{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(narrow, 'a container query for a narrow song area');
  assert.match(narrow[2], /\.song-columns \{[^}]*flex-direction: column/);
  // The same width as the one that puts the circle above the chords.
  assert.ok(ALL.includes(`@container (max-width: ${narrow[1]}rem) {\n  .song-body {`));
});

test('the headings in two columns do not widen them beyond the chords that zoom.js measures', () => {
  assert.ok(declarationsOf('.song-column .row h2').includes('contain: inline-size'));
});
