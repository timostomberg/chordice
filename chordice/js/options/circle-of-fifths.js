/**
 * Circle of fifths as SVG markup. Each button is one major key with its relative minor below it, e.g. "C" and "Am".
 * Enharmonic keys that share a slot (F#/Gb) are stacked vertically, one button each.
 * Each element carries data-action="toggle-key" and its own key name, so that clicks select exactly that key.
 */

import { KEY_CIRCLE, minorNameOf, neighbourKeysOf } from '../theory/keys.js';
import { escapeHtml } from '../escape.js';

const CENTER = 120;
const RADIUS = 92;
// Every key button has the same size, also when two enharmonic keys are stacked in one slot.
const BUTTON_RADIUS = 20;
const STACK_GAP = 2;
// The stacked pair at the bottom reaches below the ring, so the viewBox is taller than the ring needs.
const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 256;

function position(index) {
  const angle = ((-90 + index * 30) * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
}

/**
 * Harmonic role of each key relative to the first selected key on the circle: its dominant and subdominant,
 * each spelled as the key spells it (Db → subdominant Gb, B → dominant F#). Returns a map from key name to role.
 */
function harmonicRoles(selectedKeys) {
  const selected = KEY_CIRCLE.flat().find((name) => selectedKeys.includes(name));
  if (!selected) {
    return new Map();
  }
  const { dominant, subdominant } = neighbourKeysOf(selected);
  return new Map([[dominant, 'dominant'], [subdominant, 'subdominant']]);
}

/**
 * The selected key is blue; otherwise a neighbour gets the colour of its harmonic role. A disabled key has no tabindex, so
 * neither the keyboard nor a click can focus it (a focused key would show a frame), and it says so to assistive technology.
 */
function keyButton(name, x, y, radius, selected, role, disabled) {
  const relative = minorNameOf(name);
  const state = selected ? ' is-on' : role ? ` is-${role}` : '';
  const access = disabled ? 'aria-disabled="true"' : 'tabindex="0"';
  return `<g class="key${state}" data-action="toggle-key" data-key="${escapeHtml(name)}" ` +
    `role="button" ${access} aria-pressed="${selected}">` +
    `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius}"/>` +
    `<text class="major" x="${x.toFixed(2)}" y="${(y - 6).toFixed(2)}" text-anchor="middle" dominant-baseline="central">${escapeHtml(name)}</text>` +
    `<text class="relative" x="${x.toFixed(2)}" y="${(y + 8).toFixed(2)}" text-anchor="middle" dominant-baseline="central">${escapeHtml(relative)}</text>` +
    '</g>';
}

/** One slot holds one key, or several enharmonic keys that are stacked above each other. */
function slotButtons(names, index, selected, roles, disabled) {
  const { x, y } = position(index);
  if (names.length === 1) {
    return keyButton(names[0], x, y, BUTTON_RADIUS, selected.has(names[0]), roles.get(names[0]), disabled);
  }
  const spacing = 2 * BUTTON_RADIUS + STACK_GAP;
  return names.map((name, i) => {
    const offset = (i - (names.length - 1) / 2) * spacing;
    return keyButton(name, x, y + offset, BUTTON_RADIUS, selected.has(name), roles.get(name), disabled);
  }).join('');
}

/**
 * Returns the SVG markup for the circle, highlighting the selected key and its subdominant and dominant. A `disabled`
 * circle (the circle of fifths switch is on, so every key is used) highlights no key and is greyed out.
 */
export function renderCircleSvg(selectedKeys, { disabled = false } = {}) {
  const shown = disabled ? [] : selectedKeys;
  const selected = new Set(shown);
  const roles = harmonicRoles(shown);
  const buttons = KEY_CIRCLE.map((names, index) => slotButtons(names, index, selected, roles, disabled));
  return `<svg class="circle${disabled ? ' is-disabled' : ''}" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="group" aria-label="Circle of fifths">` +
    `<circle class="ring" cx="${CENTER}" cy="${CENTER}" r="${RADIUS + BUTTON_RADIUS + 4}"/>` +
    buttons.join('') +
    '</svg>';
}
