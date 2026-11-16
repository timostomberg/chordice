import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = new URL('../../chordice/', import.meta.url);
const read = (path) => readFileSync(new URL(path, SITE), 'utf8');

test('main.html loads the stylesheet, the app module and the YAML library from the CDN', () => {
  const html = read('html/main.html');
  assert.ok(html.includes('href="../css/main.css"'));
  assert.ok(existsSync(fileURLToPath(new URL('css/main.css', SITE))));
  assert.ok(html.includes('src="../js/app.js"'));
  assert.ok(html.includes('"js-yaml": "https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm"'));
  assert.ok(html.includes('"tonal": "https://cdn.jsdelivr.net/npm/tonal@6.6.0/+esm"'));
  assert.ok(html.includes('"vexflow": "https://cdn.jsdelivr.net/npm/vexflow@5.0.0/+esm"'));
});

test('main.html has the notes window with the parts that notes-dialog.js fills in', () => {
  const html = read('html/main.html');
  for (const id of ['notes', 'notes-staff']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok(html.includes('<dialog id="notes"'));
  assert.ok(!html.includes('notes-close'), 'the notes window has no close button');
});

test('every element that app.js looks up exists in main.html', () => {
  const html = read('html/main.html');
  const app = read('js/app.js');
  const selectors = [...app.matchAll(/querySelector\('([^']+)'\)/g)].map((match) => match[1]);
  assert.ok(selectors.length >= 3);
  for (const selector of selectors) {
    if (selector.startsWith('#')) {
      assert.ok(html.includes(`id="${selector.slice(1)}"`), selector);
    } else {
      const action = /data-action="([^"]+)"/.exec(selector)?.[1];
      assert.ok(html.includes(`data-action="${action}"`), selector);
    }
  }
});

test('every data-action in the page is handled by applyAction', () => {
  const html = read('html/main.html');
  const state = read('js/state.js');
  const actions = [...html.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(actions.length > 0);
  for (const action of actions) {
    assert.ok(state.includes(`case '${action}':`), action);
  }
});

test('every data-action in the rendered markup is handled by applyAction, or by app.js for the notes window', () => {
  const state = read('js/state.js');
  const app = read('js/app.js');
  const rendered = [
    ...read('js/render.js').matchAll(/data-action="([^"]+)"/g),
    ...read('js/circle.js').matchAll(/data-action="([^"]+)"/g),
  ].map((match) => match[1]);
  for (const action of rendered) {
    assert.ok(state.includes(`case '${action}':`) || app.includes(`'${action}'`), action);
  }
});

test('the options panel no longer has its own circle markup; the circle is rendered in the Keys section', () => {
  const html = read('html/main.html');
  assert.ok(!html.includes('id="circle"'));
  assert.ok(!html.includes('toggle-circle'));
  assert.ok(html.includes('<div id="option-list"></div>'));
});

test('the toolbar starts with Options and the title, then the details, colour and theme buttons', () => {
  const html = read('html/main.html');
  const toolbar = /<header class="toolbar"[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';
  const order = ['data-action="toggle-options"', '<h1>', 'data-action="toggle-details"', 'data-action="toggle-colour"', 'data-action="toggle-theme"'];
  const positions = order.map((marker) => toolbar.indexOf(marker));
  assert.ok(positions.every((position) => position >= 0), positions.join());
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.ok(!html.includes('New progressions'));
});

test('Options is an icon-only button with the three-line symbol and an accessible name', () => {
  const html = read('html/main.html');
  assert.ok(html.includes('class="options-toggle" data-action="toggle-options" aria-controls="options" aria-label="Options"'));
  assert.ok(html.includes('<path d="M4 6h16M4 12h11M4 18h7"'));
});

test('the colour button shows a spiral of dots, not the options symbol', () => {
  const html = read('html/main.html');
  const colour = /<button[^>]*class="colour-toggle"[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';
  assert.equal(colour.split('<circle').length - 1, 7);
  assert.ok(!colour.includes('<path'));
});

test('the details button sits directly left of the colour button, in one group', () => {
  const html = read('html/main.html');
  const group = /<div class="view-toggles">[\s\S]*?<\/div>/.exec(html)?.[0] ?? '';
  assert.ok(group.indexOf('toggle-details') < group.indexOf('toggle-colour'));
  assert.ok(!group.includes('toggle-theme'));
});

test('Generate is a floating button after the main content, so it sits at the bottom right', () => {
  const html = read('html/main.html');
  const generate = html.indexOf('class="generate" data-action="reroll">Generate</button>');
  assert.ok(generate > html.indexOf('</main>'));
  assert.ok(generate < html.indexOf('</body>'));
  assert.ok(!html.slice(0, html.indexOf('</header>')).includes('Generate'));
});

test('the theme button shows a half-filled circle and is labelled for screen readers', () => {
  const html = read('html/main.html');
  assert.ok(html.includes('<circle cx="12" cy="12" r="9" fill="none"'));
  assert.ok(html.includes('<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'));
  assert.ok(html.includes('aria-label="Dark mode"'));
});

test('the colour and details buttons are symbol buttons that show both switches as pressed', () => {
  const html = read('html/main.html');
  assert.ok(html.includes('class="colour-toggle" data-action="toggle-colour" aria-label="Colours" aria-pressed="true"'));
  assert.ok(html.includes('class="details-toggle" data-action="toggle-details" aria-label="Extended information" aria-pressed="true"'));
  assert.equal(html.split('data-action="toggle-colour"').length - 1, 1);
  assert.equal(html.split('data-action="toggle-details"').length - 1, 1);
});

test('a click on the header, e.g. the title, toggles the options panel, like the options button', () => {
  const html = read('html/main.html');
  assert.ok(html.includes('<header class="toolbar" data-action="toggle-options">'));
});

test('the CDN versions in the import map match the dependencies in package.json', () => {
  const html = read('html/main.html');
  const importMap = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
  const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).dependencies;
  const names = Object.keys(manifest);
  assert.ok(names.length > 0);
  for (const name of names) {
    assert.ok(importMap[name], `${name} is in the import map`);
    assert.ok(importMap[name].includes(`${name}@${manifest[name]}/`), `${name} is ${manifest[name]} in the import map`);
  }
  assert.deepEqual(Object.keys(importMap).sort(), names.sort());
});
