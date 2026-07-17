// Lifetime statistics. Purely observational: everything arrives through
// the EventBus or cheap per-frame accumulation, so no gameplay system
// needs to know this exists.

export const STAT_LABELS = {
  distanceSailed: 'Distance Sailed (leagues)',
  shipsSunk: 'Ships Sunk',
  pirateShipsSunk: 'Pirates Sunk',
  goldEarned: 'Gold Earned',
  crewRescued: 'Crew Rescued',
  crewHired: 'Crew Hired',
  crewLost: 'Crew Lost',
  bossesDefeated: 'Legends Defeated',
  fishCaught: 'Fish Caught',
  treasuresOpened: 'Containers Looted',
  deaths: 'Defeats',
  timePlayed: 'Time Played',
  cannonShots: 'Cannonballs Fired',
  cannonHits: 'Cannonballs on Target',
  islandsVisited: 'Islands Discovered',
  portsVisited: 'Ports Discovered',
  dungeonsCleared: 'Dungeons Cleared',
  boardingsWon: 'Boardings Won',
  questsDone: 'Contracts Completed',
  treasuresDug: 'Treasures Recovered',
  legendarySeen: 'Legendary Sightings',
};

export class Stats {
  constructor(game, saved) {
    this.game = game;
    this.data = {};
    for (const k of Object.keys(STAT_LABELS)) this.data[k] = saved?.[k] ?? 0;
    this._lastX = null;
    this._lastY = null;
    this._distAcc = saved?._distAcc ?? 0;

    const ev = game.events;
    const inc = (k, n = 1) => this.add(k, n);
    ev.on('ship:sunk', (e) => {
      if (e.byPlayer) {
        inc('shipsSunk');
        if (e.type === 'pirate') inc('pirateShipsSunk');
      }
    });
    ev.on('loot:granted', (drops) => {
      if (drops.gold) inc('goldEarned', drops.gold);
      inc('treasuresOpened');
    });
    ev.on('resources:earned', (n) => inc('goldEarned', n));
    ev.on('survivor:rescued', () => inc('crewRescued'));
    ev.on('crew:hired', () => inc('crewHired'));
    ev.on('crew:died', () => inc('crewLost'));
    ev.on('boss:defeated', () => inc('bossesDefeated'));
    ev.on('fish:caught', () => inc('fishCaught'));
    ev.on('player:defeated', () => inc('deaths'));
    ev.on('playership:fired', (e) => inc('cannonShots', e?.count ?? 1));
    ev.on('cannon:hit', () => inc('cannonHits'));
    ev.on('dungeon:cleared', () => inc('dungeonsCleared'));
    ev.on('boarding:end', (e) => {
      if (e.outcome === 'win') inc('boardingsWon');
      if (e.outcome === 'loss') inc('deaths');
    });
    ev.on('quest:completed', () => inc('questsDone'));
    ev.on('treasure:recovered', () => inc('treasuresDug'));
    ev.on('legend:sighted', () => inc('legendarySeen'));
  }

  add(key, n = 1) {
    this.data[key] = (this.data[key] ?? 0) + n;
    this.game.events.emit('stats:changed', { key, value: this.data[key] });
  }

  get(key) {
    return this.data[key] ?? 0;
  }

  get accuracy() {
    return this.data.cannonShots > 0
      ? Math.round((this.data.cannonHits / this.data.cannonShots) * 100)
      : 0;
  }

  /** Per-frame accumulation (distance, playtime). */
  update(dt) {
    this.data.timePlayed += dt;
    const { ship } = this.game;
    if (this._lastX !== null) {
      const d = Math.hypot(ship.x - this._lastX, ship.y - this._lastY);
      if (d < 200) {
        // ignore teleports
        this._distAcc += d;
        if (this._distAcc >= 1000) {
          // 1 league = 1000 world px
          const leagues = Math.floor(this._distAcc / 1000);
          this._distAcc -= leagues * 1000;
          this.data.distanceSailed += leagues;
        }
      }
    }
    this._lastX = ship.x;
    this._lastY = ship.y;
    this.data.islandsVisited = this.game.mapData.islands.length;
    this.data.portsVisited = this.game.mapData.ports.length;
  }

  serialize() {
    return { ...this.data, _distAcc: this._distAcc };
  }
}
