import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SERVICE_WORKER_URL, keepScreenAwake, registerServiceWorker } from '../../../chordice/app/device.js';

/** Stands in for the page: its visibility, and its listeners, which `emit` calls. */
function fakeDocument(visibilityState = 'visible') {
  const listeners = {};
  return {
    visibilityState,
    addEventListener(type, listener) {
      (listeners[type] ??= []).push(listener);
    },
    async emit(type) {
      await Promise.all((listeners[type] ?? []).map((listener) => listener()));
    },
  };
}

/** A screen lock as the browser gives it; `release()` lets go of it, as the browser does when the page is hidden. */
function fakeLock() {
  const listeners = [];
  return {
    addEventListener(type, listener) {
      if (type === 'release') {
        listeners.push(listener);
      }
    },
    release() {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

/** The Screen Wake Lock API: `refuse` makes its next requests fail, e.g. before the first tap. */
function fakeWakeLock({ refuse = 0 } = {}) {
  const locks = [];
  let refusals = refuse;
  return {
    locks,
    types: [],
    async request(type) {
      this.types.push(type);
      if (refusals > 0) {
        refusals -= 1;
        throw new Error('NotAllowedError');
      }
      const lock = fakeLock();
      locks.push(lock);
      return lock;
    },
  };
}

test('the screen is kept on as soon as the page starts', async () => {
  const wakeLock = fakeWakeLock();
  const awake = keepScreenAwake({ wakeLock }, fakeDocument());
  await awake.ready;
  assert.equal(awake.held, true);
  assert.deepEqual(wakeLock.types, ['screen']);
});

test('once the browser lets go of the lock, as when the page is hidden, it is taken again when the page is shown', async () => {
  const wakeLock = fakeWakeLock();
  const doc = fakeDocument();
  const awake = keepScreenAwake({ wakeLock }, doc);
  await awake.ready;
  doc.visibilityState = 'hidden';
  wakeLock.locks[0].release();
  await doc.emit('visibilitychange');
  assert.equal(awake.held, false, 'a hidden page does not ask for the lock');
  doc.visibilityState = 'visible';
  await doc.emit('visibilitychange');
  assert.equal(awake.held, true);
  assert.equal(wakeLock.locks.length, 2);
});

test('a refused lock is asked for again at the next tap, and a held lock is not asked for twice', async () => {
  const wakeLock = fakeWakeLock({ refuse: 1 });
  const doc = fakeDocument();
  const awake = keepScreenAwake({ wakeLock }, doc);
  await awake.ready;
  assert.equal(awake.held, false);
  await doc.emit('pointerdown');
  assert.equal(awake.held, true);
  await doc.emit('pointerdown');
  assert.equal(wakeLock.types.length, 2, 'the held lock is kept');
});

test('a page that starts hidden asks for the lock only once it is shown', async () => {
  const wakeLock = fakeWakeLock();
  const doc = fakeDocument('hidden');
  const awake = keepScreenAwake({ wakeLock }, doc);
  await awake.ready;
  assert.equal(wakeLock.types.length, 0);
  doc.visibilityState = 'visible';
  await doc.emit('visibilitychange');
  assert.equal(awake.held, true);
});

test('without the Screen Wake Lock API the screen is left as it is', () => {
  assert.equal(keepScreenAwake({}, fakeDocument()), null);
  assert.equal(keepScreenAwake(undefined, fakeDocument()), null);
});

test('the service worker sits next to index.html, so that it serves the whole page', () => {
  assert.ok(SERVICE_WORKER_URL.href.endsWith('/sw.js'));
  assert.equal(fileURLToPath(new URL('index.html', SERVICE_WORKER_URL)), fileURLToPath(new URL('../../../index.html', import.meta.url)));
  assert.ok(existsSync(fileURLToPath(SERVICE_WORKER_URL)));
});

// The service worker of the page on GitHub Pages; the tests themselves run from the disk, where SERVICE_WORKER_URL is a file.
const SERVED_URL = new URL('https://example.github.io/chordice/sw.js');

/** A registration of a service worker for a folder, which records whether it was removed. */
function fakeRegistration(scope) {
  return { scope, removed: false, async unregister() { this.removed = true; return true; } };
}

test('the service worker is registered where the browser has them, for a page from a server', async () => {
  const registered = [];
  const serviceWorker = { register: async (url) => registered.push(String(url)) && 'registration' };
  assert.equal(await registerServiceWorker({ serviceWorker }, SERVED_URL), 'registration');
  assert.equal(await registerServiceWorker({ serviceWorker }, new URL('http://localhost:8000/sw.js')), 'registration');
  assert.deepEqual(registered, [SERVED_URL.href, 'http://localhost:8000/sw.js']);
});

test('a page opened as a file registers no service worker, and removes the one of an earlier version, but no other', async () => {
  const fileUrl = new URL('file:///Users/someone/chordice/sw.js');
  const own = fakeRegistration('file:///Users/someone/chordice/');
  const other = fakeRegistration('file:///Users/someone/other/');
  const registered = [];
  const serviceWorker = {
    register: async (url) => registered.push(String(url)),
    getRegistrations: async () => [own, other],
  };
  assert.equal(await registerServiceWorker({ serviceWorker }, fileUrl), null);
  assert.deepEqual(registered, []);
  assert.equal(own.removed, true);
  assert.equal(other.removed, false);
  assert.equal(SERVICE_WORKER_URL.protocol, 'file:', 'as the tests run from the disk, the default is such a file');
});

test('a page opened as a file goes on when the browser cannot list or remove its workers', async () => {
  const fileUrl = new URL('file:///Users/someone/chordice/sw.js');
  assert.equal(await registerServiceWorker({ serviceWorker: { register: async () => 'no' } }, fileUrl), null);
  const failing = { register: async () => 'no', getRegistrations: async () => { throw new Error('SecurityError'); } };
  assert.equal(await registerServiceWorker({ serviceWorker: failing }, fileUrl), null);
});

test('without service workers, or when the registration fails, the page goes on without them', async () => {
  assert.equal(await registerServiceWorker({}), null);
  const errors = [];
  const original = console.error;
  console.error = (message) => errors.push(message);
  try {
    const serviceWorker = { register: async () => { throw new Error('SecurityError'); } };
    assert.equal(await registerServiceWorker({ serviceWorker }, SERVED_URL), null);
  } finally {
    console.error = original;
  }
  assert.equal(errors.length, 1);
});
