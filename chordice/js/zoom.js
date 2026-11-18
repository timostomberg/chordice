/**
 * Zoom for one area of the page. Ctrl + scroll (a trackpad pinch arrives as Ctrl + scroll too) and a two-finger
 * pinch on a touch screen scale only the surface inside the area. The rest of the page keeps its size.
 * The scale is passed on as the custom property --zoom of the surface; the stylesheet multiplies the sizes of the
 * surface's text and boxes by it, so that the text grows together with the boxes.
 */

export const MIN_ZOOM = 0.7;
export const MAX_ZOOM = 2.5;

// Pixels of wheel movement per zoom doubling, and the size of one line in Firefox's line-based wheel events.
const WHEEL_PIXELS_PER_OCTAVE = 300;
const PIXELS_PER_LINE = 16;

export function clampZoom(scale) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
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
 * the surface is the element that is scaled (through its CSS zoom). Returns the current scale.
 */
export function bindZoom(area, surface) {
  let scale = 1;
  let pinch = null;

  const apply = (next) => {
    scale = next;
    surface.style.setProperty('--zoom', String(scale));
  };

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

  return { get scale() { return scale; } };
}

/** Keeps Ctrl + scroll in `area` from zooming the page, without scaling anything. Used where zoom is not wanted. */
export function blockZoom(area) {
  area.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  }, { passive: false });
}
