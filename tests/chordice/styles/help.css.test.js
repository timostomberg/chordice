import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCss } from '../../helpers/stylesheets.js';

const CSS = readCss('help.css');

test('the help page headings use the blue of the app accents', () => {
  for (const heading of ['h2', 'h3']) {
    const block = new RegExp(`\\.help ${heading}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
    assert.match(block, /color:\s*var\(--icon-blue\)/, `.help ${heading} is --icon-blue`);
  }
});

test('the help page scrolls as a whole, as the fixed-height layout of the app does not apply to it', () => {
  assert.match(CSS, /\.help-page\s*\{[^}]*overflow-y: auto/);
});

test('help.css styles only the help page, so the app does not need it', () => {
  const selectors = [...CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)]
    .flatMap((match) => match[1].split(','))
    .map((selector) => selector.trim());
  assert.ok(selectors.length > 0);
  assert.deepEqual(selectors.filter((selector) => !/^\.help/.test(selector)), []);
});
