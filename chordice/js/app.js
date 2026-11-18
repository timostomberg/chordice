/**
 * The page: loads the progression data, wires the UI and persists the state in a cookie. main.js starts it.
 */

import { load } from 'js-yaml';
import { generate } from './generator.js';
import { buildBassPatterns, buildLibrary } from './library.js';
import { applyAction, effectiveState, isUnavailable, parseCookie, sanitizeState, serializeCookie } from './state.js';
import { renderOptions, renderRows } from './render.js';
import { createNotesDialog } from './notes-dialog.js';
import { fingeringOf } from './guitar.js';
import { bindZoom, blockZoom } from './zoom.js';

const PROGRESSIONS_URL = new URL('../data/chord_progressions.yaml', import.meta.url);
const BASS_URL = new URL('../data/bass_patterns.yaml', import.meta.url);
// The guitar shapes are read from the chord database on the CDN, at the version pinned in package.json.
const GUITAR_URL = 'https://cdn.jsdelivr.net/npm/@tombatossals/chords-db@0.5.1/lib/guitar.json';

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }
  return response.text();
}

async function loadData() {
  const [progressions, bass, guitar] = await Promise.all([
    fetchText(PROGRESSIONS_URL).then(load),
    fetchText(BASS_URL).then(load),
    fetchText(GUITAR_URL).then((text) => JSON.parse(text)),
  ]);
  return { library: buildLibrary(progressions), bassPatterns: buildBassPatterns(bass), guitar };
}

function start({ library, bassPatterns, guitar }) {
  let state = sanitizeState(parseCookie(document.cookie), library);

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
    currentRows = generate({ ...effectiveState(state), library, bassPatterns });
    rows.innerHTML = renderRows(currentRows, displayOf(state));
    content.scrollTop = contentScroll;
    document.documentElement.dataset.theme = state.theme;
    // The count button shows the number of progressions it cycles through: 1, 2, 4, 8, 12.
    document.querySelector('.count-toggle').textContent = String(state.count);
    // Each view switch names its flag in data-flag, so its pressed state follows the state.
    for (const button of document.querySelectorAll('[data-flag]')) {
      button.setAttribute('aria-pressed', String(state[button.dataset.flag]));
      // A switch the chosen instrument does not use is greyed out. Its pressed state still shows the stored value.
      button.disabled = isUnavailable(state, button.dataset.flag);
    }
    // The instrument tabs: exactly the tab of the chosen instrument is pressed.
    for (const button of document.querySelectorAll('[data-instrument]')) {
      button.setAttribute('aria-pressed', String(button.dataset.instrument === state.instrument));
    }
    // The options button is the element with the class; the header carries the same action but is not the button.
    document.querySelector('.options-toggle').setAttribute('aria-expanded', String(state.showOptions));
    document.querySelector('[data-action="toggle-theme"]').setAttribute('aria-pressed', String(state.theme === 'dark'));
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

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (target?.dataset.action === 'show-notes') {
      openNotes(target);
    } else if (target) {
      dispatch(target.dataset.action, target.dataset);
    } else if (content.contains(event.target)) {
      // A click on the chords area outside the chords opens Keys and closes the other options sections.
      // The options scroll back to the top, so the opened Keys section is in view.
      dispatch('open-keys', {});
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
}

/** Loads the data and shows the page. The promise settles once the page is shown, or once the error is shown. */
export function startApp() {
  return loadData()
    .then(start)
    .catch((error) => {
      document.querySelector('#rows').textContent = `Chordice could not start: ${error.message}`;
    });
}
