// Persistence. The save is a single JSON blob so future systems
// (inventory, quests, crew...) only need to add fields to it.
//
// Where that blob actually lives is Storage's problem: the CrazyGames
// data module when the game is running there, localStorage everywhere
// else. Nothing here needs to know which.

import { SAVE_KEY } from './constants.js';
import { Storage } from './storage.js';

// Registered up front so the SDK handshake knows to reconcile it.
Storage.track(SAVE_KEY);

export const SaveManager = {
  load() {
    try {
      const raw = Storage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      return data;
    } catch {
      return null;
    }
  },

  save(data) {
    try {
      Storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, ...data }));
      return true;
    } catch {
      return false; // storage full / unavailable — play on without saving
    }
  },

  clear() {
    try {
      Storage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  },
};
