/**
 * The painter: a worker that paints the painting of a seed off the page, so the page never waits for it. It is asked
 * with { id, seed, theme, width, height } and answers { id, bitmap } with the painting on a canvas of that many pixels
 * (see watercolour.js), or { id, error } when it cannot paint it, e.g. in a browser without a 2D canvas in a worker.
 */

import { paintingOf } from './painting.js';
import { paintOnto } from './watercolour.js';

self.onmessage = ({ data: { id, seed, theme, width, height } }) => {
  try {
    const canvas = new OffscreenCanvas(width, height);
    paintOnto(canvas.getContext('2d'), paintingOf(seed, theme), width, height);
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({ id, bitmap }, [bitmap]);
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
};
