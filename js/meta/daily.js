// Daily content, seeded by the real-world date so every player shares
// the same rotation: a daily quest, a weekly challenge, a world modifier
// and a free daily treasure chart.

import { mulberry32, hashString, pick } from '../util/random.js';

export const MODIFIERS = {
  tailwinds:   { name: 'Tailwinds', desc: 'The winds favor all sails. +10% ship speed.', speed: 1.1 },
  luckyTides:  { name: 'Lucky Tides', desc: 'Fortune floats today. +3 luck.', luck: 3 },
  pirateMoon:  { name: 'Pirate Moon', desc: 'Raiders swarm the lanes. More pirates, better bounty loot.', pirates: true },
  richWaters:  { name: 'Rich Waters', desc: 'Fish practically leap aboard. Faster bites.', fishing: true },
  navyManeuvers: { name: 'Navy Maneuvers', desc: 'The fleet is out in force. More patrols.', navy: true },
  merchantFair: { name: 'Merchant Fair', desc: 'Ports celebrate. 15% better shop prices.', prices: 0.85 },
  ghostTide:   { name: 'Ghost Tide', desc: 'The veil is thin tonight. Strange sightings multiply.', legends: true },
};

const DAILY_QUESTS = [
  { id: 'sinkPirates', name: 'Clear the Lanes', desc: 'Sink 3 pirate raiders', stat: 'pirateShipsSunk', goal: 3, gold: 180, xp: 60 },
  { id: 'catchFish', name: 'Fresh Catch', desc: 'Catch 5 fish', stat: 'fishCaught', goal: 5, gold: 120, xp: 40 },
  { id: 'lootBoxes', name: 'Salvage Run', desc: 'Loot 6 containers', stat: 'treasuresOpened', goal: 6, gold: 140, xp: 45 },
  { id: 'sailFar', name: 'Stretch the Sails', desc: 'Sail 15 leagues', stat: 'distanceSailed', goal: 15, gold: 100, xp: 35 },
  { id: 'winBoard', name: 'Take the Deck', desc: 'Win 2 boardings', stat: 'boardingsWon', goal: 2, gold: 200, xp: 70 },
];

const WEEKLY_CHALLENGES = [
  { id: 'wkSink', name: 'Terror of the Week', desc: 'Sink 15 ships', stat: 'shipsSunk', goal: 15, gold: 600, xp: 220 },
  { id: 'wkTreasure', name: 'The Great Dig', desc: 'Recover 4 charted treasures', stat: 'treasuresDug', goal: 4, gold: 700, xp: 260 },
  { id: 'wkQuests', name: 'Guild Favorite', desc: 'Complete 8 contracts', stat: 'questsDone', goal: 8, gold: 650, xp: 240 },
  { id: 'wkDungeon', name: 'Depth Delver', desc: 'Clear 3 dungeons', stat: 'dungeonsCleared', goal: 3, gold: 800, xp: 300 },
];

export class Daily {
  constructor(game, saved) {
    this.game = game;
    this.state = saved ?? {}; // { dateKey, weekKey, dailyBase, weeklyBase, dailyDone, weeklyDone, chartClaimed }
    this._refresh();
  }

  get dateKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  }

  get weekKey() {
    const d = new Date();
    const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay() + 1) / 7);
    return `${d.getUTCFullYear()}-w${week}`;
  }

  _refresh() {
    const dk = this.dateKey;
    if (this.state.dateKey !== dk) {
      const rng = mulberry32(hashString(dk));
      this.state.dateKey = dk;
      this.state.dailyId = pick(rng, DAILY_QUESTS).id;
      this.state.modifierId = pick(rng, Object.keys(MODIFIERS));
      this.state.dailyBase = null; // captured lazily from stats at first sight
      this.state.dailyDone = false;
      this.state.chartClaimed = false;
    }
    const wk = this.weekKey;
    if (this.state.weekKey !== wk) {
      const rng = mulberry32(hashString(wk));
      this.state.weekKey = wk;
      this.state.weeklyId = pick(rng, WEEKLY_CHALLENGES).id;
      this.state.weeklyBase = null;
      this.state.weeklyDone = false;
    }
  }

  get daily() {
    return DAILY_QUESTS.find((q) => q.id === this.state.dailyId) ?? DAILY_QUESTS[0];
  }

  get weekly() {
    return WEEKLY_CHALLENGES.find((q) => q.id === this.state.weeklyId) ?? WEEKLY_CHALLENGES[0];
  }

  get modifier() {
    return MODIFIERS[this.state.modifierId] ?? MODIFIERS.tailwinds;
  }

  progress(kind) {
    const q = kind === 'daily' ? this.daily : this.weekly;
    const baseKey = kind === 'daily' ? 'dailyBase' : 'weeklyBase';
    if (this.state[baseKey] === null || this.state[baseKey] === undefined) {
      this.state[baseKey] = this.game.stats.get(q.stat);
    }
    return Math.max(0, this.game.stats.get(q.stat) - this.state[baseKey]);
  }

  update() {
    this._refresh();
    for (const kind of ['daily', 'weekly']) {
      const doneKey = kind === 'daily' ? 'dailyDone' : 'weeklyDone';
      if (this.state[doneKey]) continue;
      const q = kind === 'daily' ? this.daily : this.weekly;
      if (this.progress(kind) >= q.goal) {
        this.state[doneKey] = true;
        this.game.resources.coins += q.gold;
        this.game.player.addXp(q.xp);
        this.game.events.emit('resources:changed', { ...this.game.resources });
        this.game.hud.toast(`${kind === 'daily' ? 'Daily' : 'Weekly'} complete: ${q.name}! +${q.gold} gold`, '#f0d090');
        this.game.events.emit('sfx', 'victory');
      }
    }
  }

  /** One free treasure chart per day, claimed from the Log panel. */
  claimChart() {
    if (this.state.chartClaimed) return false;
    this.state.chartClaimed = true;
    this.game.encounters.chartTreasure();
    this.game.hud.toast('Today\'s treasure has been charted!', '#f0a83c');
    this.game.events.emit('sfx', 'quest');
    return true;
  }

  serialize() {
    return { ...this.state };
  }
}
