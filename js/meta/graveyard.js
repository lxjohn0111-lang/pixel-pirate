// The roll of fallen captains.
//
// A new life wipes the save clean — new pirate, new world, new
// everything, exactly as it should be. But a death that leaves no trace
// is just a reset, so the names are kept somewhere the wipe cannot reach:
// their own storage key, written once when a captain dies and never
// touched by the game state afterwards.
//
// It costs the next captain nothing and grants them nothing. It is only
// a list of people who tried this before them.

const KEY = 'seaOfRogues.graveyard.v1';
const MAX = 20;

export const Graveyard = {
  /** Most recent first. Never throws — a corrupt list is an empty one. */
  list() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  /** Record a run. Returns the entry as stored, with its grave number. */
  bury(summary) {
    const all = this.list();
    const entry = { ...summary, number: (all[0]?.number ?? 0) + 1 };
    all.unshift(entry);
    try {
      localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
    } catch {
      /* storage full — the captain is no less dead */
    }
    return entry;
  },

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },

  /** "Best" is whatever the player would brag about: the gold they made. */
  best() {
    return this.list().reduce((b, e) => (!b || e.goldEarned > b.goldEarned ? e : b), null);
  },
};
