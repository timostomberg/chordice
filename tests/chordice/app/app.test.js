import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startApp } from '../../../chordice/app/app.js';
import { BASS_TEXT, LIBRARY, PROGRESSIONS_TEXT as YAML_TEXT } from '../../helpers/fixtures.js';
import { defaultState } from '../../../chordice/app/state/state.js';
import { serializeCookie } from '../../../chordice/app/state/persistence.js';

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

// Stands in for HTMLInputElement, which app.js checks with instanceof.
class FakeInput {
  constructor(type, option, value) {
    this.type = type;
    this.value = value;
    this.dataset = { option };
  }
}

/** Installs the globals app.js uses, loads it and waits until its start-up promise has settled. */
async function loadApp({ cookie = '', yaml = YAML_TEXT, bass = BASS_TEXT, ok = true, guitarOk = true, helpOk = true, pathname = '/chordice/index.html' } = {}) {
  const elements = {
    '#side-panel': new FakeElement(),
    '#options': new FakeElement(),
    '#option-list': new FakeElement(),
    '#song-rows': new FakeElement(),
    '#landscape': new FakeElement(),
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
  return { document, elements, fetched, dispatch, click, change, instrumentTabs, written };
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
    assert.deepEqual(app.fetched.length, 2);
    assert.ok(app.fetched[0].endsWith('/chordice/music/data/chord_progressions.yaml'));
    assert.ok(app.fetched[1].endsWith('/chordice/music/data/bass_patterns.yaml'));
    // The piano needs no guitar shapes, so they are not fetched at start-up.
    assert.ok(!app.fetched.some((url) => url.endsWith('guitar.json')));
    assert.ok(app.elements['#option-list'].innerHTML.includes('<svg class="circle"'));
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

test('app.js paints the picture behind the app, anew with Generate and in the colours of the theme', async () => {
  try {
    const app = await loadApp();
    const landscape = app.elements['#landscape'];
    const first = landscape.innerHTML;
    assert.ok(first.includes('class="landscape-scene"'), 'a painting is shown from the start');
    app.dispatch({ action: 'cycle-count' });
    assert.equal(landscape.innerHTML, first, 'another option leaves the painting as it is');
    app.dispatch({ action: 'toggle-theme' });
    const dark = landscape.innerHTML;
    assert.notEqual(dark, first, 'the theme repaints it in its colours');
    assert.equal(/data-kind="(\w+)"/.exec(dark)[1], /data-kind="(\w+)"/.exec(first)[1], 'the motif stays');
    app.dispatch({ action: 'reroll' });
    assert.notEqual(landscape.innerHTML, dark, 'Generate paints a new picture');
    app.dispatch({ action: 'toggle-painting' });
    assert.ok(landscape.innerHTML.includes('data-plain'), 'the painting switch off shows a plain background');
    assert.ok(decodeURIComponent(app.document.cookie).includes('"painting":false'));
    app.dispatch({ action: 'toggle-painting' });
    assert.ok(!landscape.innerHTML.includes('data-plain'), 'and on again the painting');
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
    assert.ok(!app.elements['#option-list'].innerHTML.includes('<span class="section-title">Keys</span>'));
    assert.equal(app.elements['.exercises-toggle'].attributes['aria-expanded'], 'true');
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'false');
    assert.ok(decodeURIComponent(app.document.cookie).includes('"panel":"exercises"'));
    // The options button shows the options again in its place.
    app.dispatch({ action: 'toggle-options' });
    assert.equal(app.elements['#options'].attributes['aria-label'], 'Options');
    assert.ok(app.elements['#option-list'].innerHTML.includes('<span class="section-title">Keys</span>'));
    assert.ok(!app.elements['#option-list'].innerHTML.includes('data-action="toggle-exercise"'));
    assert.equal(app.elements['.exercises-toggle'].attributes['aria-expanded'], 'false');
    assert.equal(app.elements['.options-toggle'].attributes['aria-expanded'], 'true');
  } finally {
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

test('the help is not re-rendered while it is shown, e.g. by Generate, so the reader keeps their place', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-help' });
    await settle();
    app.elements['#option-list'].innerHTML = 'kept';
    app.dispatch({ action: 'reroll' });
    assert.equal(app.elements['#option-list'].innerHTML, 'kept');
    // A click on the song does not open Keys or scroll the side panel while the help is shown.
    app.elements['#side-panel'].scrollTop = 40;
    app.click({ closest: () => null, insideContent: true });
    assert.equal(app.elements['#side-panel'].scrollTop, 40);
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
    // Generate does not retry the load.
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

test('a click on the song outside the chords opens Keys and closes the other sections', async () => {
  try {
    const app = await loadApp();
    app.dispatch({ action: 'toggle-section', section: 'bass' });
    app.click({ closest: () => null, insideContent: true });
    const cookie = decodeURIComponent(app.document.cookie);
    assert.ok(cookie.includes('"collapsed":["progressions","progressionVariations","variations","bass","melody"]'));
  } finally {
    uninstall();
  }
});

test('a click on the song scrolls the options back to the top', async () => {
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
