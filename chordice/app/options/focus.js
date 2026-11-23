/**
 * Keeps the keyboard focus in the options panel while it is re-rendered. The panel is rebuilt from markup on every change,
 * which replaces the element that has the focus, so a keyboard user would lose their place after every key press. The
 * focused control is found again in the new markup by its data attributes (e.g. data-action="set-key" data-key="G"),
 * which name it uniquely.
 */

/** The controls that can be found again: buttons and keys carry an action, sliders the option they set. */
const CONTROLS = '[data-action], [data-option]';

/** The data attributes of an element as one comparable value. */
function identityOf(element) {
  return JSON.stringify(Object.entries(element.dataset).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Runs `replace`, which rebuilds the content of `container`, and gives the focus back to the control that had it before,
 * if it is still there. Nothing is focused when the focus was outside the container or on no control, or when the control
 * is gone (e.g. a chip of a section that was just collapsed). The page does not scroll to the control.
 */
export function keepFocus(container, replace) {
  const focused = container.ownerDocument.activeElement;
  const identity = focused && container.contains(focused) && focused.matches?.(CONTROLS) ? identityOf(focused) : null;
  replace();
  if (identity === null) {
    return;
  }
  const control = [...container.querySelectorAll(CONTROLS)].find((element) => identityOf(element) === identity);
  control?.focus({ preventScroll: true });
}
