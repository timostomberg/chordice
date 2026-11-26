/**
 * Zoom for one area of the page. Ctrl + scroll (a trackpad pinch arrives as Ctrl + scroll too) and a two-finger
 * pinch on a touch screen scale only the surface inside the area. The rest of the page keeps its size.
 * The scale is passed on as the custom property --zoom of the surface; the stylesheet multiplies the sizes of the
 * surface's text and boxes by it, so that the text grows together with the boxes.
 * When the area is too narrow for the scale the user chose, the surface zooms out by itself, just far enough that its
 * widest row of chords fits on one line (but not below MIN_ZOOM). While the rows stand in two columns side by side, it
 * zooms out further, down to COLUMNS_MIN_ZOOM, so that both columns fit beside each other. The chosen scale is kept: once
 * there is room again, the surface zooms back in to it.
 * In the song area only the chords zoom (see bindSongZoom): the circle of fifths beside them keeps its own size, which only
 * gets smaller where the room is too little for it. When the number of rows changes, the chords are fitted so that all of
 * them can be seen at once, without scrolling (but at most at DEFAULT_ZOOM).
 */

export const MIN_ZOOM = 0.7;
/** The least scale the surface zooms out to by itself so that two columns of rows fit side by side. */
export const COLUMNS_MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2.5;
/** The zoom of a surface before the first Ctrl + scroll or pinch. The stylesheet's --zoom default must match it. */
export const DEFAULT_ZOOM = 1.2;

// Pixels of wheel movement per zoom doubling, and the size of one line in Firefox's line-based wheel events.
const WHEEL_PIXELS_PER_OCTAVE = 300;
const PIXELS_PER_LINE = 16;

export function clampZoom(scale) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/**
 * The scale to show: the wanted scale, or less when the content would not fit. `needed` is the width the content takes
 * at the scale 1, `available` the width there is room for. Without a measurement (needed of 0) the wanted scale is
 * shown. It never goes below `min` (MIN_ZOOM unless the measurement asks for less), so on a very narrow area the chords
 * wrap onto further lines instead.
 */
export function fittedZoom(wanted, needed, available, min = MIN_ZOOM) {
  if (!(needed > 0) || !(available > 0)) {
    return wanted;
  }
  return Math.max(min, Math.min(wanted, roundDown(available / needed)));
}

/**
 * Measures the widest row of chords in `surface` and the room for it in `area`, both in pixels. `zoom` is the scale the
 * surface shows now, so the width is divided by it to give the width at the scale 1. The chords of a row may wrap; the
 * width of a row is the sum of its chords and the gaps between them, as on one line. While the rows stand in two columns
 * side by side (see renderSong), the width is that of the widest row of each column, with the gap between the columns,
 * and the measurement allows zooming out down to COLUMNS_MIN_ZOOM (`min`) to fit them. Returns null without a layout.
 */
export function measureRows(area, surface, zoom) {
  const view = area.ownerDocument?.defaultView;
  if (!view?.getComputedStyle || typeof surface.querySelectorAll !== 'function') {
    return null;
  }
  const px = (value) => Number.parseFloat(value) || 0;
  const areaStyle = view.getComputedStyle(area);
  const available = area.clientWidth - px(areaStyle.paddingLeft) - px(areaStyle.paddingRight);
  const widestRow = (part) => {
    let widest = 0;
    for (const row of part.querySelectorAll('.chords')) {
      const chords = [...row.children];
      const gap = px(view.getComputedStyle(row).columnGap);
      const width = chords.reduce((sum, chord) => sum + chord.getBoundingClientRect().width, 0) +
        gap * Math.max(0, chords.length - 1);
      widest = Math.max(widest, width);
    }
    return widest;
  };
  const columns = surface.querySelector('.song-columns');
  const columnsStyle = columns && view.getComputedStyle(columns);
  if (columns && !columnsStyle.flexDirection.startsWith('column')) {
    const parts = [...columns.querySelectorAll('.song-column')];
    const width = parts.reduce((sum, part) => sum + widestRow(part), 0) +
      px(columnsStyle.columnGap) * Math.max(0, parts.length - 1);
    return { needed: width / zoom, available, min: COLUMNS_MIN_ZOOM };
  }
  return { needed: widestRow(surface) / zoom, available };
}

/** Rounds a scale down to hundredths, so that rounding in the layout does not wrap the last chord. */
const roundDown = (scale) => Math.floor(scale * 100) / 100;

/** How far `needed` can be scaled to fit into `available`; Infinity without a measurement. */
const ratioOf = ({ needed, available }) => (needed > 0 && available > 0 ? available / needed : Infinity);

/**
 * Measures the song: the chords in `rows` (as measureRows does) and the circle of fifths beside them. `zoom` is the scale
 * the chords show now, `circleZoom` the one the circle shows now. Returns the measurement of the chords for fittedZoom
 * and `circleZoom`, the size the circle is to take, or null without a layout.
 * While the circle stands left of the chords (the body is laid out in a row), it keeps the size of DEFAULT_ZOOM, unless
 * the room is too little for it: it then gets smaller just far enough that it fits into the height of the area (it stays
 * in its vertical middle, e.g. on a phone held sideways), and that it and the chords at the scale 1 fit side by side, so
 * on a narrower screen both get smaller together. The chords then have the room beside the circle and the gap to it.
 * With `whole`, the chords have to fit into the height of the area too, so that every row can be seen at once.
 * Above the chords (a column), the circle keeps its size and the chords have the whole width; the height is left out.
 */
export function measureSong(area, body, circle, rows, zoom, circleZoom, { whole = false } = {}) {
  const size = measureRows(area, rows, zoom);
  if (!size) {
    return null;
  }
  const view = area.ownerDocument.defaultView;
  const style = view.getComputedStyle(body);
  if (style.flexDirection.startsWith('column')) {
    return { ...size, circleZoom: DEFAULT_ZOOM };
  }
  const px = (value) => Number.parseFloat(value) || 0;
  const areaStyle = view.getComputedStyle(area);
  const roomHeight = area.clientHeight - px(areaStyle.paddingTop) - px(areaStyle.paddingBottom);
  // The circle and the gap beside it at the scale 1; both take the size of the circle.
  const box = circle.getBoundingClientRect();
  const circleWidth = box.width / circleZoom;
  const circleHeight = (box.height ?? box.width) / circleZoom;
  const gap = px(style.columnGap) / circleZoom;
  const nextCircle = Math.max(COLUMNS_MIN_ZOOM, roundDown(Math.min(
    DEFAULT_ZOOM,
    ratioOf({ needed: circleHeight, available: roomHeight }),
    ratioOf({ needed: size.needed + circleWidth + gap, available: size.available }),
  )));
  const width = { ...size, available: size.available - (circleWidth + gap) * nextCircle };
  if (!whole) {
    return { ...width, circleZoom: nextCircle };
  }
  const height = { ...size, needed: rows.getBoundingClientRect().height / zoom, available: roomHeight };
  return { ...(ratioOf(height) < ratioOf(width) ? height : width), circleZoom: nextCircle };
}

/** New scale after one wheel event. Scrolling up (negative deltaY) zooms in. */
export function wheelZoom(scale, deltaY, deltaMode = 0) {
  const pixels = deltaMode === 1 ? deltaY * PIXELS_PER_LINE : deltaY;
  return clampZoom(scale * 2 ** (-pixels / WHEEL_PIXELS_PER_OCTAVE));
}

/** New scale for a pinch: the scale at the start of the pinch times the change of the finger distance. */
export function pinchZoom(startScale, startDistance, distance) {
  if (startDistance <= 0) {
    return startScale;
  }
  return clampZoom(startScale * (distance / startDistance));
}

function touchDistance(touches) {
  const [first, second] = touches;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

/**
 * Lets Ctrl + scroll and pinch on `area` zoom `surface` only. The area is the part of the page that reacts,
 * the surface is the element that is scaled (through its CSS zoom). Returns the scale the user chose, the scale shown
 * and fit(), which fits the shown scale to the room again, e.g. after the chords are rendered anew. A change of the
 * area's size fits it too. `measure` gives the width the content needs at the scale 1 and the room for it (see measureRows).
 * fitAll() forgets the chosen scale and fits the content as `measureAll` measures it (e.g. also into the height), at most
 * at DEFAULT_ZOOM; that scale is then the chosen one.
 */
export function bindZoom(area, surface, {
  measure = (zoom) => measureRows(area, surface, zoom),
  measureAll = measure,
} = {}) {
  let scale = DEFAULT_ZOOM;
  let shown = DEFAULT_ZOOM;
  let pinch = null;

  const show = (next) => {
    shown = next;
    surface.style.setProperty('--zoom', String(shown));
  };

  const fit = () => {
    const size = measure(shown);
    show(size ? fittedZoom(scale, size.needed, size.available, size.min) : scale);
  };

  const apply = (next) => {
    scale = next;
    fit();
  };

  // The rows may wrap at the scale shown before, which makes them taller than they are once fitted; so the fit is measured
  // again at the new scale, a few times, until it no longer changes.
  const fitAll = () => {
    show(DEFAULT_ZOOM);
    for (let step = 0; step < 4; step += 1) {
      const size = measureAll(shown);
      const next = size ? fittedZoom(DEFAULT_ZOOM, size.needed, size.available, size.min) : shown;
      if (next === shown) {
        break;
      }
      show(next);
    }
    scale = shown;
  };

  if (typeof globalThis.ResizeObserver === 'function') {
    new globalThis.ResizeObserver(() => fit()).observe(area);
  }

  area.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) {
      return;
    }
    event.preventDefault();
    apply(wheelZoom(scale, event.deltaY, event.deltaMode));
  }, { passive: false });

  area.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) {
      pinch = { startScale: scale, startDistance: touchDistance(event.touches) };
    }
  }, { passive: true });

  area.addEventListener('touchmove', (event) => {
    if (!pinch || event.touches.length !== 2) {
      return;
    }
    // Stops the browser from zooming the whole page while the area is pinched.
    event.preventDefault();
    apply(pinchZoom(pinch.startScale, pinch.startDistance, touchDistance(event.touches)));
  }, { passive: false });

  const endPinch = (event) => {
    if (event.touches.length < 2) {
      pinch = null;
    }
  };
  area.addEventListener('touchend', endPinch, { passive: true });
  area.addEventListener('touchcancel', endPinch, { passive: true });

  return {
    get scale() { return scale; },
    get shown() { return shown; },
    fit,
    fitAll,
  };
}

/**
 * The zoom of the song area (see bindZoom): Ctrl + scroll and pinch anywhere in `area` zoom the chords (`chords`, which
 * holds the rows `rows`) only. The circle of fifths (`circle`, in `body` beside the chords) takes the size measureSong
 * gives it at every fit, as --circle-zoom of the body. fitAll() fits every row into the area at once, as long as the
 * circle stands beside the chords; above them (a narrow screen), it keeps the chosen scale and fits the width only, as
 * fit() does.
 */
export function bindSongZoom(area, body, circle, chords, rows) {
  let circleZoom = DEFAULT_ZOOM;
  const measure = (whole) => (zoom) => {
    const size = measureSong(area, body, circle, rows, zoom, circleZoom, { whole });
    if (size) {
      circleZoom = size.circleZoom;
      body.style.setProperty('--circle-zoom', String(circleZoom));
    }
    return size;
  };
  const zoom = bindZoom(area, chords, { measure: measure(false), measureAll: measure(true) });
  const besideChords = () => {
    const view = area.ownerDocument?.defaultView;
    return Boolean(view?.getComputedStyle) && !view.getComputedStyle(body).flexDirection.startsWith('column');
  };
  return {
    get scale() { return zoom.scale; },
    get shown() { return zoom.shown; },
    get circleZoom() { return circleZoom; },
    fit: zoom.fit,
    // Above the chords (a narrow screen), the chosen scale is kept.
    fitAll: () => (besideChords() ? zoom.fitAll() : zoom.fit()),
  };
}

/** Keeps Ctrl + scroll in `area` from zooming the page, without scaling anything. Used where zoom is not wanted. */
export function blockZoom(area) {
  area.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  }, { passive: false });
}
