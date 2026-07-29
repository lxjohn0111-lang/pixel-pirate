// Procedural world events. Every few minutes something stirs within
// rumor range of the player: convoys, ambushes, sea battles, treasure
// fleets, burning derelicts, blockades, haunted fog, great storms.
// A rumor toast + map ping point the way; what the player finds when
// they arrive is a real, simulated scene — or its aftermath.

import { TAU, dist2 } from '../util/math.js';
import { AIShip } from '../entities/aiship.js';
import { rollLoot } from '../items/itemdefs.js';
import { mulberry32, pick } from '../util/random.js';

const EVENT_DEFS = {
  convoy: {
    rumor: 'A merchant convoy is passing %DIR of here.',
    weight: 3,
    spawn(ev, game) {
      const lead = spawnShip(game, 'merchant', ev.x, ev.y);
      if (!lead) return false;
      for (let i = 0; i < 2; i++) {
        const s = spawnShip(game, i === 0 ? 'merchant' : 'civilian', ev.x - 70 - i * 50, ev.y + (i ? 40 : -40));
        if (s) {
          s.convoyLeader = lead;
          s.convoyOffset = i ? 45 : -45;
        }
      }
      game.collection.discover('ships', 'convoy');
      return true;
    },
  },
  ambush: {
    rumor: 'Cannon fire heard %DIR — raiders on a fat merchant!',
    weight: 3,
    spawn(ev, game) {
      const prey = spawnShip(game, 'merchant', ev.x, ev.y);
      if (!prey) return false;
      for (let i = 0; i < 2; i++) {
        const p = spawnShip(game, 'pirate', ev.x + 140 + i * 40, ev.y + (i ? 60 : -60));
        if (p) p.foe = prey;
      }
      return true;
    },
  },
  seaBattle: {
    rumor: 'The navy has cornered pirates %DIR. Steel and smoke!',
    weight: 2.5,
    spawn(ev, game) {
      const p1 = spawnShip(game, 'pirate', ev.x, ev.y);
      const n1 = spawnShip(game, 'navy', ev.x + 160, ev.y + 40);
      const n2 = spawnShip(game, 'navy', ev.x + 120, ev.y - 90);
      if (n1 && p1) n1.foe = p1;
      if (n2 && p1) n2.foe = p1;
      return !!(p1 && n1);
    },
  },
  treasureFleet: {
    rumor: 'A TREASURE FLEET sails %DIR under heavy escort!',
    weight: 0.8,
    spawn(ev, game) {
      const lead = spawnShip(game, 'merchant', ev.x, ev.y);
      if (!lead) return false;
      lead.lootTable = 'treasure';
      lead.isTreasureFleet = true;
      lead.maxHull *= 1.5;
      lead.hull = lead.maxHull;
      const g1 = spawnShip(game, 'navy', ev.x - 80, ev.y - 50);
      const g2 = spawnShip(game, 'navy', ev.x - 80, ev.y + 50);
      for (const gr of [g1, g2]) {
        if (gr) {
          gr.convoyLeader = lead;
          gr.convoyOffset = gr === g1 ? -55 : 55;
          gr.guardsFleet = true;
        }
      }
      game.collection.discover('ships', 'treasureFleet');
      return true;
    },
  },
  burningShip: {
    rumor: 'Smoke on the horizon %DIR... a ship burns.',
    weight: 2.5,
    spawn(ev, game) {
      // A doomed derelict: it burns, then sinks, leaving loot & a survivor.
      const s = spawnShip(game, pick(Math.random, ['merchant', 'civilian']), ev.x, ev.y);
      if (!s) return false;
      s.hull = s.maxHull * 0.22; // already ablaze
      s.speed = 0;
      s.maxSpeed = 4;
      s.burningWreck = true;
      ev.shipId = s.id;
      return true;
    },
    tick(ev, game, dt) {
      const s = game.combat.ships.find((x) => x.id === ev.shipId);
      if (!s || s.state !== 'sailing') return;
      s.hull -= dt * 1.5; // the fire wins eventually
      if (s.hull <= 0) s.takeDamage(1, game, false);
    },
  },
  blockade: {
    rumor: 'The navy has thrown a blockade across the waters %DIR.',
    weight: 1.5,
    spawn(ev, game) {
      let ok = false;
      for (let i = 0; i < 3; i++) {
        const n = spawnShip(game, 'navy', ev.x + (i - 1) * 130, ev.y + (i % 2) * 60);
        if (n) {
          n.waypoint = { x: ev.x + (i - 1) * 130, y: ev.y };
          n.maxSpeed *= 0.4; // holding station
          ok = true;
        }
      }
      return ok;
    },
  },
  hauntedFog: {
    rumor: 'Fishermen refuse to sail %DIR. They speak of singing fog.',
    weight: 1.2,
    spawn(ev, game) {
      ev.fog = true;
      ev.radius = 420;
      // Something waits inside the fog...
      if (Math.random() < 0.6) {
        const gs = spawnShip(game, 'ghost', ev.x, ev.y);
        if (gs) {
          gs.hostileToPlayer = true;
          game.events.emit('legend:sighted');
        }
      }
      return true;
    },
  },
  greatStorm: {
    rumor: 'Barometers are plunging. A great storm brews %DIR.',
    weight: 1.5,
    spawn(ev, game) {
      ev.storm = true;
      ev.radius = 700;
      return true;
    },
    tick(ev, game) {
      // Inside the event zone the weather is forced foul; wrecks and
      // flotsam wash up in its wake (loot spawns while it rages).
      const d2p = dist2(game.ship.x, game.ship.y, ev.x, ev.y);
      if (d2p < ev.radius * ev.radius) {
        if (game.weather.current !== 'storm') {
          game.weather.current = 'storm';
          game.weather.next = 'storm';
          game.weather.blend = 1;
          game.weather.timer = Math.max(game.weather.timer, 20);
        }
        if (Math.random() < 0.004 && game.combat.drops.length < 14) {
          const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
          const a = Math.random() * TAU;
          const dd = 120 + Math.random() * 260;
          game.combat.drops.push({
            x: game.ship.x + Math.cos(a) * dd,
            y: game.ship.y + Math.sin(a) * dd,
            kind: 'crate', age: 0,
            loot: rollLoot(rng, 'wreck', game.player.luck),
          });
        }
      }
    },
  },
  treasureRumor: {
    rumor: 'An old salt swears there is treasure %DIR. His map checks out.',
    weight: 1.8,
    spawn(ev, game) {
      const tr = game.encounters.chartTreasure();
      tr.x = ev.x;
      tr.y = ev.y;
      return true;
    },
  },
};

function spawnShip(game, type, x, y) {
  if (!game.world.isOpenWater(x, y)) {
    x += 120;
    y += 120;
    if (!game.world.isOpenWater(x, y)) return null;
  }
  const s = new AIShip(type, x, y, game.tierAt(x, y));
  // Event fleets fly colours too — a blockade of unaffiliated hulls
  // would be the one place in the world where clans stopped existing.
  game.combat.assignClan(s, x, y);
  game.combat.ships.push(s);
  return s;
}

export class WorldEvents {
  constructor(game) {
    this.game = game;
    this.active = [];
    this._timer = 45 + Math.random() * 40;
  }

  update(dt) {
    const { game } = this;
    this._timer -= dt;
    if (this._timer <= 0 && this.active.length < 2) {
      this._timer = 100 + Math.random() * 120;
      this._spawnEvent();
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const ev = this.active[i];
      ev.life -= dt;
      EVENT_DEFS[ev.kind].tick?.(ev, game, dt);
      if (ev.life <= 0 || dist2(ev.x, ev.y, game.ship.x, game.ship.y) > 2600 * 2600) {
        this.active.splice(i, 1);
      }
    }
  }

  _spawnEvent() {
    const { game } = this;
    // ghostTide daily modifier makes eerie events likelier
    const ghostBoost = game.daily?.modifier?.legends ? 2 : 1;
    const entries = Object.entries(EVENT_DEFS);
    let total = 0;
    const weights = entries.map(([k, d]) => {
      const w = d.weight * (k === 'hauntedFog' ? ghostBoost : 1);
      total += w;
      return w;
    });
    let r = Math.random() * total;
    let kind = entries[0][0];
    for (let i = 0; i < entries.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        kind = entries[i][0];
        break;
      }
    }

    const a = Math.random() * TAU;
    const d = 650 + Math.random() * 500;
    const ev = {
      kind,
      x: Math.round(game.ship.x + Math.cos(a) * d),
      y: Math.round(game.ship.y + Math.sin(a) * d),
      life: 240,
    };
    if (!EVENT_DEFS[kind].spawn(ev, game)) return;
    this.active.push(ev);

    const dir = this._dirName(a);
    game.hud.toast(EVENT_DEFS[kind].rumor.replace('%DIR', dir), '#9cc3ea');
    game.events.emit('sfx', 'quest');
    game.events.emit('worldevent:spawned', { kind, x: ev.x, y: ev.y });
  }

  _dirName(angle) {
    const dirs = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
    const idx = Math.round((((angle % TAU) + TAU) % TAU) / (TAU / 8)) % 8;
    return `to the ${dirs[idx]}`;
  }

  /** Fog patches render as thick local fog (drawn by the renderer). */
  fogAt(x, y) {
    for (const ev of this.active) {
      if (!ev.fog) continue;
      const d = Math.sqrt(dist2(x, y, ev.x, ev.y));
      if (d < ev.radius) return 1 - d / ev.radius;
    }
    return 0;
  }
}
