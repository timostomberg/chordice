/**
 * Helpers for the tests of the page's stylesheets. Not a test file itself: it reads the stylesheets in the order the pages
 * link them and finds the rules of a selector.
 */

import { readFileSync, readdirSync } from 'node:fs';

/** The page's logic and markup (chordice/app/) and its stylesheets (chordice/styles/). */
export const APP = new URL('../../chordice/app/', import.meta.url);
export const STYLES = new URL('../../chordice/styles/', import.meta.url);
const INDEX = new URL('../../index.html', import.meta.url);
const HELP = new URL('help/help.html', APP);

/** The stylesheets a page links, in their order, as URLs. */
function linkedStylesheets(page) {
  const html = readFileSync(page, 'utf8');
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((match) => new URL(match[1], page));
}

/** The stylesheets of the app (index.html) and of the help page, each in the order its page links them. */
export const APP_STYLESHEETS = linkedStylesheets(INDEX);
export const HELP_STYLESHEETS = linkedStylesheets(HELP);

/** One stylesheet, by its name in chordice/styles/, e.g. 'chord.css'. */
export function readCss(name) {
  return readFileSync(new URL(name, STYLES), 'utf8');
}

/** Every stylesheet of the page as one text: the app's in their order, then those only the help page links. */
export function allCss() {
  const urls = [...APP_STYLESHEETS, ...HELP_STYLESHEETS.filter((url) => !APP_STYLESHEETS.some((own) => own.href === url.href))];
  return urls.map((url) => readFileSync(url, 'utf8')).join('\n');
}

/**
 * The declarations of all rules for one selector in `css`, e.g. '.chord .melody'. A selector can sit in a shared rule (a
 * selector list) and in a rule of its own, so both are collected.
 */
export function declarationsOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((match) => match[1]).join('');
}

/** The rule block of a theme selector in `css`, e.g. ':root' or ':root[data-theme="dark"]'. */
export function themeBlock(css, selector) {
  return new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

/** The custom properties declared in a block. */
export function declaredProperties(block) {
  return [...block.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);
}

/** The markup and script files whose class names the stylesheets have to cover. */
export function sourceFiles() {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    return entry.isDirectory() ? walk(path) : entry.name.endsWith('.js') ? [path] : [];
  });
  return [INDEX, HELP, ...walk(APP)].map((file) => readFileSync(file, 'utf8'));
}

/**
 * Class names written literally in attributes, e.g. class="chip is-on", including the literal parts of
 * template values such as class="chip${pressed ? ' is-on' : ''}". Names that only exist at runtime are checked separately.
 */
export function literalClassNames() {
  const names = new Set();
  for (const source of sourceFiles()) {
    for (const [, value] of source.matchAll(/class="([^"]*)"/g)) {
      // Quoted names inside an interpolation, e.g. ' is-on' in ${pressed ? ' is-on' : ''}.
      for (const [, expression] of value.matchAll(/\$\{([^}]*)\}/g)) {
        for (const [, quoted] of expression.matchAll(/'\s*([\w-]+)\s*'/g)) {
          names.add(quoted);
        }
      }
      // Plain text around the interpolations.
      for (const token of value.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
        if (token) {
          names.add(token);
        }
      }
    }
  }
  return [...names];
}
