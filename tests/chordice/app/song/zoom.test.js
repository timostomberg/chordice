import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  bindZoom,
  blockZoom,
  clampZoom,
  fittedZoom,
  measureRows,
  measureSong,
  pinchZoom,
  wheelZoom,
} from '../../../../chordice/app/song/zoom.js';

/** A minimal element that records its listeners so that tests can fire events at it. */
function fakeArea() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, listener) {
      (listeners[type] ??= []).push(listener);
    },
    fire(type, event) {
      let prevented = false;
      const full = { preventDefault: () => { prevented = true; }, ...event };
      for (const listener of listeners[type] ?? []) {
        listener(full);
      }
      return prevented;
    },
  };
}

/** A surface whose style records custom properties, as the DOM's CSSStyleDeclaration does with setProperty. */
function fakeSurface() {
  const style = {
    setProperty(name, value) {
      style[name] = value;
    },
  };
  return { style };
}

const touch = (clientX, clientY) => ({ clientX, clientY });

test('clampZoom keeps the scale between the minimum and the maximum', () => {
  assert.equal(clampZoom(0.1), MIN_ZOOM);
  assert.equal(clampZoom(10), MAX_ZOOM);
  assert.equal(clampZoom(1.2), 1.2);
});

test('wheelZoom zooms in when scrolling up and out when scrolling down', () => {
  assert.ok(wheelZoom(1, -100) > 1);
  assert.ok(wheelZoom(1, 100) < 1);
  assert.equal(wheelZoom(1, 0), 1);
});

test('wheelZoom treats line-based wheel events like pixels', () => {
  assert.ok(Math.abs(wheelZoom(1, 3, 1) - wheelZoom(1, 48, 0)) < 1e-12);
});

test('wheelZoom never leaves the zoom range', () => {
  assert.equal(wheelZoom(MAX_ZOOM, -10000), MAX_ZOOM);
  assert.equal(wheelZoom(MIN_ZOOM, 10000), MIN_ZOOM);
});

test('pinchZoom scales with the change of the finger distance', () => {
  assert.equal(pinchZoom(1, 100, 150), 1.5);
  assert.equal(pinchZoom(2, 100, 50), 1);
  assert.equal(pinchZoom(1, 0, 150), 1);
});

test('Ctrl + scroll zooms only the surface of its own area and stops the page from zooming', () => {
  const options = fakeArea();
  const optionList = fakeSurface();
  bindZoom(options, optionList);
  const prevented = options.fire('wheel', { ctrlKey: true, deltaY: -100, deltaMode: 0 });
  assert.equal(prevented, true);
  assert.equal(optionList.style['--zoom'], String(wheelZoom(DEFAULT_ZOOM, -100)));
});

test('scroll without Ctrl scrolls normally and does not zoom', () => {
  const area = fakeArea();
  const surface = fakeSurface();
  const zoom = bindZoom(area, surface);
  assert.equal(area.fire('wheel', { ctrlKey: false, deltaY: -100, deltaMode: 0 }), false);
  assert.equal(surface.style['--zoom'], undefined);
  assert.equal(zoom.scale, DEFAULT_ZOOM);
});

test('two independent areas keep their own zoom', () => {
  const options = fakeArea();
  const chords = fakeArea();
  const optionList = fakeSurface();
  const rows = fakeSurface();
  bindZoom(options, optionList);
  bindZoom(chords, rows);
  chords.fire('wheel', { ctrlKey: true, deltaY: -300, deltaMode: 0 });
  assert.equal(rows.style['--zoom'], String(wheelZoom(DEFAULT_ZOOM, -300)));
  assert.equal(optionList.style['--zoom'], undefined);
});

test('a two-finger pinch zooms the surface by the change of the distance between the fingers', () => {
  const area = fakeArea();
  const surface = fakeSurface();
  bindZoom(area, surface);
  area.fire('touchstart', { touches: [touch(0, 0), touch(100, 0)] });
  const prevented = area.fire('touchmove', { touches: [touch(0, 0), touch(150, 0)] });
  assert.equal(prevented, true);
  assert.equal(surface.style['--zoom'], String(pinchZoom(DEFAULT_ZOOM, 100, 150)));
  area.fire('touchmove', { touches: [touch(0, 0), touch(50, 0)] });
  assert.equal(surface.style['--zoom'], '0.7');
});

test('a pinch starts from the scale the surface already has', () => {
  const area = fakeArea();
  const surface = fakeSurface();
  bindZoom(area, surface);
  area.fire('wheel', { ctrlKey: true, deltaY: -300, deltaMode: 0 });
  const before = Number(surface.style['--zoom']);
  area.fire('touchstart', { touches: [touch(0, 0), touch(100, 0)] });
  area.fire('touchmove', { touches: [touch(0, 0), touch(100, 0)] });
  assert.ok(Math.abs(Number(surface.style['--zoom']) - before) < 1e-9);
});

test('a single finger does not zoom and the page is not prevented from scrolling', () => {
  const area = fakeArea();
  const surface = fakeSurface();
  bindZoom(area, surface);
  area.fire('touchstart', { touches: [touch(0, 0)] });
  assert.equal(area.fire('touchmove', { touches: [touch(0, 50)] }), false);
  assert.equal(surface.style['--zoom'], undefined);
});

test('lifting a finger ends the pinch', () => {
  const area = fakeArea();
  const surface = fakeSurface();
  bindZoom(area, surface);
  area.fire('touchstart', { touches: [touch(0, 0), touch(100, 0)] });
  area.fire('touchend', { touches: [touch(0, 0)] });
  assert.equal(area.fire('touchmove', { touches: [touch(0, 0), touch(300, 0)] }), false);
  assert.equal(surface.style['--zoom'], undefined);
});

test('blockZoom stops Ctrl + scroll from zooming the page, and leaves plain scrolling alone', () => {
  const area = fakeArea();
  blockZoom(area);
  assert.equal(area.fire('wheel', { ctrlKey: true, deltaY: -100, deltaMode: 0 }), true);
  assert.equal(area.fire('wheel', { ctrlKey: false, deltaY: -100, deltaMode: 0 }), false);
});

test('the chords start at a zoom above 100%, and the stylesheet shows the same default', () => {
  assert.ok(DEFAULT_ZOOM > 1 && DEFAULT_ZOOM <= MAX_ZOOM);
  const css = readFileSync(new URL('../../../../chordice/styles/main.css', import.meta.url), 'utf8');
  const defaults = [...css.matchAll(/--zoom:\s*([\d.]+);/g)].map((match) => Number(match[1]));
  assert.equal(defaults.length, 2, 'light and dark theme each set the default');
  for (const value of defaults) {
    assert.equal(value, DEFAULT_ZOOM);
  }
});

test('fittedZoom keeps the wanted scale while the content fits, and zooms out just far enough when it does not', () => {
  assert.equal(fittedZoom(1.2, 500, 800), 1.2);
  assert.equal(fittedZoom(1.2, 500, 500), 1);
  assert.ok(fittedZoom(1.2, 500, 501) <= 501 / 500);
  // Never below the minimum: on a very narrow area the chords wrap instead.
  assert.equal(fittedZoom(1.2, 1000, 100), MIN_ZOOM);
  // The user's own smaller scale wins.
  assert.equal(fittedZoom(0.8, 500, 500), 0.8);
});

test('fittedZoom shows the wanted scale without a measurement', () => {
  assert.equal(fittedZoom(1.2, 0, 500), 1.2);
  assert.equal(fittedZoom(1.2, 500, 0), 1.2);
  assert.equal(fittedZoom(1.2, Number.NaN, 500), 1.2);
});

test('bindZoom fits the shown scale to the room, and keeps the chosen scale for when there is room again', () => {
  const area = fakeArea();
  const surface = fakeSurface();
  let available = 400;
  // The content needs 500px at the scale 1.
  const zoom = bindZoom(area, surface, { measure: () => ({ needed: 500, available }) });
  zoom.fit();
  assert.equal(zoom.shown, 0.8);
  assert.equal(surface.style['--zoom'], '0.8');
  assert.equal(zoom.scale, DEFAULT_ZOOM, 'the chosen scale stays');
  available = 1000;
  zoom.fit();
  assert.equal(zoom.shown, DEFAULT_ZOOM);
  // Zooming in (here with Ctrl + scroll) is capped by the room too.
  available = 600;
  area.fire('wheel', { ctrlKey: true, deltaY: -300, deltaMode: 0 });
  assert.equal(zoom.scale, DEFAULT_ZOOM * 2);
  assert.equal(zoom.shown, 1.2);
});

test('bindZoom shows the chosen scale when nothing can be measured', () => {
  const surface = fakeSurface();
  const zoom = bindZoom(fakeArea(), surface, { measure: () => null });
  zoom.fit();
  assert.equal(surface.style['--zoom'], String(DEFAULT_ZOOM));
});

test('measureRows takes the widest row of chords, as on one line, at the scale 1, and the room inside the padding', () => {
  const dom = new JSDOM('<!DOCTYPE html><section id="area"><div id="surface">' +
    '<ol class="chords"><li></li><li></li></ol><ol class="chords"><li></li><li></li><li></li></ol></div></section>');
  const { document } = dom.window;
  const area = document.getElementById('area');
  const surface = document.getElementById('surface');
  // jsdom has no layout, so the sizes are given here.
  Object.defineProperty(area, 'clientWidth', { value: 600 });
  area.style.padding = '0 16px';
  for (const row of surface.querySelectorAll('.chords')) {
    row.style.columnGap = '10px';
    for (const chord of row.children) {
      chord.getBoundingClientRect = () => ({ width: 100 });
    }
  }
  // The widest row: 3 chords of 100px and 2 gaps of 10px at the scale 2.
  assert.deepEqual(measureRows(area, surface, 2), { needed: 160, available: 568 });
});

test('measureRows gives nothing without a page to measure', () => {
  assert.equal(measureRows(fakeArea(), fakeSurface(), 1), null);
});

/** A song area with two rows of chords and the circle of fifths beside them, as jsdom has no layout: the sizes are given. */
function songPage(direction, areaHeight = 2000) {
  const dom = new JSDOM('<!DOCTYPE html><section id="area"><div id="body"><div id="circle"></div>' +
    '<ol class="chords"><li></li><li></li><li></li></ol></div></section>');
  const { document } = dom.window;
  const area = document.getElementById('area');
  const body = document.getElementById('body');
  const circle = document.getElementById('circle');
  Object.defineProperty(area, 'clientWidth', { value: 1000 });
  Object.defineProperty(area, 'clientHeight', { value: areaHeight });
  body.style.flexDirection = direction;
  body.style.columnGap = '20px';
  circle.getBoundingClientRect = () => ({ width: 300, height: 300 });
  for (const chord of body.querySelectorAll('.chords li')) {
    chord.getBoundingClientRect = () => ({ width: 100 });
  }
  return { area, body, circle };
}

test('measureSong counts the circle beside the chords and the gap to it, at the scale 1, so both zoom out together', () => {
  const { area, body, circle } = songPage('row');
  // The chords: 3 × 100px; the circle 300px and the gap 20px, all at the scale 2.
  assert.deepEqual(measureSong(area, body, circle, 2), { needed: 150 + 160, available: 1000 });
});

test('measureSong fits the circle beside the chords into the height of a low, wide area, e.g. a phone held sideways', () => {
  // The circle is 150px high at the scale 1 and the area 120px: the height, not the width, limits the scale.
  const { area, body, circle } = songPage('row', 120);
  const size = measureSong(area, body, circle, 2);
  assert.deepEqual(size, { needed: 150, available: 120 });
  assert.equal(fittedZoom(1.2, size.needed, size.available), 0.8);
});

test('measureSong leaves the height out while the circle stands above the chords', () => {
  const { area, body, circle } = songPage('column', 120);
  assert.deepEqual(measureSong(area, body, circle, 2), { needed: 150, available: 1000 });
});

test('measureSong leaves the circle out while it stands above the chords', () => {
  const { area, body, circle } = songPage('column');
  assert.deepEqual(measureSong(area, body, circle, 2), { needed: 150, available: 1000 });
});

test('measureSong gives nothing without a page to measure', () => {
  assert.equal(measureSong(fakeArea(), fakeSurface(), {}, 1), null);
});
