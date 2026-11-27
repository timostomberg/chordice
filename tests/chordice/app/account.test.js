import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIREBASE_CONFIG, FIREBASE_SDK, PENDING_WAIT, SETTINGS_WAIT, UNSENT, USERS, connectAccount, messageOf, personOf } from '../../../chordice/app/account.js';

// account.js runs here against a stand-in for the Firebase SDK, which records what the account asks of it: who is signed
// in, the document of each account, and the writes.

const CONFIG = { apiKey: 'key', authDomain: 'chordice.firebaseapp.com', projectId: 'chordice' };

/** An error of Firebase with its code. */
function failure(code) {
  return Object.assign(new Error(code), { code });
}

/** Waits until the promises that are under way have settled. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * A stand-in for the modules of the Firebase SDK. `fail` names the calls that fail, with the code of their error; a call
 * named there fails once. While `fake.cached` is set, the snapshots come from the copy in the browser, not from the
 * account; while `fake.unsent` is set, the writes of this device never reach the account.
 */
function fakeSdk({ fail = {} } = {}) {
  const calls = [];
  const documents = new Map();
  const authListeners = [];
  const snapshotListeners = new Map();
  const session = { currentUser: null };
  const failing = (name) => {
    if (fail[name]) {
      const code = fail[name];
      delete fail[name];
      throw failure(code);
    }
  };
  const signIn = (user) => {
    session.currentUser = user;
    for (const listener of authListeners) {
      listener(user);
    }
  };
  const emit = (path) => {
    for (const listener of snapshotListeners.get(path) ?? []) {
      listener(snapshot(path));
    }
  };
  class FieldPath {
    constructor(...segments) {
      this.segments = segments;
    }
  }
  const DELETE = Symbol('deleteField');
  const fake = { cached: false, unsent: false };
  const snapshot = (path) => ({ data: () => documents.get(path), metadata: { fromCache: fake.cached } });
  const sdk = {
    app: { initializeApp: (config) => ({ config }) },
    auth: {
      getAuth: () => session,
      GoogleAuthProvider: class {},
      onAuthStateChanged: (_, listener) => {
        authListeners.push(listener);
        listener(session.currentUser);
      },
      getRedirectResult: async () => {
        calls.push(['getRedirectResult']);
        failing('getRedirectResult');
        return null;
      },
      signInWithPopup: async () => {
        calls.push(['signInWithPopup']);
        failing('signInWithPopup');
        signIn({ uid: 'u1', displayName: 'Ada', email: 'ada@example.org' });
      },
      signInWithRedirect: async () => {
        calls.push(['signInWithRedirect']);
      },
      reauthenticateWithPopup: async () => {
        calls.push(['reauthenticateWithPopup']);
        failing('reauthenticateWithPopup');
      },
      signOut: async () => {
        calls.push(['signOut']);
        signIn(null);
      },
      deleteUser: async (user) => {
        calls.push(['deleteUser', user.uid]);
        failing('deleteUser');
        signIn(null);
      },
    },
    firestore: {
      FieldPath,
      deleteField: () => DELETE,
      initializeFirestore: (app, settings) => {
        calls.push(['initializeFirestore', settings]);
        return { app, name: `db${calls.filter(([name]) => name === 'initializeFirestore').length}` };
      },
      terminate: async (db) => {
        calls.push(['terminate', db.name]);
      },
      clearIndexedDbPersistence: async (db) => {
        calls.push(['clearIndexedDbPersistence', db.name]);
        failing('clearIndexedDbPersistence');
      },
      waitForPendingWrites: (db) => {
        calls.push(['waitForPendingWrites', db.name]);
        return fake.unsent ? new Promise(() => {}) : Promise.resolve();
      },
      persistentLocalCache: (settings) => ({ persistent: settings }),
      persistentMultipleTabManager: () => 'tabs',
      doc: (db, collection, id) => ({ path: `${collection}/${id}`, db: db.name }),
      onSnapshot: (ref, options, next) => {
        calls.push(['onSnapshot', ref.path, options]);
        const listeners = snapshotListeners.get(ref.path) ?? [];
        snapshotListeners.set(ref.path, [...listeners, next]);
        next(snapshot(ref.path));
        return () => snapshotListeners.set(ref.path, snapshotListeners.get(ref.path).filter((listener) => listener !== next));
      },
      setDoc: async (ref, data, options) => {
        calls.push(['setDoc', ref.path, data, options]);
        failing('setDoc');
        // Only the fields named in mergeFields change, as Firestore does it: a song by its FieldPath, the settings by name.
        const before = documents.get(ref.path) ?? {};
        const songs = { ...(before.songs ?? {}) };
        const next = { ...before };
        for (const field of options.mergeFields) {
          if (field === 'settings') {
            next.settings = data.settings;
            continue;
          }
          const [, id] = field.segments;
          if (data.songs[id] === DELETE) {
            delete songs[id];
          } else {
            songs[id] = data.songs[id];
          }
        }
        if (options.mergeFields.some((field) => field !== 'settings') || before.songs) {
          next.songs = songs;
        }
        documents.set(ref.path, next);
        emit(ref.path);
      },
      deleteDoc: async (ref) => {
        calls.push(['deleteDoc', ref.path]);
        failing('deleteDoc');
        documents.delete(ref.path);
        emit(ref.path);
      },
    },
  };
  return Object.assign(fake, { sdk, calls, documents, signIn, session, emit });
}

/**
 * Connects an account to the fake SDK; returns it with what it reported to the page: the person, the records of the songs
 * (and in `confirmed` whether the account had confirmed each, in `settings` the settings with each), and the messages.
 */
async function connect(fake = fakeSdk(), options = {}) {
  const reported = { persons: [], songs: [], confirmed: [], settings: [], errors: [] };
  const account = connectAccount({
    onPerson: (person) => reported.persons.push(person),
    onSongs: (record, { confirmed, settings }) => {
      reported.songs.push(record);
      reported.confirmed.push(confirmed);
      reported.settings.push(settings);
    },
    onError: (message) => reported.errors.push(message),
  }, { config: CONFIG, load: async () => fake.sdk, ...options });
  await settle();
  // The fake itself, so that a test can change `cached` and `unsent` on it.
  return Object.assign(fake, { account, reported });
}

/** Signs in through the account and waits until it follows the songs. */
async function signedIn(account) {
  await account.signIn();
  await settle();
}

/** Silences the console while `body` runs, as the account logs the errors it reports. */
async function quietly(body) {
  const error = console.error;
  console.error = () => {};
  try {
    return await body();
  } finally {
    console.error = error;
  }
}

test('the page has the Firebase project of Chordice, with every value the SDK needs', () => {
  assert.deepEqual(Object.keys(FIREBASE_CONFIG).sort(),
    ['apiKey', 'appId', 'authDomain', 'messagingSenderId', 'projectId', 'storageBucket']);
  assert.equal(FIREBASE_CONFIG.projectId, 'chordice');
  assert.equal(FIREBASE_CONFIG.authDomain, 'chordice.firebaseapp.com');
  for (const [key, value] of Object.entries(FIREBASE_CONFIG)) {
    assert.ok(typeof value === 'string' && value !== '', key);
  }
});

test('without a Firebase project the page has no account, and with one it loads the SDK from its CDN', () => {
  let loaded = false;
  const account = connectAccount({ onPerson() {}, onSongs() {}, onError() {} }, { config: null, load: async () => { loaded = true; } });
  assert.equal(account, null);
  assert.equal(loaded, false, 'without a project, Firebase is not loaded');
  assert.match(FIREBASE_SDK, /^https:\/\/www\.gstatic\.com\/firebasejs\/\d+\.\d+\.\d+\/$/);
  assert.equal(USERS, 'users');
});

test('the songs are kept in the browser too, shared by its tabs, and a missing field is left out', async () => {
  const { calls } = await connect();
  const [, settings] = calls.find(([name]) => name === 'initializeFirestore');
  assert.equal(settings.ignoreUndefinedProperties, true);
  assert.deepEqual(settings.localCache, { persistent: { tabManager: 'tabs' } });
});

test('the person is reported at the start, when they sign in and when they sign out', async () => {
  const { account, reported } = await connect();
  assert.deepEqual(reported.persons, [null]);
  await signedIn(account);
  assert.deepEqual(reported.persons, [null, { name: 'Ada', email: 'ada@example.org' }]);
  await account.signOut();
  assert.deepEqual(reported.persons.at(-1), null);
});

test('once signed in, the songs of the account are reported, also when they change on another device', async () => {
  const fake = fakeSdk();
  fake.documents.set('users/u1', { songs: { a: { id: 'a' } } });
  const { account, reported, documents } = await connect(fake);
  assert.deepEqual(reported.songs, [], 'no songs while no one is signed in');
  await signedIn(account);
  assert.deepEqual(reported.songs, [{ a: { id: 'a' } }]);
  // Another device writes; the document of a new account has no songs yet.
  documents.set('users/u1', { songs: {} });
  await fake.sdk.firestore.setDoc({ path: 'users/u1' }, { songs: { b: { id: 'b' } } }, { mergeFields: [new fake.sdk.firestore.FieldPath('songs', 'b')] });
  assert.deepEqual(reported.songs.at(-1), { b: { id: 'b' } });
  documents.delete('users/u1');
  await account.signOut();
  const count = reported.songs.length;
  await fake.sdk.firestore.setDoc({ path: 'users/u1' }, { songs: { c: { id: 'c' } } }, { mergeFields: [new fake.sdk.firestore.FieldPath('songs', 'c')] });
  assert.equal(reported.songs.length, count, 'after signing out, the songs are no longer followed');
});

test('a document without songs gives an empty record', async () => {
  const { account, reported } = await connect();
  await signedIn(account);
  assert.deepEqual(reported.songs, [{}]);
});

test('write puts and removes each song by its own field, and nothing while no one is signed in', async () => {
  const fake = fakeSdk();
  fake.documents.set('users/u1', { songs: { old: { id: 'old' }, other: { id: 'other' } } });
  const { account, calls, documents } = await connect(fake);
  await account.write({ put: [{ id: 'x' }] });
  assert.ok(!calls.some(([name]) => name === 'setDoc'), 'no one is signed in');
  await signedIn(account);
  await account.write({ put: [{ id: 'new', name: 'New' }], remove: ['old'] });
  const [, path, , options] = calls.find(([name]) => name === 'setDoc');
  assert.equal(path, 'users/u1');
  assert.deepEqual(options.mergeFields.map((field) => field.segments), [['songs', 'new'], ['songs', 'old']]);
  assert.deepEqual(documents.get('users/u1').songs, { other: { id: 'other' }, new: { id: 'new', name: 'New' } });
  const writes = calls.filter(([name]) => name === 'setDoc').length;
  await account.write({ put: [], remove: [] });
  assert.equal(calls.filter(([name]) => name === 'setDoc').length, writes, 'no change, no write');
});

test('a write the account refuses is reported and rejected', async () => {
  const { account, reported } = await connect(fakeSdk({ fail: { setDoc: 'permission-denied' } }));
  await signedIn(account);
  await quietly(() => assert.rejects(account.write({ put: [{ id: 'a' }] }), /permission-denied/));
  assert.deepEqual(reported.errors, ['The account refused access to its songs.']);
});

test('signing in opens a window, and goes to Google where the browser opens none', async () => {
  const { account, calls } = await connect(fakeSdk({ fail: { signInWithPopup: 'auth/popup-blocked' } }));
  await account.signIn();
  assert.deepEqual(calls.filter(([name]) => name.startsWith('signIn')).map(([name]) => name), ['signInWithPopup', 'signInWithRedirect']);
  // The result of signing in on Google's page is asked for at the start.
  assert.ok(calls.some(([name]) => name === 'getRedirectResult'));
});

test('a sign-in window that the person closes needs no message; another error is reported', async () => {
  const closed = await connect(fakeSdk({ fail: { signInWithPopup: 'auth/popup-closed-by-user' } }));
  await closed.account.signIn();
  assert.deepEqual(closed.reported.errors, []);
  const offline = await connect(fakeSdk({ fail: { signInWithPopup: 'auth/network-request-failed' } }));
  await quietly(() => offline.account.signIn());
  assert.deepEqual(offline.reported.errors, ['There is no connection to the account right now.']);
});

test('an error after coming back from Google\'s page is reported', async () => {
  const { reported } = await quietly(() => connect(fakeSdk({ fail: { getRedirectResult: 'auth/unauthorized-domain' } })));
  assert.deepEqual(reported.errors, ['Signing in is not allowed on this website.']);
});

test('deleting the account asks Google to sign in again, then deletes its songs and then the account', async () => {
  const fake = fakeSdk();
  fake.documents.set('users/u1', { songs: { a: { id: 'a' } } });
  const { account, calls, documents, reported } = await connect(fake);
  assert.equal(await account.deleteAccount(), 'Something went wrong with the account.', 'no one is signed in');
  await signedIn(account);
  assert.equal(await account.deleteAccount(), null);
  const steps = calls.filter(([name]) => ['reauthenticateWithPopup', 'deleteDoc', 'deleteUser'].includes(name));
  assert.deepEqual(steps, [['reauthenticateWithPopup'], ['deleteDoc', 'users/u1'], ['deleteUser', 'u1']]);
  assert.equal(documents.has('users/u1'), false);
  assert.equal(reported.persons.at(-1), null);
});

test('a sign-in window that is closed or not opened while deleting the account deletes nothing', async () => {
  for (const code of ['auth/popup-closed-by-user', 'auth/popup-blocked']) {
    const fake = fakeSdk({ fail: { reauthenticateWithPopup: code } });
    fake.documents.set('users/u1', { songs: { a: { id: 'a' } } });
    const { account, calls, documents, reported } = await connect(fake);
    await signedIn(account);
    const answer = await quietly(() => account.deleteAccount());
    assert.equal(answer, code === 'auth/popup-blocked' ? messageOf(failure(code)) : null, code);
    assert.ok(!calls.some(([name]) => name === 'deleteDoc' || name === 'deleteUser'), code);
    assert.deepEqual(documents.get('users/u1'), { songs: { a: { id: 'a' } } }, code);
    assert.deepEqual(reported.persons.at(-1), { name: 'Ada', email: 'ada@example.org' }, code);
  }
  assert.match(messageOf(failure('auth/popup-blocked')), /Allow pop-up windows/);
});

test('an account that cannot be deleted says why', async () => {
  const refused = await connect(fakeSdk({ fail: { deleteDoc: 'unavailable' } }));
  await signedIn(refused.account);
  assert.equal(await quietly(() => refused.account.deleteAccount()), 'There is no connection to the account right now.');
  assert.ok(!refused.calls.some(([name]) => name === 'deleteUser'));
  assert.deepEqual(refused.reported.errors, []);
});

test('the songs are followed with the changes of their metadata, and each record says whether the account confirmed it', async () => {
  const fake = fakeSdk();
  fake.documents.set('users/u1', { songs: { a: { id: 'a' } } });
  fake.cached = true;
  const { account, calls, reported, emit } = await connect(fake);
  await signedIn(account);
  const [, , options] = calls.find(([name]) => name === 'onSnapshot');
  assert.deepEqual(options, { includeMetadataChanges: true });
  assert.deepEqual(reported.confirmed, [false], 'the first songs come from the copy in the browser');
  fake.cached = false;
  emit('users/u1');
  assert.deepEqual(reported.confirmed, [false, true]);
  assert.deepEqual(reported.songs.at(-1), { a: { id: 'a' } });
});

test('signing out removes the copy of the songs from the browser, and the next sign-in starts with an empty one', async () => {
  const fake = await connect();
  const { account, calls } = fake;
  await signedIn(account);
  await account.signOut();
  await settle();
  const steps = calls.filter(([name]) => ['signOut', 'terminate', 'clearIndexedDbPersistence', 'initializeFirestore'].includes(name))
    .map(([name, db]) => (name === 'initializeFirestore' ? name : [name, db].filter(Boolean).join(' ')));
  assert.deepEqual(steps, ['initializeFirestore', 'signOut', 'terminate db1', 'clearIndexedDbPersistence db1', 'initializeFirestore']);
  await signedIn(account);
  assert.equal(calls.filter(([name]) => name === 'onSnapshot').at(-1)[1], 'users/u1');
  await account.write({ put: [{ id: 'b' }] });
  assert.deepEqual(fake.documents.get('users/u1').songs, { b: { id: 'b' } }, 'the account is written through the new copy');
  // Without a sign-out, nothing is removed: e.g. at the start, while no one is signed in.
  const fresh = await connect();
  assert.ok(!fresh.calls.some(([name]) => name === 'terminate'));
});

test('a copy that another tab still has open is left for that tab to remove', async () => {
  const { account, calls, reported } = await connect(fakeSdk({ fail: { clearIndexedDbPersistence: 'failed-precondition' } }));
  await signedIn(account);
  await account.signOut();
  await settle();
  assert.equal(calls.filter(([name]) => name === 'initializeFirestore').length, 2);
  assert.deepEqual(reported.errors, []);
  await signedIn(account);
  assert.deepEqual(reported.persons.at(-1), { name: 'Ada', email: 'ada@example.org' });
});

test('signing out waits for changes that have not reached the account, and stays signed in if they do not', async () => {
  assert.ok(PENDING_WAIT > 0);
  const fake = await connect(fakeSdk(), { pendingWait: 5 });
  await signedIn(fake.account);
  fake.unsent = true;
  await fake.account.signOut();
  assert.deepEqual(fake.reported.errors, [UNSENT]);
  assert.ok(!fake.calls.some(([name]) => name === 'signOut' || name === 'terminate'));
  assert.deepEqual(fake.reported.persons.at(-1), { name: 'Ada', email: 'ada@example.org' });
  fake.unsent = false;
  await fake.account.signOut();
  assert.ok(fake.calls.some(([name]) => name === 'signOut'));
  assert.equal(fake.reported.persons.at(-1), null);
});

test('an SDK that cannot be loaded is reported once, and then signing in and the other calls do nothing', async () => {
  const errors = [];
  let account;
  await quietly(async () => {
    account = connectAccount({ onPerson() {}, onSongs() {}, onError: (message) => errors.push(message) }, {
      config: CONFIG,
      load: async () => { throw failure('unavailable'); },
    });
    await settle();
  });
  assert.deepEqual(errors, ['There is no connection to the account right now.']);
  await account.signIn();
  await account.signOut();
  await account.write({ put: [{ id: 'a' }] });
  assert.equal(await account.deleteAccount(), 'Something went wrong with the account.');
  assert.equal(errors.length, 1);
});

/** Waits `ms` milliseconds. */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The writes of the settings to the account, as the fake SDK recorded them. */
const settingsWrites = (calls) => calls.filter(([name, , data]) => name === 'setDoc' && Object.hasOwn(data, 'settings'));

test('the settings of the account are reported with its songs, and null while it has none', async () => {
  const fake = fakeSdk();
  fake.documents.set('users/u1', { songs: {}, settings: '{"key":"D"}' });
  const { account, reported, documents } = await connect(fake);
  await signedIn(account);
  assert.deepEqual(reported.settings, ['{"key":"D"}']);
  // Settings that are not text (e.g. written by hand) count as none.
  documents.set('users/u1', { songs: {}, settings: { key: 'D' } });
  fake.emit('users/u1');
  assert.equal(reported.settings.at(-1), null);
  documents.delete('users/u1');
  fake.emit('users/u1');
  assert.equal(reported.settings.at(-1), null);
});

test('a change of the settings is written once no other has followed, by its own field, beside the songs', async () => {
  assert.ok(SETTINGS_WAIT > 0);
  const fake = fakeSdk();
  fake.documents.set('users/u1', { songs: { a: { id: 'a' } } });
  const { account, calls, documents, reported } = await connect(fake, { settingsWait: 10 });
  account.writeSettings('{"key":"C"}');
  await wait(20);
  assert.deepEqual(settingsWrites(calls), [], 'no one is signed in');
  await signedIn(account);
  account.writeSettings('{"key":"D"}');
  account.writeSettings('{"key":"E"}');
  assert.deepEqual(settingsWrites(calls), [], 'not at once');
  // Until they are written, the songs come with the settings that wait, as the newest.
  fake.emit('users/u1');
  assert.equal(reported.settings.at(-1), '{"key":"E"}');
  await wait(20);
  const writes = settingsWrites(calls);
  assert.equal(writes.length, 1, 'only the last of the changes that followed each other');
  const [, path, data, options] = writes[0];
  assert.equal(path, 'users/u1');
  assert.deepEqual(data, { settings: '{"key":"E"}' });
  assert.deepEqual(options, { mergeFields: ['settings'] });
  assert.deepEqual(documents.get('users/u1'), { songs: { a: { id: 'a' } }, settings: '{"key":"E"}' });
  assert.equal(reported.settings.at(-1), '{"key":"E"}');
});

test('flushSettings writes the settings that wait at once, and nothing when none wait', async () => {
  const fake = await connect(fakeSdk(), { settingsWait: 60000 });
  await signedIn(fake.account);
  await fake.account.flushSettings();
  assert.deepEqual(settingsWrites(fake.calls), []);
  fake.account.writeSettings('{"key":"F"}');
  await fake.account.flushSettings();
  assert.equal(settingsWrites(fake.calls).length, 1);
  assert.equal(fake.documents.get('users/u1').settings, '{"key":"F"}');
});

test('signing out writes the settings that wait first; settings of someone who has signed out are dropped', async () => {
  const fake = await connect(fakeSdk(), { settingsWait: 60000 });
  await signedIn(fake.account);
  fake.account.writeSettings('{"key":"G"}');
  await fake.account.signOut();
  const names = fake.calls.map(([name, , data]) => (name === 'setDoc' ? `setDoc ${Object.keys(data)}` : name));
  assert.ok(names.indexOf('setDoc settings') < names.indexOf('signOut'));
  assert.equal(fake.documents.get('users/u1').settings, '{"key":"G"}');
  // Signed in again, then out on another device: what waited is not written.
  await signedIn(fake.account);
  fake.account.writeSettings('{"key":"H"}');
  fake.signIn(null);
  await fake.account.flushSettings();
  assert.equal(fake.documents.get('users/u1').settings, '{"key":"G"}');
});

test('deleting the account drops the settings that wait, so they do not create its document again', async () => {
  const fake = await connect(fakeSdk(), { settingsWait: 5 });
  await signedIn(fake.account);
  fake.account.writeSettings('{"key":"A"}');
  assert.equal(await fake.account.deleteAccount(), null);
  await wait(15);
  assert.deepEqual(settingsWrites(fake.calls), []);
  assert.equal(fake.documents.has('users/u1'), false);
});

test('the person is shown by name and email address; the messages name what went wrong', () => {
  assert.equal(personOf(null), null);
  assert.deepEqual(personOf({ displayName: 'Ada', email: 'ada@example.org' }), { name: 'Ada', email: 'ada@example.org' });
  assert.deepEqual(personOf({ displayName: null, email: null }), { name: '', email: '' });
  assert.match(messageOf(failure('resource-exhausted')), /too many people/);
  assert.equal(messageOf(new Error('x')), 'Something went wrong with the account.');
  assert.equal(messageOf(undefined), 'Something went wrong with the account.');
});

test('a domain that Firebase does not allow is named in the message', () => {
  assert.equal(messageOf(failure('auth/unauthorized-domain'), '127.0.0.1'), 'Signing in is not allowed on 127.0.0.1.');
  assert.equal(messageOf(failure('auth/unauthorized-domain'), ''), 'Signing in is not allowed on this website.');
});
