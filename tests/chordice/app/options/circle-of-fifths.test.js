import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCircleSvg } from '../../../../chordice/app/options/circle-of-fifths.js';

test('renderCircleSvg returns an accessible svg group', () => {
  const svg = renderCircleSvg(null);
  assert.ok(svg.startsWith('<svg class="circle"'));
  assert.ok(svg.includes('role="group" aria-label="Circle of fifths"'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('<circle class="ring"'));
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

test('renderCircleSvg has one button per major key, labelled with the relative minor', () => {
  const svg = renderCircleSvg(null);
  assert.equal(svg.split('data-action="set-key"').length - 1, 13);
  assert.ok(svg.includes('>C</text>'));
  assert.ok(svg.includes('>Am</text>'));
  assert.ok(svg.includes('>F#</text>'));
  assert.ok(svg.includes('>D#m</text>'));
  assert.ok(svg.includes('>Gb</text>'));
  assert.ok(svg.includes('>Ebm</text>'));
  assert.ok(!svg.includes('F#/Gb'));
  assert.ok(!svg.includes('data-key="Am"'));
});

test('renderCircleSvg stacks F# and Gb vertically in the same slot, each as its own button', () => {
  const svg = renderCircleSvg(null);
  const centre = (key) => {
    const group = svg.split(`data-key="${key}"`)[1];
    const circle = group.match(/<circle cx="([\d.]+)" cy="([\d.]+)"/);
    return { x: Number(circle[1]), y: Number(circle[2]) };
  };
  const sharp = centre('F#');
  const flat = centre('Gb');
  assert.equal(sharp.x, flat.x);
  assert.ok(flat.y > sharp.y);
  assert.ok(flat.y - sharp.y >= 32);
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

test('all key buttons on the circle have the same size, including the stacked F#/Gb pair, and fit inside the view', () => {
  const svg = renderCircleSvg('C');
  const keys = [...svg.matchAll(/<g class="key[^"]*"[^>]*><circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
    .map(([, cx, cy, r]) => ({ cy: Number(cy), r: Number(r) }));
  assert.equal(keys.length, 13);
  assert.deepEqual([...new Set(keys.map((key) => key.r))], [20]);
  const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)[1]);
  assert.ok(Math.min(...keys.map((key) => key.cy - key.r)) >= 0);
  assert.ok(Math.max(...keys.map((key) => key.cy + key.r)) <= height);
});
