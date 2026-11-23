/**
 * The help window: the main part of the help page (help.html) in the side panel. The page is loaded when the help is first
 * shown, not at start-up; a failed load is tried again the next time the Help button is pressed. The page can still be
 * opened on its own, and it links back to the app.
 */

import { escapeHtml } from '../escape.js';

/** The help page, next to this module. */
export const HELP_URL = new URL('./help.html', import.meta.url);

const LOADING = 'Loading the help …';
const FAILED = 'The help could not be loaded.';

/**
 * The help panel from the help page: its main part, without the link back to the app, which the panel does not need.
 * Null when the page has no main part.
 */
export function renderHelp(page) {
  const main = /<main class="help">([\s\S]*?)<\/main>/.exec(String(page ?? ''))?.[1];
  if (main === undefined) {
    return null;
  }
  const content = main.replace(/\s*<p class="help-footer">[\s\S]*?<\/p>/, '');
  return `<div class="help">${content}</div>`;
}

/** The help panel while the help page is loading, or after it could not be loaded. */
export function renderHelpMessage(message) {
  return `<div class="help"><p>${escapeHtml(message)}</p></div>`;
}

/**
 * The help of the side panel. `fetchText(url)` loads the help page as text, and `onSettled` is called once a load has
 * ended, whether it succeeded or not, so that the page can show the result.
 *
 * markup() returns the help, or a message while it loads or after it failed; the first call starts the load. retry()
 * lets the next markup() load the page again after a failed load. The markup of a loaded help is always the same string,
 * so the page can tell whether it has to replace what it shows.
 */
export function createHelp(fetchText, onSettled) {
  let help = null;
  // 'idle', 'loading', 'loaded' or 'failed'.
  let status = 'idle';

  function load() {
    status = 'loading';
    fetchText(HELP_URL)
      .then((page) => {
        help = renderHelp(page);
        if (help === null) {
          throw new Error('the help page has no main part');
        }
        status = 'loaded';
      })
      .catch((error) => {
        console.error(`Chordice could not load the help: ${error.message}`);
        status = 'failed';
      })
      .then(onSettled);
  }

  return {
    markup() {
      if (status === 'loaded') {
        return help;
      }
      if (status === 'failed') {
        return renderHelpMessage(FAILED);
      }
      if (status === 'idle') {
        load();
      }
      return renderHelpMessage(LOADING);
    },
    retry() {
      if (status === 'failed') {
        status = 'idle';
      }
    },
  };
}
