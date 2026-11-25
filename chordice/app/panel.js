/**
 * The side panel as a screen of its own: the back button (or the back gesture) closes it, a swipe to the right from the
 * left edge of the page opens it, and a swipe to the left on the panel closes it. On a phone the open panel covers the
 * whole page, so without this the back button of an app on the home screen (Android) would quit the app instead.
 */

/** The mark of the history entry that stands for the open panel. */
export const PANEL_ENTRY = 'chordicePanel';

/** How far, in pixels, from the left edge of the page a swipe must start to open the panel. */
export const EDGE = 40;

/** How far, in pixels, a finger must move sideways for a swipe. */
export const SWIPE_DISTANCE = 60;

/**
 * The direction of a move from `start` to `end` (each { x, y }): 'left' or 'right' when it is long enough and clearly
 * more sideways than up or down, else null (a tap, or a scroll).
 */
export function swipeDirection(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < 2 * Math.abs(dy)) {
    return null;
  }
  return dx > 0 ? 'right' : 'left';
}

/**
 * Keeps one history entry on top while the panel is open, so that going back closes the panel and not the page.
 * `isOpen()` tells whether the panel is open, `setOpen(open)` opens or closes it. Returns { sync }, which is called after
 * every change of the panel: it adds the entry when the panel has opened, and goes back past it when the panel has
 * closed some other way (a button). Going forward again onto the entry opens the panel again. Without the History API
 * (or outside a browser) sync does nothing.
 */
export function bindPanelHistory(win, isOpen, setOpen) {
  const history = win?.history;
  if (typeof history?.pushState !== 'function' || typeof win.addEventListener !== 'function') {
    return { sync() {} };
  }
  // A reload keeps the entry, so the page may start on it.
  let onEntry = history.state?.[PANEL_ENTRY] === true;
  // Whether a history.back() of sync has not arrived yet; until it has, sync waits.
  let leaving = false;

  function sync() {
    if (leaving) {
      return;
    }
    if (isOpen() && !onEntry) {
      history.pushState({ [PANEL_ENTRY]: true }, '');
      onEntry = true;
    } else if (!isOpen() && onEntry) {
      leaving = true;
      history.back();
    }
  }

  win.addEventListener('popstate', () => {
    onEntry = history.state?.[PANEL_ENTRY] === true;
    if (leaving) {
      // The panel may have opened again in the meantime.
      leaving = false;
      sync();
    } else if (isOpen() !== onEntry) {
      setOpen(onEntry);
    }
  });
  return { sync };
}

/**
 * Opens the panel with a swipe to the right that starts at the left edge of the page, and closes it with a swipe to the
 * left on the panel. A swipe on a control (e.g. a slider), in the notes window, or with more than one finger (a pinch)
 * does neither.
 */
export function bindPanelSwipes(doc, panel, isOpen, setOpen) {
  if (typeof doc?.addEventListener !== 'function') {
    return;
  }
  let start = null;

  doc.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    start = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY, target: event.target } : null;
  }, { passive: true });

  doc.addEventListener('touchcancel', () => {
    start = null;
  }, { passive: true });

  doc.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    const from = start;
    start = null;
    if (!from || !touch || event.touches.length > 0) {
      return;
    }
    const direction = swipeDirection(from, { x: touch.clientX, y: touch.clientY });
    const target = from.target;
    if (target?.closest?.('dialog, input, select, textarea')) {
      return;
    }
    if (direction === 'right' && !isOpen() && from.x <= EDGE) {
      setOpen(true);
    } else if (direction === 'left' && isOpen() && panel.contains(target)) {
      setOpen(false);
    }
  }, { passive: true });
}
