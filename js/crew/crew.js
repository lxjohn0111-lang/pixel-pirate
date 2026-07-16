// Crew members: procedurally named and dressed pirates with levels,
// traits and weapons. They speed up cannon reloads at sea, fight beside
// the captain in boardings, and can die there permanently.

import { mulberry32, pick, rangeInt } from '../util/random.js';
import { randomAppearance } from '../render/pirate.js';
import { ITEMS } from '../items/itemdefs.js';

const FIRST = ['Salty', 'One-Eye', 'Mad', 'Quiet', 'Lucky', 'Iron', 'Red', 'Bones', 'Gully', 'Old',
  'Young', 'Stormy', 'Rat', 'Fish', 'Black', 'Gold-Tooth', 'Whistling', 'Barnacle', 'Grim', 'Merry'];
const LAST = ['Jack', 'Anne', 'Morgan', 'Flint', 'Reyes', 'Okafor', 'Silva', 'Bram', 'Ashe', 'Crow',
  'Ivarsson', 'Petit', 'Nakamura', 'Vane', 'Teach', 'Mei', 'Delgado', 'Kelly', 'Sparks', 'Hale'];

export const TRAITS = {
  fastReload: { name: 'Fast Reload', desc: '+15% cannon reload speed', reload: 0.15 },
  strong:     { name: 'Strong', desc: '+25% melee damage', melee: 0.25 },
  lucky:      { name: 'Lucky', desc: '+2 crew luck (better loot)', luck: 2 },
  navigator:  { name: 'Navigator', desc: '+5% ship speed', sail: 0.05 },
  cook:       { name: 'Cook', desc: 'Crew slowly regenerates health', regen: true },
  coward:     { name: 'Coward', desc: 'Flees below deck at low health', coward: true },
  fearless:   { name: 'Fearless', desc: 'Never retreats, +10% damage', melee: 0.1, fearless: true },
  greedy:     { name: 'Greedy', desc: 'Wages cost +25%, finds +10% gold', gold: 0.1 },
  eagleEye:   { name: 'Eagle Eye', desc: '+10% cannon damage', cannon: 0.1 },
  surgeon:    { name: 'Surgeon', desc: 'Heals the crew after battle', surgeon: true },
};

const CREW_WEAPONS = ['rustyCutlass', 'cutlass', 'flintlock', 'musket', 'officerSaber'];

let nextCrewId = 1;

export function createCrewMember(seed, level = 1) {
  const rng = mulberry32(seed >>> 0);
  const traitKeys = Object.keys(TRAITS);
  const t1 = pick(rng, traitKeys);
  let t2 = pick(rng, traitKeys);
  if (t2 === t1) t2 = null;
  const weapon = level >= 4 && rng() < 0.3
    ? 'officerSaber'
    : CREW_WEAPONS[Math.min(CREW_WEAPONS.length - 2, rangeInt(rng, 0, 1 + Math.floor(level / 2)))];
  const maxHealth = 40 + level * 14 + rangeInt(rng, 0, 10);
  return {
    id: `crew${nextCrewId++}_${seed.toString(36)}`,
    name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
    appearance: randomAppearance(seed ^ 0x5eed),
    level,
    maxHealth,
    health: maxHealth,
    weapon,
    traits: t2 ? [t1, t2] : [t1],
  };
}

export class CrewSystem {
  constructor(game, saved) {
    this.game = game;
    this.members = saved?.map((m) => ({ ...m })) ?? [];
    this._regenTimer = 6;
  }

  get capacity() {
    return this.game.shipState.crewCapacity;
  }

  get hasCook() {
    return this.members.some((m) => m.traits.includes('cook'));
  }

  /** Aggregate crew bonuses applied to the player's ship. */
  bonuses() {
    const b = { reload: 0, sail: 0, cannon: 0, luck: 0 };
    for (const m of this.members) {
      for (const t of m.traits) {
        const def = TRAITS[t];
        if (def.reload) b.reload += def.reload;
        if (def.sail) b.sail += def.sail;
        if (def.cannon) b.cannon += def.cannon;
        if (def.luck) b.luck += def.luck;
      }
      b.reload += 0.05; // every pair of hands helps at the guns
    }
    return b;
  }

  recruit(member) {
    if (this.members.length >= this.capacity) return false;
    this.members.push(member);
    this.game.events.emit('crew:changed');
    this.game.events.emit('sfx', 'recruit');
    return true;
  }

  dismiss(id) {
    const i = this.members.findIndex((m) => m.id === id);
    if (i >= 0) {
      this.members.splice(i, 1);
      this.game.events.emit('crew:changed');
    }
  }

  /** Permanent death (boarding casualties). */
  kill(id) {
    const i = this.members.findIndex((m) => m.id === id);
    if (i >= 0) {
      const [dead] = this.members.splice(i, 1);
      this.game.events.emit('crew:died', { name: dead.name });
      this.game.events.emit('crew:changed');
    }
  }

  update(dt) {
    // The cook keeps everyone fed; wounds knit slowly at sea.
    this._regenTimer -= dt;
    if (this._regenTimer <= 0) {
      this._regenTimer = 6;
      const rate = this.hasCook ? 4 : 1;
      let changed = false;
      for (const m of this.members) {
        if (m.health < m.maxHealth) {
          m.health = Math.min(m.maxHealth, m.health + rate);
          changed = true;
        }
      }
      if (changed) this.game.events.emit('crew:changed');
    }
  }

  /** Post-battle field medicine. */
  afterBattle() {
    if (this.members.some((m) => m.traits.includes('surgeon'))) {
      for (const m of this.members) m.health = Math.min(m.maxHealth, m.health + Math.round(m.maxHealth * 0.4));
      this.game.events.emit('crew:changed');
    }
  }

  meleeDamage(member) {
    const weapon = ITEMS[member.weapon];
    let dmg = 3 + member.level * 1.2 + (weapon?.stats?.attack ?? 0);
    for (const t of member.traits) if (TRAITS[t].melee) dmg *= 1 + TRAITS[t].melee;
    return Math.round(dmg);
  }

  serialize() {
    return this.members.map((m) => ({ ...m }));
  }
}
