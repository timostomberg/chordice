import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { startApp } from '../../../chordice/js/core/app.js';
import { buildLibrary } from '../../../chordice/js/data/validate.js';
import { defaultState, serializeCookie } from '../../../chordice/js/core/state.js';

// app.js has no side effects on import; startApp runs against the minimal fake DOM installed by loadApp below.
const YAML_TEXT = readFileSync(new URL('../../../chordice/data/chord_progressions.yaml', import.meta.url), 'utf8');
const BASS_TEXT = readFileSync(new URL('../../../chordice/data/bass_patterns.yaml', import.meta.url), 'utf8');
// The guitar shapes as the CDN serves them; app.js fetches them from the URL of the installed version.
const GUITAR_TEXT = readFileSync(new URL('../../../node_modules/@tombatossals/chords-db/lib/guitar.json', import.meta.url), 'utf8');
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
  constructor(dataset = {}) {
    this.innerHTML = '';
    this.textContent = '';
    this.hidden = false;
    this.attributes = {};
    this.dataset = dataset;
    this.classList = new FakeClassList();
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

// Stands in for HTMLInputElement, which app.js checks with instanceof.
class FakeInput {
  constructor(type, option, value) {
    this.type = type;
    this.value = value;
    this.dataset = { option };
  }
}

/** Installs the globals app.js uses, loads it and waits until its start-up promise has settled. */
async function loadApp({ cookie = '', yaml = YAML_TEXT, bass = BASS_TEXT, ok = true } = {}) {
  const elements = {
    '#side-panel': new FakeElement(),
    '#options': new FakeElement(),
    '#option-list': new FakeElement(),
    '#rows': new FakeElement(),
    '.options-toggle': new FakeElement(),
    '.count-toggle': new FakeElement(),
    '.content': new FakeElement(),
    '[data-action="toggle-theme"]': new FakeElement(),
    '[data-action="toggle-colour"]': new FakeElement({ flag: 'colour' }),
    '[data-action="toggle-roman"]': new FakeElement({ flag: 'roman' }),
    '[data-action="toggle-tones"]': new FakeElement({ flag: 'tones' }),
    '[data-action="toggle-inversions"]': new FakeElement({ flag: 'inversions' }),
    '#notes': new FakeDialog(),
  };
  const listeners = {};
  const fetched = [];
  // The piano and guitar tabs of the header, as the page has them.
  const instrumentTabs = [new FakeElement({ instrument: 'piano' }), new FakeElement({ instrument: 'guitar' })];
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
    // Only the view switches carry a data-flag; they are the elements with a flag in the fake page.
    querySelectorAll(selector) {
      if (selector === '[data-instrument]') {
        return instrumentTabs;
      }
      if (selector !== '[data-flag]') {
        throw new Error(`unexpected selector ${selector}`);
      }
      return Object.values(elements).filter((element) => element.dataset.flag !== undefined);
    },
    addEventListener(type, listener) {
      (listeners[type] ??= []).push(listener);
    },
  };

  globalThis.document = document;
  globalThis.HTMLInputElement = FakeInput;
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    const text = String(url).endsWith('/bass_patterns.yaml')
      ? bass
      : String(url).endsWith('/guitar.json') ? GUITAR_TEXT : yaml;
    return { ok, status: ok ? 200 : 404, text: async () => text };
  };

  await startApp();

  const dispatch = (dataset) => {
    for (const listener of listeners.click ?? []) {
      listener({ target: { closest: () => ({ dataset }) } });
    }
  };
  // A raw click, e.g. on the chords area; the target is not inside any element with a data-action.
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
  return { document, elements, fetched, dispatch, click, change, instrumentTabs };
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
    const app = await loadApp();
    assert.deepEqual(app.fetched.length, 3);
    assert.ok(app.fetched[0].endsWith('/chordice/data/chord_progressions.yaml'));
    assert.ok(app.fetched[1].endsWith('/chordice/data/bass_patterns.yaml'));
    assert.ok(app.fetched[2].endsWith('/@tombatossals/chords-db@0.5.1/lib/guitar.json'));
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
    const app = await loadApp();
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
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), count: 8, colour: true, roman: true, tones: true });
    const app = await loadApp({ cookie });
    assert.equal(rowCount(app.elements['#rows'].innerHTML), 8);
    assert.ok(app.elements['#rows'].innerHTML.includes('<span class="roman">'));
  } finally {
    uninstall();
  }
});

test('app.js re-renders and stores the state when a click dispatches an action', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'cycle-count' });
    assert.equal(rowCount(app.elements['#rows'].innerHTML), 8);
    assert.equal(app.elements['.count-toggle'].textContent, '8');
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

test('a click on the chords area outside the chords opens Keys and closes the other sections', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-section', section: 'bass' });
    app.click({ closest: () => null, insideContent: true });
    const cookie = decodeURIComponent(app.document.cookie);
    assert.ok(cookie.includes('"collapsed":["progressions","progressionVariations","variations","bass"]'));
  } finally {
    uninstall();
  }
});

test('a click on the chords area scrolls the options back to the top', async () => {
  try {
    const app = await loadApp();
    app.elements['#side-panel'].scrollTop = 300;
    app.click({ closest: () => null, insideContent: true });
    assert.equal(app.elements['#side-panel'].scrollTop, 0);
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
    assert.equal(app.elements['#rows'].textContent, `Chordice could not start: Could not load ${app.fetched[0]}: 404`);
  } finally {
    uninstall();
  }
});

test('app.js marks the tab of the piano by default, and a click on the guitar tab marks the guitar and stores it', async () => {
  try {
    const app = await loadApp();
    const [piano, guitar] = app.instrumentTabs;
    assert.equal(piano.attributes['aria-pressed'], 'true');
    assert.equal(guitar.attributes['aria-pressed'], 'false');
    app.dispatch({ action: 'set-instrument', instrument: 'guitar' });
    assert.equal(piano.attributes['aria-pressed'], 'false');
    assert.equal(guitar.attributes['aria-pressed'], 'true');
    assert.ok(decodeURIComponent(app.document.cookie).includes('"instrument":"guitar"'));
  } finally {
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

test('on the guitar the inversions switch is greyed out, the melody notes are gone, and the stored switch comes back on the piano', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar', inversions: true });
    const app = await loadApp({ cookie });
    const inversions = app.elements['[data-action="toggle-inversions"]'];
    assert.equal(inversions.disabled, true);
    assert.equal(inversions.attributes['aria-pressed'], 'true');
    assert.ok(!app.elements['#rows'].innerHTML.includes('Top melody note'));
    app.dispatch({ action: 'toggle-inversions' });
    assert.equal(inversions.attributes['aria-pressed'], 'true');
    app.dispatch({ action: 'set-instrument', instrument: 'piano' });
    assert.equal(inversions.disabled, false);
    assert.ok(app.elements['#rows'].innerHTML.includes('Top melody note'));
  } finally {
    uninstall();
  }
});

test('on the guitar the rows have no bass variations, and the bass returns with the piano at the amount set before', async () => {
  try {
    const cookie = serializeCookie({ ...defaultState(LIBRARY, () => 0.5), instrument: 'guitar', bassProbability: 5 });
    const app = await loadApp({ cookie });
    assert.ok(!app.elements['#rows'].innerHTML.includes('class="bass"'));
    assert.ok(app.elements['#option-list'].innerHTML.includes('is-unavailable'));
    app.dispatch({ action: 'set-instrument', instrument: 'piano' });
    assert.ok(app.elements['#rows'].innerHTML.includes('class="bass"'));
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
