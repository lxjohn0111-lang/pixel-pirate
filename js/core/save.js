// localStorage persistence. The save is a single JSON blob so future
// systems (inventory, quests, crew...) only need to add fields to it.

import { SAVE_KEY } from './constants.js';

export const SaveManager = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
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
      localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, ...data }));
      return true;
    } catch {
      return false; // storage full / unavailable — play on without saving
    }
  },

  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  },
};
