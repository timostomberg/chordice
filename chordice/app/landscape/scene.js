/**
 * The painting behind the app, composed at random from a seed: a calm landscape or an abstract work in watercolour. It is
 * a pure function of the seed and the theme, so the same seed always gives the same picture, and Generate (a new seed)
 * gives a new one. The theme changes only the colours: the same motif by day (light) or at dusk (dark).
 *
 * A painting is described as data: the colours of the sky and a list of shapes, drawn in order from back to front.
 * landscape.js turns it into SVG.
 */

import { unit } from '../../music/generator/random.js';

/** The canvas of the painting, in the units of its viewBox. */
export const WIDTH = 1600;
export const HEIGHT = 1000;
// The shapes reach beyond the canvas, so no edge of a wash shows at the border of the screen.
const LEFT = -50;
const RIGHT = WIDTH + 50;
const BOTTOM = HEIGHT + 50;
// A portrait screen shows only the middle of the canvas (the painting is scaled to cover the screen), so the motifs that
// matter, e.g. the sun, stay within it.
const MIDDLE = [450, 1150];

/** The kinds of painting: three landscapes and two abstract works. */
export const KINDS = ['hills', 'mountains', 'sea', 'bands', 'blooms'];

/**
 * The lightness (L) and saturation (S) of the colours in each theme, in percent: the sky from its top to the horizon, the
 * land from far (pale, close to the sky) to near (stronger), the sun or moon and the mist. The washes stay muted, as in
 * a watercolour, and dark at dusk.
 */
const TONES = {
  light: { skyTop: 86, skyBottom: 93, skyS: 32, far: 84, near: 58, farS: 18, nearS: 32, sun: 82, sunS: 75, mist: 97, mistS: 20 },
  dark: { skyTop: 9, skyBottom: 26, skyS: 30, far: 32, near: 11, farS: 18, nearS: 26, sun: 86, sunS: 40, mist: 34, mistS: 18 },
};

/** The random numbers of one painting, drawn in order from the seed. */
function dice(seed) {
  let index = 0;
  const next = () => unit(seed, index++);
  const between = (low, high) => low + next() * (high - low);
  return {
    next,
    between,
    int: (low, high) => low + Math.floor(next() * (high - low + 1)),
    chance: (probability) => next() < probability,
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

const lerp = (from, to, t) => from + (to - from) * t;
const round = (value) => Math.round(value * 10) / 10;
const hueOf = (hue) => ((hue % 360) + 360) % 360;

/** The hue between two hues, the shorter way round the colour wheel. */
function mixHue(from, to, t) {
  const delta = ((to - from + 540) % 360) - 180;
  return hueOf(from + delta * t);
}

const hsl = (hue, saturation, lightness) => `hsl(${Math.round(hueOf(hue))} ${Math.round(saturation)}% ${Math.round(lightness)}%)`;

/**
 * The hues of a painting, independent of the theme: the sky, the glow at the horizon, the land, an accent opposite the
 * land and the sun. Mostly a blue sky over green, blue, ochre or violet land; sometimes a rosy evening sky.
 */
function paletteOf(d) {
  const sky = d.chance(0.7) ? d.between(190, 235) : d.between(330, 385);
  const horizon = d.chance(0.6) ? d.between(20, 50) : sky + d.between(-20, 20);
  const land = d.pick([d.between(80, 170), d.between(180, 250), d.between(15, 50), d.between(260, 320)]);
  const accent = land + d.between(150, 210);
  const sun = d.between(25, 50);
  return { sky, horizon, land, accent, sun };
}

/** The colours of a palette in a theme. depth runs from 0 (far, pale) to 1 (near, strong). */
function paintOf(palette, theme) {
  const tone = TONES[theme] ?? TONES.light;
  const at = (hue, depth) => hsl(hue, lerp(tone.farS, tone.nearS, depth), lerp(tone.far, tone.near, depth));
  return {
    at,
    // The far land takes on the hue of the sky, as in the haze of a real landscape.
    layer: (depth) => at(mixHue(palette.sky, palette.land, 0.35 + 0.65 * Math.min(1, depth)), Math.min(1, depth)),
    sun: hsl(palette.sun, tone.sunS, tone.sun),
    mist: hsl(palette.sky, tone.mistS, tone.mist),
    water: hsl(palette.sky, tone.skyS, lerp(tone.skyBottom, tone.near, 0.3)),
    skyTop: hsl(palette.sky, tone.skyS, tone.skyTop),
    skyBottom: hsl(palette.horizon, tone.skyS, tone.skyBottom),
  };
}

/** A ridge: points from the left to the right edge, around the height `base`, rising and falling by up to `amplitude`. */
function ridgeOf(d, count, base, amplitude) {
  return Array.from({ length: count }, (_, index) => {
    const x = index === 0 ? LEFT : index === count - 1 ? RIGHT : lerp(LEFT, RIGHT, (index + d.between(-0.3, 0.3)) / (count - 1));
    return [x, base - amplitude * d.between(-1, 1)];
  });
}

/** The height of a ridge at x, between its points. */
export function ridgeAt(points, x) {
  const after = points.findIndex(([px]) => px >= x);
  if (after <= 0) {
    return points[Math.max(after, 0)][1];
  }
  const [[x0, y0], [x1, y1]] = [points[after - 1], points[after]];
  return lerp(y0, y1, (x - x0) / (x1 - x0));
}

/** A soft land shape: a smooth curve through the middles of the ridge's points, filled down to the bottom. */
function smoothLand(points) {
  const [first, ...rest] = points;
  let path = `M${LEFT} ${BOTTOM}V${round(first[1])}`;
  for (let index = 0; index < rest.length - 1; index += 1) {
    const [x, y] = rest[index];
    const [nx, ny] = rest[index + 1];
    path += `Q${round(x)} ${round(y)} ${round((x + nx) / 2)} ${round((y + ny) / 2)}`;
  }
  const last = rest[rest.length - 1];
  return `${path}L${round(last[0])} ${round(last[1])}V${BOTTOM}Z`;
}

/** A jagged land shape: straight lines from peak to valley, filled down to the bottom. */
function jaggedLand(points) {
  return `M${LEFT} ${BOTTOM}${points.map(([x, y]) => `L${round(x)} ${round(y)}`).join('')}V${BOTTOM}Z`;
}

const wash = (tag, attrs, fill, extra = {}) => ({ tag, attrs, fill, filter: 'wash', edge: true, ...extra });

/** The sun or the moon: a disc with a soft glow around it. */
function sunShapes(d, paint, y) {
  const x = d.between(...MIDDLE);
  const r = d.between(38, 70);
  return {
    x,
    r,
    shapes: [
      { tag: 'circle', attrs: { cx: x, cy: y, r: r * 1.8 }, fill: paint.sun, filter: 'glow', opacity: 0.6 },
      wash('circle', { cx: x, cy: y, r }, paint.sun, { edge: false }),
    ],
  };
}

/** Long, blurred clouds or bands of mist between the heights `top` and `bottom`. */
function cloudShapes(d, paint, count, top, bottom) {
  return Array.from({ length: count }, () => ({
    tag: 'ellipse',
    attrs: { cx: d.between(LEFT + 200, RIGHT - 200), cy: d.between(top, bottom), rx: d.between(150, 340), ry: d.between(16, 36) },
    fill: paint.mist,
    filter: 'mist',
    opacity: 0.55,
  }));
}

/** A small group of trees standing on a ridge: slim cypresses or round crowns. */
function treeShapes(d, paint, points, depth) {
  const start = d.between(300, 1300);
  const count = d.int(2, 5);
  const shapes = [];
  let x = start;
  for (let index = 0; index < count; index += 1) {
    const ground = ridgeAt(points, x);
    const [rx, ry] = d.chance(0.5) ? [d.between(7, 11), d.between(20, 36)] : Array(2).fill(d.between(12, 22));
    shapes.push(wash('ellipse', { cx: x, cy: ground - ry * 0.7, rx, ry }, paint.layer(depth + 0.45), { edge: false }));
    x += d.between(16, 30);
  }
  return shapes;
}

// How often the sun (or the moon) shows: in a few paintings only, so it stays something special.
const SUN_CHANCE = 0.3;

/** Rolling hills, layer behind layer, under a few clouds and sometimes a sun; maybe some trees on the second nearest hill. */
function hills(d, paint) {
  const shapes = [];
  if (d.chance(SUN_CHANCE)) {
    shapes.push(...sunShapes(d, paint, d.between(170, 380)).shapes);
  }
  shapes.push(...cloudShapes(d, paint, d.int(1, 4), 140, 420));
  const count = d.int(3, 5);
  for (let index = 0; index < count; index += 1) {
    const depth = index / (count - 1);
    const base = lerp(520, 870, depth) + d.between(-30, 30);
    const points = ridgeOf(d, d.int(4, 7), base, lerp(45, 75, depth) * d.between(0.5, 1.4));
    shapes.push(wash('path', { d: smoothLand(points) }, paint.layer(depth)));
    if (index === count - 2 && d.chance(0.6)) {
      shapes.push(...treeShapes(d, paint, points, depth));
    }
  }
  return shapes;
}

/** Ranges of peaks with mist between them, maybe above a still lake with streaks of light on it. */
function mountains(d, paint) {
  const shapes = [];
  if (d.chance(SUN_CHANCE)) {
    shapes.push(...sunShapes(d, paint, d.between(150, 320)).shapes);
  }
  shapes.push(...cloudShapes(d, paint, d.int(0, 2), 120, 300));
  const lake = d.chance(0.6);
  const shore = lake ? d.between(790, 860) : BOTTOM;
  const count = d.int(2, 4);
  for (let index = 0; index < count; index += 1) {
    const depth = count === 1 ? 0.6 : index / (count - 1);
    const base = lerp(470, lake ? shore - 30 : 800, depth);
    const amplitude = lerp(260, 110, depth) * d.between(0.7, 1.2);
    // Peaks and valleys take turns, from the left edge until the right edge is reached.
    const points = [];
    let peak = d.chance(0.5);
    for (let x = LEFT; points.at(-1)?.[0] !== RIGHT; x += d.between(110, 240), peak = !peak) {
      points.push([Math.min(x, RIGHT), base - amplitude * (peak ? d.between(0.55, 1) : d.between(0, 0.35))]);
    }
    shapes.push(wash('path', { d: jaggedLand(points) }, paint.layer(depth)));
    if (index < count - 1 && d.chance(0.7)) {
      shapes.push({ tag: 'ellipse', attrs: { cx: WIDTH / 2, cy: base + d.between(-10, 40), rx: 950, ry: 32 }, fill: paint.mist, filter: 'mist', opacity: 0.55 });
    }
  }
  if (lake) {
    shapes.push(wash('rect', { x: LEFT, y: shore, width: RIGHT - LEFT, height: BOTTOM - shore }, paint.water));
    shapes.push(...Array.from({ length: d.int(3, 6) }, () => wash('ellipse', {
      cx: d.between(...MIDDLE), cy: d.between(shore + 20, HEIGHT - 20), rx: d.between(80, 300), ry: d.between(2, 4),
    }, paint.mist, { edge: false, opacity: 0.5 })));
  }
  return shapes;
}

/** The open sea, sometimes under a low sun with its reflection on the water; slow waves, maybe an island at the horizon. */
function sea(d, paint) {
  const horizon = d.between(560, 700);
  const sun = d.chance(SUN_CHANCE) ? sunShapes(d, paint, horizon - d.between(40, 240)) : null;
  const shapes = [...(sun?.shapes ?? []), ...cloudShapes(d, paint, d.int(1, 3), 120, horizon - 120)];
  if (d.chance(0.45)) {
    const x = d.between(LEFT + 100, RIGHT - 400);
    const width = d.between(180, 420);
    shapes.push(wash('path', { d: `M${round(x)} ${round(horizon + 4)}Q${round(x + width / 2)} ${round(horizon - d.between(30, 80))} ${round(x + width)} ${round(horizon + 4)}Z` }, paint.layer(0.25)));
  }
  shapes.push(wash('rect', { x: LEFT, y: horizon, width: RIGHT - LEFT, height: BOTTOM - horizon }, paint.layer(0.45)));
  for (let index = 0; sun && index < 6; index += 1) {
    shapes.push(wash('ellipse', {
      cx: sun.x + d.between(-15, 15), cy: horizon + 12 + index * index * 8, rx: sun.r * (1 - index * 0.1) * d.between(0.6, 1.2), ry: 3,
    }, paint.sun, { edge: false, opacity: 0.55 - index * 0.07 }));
  }
  const waves = d.int(5, 9);
  for (let index = 0; index < waves; index += 1) {
    const t = ((index + d.next()) / waves) ** 1.6;
    shapes.push(wash('ellipse', {
      cx: d.between(LEFT, RIGHT), cy: lerp(horizon + 20, BOTTOM, t), rx: d.between(200, 600) * (1 + t), ry: 3 + t * 8,
    }, index % 2 ? paint.mist : paint.layer(0.75), { edge: false, opacity: 0.35 }));
  }
  return shapes;
}

/** An abstract work: broad bands of colour laid one above the other, with soft edges, as in a colour field painting. */
function bands(d, paint, palette) {
  const count = d.int(3, 5);
  const top = d.between(60, 160);
  const gap = d.between(12, 40);
  const weights = Array.from({ length: count }, () => d.between(0.6, 1.6));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const room = HEIGHT - top - d.between(40, 120) - gap * (count - 1);
  const shapes = [];
  let y = top;
  for (const weight of weights) {
    const height = (room * weight) / total;
    const hue = d.pick([palette.land, palette.accent, palette.sky, palette.horizon]);
    shapes.push(wash('rect', { x: LEFT, y, width: RIGHT - LEFT, height, rx: 30 }, paint.at(hue, d.between(0.15, 0.85)), { opacity: d.between(0.7, 0.95) }));
    y += height + gap;
  }
  return shapes;
}

/** An abstract work: blooms of colour, large and small, flowing into each other on wet paper. */
function blooms(d, paint, palette) {
  const shapes = Array.from({ length: d.int(6, 12) }, () => {
    const hue = d.pick([palette.land, palette.land + d.between(-30, 30), palette.accent, palette.sky]);
    return wash('circle', { cx: d.between(250, 1350), cy: d.between(120, 920), r: d.between(50, 260) }, paint.at(hue, d.between(0.1, 0.7)), {
      opacity: d.between(0.35, 0.65),
    });
  });
  // The large blooms lie underneath, the small ones on top.
  return shapes.sort((a, b) => b.attrs.r - a.attrs.r);
}

const COMPOSERS = { hills, mountains, sea, bands, blooms };

/**
 * The painting for a seed in a theme ('light' or 'dark'): its kind, the colours of its sky, the seeds of its paper texture
 * and the shapes drawn on it, back to front. Every number is rounded to a tenth.
 */
export function paintingOf(seed, theme) {
  const d = dice(seed);
  const kind = d.pick(KINDS);
  const palette = paletteOf(d);
  const textures = { wash: d.int(1, 999), pigment: d.int(1, 999), grain: d.int(1, 999) };
  const paint = paintOf(palette, theme);
  const shapes = COMPOSERS[kind](d, paint, palette).map((shape) => ({
    ...shape,
    attrs: Object.fromEntries(Object.entries(shape.attrs).map(([name, value]) => [name, typeof value === 'number' ? round(value) : value])),
  }));
  return { kind, sky: { top: paint.skyTop, bottom: paint.skyBottom }, textures, shapes };
}

/** The red, green and blue (0 to 255) of a colour written as hsl(h s% l%), as paintingOf writes them. */
export function rgbOf(colour) {
  const [hue, saturation, lightness] = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(colour).slice(1).map(Number);
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    return 255 * (l - chroma / 2 * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4)];
}

/** The outline of a path as a polygon: the points of its moves, lines, verticals and curves (their control points too). */
function polygonOf(path) {
  const points = [];
  let [x, y] = [0, 0];
  for (const [, command, args] of path.matchAll(/([MLQVHZ])([^MLQVHZ]*)/g)) {
    const numbers = (args.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (command === 'V') {
      y = numbers[0];
      points.push([x, y]);
    } else if (command === 'H') {
      x = numbers[0];
      points.push([x, y]);
    } else {
      // M, L and Q give their points in pairs; Z closes the outline, which the polygon does anyway.
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        [x, y] = [numbers[index], numbers[index + 1]];
        points.push([x, y]);
      }
    }
  }
  return points;
}

/** Whether a polygon contains a point (even-odd rule). */
function polygonContains(points, x, y) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [xi, yi] = points[index];
    const [xp, yp] = points[previous];
    if ((yi > y) !== (yp > y) && x < ((xp - xi) * (y - yi)) / (yp - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** A test whether a shape of a painting covers a point. */
function coverOf(shape) {
  const { attrs } = shape;
  switch (shape.tag) {
    case 'rect':
      return (x, y) => x >= attrs.x && x <= attrs.x + attrs.width && y >= attrs.y && y <= attrs.y + attrs.height;
    case 'circle':
      return (x, y) => (x - attrs.cx) ** 2 + (y - attrs.cy) ** 2 <= attrs.r ** 2;
    case 'ellipse':
      return (x, y) => ((x - attrs.cx) / attrs.rx) ** 2 + ((y - attrs.cy) / attrs.ry) ** 2 <= 1;
    default: {
      const polygon = polygonOf(attrs.d);
      return (x, y) => polygonContains(polygon, x, y);
    }
  }
}

const mixRgb = (from, to, t) => from.map((channel, index) => channel + (to[index] - channel) * t);
const toHex = (rgb) => `#${rgb.map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, '0')).join('')}`;

/**
 * The mean colour of a painting, as #rrggbb: what the eye sees on average when it looks at the whole canvas. It is
 * sampled on a grid: each point starts in the colour of the sky there, and every shape that covers it, from back to
 * front, is laid over it with its opacity.
 */
export function meanColourOf(painting, columns = 40, rows = 25) {
  const top = rgbOf(painting.sky.top);
  const bottom = rgbOf(painting.sky.bottom);
  const layers = painting.shapes.map((shape) => ({ covers: coverOf(shape), rgb: rgbOf(shape.fill), opacity: shape.opacity ?? 1 }));
  const sum = [0, 0, 0];
  for (let row = 0; row < rows; row += 1) {
    const y = ((row + 0.5) / rows) * HEIGHT;
    // The sky's gradient runs over its rectangle (from -50 to 1050) and reaches the colour of the horizon at 80% of it.
    const colour = mixRgb(top, bottom, Math.min(1, (y + 50) / (1100 * 0.8)));
    for (let column = 0; column < columns; column += 1) {
      const x = ((column + 0.5) / columns) * WIDTH;
      let point = colour;
      for (const layer of layers) {
        if (layer.covers(x, y)) {
          point = mixRgb(point, layer.rgb, layer.opacity);
        }
      }
      point.forEach((channel, index) => {
        sum[index] += channel;
      });
    }
  }
  return toHex(sum.map((channel) => channel / (columns * rows)));
}
