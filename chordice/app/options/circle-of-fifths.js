/**
 * Circle of fifths as SVG markup: a ring of wedges, one per major key. The outer part of a wedge names the major key, the
 * inner part its relative minor, e.g. "C" and "Am". The enharmonic slot at the bottom (F#/Gb) is split into two half
 * wedges, F# on the side of B and Gb on the side of Db, one button each.
 * Each wedge carries data-action="set-key" and its own key name, so that clicks select exactly that key.
 */

import { KEY_CIRCLE, minorNameOf, neighbourKeysOf } from '../../music/theory/keys.js';
import { escapeHtml } from '../escape.js';
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
function keyWedge(name, start, end, { selected, role, disabled, split }) {
  const relative = minorNameOf(name);
  const state = selected ? ' is-on' : role ? ` is-${role}` : '';
  const access = disabled ? 'aria-disabled="true"' : 'tabindex="0"';
  const font = split ? SPLIT_FONT : FONT;
  const outer = OUTER_RADIUS + (selected ? SELECTED_LIFT : 0);
  const middle = (start + end) / 2;
  return `<g class="key${state}" data-action="set-key" data-key="${escapeHtml(name)}" ` +
    `role="button" ${access} aria-pressed="${selected}" aria-label="${escapeHtml(`${name} / ${relative}`)}">` +
    `<path class="major" d="${wedgePath(MIDDLE_RADIUS, outer, start, end)}"/>` +
    `<path class="minor" d="${wedgePath(INNER_RADIUS, MIDDLE_RADIUS, start, end)}"/>` +
    label('major', name, (MIDDLE_RADIUS + outer) / 2, middle, font.major) +
    label('relative', relative, (INNER_RADIUS + MIDDLE_RADIUS) / 2, middle, font.minor) +
    '</g>';
}

/**
 * One slot holds one key, or several enharmonic keys that share its wedge side by side, in the order of the circle
 * (clockwise), so that F# lies next to B and Gb next to Db.
 */
function slotWedges(names, index, selected, roles, disabled) {
  const start = (index - 0.5) * SLOT_DEGREES;
  const width = SLOT_DEGREES / names.length;
  const split = names.length > 1;
  return names.map((name, i) => keyWedge(name, start + i * width, start + (i + 1) * width, {
    selected: name === selected, role: roles.get(name), disabled, split,
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
  const wedges = KEY_CIRCLE.map((names, index) => slotWedges(names, index, selected, roles, disabled));
  return `<svg class="circle${disabled ? ' is-disabled' : ''}" viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}" role="group" aria-label="Circle of fifths">` +
    wedges.join('') +
    '</svg>';
}
