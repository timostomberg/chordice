/**
 * The help window: the main part of the help page (help.html) in the side panel, and likewise of the imprint and the
 * privacy policy, which the help links to. A page is loaded when it is first shown, not at start-up; a failed load is
 * tried again the next time the Help button is pressed. The pages can still be opened on their own, and they link back to
 * the app.
 */

import { escapeHtml } from '../escape.js';

/** The help page, next to this module. */
export const HELP_URL = new URL('./help.html', import.meta.url);

/**
 * The pages the help window shows, each by its name: the help, and the imprint and the privacy policy next to it, which
 * the help links to. Each is a static page that can also be opened on its own.
 */
export const HELP_PAGES = {
  help: HELP_URL,
  imprint: new URL('./imprint.html', import.meta.url),
  privacy: new URL('./privacy.html', import.meta.url),
};

/** What each page is called in the messages of the panel. */
const PAGE_NAMES = { help: 'the help', imprint: 'the imprint', privacy: 'the privacy policy' };

/** Whether `page` names a page of the help window. */
export function isHelpPage(page) {
  return Object.hasOwn(HELP_PAGES, page);
}

/**
 * The help panel from a page of the help: its main part, without the link back to the app, which the panel does not need,
 * and with the links to the pages next to the help (the imprint, the privacy policy) leading to them also from the side
 * panel, which is not next to them. Null when the page has no main part.
 */
export function renderHelp(page) {
  const main = /<main class="help">([\s\S]*?)<\/main>/.exec(String(page ?? ''))?.[1];
  if (main === undefined) {
    return null;
  }
  const content = main
    .replace(/\s*<p class="help-footer">[\s\S]*?<\/p>/, '')
    .replace(/href="([^"#:]+)"/g, (_, path) => `href="${new URL(path, HELP_URL).href}"`);
  return `<div class="help">${content}</div>`;
}

/** The link at the top of the imprint and the privacy policy in the side panel, back to the help. */
export const BACK_TO_HELP = `<p class="help-back-link"><a href="${HELP_URL.href}" data-action="show-help-page" ` +
  'data-page="help">← Help</a></p>';

/** The help panel while a page of the help is loading, or after it could not be loaded. */
export function renderHelpMessage(message) {
  return `<div class="help"><p>${escapeHtml(message)}</p></div>`;
}

/**
 * The help of the side panel. `fetchText(url)` loads a page of the help as text, and `onSettled` is called once a load
 * has ended, whether it succeeded or not, so that the page can show the result.
 *
 * markup(page) returns the page of the help with the name (see HELP_PAGES; the help itself by default), or a message
 * while it loads or after it failed; the first call starts the load. The imprint and the privacy policy start with a link
 * back to the help. retry() lets the next markup() load a page again after a failed load. The markup of a loaded page is
 * always the same string, so the page can tell whether it has to replace what it shows.
 */
export function createHelp(fetchText, onSettled) {
  // For each page: 'idle', 'loading', 'loaded' or 'failed', and its markup once loaded.
  const pages = Object.fromEntries(Object.keys(HELP_PAGES).map((name) => [name, { status: 'idle', markup: null }]));

  function load(name) {
    const page = pages[name];
    page.status = 'loading';
    fetchText(HELP_PAGES[name])
      .then((text) => {
        const markup = renderHelp(text);
        if (markup === null) {
          throw new Error(`${PAGE_NAMES[name]} has no main part`);
        }
        page.markup = name === 'help' ? markup : markup.replace('<div class="help">', `<div class="help">${BACK_TO_HELP}`);
        page.status = 'loaded';
      })
      .catch((error) => {
        console.error(`Chordice could not load ${PAGE_NAMES[name]}: ${error.message}`);
        page.status = 'failed';
      })
      .then(onSettled);
  }

  return {
    markup(name = 'help') {
      const page = pages[isHelpPage(name) ? name : 'help'];
      const label = PAGE_NAMES[isHelpPage(name) ? name : 'help'];
      if (page.status === 'loaded') {
        return page.markup;
      }
      if (page.status === 'failed') {
        return renderHelpMessage(`${label[0].toUpperCase()}${label.slice(1)} could not be loaded.`);
      }
      if (page.status === 'idle') {
        load(isHelpPage(name) ? name : 'help');
      }
      return renderHelpMessage(`Loading ${label} …`);
    },
    retry() {
      for (const page of Object.values(pages)) {
        if (page.status === 'failed') {
          page.status = 'idle';
        }
      }
    },
  };
}
