import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const MANIFEST = JSON.parse(readFileSync(new URL('manifest.webmanifest', ROOT), 'utf8'));

/** The width and height of a PNG file, from its header. */
function pngSize(path) {
  const bytes = readFileSync(fileURLToPath(new URL(path, ROOT)));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} is a PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

test('the manifest names the app and opens it on its own, without the bars of the browser, from the folder of the page', () => {
  assert.equal(MANIFEST.name, 'Chordice');
  assert.equal(MANIFEST.short_name, 'Chordice');
  assert.equal(MANIFEST.display, 'standalone');
  assert.equal(MANIFEST.start_url, './');
  assert.equal(MANIFEST.scope, './');
});

test('the manifest takes the paper of the light theme, the default, for the app and its start screen', () => {
  const css = readFileSync(new URL('chordice/styles/main.css', ROOT), 'utf8');
  const light = /--bg:\s*(#[0-9a-f]{6})/.exec(css)[1];
  assert.equal(MANIFEST.background_color, light);
  assert.equal(MANIFEST.theme_color, light);
});

test('every icon of the manifest exists, and each PNG has the size the manifest gives it', () => {
  assert.ok(MANIFEST.icons.length >= 3);
  for (const icon of MANIFEST.icons) {
    assert.ok(existsSync(fileURLToPath(new URL(icon.src, ROOT))), icon.src);
    if (icon.type === 'image/png') {
      assert.equal(pngSize(icon.src), icon.sizes, icon.src);
    }
  }
  const sizes = MANIFEST.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), 'the two sizes Android asks for');
});

test('the icon of iPhones and iPads is a PNG of 180 by 180 pixels', () => {
  assert.equal(pngSize('icons/icon-180.png'), '180x180');
});

/** The groups of the eighth notes in the icon, each with its own markup. */
function eighthNotesOfIcon() {
  const svg = readFileSync(new URL('icons/icon.svg', ROOT), 'utf8');
  return [...svg.matchAll(/<g class="eighth-note"[^>]*>[\s\S]*?<\/g>/g)].map((match) => match[0]);
}

test('the icon is a die whose three pips are eighth notes: each with a head, a stem and a flag', () => {
  const notes = eighthNotesOfIcon();
  assert.equal(notes.length, 3);
  for (const note of notes) {
    for (const part of ['head', 'stem', 'flag']) {
      assert.ok(note.includes(`class="${part}"`), part);
    }
  }
});

test('the eighth notes of the icon sit on a diagonal from top left to bottom right, like the three pips of a die', () => {
  const positions = eighthNotesOfIcon().map((note) => /translate\((\d+) (\d+)\)/.exec(note).slice(1).map(Number));
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i][0] > positions[i - 1][0], 'further right');
    assert.ok(positions[i][1] > positions[i - 1][1], 'further down');
  }
});

test('the icon is painted in watercolour: a mottled wash, the face of the die left as paper with a rim of pigment, notes in ink, the grain of the paper', () => {
  const svg = readFileSync(new URL('icons/icon.svg', ROOT), 'utf8');
  const filters = Object.fromEntries([...svg.matchAll(/<filter id="([^"]+)"[\s\S]*?<\/filter>/g)].map((match) => [match[1], match[0]]));
  for (const id of ['mottle', 'brush', 'rim', 'ink', 'grain']) {
    assert.ok(filters[id]?.includes('<feTurbulence'), `the filter ${id} works with noise`);
    assert.ok(filters[id].includes('color-interpolation-filters="sRGB"'), `the filter ${id} mixes its colours as written`);
    assert.ok(svg.includes(`filter="url(#${id})"`), `the filter ${id} is used`);
  }
  for (const id of ['brush', 'rim', 'ink']) {
    assert.ok(filters[id].includes('<feDisplacementMap'), `the edges of ${id} are uneven`);
  }
  assert.ok(svg.indexOf('class="rim"') < svg.indexOf('class="face"'), 'the rim lies under the face of the die');
  assert.match(svg, /<g class="notes" filter="url\(#ink\)"[^>]*>\s*<g class="eighth-note"/, 'the notes are painted in ink');
  assert.ok(svg.lastIndexOf('filter="url(#grain)"') > svg.lastIndexOf('class="eighth-note"'), 'the grain lies over all');
});

test('the icon uses no <use> references, so that every renderer draws all three notes', () => {
  assert.ok(!readFileSync(new URL('icons/icon.svg', ROOT), 'utf8').includes('<use'));
});
