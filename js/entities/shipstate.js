// The player ship's combat & upgrade state: hull, sails, cannons, ammo
// and upgrade levels. The Part 1 Ship class stays purely about movement
// and drawing; this wraps everything Part 2 adds, and feeds modifiers
// (speed, turning) back into the physics via getters the ship reads.

import { clamp } from '../util/math.js';

export const UPGRADES = {
  hull:    { name: 'Hull',          max: 5, cost: (l) => ({ gold: 120 * l, wood: 8 * l, iron: 2 * l }), desc: '+40 max hull per level' },
  cannons: { name: 'Cannons',       max: 3, cost: (l) => ({ gold: 200 * l, iron: 5 * l, gunpowder: 3 * l }), desc: '+1 cannon per side, +damage' },
  sails:   { name: 'Sails',         max: 4, cost: (l) => ({ gold: 150 * l, cloth: 6 * l, wood: 4 * l }), desc: '+8% top speed per level' },
  storage: { name: 'Cargo Hold',    max: 4, cost: (l) => ({ gold: 100 * l, wood: 10 * l }), desc: '+6 cargo slots per level' },
  crew:    { name: 'Crew Quarters', max: 4, cost: (l) => ({ gold: 140 * l, wood: 8 * l, cloth: 3 * l }), desc: '+2 crew capacity per level' },
  rudder:  { name: 'Rudder',        max: 3, cost: (l) => ({ gold: 110 * l, wood: 5 * l, iron: 2 * l }), desc: '+10% turn speed per level' },
};

export const PAINTS = [
  { id: 'oak', name: 'Oak Brown', tint: null, cost: 0 },
  { id: 'ebony', name: 'Ebony Black', tint: 'rgba(20,16,24,0.4)', cost: 150 },
  { id: 'crimson', name: 'Crimson', tint: 'rgba(142,47,47,0.38)', cost: 150 },
  { id: 'emerald', name: 'Emerald', tint: 'rgba(46,110,78,0.38)', cost: 150 },
  { id: 'royal', name: 'Royal Blue', tint: 'rgba(58,78,142,0.38)', cost: 150 },
  // Unlock-only paints (collection & achievement rewards).
  { id: 'gilded', name: 'Gilded', tint: 'rgba(224,179,69,0.35)', unlock: true },
  { id: 'abyssal', name: 'Abyssal', tint: 'rgba(30,20,60,0.5)', unlock: true },
  { id: 'navywhite', name: 'Admiralty White', tint: 'rgba(240,240,235,0.4)', unlock: true },
  { id: 'gold', name: 'Dragonhoard Gold', tint: 'rgba(255,200,60,0.45)', unlock: true },
];

export class ShipState {
  constructor(game, saved) {
    this.game = game;
    this.levels = { hull: 0, cannons: 0, sails: 0, storage: 0, crew: 0, rudder: 0, ...(saved?.levels ?? {}) };
    this.hull = saved?.hull ?? this.maxHull;
    this.sailHp = saved?.sailHp ?? this.maxSail;
    this.paint = saved?.paint ?? 'oak';
    this.paints = saved?.paints ?? ['oak'];
    this._reload = 0;
    this._sinceHit = 99;
  }

  get maxHull() { return 100 + this.levels.hull * 40; }
  get maxSail() { return 60 + this.levels.sails * 10; }

  /** Equipped legendary relic id (Part 3), or null. */
  get relic() {
    return this.game.inventory?.equipment?.relic ?? null;
  }

  get cannonsPerSide() {
    return 2 + this.levels.cannons + (this.relic === 'ghostCannon' ? 1 : 0);
  }

  get cannonDamage() { return 15 + this.levels.cannons * 4; }
  get cargoSlots() { return 12 + this.levels.storage * 6; }
  get crewCapacity() { return 2 + this.levels.crew * 2; }

  /** Multipliers the Part 1 ship physics reads. */
  get speedMult() {
    const crewBonus = this.game.crew ? this.game.crew.bonuses().sail : 0;
    const sailDamagePenalty = 0.55 + 0.45 * (this.sailHp / this.maxSail);
    let relicBonus = 0;
    if (this.relic === 'phoenixSail') relicBonus += 0.12;
    if (this.relic === 'stormLantern' && this.game.weather?.rain > 0.2) relicBonus += 0.15;
    const daily = this.game.daily?.modifier?.speed ?? 1;
    const prestige = 1 + (this.game.prestige ?? 0) * 0.02;
    return (1 + this.levels.sails * 0.08 + crewBonus + relicBonus) * sailDamagePenalty * daily * prestige;
  }

  get turnMult() { return 1 + this.levels.rudder * 0.1; }

  get reloadTime() {
    const crewBonus = this.game.crew ? this.game.crew.bonuses().reload : 0;
    return 2.6 / (1 + crewBonus);
  }

  get canFire() { return this._reload <= 0; }

  didFire() { this._reload = this.reloadTime; }

  update(dt) {
    this._reload = Math.max(0, this._reload - dt);
    this._sinceHit += dt;
    // Out of combat, the crew patches small leaks for free.
    const regenRate = this.relic === 'phoenixSail' ? 2.6 : 0.8;
    if (this._sinceHit > 14 && this.hull < this.maxHull) {
      this.hull = Math.min(this.maxHull, this.hull + dt * regenRate);
    }
    if (this._sinceHit > 14 && this.sailHp < this.maxSail) {
      this.sailHp = Math.min(this.maxSail, this.sailHp + dt * 0.5);
    }
  }

  damage(hullDmg, sailDmg = 0) {
    this.hull = Math.max(0, this.hull - hullDmg);
    this.sailHp = clamp(this.sailHp - sailDmg, this.maxSail * 0.2, this.maxSail);
    this._sinceHit = 0;
    this.game.events.emit('playership:damaged', { hull: this.hull });
  }

  repair(amount) {
    this.hull = Math.min(this.maxHull, this.hull + amount);
    this.game.events.emit('playership:damaged', { hull: this.hull });
  }

  get inDanger() { return this.hull < this.maxHull * 0.35; }

  serialize() {
    return {
      levels: { ...this.levels },
      hull: Math.round(this.hull),
      sailHp: Math.round(this.sailHp),
      paint: this.paint,
      paints: [...this.paints],
    };
  }
}
