import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  COLUMNS_MIN_ZOOM,
  MIN_ZOOM,
  bindSongZoom,
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

test('fittedZoom zooms out below MIN_ZOOM where the measurement allows it, e.g. for two columns side by side', () => {
  assert.ok(COLUMNS_MIN_ZOOM < MIN_ZOOM);
  assert.equal(fittedZoom(1.2, 1000, 500, COLUMNS_MIN_ZOOM), 0.5);
  assert.equal(fittedZoom(1.2, 1000, 100, COLUMNS_MIN_ZOOM), COLUMNS_MIN_ZOOM);
  assert.equal(fittedZoom(1.2, 1000, 500), MIN_ZOOM, 'without one, MIN_ZOOM holds');
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

/** A song area with its rows in two columns, the left one with rows of 2 and 3 chords, the right one with 1 chord. */
function twoColumns(direction) {
  const dom = new JSDOM('<!DOCTYPE html><section id="area"><div id="surface"><div class="song-columns">' +
    '<div class="song-column"><ol class="chords"><li></li><li></li></ol><ol class="chords"><li></li><li></li><li></li></ol></div>' +
    '<div class="song-column"><ol class="chords"><li></li></ol></div></div></div></section>');
  const { document } = dom.window;
  const area = document.getElementById('area');
  const surface = document.getElementById('surface');
  Object.defineProperty(area, 'clientWidth', { value: 1000 });
  const columns = surface.querySelector('.song-columns');
  columns.style.flexDirection = direction;
  columns.style.columnGap = '40px';
  for (const chord of surface.querySelectorAll('.chords li')) {
    chord.getBoundingClientRect = () => ({ width: 100 });
  }
  return { area, surface };
}

test('measureRows adds the widest rows of two columns side by side and the gap between them', () => {
  const { area, surface } = twoColumns('row');
  // The left column 300px wide, the right one 100px, and the gap 40px, at the scale 2.
  assert.deepEqual(measureRows(area, surface, 2), { needed: 220, available: 1000, min: COLUMNS_MIN_ZOOM });
});

test('measureRows takes the widest row only while the columns stand one below the other', () => {
  const { area, surface } = twoColumns('column');
  assert.deepEqual(measureRows(area, surface, 2), { needed: 150, available: 1000 });
});

test('measureSong keeps the least scale of two columns, so they zoom out further to fit beside the circle', () => {
  const { area, surface } = twoColumns('row');
  const body = surface.ownerDocument.createElement('div');
  const circle = surface.ownerDocument.createElement('div');
  body.append(circle);
  area.append(body);
  body.style.columnGap = '20px';
  circle.getBoundingClientRect = () => ({ width: 300, height: 300 });
  Object.defineProperty(area, 'clientHeight', { value: 2000 });
  // The circle and the gap: 320px at the scale 1, shown at DEFAULT_ZOOM, as there is room.
  assert.deepEqual(measureSong(area, body, circle, surface, 2, 1),
    { needed: 220, available: 1000 - 320 * DEFAULT_ZOOM, min: COLUMNS_MIN_ZOOM, circleZoom: DEFAULT_ZOOM });
});

test('bindZoom zooms two columns out below MIN_ZOOM until they fit side by side', () => {
  const surface = fakeSurface();
  const zoom = bindZoom(fakeArea(), surface, { measure: () => ({ needed: 2000, available: 1000, min: COLUMNS_MIN_ZOOM }) });
  zoom.fit();
  assert.equal(zoom.shown, 0.5);
  assert.equal(surface.style['--zoom'], '0.5');
});

test('measureRows gives nothing without a page to measure', () => {
  assert.equal(measureRows(fakeArea(), fakeSurface(), 1), null);
});

/**
 * A song area with the circle of fifths beside a row of three chords, as jsdom has no layout: the sizes are given. The
 * chords show the scale 2 (3 × 100px, 150px at the scale 1), the circle the scale 1.2 (216px, 180px at the scale 1, and the
 * gap 24px, 20px at the scale 1). The rows are 400px high (200px at the scale 1).
 */
function songPage(direction, { width = 1000, height = 2000 } = {}) {
  const dom = new JSDOM('<!DOCTYPE html><section id="area"><div id="body"><div id="circle"></div>' +
    '<div id="chords"><div id="rows"><ol class="chords"><li></li><li></li><li></li></ol></div></div></div></section>');
  const { document } = dom.window;
  const area = document.getElementById('area');
  const body = document.getElementById('body');
  const circle = document.getElementById('circle');
  const chords = document.getElementById('chords');
  const rows = document.getElementById('rows');
  Object.defineProperty(area, 'clientWidth', { value: width });
  Object.defineProperty(area, 'clientHeight', { value: height });
  body.style.flexDirection = direction;
  body.style.columnGap = '24px';
  // The sizes follow the scales that are set, as in a browser: until one is set, the chords show 2 and the circle 1.2.
  const chordZoom = () => Number(chords.style.getPropertyValue('--zoom')) || 2;
  const circleZoom = () => Number(body.style.getPropertyValue('--circle-zoom')) || 1.2;
  circle.getBoundingClientRect = () => ({ width: 180 * circleZoom(), height: 180 * circleZoom() });
  body.style.columnGap = '24px';
  rows.getBoundingClientRect = () => ({ width: 150 * chordZoom(), height: 200 * chordZoom() });
  for (const chord of rows.querySelectorAll('.chords li')) {
    chord.getBoundingClientRect = () => ({ width: 50 * chordZoom() });
  }
  return { area, body, circle, chords, rows };
}

const measure = ({ area, body, circle, rows }, options) => measureSong(area, body, circle, rows, 2, 1.2, options);

test('measureSong keeps the size of the circle where there is room, and gives the chords the room beside it and the gap', () => {
  // The circle and the gap: 200px at the scale 1, 240px at DEFAULT_ZOOM.
  assert.deepEqual(measure(songPage('row')), { needed: 150, available: 760, circleZoom: 1.2 });
});

test('measureSong makes the circle smaller where it and the chords at the scale 1 do not fit side by side', () => {
  // 150 + 180 + 20 = 350px at the scale 1 into 300px: 0.85, and the chords have what is left beside the circle.
  assert.deepEqual(measure(songPage('row', { width: 300 })), { needed: 150, available: 300 - 200 * 0.85, circleZoom: 0.85 });
});

test('measureSong fits the circle into the height of a low, wide area, e.g. a phone held sideways', () => {
  // The circle is 180px high at the scale 1 and the area 120px.
  assert.deepEqual(measure(songPage('row', { height: 120 })), { needed: 150, available: 1000 - 200 * 0.66, circleZoom: 0.66 });
});

test('measureSong fits the whole song into the height of the area as well, where that limits the scale more', () => {
  // The rows are 200px high at the scale 1 and the area 300px: 1.5, less than the 760 / 150 of the width.
  assert.deepEqual(measure(songPage('row', { height: 300 }), { whole: true }), { needed: 200, available: 300, circleZoom: 1.2 });
  // In a high area the width limits it.
  assert.deepEqual(measure(songPage('row'), { whole: true }), { needed: 150, available: 760, circleZoom: 1.2 });
});

test('measureSong leaves the circle and the height out while the circle stands above the chords', () => {
  const page = songPage('column', { height: 120 });
  assert.deepEqual(measure(page), { needed: 150, available: 1000, circleZoom: DEFAULT_ZOOM });
  assert.deepEqual(measure(page, { whole: true }), { needed: 150, available: 1000, circleZoom: DEFAULT_ZOOM });
});

test('bindZoom fitAll forgets the chosen scale and fits the content at most at DEFAULT_ZOOM', () => {
  const area = fakeArea();
  const surface = fakeSurface();
  const zoom = bindZoom(area, surface, { measure: () => null, measureAll: () => ({ needed: 1000, available: 5000 }) });
  area.fire('wheel', { ctrlKey: true, deltaY: -300, deltaMode: 0 });
  assert.ok(zoom.scale > DEFAULT_ZOOM);
  zoom.fitAll();
  assert.equal(zoom.shown, DEFAULT_ZOOM, 'not zoomed in beyond the default, although there is room');
  assert.equal(zoom.scale, DEFAULT_ZOOM);
});

test('bindZoom fitAll measures again at the new scale, as rows wrapped at the old one are taller than once fitted', () => {
  const surface = fakeSurface();
  // At the default scale the rows wrap and need 1000px at the scale 1; once smaller, they need 600px.
  const measureAll = (zoom) => ({ needed: zoom >= DEFAULT_ZOOM ? 1000 : 600, available: 600, min: COLUMNS_MIN_ZOOM });
  const zoom = bindZoom(fakeArea(), surface, { measure: () => null, measureAll });
  zoom.fitAll();
  assert.equal(zoom.shown, 1);
  assert.equal(zoom.scale, 1, 'the fitted scale is the chosen one from now on');
  assert.equal(surface.style['--zoom'], '1');
});

test('bindSongZoom zooms the chords only, and gives the circle its own size on the body', () => {
  const page = songPage('row', { width: 300 });
  // The chords show DEFAULT_ZOOM, as before the first fit.
  page.chords.style.setProperty('--zoom', String(DEFAULT_ZOOM));
  const zoom = bindSongZoom(page.area, page.body, page.circle, page.chords, page.rows);
  zoom.fit();
  // The circle: 0.85, as in the measurement above; the chords: the 130px left beside it for 150px at the scale 1.
  assert.equal(zoom.shown, 0.86);
  assert.equal(page.chords.style.getPropertyValue('--zoom'), '0.86');
  assert.equal(page.body.style.getPropertyValue('--zoom'), '', 'the circle is not zoomed with the chords');
  assert.equal(page.body.style.getPropertyValue('--circle-zoom'), '0.85');
  assert.equal(zoom.circleZoom, 0.85);
});

test('bindSongZoom fits every row at once beside the circle, but keeps the chosen scale above it', () => {
  const beside = songPage('row', { height: 300 });
  const besideZoom = bindSongZoom(beside.area, beside.body, beside.circle, beside.chords, beside.rows);
  besideZoom.fitAll();
  // The rows: 200px high at the scale 1, into 300px of height: room enough for DEFAULT_ZOOM.
  assert.equal(besideZoom.shown, 1.2);
  const tooLow = songPage('row', { height: 160 });
  const lowZoom = bindSongZoom(tooLow.area, tooLow.body, tooLow.circle, tooLow.chords, tooLow.rows);
  lowZoom.fitAll();
  assert.equal(lowZoom.shown, 0.8, 'zoomed out so that every row fits into the 160px of height');
  const above = songPage('column', { height: 160 });
  const aboveZoom = bindSongZoom(above.area, above.body, above.circle, above.chords, above.rows);
  above.area.dispatchEvent(Object.assign(new above.area.ownerDocument.defaultView.Event('wheel', { cancelable: true }),
    { ctrlKey: true, deltaY: -300, deltaMode: 0 }));
  const chosen = aboveZoom.scale;
  assert.ok(chosen > DEFAULT_ZOOM);
  aboveZoom.fitAll();
  assert.equal(aboveZoom.scale, chosen, 'above the chords, a change of the rows keeps the chosen scale');
});

test('measureSong gives nothing without a page to measure', () => {
  assert.equal(measureSong(fakeArea(), fakeSurface(), {}, fakeSurface(), 1, 1), null);
});
