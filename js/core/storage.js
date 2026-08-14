// Where the game keeps things between sessions.
//
// On CrazyGames the save goes through the SDK's **data module**, which is
// what their platform expects: plain localStorage is not reliable inside
// their frame, and is unavailable outright in some of their clients, so a
// game that only writes to localStorage can quietly lose a player's whole
// voyage. Everywhere else — local dev, itch.io, the single-file build —
// this is localStorage exactly as before.
//
// Two rules keep that from turning into a mess:
//
//   1. **Reads are always synchronous.** The game asks for the save while
//      it boots and cannot wait, so reads come from an in-memory cache
//      backed by localStorage. The SDK is never read on the hot path,
//      which also means it does not matter whether its getItem happens to
//      be synchronous or a promise.
//   2. **Writes go everywhere.** Every write lands in the cache, in the
//      SDK data module when there is one, and in localStorage as a local
//      mirror. Each leg is guarded on its own, so a full disk or a
//      missing module can never lose the other two.
//
// The handshake with the SDK is asynchronous, so `init()` runs alongside
// boot rather than blocking it: the menu appears instantly from local
// data, and if the SDK turns out to hold a voyage that this device does
// not, it is adopted and the caller is told to redraw.

import { CG } from './cgsdk.js';

export const Storage = {
  /** Keys worth reconciling when the SDK arrives. */
  keys: new Set(),
  cache: new Map(),
  data: null,          // the SDK data module, once we have one
  ready: false,

  /** Register a key so `init()` knows to look for it. */
  track(key) {
    this.keys.add(key);
    return key;
  },

  getItem(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    let local = null;
    try {
      local = localStorage.getItem(key);
    } catch {
      /* storage disabled — the cache is all we have */
    }
    this.cache.set(key, local);
    return local;
  },

  setItem(key, value) {
    this.keys.add(key);
    this.cache.set(key, value);
    try {
      this.data?.setItem(key, value);
    } catch {
      /* the platform said no; the mirror below still holds */
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      /* full or unavailable — play on */
    }
  },

  removeItem(key) {
    this.cache.set(key, null);
    try {
      this.data?.removeItem(key);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },

  /**
   * Bring the platform's copy and this device's copy into line.
   *
   * The SDK wins when it has something, because on CrazyGames it *is* the
   * save. When it has nothing and this device does, the local voyage is
   * pushed up — that is how a player who started before this existed
   * keeps their captain.
   *
   * @param {Function} [onAdopt] called when the platform's copy replaced
   *   what we had booted with, so the caller can redraw.
   * @returns {Promise<boolean>} whether anything was adopted.
   */
  async init(onAdopt) {
    const sdk = await CG.get();
    const data = sdk?.data;
    if (!data || typeof data.setItem !== 'function' || typeof data.getItem !== 'function') {
      this.ready = true;
      return false;
    }
    this.data = data;

    let adopted = false;
    for (const key of this.keys) {
      let cloud = null;
      try {
        // `await` handles both shapes: a plain string comes straight back,
        // a promise is resolved. Either way this is off the hot path.
        cloud = await data.getItem(key);
      } catch {
        cloud = null;
      }
      const local = this.getItem(key);
      if (cloud != null && cloud !== local) {
        this.cache.set(key, cloud);
        try {
          localStorage.setItem(key, cloud);
        } catch {
          /* mirror is a nicety, not a requirement */
        }
        adopted = true;
      } else if (cloud == null && local != null) {
        try {
          data.setItem(key, local);
        } catch {
          /* ignore */
        }
      }
    }
    this.ready = true;
    if (adopted) onAdopt?.();
    return adopted;
  },
};
