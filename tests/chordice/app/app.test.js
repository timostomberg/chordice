import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_COLOURS, startApp } from '../../../chordice/app/app.js';
import { BASS_TEXT, LIBRARY, PROGRESSIONS_TEXT as YAML_TEXT } from '../../helpers/fixtures.js';
import { defaultState } from '../../../chordice/app/state/state.js';
import { STORAGE_KEY, serializeCookie, serializeStored } from '../../../chordice/app/state/persistence.js';

// app.js has no side effects on import; startApp runs against the minimal fake DOM installed by loadApp below.
// The guitar shapes as the CDN serves them; app.js fetches them from the URL of the installed version.
const HELP_TEXT = readFileSync(new URL('../../../chordice/app/help/help.html', import.meta.url), 'utf8');
const GUITAR_TEXT = readFileSync(new URL('../../../node_modules/@tombatossals/chords-db/lib/guitar.json', import.meta.url), 'utf8');

class FakeClassList {
  constructor() {
    this.names = new Set();
  }

  toggle(name, force) {
    if (force) {
      this.names.add(name);
    } else {
      this.names.delete(name);
    }
  }

  add(name) {
    this.names.add(name);
  }

  remove(name) {
    this.names.delete(name);
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor(dataset = {}) {
    this.innerHTML = '';
    this.textContent = '';
    this.hidden = false;
    this.attributes = {};
    this.dataset = dataset;
    this.classList = new FakeClassList();
    // Custom properties, e.g. the --zoom the chords are fitted to after every render.
    this.style = { setProperty(name, value) { this[name] = value; } };
    // No element of the fake page has the focus.
    this.ownerDocument = { activeElement: null };
  }

  addEventListener() {}

  querySelector() {
    return new FakeElement();
  }

  // Only the targets marked as inside the element count as inside it.
  contains(node) {
    return node?.insideContent === true;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

// The notes window; app.js only wires it up, the dialog's own behaviour is tested in dialog.test.js.
class FakeDialog extends FakeElement {
  showModal() {}

  close() {}
}

// The browser paints its next frame at once. It stays for the whole file, as the background of a test may still be
// drawing its painting when the next test starts.
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);

// The canvas the background paints its painting on (on the page, as there is no worker here): its 2D context takes
// every call.
class FakeCanvas extends FakeElement {
  constructor() {
    super();
    this.nodeName = 'CANVAS';
  }

  getContext() {
    const gradient = { addColorStop() {} };
    return new Proxy({}, { get: (_, name) => (name.startsWith('create') ? () => gradient : () => {}), set: () => true });
  }
}

// The background behind the app: its colour, and the painting it adds once drawn.
class FakeBackground extends FakeElement {
  constructor() {
    super();
    this.style = {};
    this.children = [];
    this.ownerDocument = {
      activeElement: null,
      createElement: () => new FakeCanvas(),
      defaultView: { innerWidth: 800, innerHeight: 600, devicePixelRatio: 2, addEventListener() {} },
    };
  }

  replaceChildren() {
    this.children = [];
  }

  append(child) {
    this.children.push(child);
  }
}

// Stands in for HTMLInputElement, which app.js checks with instanceof.
class FakeInput {
  constructor(type, option, value) {
    this.type = type;
    this.value = value;
    this.dataset = { option };
  }
}

/** Installs the globals app.js uses, loads it and waits until its start-up promise has settled. */
async function loadApp({ cookie = '', stored = null, storage = fakeStorage(stored), yaml = YAML_TEXT, bass = BASS_TEXT, ok = true, guitarOk = true, helpOk = true, pathname = '/chordice/index.html' } = {}) {
  const elements = {
    '#side-panel': new FakeElement(),
    '#options': new FakeElement(),
    '#option-list': new FakeElement(),
    '#song-rows': new FakeElement(),
    // Only the targets marked as inside the circle count as inside it, not every target inside the song.
    '#song-circle': Object.assign(new FakeElement(), { contains: (node) => node?.insideCircle === true }),
    '.song-body': new FakeElement(),
    '#background': new FakeBackground(),
    '#status': new FakeElement(),
    '.options-toggle': new FakeElement(),
    '.exercises-toggle': new FakeElement(),
    '.help-toggle': new FakeElement(),
    '.song': new FakeElement(),
    '[data-action="toggle-theme"]': new FakeElement(),
    '[data-action="toggle-colour"]': new FakeElement({ flag: 'colour' }),
    '[data-action="toggle-roman"]': new FakeElement({ flag: 'roman' }),
    '[data-action="toggle-tones"]': new FakeElement({ flag: 'tones' }),
    '[data-action="toggle-melody"]': new FakeElement({ flag: 'inversions' }),
    '[data-action="toggle-painting"]': new FakeElement({ flag: 'painting' }),
    '#notes': new FakeDialog(),
    'meta[name="theme-color"]': new FakeElement(),
  };
  const listeners = {};
  const fetched = [];
  // The piano and guitar tabs of the header, as the page has them.
  const instrumentTabs = [new FakeElement({ instrument: 'piano' }), new FakeElement({ instrument: 'guitar' })];
  // Every cookie the app writes, in order; `cookie` itself keeps only the last one, which is enough for reading it back.
  const written = [];
  const document = {
    get cookie() {
      return cookie;
    },
    set cookie(value) {
      written.push(value);
      cookie = value;
    },
    location: { pathname },
    body: { classList: new FakeClassList() },
    documentElement: { dataset: {} },
    querySelector(selector) {
      if (!(selector in elements)) {
        throw new Error(`unexpected selector ${selector}`);
      }
      return elements[selector];
    },
    // Only the view switches carry a data-flag; they are the elements with a flag in the fake page.
    querySelectorAll(selector) {
      if (selector === '[data-instrument]') {
        return instrumentTabs;
      }
      if (selector !== '[data-flag]') {
        throw new Error(`unexpected selector ${selector}`);
      }
      return Object.values(elements).filter((element) => element?.dataset.flag !== undefined);
    },
    addEventListener(type, listener) {
      (listeners[type] ??= []).push(listener);
    },
  };

  globalThis.document = document;
  globalThis.HTMLInputElement = FakeInput;
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    const isGuitar = String(url).endsWith('/guitar.json');
    const isHelp = String(url).endsWith('/help.html');
    const good = isGuitar ? guitarOk : isHelp ? helpOk : ok;
    const text = String(url).endsWith('/bass_patterns.yaml') ? bass : isGuitar ? GUITAR_TEXT : isHelp ? HELP_TEXT : yaml;
    return { ok: good, status: good ? 200 : 404, text: async () => text };
  };

  await startApp();

  // Returns a promise that settles once the click has been handled, e.g. after the guitar shapes are loaded.
  const dispatch = (dataset) => Promise.all(
    (listeners.click ?? []).map((listener) => listener({ target: { closest: () => ({ dataset }) } })),
  );
  // A raw click, e.g. on the song; the target is not inside any element with a data-action.
  const click = (target) => {
    for (const listener of listeners.click ?? []) {
      listener({ target });
    }
  };
  const change = (target) => {
    for (const listener of listeners.change ?? []) {
      listener({ target });
    }
  };
  // A key pressed on an element with these data attributes; returns whether the browser's default (e.g. scrolling on Space)
  // was prevented.
  const keydown = (key, dataset) => {
    let prevented = false;
    const element = { dataset };
    const target = { closest: (selector) => (selector.includes(`[data-action="${dataset.action}"]`) ? element : null) };
    for (const listener of listeners.keydown ?? []) {
      listener({ key, target, preventDefault: () => { prevented = true; } });
    }
    return prevented;
  };
  return { document, elements, fetched, dispatch, click, change, keydown, instrumentTabs, written, storage, listeners };
}

/** Stands in for the browser's local storage, holding the stored copy of the state, if any. */
function fakeStorage(stored = null) {
  const items = new Map(stored === null ? [] : [[STORAGE_KEY, stored]]);
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
  };
}

/** A local storage that the browser refuses, as Safari may in a private window. */
const REFUSED_STORAGE = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

function uninstall() {
  delete globalThis.localStorage;
  delete globalThis.document;
  delete globalThis.HTMLInputElement;
  delete globalThis.fetch;
}

function rowCount(html) {
  return html.split('<section class="row">').length - 1;
}

test('app.js loads the YAML library and renders the collapsed option sections, rows and toggle state', async () => {
  try {
    const app = await loadApp();
    assert.deepEqual(app.fetched.length, 2);
    assert.ok(app.fetched[0].endsWith('/chordice/music/data/chord_progressions.yaml'));
    assert.ok(app.fetched[1].endsWith('/chordice/music/data/bass_patterns.yaml'));
    // The piano needs no guitar shapes, so they are not fetched at start-up.
    assert.ok(!app.fetched.some((url) => url.endsWith('guitar.json')));
    // The circle of fifths is beside the chords, not in the options.
    assert.ok(!app.elements['#option-list'].innerHTML.includes('<svg class="circle"'));
    assert.ok(app.elements['#song-circle'].innerHTML.includes('<svg class="circle"'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('<span class="section-title">Progressions</span>'));
    assert.equal(app.elements['#options'].hidden, false);
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 2);
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'true');
    assert.ok(app.document.cookie.startsWith('chordice_state='));
  } finally {
    uninstall();
  }
});

test('app.js applies the theme to the page and marks the theme button', async () => {
  try {
    const app = await loadApp();
    assert.equal(app.document.documentElement.dataset.theme, 'light');
    assert.equal(app.elements['[data-action="toggle-theme"]'].attributes['aria-pressed'], 'false');
    app.dispatch({ action: 'toggle-theme' });
    assert.equal(app.document.documentElement.dataset.theme, 'dark');
    assert.equal(app.elements['[data-action="toggle-theme"]'].attributes['aria-pressed'], 'true');
    assert.ok(decodeURIComponent(app.document.cookie).includes('"theme":"dark"'));
  } finally {
    uninstall();
  }
});

/** Waits a few frames, long enough for the background to draw its painting on an idle machine. */
const frames = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * Waits until `predicate` holds, frame by frame, at most about two seconds. Unlike frames() it does not depend on how fast
 * the machine runs the tests, so it is used where the painting is expected to appear.
 */
async function until(predicate) {
  for (let tries = 0; tries < 400 && !predicate(); tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test('app.js shows the colour of the painting at once and the painting once painted, anew with New Song and the theme', async () => {
  try {
    const app = await loadApp();
    const background = app.elements['#background'];
    const first = background.style.backgroundColor;
    assert.match(first, /^#[0-9a-f]{6}$/, 'the colour is shown from the start');
    assert.equal(background.children.length, 0, 'the painting is not there yet');
    await until(() => background.children[0]?.classList.contains('shown'));
    assert.equal(background.children.length, 1, 'then the painting is painted');
    const painting = background.children[0];
    assert.equal(painting.nodeName, 'CANVAS');
    assert.ok(painting.classList.contains('shown'), 'and fades in');
    app.dispatch({ action: 'cycle-count' });
    assert.equal(background.children[0], painting, 'another option leaves the painting as it is');
    app.dispatch({ action: 'toggle-theme' });
    const dark = background.style.backgroundColor;
    assert.notEqual(dark, first, 'the theme shows the colour of the dusk');
    assert.equal(background.children.length, 0, 'at once, and paints the picture again');
    await until(() => background.children.length > 0);
    assert.notEqual(background.children[0], painting);
    app.dispatch({ action: 'reroll' });
    assert.notEqual(background.style.backgroundColor, dark, 'New Song shows a new colour at once');
    assert.equal(background.children.length, 0);
    // New Song again before the painting is painted: only the last song's painting is shown.
    app.dispatch({ action: 'reroll' });
    await until(() => background.children.length > 0);
    await frames();
    assert.equal(background.children.length, 1);
    app.dispatch({ action: 'toggle-painting' });
    assert.equal(background.children.length, 0, 'the painting switch off shows a plain background');
    await frames();
    assert.equal(background.children.length, 0);
    assert.ok(decodeURIComponent(app.document.cookie).includes('"painting":false'));
    app.dispatch({ action: 'toggle-painting' });
    await until(() => background.children.length > 0);
    assert.equal(background.children.length, 1, 'and on again the painting');
  } finally {
    uninstall();
  }
});

test('app.js restores the state stored in the cookie', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), count: 8, colour: true, roman: true, tones: true });
    const app = await loadApp({ cookie });
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 8);
    assert.ok(app.elements['#song-rows'].innerHTML.includes('<span class="roman">'));
  } finally {
    uninstall();
  }
});

test('app.js re-renders and stores the state when a click dispatches an action', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'cycle-count' });
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 4);
    assert.match(app.elements['#option-list'].innerHTML, /class="chip count-toggle"[^>]*>4<\/button>/);
    assert.ok(app.document.cookie.includes('chordice_state='));
    assert.ok(decodeURIComponent(app.document.cookie).includes('"count":4'));
  } finally {
    uninstall();
  }
});

test('app.js hides the whole left panel, with the options and the circle, and marks the toggle as collapsed', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-options' });
    assert.equal(app.elements['#side-panel'].hidden, true);
    assert.equal(app.elements['#options'].hidden, true);
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'false');
    app.dispatch({ action: 'toggle-options' });
    assert.equal(app.elements['#side-panel'].hidden, false);
    assert.equal(app.elements['#options'].hidden, false);
  } finally {
    uninstall();
  }
});

test('the exercises button shows the exercises in the side panel instead of the options, and only one button is pressed', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-exercises' });
    assert.equal(app.elements['#side-panel'].hidden, false);
    assert.equal(app.elements['#options'].attributes['aria-label'], 'Exercises');
    assert.ok(app.elements['#option-list'].innerHTML.includes('data-action="toggle-exercise"'));
    assert.ok(!app.elements['#option-list'].innerHTML.includes('<span class="section-title">Progressions</span>'));
    assert.equal(app.elements['.exercises-toggle'].attributes['aria-expanded'], 'true');
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'false');
    assert.ok(decodeURIComponent(app.document.cookie).includes('"panel":"exercises"'));
    // The options button shows the options again in its place.
    app.dispatch({ action: 'toggle-options' });
    assert.equal(app.elements['#options'].attributes['aria-label'], 'Options');
    assert.ok(app.elements['#option-list'].innerHTML.includes('<span class="section-title">Progressions</span>'));
    assert.ok(!app.elements['#option-list'].innerHTML.includes('data-action="toggle-exercise"'));
    assert.equal(app.elements['.exercises-toggle'].attributes['aria-expanded'], 'false');
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'true');
  } finally {
    uninstall();
  }
});

test('the back button closes the side panel, and a swipe from the left edge opens it again', async () => {
  // The browser's history: the app adds an entry while the panel is open; back() removes it and sends popstate.
  const entries = [null];
  const popListeners = [];
  globalThis.history = {
    get state() {
      return entries.at(-1);
    },
    pushState(state) {
      entries.push(state);
    },
    back() {
      entries.pop();
      queueMicrotask(() => popListeners.forEach((listener) => listener({})));
    },
  };
  globalThis.addEventListener = (type, listener) => {
    if (type === 'popstate') {
      popListeners.push(listener);
    }
  };
  try {
    const app = await loadApp();
    assert.equal(app.elements['#side-panel'].hidden, false);
    assert.equal(entries.length, 2, 'the open panel has its entry');
    globalThis.history.back();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(app.elements['#side-panel'].hidden, true);
    assert.equal(entries.length, 1);

    const target = { closest: () => null };
    app.listeners.touchstart[0]({ touches: [{ clientX: 4, clientY: 300 }], target });
    app.listeners.touchend[0]({ touches: [], changedTouches: [{ clientX: 200, clientY: 310 }], target });
    assert.equal(app.elements['#side-panel'].hidden, false);
    assert.equal(entries.length, 2, 'the reopened panel has its entry again');
  } finally {
    delete globalThis.history;
    delete globalThis.addEventListener;
    uninstall();
  }
});

test('a click on the header outside its buttons closes and opens the side panel, which keeps showing the exercises', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-exercises' });
    app.dispatch({ action: 'toggle-panel' });
    assert.equal(app.elements['#side-panel'].hidden, true);
    assert.equal(app.elements['.exercises-toggle'].attributes['aria-expanded'], 'false');
    app.dispatch({ action: 'toggle-panel' });
    assert.equal(app.elements['#side-panel'].hidden, false);
    assert.equal(app.elements['.exercises-toggle'].attributes['aria-expanded'], 'true');
    assert.ok(app.elements['#option-list'].innerHTML.includes('data-action="toggle-exercise"'));
  } finally {
    uninstall();
  }
});

/** Waits until the promises the app started (e.g. loading the help) have settled. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('the help button loads the help page once and shows its main part in the side panel', async () => {
  try {
    const app = await loadApp();
    assert.ok(!app.fetched.some((url) => url.endsWith('/help.html')), 'the help is not loaded at start-up');
    app.dispatch({ action: 'toggle-help' });
    assert.equal(app.elements['#options'].attributes['aria-label'], 'Help');
    assert.ok(app.elements['#option-list'].innerHTML.includes('Loading the help'));
    await settle();
    const list = app.elements['#option-list'].innerHTML;
    assert.ok(list.startsWith('<div class="help">'));
    assert.ok(list.includes('<h2>What Chordice does</h2>'));
    assert.ok(!list.includes('Back to Chordice'));
    assert.equal(app.elements['.help-toggle'].attributes['aria-expanded'], 'true');
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'false');
    assert.equal(app.elements['.exercises-toggle'].attributes['aria-expanded'], 'false');
    // Showing the help again does not load it again.
    app.dispatch({ action: 'toggle-options' });
    app.dispatch({ action: 'toggle-help' });
    await settle();
    assert.equal(app.fetched.filter((url) => url.endsWith('/help.html')).length, 1);
    assert.ok(app.elements['#option-list'].innerHTML.includes('<h2>What Chordice does</h2>'));
  } finally {
    uninstall();
  }
});

test('the help is not re-rendered while it is shown, e.g. by New Song, so the reader keeps their place', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-help' });
    await settle();
    app.elements['#option-list'].innerHTML = 'kept';
    app.dispatch({ action: 'reroll' });
    assert.equal(app.elements['#option-list'].innerHTML, 'kept');
  } finally {
    uninstall();
  }
});

test('when the help cannot be loaded, the side panel says so, and the next press of the help button tries again', async () => {
  try {
    const app = await loadApp({ helpOk: false });
    app.dispatch({ action: 'toggle-help' });
    await settle();
    assert.ok(app.elements['#option-list'].innerHTML.includes('The help could not be loaded.'));
    // New Song does not retry the load.
    app.dispatch({ action: 'reroll' });
    await settle();
    assert.equal(app.fetched.filter((url) => url.endsWith('/help.html')).length, 1);
    app.dispatch({ action: 'toggle-help' });
    app.dispatch({ action: 'toggle-help' });
    await settle();
    assert.equal(app.fetched.filter((url) => url.endsWith('/help.html')).length, 2);
  } finally {
    uninstall();
  }
});

test('a stored help panel is shown again at start-up', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), panel: 'help' });
    const app = await loadApp({ cookie });
    await settle();
    assert.ok(app.elements['#option-list'].innerHTML.includes('<h2>What Chordice does</h2>'));
    assert.equal(app.elements['.help-toggle'].attributes['aria-expanded'], 'true');
  } finally {
    uninstall();
  }
});

test('a click on the song outside the chords closes the side panel, whatever it shows, and leaves its sections as they are', async () => {
  for (const panel of ['toggle-options', 'toggle-exercises', 'toggle-help']) {
    try {
      const app = await loadApp();
      app.dispatch({ action: panel });
      await settle();
      if (panel === 'toggle-options') {
        // The options panel is shown at start-up; pressing its button again would close it.
        app.dispatch({ action: 'toggle-panel' });
      }
      app.dispatch({ action: 'toggle-section', section: 'bass' });
      const before = decodeURIComponent(app.document.cookie);
      assert.ok(before.includes('"showOptions":true'), panel);
      assert.equal(app.elements['#side-panel'].hidden, false, panel);
      app.click({ closest: () => null, insideContent: true });
      const after = decodeURIComponent(app.document.cookie);
      assert.ok(after.includes('"showOptions":false'), panel);
      assert.equal(app.elements['#side-panel'].hidden, true, panel);
      const collapsed = (cookie) => /"collapsed":\[[^\]]*\]/.exec(cookie)[0];
      assert.equal(collapsed(after), collapsed(before), 'the sections stay as they were');
    } finally {
      uninstall();
    }
  }
});

test('a click on the circle of fifths outside its keys leaves the side panel open', async () => {
  try {
    const app = await loadApp();
    // Inside the song and inside the circle, but not on a key: between two wedges, or on a greyed-out key.
    assert.ok(decodeURIComponent(app.document.cookie).includes('"showOptions":true'));
    app.click({ closest: () => null, insideContent: true, insideCircle: true });
    assert.ok(decodeURIComponent(app.document.cookie).includes('"showOptions":true'));
    assert.equal(app.elements['#side-panel'].hidden, false);
  } finally {
    uninstall();
  }
});

test('a click on the song with the side panel closed leaves it closed', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-panel' });
    app.click({ closest: () => null, insideContent: true });
    assert.ok(decodeURIComponent(app.document.cookie).includes('"showOptions":false'));
    assert.equal(app.elements['#side-panel'].hidden, true);
  } finally {
    uninstall();
  }
});

test('app.js keeps the scroll position of the progression list when a progression is toggled', async () => {
  try {
    const app = await loadApp();
    // The first query finds the list before the re-render, the second finds the freshly rendered one.
    const before = { scrollTop: 120 };
    const after = { scrollTop: 0 };
    let calls = 0;
    app.elements['#option-list'].querySelector = () => (calls++ === 0 ? before : after);
    app.dispatch({ action: 'toggle-progression', id: LIBRARY[0].id });
    assert.equal(after.scrollTop, 120);
  } finally {
    uninstall();
  }
});

test('app.js applies a probability slider change to the options', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-section', section: 'progressionVariations' });
    app.change(new FakeInput('range', 'rotation', '4'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('Rotations <output>4</output>'));
  } finally {
    uninstall();
  }
});

test('app.js shows the top melody notes while inversions are on, and hides them when they are off', async () => {
  try {
    const app = await loadApp();
    // The melody note alone is shown as a circled tone; with the tones switch on it is the top tone of the column.
    app.dispatch({ action: 'toggle-tones' });
    assert.ok(!app.elements['#song-rows'].innerHTML.includes('tone-top'));
    assert.equal(app.elements['[data-action="toggle-melody"]'].attributes['aria-pressed'], 'false');
    app.dispatch({ action: 'toggle-melody' });
    assert.ok(app.elements['#song-rows'].innerHTML.includes('<span class="tone tone-top">'));
    assert.equal(app.elements['[data-action="toggle-melody"]'].attributes['aria-pressed'], 'true');
    app.dispatch({ action: 'toggle-melody' });
    assert.ok(!app.elements['#song-rows'].innerHTML.includes('tone-top'));
  } finally {
    uninstall();
  }
});

test('app.js ignores change events from elements that are not probability sliders', async () => {
  try {
    const app = await loadApp();
    const before = app.document.cookie;
    app.change({ type: 'range', dataset: { option: 'rotation' }, value: '90' });
    app.change(new FakeInput('checkbox', 'rotation', '90'));
    assert.equal(app.document.cookie, before);
  } finally {
    uninstall();
  }
});

test('app.js shows an error in the rows when the data file cannot be loaded', async () => {
  try {
    const app = await loadApp({ ok: false });
    assert.equal(app.elements['#song-rows'].textContent, `Chordice could not start: Could not load ${app.fetched[0]}: 404`);
  } finally {
    uninstall();
  }
});

test('app.js marks the tab of the piano by default, and a click on the guitar tab loads the shapes, marks the guitar and stores it', async () => {
  try {
    const app = await loadApp();
    const [piano, guitar] = app.instrumentTabs;
    assert.equal(piano.attributes['aria-pressed'], 'true');
    assert.equal(guitar.attributes['aria-pressed'], 'false');
    await app.dispatch({ action: 'set-instrument', instrument: 'guitar' });
    assert.equal(app.elements['#status'].hidden, true);
    assert.ok(app.fetched.some((url) => url.endsWith('/@tombatossals/chords-db@0.5.1/lib/guitar.json')));
    assert.equal(piano.attributes['aria-pressed'], 'false');
    assert.equal(guitar.attributes['aria-pressed'], 'true');
    assert.ok(decodeURIComponent(app.document.cookie).includes('"instrument":"guitar"'));
  } finally {
    uninstall();
  }
});

test('two clicks on the guitar tab while its shapes are loading fetch them only once', async () => {
  try {
    const app = await loadApp();
    const guitar = { action: 'set-instrument', instrument: 'guitar' };
    await Promise.all([app.dispatch(guitar), app.dispatch(guitar)]);
    assert.equal(app.fetched.filter((url) => url.endsWith('/guitar.json')).length, 1);
    assert.equal(app.instrumentTabs[1].attributes['aria-pressed'], 'true');
  } finally {
    uninstall();
  }
});

test('app.js keeps the piano when the guitar shapes cannot be loaded, and does not store the guitar', async () => {
  const logged = [];
  const error = console.error;
  console.error = (message) => logged.push(message);
  try {
    const app = await loadApp({ guitarOk: false });
    const [piano, guitar] = app.instrumentTabs;
    await app.dispatch({ action: 'set-instrument', instrument: 'guitar' });
    assert.equal(piano.attributes['aria-pressed'], 'true');
    assert.equal(guitar.attributes['aria-pressed'], 'false');
    assert.ok(!decodeURIComponent(app.document.cookie).includes('"instrument":"guitar"'));
    // The rows still show, so the page works without the guitar.
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 2);
    assert.ok(logged.some((message) => message.includes('could not load the guitar shapes')));
    // The page says so, in a message above the chords.
    assert.equal(app.elements['#status'].hidden, false);
    assert.ok(app.elements['#status'].textContent.includes('guitar shapes could not be loaded'));
  } finally {
    console.error = error;
    uninstall();
  }
});

test('app.js starts on the piano when the stored guitar cannot be loaded, and the page still shows its rows', async () => {
  const error = console.error;
  console.error = () => {};
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar' });
    const app = await loadApp({ cookie, guitarOk: false });
    assert.equal(app.instrumentTabs[0].attributes['aria-pressed'], 'true');
    assert.equal(app.instrumentTabs[1].attributes['aria-pressed'], 'false');
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 2);
    assert.equal(app.elements['#status'].hidden, false);
  } finally {
    console.error = error;
    uninstall();
  }
});

test('app.js restores the guitar tab from the cookie', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar' });
    const app = await loadApp({ cookie });
    assert.equal(app.instrumentTabs[1].attributes['aria-pressed'], 'true');
    assert.equal(app.instrumentTabs[0].attributes['aria-pressed'], 'false');
  } finally {
    uninstall();
  }
});

test('on the guitar the melody button is greyed out, the melody notes are gone, and the stored switch comes back on the piano', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar', inversions: true, tones: false });
    const app = await loadApp({ cookie });
    const inversions = app.elements['[data-action="toggle-melody"]'];
    assert.equal(inversions.disabled, true);
    assert.equal(inversions.attributes['aria-pressed'], 'true');
    assert.ok(!app.elements['#song-rows'].innerHTML.includes('tone-top'));
    app.dispatch({ action: 'toggle-melody' });
    assert.equal(inversions.attributes['aria-pressed'], 'true');
    app.dispatch({ action: 'set-instrument', instrument: 'piano' });
    assert.equal(inversions.disabled, false);
    assert.ok(app.elements['#song-rows'].innerHTML.includes('tone-top'));
  } finally {
    uninstall();
  }
});

test('on the guitar the rows have no bass variations, and the bass returns with the piano at the amount set before', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar', bassProbability: 5, inversions: true });
    const app = await loadApp({ cookie });
    assert.ok(!app.elements['#song-rows'].innerHTML.includes('class="bass"'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('is-unavailable'));
    app.dispatch({ action: 'set-instrument', instrument: 'piano' });
    assert.ok(app.elements['#song-rows'].innerHTML.includes('class="bass"'));
    assert.ok(!app.elements['#option-list'].innerHTML.includes('is-unavailable'));
  } finally {
    uninstall();
  }
});

test('on the guitar a click on the bass variations heading does not open it, and its amount shows 0', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar', bassProbability: 4 });
    const app = await loadApp({ cookie });
    app.dispatch({ action: 'toggle-section', section: 'bass' });
    assert.ok(!app.elements['#option-list'].innerHTML.includes('data-option="bassProbability"'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('<span class="summary-label">Amount</span>: <span class="summary-value">0</span>'));
  } finally {
    uninstall();
  }
});

test('app.js shows 12 rows, one per key with its key in the heading, while the circle of fifths switch is on', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-circle-of-fifths' });
    const html = app.elements['#song-rows'].innerHTML;
    assert.equal(rowCount(html), 12);
    assert.ok(html.includes('<span class="row-title">C (A<span class="minor-sign">m</span>) · '));
    assert.ok(html.includes('<span class="row-title">F (D<span class="minor-sign">m</span>) · '));
    assert.ok(html.indexOf('C (A<span') < html.indexOf('F (D<span'));
    assert.match(app.elements['#option-list'].innerHTML, /class="chip count-toggle"[^>]*disabled>12<\/button>/);
    app.dispatch({ action: 'toggle-circle-of-fifths' });
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 2, 'the stored count comes back');
    assert.ok(!app.elements['#song-rows'].innerHTML.includes('C (A<span'));
  } finally {
    uninstall();
  }
});

test('app.js keeps the state for the folder of the page, and at the root of a host for "/"', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), count: 8 });
    const app = await loadApp({ cookie, pathname: '/chordice/index.html' });
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 8);
    assert.ok(app.written.length > 0);
    assert.ok(app.written.every((value) => value.startsWith('chordice_state=%7B') && value.includes('; Path=/chordice/;')));
    uninstall();
    const root = await loadApp({ pathname: '/' });
    assert.ok(root.written.every((value) => value.includes('; Path=/;')));
  } finally {
    uninstall();
  }
});

// The chord database is not imported as a module: it has no module entry point, so app.js fetches its lib/guitar.json instead.
test('the guitar shapes are fetched from the chord database at the version in package.json', () => {
  const app = readFileSync(new URL('../../../chordice/app/app.js', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).devDependencies;
  const url = /const GUITAR_URL = '([^']+)'/.exec(app)?.[1] ?? '';
  assert.ok(url.includes(`/@tombatossals/chords-db@${manifest['@tombatossals/chords-db']}/lib/guitar.json`), url);
});

test('app.js has no start-up code of its own: it exports startApp, which main.js calls', () => {
  const app = readFileSync(new URL('../../../chordice/app/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('export function startApp()'));
  assert.ok(!/^(loadData|startApp)\(/m.test(app), 'app.js calls nothing at the top level');
});

test('app.js keeps a copy of the state in the local storage, next to the cookie', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'cycle-count' });
    const stored = JSON.parse(app.storage.getItem(STORAGE_KEY));
    assert.equal(stored.count, 4, 'the count after the default of 2');
    assert.equal(stored.selection, undefined, 'like the cookie, the copy leaves out the selection');
  } finally {
    uninstall();
  }
});

test('app.js restores the state from the local storage once Safari has dropped the cookie', async () => {
  try {
    const stored = serializeStored({ ...defaultState(LIBRARY, () => 0.5), count: 8 });
    const app = await loadApp({ stored });
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 8);
  } finally {
    uninstall();
  }
});

test('the cookie wins over the stored copy when both are there', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), count: 1 });
    const stored = serializeStored({ ...defaultState(LIBRARY, () => 0.5), count: 8 });
    const app = await loadApp({ cookie, stored });
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 1);
  } finally {
    uninstall();
  }
});

test('app.js starts and keeps the cookie when the browser refuses the local storage', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), count: 4 });
    const app = await loadApp({ cookie, storage: REFUSED_STORAGE });
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 4);
    await app.dispatch({ action: 'cycle-count' });
    assert.ok(decodeURIComponent(app.document.cookie).includes('"count":8'));
  } finally {
    uninstall();
  }
});

test('the browser bars take the paper of the theme, and follow the theme switch', async () => {
  try {
    const app = await loadApp();
    const meta = app.elements['meta[name="theme-color"]'];
    assert.equal(meta.attributes.content, THEME_COLOURS.light);
    await app.dispatch({ action: 'toggle-theme' });
    assert.equal(meta.attributes.content, THEME_COLOURS.dark);
  } finally {
    uninstall();
  }
});

test('a page without the theme-color tag still renders and switches the theme', async () => {
  try {
    const app = await loadApp();
    app.elements['meta[name="theme-color"]'] = null;
    await app.dispatch({ action: 'toggle-theme' });
    assert.equal(app.document.documentElement.dataset.theme, 'dark');
  } finally {
    uninstall();
  }
});

test('the paper of each theme for the browser bars is the --bg of that theme in main.css', () => {
  const css = readFileSync(new URL('../../../chordice/styles/main.css', import.meta.url), 'utf8');
  const backgrounds = [...css.matchAll(/--bg:\s*(#[0-9a-f]{6})/g)].map((match) => match[1]);
  assert.ok(backgrounds.includes(THEME_COLOURS.light));
  assert.ok(backgrounds.includes(THEME_COLOURS.dark));
});

test('the circle of fifths beside the chords shows the selected key and its button, also while the side panel is closed', async () => {
  try {
    const app = await loadApp();
    const circle = () => app.elements['#song-circle'].innerHTML;
    assert.ok(circle().includes('aria-label="Circle of fifths"'));
    assert.ok(circle().includes('data-action="toggle-circle-of-fifths"'), 'the circle of fifths button in its middle');
    assert.ok(/data-key="C" [^>]*aria-pressed="true"/.test(circle()));
    app.dispatch({ action: 'toggle-options' });
    assert.equal(app.elements['#side-panel'].hidden, true);
    app.dispatch({ action: 'set-key', key: 'G' });
    assert.ok(/data-key="G" [^>]*aria-pressed="true"/.test(circle()), 'a click on a key beside the chords selects it');
    assert.ok(!circle().includes('is-disabled'));
  } finally {
    uninstall();
  }
});

test('Enter or Space on a key of the circle of fifths chooses it, without scrolling the page', async () => {
  try {
    const app = await loadApp();
    const circle = () => app.elements['#song-circle'].innerHTML;
    assert.equal(app.keydown('Enter', { action: 'set-key', key: 'G' }), true);
    assert.ok(/data-key="G" [^>]*aria-pressed="true"/.test(circle()), 'Enter chooses the key');
    assert.equal(app.keydown(' ', { action: 'set-key', key: 'D' }), true);
    assert.ok(/data-key="D" [^>]*aria-pressed="true"/.test(circle()), 'Space chooses the key');
    assert.equal(app.keydown('a', { action: 'set-key', key: 'A' }), false, 'other keys are left to the browser');
    assert.ok(/data-key="D" [^>]*aria-pressed="true"/.test(circle()));
    assert.equal(app.keydown('Enter', { action: 'reroll' }), false, 'real buttons are left to the browser');
  } finally {
    uninstall();
  }
});

test('Enter on a key of the greyed-out circle of fifths changes nothing', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-circle-of-fifths' });
    const before = decodeURIComponent(app.document.cookie);
    app.keydown('Enter', { action: 'set-key', key: 'G' });
    assert.equal(decodeURIComponent(app.document.cookie), before);
  } finally {
    uninstall();
  }
});

test('the circle of fifths beside the chords is greyed out while the circle of fifths switch is on', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-circle-of-fifths' });
    const circle = app.elements['#song-circle'].innerHTML;
    assert.ok(circle.includes('class="circle is-disabled"'));
    assert.ok(!/data-key="[^"]+" [^>]*aria-pressed="true"/.test(circle), 'no key is selected');
    assert.ok(circle.includes('class="chip circle-toggle is-on" aria-pressed="true"'));
    app.dispatch({ action: 'toggle-circle-of-fifths' });
    assert.ok(!app.elements['#song-circle'].innerHTML.includes('is-disabled'), 'the button switches it off again');
  } finally {
    uninstall();
  }
});
