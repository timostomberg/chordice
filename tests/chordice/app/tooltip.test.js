import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { STILL, TIP_DELAY, bindTooltips } from '../../../chordice/app/tooltip.js';

const DELAY = 10;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A page with a few buttons and an open dialog, with the hints bound. */
function page() {
  const { window } = new JSDOM(`<!DOCTYPE html><body>
    <button id="icon" title="Dark mode: switches the theme"></button>
    <button id="named" aria-label="Piano" title="Piano: a click on a chord shows its notes"></button>
    <button id="text" title="All Pop progressions">Pop</button>
    <button id="plain">New</button>
    <dialog id="notes" open><div id="staff" title="Left half: previous."></div></dialog>
  </body>`);
  const { document } = window;
  bindTooltips(document, { delay: DELAY });
  /** Fires a pointer event at the element, from the mouse unless another pointer type is given. */
  const fire = (type, element, { x = 10, y = 10, pointerType = 'mouse', relatedTarget = null } = {}) => {
    const event = new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, relatedTarget });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    element.dispatchEvent(event);
  };
  const tip = () => document.querySelector('.tooltip');
  const shown = () => (tip() && !tip().hidden ? tip().textContent : null);
  return { document, fire, tip, shown, byId: (id) => document.getElementById(id) };
}

test('the hint of a button appears soon after the mouse comes to rest on it', async () => {
  assert.ok(TIP_DELAY > 0 && TIP_DELAY <= 200, 'with very little delay');
  const { fire, shown, tip, byId } = page();
  fire('pointermove', byId('icon'));
  assert.equal(shown(), null, 'not at once');
  await wait(DELAY * 3);
  assert.equal(shown(), 'Dark mode: switches the theme');
  assert.equal(tip().getAttribute('role'), 'tooltip');
  assert.match(tip().style.left, /^\d+px$/);
  assert.match(tip().style.top, /^\d+px$/);
});

test('while the mouse moves, no hint is shown; a move hides a hint that is shown', async () => {
  const { fire, shown, byId } = page();
  for (let step = 0; step < 5; step += 1) {
    fire('pointermove', byId('icon'), { x: 10 + step * (STILL + 2) });
    await wait(DELAY / 2);
  }
  assert.equal(shown(), null);
  await wait(DELAY * 3);
  assert.equal(shown(), 'Dark mode: switches the theme', 'once it rests');
  // A tremble of the hand is no move.
  fire('pointermove', byId('icon'), { x: 10 + 4 * (STILL + 2) + 1 });
  assert.equal(shown(), 'Dark mode: switches the theme');
  fire('pointermove', byId('icon'), { x: 100 });
  assert.equal(shown(), null);
});

test('pressing, scrolling, a key or leaving the page hides the hint', async () => {
  const { document, fire, shown, byId } = page();
  for (const end of [
    () => fire('pointerdown', byId('icon')),
    () => document.dispatchEvent(new document.defaultView.Event('scroll')),
    () => byId('icon').dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'Tab', bubbles: true })),
    () => fire('pointerout', byId('icon')),
  ]) {
    fire('pointermove', byId('icon'), { x: Math.random() * 1000 });
    await wait(DELAY * 3);
    assert.ok(shown());
    end();
    assert.equal(shown(), null);
  }
});

test('touch and pen show no hint, and an element without a title none either', async () => {
  const { fire, shown, byId } = page();
  fire('pointermove', byId('icon'), { pointerType: 'touch' });
  fire('pointermove', byId('icon'), { pointerType: 'pen' });
  await wait(DELAY * 3);
  assert.equal(shown(), null);
  fire('pointermove', byId('plain'));
  await wait(DELAY * 3);
  assert.equal(shown(), null);
});

test('the title becomes the hint, so the browser shows no slow hint of its own, and a button keeps its name', () => {
  const { fire, byId } = page();
  for (const id of ['icon', 'named', 'text']) {
    fire('pointermove', byId(id), { x: Math.random() * 1000 });
  }
  assert.equal(byId('icon').hasAttribute('title'), false);
  assert.equal(byId('icon').dataset.tip, 'Dark mode: switches the theme');
  // A button without a name of its own is named by its hint; the others keep theirs.
  assert.equal(byId('icon').getAttribute('aria-label'), 'Dark mode: switches the theme');
  assert.equal(byId('named').getAttribute('aria-label'), 'Piano');
  assert.equal(byId('text').hasAttribute('aria-label'), false);
  // An element with a name of its own keeps the hint as its description; one named by the hint needs none.
  assert.equal(byId('named').getAttribute('aria-description'), 'Piano: a click on a chord shows its notes');
  assert.equal(byId('text').getAttribute('aria-description'), 'All Pop progressions');
  assert.equal(byId('icon').hasAttribute('aria-description'), false);
});

test('a hint inside the open notes window is shown inside it, above the page', async () => {
  const { fire, tip, shown, byId } = page();
  fire('pointermove', byId('staff'));
  await wait(DELAY * 3);
  assert.equal(shown(), 'Left half: previous.');
  assert.equal(tip().parentNode, byId('notes'));
});
