/**
 * The account: signing in with Google through Firebase Authentication, and the saved songs of the account in Firestore.
 *
 * The songs of an account are kept in one document, users/{uid}, as a record from the id of each song to the song (see
 * songsRecord in state/songs.js): one read gives every song, and a song is written or removed by its own field, so that
 * two devices that change the songs at once do not undo each other. Firestore keeps a copy of the document in the
 * browser, so the songs are there without a network too, and writes made offline are sent once it is back. Signing out
 * removes that copy from the browser, so that the songs of an account do not stay on a device it has left.
 *
 * Firebase is loaded from its CDN only when the page has a Firebase project (FIREBASE_CONFIG); without one the page offers
 * no account and keeps the songs in the browser, as before. The rules that let each account read and write only its own
 * document are in firestore.rules, next to index.html.
 */

/**
 * The Firebase project of the page, as the Firebase console gives it for a web app (Project settings > Your apps). These
 * values are no secret: they name the project, and firestore.rules guards the data. Null: the page offers no account.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDJ-s_au_IOMxKh9-yE3hleEcGJObAbfec',
  authDomain: 'chordice.firebaseapp.com',
  projectId: 'chordice',
  storageBucket: 'chordice.firebasestorage.app',
  messagingSenderId: '316972665206',
  appId: '1:316972665206:web:19a79ddd428da3fe615257',
};

/** The Firebase SDK on its CDN, at a pinned version. Its modules import each other by their full URL. */
export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/13.3.0/';

/** The collection of the documents of the accounts, each named after the uid of its account. */
export const USERS = 'users';

/** Loads the modules of the Firebase SDK that the account needs. */
async function loadFirebase() {
  const [app, auth, firestore] = await Promise.all(
    ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((name) => import(`${FIREBASE_SDK}${name}`)),
  );
  return { app, auth, firestore };
}

/** The errors of signing in that the person chose (a closed window), which need no message. */
const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

/** The errors of a sign-in window that the browser does not open, where the page goes to Google instead. */
const NO_POPUP = ['auth/popup-blocked', 'auth/operation-not-supported-in-environment'];

/** How long signing out waits for the changes that have not reached the account yet, in milliseconds. */
export const PENDING_WAIT = 3000;

/** The message when signing out would lose changes that have not reached the account yet. */
export const UNSENT = 'Some changes have not reached your account yet. Sign out once there is a connection.';

/** The person as the page shows them: a name and an email address, either of which may be empty. */
export function personOf(user) {
  return user ? { name: user.displayName ?? '', email: user.email ?? '' } : null;
}

/** A message for the page from an error of Firebase. */
export function messageOf(error) {
  switch (error?.code) {
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'There is no connection to the account right now.';
    case 'resource-exhausted':
      return 'The account cannot be reached right now, as too many people use it today. Please try again tomorrow.';
    case 'permission-denied':
      return 'The account refused access to its songs.';
    case 'auth/unauthorized-domain':
      return 'Signing in is not allowed on this website.';
    case 'auth/popup-blocked':
    case 'auth/operation-not-supported-in-environment':
      return 'The browser did not open the window of Google. Allow pop-up windows for this website and try again.';
    default:
      return 'Something went wrong with the account.';
  }
}

/**
 * Connects the page to the account. Returns null without a Firebase project. `onPerson` is called with the person who is
 * signed in (see personOf), or null, at the start and whenever they sign in or out; `onSongs` with the record of their
 * songs (see songsRecord) and whether the account has `confirmed` them (else they come from the copy in the browser, which
 * may be behind), at first and whenever the songs change, on this device or another one; `onError` with a message when
 * something goes wrong that the person should know. `pendingWait` is how long signing out waits for unsent changes.
 */
export function connectAccount({ onPerson, onSongs, onError }, { config = FIREBASE_CONFIG, load = loadFirebase, pendingWait = PENDING_WAIT } = {}) {
  if (!config) {
    return null;
  }
  const report = (error) => {
    console.error('Chordice account:', error);
    onError(messageOf(error));
  };
  const ready = load().then((sdk) => {
    const { app, auth, firestore } = sdk;
    const firebase = app.initializeApp(config);
    const session = auth.getAuth(firebase);
    // A copy of the songs in the browser, shared by the tabs of the page. A song without a field (e.g. a chord without a
    // bass note) is written without it.
    const open = () => firestore.initializeFirestore(firebase, {
      ignoreUndefinedProperties: true,
      localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() }),
    });
    let db = open();
    // Removes the copy of the songs from the browser, once someone has signed out, and opens a new, empty one. While
    // another tab still has the copy open, it cannot be removed here; the last tab to close it removes it.
    let clearing = Promise.resolve();
    const forget = async () => {
      const old = db;
      await firestore.terminate(old);
      await firestore.clearIndexedDbPersistence(old).catch(() => {});
      db = open();
    };
    let stopSongs = null;
    let signedIn = false;
    // Each change of the person counts, so that the songs of someone who has signed out since are not followed.
    let turn = 0;
    auth.onAuthStateChanged(session, (user) => {
      stopSongs?.();
      stopSongs = null;
      const current = ++turn;
      onPerson(personOf(user));
      if (!user && signedIn) {
        clearing = clearing.then(forget).catch((error) => console.error('Chordice account:', error));
      }
      signedIn = Boolean(user);
      if (user) {
        clearing.then(() => {
          if (current !== turn) {
            return;
          }
          // Also a change of the metadata alone is followed, so that the page learns when the account confirms songs that
          // first came from the copy in the browser.
          stopSongs = firestore.onSnapshot(
            firestore.doc(db, USERS, user.uid),
            { includeMetadataChanges: true },
            (snapshot) => onSongs(snapshot.data()?.songs ?? {}, { confirmed: !snapshot.metadata.fromCache }),
            report,
          );
        });
      }
    });
    // After signing in on Google's page (see signIn), the page reports what went wrong there.
    auth.getRedirectResult(session).catch(report);
    return { sdk, session, db: () => db, settled: () => clearing };
  });
  // The account once it is ready, or null if Firebase could not be loaded (which is reported once): then signing in and
  // the other calls do nothing.
  const usable = ready.catch((error) => {
    report(error);
    return null;
  });

  /** The document of the person who is signed in, or null. */
  async function own() {
    const ready = await usable;
    const user = ready?.session.currentUser;
    if (!user) {
      return null;
    }
    await ready.settled();
    const db = ready.db();
    return { ...ready, db, user, ref: ready.sdk.firestore.doc(db, USERS, user.uid) };
  }

  /** Whether the changes made on this device have reached the account within `pendingWait`. */
  async function sent({ sdk, db }) {
    let timer;
    const late = new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), pendingWait);
    });
    const done = sdk.firestore.waitForPendingWrites(db).then(() => true, () => true);
    try {
      return await Promise.race([done, late]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /**
     * Signs in with Google, in a window of its own; where the browser opens none (e.g. some apps on the home screen), the
     * page goes to Google and comes back signed in.
     */
    async signIn() {
      const target = await usable;
      if (!target) {
        return;
      }
      const { sdk, session } = target;
      const provider = new sdk.auth.GoogleAuthProvider();
      try {
        await sdk.auth.signInWithPopup(session, provider);
      } catch (error) {
        if (NO_POPUP.includes(error?.code)) {
          await sdk.auth.signInWithRedirect(session, provider).catch(report);
        } else if (!CANCELLED.includes(error?.code)) {
          report(error);
        }
      }
    },

    /**
     * Signs out. The songs of the account stay in it, and their copy is removed from the browser. Changes that have not
     * reached the account yet (e.g. without a network) would be lost with it: then the page says so and stays signed in.
     */
    async signOut() {
      const target = await own();
      if (!target) {
        return;
      }
      if (!(await sent(target))) {
        onError(UNSENT);
        return;
      }
      await target.sdk.auth.signOut(target.session).catch(report);
    },

    /**
     * Writes the songs and removes the songs with the ids, each by its own field of the document. The promise settles once
     * the account has them, which without a network is when it is back; it is rejected if the account refuses them.
     */
    async write({ put = [], remove = [] }) {
      const target = await own();
      if (!target || (put.length === 0 && remove.length === 0)) {
        return;
      }
      const { FieldPath, deleteField, setDoc } = target.sdk.firestore;
      const songs = {};
      for (const song of put) {
        songs[song.id] = song;
      }
      for (const id of remove) {
        songs[id] = deleteField();
      }
      const fields = Object.keys(songs).map((id) => new FieldPath('songs', id));
      await setDoc(target.ref, { songs }, { mergeFields: fields }).catch((error) => {
        report(error);
        throw error;
      });
    },

    /**
     * Deletes the account and every song in it. Google asks the person to sign in again first, in a window of its own,
     * as deleting an account needs a recent sign-in; only then are the songs deleted, and then the account, so that
     * nothing is deleted when the person closes the window or the browser opens none. Resolves to null once the account
     * is deleted or the person closed the window, else to a message that says what went wrong.
     */
    async deleteAccount() {
      const target = await own();
      if (!target) {
        return messageOf(null);
      }
      const { sdk, user, ref } = target;
      try {
        await sdk.auth.reauthenticateWithPopup(user, new sdk.auth.GoogleAuthProvider());
        await sdk.firestore.deleteDoc(ref);
        await sdk.auth.deleteUser(user);
        return null;
      } catch (error) {
        if (CANCELLED.includes(error?.code)) {
          return null;
        }
        console.error('Chordice account:', error);
        return messageOf(error);
      }
    },
  };
}
