// Player progression: stats, experience and levels. Base stats grow
// with level; equipment bonuses come from the inventory and are folded
// in via recompute(). Everything is plain data for easy saving.

import { clamp } from '../util/math.js';

export class Player {
  constructor(saved, inventory, events) {
    this.inventory = inventory;
    this.events = events;
    this.level = saved?.level ?? 1;
    this.xp = saved?.xp ?? 0;
    this.health = saved?.health ?? this.baseMaxHealth;
    this.recompute();
    this.health = clamp(this.health, 1, this.maxHealth);
  }

  get baseMaxHealth() {
    return 80 + this.level * 20;
  }

  get xpNext() {
    return Math.round(60 * Math.pow(this.level, 1.45));
  }

  /** Fold base + equipment into the derived stats combat reads. */
  recompute() {
    const eq = this.inventory.equipmentStats();
    this.maxHealth = this.baseMaxHealth + eq.maxHealth;
    this.attack = 4 + Math.floor(this.level * 1.5) + eq.attack;
    this.defense = Math.floor(this.level * 0.6) + eq.defense;
    this.speed = 60 + eq.speed * 6; // boarding move speed (px/s)
    this.reloadSpeed = eq.reloadSpeed; // % faster firearm reloads
    this.critChance = 5 + eq.critChance; // %
    this.luck = eq.luck;
    this.health = Math.min(this.health, this.maxHealth);
  }

  addXp(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      leveled = true;
    }
    if (leveled) {
      this.recompute();
      this.health = this.maxHealth; // level-ups feel great
      this.events.emit('player:levelup', { level: this.level });
      this.events.emit('sfx', 'levelup');
    }
    this.events.emit('player:changed');
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, this.maxHealth);
    this.events.emit('player:changed');
  }

  /** Apply incoming damage after defense. Returns actual damage taken. */
  hurt(amount) {
    const dmg = Math.max(1, Math.round(amount * (1 - this.defense / (this.defense + 30))));
    this.health = Math.max(0, this.health - dmg);
    this.events.emit('player:changed');
    return dmg;
  }

  serialize() {
    return { level: this.level, xp: this.xp, health: Math.round(this.health) };
  }
}
