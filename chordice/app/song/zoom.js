/**
 * Zoom for one area of the page. Ctrl + scroll (a trackpad pinch arrives as Ctrl + scroll too) and a two-finger
 * pinch on a touch screen scale only the surface inside the area. The rest of the page keeps its size.
 * The scale is passed on as the custom property --zoom of the surface; the stylesheet multiplies the sizes of the
 * surface's text and boxes by it, so that the text grows together with the boxes.
 * When the area is too narrow for the scale the user chose, the surface zooms out by itself, just far enough that its
 * widest row of chords fits on one line (but not below MIN_ZOOM). The chosen scale is kept: once there is room again,
 * the surface zooms back in to it.
 */

export const MIN_ZOOM = 0.7;
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
 * shown. It never goes below MIN_ZOOM, so on a very narrow area the chords wrap onto further lines instead.
 */
export function fittedZoom(wanted, needed, available) {
  if (!(needed > 0) || !(available > 0)) {
    return wanted;
  }
  // Rounded down a little, so that rounding in the layout does not wrap the last chord.
  const fit = Math.floor((available / needed) * 100) / 100;
  return Math.max(MIN_ZOOM, Math.min(wanted, fit));
}

/**
 * Measures the widest row of chords in `surface` and the room for it in `area`, both in pixels. `zoom` is the scale the
 * surface shows now, so the width is divided by it to give the width at the scale 1. The chords of a row may wrap; the
 * width of a row is the sum of its chords and the gaps between them, as on one line. Returns null without a layout.
 */
export function measureRows(area, surface, zoom) {
  const view = area.ownerDocument?.defaultView;
  if (!view?.getComputedStyle || typeof surface.querySelectorAll !== 'function') {
    return null;
  }
  const px = (value) => Number.parseFloat(value) || 0;
  const areaStyle = view.getComputedStyle(area);
  const available = area.clientWidth - px(areaStyle.paddingLeft) - px(areaStyle.paddingRight);
  let widest = 0;
  for (const row of surface.querySelectorAll('.chords')) {
    const chords = [...row.children];
    const gap = px(view.getComputedStyle(row).columnGap);
    const width = chords.reduce((sum, chord) => sum + chord.getBoundingClientRect().width, 0) +
      gap * Math.max(0, chords.length - 1);
    widest = Math.max(widest, width);
  }
  return { needed: widest / zoom, available };
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
 */
export function bindZoom(area, surface, { measure = (zoom) => measureRows(area, surface, zoom) } = {}) {
  let scale = DEFAULT_ZOOM;
  let shown = DEFAULT_ZOOM;
  let pinch = null;

  const show = (next) => {
    shown = next;
    surface.style.setProperty('--zoom', String(shown));
  };

  const fit = () => {
    const size = measure(shown);
    show(size ? fittedZoom(scale, size.needed, size.available) : scale);
  };

  const apply = (next) => {
    scale = next;
    fit();
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
