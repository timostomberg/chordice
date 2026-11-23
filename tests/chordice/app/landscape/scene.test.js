import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEIGHT, KINDS, WIDTH, meanColourOf, paintingOf, rgbOf, ridgeAt } from '../../../../chordice/app/landscape/scene.js';

const SEEDS = Array.from({ length: 300 }, (_, index) => (index * 2654435761) | 0);
const lightnessOf = (colour) => Number(/hsl\(\d+ \d+% (\d+)%\)/.exec(colour)[1]);
const geometryOf = (painting) => painting.shapes.map(({ tag, attrs, filter }) => ({ tag, attrs, filter }));

test('the same seed and theme always give the same painting', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    assert.deepEqual(paintingOf(seed, 'dark'), paintingOf(seed, 'dark'));
  }
});

test('different seeds give different paintings, and every kind of painting occurs', () => {
  const kinds = new Set(SEEDS.map((seed) => paintingOf(seed, 'light').kind));
  assert.deepEqual([...kinds].sort(), [...KINDS].sort());
  const markups = new Set(SEEDS.slice(0, 50).map((seed) => JSON.stringify(paintingOf(seed, 'light'))));
  assert.equal(markups.size, 50);
});

test('the theme changes only the colours, not the motif', () => {
  for (const seed of SEEDS.slice(0, 60)) {
    const light = paintingOf(seed, 'light');
    const dark = paintingOf(seed, 'dark');
    assert.equal(light.kind, dark.kind);
    assert.deepEqual(geometryOf(light), geometryOf(dark));
    assert.deepEqual(light.textures, dark.textures);
    assert.notDeepEqual(light.shapes.map((shape) => shape.fill), dark.shapes.map((shape) => shape.fill));
  }
});

test('the sky is light by day and dark at dusk', () => {
  for (const seed of SEEDS.slice(0, 60)) {
    const light = paintingOf(seed, 'light').sky;
    const dark = paintingOf(seed, 'dark').sky;
    assert.ok(lightnessOf(light.top) > 70 && lightnessOf(light.bottom) > 70, 'a light sky by day');
    assert.ok(lightnessOf(dark.top) < 30 && lightnessOf(dark.bottom) < 30, 'a dark sky at dusk');
  }
});

test('every shape has a known element, finite rounded numbers, a colour and lies on or near the canvas', () => {
  for (const seed of SEEDS) {
    for (const theme of ['light', 'dark']) {
      const painting = paintingOf(seed, theme);
      assert.ok(painting.shapes.length > 0);
      for (const shape of painting.shapes) {
        assert.ok(['path', 'rect', 'circle', 'ellipse'].includes(shape.tag), shape.tag);
        assert.match(shape.fill, /^hsl\(\d+ \d+% \d+%\)$/);
        assert.ok(shape.filter === undefined || ['wash', 'mist', 'glow'].includes(shape.filter));
        assert.ok(shape.opacity === undefined || (shape.opacity > 0 && shape.opacity <= 1), `opacity ${shape.opacity}`);
        for (const [name, value] of Object.entries(shape.attrs)) {
          if (name === 'd') {
            assert.match(value, /^M[-\d. MLQVZ]+$/, 'a path of moves, lines, curves and verticals only');
            assert.ok(!/NaN|Infinity/.test(value));
          } else {
            assert.ok(Number.isFinite(value), `${name} = ${value}`);
            assert.equal(value, Math.round(value * 10) / 10, `${name} is rounded to a tenth`);
          }
        }
        const { cx, cy } = shape.attrs;
        if (cx !== undefined) {
          assert.ok(cx > -WIDTH && cx < 2 * WIDTH && cy > -HEIGHT && cy < 2 * HEIGHT, `centre ${cx} ${cy}`);
        }
      }
    }
  }
});

test('the sun of a landscape stays in the middle of the canvas, which a portrait screen shows', () => {
  for (const seed of SEEDS) {
    const painting = paintingOf(seed, 'light');
    if (!['hills', 'mountains', 'sea'].includes(painting.kind)) {
      continue;
    }
    for (const sun of painting.shapes.filter((shape) => shape.filter === 'glow')) {
      assert.ok(sun.attrs.cx >= 450 && sun.attrs.cx <= 1150, `sun at ${sun.attrs.cx}`);
    }
  }
});

test('an unknown theme falls back to the light one, the default of the app', () => {
  assert.deepEqual(paintingOf(7, 'sepia'), paintingOf(7, 'light'));
});

test('the sun or the moon shows in only a few landscapes', () => {
  const landscapes = SEEDS.map((seed) => paintingOf(seed, 'light')).filter((painting) => painting.kind !== 'bands' && painting.kind !== 'blooms');
  const withSun = landscapes.filter((painting) => painting.shapes.some((shape) => shape.filter === 'glow'));
  assert.ok(withSun.length > 0, 'it does show sometimes');
  assert.ok(withSun.length / landscapes.length < 0.45, `in ${withSun.length} of ${landscapes.length} landscapes`);
});

test('ridgeAt finds the height of a ridge between its points, and at its ends', () => {
  const points = [[0, 100], [100, 200], [300, 0]];
  assert.equal(ridgeAt(points, 50), 150);
  assert.equal(ridgeAt(points, 200), 100);
  assert.equal(ridgeAt(points, -10), 100);
  assert.equal(ridgeAt(points, 0), 100);
});

test('rgbOf reads the colours paintingOf writes', () => {
  assert.deepEqual(rgbOf('hsl(0 100% 50%)').map(Math.round), [255, 0, 0]);
  assert.deepEqual(rgbOf('hsl(120 100% 25%)').map(Math.round), [0, 128, 0]);
  assert.deepEqual(rgbOf('hsl(240 0% 100%)').map(Math.round), [255, 255, 255]);
});

test('the mean colour of a painting is what the eye sees on average: the sky and the shapes laid over it', () => {
  const sky = { top: 'hsl(0 0% 0%)', bottom: 'hsl(0 0% 0%)' };
  // 20 rows of samples, so the middle of the canvas (y = 500) lies between two rows.
  const mean = (painting) => meanColourOf(painting, 40, 20);
  // Only a black sky: black.
  assert.equal(mean({ sky, shapes: [] }), '#000000');
  // A white rectangle over the whole canvas: white; over the lower half: grey.
  const white = (y, opacity) => ({ tag: 'rect', attrs: { x: -50, y, width: 1700, height: 1100 }, fill: 'hsl(0 0% 100%)', opacity });
  assert.equal(mean({ sky, shapes: [white(-50)] }), '#ffffff');
  assert.equal(mean({ sky, shapes: [white(500)] }), '#808080');
  // Half covered by a shape of half the opacity: a quarter of white.
  assert.equal(mean({ sky, shapes: [white(500, 0.5)] }), '#404040');
  // A path filled down to the bottom from the middle covers the lower half, like a white rectangle.
  const land = { tag: 'path', attrs: { d: 'M-50 1050V500Q800 500 1650 500V1050Z' }, fill: 'hsl(0 0% 100%)' };
  assert.equal(mean({ sky, shapes: [land] }), '#808080');
});

test('every painting has a mean colour, light by day and dark at dusk', () => {
  const luminance = (hex) => [1, 3, 5].reduce((sum, start) => sum + parseInt(hex.slice(start, start + 2), 16), 0) / 3;
  for (const seed of SEEDS.slice(0, 40)) {
    const light = meanColourOf(paintingOf(seed, 'light'));
    const dark = meanColourOf(paintingOf(seed, 'dark'));
    assert.match(light, /^#[0-9a-f]{6}$/);
    assert.ok(luminance(light) > 150, `${light} by day`);
    assert.ok(luminance(dark) < 100, `${dark} at dusk`);
  }
});
