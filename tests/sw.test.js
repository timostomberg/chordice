import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// sw.js is a classic script for the service worker's global scope. The tests run it in a sandbox with stand-ins for
// `self`, the stores (caches) and fetch, and call the listeners it registers.

const REPO = fileURLToPath(new URL('../', import.meta.url));
const SOURCE = readFileSync(join(REPO, 'sw.js'), 'utf8');
const SCOPE = 'https://example.github.io/chordice/';

/** A store of responses, by URL, as the Cache API keeps them. */
class FakeCache {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
  }

  async add(url) {
    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(`${url}: ${response.status}`);
    }
    this.entries.set(url, response);
  }

  async put(request, response) {
    this.entries.set(typeof request === 'string' ? request : request.url, response);
  }

  async match(request, { ignoreSearch = false } = {}) {
    const url = new URL(typeof request === 'string' ? request : request.url);
    if (ignoreSearch) {
      url.search = '';
    }
    return this.entries.get(url.href);
  }
}

/** A response with a text body that can be read once per clone. */
function response(text = '', { ok = true } = {}) {
  return { ok, status: ok ? 200 : 404, text: async () => text, clone: () => response(text, { ok }) };
}

/**
 * Runs sw.js in a sandbox. `network` answers fetches by URL (a missing URL fails like a lost network); `stores` holds the
 * stores there already are. Returns the sandbox, its listeners and the stores.
 */
function load({ network = {}, stores = {}, location = new URL('sw.js', SCOPE) } = {}) {
  const listeners = {};
  const fetched = [];
  const fetch = async (request) => {
    const url = typeof request === 'string' ? request : request.url;
    fetched.push(url);
    if (!(url in network)) {
      throw new TypeError('Failed to fetch');
    }
    return network[url];
  };
  const caches = {
    stores,
    async open(name) {
      stores[name] ??= new FakeCache();
      stores[name].fetch = fetch;
      return stores[name];
    },
    async keys() {
      return Object.keys(stores);
    },
    async delete(name) {
      return delete stores[name];
    },
  };
  const self = {
    location,
    registration: { scope: SCOPE, removed: false, unregister: async () => { self.registration.removed = true; return true; } },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
  };
  const sandbox = vm.createContext({ self, caches, fetch, URL, Promise, Set, console });
  vm.runInContext(SOURCE, sandbox);
  return { sandbox, listeners, stores, fetched };
}

/** Fires an event that waits (install, activate) and returns once it is done. */
async function fire(listener, extra = {}) {
  let done = Promise.resolve();
  listener({ ...extra, waitUntil: (promise) => { done = promise; } });
  await done;
}

/** Fires a fetch event and returns its answer, or undefined when the worker leaves it to the browser. */
async function fetchThrough(listener, url, method = 'GET') {
  let answer;
  listener({ request: { url, method }, respondWith: (promise) => { answer = promise; } });
  return answer && (await answer);
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test('the service worker stores every file of the page: index.html, its manifest and icons, and all of chordice/', () => {
  const { sandbox } = load();
  const shell = vm.runInContext('SHELL', sandbox);
  const page = filesUnder(join(REPO, 'chordice'))
    .filter((file) => !file.endsWith('.DS_Store'))
    .map((file) => relative(REPO, file));
  const icons = readdirSync(join(REPO, 'icons')).filter((name) => !name.startsWith('.')).map((name) => `icons/${name}`);
  const expected = ['./', 'index.html', 'manifest.webmanifest', ...icons, ...page].sort();
  assert.deepEqual([...shell].sort(), expected);
});

test('the service worker stores the libraries of the import map in index.html and the guitar shapes of app.js', () => {
  const { sandbox } = load();
  const cdn = [...vm.runInContext('CDN', sandbox)];
  const index = readFileSync(join(REPO, 'index.html'), 'utf8');
  const imports = Object.values(JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(index)[1]).imports);
  const guitar = /const GUITAR_URL = '([^']+)'/.exec(readFileSync(join(REPO, 'chordice/app/app.js'), 'utf8'))[1];
  assert.deepEqual(cdn.sort(), [...imports, guitar].sort());
});

test('the imports of a module from the CDN are found, static and dynamic, each once', () => {
  const { sandbox } = load();
  const source = 'import*as e from"/npm/@tonaljs/note@4.12.4/+esm";import{a as b}from"/npm/@tonaljs/key@4.11.5/+esm";'
    + 'export*from"/npm/@tonaljs/note@4.12.4/+esm";const c=import("/npm/@tonaljs/midi@4.10.5/+esm");import"./local.js";';
  const imports = vm.runInContext('moduleImports', sandbox)(source, 'https://cdn.jsdelivr.net/npm/tonal@6.6.0/+esm');
  assert.deepEqual([...imports], [
    'https://cdn.jsdelivr.net/npm/@tonaljs/note@4.12.4/+esm',
    'https://cdn.jsdelivr.net/npm/@tonaljs/key@4.11.5/+esm',
    'https://cdn.jsdelivr.net/npm/@tonaljs/midi@4.10.5/+esm',
  ]);
});

test('on install the page and the libraries are stored, with the modules the libraries import; a lost file stops nothing', async () => {
  const tonal = 'https://cdn.jsdelivr.net/npm/tonal@6.6.0/+esm';
  const note = 'https://cdn.jsdelivr.net/npm/@tonaljs/note@4.12.4/+esm';
  const network = {
    [`${SCOPE}index.html`]: response('<html>'),
    [`${SCOPE}chordice/app/main.js`]: response('main'),
    [tonal]: response(`import*as c from"/npm/@tonaljs/note@4.12.4/+esm";`),
    [note]: response('export const Note = {};'),
  };
  const { listeners, stores } = load({ network });
  await fire(listeners.install);
  const [name] = Object.keys(stores);
  const stored = [...stores[name].entries.keys()];
  for (const url of [`${SCOPE}index.html`, `${SCOPE}chordice/app/main.js`, tonal, note]) {
    assert.ok(stored.includes(url), url);
  }
  assert.ok(name.startsWith('chordice-'));
});

test('a file of the page comes from the network, which renews the stored copy', async () => {
  const url = `${SCOPE}chordice/app/app.js`;
  const { listeners, stores } = load({ network: { [url]: response('new') } });
  const answer = await fetchThrough(listeners.fetch, url);
  assert.equal(await answer.text(), 'new');
  const [name] = Object.keys(stores);
  assert.equal(await (await stores[name].match(url)).text(), 'new');
});

test('without a network, a file of the page comes from the store, also with a query in its URL', async () => {
  const { listeners, sandbox } = load();
  const name = vm.runInContext('CACHE', sandbox);
  const { listeners: offline } = load({ stores: { [name]: new FakeCache({ [SCOPE]: response('stored page') }) } });
  const answer = await fetchThrough(offline.fetch, `${SCOPE}?source=homescreen`);
  assert.equal(await answer.text(), 'stored page');
  await assert.rejects(fetchThrough(listeners.fetch, `${SCOPE}missing.js`), /Failed to fetch/);
});

test('a library comes from the store first, and one not yet stored is fetched and stored', async () => {
  const stored = 'https://cdn.jsdelivr.net/npm/vexflow@5.0.0/+esm';
  const fresh = 'https://cdn.jsdelivr.net/npm/@tonaljs/scale@4.13.7/+esm';
  const { sandbox } = load();
  const name = vm.runInContext('CACHE', sandbox);
  const stores = { [name]: new FakeCache({ [stored]: response('stored vexflow') }) };
  const { listeners, fetched } = load({ network: { [fresh]: response('scale') }, stores });
  assert.equal(await (await fetchThrough(listeners.fetch, stored)).text(), 'stored vexflow');
  assert.deepEqual(fetched, [], 'a stored library is not fetched');
  assert.equal(await (await fetchThrough(listeners.fetch, fresh)).text(), 'scale');
  assert.ok(await stores[name].match(fresh));
});

test('other requests are left to the browser: other sites, other projects on the same host, and anything but GET', async () => {
  const { listeners } = load();
  assert.equal(await fetchThrough(listeners.fetch, 'https://example.org/x.js'), undefined);
  assert.equal(await fetchThrough(listeners.fetch, 'https://example.github.io/other-project/'), undefined);
  assert.equal(await fetchThrough(listeners.fetch, `${SCOPE}index.html`, 'POST'), undefined);
});

test('on activate the older stores of Chordice are removed, and those of other projects on the same host are kept', async () => {
  const { sandbox } = load();
  const name = vm.runInContext('CACHE', sandbox);
  const stores = { [name]: new FakeCache(), 'chordice-v0': new FakeCache(), 'other-project': new FakeCache() };
  const { listeners } = load({ stores });
  await fire(listeners.activate);
  assert.deepEqual(Object.keys(stores).sort(), [name, 'other-project'].sort());
});

test('opened as a file, the worker stores nothing, answers no request and removes itself, so the page loads from the disk', async () => {
  const { listeners, stores, fetched, sandbox } = load({ location: new URL('file:///Users/someone/chordice/sw.js') });
  await fire(listeners.install);
  assert.deepEqual(Object.keys(stores), []);
  assert.deepEqual(fetched, []);
  assert.equal(listeners.fetch, undefined, 'the browser loads every file itself');
  await fire(listeners.activate);
  assert.equal(vm.runInContext('self.registration.removed', sandbox), true);
});

test('served over http, e.g. from a local server, the worker serves the page as on GitHub Pages', async () => {
  const { listeners } = load({ location: new URL('http://localhost:8000/sw.js') });
  assert.equal(typeof listeners.fetch, 'function');
});
