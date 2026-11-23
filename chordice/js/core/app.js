/**
 * The page: loads the progression data, wires the UI and persists the state in a cookie. main.js starts it.
 */

import { load } from 'js-yaml';
import { generate } from '../generator/generator.js';
import { buildBassPatterns, buildLibrary } from '../data/validate.js';
import { applyAction } from './actions.js';
import { effectiveState, onlyKeysOpen, parseCookie, sanitizeState, serializeCookie, setInstrument } from './state.js';
import { updateHeader } from '../header/header.js';
import { renderOptions } from '../options/options.js';
import { renderRows } from '../progressions/progressions.js';
import { bindZoom, blockZoom } from '../progressions/zoom.js';
import { createNotesDialog } from '../notes/notes.js';
import { fingeringOf } from '../notes/guitar/fingering.js';

const PROGRESSIONS_URL = new URL('../../data/chord_progressions.yaml', import.meta.url);
const BASS_URL = new URL('../../data/bass_patterns.yaml', import.meta.url);
// The guitar shapes are read from the chord database on the CDN, at the version pinned in package.json.
// They are only needed for the guitar, so they are loaded when the guitar is first chosen, not at start-up.
const GUITAR_URL = 'https://cdn.jsdelivr.net/npm/@tombatossals/chords-db@0.5.1/lib/guitar.json';

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }
  return response.text();
}

async function loadData() {
  const [progressions, bass] = await Promise.all([
    fetchText(PROGRESSIONS_URL).then(load),
    fetchText(BASS_URL).then(load),
  ]);
  return { library: buildLibrary(progressions), bassPatterns: buildBassPatterns(bass) };
}

/**
 * Returns a function that loads the guitar shapes once and shares the result. A failed load is not kept, so the next
 * call tries again.
 */
function guitarLoader() {
  let pending = null;
  return () => {
    pending ??= fetchText(GUITAR_URL)
      .then((text) => JSON.parse(text))
      .catch((error) => {
        pending = null;
        throw error;
      });
    return pending;
  };
}

/** The message shown when the guitar shapes cannot be loaded; the piano stays chosen. */
const GUITAR_FAILED = 'The guitar shapes could not be loaded, so the piano stays chosen.';

function start({ library, bassPatterns, initial, guitar: loaded, loadGuitar, guitarError = false }) {
  let state = initial;
  let guitar = loaded;

  const status = document.querySelector('#status');
  /** Shows a message above the chords, or hides the message line when there is none. */
  function showStatus(message) {
    status.textContent = message ?? '';
    status.hidden = !message;
  }

  const sidePanel = document.querySelector('#side-panel');
  const options = document.querySelector('#options');
  const optionList = document.querySelector('#option-list');
  const rows = document.querySelector('#rows');
  const notes = createNotesDialog(document.querySelector('#notes'));
  let currentRows = [];

  // Only the chords zoom, with Ctrl + scroll or a pinch. The options never zoom; Ctrl + scroll there does nothing.
  const content = document.querySelector('.content');
  bindZoom(content, rows);
  blockZoom(sidePanel);

  /** The display switches of the rows, which the notes window's chord box follows too. */
  function displayOf(current) {
    const effective = effectiveState(current);
    return { colour: effective.colour, roman: effective.roman, tones: effective.tones, melody: effective.inversions };
  }

  function render() {
    // Re-rendering replaces the markup, which would otherwise scroll the progression list and the chords back to the top.
    const listScroll = optionList.querySelector('.progression-list')?.scrollTop ?? 0;
    const contentScroll = content.scrollTop;
    sidePanel.hidden = !state.showOptions;
    options.hidden = !state.showOptions;
    optionList.innerHTML = renderOptions(state, library);
    const list = optionList.querySelector('.progression-list');
    if (list) {
      list.scrollTop = listScroll;
    }
    const effective = effectiveState(state);
    currentRows = generate({ ...effective, library, bassPatterns });
    rows.innerHTML = renderRows(currentRows, displayOf(state), { showKey: effective.circleOfFifths });
    content.scrollTop = contentScroll;
    document.documentElement.dataset.theme = state.theme;
    // The count button shows the number of progressions it cycles through: 1, 2, 4, 8, or 12 with the circle of fifths.
    document.querySelector('.count-toggle').textContent = String(effective.count);
    updateHeader(state);
    document.cookie = serializeCookie(state);
  }

  function dispatch(action, params) {
    state = applyAction(state, action, params, library);
    render();
  }

  function openNotes(target) {
    const row = currentRows[Number(target.dataset.row)];
    const chord = row.chords[Number(target.dataset.chord)];
    const instrument = state.instrument;
    const fingering = instrument === 'guitar' ? fingeringOf(chord, guitar) : null;
    notes.open(chord, target, row.tonic, displayOf(state), { instrument, fingering });
  }

  /** Chooses the guitar only once its shapes are loaded; if they cannot be loaded, the piano stays chosen. */
  function chooseGuitar(dataset) {
    if (guitar) {
      dispatch(dataset.action, dataset);
      return;
    }
    return loadGuitar()
      .then((shapes) => {
        guitar = shapes;
        showStatus(null);
        dispatch(dataset.action, dataset);
      })
      .catch((error) => {
        console.error(`Chordice could not load the guitar shapes: ${error.message}`);
        showStatus(GUITAR_FAILED);
      });
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (target?.dataset.action === 'show-notes') {
      openNotes(target);
    } else if (target?.dataset.action === 'set-instrument' && target.dataset.instrument === 'guitar') {
      return chooseGuitar(target.dataset);
    } else if (target) {
      dispatch(target.dataset.action, target.dataset);
    } else if (content.contains(event.target)) {
      // A click on the chords area outside the chords opens Keys and closes the other options sections.
      // The options scroll back to the top, so the opened Keys section is in view. A click when Keys is already the only
      // section open changes nothing, so it does not re-render the page.
      if (!onlyKeysOpen(state)) {
        dispatch('open-keys', {});
      }
      sidePanel.scrollTop = 0;
    }
  });

  // Chords are buttons for keyboard users too: Enter or Space opens their notes.
  document.addEventListener('keydown', (event) => {
    const target = event.target.closest?.('[data-action="show-notes"]');
    if (target && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openNotes(target);
    }
  });

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.type === 'range' && input.dataset.option) {
      dispatch('set-probability', { option: input.dataset.option, value: input.value });
    }
  });

  render();
  showStatus(guitarError ? GUITAR_FAILED : null);
}

/** Loads the data and shows the page. The promise settles once the page is shown, or once the error is shown. */
export function startApp() {
  const loadGuitar = guitarLoader();
  return loadData()
    .then(async (data) => {
      const stored = sanitizeState(parseCookie(document.cookie), data.library);
      // A stored guitar needs its shapes before the page is drawn; without them the piano is shown instead.
      let guitar = null;
      let guitarError = false;
      if (stored.instrument === 'guitar') {
        guitar = await loadGuitar().catch((error) => {
          console.error(`Chordice could not load the guitar shapes: ${error.message}`);
          guitarError = true;
          return null;
        });
      }
      const initial = guitar ? stored : setInstrument(stored, 'piano');
      start({ ...data, initial, guitar, loadGuitar, guitarError });
    })
    .catch((error) => {
      document.querySelector('#rows').textContent = `Chordice could not start: ${error.message}`;
    });
}
