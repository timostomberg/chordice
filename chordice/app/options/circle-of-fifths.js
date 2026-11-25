/**
 * The circle of fifths left of the chords, where the key is chosen (renderKeyCircle), with the circle of fifths button in
 * its middle. The circle itself is SVG markup: a ring of wedges, one per major key. The outer part of a wedge names the major key, the
 * inner part its relative minor, e.g. "C" and "Am". The enharmonic slot at the bottom (F#/Gb) is split into two half
 * wedges, F# on the side of B and Gb on the side of Db, one button each.
 * Each wedge carries data-action="set-key" and its own key name, so that clicks select exactly that key.
 */

import { KEY_CIRCLE, minorNameOf, neighbourKeysOf } from '../../music/theory/keys.js';
import { escapeHtml } from '../escape.js';
import { exerciseState, isUnavailable } from '../state/availability.js';
import { nameParts } from '../names.js';

const VIEW_SIZE = 240;
const CENTER = VIEW_SIZE / 2;
// Radii of the minor (inner) and major (outer) band of the ring.
const INNER_RADIUS = 50;
const MIDDLE_RADIUS = 80;
const OUTER_RADIUS = 110;
// The selected key sticks out of the ring by this much.
const SELECTED_LIFT = 8;
// The gap between neighbouring wedges, and between the major and the minor band, in the same width everywhere.
const GAP = 2;
const CORNER = 3.5;
const SLOT_DEGREES = 360 / KEY_CIRCLE.length;
// Font sizes of the labels; the half wedges of the enharmonic slot have smaller labels so that they fit.
const FONT = { major: 15, minor: 10.5 };
const SPLIT_FONT = { major: 12.5, minor: 8.5 };

const round = (value) => Number(value.toFixed(2));

/**
 * The watercolour wash of the wedges, the same look as the buttons (see "The watercolour wash" in main.css): a darker rim
 * of pigment just inside the edge, denser at the bottom right where the water ran to; a lighter bloom towards the top
 * left; and soft clouds where the pigment settled denser. The colours of all three come from the stylesheet
 * (circle-of-fifths.css), so they follow the theme. The clouds have the frequency of the buttons' tile in user units: the
 * circle is drawn at about 1.7 pixels per unit.
 */
const washFilter = (id) => `<defs><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">` +
  // The rim: the shape less a blurred copy of itself leaves its edge; a second copy, moved up and left, leaves more of it
  // at the bottom and on the right.
  '<feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="blurred"/>' +
  '<feComposite in="SourceAlpha" in2="blurred" operator="out" result="edge"/>' +
  '<feOffset in="blurred" dx="-0.6" dy="-1.2" result="raised"/>' +
  '<feComposite in="SourceAlpha" in2="raised" operator="out" result="lowEdge"/>' +
  '<feMerge result="edges"><feMergeNode in="edge"/><feMergeNode in="lowEdge"/></feMerge>' +
  '<feFlood class="wash-rim" result="rimColour"/>' +
  '<feComposite in="rimColour" in2="edges" operator="in" result="rim"/>' +
  // The bloom: the shrunk and softened shape, moved towards the top left, inside the shape.
  '<feMorphology in="SourceAlpha" operator="erode" radius="3" result="core"/>' +
  '<feGaussianBlur in="core" stdDeviation="4" result="softCore"/>' +
  '<feOffset in="softCore" dx="-1" dy="-1" result="movedCore"/>' +
  '<feComposite in="movedCore" in2="SourceAlpha" operator="in" result="middle"/>' +
  '<feFlood class="wash-bloom" result="bloomColour"/>' +
  '<feComposite in="bloomColour" in2="middle" operator="in" result="bloom"/>' +
  // The clouds: low-frequency noise, its light parts as the pigment, inside the shape.
  '<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="4" result="noise"/>' +
  '<feColorMatrix in="noise" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 -0.3" result="cloudMask"/>' +
  '<feFlood class="wash-clouds" result="cloudColour"/>' +
  '<feComposite in="cloudColour" in2="cloudMask" operator="in" result="cloudsEverywhere"/>' +
  '<feComposite in="cloudsEverywhere" in2="SourceAlpha" operator="in" result="clouds"/>' +
  '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="bloom"/><feMergeNode in="clouds"/><feMergeNode in="rim"/></feMerge>' +
  '</filter></defs>';

/** A point at a radius and an angle in degrees, clockwise from the top. */
function point(radius, degrees) {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return [round(CENTER + radius * Math.cos(angle)), round(CENTER + radius * Math.sin(angle))];
}

/** The angle by which an edge moves in at a radius so that the gap to the next wedge has the width GAP / 2 on this side. */
const inset = (radius) => (Math.asin(GAP / 2 / radius) * 180) / Math.PI;

/**
 * The path of a wedge of the ring between two radii and two angles, with rounded corners. The edges are pulled in by half
 * of GAP on every side, so that neighbouring wedges are evenly separated.
 */
export function wedgePath(innerRadius, outerRadius, start, end) {
  const r0 = innerRadius + GAP / 2;
  const r1 = outerRadius - GAP / 2;
  const s0 = start + inset(r0);
  const e0 = end - inset(r0);
  const s1 = start + inset(r1);
  const e1 = end - inset(r1);
  const turn0 = (CORNER / r0) * (180 / Math.PI);
  const turn1 = (CORNER / r1) * (180 / Math.PI);
  const p = (radius, degrees) => point(radius, degrees).join(' ');
  return `M${p(r1, s1 + turn1)}` +
    `A${round(r1)} ${round(r1)} 0 0 1 ${p(r1, e1 - turn1)}` +
    `Q${p(r1, e1)} ${p(r1 - CORNER, e1)}` +
    `L${p(r0 + CORNER, e0)}` +
    `Q${p(r0, e0)} ${p(r0, e0 - turn0)}` +
    `A${round(r0)} ${round(r0)} 0 0 0 ${p(r0, s0 + turn0)}` +
    `Q${p(r0, s0)} ${p(r0 + CORNER, s0)}` +
    `L${p(r1 - CORNER, s1)}` +
    `Q${p(r1, s1)} ${p(r1, s1 + turn1)}Z`;
}

/**
 * The content of a label, as names.js sets names: the accidentals are raised and smaller, the minor sign is smaller, as
 * in "F♯m". The dy values and font sizes are in user units, so they do not depend on the font size of the tspan.
 */
export function labelContent(name, size) {
  const lift = round(size * 0.38);
  let raised = false;
  return nameParts(name).map((part) => {
    if (part.kind === 'accidental') {
      raised = true;
      return `<tspan class="accidental" font-size="${round(size * 0.68)}" dy="${-lift}">${part.text}</tspan>`;
    }
    // Text after an accidental moves back down to the baseline.
    const back = raised ? ` dy="${lift}"` : '';
    raised = false;
    if (part.kind === 'minor') {
      return `<tspan class="minor-sign" font-size="${round(size * 0.8)}"${back}>${part.text}</tspan>`;
    }
    return back ? `<tspan${back}>${escapeHtml(part.text)}</tspan>` : escapeHtml(part.text);
  }).join('');
}

/** A label centred at a radius and angle. The baseline is moved down so that the capitals sit in the middle. */
function label(className, name, radius, degrees, size) {
  const [x, y] = point(radius, degrees);
  return `<text class="${className}" x="${x}" y="${round(y + size * 0.36)}" font-size="${size}" text-anchor="middle">` +
    `${labelContent(name, size)}</text>`;
}

/**
 * Harmonic role of each key relative to the selected key on the circle: its dominant and subdominant, each spelled as the
 * key spells it (Db → subdominant Gb, B → dominant F#). Returns a map from key name to role.
 */
function harmonicRoles(selected) {
  if (!KEY_CIRCLE.flat().includes(selected)) {
    return new Map();
  }
  const { dominant, subdominant } = neighbourKeysOf(selected);
  return new Map([[dominant, 'dominant'], [subdominant, 'subdominant']]);
}

/**
 * One key as a wedge between two angles: the major key outside, its relative minor inside. The selected key is the
 * tonic and sticks out of the ring; otherwise a neighbour gets the colour of its harmonic role. A disabled key has no
 * tabindex, so neither the keyboard nor a click can focus it (a focused key would show a frame), and it says so to
 * assistive technology.
 */
function keyWedge(name, start, end, { selected, role, disabled, split, filter }) {
  const relative = minorNameOf(name);
  const state = selected ? ' is-on' : role ? ` is-${role}` : '';
  const access = disabled ? 'aria-disabled="true"' : 'tabindex="0"';
  const font = split ? SPLIT_FONT : FONT;
  const outer = OUTER_RADIUS + (selected ? SELECTED_LIFT : 0);
  const middle = (start + end) / 2;
  const wash = `filter="url(#${filter})"`;
  return `<g class="key${state}" data-action="set-key" data-key="${escapeHtml(name)}" ` +
    `role="button" ${access} aria-pressed="${selected}" aria-label="${escapeHtml(`${name} / ${relative}`)}">` +
    `<path class="major" d="${wedgePath(MIDDLE_RADIUS, outer, start, end)}" ${wash}/>` +
    `<path class="minor" d="${wedgePath(INNER_RADIUS, MIDDLE_RADIUS, start, end)}" ${wash}/>` +
    label('major', name, (MIDDLE_RADIUS + outer) / 2, middle, font.major) +
    label('relative', relative, (INNER_RADIUS + MIDDLE_RADIUS) / 2, middle, font.minor) +
    '</g>';
}

/**
 * One slot holds one key, or several enharmonic keys that share its wedge side by side, in the order of the circle
 * (clockwise), so that F# lies next to B and Gb next to Db.
 */
function slotWedges(names, index, { selected, roles, disabled, filter }) {
  const start = (index - 0.5) * SLOT_DEGREES;
  const width = SLOT_DEGREES / names.length;
  const split = names.length > 1;
  return names.map((name, i) => keyWedge(name, start + i * width, start + (i + 1) * width, {
    selected: name === selected, role: roles.get(name), disabled, split, filter,
  })).join('');
}

/**
 * Returns the SVG markup for the circle, highlighting the selected key (a major key, or null for none) and its
 * subdominant and dominant. A `disabled` circle (the circle of fifths switch is on, so every key is used) highlights no
 * key and is greyed out.
 */
export function renderCircleSvg(selectedKey, { disabled = false } = {}) {
  const selected = disabled ? null : selectedKey;
  const roles = harmonicRoles(selected);
  const filter = 'circle-wash';
  const wedges = KEY_CIRCLE.map((names, index) => slotWedges(names, index, { selected, roles, disabled, filter }));
  return `<svg class="circle${disabled ? ' is-disabled' : ''}" viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}" role="group" aria-label="Circle of fifths">` +
    washFilter(filter) +
    wedges.join('') +
    '</svg>';
}

// The arrow of the circle of fifths button: an open circle running counterclockwise from the top, round the left and the
// bottom, up the right side, where its head points up.
const CIRCLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M9.78 5.11A7 7 0 1 0 18 12V9.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M15.2 11.2 18 8.4l2.8 2.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

/**
 * The circle of fifths button, a round chip with a counterclockwise arrow. Pressed, every key gets one row,
 * counterclockwise from C (C, F, Bb, ...), so there are 12 rows; not pressed (the default), the selected key is used.
 * It shows the value of the exercise that is on, and is greyed out while the exercise fixes it.
 */
export function circleButton(state) {
  const on = exerciseState(state).circleOfFifths;
  const disabled = isUnavailable(state, 'circleOfFifths');
  return `<button type="button" class="chip circle-toggle${on ? ' is-on' : ''}" aria-pressed="${on}" ` +
    'data-action="toggle-circle-of-fifths" data-flag="circleOfFifths" aria-label="All keys, counterclockwise on the circle of fifths" ' +
    `title="All keys, counterclockwise on the circle of fifths"${disabled ? ' disabled' : ''}>${CIRCLE_ICON}</button>`;
}

/**
 * The circle of fifths left of the chords: the circle with the selected key, and the circle of fifths button in its
 * middle. While the button is on, every key is used, so the circle is greyed out and shows no key; the button stays
 * clickable, so that it can be switched off again.
 */
export function renderKeyCircle(state) {
  return renderCircleSvg(state.key, { disabled: isUnavailable(state, 'key') }) + circleButton(state);
}
