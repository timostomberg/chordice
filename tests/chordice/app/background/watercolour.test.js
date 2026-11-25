import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEIGHT, WIDTH, dice, paintingOf } from '../../../../chordice/app/background/painting.js';
import { deformed, paintOnto, rgbaOf, viewOf } from '../../../../chordice/app/background/watercolour.js';

/**
 * A 2D context that records what is painted: every call with its arguments, and the fill style at every fill. Paths
 * are kept as lists of points in the units of the painting (the transform is the one set before).
 */
function recordingContext() {
  const calls = [];
  const paths = [];
  let path = null;
  const gradient = () => ({ stops: [], addColorStop(offset, colour) { this.stops.push([offset, colour]); } });
  const context = {
    calls,
    paths,
    fillStyle: null,
    strokeStyle: null,
    setTransform: (...args) => calls.push(['setTransform', ...args]),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    createLinearGradient: () => gradient(),
    createRadialGradient: () => gradient(),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    translate: (...args) => calls.push(['translate', ...args]),
    scale: (...args) => calls.push(['scale', ...args]),
    arc: (...args) => calls.push(['arc', ...args]),
    beginPath: () => {
      path = [];
    },
    moveTo: (x, y) => path.push([x, y]),
    lineTo: (x, y) => path.push([x, y]),
    closePath: () => {},
    fill: () => {
      calls.push(['fill', context.fillStyle]);
      paths.push({ points: path, style: context.fillStyle });
    },
    stroke: () => calls.push(['stroke']),
  };
  return context;
}

test('rgbaOf writes a colour of the painting with an opacity', () => {
  assert.equal(rgbaOf('hsl(0 100% 50%)', 0.5), 'rgba(255, 0, 0, 0.5)');
  assert.equal(rgbaOf('hsl(240 0% 100%)', 1), 'rgba(255, 255, 255, 1)');
});

test('the painting covers the canvas from its bottom middle, as the screen shows it', () => {
  // A portrait canvas: scaled to its height, the middle of the painting.
  const portrait = viewOf(500, 1000);
  assert.equal(portrait.scale, 1);
  assert.equal(portrait.x, -550);
  assert.equal(portrait.y, 0);
  assert.deepEqual([portrait.left, portrait.right, portrait.top, portrait.bottom], [550, 1050, 0, 1000]);
  // A wide canvas: scaled to its width, the bottom of the painting.
  const wide = viewOf(1600, 500);
  assert.equal(wide.scale, 1);
  assert.equal(wide.y, -500);
  assert.deepEqual([wide.left, wide.right, wide.top, wide.bottom], [0, 1600, 500, 1000]);
});

test('deforming puts a point near the middle of every edge, and leaves fixed points and short edges alone', () => {
  const square = { coords: [0, 0, 100, 0, 100, 100, 0, 100], variances: [1, 1, 1, 1] };
  const once = deformed(square, 1, dice(1), 2);
  assert.equal(once.coords.length, 16);
  assert.deepEqual(once.coords.slice(0, 2), [0, 0], 'the corners stay');
  const [x, y] = once.coords.slice(2, 4);
  assert.ok(Math.hypot(x - 50, y) < 100, `the new point ${x} ${y} lies near the middle of its edge`);
  assert.equal(deformed(square, 3, dice(1), 2).coords.length, 64, 'each round doubles the points');
  // An edge between points that do not vary, or shorter than the finest, is not cut.
  assert.equal(deformed({ ...square, variances: [0, 0, 0, 0] }, 2, dice(1), 2).coords.length, 8);
  assert.equal(deformed(square, 2, dice(1), 500).coords.length, 8);
  // The same random numbers, the same edge.
  assert.deepEqual(deformed(square, 2, dice(4), 2), deformed(square, 2, dice(4), 2));
});

test('a painting is painted as its colour, its sky, many translucent layers of each wash and its glows', () => {
  const painting = paintingOf(37, 'light');
  const context = recordingContext();
  paintOnto(context, painting, 800, 500);
  const [transform] = context.calls;
  assert.equal(transform[0], 'setTransform', 'the painting is placed on the canvas first');
  assert.equal(context.calls.filter(([name]) => name === 'fillRect').length, 2, 'the colour and the sky');
  const washes = painting.shapes.filter((shape) => shape.type === 'wash').length;
  const glows = painting.shapes.filter((shape) => shape.type === 'glow').length;
  const layers = context.paths.filter((path) => path.points.length > 0);
  assert.equal(layers.length, washes * 21, 'every wash in its layers (the wide canvas shows every shape)');
  assert.equal(context.calls.filter(([name]) => name === 'arc').length, glows, 'every glow');
  // A layer is translucent: together the layers build up the pigment.
  for (const { style } of layers) {
    const alpha = Number(/rgba\(.*, ([\d.]+)\)$/.exec(style)[1]);
    assert.ok(alpha > 0 && alpha < 0.2, style);
  }
});

test('the layers of a wash differ, and its edge is deformed: a wash runs softly into the paper', () => {
  const painting = paintingOf(37, 'light');
  const context = recordingContext();
  paintOnto(context, painting, 800, 500);
  const layers = context.paths.filter((path) => path.points.length > 0);
  assert.notDeepEqual(layers[0].points, layers[1].points);
  const wash = painting.shapes.find((shape) => shape.type === 'wash');
  assert.ok(layers[0].points.length > wash.points.length * 4, 'many more points than the polygon');
});

test('the same painting is always painted the same, whatever the theme does to its colours', () => {
  const pathsOf = (theme) => {
    const context = recordingContext();
    paintOnto(context, paintingOf(202, theme), 600, 400);
    return context.paths.map((path) => path.points);
  };
  assert.deepEqual(pathsOf('light'), pathsOf('light'));
  assert.deepEqual(pathsOf('light'), pathsOf('dark'));
});

test('only what the canvas shows is painted, and the edges are only as fine as its pixels', () => {
  const painting = paintingOf(303, 'light');
  const pointsOf = (width, height) => {
    const context = recordingContext();
    paintOnto(context, painting, width, height);
    return context.paths.reduce((sum, path) => sum + path.points.length, 0);
  };
  // A small canvas, the same shape: fewer points, as finer edges would not show.
  assert.ok(pointsOf(400, 250) < pointsOf(1600, 1000));
  // A narrow portrait canvas shows only the middle of the painting: what lies beside it is not painted.
  const context = recordingContext();
  const { left, right } = viewOf(300, 1000);
  paintOnto(context, painting, 300, 1000);
  assert.ok(right - left < WIDTH / 2);
  // Every wash painted (a glow traces no points) reaches near the view.
  for (const path of context.paths.filter((each) => each.points.length > 0)) {
    assert.ok(path.points.some(([x, y]) => x > left - 400 && x < right + 400 && y < HEIGHT + 400));
  }
});

test('a painting is painted quickly enough to be painted at once', () => {
  const start = performance.now();
  for (const seed of [11, 23, 37, 202, 303]) {
    paintOnto(recordingContext(), paintingOf(seed, 'light'), 1000, 700);
  }
  assert.ok((performance.now() - start) / 5 < 200, 'the points of a painting are made in well under a fifth of a second');
});
