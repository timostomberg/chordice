/**
 * The background behind the app: the colour of the song's painting at once, and the painting (see painting.js, painted
 * by watercolour.js) fading in over it once it is painted. Its seed is made from the seeds of the song, so the same song
 * always shows the same picture, and Generate (a new song) a new one. The grain of the paper lies over it all, from the
 * stylesheet.
 *
 * Painting never holds up the chords: a new song shows its chords and its colour in the same frame, and the painting is
 * painted afterwards in a worker (painter.js), off the page, or on the page in a browser that cannot paint in a worker.
 * It is painted only as large as it needs to be: at most at the screen's pixels, and within a budget of pixels, as a
 * watercolour needs no more and the grain over it stays sharp. When the song, the theme or the painting switch changes
 * before the painting is done, it is dropped and the new background starts at once. The last few paintings are kept, so
 * switching the theme back and forth shows them at once. When the screen turns (its shape changes), the painting is
 * painted anew in its shape and fades in over the old one.
 */

import { colourOf, paintingOf } from './painting.js';
import { paintOnto } from './watercolour.js';
import { SEED_NAMES, unit } from '../../music/generator/random.js';

/** The seed of the painting of a song: all the seeds of the song (see random.js) mixed into one whole number. */
export function paintingSeedOf(seeds) {
  return SEED_NAMES.reduce((mixed, name, index) => Math.floor(unit(mixed ^ (seeds?.[name] ?? 0), index) * 4294967296) | 0, 0);
}

/** The most pixels a painting is painted with: about an iPhone's screen at twice its points, or an iPad's at its points. */
export const PIXEL_BUDGET = 700000;

/**
 * The pixels of the canvas a painting is painted on for a screen of `width` × `height` points with `ratio` pixels to a
 * point: the screen's shape, at its pixels at most, and within the budget.
 */
export function canvasSizeOf({ width, height, ratio = 1 }) {
  const scale = Math.min(ratio, Math.sqrt(PIXEL_BUDGET / Math.max(1, width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Paints a painting on the page: returns a canvas of the document with it. */
export function paintOnPage(document) {
  return ({ seed, theme, width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paintOnto(canvas.getContext('2d'), paintingOf(seed, theme), width, height);
    return canvas;
  };
}

/** A worker that paints (painter.js), or null in a browser that cannot paint in a worker. */
function painterWorker() {
  if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function') {
    return null;
  }
  return new Worker(new URL('./painter.js', import.meta.url), { type: 'module' });
}

/**
 * The painter of the page: paint({ seed, theme, width, height }) returns the promise of the painting, as an ImageBitmap
 * from the worker or a canvas painted on the page, or of null when a newer painting dropped it. Only the latest painting
 * is wanted: a new one stops the worker painting the old one. When the worker cannot paint (it cannot be started, fails
 * to load or reports an error), the paintings are painted on the page from then on.
 */
export function createPainter(document, { createWorker = painterWorker, onPage = paintOnPage(document) } = {}) {
  let worker = null;
  let onWorker = true;
  let waiting = null;
  let count = 0;

  function stop() {
    worker?.terminate();
    worker = null;
    waiting?.resolve(null);
    waiting = null;
  }

  function fallBack() {
    const { job, resolve, reject } = waiting;
    waiting = null;
    stop();
    onWorker = false;
    try {
      resolve(onPage(job));
    } catch (error) {
      reject(error);
    }
  }

  function start() {
    try {
      worker = createWorker();
    } catch {
      worker = null;
    }
    if (!worker) {
      onWorker = false;
      return;
    }
    worker.onmessage = ({ data }) => {
      if (data.id !== waiting?.id) {
        return;
      }
      if (data.error !== undefined) {
        fallBack();
        return;
      }
      waiting.resolve(data.bitmap);
      waiting = null;
    };
    worker.onerror = (event) => {
      event?.preventDefault?.();
      if (waiting) {
        fallBack();
      } else {
        stop();
        onWorker = false;
      }
    };
  }

  return (job) => {
    if (waiting) {
      stop();
    }
    if (onWorker && !worker) {
      start();
    }
    if (!onWorker) {
      return Promise.resolve().then(() => onPage(job));
    }
    count += 1;
    return new Promise((resolve, reject) => {
      waiting = { id: count, job, resolve, reject };
      worker.postMessage({ id: count, ...job });
    });
  };
}

/** Waits until the browser has painted the next frame, so what the page shows now is on the screen first. */
const afterNextPaint = () => new Promise((resolve) => {
  requestAnimationFrame(() => setTimeout(resolve, 0));
});

const delay = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

// The paintings kept, so switching back to one of them shows it at once.
const KEPT = 4;
// How long a painting fades in (see background.css), before the one under it is taken away.
const FADE = 1100;
// How long the screen must keep its new size before the painting is painted anew for it.
const SETTLE = 300;

/**
 * The background in its element. show(seeds, theme, { plain }) shows the colour of the song's painting at once and starts
 * painting the painting, unless `plain` (the painting switch is off) or the background already shows (or is painting) it;
 * it returns whether it started anew. A painting still being painted is dropped. painted() is the promise of the latest
 * painting: whether it was shown (false when it was dropped, could not be painted, or there was none to paint).
 *
 * `nextFrame` waits for the browser's next painted frame, `paint` paints a painting (see createPainter), `viewport` gives
 * the size of the screen ({ width, height, ratio }) and `wait` waits a while; all of them can be replaced in tests.
 */
export function createBackground(element, {
  nextFrame = afterNextPaint,
  paint = createPainter(element.ownerDocument),
  viewport = () => {
    const view = element.ownerDocument.defaultView;
    return { width: element.clientWidth || view.innerWidth, height: element.clientHeight || view.innerHeight, ratio: view.devicePixelRatio || 1 };
  },
  wait = delay,
} = {}) {
  const document = element.ownerDocument;
  let shown = null;
  // The number of the latest painting; a painting of an earlier one is dropped.
  let latest = 0;
  let pending = Promise.resolve(false);
  // The size of the canvas of the painting on the screen, or being painted for it.
  let size = null;
  const kept = new Map();

  /** A painting as a canvas to show: the canvas painted on the page, or a canvas showing the worker's bitmap. */
  function canvasOf(image) {
    if (image.nodeName === 'CANVAS') {
      return image;
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const bitmaps = canvas.getContext('bitmaprenderer');
    if (bitmaps) {
      bitmaps.transferFromImageBitmap(image);
    } else {
      canvas.getContext('2d').drawImage(image, 0, 0);
      image.close?.();
    }
    return canvas;
  }

  function keep(key, canvas) {
    kept.delete(key);
    kept.set(key, canvas);
    if (kept.size > KEPT) {
      kept.delete(kept.keys().next().value);
    }
  }

  async function paintIn({ seed, theme }, current) {
    const isCurrent = () => current === latest;
    try {
      // The chords and the colour are on the screen first.
      await nextFrame();
      if (!isCurrent()) {
        return false;
      }
      size = canvasSizeOf(viewport());
      const key = `${seed}:${theme}:${size.width}x${size.height}`;
      let canvas = kept.get(key);
      if (!canvas) {
        const image = await paint({ seed, theme, ...size });
        if (!image || !isCurrent()) {
          return false;
        }
        canvas = canvasOf(image);
      }
      keep(key, canvas);
      canvas.classList.add('background-painting');
      canvas.classList.remove('shown');
      const under = [...element.children].filter((child) => child !== canvas);
      element.append(canvas);
      // In the next frame the painting starts to fade in (see background.css) from where it was added, transparent.
      await nextFrame();
      if (!isCurrent()) {
        return false;
      }
      canvas.classList.add('shown');
      if (under.length > 0) {
        await wait(FADE);
        under.forEach((old) => old.remove());
      }
      return true;
    } catch (error) {
      // The colour stays in place of a painting that cannot be painted.
      console.error(`Chordice could not paint the painting: ${error?.message ?? error}`);
      return false;
    }
  }

  // A screen that turns, or a window much resized, gets the painting anew in its shape, once its size has settled.
  let resizes = 0;
  document.defaultView?.addEventListener('resize', async () => {
    const resize = ++resizes;
    await wait(SETTLE);
    if (resize !== resizes || !shown || shown.plain || !size) {
      return;
    }
    const next = canvasSizeOf(viewport());
    const shape = (next.width / next.height) / (size.width / size.height);
    if (shape > 0.9 && shape < 1.1 && next.width * next.height < 1.3 * size.width * size.height) {
      return;
    }
    latest += 1;
    pending = paintIn(shown, latest);
  });

  return {
    show(seeds, theme, { plain = false } = {}) {
      const seed = paintingSeedOf(seeds);
      if (shown && shown.seed === seed && shown.theme === theme && shown.plain === plain) {
        return false;
      }
      shown = { seed, theme, plain };
      latest += 1;
      element.style.backgroundColor = colourOf(seed, theme);
      element.classList.toggle('plain', plain);
      element.replaceChildren();
      size = null;
      pending = plain ? Promise.resolve(false) : paintIn(shown, latest);
      return true;
    },
    painted: () => pending,
  };
}
