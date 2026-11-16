import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { buildLibrary } from '../../chordice/js/generator.js';
import { defaultState, serializeCookie } from '../../chordice/js/state.js';

// app.js runs as a browser entry point on import, so it is loaded here against a minimal fake DOM.
const APP = new URL('../../chordice/js/app.js', import.meta.url);
const YAML_TEXT = readFileSync(new URL('../../chordice/data/chord_progressions.yaml', import.meta.url), 'utf8');
const LIBRARY = buildLibrary(load(YAML_TEXT));

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

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor() {
    this.innerHTML = '';
    this.textContent = '';
    this.hidden = false;
    this.attributes = {};
    this.classList = new FakeClassList();
  }

  addEventListener() {}

  querySelector() {
    return new FakeElement();
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

// The notes window; app.js only wires it up, the dialog's own behaviour is tested in notes-dialog.test.js.
class FakeDialog extends FakeElement {
  showModal() {}

  close() {}
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
async function startApp({ cookie = '', yaml = YAML_TEXT, ok = true } = {}) {
  const elements = {
    '#side-panel': new FakeElement(),
    '#options': new FakeElement(),
    '#option-list': new FakeElement(),
    '#rows': new FakeElement(),
    '.options-toggle': new FakeElement(),
    '.content': new FakeElement(),
    '[data-action="toggle-theme"]': new FakeElement(),
    '[data-action="toggle-colour"]': new FakeElement(),
    '[data-action="toggle-details"]': new FakeElement(),
    '[data-action="toggle-inversions"]': new FakeElement(),
    '#notes': new FakeDialog(),
  };
  const listeners = {};
  const fetched = [];
  const document = {
    cookie,
    body: { classList: new FakeClassList() },
    documentElement: { dataset: {} },
    querySelector(selector) {
      if (!(selector in elements)) {
        throw new Error(`unexpected selector ${selector}`);
      }
      return elements[selector];
    },
    addEventListener(type, listener) {
      (listeners[type] ??= []).push(listener);
    },
  };

  globalThis.document = document;
  globalThis.HTMLInputElement = FakeInput;
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return { ok, status: ok ? 200 : 404, text: async () => yaml };
  };

  // A fresh query string makes Node evaluate the module again for every test.
  await import(`${APP.href}?run=${Math.random()}`);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const dispatch = (dataset) => {
    for (const listener of listeners.click ?? []) {
      listener({ target: { closest: () => ({ dataset }) } });
    }
  };
  const change = (target) => {
    for (const listener of listeners.change ?? []) {
      listener({ target });
    }
  };
  return { document, elements, fetched, dispatch, change };
}

function uninstall() {
  delete globalThis.document;
  delete globalThis.HTMLInputElement;
  delete globalThis.fetch;
}

function rowCount(html) {
  return html.split('<section class="row">').length - 1;
}

test('app.js loads the YAML library and renders the circle, option sections, rows and toggle state', async () => {
  try {
    const app = await startApp();
    assert.deepEqual(app.fetched.length, 1);
    assert.ok(app.fetched[0].endsWith('/chordice/data/chord_progressions.yaml'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('<svg class="circle"'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('<span class="section-title">Progressions</span>'));
    assert.equal(app.elements['#options'].hidden, false);
    assert.equal(rowCount(app.elements['#rows'].innerHTML), 4);
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'true');
    assert.ok(app.document.cookie.startsWith('chordice_state='));
  } finally {
    uninstall();
  }
});

test('app.js applies the theme to the page and marks the theme button', async () => {
  try {
    const app = await startApp();
    assert.equal(app.document.documentElement.dataset.theme, 'dark');
    assert.equal(app.elements['[data-action="toggle-theme"]'].attributes['aria-pressed'], 'true');
    app.dispatch({ action: 'toggle-theme' });
    assert.equal(app.document.documentElement.dataset.theme, 'light');
    assert.equal(app.elements['[data-action="toggle-theme"]'].attributes['aria-pressed'], 'false');
    assert.ok(decodeURIComponent(app.document.cookie).includes('"theme":"light"'));
  } finally {
    uninstall();
  }
});

test('app.js restores the state stored in the cookie', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), count: 8, colour: true, details: true });
    const app = await startApp({ cookie });
    assert.equal(rowCount(app.elements['#rows'].innerHTML), 8);
    assert.ok(app.elements['#rows'].innerHTML.includes('<span class="roman">'));
  } finally {
    uninstall();
  }
});

test('app.js re-renders and stores the state when a click dispatches an action', async () => {
  try {
    const app = await startApp();
    app.dispatch({ action: 'set-count', count: '2' });
    assert.equal(rowCount(app.elements['#rows'].innerHTML), 2);
    assert.ok(app.document.cookie.includes('chordice_state='));
    assert.ok(decodeURIComponent(app.document.cookie).includes('"count":2'));
  } finally {
    uninstall();
  }
});

test('app.js hides the whole left panel, with the options and the circle, and marks the toggle as collapsed', async () => {
  try {
    const app = await startApp();
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

test('app.js keeps the scroll position of the progression list when a progression is toggled', async () => {
  try {
    const app = await startApp();
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
    const app = await startApp();
    app.dispatch({ action: 'toggle-section', section: 'probabilities' });
    app.change(new FakeInput('range', 'rotation', '30'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('Rotation <output>30%</output>'));
  } finally {
    uninstall();
  }
});

test('app.js shows the top melody notes while inversions are on, and hides them when they are off', async () => {
  try {
    const app = await startApp();
    assert.ok(!app.elements['#rows'].innerHTML.includes('Top melody note'));
    assert.equal(app.elements['[data-action="toggle-inversions"]'].attributes['aria-pressed'], 'false');
    app.dispatch({ action: 'toggle-inversions' });
    assert.ok(app.elements['#rows'].innerHTML.includes('class="melody" title="Top melody note"'));
    assert.equal(app.elements['[data-action="toggle-inversions"]'].attributes['aria-pressed'], 'true');
    app.dispatch({ action: 'toggle-inversions' });
    assert.ok(!app.elements['#rows'].innerHTML.includes('Top melody note'));
  } finally {
    uninstall();
  }
});

test('app.js ignores change events from elements that are not probability sliders', async () => {
  try {
    const app = await startApp();
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
    const app = await startApp({ ok: false });
    assert.equal(app.elements['#rows'].textContent, `Chordice could not start: Could not load ${app.fetched[0]}: 404`);
  } finally {
    uninstall();
  }
});
