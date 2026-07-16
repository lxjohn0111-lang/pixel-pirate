// Floating collectibles: coins, wood, barrels, crates, treasure chests.
// Items live on their chunk (deterministically generated); this system
// handles bobbing, magnet attraction, pickup, rewards and feedback.

import { COLLECT } from '../core/constants.js';
import { dist2, lerp, damp } from '../util/math.js';
import { coinSprite, woodSprite, barrelSprite, crateSprite, chestSprite } from '../render/sprites.js';

const REWARDS = {
  coin:   (rng) => ({ coins: 2 + ((rng() * 5) | 0) }),
  wood:   (rng) => ({ wood: 2 + ((rng() * 3) | 0) }),
  barrel: (rng) => (rng() < 0.35 ? { wood: 3 + ((rng() * 3) | 0), coins: 1 + ((rng() * 3) | 0) } : { wood: 3 + ((rng() * 4) | 0) }),
  crate:  (rng) => ({ wood: 4 + ((rng() * 5) | 0) }),
  chest:  (rng) => ({ coins: 25 + ((rng() * 36) | 0) }),
};

const SFX = { coin: 'coin', chest: 'chest', wood: 'wood', barrel: 'wood', crate: 'wood' };

export class Collectibles {
  constructor(game) {
    this.game = game;
  }

  update(dt) {
    const { ship, world } = this.game;
    const magnet2 = COLLECT.magnetRadius * COLLECT.magnetRadius;
    const pickup2 = COLLECT.pickupRadius * COLLECT.pickupRadius;

    world.forEachChunkIn(ship.x - 300, ship.y - 300, 600, 600, (chunk) => {
      for (let i = chunk.items.length - 1; i >= 0; i--) {
        const item = chunk.items[i];
        const d2 = dist2(item.x, item.y, ship.x, ship.y);
        if (d2 < magnet2) {
          // Drift toward the ship — makes scooping loot feel effortless.
          const k = damp(6 * (1 - Math.sqrt(d2) / COLLECT.magnetRadius), dt);
          item.x = lerp(item.x, ship.x, k);
          item.y = lerp(item.y, ship.y, k);
        }
        if (d2 < pickup2) {
          chunk.items.splice(i, 1);
          this._collect(item);
        }
      }
    });
  }

  _collect(item) {
    const { world, resources, particles, events } = this.game;
    world.collected.add(item.id);
    const gains = REWARDS[item.type](Math.random);
    const labels = [];
    if (gains.coins) {
      resources.coins += gains.coins;
      labels.push([`+${gains.coins} gold`, '#f2d98a']);
    }
    if (gains.wood) {
      resources.wood += gains.wood;
      labels.push([`+${gains.wood} wood`, '#d9b98a']);
    }
    labels.forEach(([text, color], i) => particles.spawnText(item.x, item.y - 10 - i * 10, text, color));
    particles.burstCollect(
      item.x, item.y,
      item.type === 'coin' || item.type === 'chest' ? '240,205,90' : '217,185,138',
      item.type === 'chest' ? 18 : 9,
    );
    events.emit('collect', { type: item.type, x: item.x, y: item.y, gains });
    events.emit('resources:changed', { ...resources });
    events.emit('sfx', SFX[item.type]);
  }

  /** Draw all items in view. Called by the renderer inside world space. */
  draw(g, viewX, viewY, viewW, viewH, t) {
    const { world } = this.game;
    world.forEachChunkIn(viewX, viewY, viewW, viewH, (chunk) => {
      for (const item of chunk.items) {
        const bob = Math.sin(t * 1.8 + item.phase) * 1.5;
        const spr = this._sprite(item, t);
        const x = Math.round(item.x - spr.width / 2);
        const y = Math.round(item.y - spr.height / 2 + bob);
        // Water-line shadow sells the floating look.
        g.fillStyle = 'rgba(8,24,44,0.3)';
        g.fillRect(x + 1, Math.round(item.y + spr.height / 2 - 1 + bob * 0.4), spr.width - 2, 2);
        g.drawImage(spr, x, y);
      }
    });
  }

  _sprite(item, t) {
    if (item.type === 'coin') return coinSprite(((t * 6 + item.phase) | 0) % 4);
    if (item.type === 'wood') return woodSprite();
    if (item.type === 'barrel') return barrelSprite();
    if (item.type === 'crate') return crateSprite();
    return chestSprite();
  }
}
