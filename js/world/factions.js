// Factions & reputation. Every faction tracks standing from -100 to
// +100; player actions shift it through EventBus observers, and other
// systems read the standing to decide hostility, prices and aid.

import { clamp } from '../util/math.js';

export const FACTIONS = {
  pirates:   { name: 'Brethren of the Coast', color: '#c9506a', desc: 'Raiders, cutthroats and free souls.' },
  navy:      { name: 'Royal Navy', color: '#5aa5f0', desc: 'Order at sea, by decree and by cannon.' },
  merchants: { name: 'Merchant Guild', color: '#e0b345', desc: 'Coin moves the world. They move the coin.' },
  smugglers: { name: 'Night Runners', color: '#b46ef0', desc: 'Everything has a price, especially secrets.' },
  explorers: { name: 'Horizon Society', color: '#6fce62', desc: 'Chartmakers chasing the edge of the map.' },
  lostCiv:   { name: 'The Sunken Kingdom', color: '#4ec9b0', desc: 'Echoes of a drowned civilization.' },
};

const STANDING_LABELS = [
  [-60, 'Hunted'], [-25, 'Hostile'], [-5, 'Unfriendly'], [20, 'Neutral'],
  [55, 'Friendly'], [90, 'Honored'], [101, 'Legendary'],
];

export class Factions {
  constructor(game, saved) {
    this.game = game;
    this.rep = { pirates: 0, navy: 0, merchants: 0, smugglers: 0, explorers: 0, lostCiv: 0, ...(saved ?? {}) };

    const ev = game.events;
    ev.on('ship:sunk', (e) => {
      if (!e.byPlayer) return;
      switch (e.type) {
        case 'pirate':
          this.add('pirates', -8);
          this.add('navy', 6);
          this.add('merchants', 5);
          break;
        case 'navy':
          this.add('navy', -14);
          this.add('pirates', 8);
          this.add('smugglers', 5);
          break;
        case 'merchant':
          this.add('merchants', -12);
          this.add('pirates', 6);
          this.add('navy', -6);
          break;
        case 'civilian':
        case 'fishing':
          this.add('merchants', -6);
          this.add('navy', -4);
          this.add('pirates', 3);
          break;
        case 'ghost':
          this.add('lostCiv', 6);
          break;
      }
    });
    ev.on('survivor:rescued', () => {
      this.add('merchants', 3);
      this.add('explorers', 3);
    });
    ev.on('quest:completed', (q) => {
      this.add(q?.faction ?? 'merchants', 5);
      this.add('explorers', 2);
    });
    ev.on('boss:defeated', () => this.add('lostCiv', 10));
    ev.on('dungeon:cleared', () => this.add('lostCiv', 6));
    ev.on('collection:discovered', (e) => {
      if (e.category === 'locations') this.add('explorers', 2);
    });
  }

  add(id, amount) {
    const before = this.rep[id];
    this.rep[id] = clamp(Math.round(this.rep[id] + amount), -100, 100);
    if (this.rep[id] !== before) {
      this.game.events.emit('faction:changed', { id, rep: this.rep[id], delta: this.rep[id] - before });
      const cross = (t) => before < t !== this.rep[id] < t;
      if (cross(-25) || cross(55)) {
        this.game.hud.toast(`${FACTIONS[id].name}: now ${this.label(id)}`, FACTIONS[id].color);
      }
    }
  }

  label(id) {
    const r = this.rep[id];
    for (const [max, label] of STANDING_LABELS) {
      if (r < max) return label;
    }
    return 'Legendary';
  }

  isHostile(id) {
    return this.rep[id] < -25;
  }

  isFriendly(id) {
    return this.rep[id] >= 55;
  }

  /** Shop price multiplier from merchant/smuggler standing. */
  priceMult(shopKey) {
    const id = shopKey === 'black' ? 'smugglers' : 'merchants';
    const r = this.rep[id];
    return clamp(1 - r * 0.002, 0.8, 1.25); // ±20-25%
  }

  serialize() {
    return { ...this.rep };
  }
}
