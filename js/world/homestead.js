// The captain's private isle. A deed (bought in any port) claims a
// suitable wild island near that port. Structures are built at fixed
// plots with gold + materials, render on the island itself, and bring
// real perks: a warehouse (extra remote storage), a garden and pens
// (daily provisions), and a treasure room that displays your rarest
// finds as trophies.

import { dist2, TAU } from '../util/math.js';
import { Container } from '../items/inventory.js';
import { ITEMS, RARITY_ORDER } from '../items/itemdefs.js';
import { portHouseSprite } from '../render/sprites.js';

export const BUILDINGS = {
  house:     { name: 'Captain\'s House', cost: { gold: 400, wood: 20, stone: 8 }, desc: 'A roof of your own. Rest here to heal fully.' },
  dock:      { name: 'Private Dock', cost: { gold: 250, wood: 25 }, desc: 'A proper mooring. Repairs your ship while you visit.' },
  warehouse: { name: 'Warehouse', cost: { gold: 350, wood: 30, stone: 10 }, desc: '+16 storage slots, accessible here.' },
  treasury:  { name: 'Treasure Room', cost: { gold: 600, wood: 15, stone: 20 }, desc: 'Displays your six rarest treasures.' },
  garden:    { name: 'Garden', cost: { gold: 150, wood: 10 }, desc: 'Grows provisions: collect rations every day.' },
  pen:       { name: 'Animal Pen', cost: { gold: 200, wood: 15 }, desc: 'Chickens! Collect eggs (rations) and cheer daily.' },
  bonfire:   { name: 'Beacon Bonfire', cost: { gold: 100, wood: 12 }, desc: 'A light to sail home by, visible at night.' },
  statue:    { name: 'Captain\'s Statue', cost: { gold: 800, stone: 25 }, desc: 'Immortality, in modest pixel form.' },
};

// plot offsets from the island center (grass zone), per building
const PLOTS = {
  house: { x: 0, y: -14 }, warehouse: { x: -30, y: 4 }, treasury: { x: 28, y: 2 },
  garden: { x: -10, y: 22 }, pen: { x: 18, y: 24 }, bonfire: { x: -34, y: -20 }, statue: { x: 32, y: -20 },
};

export class Homestead {
  constructor(game, saved) {
    this.game = game;
    this.isle = saved?.isle ?? null; // { x, y, r, chunkKey, name }
    this.built = new Set(saved?.built ?? []);
    this.storage = new Container(16, saved?.storage);
    this.lastHarvestDay = saved?.lastHarvestDay ?? 0;
  }

  get owned() {
    return !!this.isle;
  }

  /** Claim a wild island near a port (called when the deed is bought). */
  claimNear(port) {
    const { game } = this;
    // deterministic search outward from the port for a mid-size, port-less island
    for (let r = 1; r < 14; r++) {
      for (let cx = -r; cx <= r; cx++) {
        for (const cy of [-r, r]) {
          for (const [dx, dy] of [[cx, cy], [cy, cx]]) {
            const ccx = game.world.chunkCoord(port.x) + dx;
            const ccy = game.world.chunkCoord(port.y) + dy;
            const key = `${ccx},${ccy}`;
            let chunk = game.world.getChunk(ccx, ccy);
            if (!chunk) {
              chunk = game.world._generate(ccx, ccy);
              game.world.chunks.set(key, chunk);
            }
            const isl = chunk.island;
            if (isl && !chunk.port && isl.r >= 55 && isl.r <= 100) {
              this.isle = {
                x: isl.x, y: isl.y, r: isl.r, chunkKey: key,
                name: `${game.appearance ? 'Captain\'s' : 'My'} Isle`,
              };
              game.mapData.markers.push({ x: isl.x, y: isl.y, home: true });
              game.collection.discover('locations', 'homestead');
              game.hud.toast(`The deed is yours! ${this.isle.name} is marked on your chart.`, '#f0a83c');
              game.events.emit('sfx', 'victory');
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  build(key) {
    const { game } = this;
    const b = BUILDINGS[key];
    if (!b || this.built.has(key)) return false;
    for (const [res, amt] of Object.entries(b.cost)) {
      const have = res === 'gold' ? game.resources.coins : game.inventory.totalCount(res);
      if (have < amt) return false;
    }
    for (const [res, amt] of Object.entries(b.cost)) {
      if (res === 'gold') game.resources.coins -= amt;
      else game.inventory.removeAnywhere(res, amt);
    }
    this.built.add(key);
    game.events.emit('resources:changed', { ...game.resources });
    game.events.emit('sfx', 'upgrade');
    game.hud.toast(`${b.name} built!`, '#6fce62');
    return true;
  }

  /** Player is moored at their isle. */
  isNear() {
    if (!this.isle) return false;
    return dist2(this.game.ship.x, this.game.ship.y, this.isle.x, this.isle.y)
      < (this.isle.r + 90) * (this.isle.r + 90);
  }

  /** Daily provisions from garden + pen. */
  harvest() {
    const { game } = this;
    const day = game.dayNight.day;
    if (day <= this.lastHarvestDay) return 0;
    const days = Math.min(3, day - this.lastHarvestDay);
    this.lastHarvestDay = day;
    let food = 0;
    if (this.built.has('garden')) food += days;
    if (this.built.has('pen')) food += days;
    if (food > 0) {
      game.inventory.addAnywhere('food', food);
      game.hud.toast(`Your isle provided ${food} rations.`, '#6fce62');
      game.events.emit('sfx', 'coin');
    }
    return food;
  }

  /** Perks applied while visiting. */
  onVisit() {
    const { game } = this;
    if (this.built.has('house') && game.player.health < game.player.maxHealth) {
      game.player.health = game.player.maxHealth;
      game.events.emit('player:changed');
      game.hud.toast('Home. You rest, and the sea waits.', '#6fce62');
    }
    if (this.built.has('dock')) {
      game.shipState.repair(game.shipState.maxHull);
    }
    this.harvest();
  }

  /** Six rarest owned items for the treasure room display. */
  trophies() {
    const all = [];
    const seen = new Set();
    const scan = (cont) => {
      for (const s of cont.slots) {
        if (s && !seen.has(s.id)) {
          seen.add(s.id);
          all.push(s.id);
        }
      }
    };
    scan(this.game.inventory.backpack);
    scan(this.game.inventory.cargo);
    scan(this.storage);
    for (const id of Object.values(this.game.inventory.equipment)) {
      if (id && !seen.has(id)) {
        seen.add(id);
        all.push(id);
      }
    }
    return all
      .sort((a, b) => RARITY_ORDER.indexOf(ITEMS[b].rarity) - RARITY_ORDER.indexOf(ITEMS[a].rarity))
      .slice(0, 6);
  }

  /* ---- rendering: buildings live on the island ------------------------ */

  collectSurfaceDrawables(out, t) {
    if (!this.isle) return;
    const { x: ix, y: iy } = this.isle;
    if (dist2(ix, iy, this.game.ship.x, this.game.ship.y) > 900 * 900) return;

    for (const key of this.built) {
      const plot = PLOTS[key];
      if (!plot) continue;
      const bx = ix + plot.x;
      const by = iy + plot.y;
      out.push({
        y: by,
        draw: (g) => this._drawBuilding(g, key, bx, by, t),
      });
    }
    // claim flag even before anything is built
    out.push({
      y: iy - 30,
      draw: (g) => {
        g.fillStyle = '#5a3a20';
        g.fillRect(Math.round(ix), Math.round(iy - 44), 2, 16);
        const wave = Math.sin(t * 3) * 1.5;
        g.fillStyle = '#8e2f2f';
        g.beginPath();
        g.moveTo(ix + 2, iy - 44);
        g.lineTo(ix + 12 + wave, iy - 41);
        g.lineTo(ix + 2, iy - 38);
        g.fill();
      },
    });
  }

  _drawBuilding(g, key, x, y, t) {
    switch (key) {
      case 'house': {
        const spr = portHouseSprite(0);
        g.drawImage(spr, Math.round(x - 10), Math.round(y - 16));
        break;
      }
      case 'warehouse': {
        g.fillStyle = '#8a6f4a';
        g.fillRect(Math.round(x - 11), Math.round(y - 12), 22, 13);
        g.fillStyle = '#54432c';
        g.fillRect(Math.round(x - 12), Math.round(y - 15), 24, 4);
        g.fillStyle = '#42332a';
        g.fillRect(Math.round(x - 3), Math.round(y - 8), 6, 9);
        break;
      }
      case 'treasury': {
        g.fillStyle = '#9aa0a0';
        g.fillRect(Math.round(x - 9), Math.round(y - 12), 18, 13);
        g.fillStyle = '#b8bebc';
        g.fillRect(Math.round(x - 10), Math.round(y - 14), 20, 3);
        g.fillStyle = '#e0b345';
        g.fillRect(Math.round(x - 2), Math.round(y - 9), 4, 10);
        const tw = Math.sin(t * 4 + x) > 0.6;
        if (tw) {
          g.fillStyle = '#fff2c8';
          g.fillRect(Math.round(x + 5), Math.round(y - 11), 1, 1);
        }
        break;
      }
      case 'garden': {
        g.fillStyle = '#5a4632';
        g.fillRect(Math.round(x - 10), Math.round(y - 6), 20, 10);
        for (let i = 0; i < 4; i++) {
          const sway = Math.sin(t * 1.5 + i) * 0.5;
          g.fillStyle = i % 2 ? '#5dae5a' : '#6fce62';
          g.fillRect(Math.round(x - 7 + i * 4 + sway), Math.round(y - 4), 2, 4);
          if (i % 2) {
            g.fillStyle = '#e0b345';
            g.fillRect(Math.round(x - 7 + i * 4 + sway), Math.round(y - 5), 1, 1);
          }
        }
        break;
      }
      case 'pen': {
        g.fillStyle = '#7a5a34';
        g.strokeStyle = '#7a5a34';
        g.lineWidth = 1;
        g.strokeRect(Math.round(x - 9), Math.round(y - 7), 18, 11);
        // chickens
        for (let i = 0; i < 2; i++) {
          const cx = x - 4 + i * 7 + Math.sin(t * 1.2 + i * 3) * 2;
          g.fillStyle = '#eef2f4';
          g.fillRect(Math.round(cx), Math.round(y - 3), 3, 3);
          g.fillStyle = '#e05a3c';
          g.fillRect(Math.round(cx + (i ? 3 : -1)), Math.round(y - 3), 1, 1);
        }
        break;
      }
      case 'bonfire': {
        g.fillStyle = '#5d6165';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          g.fillRect(Math.round(x + Math.cos(a) * 5), Math.round(y + Math.sin(a) * 3), 2, 2);
        }
        const f = Math.abs(Math.sin(t * 8 + x));
        g.fillStyle = '#e05a3c';
        g.fillRect(Math.round(x - 1), Math.round(y - 5 - f * 2), 3, 4 + f * 2);
        g.fillStyle = '#f0a83c';
        g.fillRect(Math.round(x), Math.round(y - 4 - f), 1, 3);
        if (this.game.dayNight.isNight) {
          g.fillStyle = `rgba(255,180,80,${0.15 + f * 0.08})`;
          g.beginPath();
          g.arc(x, y - 3, 22, 0, TAU);
          g.fill();
        }
        break;
      }
      case 'statue': {
        g.fillStyle = '#7e8388';
        g.fillRect(Math.round(x - 4), Math.round(y - 2), 9, 4); // plinth
        g.fillStyle = '#9aa0a6';
        g.fillRect(Math.round(x - 2), Math.round(y - 12), 5, 10); // figure
        g.fillRect(Math.round(x - 4), Math.round(y - 10), 2, 4); // arm out (pointing to sea)
        g.fillStyle = '#8a9098';
        g.fillRect(Math.round(x - 2), Math.round(y - 14), 5, 2); // hat
        break;
      }
      case 'dock': {
        // rendered toward the shore south of center
        for (let i = 0; i < 5; i++) {
          g.fillStyle = i % 2 ? '#96703f' : '#8a6438';
          g.fillRect(Math.round(x - 5), Math.round(y + 10 + i * 4), 10, 4);
        }
        break;
      }
    }
  }

  serialize() {
    return {
      isle: this.isle ? { ...this.isle } : null,
      built: [...this.built],
      storage: this.storage.serialize(),
      lastHarvestDay: this.lastHarvestDay,
    };
  }
}
