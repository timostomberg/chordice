/**
 * The page: loads the progression data, holds the state (state/), renders it through the windows (header.js, options/,
 * song/, notes/, help/), wires the events of the page to the state transitions and keeps the state in a cookie. The music
 * (music/) generates the song; the look of the page is in styles/. main.js starts it.
 */

import { load } from 'js-yaml';
import { generateSong } from '../music/generator/song.js';
import { buildBassPatterns, buildLibrary } from '../music/data/validate.js';
import { applyAction } from './state/actions.js';
import { onlyKeysOpen, setInstrument } from './state/state.js';
import { cookiePathOf, parseCookie, sanitizeState, serializeCookie } from './state/persistence.js';
import { displaySwitches, effectiveState } from './state/availability.js';
import { updateHeader } from './header.js';
import { renderExercises, renderOptions } from './options/options.js';
import { createHelp } from './help/help.js';
import { keepFocus } from './options/focus.js';
import { renderSong } from './song/song.js';
import { bindZoom, blockZoom } from './song/zoom.js';
import { createNotesDialog } from './notes/notes.js';
import { fingeringOf } from '../music/instruments/guitar.js';

const PROGRESSIONS_URL = new URL('../music/data/chord_progressions.yaml', import.meta.url);
const BASS_URL = new URL('../music/data/bass_patterns.yaml', import.meta.url);
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

/** The accessible name of the side panel for each of its panels. */
const PANEL_LABELS = { options: 'Options', exercises: 'Exercises', help: 'Help' };

function start({ library, bassPatterns, initial, guitar: loaded, loadGuitar, guitarError = false }) {
  let state = initial;
  let guitar = loaded;
  const cookiePath = cookiePathOf(document.location.pathname);

  const status = document.querySelector('#status');
  /** Shows a message above the chords, or hides the message line when there is none. */
  function showStatus(message) {
    status.textContent = message ?? '';
    status.hidden = !message;
  }

  const sidePanel = document.querySelector('#side-panel');
  const options = document.querySelector('#options');
  const optionList = document.querySelector('#option-list');
  const songRows = document.querySelector('#song-rows');
  const notes = createNotesDialog(document.querySelector('#notes'));
  let currentSong = [];
  // Once a load of the help has ended, the help is shown if its panel is still chosen.
  const help = createHelp(fetchText, () => {
    if (state.panel === 'help') {
      render();
    }
  });
  // The markup the side panel shows, while it shows the help, and the panel it showed at the last render.
  let shownHelp = null;
  let shownPanel = null;

  // Only the chords zoom, with Ctrl + scroll or a pinch. The options never zoom; Ctrl + scroll there does nothing.
  const song = document.querySelector('.song');
  bindZoom(song, songRows);
  blockZoom(sidePanel);

  function render() {
    // Re-rendering replaces the markup, which would otherwise scroll the progression list and the chords back to the top.
    const listScroll = optionList.querySelector('.progression-list')?.scrollTop ?? 0;
    const songScroll = song.scrollTop;
    sidePanel.hidden = !state.showOptions;
    options.hidden = !state.showOptions;
    // A keyboard user keeps their place: the control they used is focused again in the new markup.
    // The side panel shows the options, the exercises or the help, as the Options, Exercises and Help buttons choose. The help
    // stays as it is while it is shown, so a re-render (e.g. after Generate) keeps the reader's place in it.
    options.setAttribute('aria-label', PANEL_LABELS[state.panel]);
    // Another panel starts at its top.
    if (state.panel !== shownPanel) {
      sidePanel.scrollTop = 0;
      shownPanel = state.panel;
    }
    if (state.panel === 'help') {
      if (state.showOptions) {
        const markup = help.markup();
        if (markup !== shownHelp) {
          optionList.innerHTML = markup;
          shownHelp = markup;
        }
      }
    } else {
      shownHelp = null;
      keepFocus(optionList, () => {
        optionList.innerHTML = state.panel === 'exercises' ? renderExercises(state, library) : renderOptions(state, library);
      });
    }
    const list = optionList.querySelector('.progression-list');
    if (list) {
      list.scrollTop = listScroll;
    }
    const effective = effectiveState(state);
    currentSong = generateSong({ ...effective, library, bassPatterns });
    songRows.innerHTML = renderSong(currentSong, displaySwitches(state), { showKey: effective.circleOfFifths });
    song.scrollTop = songScroll;
    document.documentElement.dataset.theme = state.theme;
    updateHeader(state);
    document.cookie = serializeCookie(state, cookiePath);
  }

  function dispatch(action, params) {
    if (action === 'toggle-help') {
      help.retry();
    }
    state = applyAction(state, action, params, library);
    render();
  }

  function openNotes(target) {
    const row = currentSong[Number(target.dataset.row)];
    const chord = row.chords[Number(target.dataset.chord)];
    const instrument = state.instrument;
    const fingering = instrument === 'guitar' ? fingeringOf(chord, guitar) : null;
    notes.open(chord, target, row.tonic, displaySwitches(state), { instrument, fingering });
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
    } else if (song.contains(event.target)) {
      // A click on the song outside the chords opens Keys and closes the other options sections.
      // The options scroll back to the top, so the opened Keys section is in view. A click when Keys is already the only
      // section open changes nothing, so it does not re-render the page.
      // While the side panel shows the exercises or the help, the reader keeps their place there.
      if (state.panel === 'options') {
        if (!onlyKeysOpen(state)) {
          dispatch('open-keys', {});
        }
        sidePanel.scrollTop = 0;
      }
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
      document.querySelector('#song-rows').textContent = `Chordice could not start: ${error.message}`;
    });
}
