/**
 * The painting behind the app (see scene.js), drawn as SVG into the landscape element of the page. Its seed is made from
 * the seeds of the song, so the same song always shows the same picture, and Generate (a new song) a new one. A painting
 * is drawn anew only when its seed or the theme changes, not on every render of the page.
 */

import { meanColourOf, paintingOf } from './scene.js';
import { escapeHtml } from '../escape.js';
import { SEED_NAMES, unit } from '../../music/generator/random.js';

/** The seed of the painting of a song: all the seeds of the song (see random.js) mixed into one whole number. */
export function paintingSeedOf(seeds) {
  return SEED_NAMES.reduce((mixed, name, index) => Math.floor(unit(mixed ^ (seeds?.[name] ?? 0), index) * 4294967296) | 0, 0);
}

// The SVG filters of the watercolour, by the name a shape gives in its `filter`.
const FILTER_IDS = { wash: 'landscape-wash', mist: 'landscape-mist', glow: 'landscape-glow' };

/**
 * The filters and the sky gradient. The wash frays the edge of a shape by noise, softens it and lays the pigment on
 * unevenly; the mist and the glow blur; the grain is the texture of the paper. Their noise follows the painting's seeds.
 */
function defsMarkup({ sky, textures }) {
  return `<defs>
    <linearGradient id="landscape-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${escapeHtml(sky.top)}"/>
      <stop offset="0.8" stop-color="${escapeHtml(sky.bottom)}"/>
    </linearGradient>
    <filter id="landscape-wash" x="-5%" y="-10%" width="110%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="${textures.wash}" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="30" xChannelSelector="R" yChannelSelector="G" result="frayed"/>
      <feGaussianBlur in="frayed" stdDeviation="1.6" result="soft"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${textures.pigment}" result="pigment"/>
      <feColorMatrix in="pigment" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.35" result="density"/>
      <feComposite in="soft" in2="density" operator="in"/>
    </filter>
    <filter id="landscape-glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="22"/>
    </filter>
    <filter id="landscape-mist" x="-50%" y="-200%" width="200%" height="500%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <filter id="landscape-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${textures.grain}" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.33  0 0 0 0.55 -0.18"/>
    </filter>
  </defs>`;
}

/** One shape of the painting as an SVG element. An edged wash has a darker rim of pigment where it dried. */
function shapeMarkup(shape) {
  const attrs = Object.entries(shape.attrs).map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join('');
  const edge = shape.edge ? ' class="landscape-edge"' : '';
  const filter = shape.filter ? ` filter="url(#${FILTER_IDS[shape.filter]})"` : '';
  const opacity = shape.opacity === undefined ? '' : ` opacity="${Math.round(shape.opacity * 100) / 100}"`;
  return `<${shape.tag}${edge}${attrs} fill="${escapeHtml(shape.fill)}"${filter}${opacity}/>`;
}

/**
 * The whole painting as the content of the landscape's SVG element: the sky, the shapes and the paper over all. A `plain`
 * painting shows only the paper, in the mean colour of the painting (the painting switch is off).
 */
export function landscapeMarkup(painting, { plain = false } = {}) {
  const scene = plain
    ? `<rect x="-50" y="-50" width="1700" height="1100" fill="${meanColourOf(painting)}"/>`
    : `<rect x="-50" y="-50" width="1700" height="1100" fill="url(#landscape-sky)"/>${painting.shapes.map(shapeMarkup).join('')}`;
  return `${defsMarkup(painting)}<g class="landscape-scene" data-kind="${escapeHtml(painting.kind)}"${plain ? ' data-plain=""' : ''}>` +
    `${scene}</g>` +
    '<rect class="landscape-paper" x="-50" y="-50" width="1700" height="1100" filter="url(#landscape-grain)"/>';
}

/**
 * Paints the picture of a song, given by its seeds, in a theme into the landscape's SVG element, unless it already shows
 * it; `plain` paints only its mean colour. Returns whether it painted.
 */
export function renderLandscape(svg, seeds, theme, { plain = false } = {}) {
  const seed = paintingSeedOf(seeds);
  const key = `${seed}:${theme}:${plain ? 'plain' : 'painted'}`;
  if (svg.dataset.painted === key) {
    return false;
  }
  svg.innerHTML = landscapeMarkup(paintingOf(seed, theme), { plain });
  svg.dataset.painted = key;
  return true;
}
