import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// imprint.html is a static page next to the help page, with its look, linked from the help (and so from the side panel).

const SITE = new URL('../../../../chordice/app/help/', import.meta.url);
const html = () => readFileSync(new URL('imprint.html', SITE), 'utf8');
const document = () => new JSDOM(html()).window.document;

test('imprint.html is an English page with the look of the help page, without code of the app', () => {
  assert.match(html(), /<html lang="en"/);
  assert.equal(document().title, 'Imprint');
  const links = [...html().matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual(links, ['../../styles/main.css', '../../styles/header.css', '../../styles/help.css']);
  assert.ok(!/<script[^>]*(type="module"|src=)/.test(html()));
  // It follows the theme of the app, as the help page does.
  assert.ok(html().includes("JSON.parse(stored).theme === 'dark'"));
});

test('imprint.html links back to the app, and the help links to it', () => {
  assert.ok(html().includes('href="../../../index.html"'));
  assert.ok(existsSync(fileURLToPath(new URL('../../../index.html', SITE))));
  assert.ok(readFileSync(new URL('help.html', SITE), 'utf8').includes('href="imprint.html"'));
});

test('the imprint names the operator, their city and their email address, and nothing more', () => {
  const text = document().querySelector('main').textContent;
  assert.match(text, /§ 5 DDG/);
  const headings = [...document().querySelectorAll('h2')].map((h2) => h2.textContent);
  assert.deepEqual(headings, ['Operator', 'Contact', 'Privacy']);
  assert.match(text, /Timo Tjaden Stomberg/);
  assert.equal(document().querySelector('a[href^="mailto:"]').getAttribute('href'), 'mailto:timo.stomberg.s@gmx.de');
  const operator = document().querySelector('h2 + p').textContent.replace(/\s+/g, ' ').trim();
  assert.equal(operator, 'Timo Tjaden Stomberg Bonn, Germany');
  assert.match(document().querySelector('h2 + p').innerHTML, /<br>\s*Bonn, Germany<\/p>|<br>\s*Bonn, Germany$/);
  assert.ok(!/\[[^\]]+\]/.test(text), 'no placeholders');
  assert.ok(!/phone|VAT/i.test(text), 'nothing that is not required');
});

test('the imprint links the privacy policy, which the side panel then shows', () => {
  const link = document().querySelector('a[href="privacy.html"]');
  assert.equal(link.dataset.action, 'show-help-page');
  assert.equal(link.dataset.page, 'privacy');
});
