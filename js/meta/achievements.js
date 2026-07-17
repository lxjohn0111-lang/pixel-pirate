// Achievements: thresholds over stats and collection state, checked
// cheaply once per second. Each unlock is permanent, toasts loudly and
// several award ship cosmetics.

export const ACHIEVEMENTS = [
  { id: 'firstBlood', name: 'First Blood', desc: 'Sink your first ship', stat: 'shipsSunk', goal: 1 },
  { id: 'privateer', name: 'Privateer', desc: 'Sink 10 ships', stat: 'shipsSunk', goal: 10 },
  { id: 'scourge', name: 'Scourge of the Seas', desc: 'Sink 100 ships', stat: 'shipsSunk', goal: 100, reward: { kind: 'flag', id: 'scourge', label: 'Black Scourge Flag' } },
  { id: 'pirateHunter', name: 'Pirate Hunter', desc: 'Sink 25 pirate raiders', stat: 'pirateShipsSunk', goal: 25, reward: { kind: 'paint', id: 'navywhite', label: 'Admiralty White' } },
  { id: 'crewmate', name: 'Not Alone Anymore', desc: 'Recruit your first crew member', stat: 'crewHired', goal: 1 },
  { id: 'captain', name: 'A Proper Captain', desc: 'Recruit 10 crew members', stat: 'crewHired', goal: 10 },
  { id: 'legend', name: 'Crew of Legends', desc: 'Recruit 25 crew members', stat: 'crewHired', goal: 25, reward: { kind: 'figurehead', id: 'mermaid', label: 'Mermaid Figurehead' } },
  { id: 'lifesaver', name: 'Lifesaver', desc: 'Rescue 10 souls from the sea', stat: 'crewRescued', goal: 10 },
  { id: 'angler', name: 'Angler', desc: 'Catch 10 fish', stat: 'fishCaught', goal: 10 },
  { id: 'masterAngler', name: 'Master Angler', desc: 'Catch 100 fish', stat: 'fishCaught', goal: 100, reward: { kind: 'sail', id: 'wave', label: 'Wavecrest Sail' } },
  { id: 'looter', name: 'Beachcomber', desc: 'Loot 50 containers', stat: 'treasuresOpened', goal: 50 },
  { id: 'dragon', name: 'Dragon\'s Hoard', desc: 'Earn 10,000 gold', stat: 'goldEarned', goal: 10000, reward: { kind: 'paint', id: 'gold', label: 'Dragonhoard Gold' } },
  { id: 'wanderer', name: 'Wanderer', desc: 'Sail 100 leagues', stat: 'distanceSailed', goal: 100 },
  { id: 'circumnavigator', name: 'Circumnavigator', desc: 'Sail 1,000 leagues', stat: 'distanceSailed', goal: 1000, reward: { kind: 'lantern', id: 'aurora', label: 'Aurora Lantern' } },
  { id: 'cartographer', name: 'Cartographer', desc: 'Discover 50 islands', stat: 'islandsVisited', goal: 50 },
  { id: 'atlas', name: 'Living Atlas', desc: 'Discover 500 islands', stat: 'islandsVisited', goal: 500, reward: { kind: 'flag', id: 'atlas', label: 'Atlas Flag' } },
  { id: 'harbormaster', name: 'Harbormaster', desc: 'Discover 10 ports', stat: 'portsVisited', goal: 10 },
  { id: 'spelunker', name: 'Spelunker', desc: 'Clear 5 dungeons', stat: 'dungeonsCleared', goal: 5 },
  { id: 'boarder', name: 'Steel Meets Steel', desc: 'Win 10 boardings', stat: 'boardingsWon', goal: 10 },
  { id: 'contractor', name: 'Reliable Sort', desc: 'Complete 20 contracts', stat: 'questsDone', goal: 20 },
  { id: 'xmarks', name: 'X Marks the Spot', desc: 'Recover 10 charted treasures', stat: 'treasuresDug', goal: 10 },
  { id: 'legendSlayer', name: 'Into Legend', desc: 'Defeat 3 legends of the deep', stat: 'bossesDefeated', goal: 3, reward: { kind: 'figurehead', id: 'kraken', label: 'Kraken Figurehead' } },
  // collection-driven
  { id: 'biomes', name: 'Every Shore', desc: 'Discover every island biome', check: (g) => ['sand', 'palm', 'rock', 'jungle', 'coral'].every((b) => g.collection.has('locations', `biome:${b}`)) },
  { id: 'ichthyologist', name: 'Ichthyologist', desc: 'Catch every kind of fish', check: (g) => g.collection.progress('fish').n >= g.collection.progress('fish').total },
  { id: 'mythkeeper', name: 'Mythkeeper', desc: 'Find every legendary relic', check: (g) => g.collection.progress('relics').n >= g.collection.progress('relics').total, reward: { kind: 'sail', id: 'phoenix', label: 'Phoenix Sail Pattern' } },
  { id: 'legendarium', name: 'The Legendarium', desc: 'Witness every legend of the sea', check: (g) => g.collection.progress('bosses').n >= g.collection.progress('bosses').total },
];

export class Achievements {
  constructor(game, saved) {
    this.game = game;
    this.unlocked = new Set(saved ?? []);
    this._timer = 2;
  }

  update(dt) {
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = 1;
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked.has(a.id)) continue;
      const done = a.stat ? this.game.stats.get(a.stat) >= a.goal : a.check(this.game);
      if (done) this._unlock(a);
    }
  }

  progressFor(a) {
    if (!a.stat) return this.unlocked.has(a.id) ? 1 : 0;
    return Math.min(1, this.game.stats.get(a.stat) / a.goal);
  }

  _unlock(a) {
    this.unlocked.add(a.id);
    this.game.hud.toast(`Achievement: ${a.name}!`, '#f0d090');
    this.game.events.emit('sfx', 'victory');
    this.game.events.emit('achievement:unlocked', a);
    if (a.reward) {
      this.game.cosmetics.unlock(a.reward.kind, a.reward.id);
      this.game.hud.toast(`Unlocked: ${a.reward.label}`, '#f0a83c');
    }
  }

  serialize() {
    return [...this.unlocked];
  }
}
