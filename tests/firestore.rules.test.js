import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SONG_LIMIT } from '../chordice/app/state/songs.js';
import { USERS } from '../chordice/app/account.js';

// The rules are read as text first: they are checked for the parts that guard the songs. Then they are run in the
// Firestore emulator, which `npm run test:rules` starts (it needs Java and the dev dependencies firebase-tools,
// @firebase/rules-unit-testing and firebase); without the emulator, `npm test` skips that part.

const RULES = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const withoutComments = RULES.replace(/^\s*\/\/.*$/gm, '');

test('the rules are of version 2 and cover only the documents of the accounts', () => {
  assert.match(withoutComments, /^rules_version = '2';/m);
  const matches = [...withoutComments.matchAll(/match (\S+)/g)].map((match) => match[1]);
  assert.deepEqual(matches, ['/databases/{database}/documents', `/${USERS}/{uid}`]);
});

test('only the person signed in to an account may read, write and delete its document', () => {
  const allows = [...withoutComments.matchAll(/allow ([^:]+):([^;]+);/g)];
  assert.deepEqual(allows.map((allow) => allow[1].trim()), ['read, delete', 'create, update']);
  for (const [, , condition] of allows) {
    assert.match(condition, /^\s*if request\.auth != null && request\.auth\.uid == uid\b/);
  }
});

test('a document holds only the songs, as a map, and no more songs than the page saves', () => {
  const write = /allow create, update:([^;]+);/.exec(withoutComments)[1];
  assert.match(write, /request\.resource\.data\.keys\(\)\.hasOnly\(\['songs'\]\)/);
  assert.match(write, /request\.resource\.data\.songs is map/);
  assert.match(write, new RegExp(`request\\.resource\\.data\\.songs\\.size\\(\\) <= ${SONG_LIMIT}\\b`));
});

// The emulator, as `firebase emulators:exec` names it to the tests.
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;

/** A song of the record of an account, as small as the rules allow: they look only at the number of songs. */
const song = (id) => ({ id, name: `Song ${id}`, savedAt: '2026-11-27T14:30:00.000Z' });

/** The record of `count` songs, keyed by their ids, as the document of an account holds them. */
function songs(count) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [`s${index}`, song(`s${index}`)]));
}

describe('the rules in the Firestore emulator', { skip: EMULATOR ? false : 'needs the Firestore emulator: npm run test:rules' }, () => {
  let env;
  let assertFails;
  let assertSucceeds;
  // The document of Ada, as Ada, Bob and someone who is not signed in see it.
  let ada;
  let bob;
  let nobody;

  before(async () => {
    // Loaded only here, so that `npm test` runs without these dev dependencies.
    const testing = await import('@firebase/rules-unit-testing');
    ({ assertFails, assertSucceeds } = testing);
    const [host, port] = EMULATOR.split(':');
    env = await testing.initializeTestEnvironment({
      projectId: 'demo-chordice',
      firestore: { rules: RULES, host, port: Number(port) },
    });
  });

  beforeEach(async () => {
    await env.clearFirestore();
    ada = env.authenticatedContext('ada').firestore();
    bob = env.authenticatedContext('bob').firestore();
    nobody = env.unauthenticatedContext().firestore();
  });

  after(async () => {
    await env?.cleanup();
  });

  /** Writes Ada's document past the rules, as it stands before a test. */
  const seed = (data) => env.withSecurityRulesDisabled((context) => context.firestore().doc(`${USERS}/ada`).set(data));

  test('a person may create, read, update and delete their own document', async () => {
    const own = ada.doc(`${USERS}/ada`);
    await assertSucceeds(own.set({ songs: songs(1) }));
    await assertSucceeds(own.get());
    // The page writes each song by its own field (see account.js).
    await assertSucceeds(own.set({ songs: { s1: song('s1') } }, { mergeFields: ['songs.s1'] }));
    await assertSucceeds(own.delete());
    // The document of a new account, which has no songs yet, may be read too.
    await assertSucceeds(own.get());
  });

  test('no one may read, write or delete the document of another person, or any document without signing in', async () => {
    await seed({ songs: songs(1) });
    for (const db of [bob, nobody]) {
      const other = db.doc(`${USERS}/ada`);
      await assertFails(other.get());
      await assertFails(other.set({ songs: {} }));
      await assertFails(other.set({ songs: { s9: song('s9') } }, { merge: true }));
      await assertFails(other.delete());
    }
    await assertFails(nobody.doc(`${USERS}/nobody`).set({ songs: {} }));
  });

  test('a document holds only the songs, as a map', async () => {
    const own = ada.doc(`${USERS}/ada`);
    await assertFails(own.set({ songs: songs(1), other: true }));
    await assertFails(own.set({ other: true }));
    await assertFails(own.set({ songs: [song('s0')] }));
    await assertFails(own.set({ songs: 'none' }));
    await seed({ songs: songs(1) });
    await assertFails(own.set({ other: true }, { merge: true }));
  });

  test(`a document holds at most ${SONG_LIMIT} songs, also when a song is added to it`, async () => {
    const own = ada.doc(`${USERS}/ada`);
    await assertSucceeds(own.set({ songs: songs(SONG_LIMIT) }));
    await assertFails(own.set({ songs: songs(SONG_LIMIT + 1) }));
    await assertFails(own.set({ songs: { extra: song('extra') } }, { mergeFields: ['songs.extra'] }));
    // Replacing a song keeps the number, so it is allowed.
    await assertSucceeds(own.set({ songs: { s0: { ...song('s0'), name: 'Renamed' } } }, { mergeFields: ['songs.s0'] }));
  });

  test('every other document is refused, also below the document of the person', async () => {
    await assertFails(ada.doc('other/ada').set({ songs: {} }));
    await assertFails(ada.doc('other/ada').get());
    await assertFails(ada.doc(`${USERS}/ada/more/x`).set({ songs: {} }));
    await assertFails(ada.doc(`${USERS}/ada/more/x`).get());
  });
});
