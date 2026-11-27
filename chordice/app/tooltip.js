/**
 * The quick hints of the buttons. The browser shows the title of an element only after a long pause, so the page shows it
 * itself: once the mouse rests on an element with a title for TIP_DELAY, its hint appears beside it, and it goes again as
 * soon as the mouse moves on, presses, scrolls or leaves the page. While the mouse moves, no hint is shown. Touch and pen
 * show none, as they cannot rest on an element.
 *
 * The title of an element becomes its data-tip the first time the mouse reaches it, so that the browser does not show its
 * own hint as well; an element without a name of its own (no aria-label, no text) takes the hint as its aria-label, and
 * any other takes it as its aria-description, so that screen readers still tell what the title told.
 */

/** How long the mouse rests on an element before its hint appears, in milliseconds. */
export const TIP_DELAY = 150;

/** How far the mouse may move, in pixels, and still count as resting. */
export const STILL = 4;

/** The gap between an element and its hint, and between the hint and the edge of the window, in pixels. */
const GAP = 6;
const MARGIN = 8;

/** The element under `node` with a hint, its title moved to data-tip (see above), or null. */
function hinted(node) {
  const element = node?.closest?.('[title], [data-tip]');
  if (!element) {
    return null;
  }
  if (element.hasAttribute('title')) {
    const text = element.getAttribute('title');
    element.removeAttribute('title');
    element.dataset.tip = text;
    if (!element.hasAttribute('aria-label') && !element.textContent.trim()) {
      element.setAttribute('aria-label', text);
    } else if (!element.hasAttribute('aria-description') && element.getAttribute('aria-label') !== text) {
      // An element with a name of its own keeps the hint as its description, as the title gave it before.
      element.setAttribute('aria-description', text);
    }
  }
  return element.dataset.tip ? element : null;
}

/**
 * Places the hint below its element, centred on it and inside the window; where there is no room below, above it.
 */
function place(tip, element, view) {
  const box = element.getBoundingClientRect();
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, MARGIN), Math.max(MARGIN, view.innerWidth - width - MARGIN));
  const below = box.bottom + GAP;
  const top = below + height > view.innerHeight - MARGIN ? Math.max(MARGIN, box.top - height - GAP) : below;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

/** Shows the hints of the elements of `root` (a document). `delay` is how long the mouse rests first (TIP_DELAY). */
export function bindTooltips(root = document, { delay = TIP_DELAY } = {}) {
  const view = root.defaultView ?? globalThis;
  let tip = null;
  let timer = null;
  let target = null;
  // Where the mouse came to rest last; a move further than STILL from there counts as moving.
  let rest = null;

  function hide() {
    clearTimeout(timer);
    timer = null;
    if (tip) {
      tip.hidden = true;
    }
  }

  function show() {
    timer = null;
    if (!target?.isConnected) {
      return;
    }
    if (!tip) {
      tip = root.createElement('div');
      tip.className = 'tooltip';
      tip.setAttribute('role', 'tooltip');
    }
    // An open dialog (the notes window) lies above the page, so a hint inside it is shown inside it.
    const layer = target.closest('dialog[open]') ?? root.body;
    if (tip.parentNode !== layer) {
      layer.append(tip);
    }
    tip.textContent = target.dataset.tip;
    tip.hidden = false;
    place(tip, target, view);
  }

  root.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    const next = hinted(event.target);
    const moved = !rest || Math.hypot(event.clientX - rest.x, event.clientY - rest.y) > STILL;
    if (next === target && !moved) {
      return;
    }
    rest = { x: event.clientX, y: event.clientY };
    target = next;
    hide();
    if (target) {
      timer = setTimeout(show, delay);
    }
  });
  const leave = () => {
    target = null;
    rest = null;
    hide();
  };
  root.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) {
      leave();
    }
  });
  for (const type of ['pointerdown', 'wheel', 'scroll', 'keydown']) {
    root.addEventListener(type, leave, true);
  }
  return { hide: leave };
}
