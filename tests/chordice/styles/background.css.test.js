import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { declarationsOf as declarationsIn, readCss } from '../../helpers/stylesheets.js';

// These tests check the structure of background.css, not its concrete values, so that design changes need no test changes.

const CSS = readCss('background.css');
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const INDEX = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

// The background is decoration only: it never takes a click or a screen reader's attention, and the header, the options
// and the chords lie above it.
test('the background behind the app is fixed, hidden from screen readers, takes no pointer and lies below the layout', () => {
  const element = /<div id="background" class="background"[^>]*>/.exec(INDEX)?.[0] ?? '';
  assert.ok(element.includes('aria-hidden="true"'), 'the background is hidden from screen readers');
  const block = declarationsOf('.background');
  assert.ok(block.includes('position: fixed'));
  assert.ok(block.includes('pointer-events: none'));
  const below = Number(/z-index:\s*(-?\d+)/.exec(block)[1]);
  const above = Number(/z-index:\s*(-?\d+)/.exec(declarationsIn(readCss('main.css'), '.layout'))[1]);
  assert.ok(below < above, 'the layout lies above the background');
});

test('the painting covers the screen from its bottom middle, over the one before it while it fades in', () => {
  const block = declarationsOf('.background-painting');
  assert.match(block, /position: absolute/);
  assert.match(block, /inset: 0/);
  assert.ok(block.includes('object-fit: cover'));
  assert.match(block, /object-position: 50% 100%/);
});

test('a new painting fades in over its colour, but not for readers who asked for less motion', () => {
  assert.match(declarationsOf('.background-painting'), /opacity: 0/);
  assert.match(declarationsOf('.background-painting'), /transition: opacity/);
  assert.match(declarationsOf('.background-painting.shown'), /opacity: 1/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.background-painting\s*\{\s*transition: none/);
});

test('the grain of the paper lies over the painting as a repeated tile of noise, and not on a plain background', () => {
  const block = declarationsOf('.background::after');
  assert.match(block, /position: absolute/);
  assert.match(block, /background-image: url\("data:image\/svg\+xml,[^"]*feTurbulence[^"]*stitchTiles='stitch'/);
  assert.match(block, /background-size: \d+px \d+px/);
  assert.match(declarationsOf(':root[data-theme="dark"] .background::after'), /opacity:/);
  assert.match(declarationsOf('.background.plain::after'), /display: none/);
});
