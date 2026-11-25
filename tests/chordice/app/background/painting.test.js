import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEIGHT, KINDS, WIDTH, colourOf, dice, hexOf, paintingOf, rgbOf, ridgeAt } from '../../../../chordice/app/background/painting.js';

const SEEDS = Array.from({ length: 300 }, (_, index) => (index * 2654435761) | 0);
const lightnessOf = (colour) => Number(/hsl\(\d+ \d+% (\d+)%\)/.exec(colour)[1]);
const geometryOf = (painting) => painting.shapes.map(({ fill, opacity, ...geometry }) => geometry);

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
    assert.equal(light.brush, dark.brush);
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

test('every shape is a wash or a glow, with finite rounded numbers, a colour and an opacity, on or near the canvas', () => {
  const rounded = (value) => Number.isFinite(value) && value === Math.round(value * 10) / 10;
  for (const seed of SEEDS) {
    for (const theme of ['light', 'dark']) {
      const painting = paintingOf(seed, theme);
      assert.ok(painting.shapes.length > 0);
      assert.ok(Number.isInteger(painting.brush));
      for (const shape of painting.shapes) {
        assert.match(shape.fill, /^hsl\(\d+ \d+% \d+%\)$/);
        assert.ok(shape.opacity > 0 && shape.opacity <= 1, `opacity ${shape.opacity}`);
        if (shape.type === 'glow') {
          for (const name of ['cx', 'cy', 'rx', 'ry']) {
            assert.ok(rounded(shape[name]), `${name} = ${shape[name]}`);
          }
          assert.ok(shape.rx > 0 && shape.ry > 0);
          assert.ok(shape.cx > -WIDTH && shape.cx < 2 * WIDTH && shape.cy > -HEIGHT && shape.cy < 2 * HEIGHT, `centre ${shape.cx} ${shape.cy}`);
        } else {
          assert.equal(shape.type, 'wash');
          assert.ok(shape.spread >= 0 && shape.spread <= 1, `spread ${shape.spread}`);
          assert.ok(shape.points.length >= 3, 'a polygon');
          for (const [x, y, spread] of shape.points) {
            assert.ok(rounded(x) && rounded(y), `point ${x} ${y}`);
            assert.ok(x > -WIDTH && x < 2 * WIDTH && y > -HEIGHT && y < 2 * HEIGHT, `point ${x} ${y}`);
            assert.ok(spread === undefined || (spread >= 0 && spread <= 1), `spread ${spread}`);
          }
        }
      }
    }
  }
});

test('a landscape lies on the ground: its land reaches the bottom of the canvas', () => {
  for (const seed of SEEDS.slice(0, 100)) {
    const painting = paintingOf(seed, 'light');
    if (!['hills', 'mountains', 'sea'].includes(painting.kind)) {
      continue;
    }
    const lowest = Math.max(...painting.shapes.filter((shape) => shape.type === 'wash').flatMap((shape) => shape.points.map(([, y]) => y)));
    assert.ok(lowest >= HEIGHT, `${painting.kind} ${seed}`);
  }
});

test('the land in front is laid crisper than the land far away, as on drier paper', () => {
  for (const seed of SEEDS.slice(0, 100)) {
    const painting = paintingOf(seed, 'light');
    if (painting.kind !== 'hills') {
      continue;
    }
    const lands = painting.shapes.filter((shape) => shape.type === 'wash' && shape.points.some(([, y]) => y > HEIGHT) && shape.points.length > 20);
    assert.ok(lands.length >= 3);
    assert.ok(lands[0].spread > lands.at(-1).spread, `${seed}`);
  }
});

test('the sun of a landscape stays in the middle of the canvas, which a portrait screen shows', () => {
  for (const seed of SEEDS) {
    const painting = paintingOf(seed, 'light');
    if (!['hills', 'mountains', 'sea'].includes(painting.kind)) {
      continue;
    }
    for (const sun of painting.shapes.filter((shape) => shape.role === 'sun')) {
      assert.ok(sun.cx >= 450 && sun.cx <= 1150, `sun at ${sun.cx}`);
    }
  }
});

test('an unknown theme falls back to the light one, the default of the app', () => {
  assert.deepEqual(paintingOf(7, 'sepia'), paintingOf(7, 'light'));
});

test('the sun or the moon shows in only a few landscapes', () => {
  const landscapes = SEEDS.map((seed) => paintingOf(seed, 'light')).filter((painting) => painting.kind !== 'bands' && painting.kind !== 'blooms');
  const withSun = landscapes.filter((painting) => painting.shapes.some((shape) => shape.role === 'sun'));
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

test('hexOf writes the colours paintingOf writes as #rrggbb', () => {
  assert.equal(hexOf('hsl(0 100% 50%)'), '#ff0000');
  assert.equal(hexOf('hsl(240 0% 100%)'), '#ffffff');
  assert.equal(hexOf('hsl(0 0% 0%)'), '#000000');
});

const luminance = (hex) => [1, 3, 5].reduce((sum, start) => sum + parseInt(hex.slice(start, start + 2), 16), 0) / 3;
// The hue of a colour written as #rrggbb, in degrees.
function hueOfHex(hex) {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  const sector = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (sector * 60 + 360) % 360;
}
const hueDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const hueOfHsl = (colour) => Number(/hsl\((\d+) /.exec(colour)[1]);

test('every painting has a colour from its seed, light by day and dark at dusk', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const light = colourOf(seed, 'light');
    const dark = colourOf(seed, 'dark');
    assert.match(light, /^#[0-9a-f]{6}$/);
    assert.ok(luminance(light) > 150, `${light} by day`);
    assert.ok(luminance(dark) < 100, `${dark} at dusk`);
    assert.equal(colourOf(seed, 'light'), light, 'the same seed gives the same colour');
  }
  assert.ok(new Set(SEEDS.slice(0, 40).map((seed) => colourOf(seed, 'light'))).size > 30, 'different seeds, different colours');
  assert.equal(colourOf(7, 'sepia'), colourOf(7, 'light'));
});

test('the painting follows from its colour: the same colour, the land in its hue and the sky leaning towards it', () => {
  for (const seed of SEEDS.slice(0, 60)) {
    for (const theme of ['light', 'dark']) {
      const painting = paintingOf(seed, theme);
      const colour = colourOf(seed, theme);
      assert.equal(painting.colour, colour);
      const hue = hueOfHex(colour);
      // The colour's hue is rounded twice (to whole degrees and to 8 bits a channel), so a few degrees apart.
      const nearest = Math.min(...painting.shapes.map((shape) => hueDistance(hueOfHsl(shape.fill), hue)));
      if (painting.kind !== 'sea') {
        assert.ok(nearest < 8, `a shape in the hue of the colour (${painting.kind}, ${nearest} degrees off)`);
      }
    }
  }
});

test('dice draw the same numbers from the same seed, and gauss is centred on 0 with a spread of about 1', () => {
  const first = dice(5);
  const second = dice(5);
  assert.deepEqual([first.next(), first.gauss(), first.between(2, 3)], [second.next(), second.gauss(), second.between(2, 3)]);
  const d = dice(9);
  const values = Array.from({ length: 4000 }, () => d.gauss());
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  assert.ok(Math.abs(mean) < 0.08, `mean ${mean}`);
  assert.ok(Math.abs(deviation - 1) < 0.08, `deviation ${deviation}`);
  assert.ok(values.every(Number.isFinite));
});
