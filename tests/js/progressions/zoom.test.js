import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, bindZoom, blockZoom, clampZoom, pinchZoom, wheelZoom } from '../../../chordice/js/progressions/zoom.js';

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
  const css = readFileSync(new URL('../../../chordice/main.css', import.meta.url), 'utf8');
  const defaults = [...css.matchAll(/--zoom:\s*([\d.]+);/g)].map((match) => Number(match[1]));
  assert.equal(defaults.length, 2, 'light and dark theme each set the default');
  for (const value of defaults) {
    assert.equal(value, DEFAULT_ZOOM);
  }
});
