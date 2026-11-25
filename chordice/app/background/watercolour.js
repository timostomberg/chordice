/**
 * Paints a painting (see painting.js) in watercolour on a canvas: the same drawing on the page and in a worker (see
 * painter.js), on any 2D context.
 *
 * A wash is painted as many thin, translucent layers of its polygon, each with its edge deformed a little differently
 * (by repeated random midpoint displacement). Where all the layers overlap, at the heart of the wash, the pigment is
 * dense; towards its edge fewer layers reach, so the edge runs soft and uneven into the paper, as a wash does on wet paper.
 * A glow is a soft radial gradient.
 *
 * It is made to be cheap: the painting is drawn only where the screen shows it, at the size of the canvas (not of the
 * screen's every pixel); the edges are deformed only as finely as a pixel of the canvas can show, and only where they lie
 * on the canvas. The grain of the paper is not painted here but laid over the canvas by the stylesheet, sharp at any size.
 */

import { HEIGHT, WIDTH, dice, rgbOf } from './painting.js';
import { unit } from '../../music/generator/random.js';

// The layers of a wash: in batches, each batch from its own variation of the wash's shape, so the edge has depth.
const BATCHES = 3;
const LAYERS_PER_BATCH = 7;
const LAYERS = BATCHES * LAYERS_PER_BATCH;
// The longest edge of a wash before it is deformed, in units of the painting, from a crisp wash (spread 0) to a wet one
// (spread 1): longer edges let it run further.
const SEGMENT = [24, 110];
// How far a midpoint moves, relative to the length of its edge.
const WANDER = 0.32;
// The finest edge worth deforming, in pixels of the canvas.
const FINEST = 2.5;
// How far a wash can run beyond its polygon, in units of the painting: it is painted if it reaches into the view.
const REACH = 120;

/** A colour written as hsl(h s% l%), as painting.js writes them, as rgba with an opacity. */
export function rgbaOf(colour, alpha) {
  const [r, g, b] = rgbOf(colour).map(Math.round);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
}

/**
 * Where the painting lies on a canvas of `width` × `height` pixels: scaled to cover it from its bottom middle (as the
 * screen shows it), and the part of the painting the canvas shows, in units of the painting.
 */
export function viewOf(width, height) {
  const scale = Math.max(width / WIDTH, height / HEIGHT);
  const x = (width - WIDTH * scale) / 2;
  const y = height - HEIGHT * scale;
  return { scale, x, y, left: (0 - x) / scale, top: (0 - y) / scale, right: (width - x) / scale, bottom: (height - y) / scale };
}

/** Whether a point lies on the canvas of the painting, where its edge can show. */
const onCanvas = (x, y) => x >= 0 && x <= WIDTH && y >= 0 && y <= HEIGHT;

/**
 * The polygon of a wash ready to be deformed, as flat coordinates [x0, y0, x1, y1, …] and a variance for each point:
 * every edge cut into pieces no longer than `segment`. A point varies by its own spread (its third number) or else by the
 * spread of the wash. Points off the canvas do not move, so no work goes into edges that are never seen.
 */
function prepared(points, spread, segment) {
  const coords = [];
  const variances = [];
  points.forEach(([x, y, own = spread], index) => {
    const [nx, ny, nextOwn = spread] = points[(index + 1) % points.length];
    const pieces = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / segment));
    for (let piece = 0; piece < pieces; piece += 1) {
      const t = piece / pieces;
      const [px, py] = [x + (nx - x) * t, y + (ny - y) * t];
      coords.push(px, py);
      variances.push(onCanvas(px, py) ? own + (nextOwn - own) * t : 0);
    }
  });
  return { coords, variances };
}

/**
 * The polygon deformed `rounds` times: each round puts a new point near the middle of every edge, moved at random by up
 * to about `WANDER` times the edge's length times the variance of its ends, and gives it a variance of its own near
 * theirs. Edges shorter than `finest` stay as they are.
 */
export function deformed({ coords, variances }, rounds, d, finest) {
  for (let round = 0; round < rounds; round += 1) {
    const nextCoords = [];
    const nextVariances = [];
    const count = variances.length;
    for (let index = 0; index < count; index += 1) {
      const [x, y, variance] = [coords[2 * index], coords[2 * index + 1], variances[index]];
      const after = (index + 1) % count;
      const [nx, ny] = [coords[2 * after], coords[2 * after + 1]];
      nextCoords.push(x, y);
      nextVariances.push(variance);
      const mean = (variance + variances[after]) / 2;
      const length = Math.hypot(nx - x, ny - y);
      if (mean > 0 && length > finest) {
        const wander = length * WANDER * mean;
        nextCoords.push((x + nx) / 2 + d.gauss() * wander, (y + ny) / 2 + d.gauss() * wander);
        nextVariances.push(mean * d.between(0.7, 1.3));
      }
    }
    coords = nextCoords;
    variances = nextVariances;
  }
  return { coords, variances };
}

/** Traces a polygon of flat coordinates as the path of a context. */
function trace(context, coords) {
  context.beginPath();
  context.moveTo(coords[0], coords[1]);
  for (let index = 2; index < coords.length; index += 2) {
    context.lineTo(coords[index], coords[index + 1]);
  }
  context.closePath();
}

/** Whether a shape can reach into the view. */
function inView(shape, view) {
  if (shape.type === 'glow') {
    return shape.cx + shape.rx > view.left && shape.cx - shape.rx < view.right && shape.cy + shape.ry > view.top && shape.cy - shape.ry < view.bottom;
  }
  const xs = shape.points.map(([x]) => x);
  const ys = shape.points.map(([, y]) => y);
  return Math.max(...xs) + REACH > view.left && Math.min(...xs) - REACH < view.right
    && Math.max(...ys) + REACH > view.top && Math.min(...ys) - REACH < view.bottom;
}

/**
 * A wash, in its layers. Every layer runs from the wash's polygon on its own way, in a batch that shares its first,
 * broadest variation. `d` are the random numbers of this wash, `finest` the finest edge to deform.
 */
function paintWash(context, shape, d, finest) {
  const polygon = prepared(shape.points, shape.spread, SEGMENT[0] + (SEGMENT[1] - SEGMENT[0]) * shape.spread);
  // Each layer lays so much pigment that all of them together reach the opacity of the wash.
  context.fillStyle = rgbaOf(shape.fill, 1 - (1 - shape.opacity) ** (1 / LAYERS));
  for (let batch = 0; batch < BATCHES; batch += 1) {
    const variation = deformed(polygon, 1, d, finest);
    for (let layer = 0; layer < LAYERS_PER_BATCH; layer += 1) {
      trace(context, deformed(variation, 3, d, finest).coords);
      context.fill();
    }
  }
}

/** A glow: an ellipse fading out from its middle. */
function paintGlow(context, shape) {
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, rgbaOf(shape.fill, shape.opacity));
  gradient.addColorStop(0.3, rgbaOf(shape.fill, shape.opacity * 0.75));
  gradient.addColorStop(1, rgbaOf(shape.fill, 0));
  context.save();
  context.translate(shape.cx, shape.cy);
  context.scale(shape.rx, shape.ry);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, 1, 0, 2 * Math.PI);
  context.fill();
  context.restore();
}

/**
 * Paints the painting on a 2D context of a canvas of `width` × `height` pixels, covering it from its bottom middle: its
 * colour, its sky and its shapes, back to front. The way each wash runs follows from the painting's brush and the wash's
 * place in it, so the same painting always looks the same, whatever part of it the canvas shows.
 */
export function paintOnto(context, painting, width, height) {
  const view = viewOf(width, height);
  context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
  const [left, top, across, down] = [view.left - 1, view.top - 1, view.right - view.left + 2, view.bottom - view.top + 2];
  context.fillStyle = painting.colour;
  context.fillRect(left, top, across, down);
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, rgbaOf(painting.sky.top, 1));
  sky.addColorStop(0.8, rgbaOf(painting.sky.bottom, 1));
  context.fillStyle = sky;
  context.fillRect(left, top, across, down);
  const finest = FINEST / view.scale;
  painting.shapes.forEach((shape, index) => {
    if (!inView(shape, view)) {
      return;
    }
    if (shape.type === 'glow') {
      paintGlow(context, shape);
    } else {
      paintWash(context, shape, dice(Math.floor(unit(painting.brush, index) * 4294967296) | 0), finest);
    }
  });
}
