import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { landscapeMarkup, paintingSeedOf, renderLandscape } from '../../../../chordice/app/landscape/landscape.js';
import { SEED_NAMES, createSeeds } from '../../../../chordice/music/generator/random.js';
import { meanColourOf, paintingOf } from '../../../../chordice/app/landscape/scene.js';

function landscapeElement() {
  const { document } = new JSDOM('<!DOCTYPE html><body><svg id="landscape" class="landscape" viewBox="0 0 1600 1000"></svg></body>').window;
  return document.getElementById('landscape');
}

test('the markup holds the sky, every shape of the painting and the paper grain over all', () => {
  const painting = paintingOf(42, 'light');
  const svg = landscapeElement();
  svg.innerHTML = landscapeMarkup(painting);
  assert.equal(svg.querySelector('.landscape-scene').dataset.kind, painting.kind);
  // The sky rectangle and the shapes, in the order of the painting.
  const drawn = [...svg.querySelector('.landscape-scene').children];
  assert.equal(drawn.length, painting.shapes.length + 1);
  assert.equal(drawn[0].getAttribute('fill'), 'url(#landscape-sky)');
  painting.shapes.forEach((shape, index) => {
    assert.equal(drawn[index + 1].tagName.toLowerCase(), shape.tag);
    assert.equal(drawn[index + 1].getAttribute('fill'), shape.fill);
  });
  // The paper lies over the painting, as the last element.
  assert.ok(svg.lastElementChild.classList.contains('landscape-paper'));
  assert.equal(svg.querySelector('linearGradient stop').getAttribute('stop-color'), painting.sky.top);
});

test('every filter a shape refers to is defined, and the edged washes have their pigment rim', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const painting = paintingOf(seed, 'dark');
    const svg = landscapeElement();
    svg.innerHTML = landscapeMarkup(painting);
    const ids = new Set([...svg.querySelectorAll('filter')].map((filter) => filter.id));
    for (const element of svg.querySelectorAll('[filter]')) {
      const id = /^url\(#([\w-]+)\)$/.exec(element.getAttribute('filter'))[1];
      assert.ok(ids.has(id), id);
    }
    assert.equal(svg.querySelectorAll('.landscape-edge').length, painting.shapes.filter((shape) => shape.edge).length);
  }
});

test('the noise of the watercolour follows the seeds of the painting', () => {
  const painting = paintingOf(99, 'light');
  const markup = landscapeMarkup(painting);
  for (const seed of Object.values(painting.textures)) {
    assert.ok(markup.includes(`seed="${seed}"`), `seed ${seed}`);
  }
});

/** The seeds of a song, as Generate rolls them, from a fixed sequence of random numbers. */
function songSeeds(start) {
  let value = start;
  return createSeeds(() => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  });
}

test('the painting of a song is made from all the seeds of the song: the same song gives the same picture', () => {
  const seeds = songSeeds(1);
  assert.equal(paintingSeedOf(seeds), paintingSeedOf({ ...seeds }));
  assert.ok(Number.isInteger(paintingSeedOf(seeds)));
  // Every seed of the song counts, so another song (a Generate) has another painting.
  for (const name of SEED_NAMES) {
    assert.notEqual(paintingSeedOf({ ...seeds, [name]: seeds[name] + 1 }), paintingSeedOf(seeds), name);
  }
  assert.notEqual(paintingSeedOf(songSeeds(2)), paintingSeedOf(seeds));
});

test('renderLandscape paints only when the song or the theme changes', () => {
  const svg = landscapeElement();
  const song = songSeeds(3);
  assert.equal(renderLandscape(svg, song, 'dark'), true);
  const first = svg.querySelector('.landscape-scene');
  assert.equal(renderLandscape(svg, { ...song }, 'dark'), false, 'the same song is not painted again');
  assert.equal(svg.querySelector('.landscape-scene'), first);
  assert.equal(renderLandscape(svg, song, 'light'), true, 'another theme repaints');
  assert.equal(svg.querySelector('.landscape-scene').dataset.kind, first.dataset.kind, 'the motif stays');
  assert.equal(renderLandscape(svg, songSeeds(4), 'light'), true, 'a new song (Generate) paints a new picture');
});

test('the same song shows the same picture again, e.g. after a reload from the cookie', () => {
  const [one, two] = [landscapeElement(), landscapeElement()];
  renderLandscape(one, songSeeds(5), 'light');
  renderLandscape(two, songSeeds(5), 'light');
  assert.equal(one.innerHTML, two.innerHTML);
});

test('with the painting switch off, the background is plain: the mean colour of the painting, on the same paper', () => {
  const painting = paintingOf(17, 'light');
  const svg = landscapeElement();
  svg.innerHTML = landscapeMarkup(painting, { plain: true });
  const scene = svg.querySelector('.landscape-scene');
  assert.equal(scene.children.length, 1, 'one plain rectangle, no shapes');
  assert.equal(scene.firstElementChild.getAttribute('fill'), meanColourOf(painting));
  assert.ok(scene.hasAttribute('data-plain'));
  assert.ok(svg.lastElementChild.classList.contains('landscape-paper'), 'the paper grain stays');
});

test('renderLandscape switches between the painting and the plain background of the same song', () => {
  const svg = landscapeElement();
  const song = songSeeds(8);
  renderLandscape(svg, song, 'light');
  assert.equal(renderLandscape(svg, song, 'light', { plain: true }), true);
  assert.ok(svg.querySelector('.landscape-scene').hasAttribute('data-plain'));
  assert.equal(renderLandscape(svg, song, 'light', { plain: true }), false, 'not painted again');
  assert.equal(renderLandscape(svg, song, 'light', { plain: false }), true);
  assert.ok(!svg.querySelector('.landscape-scene').hasAttribute('data-plain'));
});
