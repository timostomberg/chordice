/**
 * What the page asks of the device it runs on: the screen stays on while the page is shown, so that it does not go dark
 * while the hands are on the instrument, and a service worker (sw.js, next to index.html) keeps the page and its libraries
 * for use without a network. A device or browser that offers neither is left as it is.
 */

/** The service worker, next to index.html, so that it serves the whole page. */
export const SERVICE_WORKER_URL = new URL('../../sw.js', import.meta.url);

/**
 * Keeps the screen on while the page is shown. The browser lets go of the lock when the page is hidden (another app, a
 * locked screen), so it is taken again when the page is shown. A browser may also refuse it, e.g. before the first tap or
 * on a low battery, so every tap tries again while it is not held. Returns null without the Screen Wake Lock API, else an
 * object that tells whether the lock is `held`.
 */
export function keepScreenAwake(nav = globalThis.navigator, doc = globalThis.document) {
  const wakeLock = nav?.wakeLock;
  if (!wakeLock || !doc) {
    return null;
  }
  let lock = null;
  let pending = false;

  async function acquire() {
    if (lock || pending || doc.visibilityState !== 'visible') {
      return;
    }
    pending = true;
    try {
      const taken = await wakeLock.request('screen');
      lock = taken;
      taken.addEventListener?.('release', () => {
        if (lock === taken) {
          lock = null;
        }
      });
    } catch {
      // Refused: the screen goes dark as usual, and the next tap or showing of the page tries again.
    } finally {
      pending = false;
    }
  }

  doc.addEventListener('visibilitychange', acquire);
  doc.addEventListener('pointerdown', acquire);
  const first = acquire();
  return {
    get held() {
      return lock !== null;
    },
    /** Settles once the first try has ended. */
    ready: first,
  };
}

/**
 * Registers the service worker that keeps the page for use without a network. Only a page from a server (http or https)
 * registers it: a worker cannot fetch the files of the disk, so on a page opened as a file it would break the page. There
 * a worker registered by an earlier version is removed instead. Returns a promise of the registration, or of null where
 * there is none: without service workers (an old browser), on a page opened as a file, or when the registration fails.
 */
export function registerServiceWorker(nav = globalThis.navigator, url = SERVICE_WORKER_URL) {
  if (!nav?.serviceWorker) {
    return Promise.resolve(null);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return unregisterServiceWorker(nav, url).then(() => null);
  }
  return nav.serviceWorker.register(url).catch((error) => {
    console.error(`Chordice cannot be kept for use without a network: ${error.message}`);
    return null;
  });
}

/** Removes the service worker of the page, if one is registered for its folder. A failure leaves it as it is. */
function unregisterServiceWorker(nav, url) {
  const scope = new URL('./', url).href;
  return Promise.resolve()
    .then(() => nav.serviceWorker.getRegistrations?.() ?? [])
    .then((registrations) => Promise.all(registrations.filter((registration) => registration.scope === scope).map((registration) => registration.unregister())))
    .catch(() => {});
}
