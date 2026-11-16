/**
 * Browser entry point: loads the progression data, wires the UI and persists the state in a cookie.
 */

import { load } from 'js-yaml';
import { buildLibrary, generate } from './generator.js';
import { applyAction, parseCookie, sanitizeState, serializeCookie } from './state.js';
import { renderOptions, renderRows } from './render.js';
import { createNotesDialog } from './notes-dialog.js';

const DATA_URL = new URL('../data/chord_progressions.yaml', import.meta.url);

async function loadLibrary() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
  }
  return buildLibrary(load(await response.text()));
}

function start(library) {
  let state = sanitizeState(parseCookie(document.cookie), library);

  const sidePanel = document.querySelector('#side-panel');
  const options = document.querySelector('#options');
  const optionList = document.querySelector('#option-list');
  const rows = document.querySelector('#rows');
  const notes = createNotesDialog(document.querySelector('#notes'));
  let currentRows = [];

  function render() {
    sidePanel.hidden = !state.showOptions;
    options.hidden = !state.showOptions;
    optionList.innerHTML = renderOptions(state, library);
    currentRows = generate({ ...state, library });
    rows.innerHTML = renderRows(currentRows, { colour: state.colour, details: state.details });
    document.documentElement.dataset.theme = state.theme;
    document.querySelector('[data-action="toggle-colour"]').setAttribute('aria-pressed', String(state.colour));
    document.querySelector('[data-action="toggle-details"]').setAttribute('aria-pressed', String(state.details));
    document.querySelector('[data-action="toggle-options"]').setAttribute('aria-expanded', String(state.showOptions));
    document.querySelector('[data-action="toggle-theme"]').setAttribute('aria-pressed', String(state.theme === 'dark'));
    document.cookie = serializeCookie(state);
  }

  function dispatch(action, params) {
    state = applyAction(state, action, params, library);
    render();
  }

  function openNotes(target) {
    notes.open(currentRows[Number(target.dataset.row)].chords[Number(target.dataset.chord)]);
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (target?.dataset.action === 'show-notes') {
      openNotes(target);
    } else if (target) {
      dispatch(target.dataset.action, target.dataset);
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

loadLibrary()
  .then(start)
  .catch((error) => {
    document.querySelector('#rows').textContent = `Chordice could not start: ${error.message}`;
  });
