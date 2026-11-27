import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// privacy.html is a static page next to the help page, with its look, linked from the help (and so from the side panel).

const SITE = new URL('../../../../chordice/app/help/', import.meta.url);
const html = () => readFileSync(new URL('privacy.html', SITE), 'utf8');
const document = () => new JSDOM(html()).window.document;

test('privacy.html is an English page with the look of the help page, without code of the app', () => {
  assert.match(html(), /<html lang="en"/);
  assert.equal(document().title, 'Privacy Policy');
  const links = [...html().matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual(links, ['../../styles/main.css', '../../styles/header.css', '../../styles/help.css']);
  assert.ok(!/<script[^>]*(type="module"|src=)/.test(html()));
  // It follows the theme of the app, as the help page does.
  assert.ok(html().includes("JSON.parse(stored).theme === 'dark'"));
});

test('privacy.html links back to the app, and the help links to it', () => {
  assert.ok(html().includes('href="../../../index.html"'));
  assert.ok(existsSync(fileURLToPath(new URL('../../../index.html', SITE))));
  assert.ok(readFileSync(new URL('help.html', SITE), 'utf8').includes('href="privacy.html"'));
});

test('the privacy policy covers the controller, every service the page uses, the storage and the account', () => {
  const headings = [...document().querySelectorAll('h2')].map((h2) => h2.textContent);
  assert.deepEqual(headings, [
    'Controller',
    'Hosting',
    'Libraries from content delivery networks',
    'Storage in your browser',
    'Account (optional)',
    'Your rights',
    'Other',
  ]);
  const text = document().querySelector('main').textContent.replace(/\s+/g, ' ');
  for (const service of ['GitHub Pages', 'jsDelivr', 'www.gstatic.com', 'Firebase Authentication', 'Cloud Firestore']) {
    assert.ok(text.includes(service), service);
  }
  assert.ok(!/\[[^\]]+\]/.test(document().querySelector('main').textContent), 'no placeholders');
  const imprint = document().querySelector('a[href="imprint.html"]');
  assert.equal(imprint.dataset.action, 'show-help-page');
  assert.equal(imprint.dataset.page, 'imprint');
});

test('the privacy policy names every key the page stores in the browser', () => {
  const text = document().querySelector('main').textContent;
  const state = new URL('../state/', SITE);
  const keys = ['persistence.js', 'songs.js']
    .flatMap((file) => [...readFileSync(new URL(file, state), 'utf8').matchAll(/export const \w+ = '(chordice_\w+)'/g)])
    .map((match) => match[1]);
  assert.deepEqual([...new Set(keys)].sort(), ['chordice_songs', 'chordice_state']);
  for (const key of keys) {
    assert.ok(text.includes(key), key);
  }
});

test('the privacy policy names every host the page loads code from', () => {
  const root = new URL('../../../', SITE);
  const sources = ['index.html', 'sw.js', 'chordice/app/app.js', 'chordice/app/account.js']
    .map((path) => readFileSync(new URL(path, root), 'utf8'))
    .join('\n');
  const hosts = new Set([...sources.matchAll(/https:\/\/([a-z0-9.-]+)\//g)].map((match) => match[1]));
  const text = html();
  for (const host of hosts) {
    assert.ok(text.includes(host), host);
  }
});


test('the privacy policy names the location of the database that the README sets up', () => {
  const readme = readFileSync(new URL('../../../../README.md', import.meta.url), 'utf8');
  assert.match(readme, /The privacy policy assumes the Firestore location `europe-west3`\./);
  assert.match(document().querySelector('main').textContent, /The songs are stored in the EU \(Frankfurt, Germany\)\./);
});

test('the controller is named with a name and an email address only, and the rights point to that address', () => {
  const heading = [...document().querySelectorAll('h2')].find((h2) => h2.textContent === 'Controller');
  const controller = heading.nextElementSibling;
  assert.equal(controller.textContent.replace(/\s+/g, ' ').trim(), 'Timo Tjaden Stomberg Email: timo.stomberg.s@gmx.de');
  assert.equal(controller.querySelector('a').getAttribute('href'), 'mailto:timo.stomberg.s@gmx.de');
  assert.match(document().querySelector('main').textContent, /write to the email address above/);
});

test('the privacy policy says that signing out removes the copy of the songs from the browser', () => {
  const text = document().querySelector('main').textContent.replace(/\s+/g, ' ');
  assert.ok(text.includes('a copy of your songs is also kept in your browser'));
  assert.ok(text.includes('signing out removes it from the browser'));
});
