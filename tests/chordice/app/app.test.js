import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SONGS_FAILED, THEME_COLOURS, startApp } from '../../../chordice/app/app.js';
import { BASS_PATTERNS, BASS_TEXT, LIBRARY, PROGRESSIONS_TEXT as YAML_TEXT } from '../../helpers/fixtures.js';
import { defaultState } from '../../../chordice/app/state/state.js';
import { STORAGE_KEY, serializeCookie, serializeSettings, serializeStored } from '../../../chordice/app/state/persistence.js';
import { SONGS_KEY, parseSongs, saveSong, songsRecord } from '../../../chordice/app/state/songs.js';

// app.js has no side effects on import; startApp runs against the minimal fake DOM installed by loadApp below.
// The guitar shapes as the CDN serves them; app.js fetches them from the URL of the installed version.
const HELP_TEXT = readFileSync(new URL('../../../chordice/app/help/help.html', import.meta.url), 'utf8');
// The imprint and the privacy policy, which the help window shows too.
const LEGAL_TEXTS = Object.fromEntries(['imprint', 'privacy'].map((page) => [
  `/${page}.html`,
  readFileSync(new URL(`../../../chordice/app/help/${page}.html`, import.meta.url), 'utf8'),
]));
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
async function loadApp({ cookie = '', stored = null, storage = fakeStorage(stored), yaml = YAML_TEXT, bass = BASS_TEXT, ok = true, guitarOk = true, helpOk = true, pathname = '/chordice/index.html', connect = () => null } = {}) {
  const elements = {
    '#side-panel': new FakeElement(),
    '#options': new FakeElement(),
    '#option-list': new FakeElement(),
    '#song-rows': new FakeElement(),
    // Only the targets marked as inside the circle count as inside it, not every target inside the song.
    '#song-circle': Object.assign(new FakeElement(), { contains: (node) => node?.insideCircle === true }),
    '.song-body': new FakeElement(),
    '.song-chords': new FakeElement(),
    '#background': new FakeBackground(),
    '#status': new FakeElement(),
    '.options-toggle': new FakeElement(),
    '.exercises-toggle': new FakeElement(),
    '.songs-toggle': new FakeElement(),
    '.account-toggle': new FakeElement(),
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
    const legal = Object.keys(LEGAL_TEXTS).find((ending) => String(url).endsWith(ending));
    if (legal) {
      return { ok: helpOk, status: helpOk ? 200 : 404, text: async () => LEGAL_TEXTS[legal] };
    }
    const isHelp = String(url).endsWith('/help.html');
    const good = isGuitar ? guitarOk : isHelp ? helpOk : ok;
    const text = String(url).endsWith('/bass_patterns.yaml') ? bass : isGuitar ? GUITAR_TEXT : isHelp ? HELP_TEXT : yaml;
    return { ok: good, status: good ? 200 : 404, text: async () => text };
  };

  // The page has no account unless a test gives it one (see fakeAccount), whatever Firebase project account.js names.
  await startApp({ connect });

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
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 4);
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'true');
    assert.ok(app.document.cookie.startsWith('chordice_state='));
  } finally {
    uninstall();
  }
});

test('app.js zooms the chords only, not the body with the circle of fifths', async () => {
  try {
    const app = await loadApp();
    // Without a layout to measure, the chords show the default zoom.
    assert.equal(app.elements['.song-chords'].style['--zoom'], '1.2');
    assert.equal(app.elements['.song-body'].style['--zoom'], undefined);
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
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 8);
    assert.match(app.elements['#option-list'].innerHTML, /class="chip count-toggle"[^>]*>8<\/button>/);
    assert.ok(app.document.cookie.includes('chordice_state='));
    assert.ok(decodeURIComponent(app.document.cookie).includes('"count":8'));
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
    assert.ok(list.includes('<h2>Help</h2>'));
    assert.ok(!list.includes('Back to Chordice'));
    assert.equal(app.elements['.help-toggle'].attributes['aria-expanded'], 'true');
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'false');
    assert.equal(app.elements['.exercises-toggle'].attributes['aria-expanded'], 'false');
    // Showing the help again does not load it again.
    app.dispatch({ action: 'toggle-options' });
    app.dispatch({ action: 'toggle-help' });
    await settle();
    assert.equal(app.fetched.filter((url) => url.endsWith('/help.html')).length, 1);
    assert.ok(app.elements['#option-list'].innerHTML.includes('<h2>Help</h2>'));
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
    assert.ok(app.elements['#option-list'].innerHTML.includes('<h2>Help</h2>'));
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
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 4);
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
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 4);
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
    assert.equal(rowCount(app.elements['#song-rows'].innerHTML), 4, 'the stored count comes back');
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
  assert.ok(app.includes('export function startApp('));
  assert.ok(!/^(loadData|startApp)\(/m.test(app), 'app.js calls nothing at the top level');
});

test('app.js keeps a copy of the state in the local storage, next to the cookie', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'cycle-count' });
    const stored = JSON.parse(app.storage.getItem(STORAGE_KEY));
    assert.equal(stored.count, 8, 'the count after the default of 4');
    assert.ok(Array.isArray(stored.selection), 'like the cookie, the copy keeps the selection');
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

/** Gives the option list of the fake page a name field of the songs panel holding `name`, and returns the field. */
function nameField(app, name) {
  const field = { value: name };
  app.elements['#option-list'].querySelector = (selector) => (selector === '#song-name' ? field : new FakeElement());
  return field;
}

/** Submits the form of the songs panel, as Enter in the name field or a click on its Save button does. */
function submitSave(app) {
  let prevented = false;
  const target = { closest: (selector) => (selector === '[data-form="save-song"]' ? {} : null) };
  for (const listener of app.listeners.submit ?? []) {
    listener({ target, preventDefault: () => { prevented = true; } });
  }
  return prevented;
}

test('the songs button shows the saved songs, and saving keeps the song in the local storage, not in the cookie', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    assert.equal(app.elements['.songs-toggle'].attributes['aria-expanded'], 'true');
    assert.ok(app.elements['#option-list'].innerHTML.includes('data-form="save-song"'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('No saved songs yet'));
    const field = nameField(app, 'Favourite');
    assert.equal(submitSave(app), true, 'the form is not sent to a server');
    const songs = parseSongs(app.storage.getItem(SONGS_KEY));
    assert.deepEqual(songs.map((song) => song.name), ['Favourite']);
    assert.equal(field.value, '', 'the field is empty for the next song');
    assert.ok(app.elements['#option-list'].innerHTML.includes('<span class="saved-song-name">Favourite</span>'));
    assert.ok(!decodeURIComponent(app.document.cookie).includes('Favourite'), 'the cookie stays small');
  } finally {
    uninstall();
  }
});

test('a saved song comes back with a click on it after New Song, and the saved songs are read again at start-up', async () => {
  try {
    const app = await loadApp();
    nameField(app, 'Keep');
    submitSave(app);
    const saved = app.elements['#song-rows'].innerHTML;
    await app.dispatch({ action: 'reroll' });
    assert.notEqual(app.elements['#song-rows'].innerHTML, saved);
    const [song] = parseSongs(app.storage.getItem(SONGS_KEY));
    await app.dispatch({ action: 'load-song', id: song.id });
    assert.equal(app.elements['#song-rows'].innerHTML, saved);
    // The page opened again finds the song.
    const again = await loadApp({ storage: app.storage, cookie: app.document.cookie });
    await again.dispatch({ action: 'toggle-songs' });
    assert.ok(again.elements['#option-list'].innerHTML.includes('<span class="saved-song-name">Keep</span>'));
  } finally {
    uninstall();
  }
});

test('a saved song that the page now generates otherwise is shown frozen, with a note, until it is generated anew', async () => {
  try {
    const app = await loadApp();
    nameField(app, 'Older');
    submitSave(app);
    // The song as an older version of the page made it: its first chord was another one.
    const [song] = parseSongs(app.storage.getItem(SONGS_KEY));
    song.song.rows[0].chords[0] = { ...song.song.rows[0].chords[0], symbol: 'Ebmaj7', displaySymbol: 'Ebmaj7', variation: 'maj7' };
    app.storage.setItem(SONGS_KEY, JSON.stringify([song]));
    const again = await loadApp({ storage: app.storage, cookie: app.document.cookie });
    await again.dispatch({ action: 'load-song', id: song.id });
    assert.ok(again.elements['#song-rows'].innerHTML.includes('E<span class="accidental">♭</span>'), 'the saved chord is shown');
    assert.ok(again.elements['#option-list'].innerHTML.includes('class="frozen-note"'));
    assert.ok(decodeURIComponent(again.document.cookie).includes(`"frozen":"${song.id}"`));
    // The options that make the song are fixed.
    const rows = again.elements['#song-rows'].innerHTML;
    await again.dispatch({ action: 'cycle-count' });
    assert.equal(again.elements['#song-rows'].innerHTML, rows);
    // Generating anew shows what the options give now.
    await again.dispatch({ action: 'unfreeze-song' });
    assert.ok(!again.elements['#option-list'].innerHTML.includes('class="frozen-note"'));
    assert.ok(!again.elements['#song-rows'].innerHTML.includes('E<span class="accidental">♭</span>'));
  } finally {
    uninstall();
  }
});

test('the cross asks in the entry of the song whether to delete it, without a dialog; Delete deletes it', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'Maybe');
    submitSave(app);
    const [song] = parseSongs(app.storage.getItem(SONGS_KEY));
    // A browser that blocks its dialogs answers every question with no; the page does not ask it.
    globalThis.confirm = () => {
      throw new Error('no dialog of the browser');
    };
    await app.dispatch({ action: 'delete-song', id: song.id });
    assert.ok(app.elements['#option-list'].innerHTML.includes('class="delete-question"'));
    assert.equal(parseSongs(app.storage.getItem(SONGS_KEY)).length, 1, 'the cross alone deletes nothing');
    await app.dispatch({ action: 'confirm-delete', id: song.id });
    assert.deepEqual(parseSongs(app.storage.getItem(SONGS_KEY)), []);
    assert.ok(!app.elements['#option-list'].innerHTML.includes('class="delete-question"'));
  } finally {
    delete globalThis.confirm;
    uninstall();
  }
});

test('the cross of the question, or any other action, keeps the song that was about to be deleted', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'Stay');
    submitSave(app);
    const [song] = parseSongs(app.storage.getItem(SONGS_KEY));
    const asking = () => app.elements['#option-list'].innerHTML.includes('class="delete-question"');
    await app.dispatch({ action: 'delete-song', id: song.id });
    await app.dispatch({ action: 'cancel-delete' });
    assert.equal(asking(), false);
    await app.dispatch({ action: 'delete-song', id: song.id });
    await app.dispatch({ action: 'toggle-roman' });
    assert.equal(asking(), false);
    // Renaming ends the question too, and the question ends renaming.
    await app.dispatch({ action: 'delete-song', id: song.id });
    await app.dispatch({ action: 'rename-song', id: song.id });
    assert.equal(asking(), false);
    await app.dispatch({ action: 'delete-song', id: song.id });
    assert.ok(!app.elements['#option-list'].innerHTML.includes('data-form="rename-song"'));
    assert.equal(parseSongs(app.storage.getItem(SONGS_KEY)).length, 1);
  } finally {
    uninstall();
  }
});

/** Submits the rename form of the song with the id, as Enter in its field or a click on its OK button does. */
function submitRename(app, id) {
  let prevented = false;
  const form = { dataset: { id } };
  const target = { closest: (selector) => (selector === '[data-form="rename-song"]' ? form : null) };
  for (const listener of app.listeners.submit ?? []) {
    listener({ target, preventDefault: () => { prevented = true; } });
  }
  return prevented;
}

/** Gives the option list of the fake page the field of a song that is being renamed, holding `name`, and returns it. */
function renameField(app, name) {
  const field = { value: name, focused: false, selected: false, focus() { this.focused = true; }, select() { this.selected = true; } };
  app.elements['#option-list'].querySelector = (selector) => (selector === '#rename-name' ? field : new FakeElement());
  return field;
}

test('the pencil shows the name of a saved song in a field, focused, and OK or Enter renames it, without a dialog', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'Old name');
    submitSave(app);
    const [song] = parseSongs(app.storage.getItem(SONGS_KEY));
    const field = renameField(app, 'Old name');
    await app.dispatch({ action: 'rename-song', id: song.id });
    assert.ok(app.elements['#option-list'].innerHTML.includes('data-form="rename-song"'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('value="Old name"'));
    assert.equal(field.focused && field.selected, true, 'typing replaces the name');
    field.value = '  New name ';
    assert.equal(submitRename(app, song.id), true, 'the form is not sent to a server');
    assert.equal(parseSongs(app.storage.getItem(SONGS_KEY))[0].name, 'New name');
    assert.ok(!app.elements['#option-list'].innerHTML.includes('data-form="rename-song"'), 'the field is gone again');
    assert.ok(app.elements['#option-list'].innerHTML.includes('<span class="saved-song-name">New name</span>'));
  } finally {
    uninstall();
  }
});

test('the cross, Escape or any other action leaves the name of a song that is being renamed as it was', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'Kept');
    submitSave(app);
    const [song] = parseSongs(app.storage.getItem(SONGS_KEY));
    const editing = () => app.elements['#option-list'].innerHTML.includes('data-form="rename-song"');
    renameField(app, 'Changed');
    await app.dispatch({ action: 'rename-song', id: song.id });
    await app.dispatch({ action: 'cancel-rename' });
    assert.equal(editing(), false);
    await app.dispatch({ action: 'rename-song', id: song.id });
    let prevented = false;
    const target = { closest: (selector) => (selector === '[data-form="rename-song"]' ? {} : null) };
    for (const listener of app.listeners.keydown ?? []) {
      listener({ key: 'Escape', target, preventDefault: () => { prevented = true; } });
    }
    assert.equal(prevented, true);
    assert.equal(editing(), false);
    await app.dispatch({ action: 'rename-song', id: song.id });
    await app.dispatch({ action: 'toggle-roman' });
    assert.equal(editing(), false);
    assert.equal(parseSongs(app.storage.getItem(SONGS_KEY))[0].name, 'Kept');
  } finally {
    uninstall();
  }
});

test('a song saved in another tab is not lost: saving starts from the stored songs, and the storage event shows them', async () => {
  const storageListeners = [];
  globalThis.addEventListener = (type, listener) => {
    if (type === 'storage') {
      storageListeners.push(listener);
    }
  };
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    // Another tab, opened at the same time, saves a song first.
    const other = await loadApp({ storage: app.storage, cookie: app.document.cookie });
    nameField(other, 'From B');
    submitSave(other);
    // This tab has not heard of it yet, and saves its own: both are kept.
    nameField(app, 'From A');
    submitSave(app);
    assert.deepEqual(parseSongs(app.storage.getItem(SONGS_KEY)).map((song) => song.name), ['From A', 'From B']);
    // The storage event of the other tab shows its songs here at once, and deleting one there removes it here.
    const [, fromB] = parseSongs(app.storage.getItem(SONGS_KEY));
    const remaining = JSON.stringify(parseSongs(app.storage.getItem(SONGS_KEY)).filter((song) => song.id !== fromB.id));
    app.storage.setItem(SONGS_KEY, remaining);
    storageListeners.forEach((listener) => listener({ key: SONGS_KEY, newValue: remaining }));
    assert.ok(!app.elements['#option-list'].innerHTML.includes('From B'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('From A'));
    // An event of another entry changes nothing.
    storageListeners.forEach((listener) => listener({ key: STORAGE_KEY, newValue: '{}' }));
    assert.ok(app.elements['#option-list'].innerHTML.includes('From A'));
  } finally {
    delete globalThis.addEventListener;
    uninstall();
  }
});

test('a song that cannot be stored stays listed, and the page says it will be lost, until a write works', async () => {
  try {
    const items = new Map();
    let full = true;
    const storage = {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => {
        if (full && key === SONGS_KEY) {
          throw new Error('QuotaExceededError');
        }
        items.set(key, String(value));
      },
    };
    const app = await loadApp({ storage });
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'Fragile');
    submitSave(app);
    assert.equal(app.elements['#status'].textContent, SONGS_FAILED);
    assert.equal(app.elements['#status'].hidden, false);
    assert.ok(app.elements['#option-list'].innerHTML.includes('Fragile'));
    assert.equal(storage.getItem(SONGS_KEY), null);
    // Once there is room again, the next render stores the song and the message goes.
    full = false;
    await app.dispatch({ action: 'toggle-roman' });
    assert.deepEqual(parseSongs(storage.getItem(SONGS_KEY)).map((song) => song.name), ['Fragile']);
    assert.equal(app.elements['#status'].hidden, true);
  } finally {
    uninstall();
  }
});

test('a browser that refuses the storage keeps the songs of the tab, and says they will be lost', async () => {
  try {
    const app = await loadApp({ storage: REFUSED_STORAGE });
    nameField(app, 'One');
    submitSave(app);
    nameField(app, 'Two');
    submitSave(app);
    assert.equal(app.elements['#status'].textContent, SONGS_FAILED);
    await app.dispatch({ action: 'toggle-songs' });
    assert.ok(app.elements['#option-list'].innerHTML.includes('One'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('Two'));
  } finally {
    uninstall();
  }
});

/**
 * Lets the option list of the fake page track the focus as a browser does: a control rendered by the songs panel can be
 * focused, and re-rendering removes the focused control, so the focus falls out of the list. `controls` gives the
 * controls the list holds after a render, from its markup.
 */
function trackFocus(app, controls) {
  const list = app.elements['#option-list'];
  let html = list.innerHTML;
  let active = null;
  Object.defineProperty(app.document, 'activeElement', { get: () => active, configurable: true });
  const control = (dataset) => ({ dataset, alive: true, insideContent: true, focus() { active = this; } });
  let shown = [];
  Object.defineProperty(list, 'innerHTML', {
    get: () => html,
    set: (value) => {
      html = value;
      if (active) {
        active.alive = false;
      }
      shown = controls(value).map(control);
    },
    configurable: true,
  });
  list.contains = (node) => node?.insideContent === true && node.alive === true;
  list.querySelectorAll = (selector) => {
    const action = /data-action="([^"]+)"/.exec(selector)?.[1];
    return shown.filter((element) => element.dataset.action === action);
  };
  list.querySelector = (selector) => shown.find((element) => `#${element.dataset.id}` === selector) ?? null;
  return {
    focusOn(dataset) {
      active = control(dataset);
    },
    get active() {
      return active;
    },
  };
}

test('after an action of the songs panel, a keyboard user is given the control that takes the place of the one used', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'First');
    submitSave(app);
    nameField(app, 'Second');
    submitSave(app);
    const [second, first] = parseSongs(app.storage.getItem(SONGS_KEY));
    // The controls the songs panel renders: the name field and the buttons with their song ids.
    const songControls = (html) => [
      ...(html.includes('id="song-name"') ? [{ id: 'song-name' }] : []),
      ...[...html.matchAll(/data-action="([^"]+)" data-id="([^"]+)"/g)].map(([, action, id]) => ({ action, id })),
    ];
    const focus = trackFocus(app, songControls);
    // The cross turns into the question: Delete is focused.
    focus.focusOn({ action: 'delete-song', id: second.id });
    await app.dispatch({ action: 'delete-song', id: second.id });
    assert.deepEqual(focus.active.dataset, { action: 'confirm-delete', id: second.id });
    // The cross of the question gives the focus back to the cross of the song.
    focus.focusOn({ action: 'cancel-delete' });
    await app.dispatch({ action: 'cancel-delete' });
    assert.deepEqual(focus.active.dataset, { action: 'delete-song', id: second.id });
    // OK or the cross of renaming gives it to the pencil.
    focus.focusOn({ action: 'cancel-rename' });
    await app.dispatch({ action: 'cancel-rename', id: first.id });
    assert.deepEqual(focus.active.dataset, { action: 'rename-song', id: first.id });
    // Deleting gives it to the song that takes the place of the deleted one.
    focus.focusOn({ action: 'confirm-delete', id: second.id });
    await app.dispatch({ action: 'confirm-delete', id: second.id });
    assert.deepEqual(focus.active.dataset, { action: 'load-song', id: first.id });
    // Saving with Enter in the name field keeps the focus in the field.
    focus.focusOn({ id: 'song-name' });
    app.document.activeElement.id = 'song-name';
    submitSave(app);
    assert.deepEqual(focus.active.dataset, { id: 'song-name' });
  } finally {
    uninstall();
  }
});

test('a click that does not focus the control (e.g. a tap on the iPad) moves no focus after an action of the songs panel', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'Tap');
    submitSave(app);
    const [song] = parseSongs(app.storage.getItem(SONGS_KEY));
    const focus = trackFocus(app, () => [{ action: 'confirm-delete', id: song.id }]);
    await app.dispatch({ action: 'delete-song', id: song.id });
    assert.equal(focus.active, null);
  } finally {
    uninstall();
  }
});

/**
 * An account as account.js connects it, for the page to use: it records the calls of the page, and `callbacks` lets the test
 * report the person and the songs of the account, as Firebase would. Writes settle at once, unless `refuse` is set.
 */
function fakeAccount() {
  // `answer` is what deleting the account resolves to: null when it works, else a message.
  const fake = { calls: [], callbacks: null, refuse: false, answer: null };
  fake.connect = (callbacks) => {
    fake.callbacks = callbacks;
    return {
      signIn: async () => fake.calls.push(['signIn']),
      signOut: async () => fake.calls.push(['signOut']),
      deleteAccount: async () => {
        fake.calls.push(['deleteAccount']);
        return fake.answer;
      },
      write: async (changes) => {
        fake.calls.push(['write', changes]);
        if (fake.refuse) {
          throw new Error('permission-denied');
        }
      },
      writeSettings: (settings) => fake.calls.push(['writeSettings', settings]),
      flushSettings: async () => fake.calls.push(['flushSettings']),
    };
  };
  fake.writes = () => fake.calls.filter(([name]) => name === 'write').map(([, changes]) => changes);
  // The settings the page wrote to the account, each parsed, in order.
  fake.settings = () => fake.calls.filter(([name]) => name === 'writeSettings').map(([, settings]) => JSON.parse(settings));
  // The calls but those of the settings, which the page makes with nearly every render.
  fake.accountCalls = () => fake.calls.filter(([name]) => name !== 'writeSettings' && name !== 'flushSettings');
  return fake;
}

/** A song saved in another browser, as the record of an account holds it. */
function accountSong(id, name) {
  const state = defaultState(LIBRARY, () => 0.4);
  return saveSong(state, { id, name, date: new Date(2026, 10, 20, 8, 0), library: LIBRARY, bassPatterns: BASS_PATTERNS }).songs[0];
}

const ADA = { name: 'Ada', email: 'ada@example.org' };
const settleWrites = () => new Promise((resolve) => setTimeout(resolve, 0));

test('without an account neither the songs panel nor the account panel offers one', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    assert.ok(!app.elements['#option-list'].innerHTML.includes('class="account'));
    await app.dispatch({ action: 'toggle-account' });
    assert.ok(!app.elements['#option-list'].innerHTML.includes('data-action="sign-in"'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('data-action="reset-settings"'));
  } finally {
    uninstall();
  }
});

test('with an account, the account panel invites to sign in, and the button signs in; the songs panel does not', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-songs' });
    assert.ok(!app.elements['#option-list'].innerHTML.includes('data-action="sign-in"'));
    await app.dispatch({ action: 'toggle-account' });
    assert.equal(app.elements['#options'].attributes['aria-label'], 'Account');
    assert.equal(app.elements['.account-toggle'].attributes['aria-expanded'], 'true');
    assert.ok(app.elements['#option-list'].innerHTML.includes('data-action="sign-in"'));
    await app.dispatch({ action: 'sign-in' });
    assert.deepEqual(account.calls, [['signIn']]);
  } finally {
    uninstall();
  }
});

test('signing in shows the songs of the account, and the songs of the browser move into it', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'From this browser');
    submitSave(app);
    const [local] = parseSongs(app.storage.getItem(SONGS_KEY));
    account.callbacks.onPerson(ADA);
    const list = () => app.elements['#option-list'].innerHTML;
    assert.ok(list().includes('Loading the songs of your account'));
    assert.ok(!list().includes('From this browser'), 'the songs of the browser are not shown as the account\'s');
    // Saving waits for the songs of the account.
    submitSave(app);
    assert.deepEqual(account.writes(), []);
    const remote = accountSong('remote', 'From the account');
    account.callbacks.onSongs(songsRecord([remote]));
    assert.ok(list().includes('From the account'));
    assert.ok(list().includes('From this browser'));
    assert.deepEqual(account.writes(), [{ put: [local] }]);
    await settleWrites();
    // Once the account has them, they are no longer kept in the browser.
    assert.deepEqual(parseSongs(app.storage.getItem(SONGS_KEY)), []);
  } finally {
    uninstall();
  }
});

test('the songs of the browser move into the account only once the account has confirmed its songs', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'From this browser');
    submitSave(app);
    const [local] = parseSongs(app.storage.getItem(SONGS_KEY));
    account.callbacks.onPerson(ADA);
    const list = () => app.elements['#option-list'].innerHTML;
    // The copy in the browser may be behind (e.g. a new device without a network): its songs are shown, nothing is joined.
    account.callbacks.onSongs({}, { confirmed: false });
    assert.ok(!list().includes('Loading the songs of your account'));
    assert.ok(!list().includes('From this browser'));
    assert.deepEqual(account.writes(), []);
    const remote = accountSong('remote', 'From the account');
    account.callbacks.onSongs(songsRecord([remote]), { confirmed: true });
    assert.ok(list().includes('From the account'));
    assert.ok(list().includes('From this browser'));
    assert.deepEqual(account.writes(), [{ put: [local] }]);
    // Later records join nothing again.
    account.callbacks.onSongs(songsRecord([remote, local]), { confirmed: true });
    assert.equal(account.writes().length, 1);
  } finally {
    uninstall();
  }
});

test('the songs of the browser stay in it while the account has not taken them', async () => {
  try {
    const account = fakeAccount();
    account.refuse = true;
    const app = await loadApp({ connect: account.connect });
    nameField(app, 'Precious');
    submitSave(app);
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs({});
    await settleWrites();
    assert.deepEqual(parseSongs(app.storage.getItem(SONGS_KEY)).map((song) => song.name), ['Precious']);
    // Signed out, they are shown again.
    account.callbacks.onPerson(null);
    await app.dispatch({ action: 'toggle-songs' });
    assert.ok(app.elements['#option-list'].innerHTML.includes('Precious'));
  } finally {
    uninstall();
  }
});

test('signed in, saving, renaming and deleting a song write only that song to the account, not to the browser', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-songs' });
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs({});
    nameField(app, 'Online');
    submitSave(app);
    const [saved] = account.writes();
    assert.deepEqual(saved.remove, []);
    assert.deepEqual(saved.put.map((song) => song.name), ['Online']);
    assert.equal(app.storage.getItem(SONGS_KEY), null, 'nothing is written to the browser');
    const { id } = saved.put[0];
    await app.dispatch({ action: 'rename-song', id });
    app.elements['#option-list'].querySelector = (selector) => (selector === '#rename-name' ? { value: 'Renamed' } : new FakeElement());
    await app.dispatch({ action: 'confirm-rename', id });
    assert.deepEqual(account.writes()[1].put.map((song) => song.name), ['Renamed']);
    await app.dispatch({ action: 'confirm-delete', id });
    assert.deepEqual(account.writes()[2], { put: [], remove: [id] });
    // A change that is not about the songs writes nothing.
    await app.dispatch({ action: 'reroll' });
    assert.equal(account.writes().length, 3);
  } finally {
    uninstall();
  }
});

test('a frozen song stays frozen when its account signs in at start-up', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    nameField(app, 'Frozen');
    submitSave(app);
    const [song] = parseSongs(app.storage.getItem(SONGS_KEY));
    // The song as an older version of the page saved it: its snapshot differs from what its recipe gives now.
    const old = { ...song, song: { ...song.song, rows: song.song.rows.slice(1) } };
    app.storage.setItem(SONGS_KEY, JSON.stringify([old]));
    const again = await loadApp({ connect: account.connect, storage: app.storage, cookie: app.document.cookie });
    await again.dispatch({ action: 'load-song', id: song.id });
    await again.dispatch({ action: 'toggle-songs' });
    assert.ok(again.elements['#option-list'].innerHTML.includes('class="frozen-note"'));
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs(songsRecord([old]));
    assert.ok(again.elements['#option-list'].innerHTML.includes('class="frozen-note"'));
  } finally {
    uninstall();
  }
});

test('songs that come from another device are shown without being written back', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-songs' });
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs({});
    account.callbacks.onSongs(songsRecord([accountSong('other', 'From the iPad')]));
    assert.ok(app.elements['#option-list'].innerHTML.includes('From the iPad'));
    assert.deepEqual(account.writes(), []);
  } finally {
    uninstall();
  }
});

test('signing out and deleting the account go through the account; deleting asks first', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-account' });
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs({});
    await app.dispatch({ action: 'delete-account' });
    assert.ok(app.elements['#option-list'].innerHTML.includes('data-action="confirm-delete-account"'));
    assert.deepEqual(account.accountCalls(), [], 'the question alone deletes nothing');
    await app.dispatch({ action: 'cancel-delete-account' });
    assert.ok(!app.elements['#option-list'].innerHTML.includes('confirm-delete-account'));
    await app.dispatch({ action: 'delete-account' });
    await app.dispatch({ action: 'confirm-delete-account' });
    assert.deepEqual(account.accountCalls(), [['deleteAccount']]);
    await app.dispatch({ action: 'sign-out' });
    assert.deepEqual(account.accountCalls().at(-1), ['signOut']);
    account.callbacks.onPerson(null);
    assert.ok(app.elements['#option-list'].innerHTML.includes('data-action="sign-in"'));
  } finally {
    uninstall();
  }
});

test('a song saved in another tab does not replace the songs of the account', async () => {
  const storageListeners = [];
  globalThis.addEventListener = (type, listener) => {
    if (type === 'storage') {
      storageListeners.push(listener);
    }
  };
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-songs' });
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs(songsRecord([accountSong('remote', 'From the account')]));
    storageListeners.forEach((listener) => listener({ key: SONGS_KEY, newValue: '[]' }));
    assert.ok(app.elements['#option-list'].innerHTML.includes('From the account'));
  } finally {
    delete globalThis.addEventListener;
    uninstall();
  }
});

test('signed in, the account panel names the person', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-account' });
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs({});
    assert.ok(app.elements['#option-list'].innerHTML.includes('Signed in as <strong>Ada</strong>'));
  } finally {
    uninstall();
  }
});

/** The state the page keeps in its cookie, parsed. */
const cookieState = (app) => JSON.parse(decodeURIComponent(app.document.cookie.split(';')[0].slice('chordice_state='.length)));

test('Reset Settings asks first, and Reset sets every setting back to its default but keeps the saved songs', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-songs' });
    nameField(app, 'Kept');
    submitSave(app);
    await app.dispatch({ action: 'toggle-theme' });
    await app.dispatch({ action: 'set-key', key: 'D' });
    await app.dispatch({ action: 'toggle-painting' });
    await app.dispatch({ action: 'set-instrument', instrument: 'guitar' });
    await app.dispatch({ action: 'toggle-section', section: 'bass' });
    const seeds = cookieState(app).seeds;
    await app.dispatch({ action: 'toggle-account' });
    const list = () => app.elements['#option-list'].innerHTML;
    await app.dispatch({ action: 'reset-settings' });
    assert.ok(list().includes('data-action="confirm-reset-settings"'));
    assert.equal(cookieState(app).theme, 'dark', 'the question alone resets nothing');
    // The cross, or any other action, keeps the settings.
    await app.dispatch({ action: 'cancel-reset-settings' });
    assert.ok(!list().includes('confirm-reset-settings'));
    await app.dispatch({ action: 'reset-settings' });
    await app.dispatch({ action: 'toggle-roman' });
    assert.ok(!list().includes('confirm-reset-settings'));
    await app.dispatch({ action: 'toggle-roman' });
    await app.dispatch({ action: 'reset-settings' });
    await app.dispatch({ action: 'confirm-reset-settings' });
    const reset = cookieState(app);
    const fresh = defaultState(LIBRARY);
    for (const name of ['key', 'theme', 'painting', 'instrument', 'collapsed', 'selection', 'variations', 'exercise', 'roman']) {
      assert.deepEqual(reset[name], fresh[name], `${name} is back to its default`);
    }
    assert.notDeepEqual(reset.seeds, seeds, 'a new song');
    assert.equal(app.document.documentElement.dataset.theme, 'light');
    assert.equal(app.instrumentTabs[0].attributes['aria-pressed'], 'true');
    // The side panel stays on the account panel, and the saved song stays.
    assert.equal(reset.panel, 'account');
    assert.equal(app.elements['#options'].hidden, false);
    assert.ok(!list().includes('confirm-reset-settings'));
    assert.deepEqual(parseSongs(app.storage.getItem(SONGS_KEY)).map((song) => song.name), ['Kept']);
    await app.dispatch({ action: 'toggle-songs' });
    assert.ok(list().includes('Kept'));
  } finally {
    uninstall();
  }
});

test('signed in, the settings of an account without any are taken from the browser once the account has confirmed it', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-theme' });
    account.callbacks.onPerson(ADA);
    // The copy in the browser may be behind: it says nothing of the settings of the account.
    account.callbacks.onSongs({}, { confirmed: false, settings: null });
    await app.dispatch({ action: 'set-key', key: 'E' });
    assert.deepEqual(account.settings(), []);
    account.callbacks.onSongs({}, { confirmed: true, settings: null });
    const [written] = account.settings();
    assert.equal(written.theme, 'dark');
    assert.equal(written.key, 'E');
    // The songs and the side panel are not part of them.
    assert.ok(!Object.hasOwn(written, 'songs') && !Object.hasOwn(written, 'showOptions') && !Object.hasOwn(written, 'panel'));
  } finally {
    uninstall();
  }
});

test('signed in, every change of the settings is written to the account, and only a change', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs({}, { confirmed: true, settings: null });
    assert.equal(account.settings().length, 1);
    await app.dispatch({ action: 'toggle-colour' });
    assert.equal(account.settings().length, 2);
    assert.equal(account.settings()[1].colour, false);
    // New Song too: the song that is shown is synced across the devices.
    await app.dispatch({ action: 'reroll' });
    assert.equal(account.settings().length, 3);
    // Opening and closing the side panel belongs to the device.
    await app.dispatch({ action: 'toggle-help' });
    await app.dispatch({ action: 'toggle-panel' });
    assert.equal(account.settings().length, 3);
    // Settings that come back as they were written are not taken again, nor written back.
    account.callbacks.onSongs({}, { confirmed: true, settings: account.calls.filter(([name]) => name === 'writeSettings').at(-1)[1] });
    assert.equal(account.settings().length, 3);
    // Signed out, the settings stay in the browser and are no longer written to the account.
    account.callbacks.onPerson(null);
    await app.dispatch({ action: 'toggle-colour' });
    assert.equal(account.settings().length, 3);
    assert.equal(cookieState(app).colour, true);
  } finally {
    uninstall();
  }
});

test('signing in takes the settings of the account, and a change on another device is taken too', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-account' });
    const there = { ...defaultState(LIBRARY, () => 0.9), key: 'A', theme: 'dark', roman: false, showOptions: false, panel: 'help' };
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs({}, { confirmed: false, settings: serializeSettings(there) });
    const taken = cookieState(app);
    assert.equal(taken.key, 'A');
    assert.equal(taken.theme, 'dark');
    assert.deepEqual(taken.seeds, there.seeds);
    assert.equal(app.document.documentElement.dataset.theme, 'dark');
    // The side panel of this device stays.
    assert.equal(taken.panel, 'account');
    assert.equal(app.elements['#options'].hidden, false);
    assert.deepEqual(account.settings(), [], 'what came from the account is not written back');
    account.callbacks.onSongs({}, { confirmed: true, settings: serializeSettings({ ...there, key: 'B' }) });
    assert.equal(cookieState(app).key, 'B');
    assert.deepEqual(account.settings(), []);
  } finally {
    uninstall();
  }
});

test('settings of the account with the guitar wait for its shapes, with the piano meanwhile', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    account.callbacks.onPerson(ADA);
    const there = { ...defaultState(LIBRARY, () => 0.9), instrument: 'guitar' };
    account.callbacks.onSongs({}, { confirmed: true, settings: serializeSettings(there) });
    assert.equal(cookieState(app).instrument, 'piano');
    await until(() => cookieState(app).instrument === 'guitar');
    assert.equal(cookieState(app).instrument, 'guitar');
    assert.ok(app.fetched.some((url) => url.endsWith('guitar.json')));
    assert.equal(app.instrumentTabs[1].attributes['aria-pressed'], 'true');
  } finally {
    uninstall();
  }
});

test('a choice of the instrument while the guitar shapes load keeps the piano that the settings of the account wait with', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    account.callbacks.onPerson(ADA);
    const guitarThere = serializeSettings({ ...defaultState(LIBRARY, () => 0.9), instrument: 'guitar' });
    // A click on the piano tab.
    account.callbacks.onSongs({}, { confirmed: true, settings: guitarThere });
    await app.dispatch({ action: 'set-instrument', instrument: 'piano' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(cookieState(app).instrument, 'piano');
  } finally {
    uninstall();
  }
});

test('settings of another device with the piano, while the guitar shapes load, keep the piano', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    account.callbacks.onPerson(ADA);
    const there = defaultState(LIBRARY, () => 0.9);
    account.callbacks.onSongs({}, { confirmed: true, settings: serializeSettings({ ...there, instrument: 'guitar' }) });
    account.callbacks.onSongs({}, { confirmed: true, settings: serializeSettings({ ...there, instrument: 'piano', key: 'D' }) });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(cookieState(app).instrument, 'piano');
    assert.equal(cookieState(app).key, 'D');
  } finally {
    uninstall();
  }
});

test('the same settings of the account are taken once, though the page made other settings of them', async () => {
  try {
    const account = fakeAccount();
    // Without the guitar shapes the page keeps the piano, so what it made of the settings differs from what was sent.
    const app = await loadApp({ connect: account.connect, guitarOk: false });
    account.callbacks.onPerson(ADA);
    const guitarThere = serializeSettings({ ...defaultState(LIBRARY, () => 0.9), instrument: 'guitar' });
    const guitarFetches = () => app.fetched.filter((url) => url.endsWith('/guitar.json')).length;
    const before = guitarFetches();
    account.callbacks.onSongs({}, { confirmed: false, settings: guitarThere });
    await new Promise((resolve) => setTimeout(resolve, 20));
    account.callbacks.onSongs({}, { confirmed: true, settings: guitarThere });
    account.callbacks.onSongs({ a: { id: 'a' } }, { confirmed: true, settings: guitarThere });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(guitarFetches(), before + 1);
    assert.equal(cookieState(app).instrument, 'piano');
    // After a change on this device, the same settings from another device are taken again.
    await app.dispatch({ action: 'toggle-theme' });
    const theme = cookieState(app).theme;
    account.callbacks.onSongs({}, { confirmed: true, settings: guitarThere });
    assert.notEqual(cookieState(app).theme, theme);
  } finally {
    uninstall();
  }
});

test('hiding the page writes the settings that wait to be written to the account at once', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    app.document.visibilityState = 'visible';
    app.listeners.visibilitychange.forEach((listener) => listener());
    assert.deepEqual(account.calls, []);
    app.document.visibilityState = 'hidden';
    app.listeners.visibilitychange.forEach((listener) => listener());
    assert.deepEqual(account.calls, [['flushSettings']]);
  } finally {
    uninstall();
  }
});

test('what goes wrong with the account is shown above the chords', async () => {
  try {
    const account = fakeAccount();
    const app = await loadApp({ connect: account.connect });
    account.callbacks.onError('There is no connection to the account right now.');
    assert.equal(app.elements['#status'].textContent, 'There is no connection to the account right now.');
    assert.equal(app.elements['#status'].hidden, false);
  } finally {
    uninstall();
  }
});

test('the links to the imprint and the privacy policy show them in the side panel, and the Help button goes back', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-help' });
    await settle();
    app.dispatch({ action: 'show-help-page', page: 'privacy' });
    await settle();
    const list = () => app.elements['#option-list'].innerHTML;
    assert.ok(list().includes('<h2>Controller</h2>'));
    assert.ok(list().includes('data-page="help">← Help</a>'));
    assert.equal(app.elements['#options'].attributes['aria-label'], 'Privacy policy');
    assert.equal(app.elements['#options'].hidden, false);
    app.dispatch({ action: 'show-help-page', page: 'imprint' });
    await settle();
    assert.ok(list().includes('§ 5 DDG'));
    assert.equal(app.elements['#options'].attributes['aria-label'], 'Imprint');
    // The Help button shows the help again, rather than closing the panel; pressed again, it closes it.
    app.dispatch({ action: 'toggle-help' });
    assert.ok(list().includes('<h2>Help</h2>'));
    assert.equal(app.elements['#options'].hidden, false);
    app.dispatch({ action: 'toggle-help' });
    assert.equal(app.elements['#options'].hidden, true);
    // An unknown page changes nothing.
    app.dispatch({ action: 'show-help-page', page: 'nowhere' });
    assert.equal(app.elements['#options'].hidden, true);
  } finally {
    uninstall();
  }
});

test('the privacy policy opens from the account panel in the side panel, and the help opens at the help again', async () => {
  try {
    const app = await loadApp();
    await app.dispatch({ action: 'toggle-account' });
    app.dispatch({ action: 'show-help-page', page: 'privacy' });
    await settle();
    assert.equal(app.elements['.help-toggle'].attributes['aria-expanded'], 'true');
    assert.equal(app.elements['#options'].attributes['aria-label'], 'Privacy policy');
    assert.ok(app.elements['#option-list'].innerHTML.includes('<h2>Storage in your browser</h2>'));
    await app.dispatch({ action: 'toggle-options' });
    app.dispatch({ action: 'toggle-help' });
    await settle();
    assert.ok(app.elements['#option-list'].innerHTML.includes('<h2>Help</h2>'));
  } finally {
    uninstall();
  }
});

test('a click on a link with an action does the action in the page rather than following the link', async () => {
  try {
    const app = await loadApp();
    let prevented = false;
    const link = { tagName: 'A', dataset: { action: 'show-help-page', page: 'privacy' } };
    for (const listener of app.listeners.click) {
      listener({ target: { closest: () => link }, preventDefault: () => { prevented = true; } });
    }
    assert.equal(prevented, true);
    assert.equal(app.elements['#options'].attributes['aria-label'], 'Privacy policy');
    // The privacy policy has loaded before the page is taken down.
    await settle();
  } finally {
    uninstall();
  }
});

test('when the account cannot be deleted, the account section says why', async () => {
  try {
    const account = fakeAccount();
    account.answer = 'There is no connection to the account right now.';
    const app = await loadApp({ connect: account.connect });
    await app.dispatch({ action: 'toggle-account' });
    account.callbacks.onPerson(ADA);
    account.callbacks.onSongs({});
    await app.dispatch({ action: 'delete-account' });
    await app.dispatch({ action: 'confirm-delete-account' });
    await settle();
    assert.ok(app.elements['#option-list'].innerHTML.includes(
      '<p class="account-notice" role="status">There is no connection to the account right now.</p>'));
    // Signing out ends the message.
    account.callbacks.onPerson(null);
    assert.ok(!app.elements['#option-list'].innerHTML.includes('account-notice'));
  } finally {
    uninstall();
  }
});

test('the page shows the quick hints of its buttons', async () => {
  try {
    const app = await loadApp();
    assert.equal(app.listeners.pointermove?.length, 1);
  } finally {
    uninstall();
  }
});
