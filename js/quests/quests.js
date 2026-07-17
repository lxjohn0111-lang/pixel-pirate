// Procedural contracts, offered in port taverns. Five templates:
// deliver cargo, hunt a pirate, rescue a survivor, gather resources,
// recover charted treasure. Progress is observed through the EventBus —
// quests never reach into the systems that fulfil them.

import { mulberry32, pick, range, rangeInt } from '../util/random.js';
import { AIShip } from '../entities/aiship.js';
import { TAU, dist2 } from '../util/math.js';

let nextQuestId = 1;

export const MAX_ACTIVE = 3;

export class Quests {
  constructor(game, saved) {
    this.game = game;
    this.active = saved?.map((q) => ({ ...q })) ?? [];
    for (const q of this.active) {
      nextQuestId = Math.max(nextQuestId, (parseInt(q.id.slice(1), 10) || 0) + 1);
    }

    game.events.on('ship:sunk', (e) => {
      if (!e.byPlayer) return;
      for (const q of this.active) {
        if (q.type === 'hunt' && q.state === 'active' && e.type === 'pirate'
          && dist2(e.x, e.y, q.x, q.y) < 900 * 900) {
          this._complete(q);
          break;
        }
      }
    });
    game.events.on('survivor:rescued', (e) => {
      for (const q of this.active) {
        if (q.type === 'rescue' && q.state === 'active' && dist2(e.x, e.y, q.x, q.y) < 700 * 700) {
          this._complete(q);
          break;
        }
      }
    });
    game.events.on('treasure:recovered', (e) => {
      const q = this.active.find((q) => q.id === e.questId);
      if (q) this._complete(q);
    });
    game.events.on('port:docked', (port) => {
      for (const q of [...this.active]) {
        if (q.type === 'deliver' && q.state === 'active' && q.targetPort === port.name) {
          this._complete(q);
        }
      }
    });
  }

  /** Contracts on offer at a port today (deterministic per port + day). */
  offersAt(port) {
    const { game } = this;
    const rng = mulberry32((port.seed ^ (game.dayNight.day * 0x9e37)) >>> 0);
    const offers = [];
    const knownPorts = game.mapData.ports.filter((p) => p.name !== port.name);
    const types = ['hunt', 'rescue', 'collect', 'treasure'];
    if (knownPorts.length > 0) types.push('deliver', 'deliver');
    for (let i = 0; i < 3; i++) {
      const type = pick(rng, types);
      offers.push(this._makeOffer(type, port, rng, knownPorts));
    }
    return offers;
  }

  _makeOffer(type, port, rng, knownPorts) {
    const { game } = this;
    const tier = game.tierAt(port.x, port.y);
    const a = rng() * TAU;
    const d = range(rng, 800, 1800);
    const x = Math.round(port.x + Math.cos(a) * d);
    const y = Math.round(port.y + Math.sin(a) * d);
    const goldBase = 60 + tier * 40;

    switch (type) {
      case 'hunt':
        return {
          type, x, y,
          name: 'Bounty: Pirate Raider',
          desc: 'A raider preys on shipping lanes nearby. Sink it.',
          reward: { gold: goldBase + rangeInt(rng, 20, 60), xp: 40 + tier * 15 },
        };
      case 'rescue':
        return {
          type, x, y,
          name: 'Missing Sailor',
          desc: 'A deckhand went overboard in last night’s squall. Find them.',
          reward: { gold: Math.round(goldBase * 0.7) + rangeInt(rng, 10, 30), xp: 30 + tier * 10 },
        };
      case 'collect': {
        const want = pick(rng, [['wood', 12], ['iron', 6], ['spices', 4], ['gunpowder', 6]]);
        return {
          type,
          itemId: want[0],
          qty: want[1],
          name: `Supply Run: ${want[1]}x ${want[0][0].toUpperCase() + want[0].slice(1)}`,
          desc: 'The harbormaster pays well for materials. Deliver to any tavern.',
          reward: { gold: goldBase + rangeInt(rng, 10, 50), xp: 25 + tier * 8 },
        };
      }
      case 'treasure':
        return {
          type,
          name: 'Rumored Treasure',
          desc: 'A drunk navigator swears by this heading. Recover what’s out there.',
          reward: { gold: Math.round(goldBase * 0.5), xp: 50 + tier * 15 },
        };
      case 'deliver': {
        const target = pick(rng, knownPorts);
        return {
          type,
          targetPort: target.name,
          x: target.x,
          y: target.y,
          name: `Deliver Cargo: ${target.name}`,
          desc: `Haul a sealed consignment to ${target.name}. No questions.`,
          reward: { gold: goldBase + rangeInt(rng, 30, 80), xp: 35 + tier * 10 },
        };
      }
      default:
        return null;
    }
  }

  accept(offer, port) {
    if (this.active.length >= MAX_ACTIVE) return false;
    const q = {
      ...offer,
      id: `q${nextQuestId++}`,
      state: 'active',
      originPort: port.name,
      spawned: false,
    };
    if (q.type === 'treasure') {
      const tr = this.game.encounters.chartTreasure(q.id);
      q.x = tr.x;
      q.y = tr.y;
    }
    this.active.push(q);
    this.game.events.emit('quests:changed');
    this.game.events.emit('sfx', 'quest');
    return true;
  }

  /** Turn-in check for collect quests (called from the tavern UI). */
  tryTurnIn(q) {
    const { game } = this;
    if (q.type !== 'collect' || game.inventory.totalCount(q.itemId) < q.qty) return false;
    game.inventory.removeAnywhere(q.itemId, q.qty);
    this._complete(q);
    return true;
  }

  _complete(q) {
    const { game } = this;
    q.state = 'done';
    this.active.splice(this.active.indexOf(q), 1);
    game.resources.coins += q.reward.gold;
    game.player.addXp(q.reward.xp);
    game.events.emit('resources:changed', { ...game.resources });
    game.events.emit('quest:completed', { ...q, faction: q.type === 'hunt' ? 'navy' : 'merchants' });
    game.events.emit('quests:changed');
    game.events.emit('sfx', 'quest');
    game.hud.toast(`Contract complete: ${q.name} (+${q.reward.gold} gold)`, '#6fce62');
  }

  update() {
    const { game } = this;
    // Bounty targets materialize when the player closes in on the mark.
    for (const q of this.active) {
      if (q.type === 'hunt' && !q.spawned
        && dist2(q.x, q.y, game.ship.x, game.ship.y) < 550 * 550) {
        q.spawned = true;
        if (game.world.isOpenWater(q.x, q.y)) {
          const s = new AIShip('pirate', q.x, q.y, game.tierAt(q.x, q.y) + 1);
          s.hostileToPlayer = true;
          s.isQuestTarget = true;
          game.combat.ships.push(s);
        }
      }
      if (q.type === 'rescue' && !q.spawned
        && dist2(q.x, q.y, game.ship.x, game.ship.y) < 500 * 500) {
        q.spawned = true;
        // Guarantee a survivor at the mark (regular chunk gen may not have one).
        const cx = game.world.chunkCoord(q.x);
        const cy = game.world.chunkCoord(q.y);
        const chunk = game.world.getChunk(cx, cy);
        if (chunk) {
          let x = q.x;
          let y = q.y;
          let tries = 0;
          while (!game.world.isOpenWater(x, y) && tries++ < 30) {
            x = q.x + (Math.random() - 0.5) * 300;
            y = q.y + (Math.random() - 0.5) * 300;
          }
          chunk.encounters = chunk.encounters ?? [];
          chunk.encounters.push({
            kind: 'survivor', id: `quest:${q.id}`, x, y,
            seed: (Math.random() * 0xffffffff) >>> 0,
            searched: false,
          });
          q.x = x;
          q.y = y;
        }
      }
    }
  }

  /** Nearest active objective with a location (for the HUD guide arrow). */
  trackedTarget() {
    let best = null;
    let bestD = Infinity;
    for (const q of this.active) {
      if (q.x === undefined) continue;
      const d = dist2(q.x, q.y, this.game.ship.x, this.game.ship.y);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return best;
  }

  serialize() {
    return this.active.map((q) => ({ ...q }));
  }
}
