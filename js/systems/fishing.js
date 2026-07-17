// Fishing. Slow the ship, press R to cast, wait for the tug, hit F (or
// R) inside the bite window. What bites depends on where you are (biome
// of the nearest island vs open sea), the hour, the weather and the
// season — with legendary fish for the patient and the lucky.

import { TAU, dist2 } from '../util/math.js';
import { ITEMS } from '../items/itemdefs.js';
import { COLLECTION } from '../meta/collection.js';

export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

// Conditions: biome (nearest island biome or 'open'), time ('day'|'night'),
// weather ('rain' needs rain), season index. Missing key = any.
const FISH = [
  { id: 'sardine',        weight: 30 },
  { id: 'mackerel',       weight: 24 },
  { id: 'grouper',        weight: 12, biome: ['rock', 'jungle', 'coral'] },
  { id: 'parrotfish',     weight: 12, biome: ['coral', 'palm', 'sand'] },
  { id: 'tuna',           weight: 8,  biome: ['open'] },
  { id: 'swordfish',      weight: 6,  biome: ['open'], time: 'day' },
  { id: 'moonfish',       weight: 5,  time: 'night' },
  { id: 'stormkoi',       weight: 5,  weather: 'rain' },
  { id: 'midnightMarlin', weight: 1.6, biome: ['open'], time: 'night', season: [2, 3] },
  { id: 'goldenKingfish', weight: 0.5, time: 'day', season: [1] },
];

// Register the fish in the collection book.
for (const f of FISH) COLLECTION.fish.entries[f.id] = null;
Object.keys(COLLECTION.fish.entries).forEach((id) => {
  COLLECTION.fish.entries[id] = ITEMS[id]?.name ?? id;
});

export class Fishing {
  constructor(game) {
    this.game = game;
    this.state = 'idle'; // idle | waiting | bite | reeling(anim)
    this.timer = 0;
    this.biteWindow = 0;
    this.bobber = null;
  }

  get season() {
    return (this.game.dayNight.day - 1) % 4;
  }

  get canCast() {
    const g = this.game;
    return this.state === 'idle' && Math.abs(g.ship.speed) < 18 && !g.uiBlocked && !g.boarding.active;
  }

  cast() {
    const g = this.game;
    if (!this.canCast) {
      if (Math.abs(g.ship.speed) >= 18) g.hud.toast('Too fast to fish — slow the ship', '#e0b345');
      return;
    }
    const a = g.ship.heading + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    this.bobber = {
      x: g.ship.x + Math.cos(a) * 26,
      y: g.ship.y + Math.sin(a) * 26,
    };
    this.state = 'waiting';
    const fast = g.daily?.modifier?.fishing;
    this.timer = (fast ? 1.5 : 2.5) + Math.random() * (fast ? 3 : 5);
    g.events.emit('sfx', 'cast');
    g.particles.splashRing(this.bobber.x, this.bobber.y, 2);
  }

  update(dt) {
    const g = this.game;
    if (this.state === 'idle') {
      if (g.input.pressed('KeyR') && this.canCast) this.cast();
      return;
    }

    // reel in / cancel if the ship moves off
    if (Math.abs(g.ship.speed) > 40 || dist2(g.ship.x, g.ship.y, this.bobber.x, this.bobber.y) > 90 * 90) {
      this._reset();
      return;
    }

    this.timer -= dt;
    if (this.state === 'waiting') {
      // idle ripples
      if (Math.random() < dt * 1.2) g.particles.splashRing(this.bobber.x, this.bobber.y, 1.5);
      if (g.input.pressed('KeyR') || g.input.pressed('KeyF')) {
        // reeled too early
        this._reset();
        g.hud.toast('Nothing yet...', '#9cc3ea');
        return;
      }
      if (this.timer <= 0) {
        this.state = 'bite';
        this.biteWindow = 0.9;
        g.events.emit('sfx', 'bite');
        g.particles.burstSplash(this.bobber.x, this.bobber.y, 6);
      }
    } else if (this.state === 'bite') {
      this.biteWindow -= dt;
      if (g.input.pressed('KeyR') || g.input.pressed('KeyF')) {
        this._catch();
      } else if (this.biteWindow <= 0) {
        this._reset();
        g.hud.toast('It slipped the hook!', '#e0b345');
        g.events.emit('sfx', 'splash');
      }
    }
  }

  _catch() {
    const g = this.game;
    const fish = this._roll();
    this._reset();
    const def = ITEMS[fish];
    const left = g.inventory.addAnywhere(fish, 1);
    if (left > 0) {
      g.hud.toast('No room for the catch!', '#e05a4a');
      return;
    }
    g.events.emit('fish:caught', { id: fish });
    g.collection.discover('fish', fish);
    g.particles.burstCollect(g.ship.x, g.ship.y - 10, '90,165,240', 8);
    g.particles.spawnText(g.ship.x, g.ship.y - 22, `${def.name}!`, ['legendary', 'mythic'].includes(def.rarity) ? '#f0a83c' : '#9cc3ea');
    g.events.emit('sfx', ['legendary', 'mythic'].includes(def.rarity) ? 'victory' : 'coin');
    if (def.rarity === 'legendary' || def.rarity === 'mythic') {
      g.hud.toast(`A ${def.name}! The catch of a lifetime!`, '#f0a83c');
    }
  }

  _roll() {
    const g = this.game;
    // context
    let biome = 'open';
    let bestD = 300 * 300;
    for (const chunk of g.world.chunks.values()) {
      if (!chunk.island) continue;
      const d = dist2(chunk.island.x, chunk.island.y, g.ship.x, g.ship.y);
      if (d < bestD) {
        bestD = d;
        biome = chunk.island.biome;
      }
    }
    const time = g.dayNight.isNight ? 'night' : 'day';
    const raining = g.weather.rain > 0.2;
    const season = this.season;
    const luck = 1 + (g.player.luck + g.crew.bonuses().luck) * 0.05;

    let total = 0;
    const weights = FISH.map((f) => {
      if (f.biome && !f.biome.includes(biome)) return 0;
      if (f.time && f.time !== time) return 0;
      if (f.weather === 'rain' && !raining) return 0;
      if (f.season && !f.season.includes(season)) return 0;
      const rare = ['rare', 'epic', 'legendary', 'mythic'].includes(ITEMS[f.id].rarity);
      const w = f.weight * (rare ? luck : 1);
      total += w;
      return w;
    });
    let r = Math.random() * total;
    for (let i = 0; i < FISH.length; i++) {
      r -= weights[i];
      if (r <= 0) return FISH[i].id;
    }
    return 'sardine';
  }

  _reset() {
    this.state = 'idle';
    this.bobber = null;
  }

  /** Bobber + line, drawn in world space. */
  draw(g, t) {
    if (!this.bobber) return;
    const game = this.game;
    const bx = this.bobber.x;
    const by = this.bobber.y + Math.sin(t * 3) * (this.state === 'bite' ? 2.5 : 1);
    g.strokeStyle = 'rgba(230,230,240,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(game.ship.x, game.ship.y - 6);
    g.quadraticCurveTo((game.ship.x + bx) / 2, (game.ship.y + by) / 2 + 6, bx, by);
    g.stroke();
    g.fillStyle = '#e05a4a';
    g.fillRect(Math.round(bx) - 1, Math.round(by) - 2, 3, 2);
    g.fillStyle = '#e8e4da';
    g.fillRect(Math.round(bx) - 1, Math.round(by), 3, 1);
    if (this.state === 'bite') {
      g.font = 'bold 10px monospace';
      g.fillStyle = Math.sin(t * 14) > 0 ? '#f0d090' : '#e05a4a';
      g.fillText('!', Math.round(bx) - 1, Math.round(by) - 6);
    }
  }
}
