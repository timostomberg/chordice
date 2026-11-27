/**
 * The page: loads the progression data, holds the state (state/), renders it through the windows (header.js, options/,
 * song/, notes/, help/), wires the events of the page to the state transitions and keeps the state in a cookie and in
 * the local storage. The saved songs are kept in the local storage, or in the account of the person who is signed in
 * (account.js). The music (music/) generates the song; the look of the page is in styles/. main.js starts it.
 */

import { load } from 'js-yaml';
import { buildBassPatterns, buildLibrary } from '../music/data/validate.js';
import { applyAction } from './state/actions.js';
import { choosePanel, setInstrument } from './state/state.js';
import { STORAGE_KEY, cookiePathOf, readState, sanitizeState, serializeCookie, serializeStored } from './state/persistence.js';
import { displaySwitches } from './state/availability.js';
import {
  SONGS_KEY,
  deleteSong,
  hasChanges,
  loadSong,
  mergeSongs,
  renameSong,
  parseSongs,
  saveSong,
  serializeSongs,
  shownSong,
  songChanges,
  songsFromRecord,
  unfreezeSong,
  withSongs,
} from './state/songs.js';
import { NAME_FIELD_ID, RENAME_FIELD_ID, renderFrozenNote, renderSongs } from './songs.js';
import { updateHeader } from './header.js';
import { renderExercises, renderOptions } from './options/options.js';
import { renderKeyCircle } from './options/circle-of-fifths.js';
import { createHelp, isHelpPage } from './help/help.js';
import { keepFocus } from './options/focus.js';
import { renderSong } from './song/song.js';
import { bindSongZoom, blockZoom } from './song/zoom.js';
import { createNotesDialog } from './notes/notes.js';
import { createBackground } from './background/background.js';
import { bindPanelHistory, bindPanelSwipes } from './panel.js';
import { fingeringOf } from '../music/instruments/guitar.js';
import { connectAccount } from './account.js';

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

/**
 * An entry of the browser's local storage: the copy of the state (see persistence.js) or the saved songs (see songs.js).
 * A browser that refuses the storage (e.g. a private window that is full) keeps only the cookie, and no songs.
 */
function readStorage(key = STORAGE_KEY) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Writes an entry of the local storage; returns whether it was written (see readStorage). */
function writeStorage(text, key = STORAGE_KEY) {
  try {
    if (!globalThis.localStorage) {
      return false;
    }
    globalThis.localStorage.setItem(key, text);
    return true;
  } catch {
    // Only the cookie keeps the state then.
    return false;
  }
}

/** A new id for a saved song: the time and a random part, so that two songs saved at once differ too. */
function newSongId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The message shown when the saved songs cannot be written to the local storage (e.g. it is full, or refused). */
export const SONGS_FAILED = 'The saved songs could not be stored in this browser, so they will be lost when the page is closed.';

/** The actions that change the saved songs: they start from the songs another tab may have stored meanwhile. */
const SONG_WRITES = ['save-song', 'confirm-rename', 'confirm-delete'];

/** The message shown when the guitar shapes cannot be loaded; the piano stays chosen. */
const GUITAR_FAILED = 'The guitar shapes could not be loaded, so the piano stays chosen.';

/** The paper of each theme (--bg in main.css), for the browser's own bars. */
export const THEME_COLOURS = { light: '#f1ebdf', dark: '#141824' };

/** The accessible name of the side panel for each of its panels. */
const PANEL_LABELS = { options: 'Options', exercises: 'Exercises', songs: 'Songs', help: 'Help' };

/** The accessible name of the side panel for each page of the help window (see help/help.js). */
const HELP_LABELS = { help: 'Help', imprint: 'Imprint', privacy: 'Privacy policy' };

/** The markup of each panel of the side panel but the help, which help.js loads. */
const PANEL_MARKUP = {
  options: (state, library) => renderOptions(state, library),
  exercises: (state, library) => renderExercises(state, library),
  songs: (state, library, draft, editing, account) => renderSongs(state, draft, editing, account),
};

function start({ library, bassPatterns, initial, guitar: loaded, loadGuitar, guitarError = false, connect }) {
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
  const songCircle = document.querySelector('#song-circle');
  const songBody = document.querySelector('.song-body');
  const background = createBackground(document.querySelector('#background'));
  const notes = createNotesDialog(document.querySelector('#notes'));
  let currentSong = [];
  // Whether the song shown shows its melody note (see shownSong in state/songs.js).
  let currentMelody = false;
  // Once a load of the help has ended, the help is shown if its panel is still chosen.
  const help = createHelp(fetchText, () => {
    if (state.panel === 'help') {
      render();
    }
  });
  // The markup the side panel shows, while it shows the help, and the panel it showed at the last render.
  let shownHelp = null;
  let shownPanel = null;
  // The page the help panel shows: the help, the imprint or the privacy policy (see help/help.js). It belongs to the panel,
  // not to the state: the Help button always opens the help itself.
  let helpPage = 'help';
  // The saved songs last written to the local storage: they are written again only when they change, and until a write
  // works.
  let writtenSongs = state.songs;
  // The saved song whose name is being edited in the songs panel, and the one that is about to be deleted, each an id or
  // null. They belong to the panel, not to the state: any other action ends them.
  let renaming = null;
  let deleting = null;
  // Whether the songs panel asks whether to delete the account; any other action ends the question.
  let deletingAccount = false;
  // The message of the account section (e.g. why the account could not be deleted), until the next action of the account
  // or until someone signs in or out.
  let accountNotice = null;

  // The person who is signed in (see account.js), or null. While someone is signed in, the songs of the state are the
  // songs of their account, and a change of them is written to the account instead of the local storage. `synced` tells
  // whether the songs of the account have come since they signed in; until then no song can be saved. `merged` tells
  // whether the songs of the browser have been joined into them, which waits until the account has confirmed its songs:
  // the copy in the browser may be behind and hold fewer songs than the account.
  let person = null;
  let synced = false;
  let merged = false;
  // The account (see account.js), connected once the page is set up; null where the page has none.
  let account = null;

  // Only the chords zoom, with Ctrl + scroll or a pinch. The options never zoom; Ctrl + scroll there does nothing.
  const song = document.querySelector('.song');
  // When there is too little room, the chords zoom out by themselves (see zoom.js), after every render and resize. The
  // circle of fifths beside them is not zoomed; it only gets smaller where the room is too little for it.
  const zoom = bindSongZoom(song, songBody, songCircle, document.querySelector('.song-chords'), songRows);
  // The number of rows shown at the last render: when it changes, every row is fitted into the song area at once.
  let shownRowCount = null;
  blockZoom(sidePanel);

  // The side panel as a screen of its own: the back button closes it, and swipes open and close it (see panel.js).
  const setPanelOpen = (open) => {
    if (state.showOptions !== open) {
      dispatch('toggle-panel', {});
    }
  };
  const panelHistory = bindPanelHistory(globalThis, () => state.showOptions, setPanelOpen);
  bindPanelSwipes(document, sidePanel, () => state.showOptions, setPanelOpen);

  function render() {
    // Re-rendering replaces the markup, which would otherwise scroll the progression list and the chords back to the top.
    const listScroll = optionList.querySelector('.progression-list')?.scrollTop ?? 0;
    const songScroll = song.scrollTop;
    sidePanel.hidden = !state.showOptions;
    options.hidden = !state.showOptions;
    // A keyboard user keeps their place: the control they used is focused again in the new markup.
    // The side panel shows the options, the exercises or the help, as the Options, Exercises and Help buttons choose. The help
    // stays as it is while it is shown, so a re-render (e.g. after New Song) keeps the reader's place in it.
    options.setAttribute('aria-label', state.panel === 'help' ? HELP_LABELS[helpPage] : PANEL_LABELS[state.panel]);
    // Another panel, or another page of the help, starts at its top.
    const panel = state.panel === 'help' ? `help:${helpPage}` : state.panel;
    if (panel !== shownPanel) {
      sidePanel.scrollTop = 0;
      shownPanel = panel;
    }
    if (state.panel === 'help') {
      if (state.showOptions) {
        const markup = help.markup(helpPage);
        if (markup !== shownHelp) {
          optionList.innerHTML = markup;
          shownHelp = markup;
        }
      }
    } else {
      shownHelp = null;
      // The name typed into the field of the songs panel is kept over a re-render, until the song is saved.
      const draft = optionList.querySelector(`#${NAME_FIELD_ID}`)?.value ?? '';
      keepFocus(optionList, () => {
        const editing = { renaming, deleting, deletingAccount };
        optionList.innerHTML = renderFrozenNote(state) + PANEL_MARKUP[state.panel](state, library, draft, editing, accountView());
      });
    }
    const list = optionList.querySelector('.progression-list');
    if (list) {
      list.scrollTop = listScroll;
    }
    // The song generated from the options, or the snapshot of a saved song that is shown frozen (see state/songs.js).
    const shown = shownSong(state, library, bassPatterns);
    currentSong = shown.rows;
    currentMelody = shown.melody;
    // The circle of fifths left of the chords, where the key is chosen, with the circle of fifths button in its middle.
    keepFocus(songCircle, () => {
      songCircle.innerHTML = renderKeyCircle(state);
    });
    songRows.innerHTML = renderSong(currentSong, songDisplay(), { showKey: shown.showKey });
    if (currentSong.length === shownRowCount) {
      zoom.fit();
    } else {
      shownRowCount = currentSong.length;
      zoom.fitAll();
    }
    song.scrollTop = songScroll;
    document.documentElement.dataset.theme = state.theme;
    // The browser's own bars (e.g. Safari's, or the status bar of the app on the home screen) take the paper of the theme.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOURS[state.theme]);
    // The painting belongs to the song: it changes with New Song (new seeds) and with the theme, otherwise it stays. Its
    // colour shows at once, with the chords; the painting fades in over it once it is drawn. With the painting switch
    // off, only its colour is shown.
    background.show(state.seeds, state.theme, { plain: !state.painting });
    updateHeader(state);
    document.cookie = serializeCookie(state, cookiePath);
    writeStorage(serializeStored(state));
    if (state.songs !== writtenSongs && person) {
      // The account gets only what changed; a write it refuses is undone by the songs it sends back.
      const changes = songChanges(writtenSongs, state.songs);
      writtenSongs = state.songs;
      if (hasChanges(changes)) {
        account.write(changes).catch(() => {});
      }
    } else if (state.songs !== writtenSongs) {
      // A song that cannot be stored stays in the list for now, and the page says that it will be lost.
      if (writeStorage(serializeSongs(state.songs), SONGS_KEY)) {
        writtenSongs = state.songs;
        if (status.textContent === SONGS_FAILED) {
          showStatus(null);
        }
      } else {
        showStatus(SONGS_FAILED);
      }
    }
    panelHistory.sync();
  }

  /** What the songs panel shows of the account: none without one, else who is signed in and whether their songs came. */
  function accountView() {
    return account ? { person, loading: person !== null && !synced, notice: accountNotice } : null;
  }

  /** The display switches of the chords; a frozen song shows its melody note as it was saved. */
  function songDisplay() {
    return { ...displaySwitches(state), melody: currentMelody };
  }

  /** The actions on the saved songs, which need the progressions, the date or the name field besides the state. */
  const songActions = {
    'save-song': () => {
      if (person && !synced) {
        return state;
      }
      const field = optionList.querySelector(`#${NAME_FIELD_ID}`);
      const next = saveSong(state, { id: newSongId(), name: field?.value, date: new Date(), library, bassPatterns });
      if (field) {
        field.value = '';
      }
      return next;
    },
    'load-song': (params) => loadSong(state, params.id, library, bassPatterns),
    // The cross asks in the entry of the song whether to delete it; Delete there deletes it.
    'delete-song': (params) => {
      deleting = state.songs.some((saved) => saved.id === params.id) ? params.id : null;
      return state;
    },
    'confirm-delete': (params) => deleteSong(state, params.id),
    'cancel-delete': () => state,
    // The pencil shows the name in a field; the form of the field renames the song (see the submit listener).
    'rename-song': (params) => {
      renaming = state.songs.some((saved) => saved.id === params.id) ? params.id : null;
      return state;
    },
    'confirm-rename': (params) => renameSong(state, params.id, optionList.querySelector(`#${RENAME_FIELD_ID}`)?.value),
    'cancel-rename': () => state,
    'unfreeze-song': () => unfreezeSong(state),
    // The account: signing in and out, and deleting it after a question in the songs panel. Their results come back
    // through onPerson and onSongs.
    'sign-in': () => {
      account?.signIn();
      return state;
    },
    'sign-out': () => {
      account?.signOut();
      return state;
    },
    'delete-account': () => {
      deletingAccount = person !== null;
      return state;
    },
    'confirm-delete-account': () => {
      accountNotice = null;
      account?.deleteAccount().then(showAccountNotice);
      return state;
    },
    'cancel-delete-account': () => state,
  };

  /** Shows a message of the account in its section, or none. */
  function showAccountNotice(message) {
    accountNotice = message ?? null;
    render();
  }

  /**
   * The saved songs as the local storage holds them now, which another tab of the page may have changed. While the
   * storage holds no songs (or refuses them), the songs of this tab stay; so do the songs of an account, which come from
   * the account.
   */
  function storedSongs() {
    const text = person ? null : readStorage(SONGS_KEY);
    return text === null ? state.songs : parseSongs(text);
  }

  // Another tab of the page saved, renamed or deleted a song: this tab shows its songs too.
  globalThis.addEventListener?.('storage', (event) => {
    if ((event.key !== SONGS_KEY && event.key !== null) || person) {
      return;
    }
    state = withSongs(state, event.newValue === null ? [] : parseSongs(event.newValue));
    writtenSongs = state.songs;
    render();
  });

  /** The control of the songs panel with the action and the song id, if it is shown. */
  function songControl(action, id) {
    return [...optionList.querySelectorAll(`[data-action="${action}"]`)].find((element) => element.dataset.id === id);
  }

  /**
   * After an action of the songs panel, the control the keyboard user used may be gone (e.g. the cross that turned into
   * the question). The focus then goes to the control that takes its place: the Delete button of the question, the pencil
   * after renaming, the song that follows a deleted one, or the name field after saving with Enter.
   */
  function songFocus(action, { id, before, index, inField }) {
    switch (action) {
      case 'delete-song':
        return songControl('confirm-delete', id);
      case 'cancel-delete':
        return songControl('delete-song', before.deleting);
      case 'confirm-rename':
      case 'cancel-rename':
        return songControl('rename-song', id ?? before.renaming);
      case 'confirm-delete': {
        const songs = [...optionList.querySelectorAll('[data-action="load-song"]')];
        return songs[Math.min(index, songs.length - 1)] ?? optionList.querySelector(`#${NAME_FIELD_ID}`);
      }
      case 'save-song':
        return inField ? optionList.querySelector(`#${NAME_FIELD_ID}`) : null;
      default:
        return null;
    }
  }

  function dispatch(action, params) {
    if (action === 'toggle-help') {
      help.retry();
      // While the imprint or the privacy policy is shown, the Help button goes back to the help rather than closing it.
      const showsOtherPage = state.showOptions && state.panel === 'help' && helpPage !== 'help';
      helpPage = 'help';
      if (showsOtherPage) {
        render();
        return;
      }
    }
    // A link to a page of the help (e.g. the privacy policy, from the help or the songs panel) shows it in the side panel.
    if (action === 'show-help-page') {
      if (!isHelpPage(params.page)) {
        return;
      }
      help.retry();
      helpPage = params.page;
      if (!state.showOptions || state.panel !== 'help') {
        state = choosePanel(state, 'help');
      }
      render();
      return;
    }
    // Whether the keyboard focus was in the side panel, and on the name field, before the action.
    const focused = document.activeElement;
    const hadFocus = Boolean(focused) && optionList.contains(focused);
    const focus = {
      id: params.id,
      before: { renaming, deleting },
      index: state.songs.findIndex((saved) => saved.id === params.id),
      inField: hadFocus && focused.id === NAME_FIELD_ID,
    };
    if (SONG_WRITES.includes(action)) {
      state = withSongs(state, storedSongs());
    }
    const startsRenaming = action === 'rename-song';
    if (!startsRenaming) {
      renaming = null;
    }
    if (action !== 'delete-song') {
      deleting = null;
    }
    if (action !== 'delete-account') {
      deletingAccount = false;
    }
    state = Object.hasOwn(songActions, action) ? songActions[action](params) : applyAction(state, action, params, library);
    render();
    // The field of the song that is being renamed takes the focus, with its name selected, so typing replaces it.
    if (startsRenaming && renaming) {
      const field = optionList.querySelector(`#${RENAME_FIELD_ID}`);
      field?.focus?.();
      field?.select?.();
    } else if (hadFocus && !optionList.contains(document.activeElement)) {
      songFocus(action, focus)?.focus?.({ preventScroll: true });
    }
  }

  function openNotes(target) {
    const row = currentSong[Number(target.dataset.row)];
    const chord = row.chords[Number(target.dataset.chord)];
    const instrument = state.instrument;
    const fingering = instrument === 'guitar' ? fingeringOf(chord, guitar) : null;
    notes.open(chord, target, row.tonic, songDisplay(), { instrument, fingering });
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
    // A link with an action (e.g. to the privacy policy) does its action in the page rather than leaving it.
    if (target?.tagName === 'A') {
      event.preventDefault();
    }
    if (target?.dataset.action === 'show-notes') {
      openNotes(target);
    } else if (target?.dataset.action === 'set-instrument' && target.dataset.instrument === 'guitar') {
      return chooseGuitar(target.dataset);
    } else if (target) {
      dispatch(target.dataset.action, target.dataset);
    } else if (song.contains(event.target) && !songCircle.contains(event.target)) {
      // A click on the song outside the chords closes the side panel. With the panel closed it changes nothing, so it does
      // not re-render the page. A click on the circle of fifths does not count: a near miss between its wedges, or a click
      // on its greyed-out keys (which let the pointer through), would otherwise close the panel.
      setPanelOpen(false);
    }
  });

  // Chords and the keys of the circle of fifths are buttons for keyboard users too: Enter or Space presses them (a chord
  // opens its notes, a key is chosen). Neither is a <button>, which would turn the keys into a click by itself. Space would
  // otherwise scroll the song area.
  document.addEventListener('keydown', (event) => {
    // Escape in the field of a song that is being renamed keeps its name.
    if (event.key === 'Escape' && renaming && event.target.closest?.('[data-form="rename-song"]')) {
      event.preventDefault();
      dispatch('cancel-rename', {});
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const target = event.target.closest?.('[data-action="show-notes"], [data-action="set-key"]');
    if (!target) {
      return;
    }
    event.preventDefault();
    if (target.dataset.action === 'show-notes') {
      openNotes(target);
    } else {
      dispatch(target.dataset.action, target.dataset);
    }
  });

  // The name field of the songs panel saves the song with Enter, as its Save button does; the field of a song that is being
  // renamed renames it with Enter, as its OK button does.
  document.addEventListener('submit', (event) => {
    if (event.target.closest?.('[data-form="save-song"]')) {
      event.preventDefault();
      dispatch('save-song', {});
    }
    const rename = event.target.closest?.('[data-form="rename-song"]');
    if (rename) {
      event.preventDefault();
      dispatch('confirm-rename', { id: rename.dataset.id });
    }
  });

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.type === 'range' && input.dataset.option) {
      dispatch('set-probability', { option: input.dataset.option, value: input.value });
    }
  });

  account = connect({
    onPerson(next) {
      const signedOut = person !== null && next === null;
      person = next;
      synced = false;
      merged = false;
      deletingAccount = false;
      accountNotice = null;
      // Signed in, the songs of the browser stay in the state until the songs of the account come (the panel says they are
      // loading), so that a frozen song stays frozen if the account has it.
      if (signedOut) {
        // The songs of the browser come back: those saved before signing in that did not fit into the account.
        state = withSongs(state, parseSongs(readStorage(SONGS_KEY)));
      }
      writtenSongs = state.songs;
      render();
    },
    onSongs(record, { confirmed = true } = {}) {
      if (!person) {
        return;
      }
      let songs = songsFromRecord(record);
      synced = true;
      if (!merged && confirmed) {
        merged = true;
        // The songs saved in this browser go into the account once it has confirmed its songs; those that do not fit stay
        // here.
        const device = parseSongs(readStorage(SONGS_KEY));
        const joined = mergeSongs(songs, device);
        songs = joined.songs;
        if (joined.left.length < device.length) {
          account.write({ put: joined.upload })
            .then(() => writeStorage(serializeSongs(joined.left), SONGS_KEY))
            .catch(() => {});
        }
      }
      state = withSongs(state, songs);
      writtenSongs = state.songs;
      render();
    },
    onError: showStatus,
  });

  render();
  showStatus(guitarError ? GUITAR_FAILED : null);
}

/**
 * Loads the data and shows the page. The promise settles once the page is shown, or once the error is shown. `connect`
 * connects the page to the account (see account.js); it returns null where the page has none.
 */
export function startApp({ connect = connectAccount } = {}) {
  const loadGuitar = guitarLoader();
  return loadData()
    .then(async (data) => {
      const songs = parseSongs(readStorage(SONGS_KEY));
      const stored = withSongs(sanitizeState(readState(document.cookie, readStorage()), data.library), songs);
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
      start({ ...data, initial, guitar, loadGuitar, guitarError, connect });
    })
    .catch((error) => {
      document.querySelector('#song-rows').textContent = `Chordice could not start: ${error.message}`;
    });
}
