import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  PIXEL_BUDGET, canvasSizeOf, createBackground, createPainter, paintingSeedOf,
} from '../../../../chordice/app/background/background.js';
import { SEED_NAMES, createSeeds } from '../../../../chordice/music/generator/random.js';
import { colourOf } from '../../../../chordice/app/background/painting.js';

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

test('a painting is painted in the shape of the screen, at its pixels at most and within the budget', () => {
  // A small window: at its pixels.
  assert.deepEqual(canvasSizeOf({ width: 400, height: 300, ratio: 2 }), { width: 800, height: 600 });
  assert.deepEqual(canvasSizeOf({ width: 400, height: 300 }), { width: 400, height: 300 });
  // An iPhone (3 pixels to a point) and an iPad: fewer pixels than the screen has, in its shape.
  for (const screen of [{ width: 393, height: 852, ratio: 3 }, { width: 1366, height: 1024, ratio: 2 }]) {
    const size = canvasSizeOf(screen);
    assert.ok(size.width * size.height <= PIXEL_BUDGET * 1.01, `${size.width} × ${size.height}`);
    assert.ok(Math.abs(size.width / size.height - screen.width / screen.height) < 0.01, 'the shape of the screen');
  }
  assert.deepEqual(canvasSizeOf({ width: 0, height: 0 }), { width: 1, height: 1 });
});

/**
 * A background in a page of jsdom, whose frames, paintings and waits the test steps through by hand: frame() lets the
 * browser paint the next frame, finish() finishes the oldest painting waiting (or fails it with `error`), elapse() ends
 * every wait. The screen has the size `screen` (changeable).
 */
function steppedBackground() {
  const { window } = new JSDOM('<!DOCTYPE html><body><div id="background" class="background"></div></body>');
  const { document } = window;
  const element = document.getElementById('background');
  const frames = [];
  const jobs = [];
  const waits = [];
  const screen = { width: 800, height: 600, ratio: 1 };
  const background = createBackground(element, {
    nextFrame: () => new Promise((resolve) => frames.push(resolve)),
    paint: (job) => new Promise((resolve, reject) => jobs.push({ job, resolve, reject })),
    viewport: () => ({ ...screen }),
    wait: () => new Promise((resolve) => waits.push(resolve)),
  });
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return {
    window,
    element,
    background,
    jobs,
    screen,
    async frame() {
      frames.splice(0).forEach((resolve) => resolve());
      await settle();
    },
    async finish(error) {
      const { resolve, reject } = jobs.shift();
      if (error) {
        reject(error);
      } else {
        resolve(document.createElement('canvas'));
      }
      await settle();
    },
    async elapse() {
      waits.splice(0).forEach((resolve) => resolve());
      await settle();
    },
  };
}

const paintingsIn = (element) => [...element.querySelectorAll('canvas.background-painting')];
const paintingIn = (element) => paintingsIn(element)[0] ?? null;

test('the colour of the painting shows at once; the painting is painted after the next frame and then fades in', async () => {
  const page = steppedBackground();
  const seeds = songSeeds(3);
  assert.equal(page.background.show(seeds, 'light'), true);
  // At once: the colour, and no painting yet.
  assert.ok(page.element.style.backgroundColor !== '', 'the colour is set');
  assert.equal(paintingIn(page.element), null);
  assert.equal(page.jobs.length, 0, 'nothing is painted before the chords and the colour are on the screen');
  await page.frame();
  assert.equal(page.jobs.length, 1, 'then the painting is painted');
  assert.deepEqual(page.jobs[0].job, { seed: paintingSeedOf(seeds), theme: 'light', width: 800, height: 600 });
  assert.equal(paintingIn(page.element), null, 'it is not shown while it is painted');
  await page.finish();
  const canvas = paintingIn(page.element);
  assert.ok(canvas, 'once painted, it is added');
  assert.ok(!canvas.classList.contains('shown'), 'transparent at first');
  await page.frame();
  assert.ok(canvas.classList.contains('shown'), 'and fades in in the next frame');
  assert.equal(await page.background.painted(), true);
});

test('the colour is the colour of the painting of the song, in the theme', () => {
  const page = steppedBackground();
  const seeds = songSeeds(4);
  const { document } = new JSDOM('').window;
  for (const theme of ['light', 'dark']) {
    page.background.show(seeds, theme);
    const expected = document.createElement('div');
    expected.style.backgroundColor = colourOf(paintingSeedOf(seeds), theme);
    assert.equal(page.element.style.backgroundColor, expected.style.backgroundColor, theme);
  }
});

test('the background is shown anew only when the song, the theme or the painting switch changes', async () => {
  const page = steppedBackground();
  const song = songSeeds(5);
  assert.equal(page.background.show(song, 'dark'), true);
  assert.equal(page.background.show({ ...song }, 'dark'), false, 'the same song is not painted again');
  await page.frame();
  await page.finish();
  const first = paintingIn(page.element);
  assert.equal(page.background.show(song, 'dark'), false);
  assert.equal(paintingIn(page.element), first, 'the painting stays');
  assert.equal(page.background.show(song, 'light'), true, 'another theme repaints');
  assert.equal(page.background.show(songSeeds(6), 'light'), true, 'a new song (Generate) paints a new picture');
  assert.equal(page.background.show(songSeeds(6), 'light', { plain: true }), true, 'the painting switch off');
  assert.equal(page.background.show(songSeeds(6), 'light', { plain: true }), false);
});

test('switching back to a painting shown a moment ago shows it at once, without painting it again', async () => {
  const page = steppedBackground();
  const song = songSeeds(15);
  page.background.show(song, 'light');
  await page.frame();
  await page.finish();
  await page.frame();
  const light = paintingIn(page.element);
  page.background.show(song, 'dark');
  await page.frame();
  await page.finish();
  await page.frame();
  page.background.show(song, 'light');
  await page.frame();
  assert.equal(page.jobs.length, 0, 'nothing to paint');
  assert.equal(paintingIn(page.element), light);
  assert.ok(!light.classList.contains('shown'), 'it fades in again');
  await page.frame();
  assert.equal(await page.background.painted(), true);
});

test('Generate while a painting is painted drops it: the new colour shows at once, the old painting never', async () => {
  const page = steppedBackground();
  const first = songSeeds(7);
  const second = songSeeds(8);
  page.background.show(first, 'light');
  await page.frame();
  const dropped = page.background.painted();
  // A second Generate, while the first painting is still being painted.
  page.background.show(second, 'light');
  const colour = page.element.style.backgroundColor;
  await page.finish();
  assert.equal(await dropped, false, 'the first painting is dropped');
  assert.equal(paintingIn(page.element), null, 'and never shown');
  assert.equal(page.element.style.backgroundColor, colour, 'the colour of the new song stays');
  await page.frame();
  assert.equal(page.jobs.at(-1).job.seed, paintingSeedOf(second));
  await page.finish();
  await page.frame();
  assert.equal(await page.background.painted(), true);
  assert.equal(paintingsIn(page.element).length, 1, 'only the new painting is shown');
});

test('Generate before the first frame drops the painting before it is painted at all', async () => {
  const page = steppedBackground();
  page.background.show(songSeeds(9), 'light');
  const dropped = page.background.painted();
  page.background.show(songSeeds(10), 'light');
  await page.frame();
  assert.equal(await dropped, false);
  assert.equal(page.jobs.length, 1, 'only the new painting is painted');
});

test('Generate drops a painting already shown: the new colour takes its place at once', async () => {
  const page = steppedBackground();
  page.background.show(songSeeds(11), 'light');
  await page.frame();
  await page.finish();
  await page.frame();
  assert.ok(paintingIn(page.element));
  page.background.show(songSeeds(12), 'light');
  assert.equal(paintingIn(page.element), null);
});

test('with the painting switch off, the background is plain: only the colour of the painting, nothing is painted', async () => {
  const page = steppedBackground();
  const song = songSeeds(13);
  page.background.show(song, 'light');
  await page.frame();
  await page.finish();
  assert.ok(!page.element.classList.contains('plain'), 'the paper has its grain');
  const colour = page.element.style.backgroundColor;
  page.background.show(song, 'light', { plain: true });
  assert.equal(paintingIn(page.element), null);
  assert.ok(page.element.classList.contains('plain'), 'a plain background, without the grain of the paper');
  assert.equal(page.element.style.backgroundColor, colour, 'the same colour as under the painting');
  await page.frame();
  assert.equal(page.jobs.length, 0);
  assert.equal(await page.background.painted(), false);
  // On again: the painting of the same song is shown again.
  page.background.show(song, 'light');
  assert.ok(!page.element.classList.contains('plain'));
  await page.frame();
  assert.ok(paintingIn(page.element));
});

test('a painting that cannot be painted leaves its colour in place', async (t) => {
  t.mock.method(console, 'error', () => {});
  const page = steppedBackground();
  page.background.show(songSeeds(14), 'dark');
  await page.frame();
  await page.finish(new Error('no canvas here'));
  assert.equal(await page.background.painted(), false);
  assert.equal(paintingIn(page.element), null);
  assert.ok(page.element.style.backgroundColor !== '');
  assert.equal(console.error.mock.callCount(), 1);
});

test('when the screen turns, the painting is painted anew in its shape and fades in over the old one', async () => {
  const page = steppedBackground();
  page.background.show(songSeeds(16), 'light');
  await page.frame();
  await page.finish();
  await page.frame();
  const old = paintingIn(page.element);
  // A small change of size (e.g. a toolbar that hides) keeps the painting.
  page.screen.height = 640;
  page.window.dispatchEvent(new page.window.Event('resize'));
  await page.elapse();
  await page.frame();
  assert.equal(page.jobs.length, 0);
  // The screen turns.
  Object.assign(page.screen, { width: 600, height: 800 });
  page.window.dispatchEvent(new page.window.Event('resize'));
  page.window.dispatchEvent(new page.window.Event('resize'));
  await page.elapse();
  await page.frame();
  assert.equal(page.jobs.length, 1, 'painted once, when the size has settled');
  assert.deepEqual([page.jobs[0].job.width, page.jobs[0].job.height], [600, 800]);
  await page.finish();
  await page.frame();
  const turned = paintingsIn(page.element);
  assert.equal(turned.length, 2, 'the new painting over the old one while it fades in');
  assert.equal(turned[0], old);
  await page.elapse();
  assert.deepEqual(paintingsIn(page.element), [turned[1]], 'then the old one is taken away');
  assert.equal(await page.background.painted(), true);
});

/** A worker in a test: it records the messages posted to it, and the test answers them. */
function fakeWorker() {
  const worker = {
    posted: [],
    terminated: false,
    postMessage: (message) => worker.posted.push(message),
    terminate: () => {
      worker.terminated = true;
    },
    answer: (data) => worker.onmessage({ data }),
  };
  return worker;
}

test('the painter paints in a worker; a new painting stops the worker painting the old one', async () => {
  const workers = [];
  const paint = createPainter(null, { createWorker: () => workers[workers.push(fakeWorker()) - 1], onPage: () => assert.fail('not on the page') });
  const job = { seed: 1, theme: 'light', width: 10, height: 20 };
  const first = paint(job);
  assert.equal(workers.length, 1);
  assert.deepEqual(workers[0].posted, [{ id: 1, ...job }]);
  const second = paint({ ...job, seed: 2 });
  assert.equal(await first, null, 'the old painting is dropped');
  assert.ok(workers[0].terminated, 'and its worker stopped');
  assert.equal(workers.length, 2);
  const bitmap = { width: 10, height: 20 };
  workers[1].answer({ id: 1, bitmap: 'stale' });
  workers[1].answer({ id: 2, bitmap });
  assert.equal(await second, bitmap);
  // The worker stays for the next painting.
  paint(job);
  assert.equal(workers.length, 2);
});

test('the painter paints on the page where it cannot paint in a worker, from then on', async () => {
  const onPage = (job) => ({ painted: job.seed });
  assert.deepEqual(await createPainter(null, { createWorker: () => null, onPage })({ seed: 3 }), { painted: 3 });
  // The worker reports that it cannot paint (e.g. no 2D canvas in a worker).
  let workers = 0;
  const reporting = fakeWorker();
  const paint = createPainter(null, { createWorker: () => (workers += 1, reporting), onPage });
  const failed = paint({ seed: 4 });
  reporting.answer({ id: 1, error: 'no 2D context' });
  assert.deepEqual(await failed, { painted: 4 });
  assert.deepEqual(await paint({ seed: 5 }), { painted: 5 });
  assert.equal(workers, 1, 'no worker is started again');
  // The worker cannot be loaded at all.
  const broken = fakeWorker();
  const loading = createPainter(null, { createWorker: () => broken, onPage })({ seed: 6 });
  broken.onerror({ preventDefault() {} });
  assert.deepEqual(await loading, { painted: 6 });
});
