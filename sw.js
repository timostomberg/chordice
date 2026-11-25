/*
 * The service worker of Chordice: keeps the page, its data and its libraries, so that it opens and works without a network
 * (e.g. in a rehearsal room), once it has been opened online.
 *
 * - On install it stores the page (SHELL) and the libraries from the CDN (CDN), with every module they import in turn.
 * - The files of the page are fetched from the network first, so a new version shows as soon as there is a network; the
 *   stored copy is the fallback without one, and every successful fetch renews it.
 * - The libraries are pinned to a version, so they never change: they come from the store first, and only what is not
 *   there yet (e.g. a module a library loads later) is fetched and stored.
 *
 * It is a classic script, not a module, as not every browser starts a service worker that is a module. The tests load it
 * into a sandbox with a stand-in for `self`.
 */

const CACHE = 'chordice-v1';

/**
 * Whether the page comes from a server (http or https). Only then does the worker serve it: a worker cannot fetch a file
 * of the disk, so on a page opened as a file (which some browsers, such as the one in VS Code, let register a worker) it
 * would answer every request with an error. There it removes itself and leaves every request to the browser.
 */
function isServed(location) {
  return location?.protocol === 'http:' || location?.protocol === 'https:';
}

/** The files of the page, relative to this script, which sits next to index.html. */
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'chordice/app/app.js',
  'chordice/app/background/background.js',
  'chordice/app/background/painter.js',
  'chordice/app/background/painting.js',
  'chordice/app/background/watercolour.js',
  'chordice/app/chord.js',
  'chordice/app/device.js',
  'chordice/app/escape.js',
  'chordice/app/header.js',
  'chordice/app/help/help.html',
  'chordice/app/help/help.js',
  'chordice/app/main.js',
  'chordice/app/names.js',
  'chordice/app/notes/diagram.js',
  'chordice/app/notes/notes.js',
  'chordice/app/notes/staff.js',
  'chordice/app/options/circle-of-fifths.js',
  'chordice/app/options/focus.js',
  'chordice/app/options/options.js',
  'chordice/app/panel.js',
  'chordice/app/song/song.js',
  'chordice/app/song/zoom.js',
  'chordice/app/state/actions.js',
  'chordice/app/state/availability.js',
  'chordice/app/state/exercises.js',
  'chordice/app/state/persistence.js',
  'chordice/app/state/state.js',
  'chordice/music/constants.js',
  'chordice/music/data/bass_patterns.yaml',
  'chordice/music/data/chord_progressions.yaml',
  'chordice/music/data/validate.js',
  'chordice/music/generator/bass.js',
  'chordice/music/generator/inversion.js',
  'chordice/music/generator/order.js',
  'chordice/music/generator/progression.js',
  'chordice/music/generator/random.js',
  'chordice/music/generator/song.js',
  'chordice/music/instruments/guitar.js',
  'chordice/music/instruments/piano.js',
  'chordice/music/theory/bass.js',
  'chordice/music/theory/chords.js',
  'chordice/music/theory/keys.js',
  'chordice/music/theory/melody.js',
  'chordice/music/theory/numerals.js',
  'chordice/music/theory/tones.js',
  'chordice/styles/background.css',
  'chordice/styles/chord.css',
  'chordice/styles/circle-of-fifths.css',
  'chordice/styles/header.css',
  'chordice/styles/help.css',
  'chordice/styles/main.css',
  'chordice/styles/notes.css',
  'chordice/styles/options.css',
  'chordice/styles/song.css',
];

/** The CDN the libraries come from. */
const CDN_ORIGIN = 'https://cdn.jsdelivr.net';

/** The libraries: the modules of the import map in index.html, and the guitar shapes that app.js loads. */
const CDN = [
  'https://cdn.jsdelivr.net/npm/js-yaml@4.3.2/+esm',
  'https://cdn.jsdelivr.net/npm/svguitar@2.11.0/+esm',
  'https://cdn.jsdelivr.net/npm/tonal@6.6.0/+esm',
  'https://cdn.jsdelivr.net/npm/vexflow@5.0.0/+esm',
  'https://cdn.jsdelivr.net/npm/@tombatossals/chords-db@0.5.1/lib/guitar.json',
];

/**
 * The modules a module of the CDN imports, as full URLs. The CDN bundles each package into one module, which imports the
 * packages it depends on by their path on the CDN, e.g. `import*as e from"/npm/@tonaljs/note@4.12.4/+esm"`.
 */
function moduleImports(source, base) {
  const pattern = /(?:\bfrom|\bimport)\s*\(?\s*["'](\/npm\/[^"']+)["']/g;
  return [...new Set([...String(source).matchAll(pattern)].map((match) => new URL(match[1], base).href))];
}

/** Stores a library and, if it is a module, every module it imports, each once. A library that fails is left out. */
async function storeLibrary(cache, url, seen) {
  if (seen.has(url)) {
    return;
  }
  seen.add(url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return;
    }
    await cache.put(url, response.clone());
    if (url.endsWith('/+esm')) {
      const imports = moduleImports(await response.text(), url);
      await Promise.all(imports.map((next) => storeLibrary(cache, next, seen)));
    }
  } catch {
    // Without a network the library is stored on a later visit, when the page fetches it.
  }
}

/** Stores the page and the libraries. A file that cannot be fetched does not stop the others. */
async function install(cache, scope) {
  await Promise.all(SHELL.map((path) => cache.add(new URL(path, scope).href).catch(() => {})));
  const seen = new Set();
  await Promise.all(CDN.map((url) => storeLibrary(cache, url, seen)));
}

/** A file of the page: from the network, which renews the stored copy; without a network, the stored copy. */
async function networkFirst(cache, request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const stored = await cache.match(request, { ignoreSearch: true });
    if (stored) {
      return stored;
    }
    throw error;
  }
}

/** A library: the stored copy, or else from the network, which is then stored. */
async function cacheFirst(cache, request) {
  const stored = await cache.match(request);
  if (stored) {
    return stored;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

/** Whether a store is an older one of Chordice, which the current one replaces. */
function isOldStore(name) {
  return name.startsWith('chordice-') && name !== CACHE;
}

/** How a request is answered: 'page' (network first), 'library' (store first), or null (the browser fetches it itself). */
function strategyOf(request, scope) {
  if (request.method !== 'GET') {
    return null;
  }
  const url = new URL(request.url);
  if (url.origin === CDN_ORIGIN) {
    return 'library';
  }
  return url.href.startsWith(scope) ? 'page' : null;
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function' && !isServed(self.location)) {
  // Opened as a file: the worker takes over at once, only to remove itself, so the page loads from the disk again.
  self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.registration.unregister());
  });
} else if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => install(cache, self.registration.scope)).then(() => self.skipWaiting()));
  });

  // An older store of Chordice is removed, and the new worker serves the open page at once. On GitHub Pages every project
  // of an account shares one origin, and so one set of stores: the stores of the other projects are left alone.
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys()
        .then((names) => Promise.all(names.filter(isOldStore).map((name) => caches.delete(name))))
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener('fetch', (event) => {
    const strategy = strategyOf(event.request, self.registration.scope);
    if (!strategy) {
      return;
    }
    event.respondWith(
      caches.open(CACHE).then((cache) => (strategy === 'page' ? networkFirst(cache, event.request) : cacheFirst(cache, event.request))),
    );
  });
}
