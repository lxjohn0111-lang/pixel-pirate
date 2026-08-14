// One place that owns the CrazyGames SDK handshake.
//
// Two systems need the SDK — saving (the data module) and advertising
// (the ad module) — and `SDK.init()` must happen exactly once before
// either works. So the handshake lives here and both await the same
// memoized promise.
//
// Everything about it is optional. Off CrazyGames there is no SDK, the
// promise resolves to null, and both callers fall back to what they did
// before: localStorage for saves, simulated ads for advertising.

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
/** How long to wait for a script tag that is present but still loading. */
const WAIT_MS = 4000;

let promise = null;

function findSdk() {
  return new Promise((resolve, reject) => {
    // On CrazyGames the SDK is a blocking script in <head>, so by the time
    // any module runs it is already here and this resolves immediately.
    if (window.CrazyGames?.SDK) {
      resolve(window.CrazyGames.SDK);
      return;
    }
    // The host page supplies the script (see index.html). We only wait for
    // it — injecting it ourselves would trip Content-Security-Policy on
    // strict hosts and log noise for no benefit.
    if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
      reject(new Error('CrazyGames SDK script not present on the page'));
      return;
    }
    const started = Date.now();
    const poll = setInterval(() => {
      if (window.CrazyGames?.SDK) {
        clearInterval(poll);
        resolve(window.CrazyGames.SDK);
      } else if (Date.now() - started > WAIT_MS) {
        clearInterval(poll);
        reject(new Error('CrazyGames SDK unavailable'));
      }
    }, 120);
  });
}

export const CG = {
  /**
   * The initialized SDK, or null when we are not on CrazyGames.
   * Memoized: every caller after the first gets the same promise, so
   * `SDK.init()` is never called twice.
   */
  get() {
    promise ??= (async () => {
      try {
        const sdk = await findSdk();
        await sdk.init();
        return sdk;
      } catch {
        return null;
      }
    })();
    return promise;
  },

  /** Tests and dev tools only: forget the handshake and start over. */
  _reset() {
    promise = null;
  },
};
