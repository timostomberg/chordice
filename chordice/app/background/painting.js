/**
 * The painting behind the app, composed at random from a seed: a calm landscape or an abstract work in watercolour. It is
 * a pure function of the seed and the theme, so the same seed always gives the same picture, and Generate (a new seed)
 * gives a new one. The theme changes only the colours: the same motif by day (light) or at dusk (dark).
 *
 * Everything starts from the colour of the painting, the first thing drawn from its seed: it is cheap to know, so the
 * background shows it at once, and the painting is composed in its hue (its land, and its sky leaning towards it) and
 * fades in over it once it is drawn.
 *
 * A painting is described as data: the colours of the sky and a list of shapes, drawn in order from back to
 * front. Each shape is a wash (a polygon of pigment, see watercolour.js) or a glow (a soft, round haze of light or mist).
 */

import { unit } from '../../music/generator/random.js';

/** The canvas of the painting, in its own units. */
export const WIDTH = 1600;
export const HEIGHT = 1000;
// The shapes reach beyond the canvas, so no edge of a wash shows at the border of the screen.
const LEFT = -50;
const RIGHT = WIDTH + 50;
const BOTTOM = HEIGHT + 50;
// A portrait screen shows only the middle of the canvas (the painting covers the screen), so the motifs that matter, e.g.
// the sun, stay within it.
const MIDDLE = [450, 1150];

/** The kinds of painting: three landscapes and two abstract works. */
export const KINDS = ['hills', 'mountains', 'sea', 'bands', 'blooms'];

/**
 * The lightness (L) and saturation (S) of the colours in each theme, in percent: the colour of the painting, the sky from
 * its top to the horizon, the land from far (pale, close to the sky) to near (stronger), the sun or moon and the mist.
 * The washes stay muted, as in a watercolour, and dark at dusk.
 */
const TONES = {
  light: {
    colour: 82, colourS: 24, skyTop: 86, skyBottom: 93, skyS: 32, far: 84, near: 58, farS: 18, nearS: 32, sun: 82, sunS: 75, mist: 97, mistS: 20,
  },
  dark: {
    colour: 20, colourS: 22, skyTop: 9, skyBottom: 26, skyS: 30, far: 32, near: 11, farS: 18, nearS: 26, sun: 86, sunS: 40, mist: 34, mistS: 18,
  },
};
const toneOf = (theme) => TONES[theme] ?? TONES.light;

/** The random numbers drawn in order from a seed: of one painting, or of one wash as it is painted. */
export function dice(seed) {
  let index = 0;
  const next = () => unit(seed, index++);
  const between = (low, high) => low + next() * (high - low);
  return {
    next,
    between,
    int: (low, high) => low + Math.floor(next() * (high - low + 1)),
    chance: (probability) => next() < probability,
    pick: (list) => list[Math.floor(next() * list.length)],
    // A normally distributed number (mean 0, deviation 1), by Box and Muller.
    gauss: () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
  };
}

const lerp = (from, to, t) => from + (to - from) * t;
const round = (value) => Math.round(value * 10) / 10;
const hueOf = (hue) => ((hue % 360) + 360) % 360;
const smooth = (t) => t * t * (3 - 2 * t);

/** The hue between two hues, the shorter way round the colour wheel. */
function mixHue(from, to, t) {
  const delta = ((to - from + 540) % 360) - 180;
  return hueOf(from + delta * t);
}

const hsl = (hue, saturation, lightness) => `hsl(${Math.round(hueOf(hue))} ${Math.round(saturation)}% ${Math.round(lightness)}%)`;

/** The hue of the colour of a painting, the first number drawn from its seed: green, blue, ochre or violet. */
function colourHueOf(d) {
  return d.pick([d.between(80, 170), d.between(180, 250), d.between(15, 50), d.between(260, 320)]);
}

/**
 * The colour of the painting of a seed in a theme, as #rrggbb: a muted wash in its hue, light by day and dark at dusk.
 * The background shows it at once, before the painting is drawn, and in its place while the painting switch is off.
 */
export function colourOf(seed, theme) {
  return colourHexOf(colourHueOf(dice(seed)), theme);
}

/** The colour of a painting with the hue of its colour in a theme, as #rrggbb. */
function colourHexOf(hue, theme) {
  const tone = toneOf(theme);
  return hexOf(hsl(hue, tone.colourS, tone.colour));
}

// How far the sky leans towards the hue of the painting's colour.
const SKY_LEAN = 0.3;

/**
 * The hues of a painting, independent of the theme, all following from the hue of its colour: the sky, the glow at the
 * horizon, the land (in the hue of the colour), an accent opposite the land and the sun. Mostly a blue sky over green,
 * blue, ochre or violet land; sometimes a rosy evening sky; the sky leans towards the colour.
 */
function paletteOf(d, colour) {
  const sky = mixHue(d.chance(0.7) ? d.between(190, 235) : d.between(330, 385), colour, SKY_LEAN);
  const horizon = d.chance(0.6) ? d.between(20, 50) : sky + d.between(-20, 20);
  const land = colour;
  const accent = land + d.between(150, 210);
  const sun = d.between(25, 50);
  return { sky, horizon, land, accent, sun };
}

/** The colours of a palette in a theme. depth runs from 0 (far, pale) to 1 (near, strong). */
function paintOf(palette, theme) {
  const tone = toneOf(theme);
  const landHue = (depth) => mixHue(palette.sky, palette.land, 0.35 + 0.65 * Math.min(1, depth));
  const at = (hue, depth) => hsl(hue, lerp(tone.farS, tone.nearS, depth), lerp(tone.far, tone.near, depth));
  return {
    at,
    // The far land takes on the hue of the sky, as in the haze of a real landscape.
    layer: (depth) => at(landHue(depth), Math.min(1, depth)),
    // The shadowed side of the land at a depth: its hue, a little nearer and so stronger.
    shade: (depth) => at(landHue(depth), Math.min(1, depth + 0.3)),
    sun: hsl(palette.sun, tone.sunS, tone.sun),
    mist: hsl(palette.sky, tone.mistS, tone.mist),
    // The warm haze of the horizon, laid wet in wet into the sky.
    haze: hsl(palette.horizon, tone.skyS + 12, lerp(tone.skyTop, tone.skyBottom, 0.6)),
    water: hsl(palette.sky, tone.skyS, lerp(tone.skyBottom, tone.near, 0.3)),
    skyTop: hsl(palette.sky, tone.skyS, tone.skyTop),
    skyBottom: hsl(palette.horizon, tone.skyS, tone.skyBottom),
  };
}

/**
 * A wash: a polygon of pigment. `spread` is how wet it is laid (0 crisp, 1 wet: how far its edge runs into the paper), and
 * a point of the polygon can have a spread of its own as its third number; `opacity` is how dense the pigment is at the
 * heart of the wash.
 */
const wash = (points, fill, extra = {}) => ({ type: 'wash', points, fill, opacity: 0.92, spread: 0.5, ...extra });

/** A glow: a soft ellipse of light or mist, fading out from its middle. */
const glow = (cx, cy, rx, ry, fill, opacity, extra = {}) => ({ type: 'glow', cx, cy, rx, ry, fill, opacity, ...extra });

/** The corners of an ellipse, as a polygon to be painted as a wash. */
function ellipsePoints(cx, cy, rx, ry, count = 16) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

/** The corners of a rectangle, as a polygon to be painted as a wash. */
const rectPoints = (x, y, width, height) => [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];

/**
 * A fractal line, by midpoint displacement: 2^levels + 1 numbers of about -1 to 1, each level adding finer bumps that
 * are `roughness` times smaller than the last.
 */
function fractal(d, levels, roughness) {
  const count = 2 ** levels + 1;
  const values = new Array(count).fill(0);
  values[0] = d.between(-1, 1);
  values[count - 1] = d.between(-1, 1);
  let scale = 1;
  for (let size = count - 1; size > 1; size /= 2) {
    scale *= roughness;
    for (let index = size / 2; index < count; index += size) {
      values[index] = (values[index - size / 2] + values[index + size / 2]) / 2 + d.between(-1, 1) * scale;
    }
  }
  return values;
}

// The points of a ridge: 2^5 + 1 from the left to the right edge, about 50 units apart.
const RIDGE_LEVELS = 5;
const ridgeXs = (count) => Array.from({ length: count }, (_, index) => lerp(LEFT, RIGHT, index / (count - 1)));

/** A rolling ridge around the height `base`: a smooth swell through a few heights, roughened a little. */
function rollingRidge(d, base, amplitude) {
  const knots = Array.from({ length: d.int(3, 6) }, () => d.between(-1, 1));
  const rough = fractal(d, RIDGE_LEVELS, 0.5);
  return ridgeXs(rough.length).map((x, index) => {
    const t = (index / (rough.length - 1)) * (knots.length - 1);
    const knot = Math.min(Math.floor(t), knots.length - 2);
    return [x, base - amplitude * (lerp(knots[knot], knots[knot + 1], smooth(t - knot)) + 0.05 * rough[index])];
  });
}

/**
 * A range of mountains around the height `base`: peaks and valleys taking turns from the left edge to the right, with
 * rugged flanks between them. Returns its points and its turns ([x, y, isPeak]).
 */
function mountainRidge(d, base, amplitude) {
  const turns = [];
  let peak = d.chance(0.5);
  for (let x = LEFT; turns.at(-1)?.[0] !== RIGHT; x += d.between(110, 260), peak = !peak) {
    turns.push([Math.min(x, RIGHT), base - amplitude * (peak ? d.between(0.55, 1) : d.between(0, 0.35)), peak]);
  }
  const rough = fractal(d, RIDGE_LEVELS + 1, 0.62);
  const roughness = ridgeXs(rough.length).map((x, index) => [x, rough[index]]);
  // The turns are points of the ridge themselves, so its peaks stay sharp.
  const xs = [...new Set([...ridgeXs(rough.length), ...turns.map(([x]) => x)])].sort((a, b) => a - b);
  const points = xs.map((x) => [x, ridgeAt(turns, x) - amplitude * 0.09 * ridgeAt(roughness, x)]);
  return { points, turns };
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

/** A land shape: the ridge, filled down to the bottom. */
const land = (points) => [[LEFT, BOTTOM], ...points, [RIGHT, BOTTOM]];

/** The sun or the moon: a disc with a soft glow around it. */
function sunShapes(d, paint, y) {
  const x = d.between(...MIDDLE);
  const r = d.between(38, 70);
  return {
    x,
    r,
    shapes: [
      glow(x, y, r * 2.8, r * 2.8, paint.sun, 0.55, { role: 'sun' }),
      wash(ellipsePoints(x, y, r, r), paint.sun, { spread: 0.12, opacity: 0.95 }),
    ],
  };
}

/** The sky, laid wet in wet: a few broad blooms of the haze of the horizon, above the height `bottom`. */
function skyShapes(d, paint, bottom) {
  return Array.from({ length: d.int(1, 3) }, () => glow(
    d.between(LEFT + 100, RIGHT - 100), d.between(bottom * 0.35, bottom), d.between(300, 620), d.between(110, 240), paint.haze, d.between(0.25, 0.45),
  ));
}

/** Long, soft clouds or bands of mist between the heights `top` and `bottom`. */
function cloudShapes(d, paint, count, top, bottom) {
  return Array.from({ length: count }, () => glow(
    d.between(LEFT + 200, RIGHT - 200), d.between(top, bottom), d.between(160, 360), d.between(20, 44), paint.mist, 0.6,
  ));
}

/** A small group of trees standing on a ridge: slim cypresses or round crowns, each on a short trunk. */
function treeShapes(d, paint, points, depth) {
  const count = d.int(2, 5);
  const shapes = [];
  let x = d.between(300, 1300);
  for (let index = 0; index < count; index += 1) {
    const ground = ridgeAt(points, x) + 6;
    const fill = paint.layer(depth + 0.45);
    if (d.chance(0.5)) {
      const [half, height] = [d.between(8, 12), d.between(50, 85)];
      const crown = [[x, ground - height], [x + half, ground - height * 0.45], [x + half * 0.6, ground], [x - half * 0.6, ground], [x - half, ground - height * 0.45]];
      shapes.push(wash(crown, fill, { spread: 0.18 }));
    } else {
      const r = d.between(14, 24);
      shapes.push(wash(rectPoints(x - 2, ground - r, 4, r), fill, { spread: 0.1 }));
      shapes.push(wash(ellipsePoints(x, ground - r * 1.6, r, r * 0.9, 12), fill, { spread: 0.3 }));
    }
    x += d.between(18, 34);
  }
  return shapes;
}

// How often the sun (or the moon) shows: in a few paintings only, so it stays something special.
const SUN_CHANCE = 0.3;
// How wet the land is laid, from far (wet in wet, soft) to near (on dry paper, crisp).
const spreadAt = (depth) => lerp(0.85, 0.3, depth);

/** Rolling hills, layer behind layer, under a few clouds and sometimes a sun; maybe some trees on the second nearest hill. */
function hills(d, paint) {
  const shapes = skyShapes(d, paint, 480);
  if (d.chance(SUN_CHANCE)) {
    shapes.push(...sunShapes(d, paint, d.between(170, 380)).shapes);
  }
  shapes.push(...cloudShapes(d, paint, d.int(1, 4), 140, 420));
  const count = d.int(3, 5);
  for (let index = 0; index < count; index += 1) {
    const depth = index / (count - 1);
    const base = lerp(520, 870, depth) + d.between(-30, 30);
    const points = rollingRidge(d, base, lerp(45, 75, depth) * d.between(0.5, 1.4));
    shapes.push(wash(land(points), paint.layer(depth), { spread: spreadAt(depth) }));
    if (index === count - 2 && d.chance(0.6)) {
      shapes.push(...treeShapes(d, paint, points, depth));
    }
  }
  return shapes;
}

/**
 * The shadowed flanks of a range: from each peak down to the valley on the side away from the light, a darker facet of
 * the mountain, crisp along the ridge and running out softly below.
 */
function flankShapes(d, points, turns, light, fill) {
  const shapes = [];
  turns.forEach(([x, y, peak], index) => {
    const valley = turns[index + light];
    if (!peak || !valley) {
      return;
    }
    const ridge = points.filter(([px]) => px >= Math.min(x, valley[0]) && px <= Math.max(x, valley[0])).map(([px, py]) => [px, py, 0.12]);
    // Below the ridge the facet curves back from the valley to under the peak, wet.
    const depth = (valley[1] - y) * d.between(0.5, 0.9);
    const inner = [0.75, 0.5, 0.25].map((t) => [lerp(x, valley[0], t * 0.8), lerp(y, valley[1], t) + depth * Math.sin(Math.PI * t), 0.9]);
    const ordered = x < valley[0] ? [...ridge, ...inner] : [...ridge.reverse(), ...inner];
    shapes.push(wash(ordered, fill, { spread: 0.5, opacity: 0.35 }));
  });
  return shapes;
}

/** Ranges of peaks with mist between them and shadowed flanks, maybe above a still lake that mirrors the nearest range. */
function mountains(d, paint) {
  const shapes = skyShapes(d, paint, 420);
  if (d.chance(SUN_CHANCE)) {
    shapes.push(...sunShapes(d, paint, d.between(150, 320)).shapes);
  }
  shapes.push(...cloudShapes(d, paint, d.int(0, 2), 120, 300));
  const lake = d.chance(0.6);
  const shore = lake ? d.between(790, 860) : BOTTOM;
  // The light falls from the left (1) or the right (-1).
  const light = d.chance(0.5) ? 1 : -1;
  const count = d.int(2, 4);
  let nearest = null;
  for (let index = 0; index < count; index += 1) {
    const depth = count === 1 ? 0.6 : index / (count - 1);
    const base = lerp(470, lake ? shore - 30 : 800, depth);
    const range = mountainRidge(d, base, lerp(260, 110, depth) * d.between(0.7, 1.2));
    shapes.push(wash(land(range.points), paint.layer(depth), { spread: spreadAt(depth) }));
    shapes.push(...flankShapes(d, range.points, range.turns, light, paint.shade(depth)));
    if (index < count - 1 && d.chance(0.7)) {
      shapes.push(glow(WIDTH / 2, base + d.between(-10, 40), 1000, 34, paint.mist, 0.6));
    }
    nearest = { points: range.points, fill: paint.layer(depth) };
  }
  if (lake) {
    shapes.push(wash(rectPoints(LEFT, shore, RIGHT - LEFT, BOTTOM - shore), paint.water, { spread: 0.2 }));
    // The nearest range mirrored in the water, fainter and flattened.
    const mirrored = nearest.points.map(([x, y]) => [x, Math.min(BOTTOM, shore + (shore - y) * 0.55)]);
    shapes.push(wash([[RIGHT, shore], [LEFT, shore], ...mirrored], nearest.fill, { spread: 0.45, opacity: 0.3 }));
    shapes.push(...Array.from({ length: d.int(3, 6) }, () => wash(
      ellipsePoints(d.between(...MIDDLE), d.between(shore + 20, HEIGHT - 20), d.between(80, 300), d.between(2, 4)), paint.mist, { spread: 0.15, opacity: 0.5 },
    )));
  }
  return shapes;
}

/** The open sea, sometimes under a low sun with its reflection on the water; slow waves, maybe an island at the horizon. */
function sea(d, paint) {
  const horizon = d.between(560, 700);
  const sun = d.chance(SUN_CHANCE) ? sunShapes(d, paint, horizon - d.between(40, 240)) : null;
  const shapes = [...skyShapes(d, paint, horizon), ...(sun?.shapes ?? []), ...cloudShapes(d, paint, d.int(1, 3), 120, horizon - 120)];
  if (d.chance(0.45)) {
    const x = d.between(LEFT + 100, RIGHT - 400);
    const width = d.between(180, 420);
    const top = horizon - d.between(30, 80);
    const island = Array.from({ length: 9 }, (_, index) => [x + (width * index) / 8, lerp(horizon + 4, top, Math.sin((Math.PI * index) / 8) ** 0.7)]);
    shapes.push(wash(island, paint.layer(0.25), { spread: 0.4 }));
  }
  shapes.push(wash(rectPoints(LEFT, horizon, RIGHT - LEFT, BOTTOM - horizon), paint.layer(0.45), { spread: 0.25 }));
  for (let index = 0; sun && index < 6; index += 1) {
    shapes.push(wash(ellipsePoints(
      sun.x + d.between(-15, 15), horizon + 12 + index * index * 8, sun.r * (1 - index * 0.1) * d.between(0.6, 1.2), 3,
    ), paint.sun, { spread: 0.15, opacity: 0.55 - index * 0.07 }));
  }
  const waves = d.int(5, 9);
  for (let index = 0; index < waves; index += 1) {
    const t = ((index + d.next()) / waves) ** 1.6;
    shapes.push(wash(ellipsePoints(d.between(LEFT, RIGHT), lerp(horizon + 20, BOTTOM, t), d.between(200, 600) * (1 + t), 3 + t * 8, 20),
      index % 2 ? paint.mist : paint.layer(0.75), { spread: 0.2, opacity: 0.35 }));
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
  // One band, at random, is laid in the hue of the painting's colour.
  const own = d.int(0, count - 1);
  const shapes = [];
  let y = top;
  for (const [index, weight] of weights.entries()) {
    const height = (room * weight) / total;
    const hue = index === own ? palette.land : d.pick([palette.land, palette.accent, palette.sky, palette.horizon]);
    shapes.push(wash(rectPoints(LEFT, y, RIGHT - LEFT, height), paint.at(hue, d.between(0.15, 0.85)), { spread: d.between(0.5, 0.9), opacity: d.between(0.7, 0.92) }));
    y += height + gap;
  }
  return shapes;
}

/**
 * An abstract work: blooms of colour, large and small, flowing into each other on wet paper, with the pigment lifted a
 * little at their hearts, so it gathers towards their edges. The first is in the hue of the painting's colour.
 */
function blooms(d, paint, palette) {
  const blots = Array.from({ length: d.int(6, 12) }, (_, index) => {
    const hue = index === 0 ? palette.land : d.pick([palette.land, palette.land + d.between(-30, 30), palette.accent, palette.sky]);
    const [x, y, r] = [d.between(250, 1350), d.between(120, 920), d.between(50, 260)];
    return {
      r,
      shapes: [
        wash(ellipsePoints(x, y, r, r * d.between(0.8, 1.1)), paint.at(hue, d.between(0.1, 0.7)), { spread: d.between(0.6, 1), opacity: d.between(0.4, 0.7) }),
        glow(x, y, r * 0.75, r * 0.75, paint.mist, 0.3),
      ],
    };
  });
  // The large blooms lie underneath, the small ones on top.
  return blots.sort((a, b) => b.r - a.r).flatMap(({ shapes }) => shapes);
}

const COMPOSERS = { hills, mountains, sea, bands, blooms };

/** A shape with every number rounded to a tenth. */
function rounded(shape) {
  if (shape.type === 'glow') {
    return { ...shape, cx: round(shape.cx), cy: round(shape.cy), rx: round(shape.rx), ry: round(shape.ry) };
  }
  return { ...shape, points: shape.points.map(([x, y]) => [round(x), round(y)]) };
}

/**
 * The painting for a seed in a theme ('light' or 'dark'): its kind, its colour (see colourOf), the colours of its sky, its
 * the seed of its brush (how the washes run, see watercolour.js) and the shapes drawn on
 * it, back to front. Every number is rounded to a tenth.
 */
export function paintingOf(seed, theme) {
  const d = dice(seed);
  const hue = colourHueOf(d);
  const kind = d.pick(KINDS);
  const palette = paletteOf(d, hue);
  const brush = d.int(1, 2 ** 30);
  const paint = paintOf(palette, theme);
  const shapes = COMPOSERS[kind](d, paint, palette).map(rounded);
  const colour = colourHexOf(hue, theme);
  return { kind, colour, sky: { top: paint.skyTop, bottom: paint.skyBottom }, brush, shapes };
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

const toHex = (rgb) => `#${rgb.map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, '0')).join('')}`;

/** A colour written as hsl(h s% l%), as paintingOf writes them, as #rrggbb. */
export const hexOf = (colour) => toHex(rgbOf(colour));
