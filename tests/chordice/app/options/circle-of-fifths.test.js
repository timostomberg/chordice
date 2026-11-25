import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelContent, renderCircleSvg, renderKeyCircle, wedgePath } from '../../../../chordice/app/options/circle-of-fifths.js';
import { defaultState } from '../../../../chordice/app/state/state.js';
import { LIBRARY } from '../../../helpers/fixtures.js';

test('renderCircleSvg returns an accessible svg group', () => {
  const svg = renderCircleSvg(null);
  assert.ok(svg.startsWith('<svg class="circle"'));
  assert.ok(svg.includes('role="group" aria-label="Circle of fifths"'));
  assert.ok(svg.endsWith('</svg>'));
});

test('renderCircleSvg highlights the selected key', () => {
  const svg = renderCircleSvg('C');
  assert.equal(svg.split('class="key is-on"').length - 1, 1);
  assert.ok(svg.includes('data-key="C"'));
});

test('renderCircleSvg marks no key as selected when none is given', () => {
  const svg = renderCircleSvg(null);
  assert.equal(svg.split('is-on').length - 1, 0);
  assert.equal(svg.split('aria-pressed="false"').length - 1, 13);
});

test('renderCircleSvg has one wedge per major key, the major key outside and the relative minor inside', () => {
  const svg = renderCircleSvg(null);
  assert.equal(svg.split('data-action="set-key"').length - 1, 13);
  assert.equal(svg.split('<path class="major"').length - 1, 13);
  assert.equal(svg.split('<path class="minor"').length - 1, 13);
  assert.ok(svg.includes('font-size="15" text-anchor="middle">C</text>'));
  assert.ok(svg.includes('text-anchor="middle">A<tspan class="minor-sign" font-size="8.4">m</tspan></text>'));
  assert.ok(svg.includes('aria-label="F# / D#m"'));
  assert.ok(svg.includes('aria-label="Gb / Ebm"'));
  assert.ok(!svg.includes('F#/Gb'));
  assert.ok(!svg.includes('data-key="Am"'));
});

test('labelContent raises the accidental and writes it as a music sign', () => {
  assert.equal(labelContent('C', 10), 'C');
  assert.equal(labelContent('Am', 10), 'A<tspan class="minor-sign" font-size="8">m</tspan>');
  assert.equal(labelContent('Ebm', 10),
    'E<tspan class="accidental" font-size="6.8" dy="-3.8">♭</tspan><tspan class="minor-sign" font-size="8" dy="3.8">m</tspan>');
  assert.equal(labelContent('Bb', 10), 'B<tspan class="accidental" font-size="6.8" dy="-3.8">♭</tspan>');
  assert.equal(labelContent('F#m', 10),
    'F<tspan class="accidental" font-size="6.8" dy="-3.8">♯</tspan><tspan class="minor-sign" font-size="8" dy="3.8">m</tspan>');
});

/** The centre of the major label of a key. */
const labelCentre = (svg, key) => {
  const group = svg.split(`data-key="${key}"`)[1];
  const text = group.match(/<text class="major" x="([\d.]+)" y="([\d.]+)"/);
  return { x: Number(text[1]), y: Number(text[2]) };
};

test('renderCircleSvg splits the enharmonic slot: F# on the side of B, Gb on the side of Db, each its own button', () => {
  const svg = renderCircleSvg(null);
  const sharp = labelCentre(svg, 'F#');
  const flat = labelCentre(svg, 'Gb');
  assert.ok(sharp.x > 120 && flat.x < 120);
  assert.equal(sharp.y, flat.y);
  assert.ok(labelCentre(svg, 'B').x > sharp.x);
  assert.ok(labelCentre(svg, 'Db').x < flat.x);
  assert.ok(svg.includes('font-size="12.5" text-anchor="middle">F<tspan'));
});

test('renderCircleSvg places C at the top and goes clockwise in fifths', () => {
  const svg = renderCircleSvg(null);
  const c = labelCentre(svg, 'C');
  assert.equal(c.x, 120);
  assert.ok(c.y < 40);
  assert.ok(labelCentre(svg, 'G').x > 120);
  assert.ok(labelCentre(svg, 'F').x < 120);
});

test('renderCircleSvg highlights only the selected key, not its enharmonic twin', () => {
  const svg = renderCircleSvg('Gb');
  assert.equal(svg.split('class="key is-on"').length - 1, 1);
  assert.ok(svg.includes('class="key is-on" data-action="set-key" data-key="Gb"'));
  assert.ok(svg.includes('data-key="F#" role="button" tabindex="0" aria-pressed="false"'));
});

test('renderCircleSvg ignores a selected key that is not on the circle', () => {
  for (const key of ['Am', 'H']) {
    const svg = renderCircleSvg(key);
    assert.equal(svg.split('is-on').length - 1, 0);
    assert.equal(svg.split('is-dominant').length - 1, 0);
  }
});

/** The opening tag and content of one key button, found by its data-key. */
const keyGroup = (svg, key) => svg.split('<g ').find((group) => group.includes(`data-key="${key}"`));

test('renderCircleSvg colours the dominant (clockwise) and subdominant (counter-clockwise) of the selected key', () => {
  const svg = renderCircleSvg('C');
  assert.equal(svg.split('is-dominant').length - 1, 1);
  assert.equal(svg.split('is-subdominant').length - 1, 1);
  assert.ok(keyGroup(svg, 'G').includes('is-dominant'));
  assert.ok(keyGroup(svg, 'F').includes('is-subdominant'));
  assert.ok(!keyGroup(svg, 'C').includes('is-dominant'));
  assert.ok(!keyGroup(svg, 'C').includes('is-subdominant'));
});

test('renderCircleSvg colours only the spelling of an enharmonic neighbour that the key uses: Db gives Gb, not F#', () => {
  const svg = renderCircleSvg('Db');
  assert.ok(keyGroup(svg, 'Gb').includes('is-subdominant'));
  assert.ok(!keyGroup(svg, 'F#').includes('is-subdominant'));
  assert.ok(keyGroup(svg, 'Ab').includes('is-dominant'));
});

test('renderCircleSvg colours only F# for B, whose dominant is spelled with a sharp', () => {
  const svg = renderCircleSvg('B');
  assert.ok(keyGroup(svg, 'F#').includes('is-dominant'));
  assert.ok(!keyGroup(svg, 'Gb').includes('is-dominant'));
  assert.ok(keyGroup(svg, 'E').includes('is-subdominant'));
});

test('renderCircleSvg wraps around the circle, so that the neighbours of F are C and Bb', () => {
  const svg = renderCircleSvg('F');
  assert.ok(keyGroup(svg, 'Bb').includes('is-subdominant'));
  assert.ok(keyGroup(svg, 'C').includes('is-dominant'));
});

test('renderCircleSvg colours no neighbours when no key is selected', () => {
  const svg = renderCircleSvg(null);
  assert.equal(svg.split('is-dominant').length - 1, 0);
  assert.equal(svg.split('is-subdominant').length - 1, 0);
});

test('renderCircleSvg keeps the selected key blue rather than a neighbour colour', () => {
  const svg = renderCircleSvg('G');
  assert.ok(keyGroup(svg, 'G').includes('class="key is-on"'));
  assert.ok(!keyGroup(svg, 'G').includes('is-dominant'));
  assert.ok(keyGroup(svg, 'D').includes('is-dominant'));
  assert.ok(keyGroup(svg, 'C').includes('is-subdominant'));
});

/** The outer radius of a path, as the largest distance of its points from the centre. */
const outerRadius = (d) => {
  const numbers = d.replace(/A[\d.]+ [\d.]+ 0 0 [01]/g, '').match(/-?[\d.]+/g).map(Number);
  let max = 0;
  for (let i = 0; i < numbers.length; i += 2) {
    max = Math.max(max, Math.hypot(numbers[i] - 120, numbers[i + 1] - 120));
  }
  return max;
};

test('the selected key sticks out of the ring, the other wedges end at the same radius, and all fit inside the view', () => {
  const svg = renderCircleSvg('C');
  const majors = [...svg.matchAll(/<g class="key([^"]*)"[^>]*><path class="major" d="([^"]+)"/g)]
    .map(([, state, d]) => ({ selected: state === ' is-on', radius: outerRadius(d) }));
  assert.equal(majors.length, 13);
  const others = [...new Set(majors.filter((key) => !key.selected).map((key) => Math.round(key.radius)))];
  assert.equal(others.length, 1);
  const lifted = majors.find((key) => key.selected).radius;
  assert.ok(lifted > others[0]);
  assert.ok(lifted <= 120);
  assert.ok(/viewBox="0 0 240 240"/.test(svg));
});

test('wedgePath keeps a gap between neighbouring wedges', () => {
  const left = wedgePath(80, 110, 0, 30);
  const right = wedgePath(80, 110, 30, 60);
  const xs = (d) => d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2 === 0);
  assert.ok(left.startsWith('M') && left.endsWith('Z'));
  assert.notEqual(left, right);
  assert.ok(Math.max(...xs(left).filter((x) => x > 120)) < 120 + 110);
});

test('renderCircleSvg defines the watercolour filter of the wedges once, with the bloom and the rim', () => {
  for (const disabled of [false, true]) {
    const svg = renderCircleSvg('C', { disabled });
    assert.equal(svg.split('<filter id="circle-wash"').length - 1, 1);
    assert.ok(svg.includes('class="wash-bloom"'));
    assert.ok(svg.includes('class="wash-rim"'));
    assert.ok(svg.indexOf('<defs>') < svg.indexOf('<g class="key'), 'the filter comes before the wedges');
  }
});

test('the watercolour filter of the wedges lays soft clouds like the buttons, not a grain of specks', () => {
  const svg = renderCircleSvg('C', {});
  assert.equal(svg.split('<feTurbulence').length - 1, 1, 'one layer of clouds');
  const frequency = Number(/<feTurbulence[^>]*baseFrequency="([\d.]+)"/.exec(svg)[1]);
  assert.ok(frequency > 0 && frequency < 0.1, 'a low frequency: clouds, not specks');
  assert.ok(svg.includes('class="wash-clouds"'), 'in the colour of the theme');
  assert.ok(svg.includes('<filter id="circle-wash"') && /<filter[^>]*color-interpolation-filters="sRGB"/.test(svg), 'colours as written');
});

test('every wedge, major and minor, carries the watercolour filter of the circle', () => {
  const svg = renderCircleSvg('C', {});
  const wedges = svg.split('<path ').length - 1;
  assert.equal(svg.split('filter="url(#circle-wash)"').length - 1, wedges);
});

test('renderKeyCircle shows the circle with the selected key and the circle of fifths button in its middle', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), key: 'G' };
  const html = renderKeyCircle(state);
  assert.ok(html.startsWith('<svg class="circle"'));
  assert.ok(html.includes('class="key is-on" data-action="set-key" data-key="G"'));
  // After the circle, so that it lies over its middle.
  assert.ok(html.includes('</svg><button type="button" class="chip circle-toggle" aria-pressed="false" ' +
    'data-action="toggle-circle-of-fifths" data-flag="circleOfFifths"'));
  assert.ok(/circle-toggle[^>]*><svg/.test(html), 'the button shows the arrow, and no text');
  assert.ok(html.endsWith('</svg></button>'));
});

test('with the circle of fifths switch on, the circle shows no key and is greyed out, and the button stays clickable', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), key: 'G', circleOfFifths: true };
  const html = renderKeyCircle(state);
  assert.ok(html.includes('<svg class="circle is-disabled"'));
  assert.ok(!html.includes('class="key is-'), 'no key is selected or highlighted');
  assert.ok(html.includes('aria-disabled="true"'));
  assert.ok(/class="chip circle-toggle is-on" aria-pressed="true"[^>]*title="[^"]*">/.test(html), 'not disabled');
});

test('while an exercise switches the circle of fifths on, its button is pressed and greyed out', () => {
  const state = { ...defaultState(LIBRARY, () => 0.5), circleOfFifths: false, exercise: 'circle-ii-v-i' };
  const html = renderKeyCircle(state);
  assert.ok(html.includes('class="chip circle-toggle is-on" aria-pressed="true"'));
  assert.ok(/circle-toggle[^>]*disabled/.test(html));
  assert.ok(html.includes('<svg class="circle is-disabled"'));
});

test('the rim of the wedges is denser at the bottom, and the bloom lies towards the top left, as on the buttons', () => {
  const svg = renderCircleSvg('C', {});
  const offsets = [...svg.matchAll(/<feOffset[^>]*dx="(-?[\d.]+)" dy="(-?[\d.]+)"/g)].map((match) => [Number(match[1]), Number(match[2])]);
  assert.equal(offsets.length, 2);
  assert.ok(offsets.every(([dx, dy]) => dx < 0 && dy < 0));
});
