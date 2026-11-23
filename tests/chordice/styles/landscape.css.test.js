import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { declarationsOf as declarationsIn, readCss } from '../../helpers/stylesheets.js';

// These tests check the structure of landscape.css, not its concrete values, so that design changes need no test changes.

const CSS = readCss('landscape.css');
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const INDEX = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

// The painting is decoration only: it never takes a click or a screen reader's attention, and the header, the options and
// the chords lie above it.
test('the painting behind the app is fixed, hidden from screen readers, takes no pointer and lies below the layout', () => {
  const svg = /<svg id="landscape" class="landscape"[^>]*>/.exec(INDEX)?.[0] ?? '';
  assert.ok(svg.includes('aria-hidden="true"'), 'the painting is hidden from screen readers');
  assert.ok(svg.includes('slice'), 'the painting covers the screen');
  const block = declarationsOf('.landscape');
  assert.ok(block.includes('position: fixed'));
  assert.ok(block.includes('pointer-events: none'));
  const below = Number(/z-index:\s*(-?\d+)/.exec(block)[1]);
  const above = Number(/z-index:\s*(-?\d+)/.exec(declarationsIn(readCss('main.css'), '.layout'))[1]);
  assert.ok(below < above, 'the layout lies above the painting');
});

test('a new painting fades in, but not for readers who asked for less motion', () => {
  assert.match(declarationsOf('.landscape-scene'), /animation:\s*landscape-in/);
  assert.match(CSS, /@keyframes landscape-in/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.landscape-scene\s*\{\s*animation: none/);
});

test('the rims of the washes and the paper grain follow the theme', () => {
  assert.ok(declarationsOf('.landscape-edge').includes('stroke: var(--pigment-edge)'));
  assert.ok(declarationsOf('.landscape-paper').includes('opacity: var(--grain)'));
});
