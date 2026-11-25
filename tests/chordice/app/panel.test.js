import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDGE, PANEL_ENTRY, SWIPE_DISTANCE, bindPanelHistory, bindPanelSwipes, swipeDirection } from '../../../chordice/app/panel.js';

/**
 * Stands in for the browser's history and window. back() and forward() move between the entries and send popstate
 * later, as the browser does; `settle()` waits until it has been sent.
 */
function fakeWindow(initialState = null) {
  const entries = [initialState];
  let index = 0;
  const listeners = [];
  const history = {
    get state() {
      return entries[index];
    },
    get length() {
      return entries.length;
    },
    pushState(state) {
      entries.splice(index + 1, entries.length, state);
      index += 1;
    },
    back() {
      go(-1);
    },
    forward() {
      go(1);
    },
  };
  let pending = Promise.resolve();
  function go(step) {
    pending = pending.then(() => {
      index = Math.max(0, Math.min(entries.length - 1, index + step));
      for (const listener of listeners) {
        listener({ state: entries[index] });
      }
    });
  }
  return {
    history,
    addEventListener(type, listener) {
      if (type === 'popstate') {
        listeners.push(listener);
      }
    },
    entries,
    get index() {
      return index;
    },
    settle: () => pending.then(() => pending),
  };
}

/** A panel whose open state the history drives, re-synced after each change as app.js does after every render. */
function bindPanel(win, open = false) {
  const panel = { open, changes: [] };
  const binding = bindPanelHistory(win, () => panel.open, (value) => {
    panel.open = value;
    panel.changes.push(value);
    binding.sync();
  });
  panel.set = (value) => {
    panel.open = value;
    binding.sync();
  };
  binding.sync();
  return panel;
}

test('a swipe is a long move that is clearly more sideways than up or down', () => {
  assert.equal(swipeDirection({ x: 0, y: 0 }, { x: SWIPE_DISTANCE, y: 0 }), 'right');
  assert.equal(swipeDirection({ x: 100, y: 0 }, { x: 100 - SWIPE_DISTANCE, y: 10 }), 'left');
  assert.equal(swipeDirection({ x: 0, y: 0 }, { x: SWIPE_DISTANCE - 1, y: 0 }), null, 'too short: a tap');
  assert.equal(swipeDirection({ x: 0, y: 0 }, { x: 80, y: 50 }), null, 'too steep: a scroll');
});

test('opening the panel adds one history entry, and going back closes the panel instead of leaving the page', async () => {
  const win = fakeWindow();
  const panel = bindPanel(win);
  assert.equal(win.entries.length, 1, 'a closed panel adds no entry');
  panel.set(true);
  assert.equal(win.index, 1);
  assert.equal(win.history.state[PANEL_ENTRY], true);
  panel.set(true);
  assert.equal(win.entries.length, 2, 'only one entry while it stays open');
  win.history.back();
  await win.settle();
  assert.equal(panel.open, false);
  assert.equal(win.index, 0);
});

test('a panel that is open at start-up gets its entry at once, so the first back closes it', async () => {
  const win = fakeWindow();
  const panel = bindPanel(win, true);
  assert.equal(win.index, 1);
  win.history.back();
  await win.settle();
  assert.equal(panel.open, false);
});

test('closing the panel with a button goes back past its entry, so the next back leaves the page', async () => {
  const win = fakeWindow();
  const panel = bindPanel(win);
  panel.set(true);
  panel.set(false);
  await win.settle();
  assert.equal(win.index, 0);
  assert.deepEqual(panel.changes, [], 'the history did not change the panel itself');
});

test('a panel reopened before the browser has gone back gets a new entry once it has', async () => {
  const win = fakeWindow();
  const panel = bindPanel(win);
  panel.set(true);
  panel.set(false);
  panel.set(true);
  await win.settle();
  assert.equal(panel.open, true);
  assert.equal(win.index, 1);
  assert.equal(win.history.state[PANEL_ENTRY], true);
});

test('going forward onto the entry opens the panel again', async () => {
  const win = fakeWindow();
  const panel = bindPanel(win);
  panel.set(true);
  win.history.back();
  await win.settle();
  win.history.forward();
  await win.settle();
  assert.equal(panel.open, true);
  assert.deepEqual(panel.changes, [false, true]);
});

test('a reload on the entry of an open panel adds no second entry', () => {
  const win = fakeWindow({ [PANEL_ENTRY]: true });
  bindPanel(win, true);
  assert.equal(win.entries.length, 1);
});

test('without the History API the panel only opens and closes by its buttons', () => {
  const binding = bindPanelHistory({}, () => true, () => assert.fail('no history to follow'));
  binding.sync();
  assert.equal(typeof bindPanelHistory(undefined, () => true, () => {}).sync, 'function');
});

/** A page whose touches can be sent to the swipe listeners: `swipe(from, to, target)` is one finger moving. */
function swipePage(open = false) {
  const listeners = {};
  const doc = {
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
  };
  const inside = { inPanel: true, closest: () => null };
  const panel = { contains: (node) => node?.inPanel === true };
  const state = { open, changes: [] };
  bindPanelSwipes(doc, panel, () => state.open, (value) => {
    state.open = value;
    state.changes.push(value);
  });
  const touch = (x, y) => ({ clientX: x, clientY: y });
  state.swipe = (from, to, target = { closest: () => null }) => {
    listeners.touchstart({ touches: [touch(...from)], target });
    listeners.touchend({ touches: [], changedTouches: [touch(...to)], target });
  };
  state.listeners = listeners;
  state.inside = inside;
  return state;
}

test('a swipe to the right from the left edge opens the panel; one starting further in does not', () => {
  const page = swipePage();
  page.swipe([EDGE + 1, 200], [EDGE + 200, 200]);
  assert.equal(page.open, false);
  page.swipe([5, 200], [150, 210]);
  assert.equal(page.open, true);
});

test('a swipe to the left on the open panel closes it; one outside the panel or to the right does not', () => {
  const page = swipePage(true);
  page.swipe([300, 200], [100, 200]);
  assert.equal(page.open, true, 'outside the panel');
  page.swipe([100, 200], [300, 200], page.inside);
  assert.equal(page.open, true, 'to the right');
  page.swipe([300, 200], [100, 200], page.inside);
  assert.equal(page.open, false);
});

test('a swipe on a slider, in the notes window or with two fingers does nothing', () => {
  const page = swipePage(true);
  const slider = { inPanel: true, closest: (selector) => (selector.includes('input') ? slider : null) };
  page.swipe([300, 200], [100, 200], slider);
  assert.equal(page.open, true, 'a slider is dragged, not swiped');

  const closed = swipePage();
  const dialog = { closest: (selector) => (selector.includes('dialog') ? dialog : null) };
  closed.swipe([5, 200], [150, 200], dialog);
  assert.equal(closed.open, false, 'the notes window has swipes of its own');

  const pinch = swipePage(true);
  const target = pinch.inside;
  pinch.listeners.touchstart({ touches: [{ clientX: 300, clientY: 200 }], target });
  pinch.listeners.touchstart({ touches: [{ clientX: 300, clientY: 200 }, { clientX: 350, clientY: 250 }], target });
  pinch.listeners.touchend({ touches: [{ clientX: 350, clientY: 250 }], changedTouches: [{ clientX: 100, clientY: 200 }], target });
  pinch.listeners.touchend({ touches: [], changedTouches: [{ clientX: 100, clientY: 200 }], target });
  assert.equal(pinch.open, true);
});

test('a cancelled touch is no swipe', () => {
  const page = swipePage();
  page.listeners.touchstart({ touches: [{ clientX: 5, clientY: 200 }], target: { closest: () => null } });
  page.listeners.touchcancel();
  page.listeners.touchend({ touches: [], changedTouches: [{ clientX: 200, clientY: 200 }] });
  assert.deepEqual(page.changes, []);
});
