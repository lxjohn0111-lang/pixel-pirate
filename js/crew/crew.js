// Crew members: procedurally named and dressed pirates with levels,
// traits and weapons. They speed up cannon reloads at sea, fight beside
// the captain in boardings, and can die there permanently.

import { mulberry32, pick, rangeInt } from '../util/random.js';
import { randomAppearance } from '../render/pirate.js';
import { ITEMS } from '../items/itemdefs.js';
import { CLANS, CLAN_IDS } from '../world/clans.js';

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

/**
 * Clan ranks. A pirate's rank decides how hard they are to turn: a
 * deckhand will follow anyone who pays, a captain has to be beaten or
 * genuinely won over.
 */
export const RANKS = [
  { id: 'deckhand', name: 'Deckhand', minLevel: 1, pull: 0, wageMult: 1 },
  { id: 'bosun', name: 'Bosun', minLevel: 3, pull: 15, wageMult: 1.6 },
  { id: 'quartermaster', name: 'Quartermaster', minLevel: 5, pull: 35, wageMult: 2.4 },
  { id: 'firstmate', name: 'First Mate', minLevel: 7, pull: 55, wageMult: 3.4 },
  { id: 'captain', name: 'Captain', minLevel: 9, pull: 75, wageMult: 5 },
];

export function rankFor(level) {
  let out = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) out = r;
  return out;
}

let nextCrewId = 1;

export function createCrewMember(seed, level = 1, clanId = null) {
  const rng = mulberry32(seed >>> 0);
  const traitKeys = Object.keys(TRAITS);
  const t1 = pick(rng, traitKeys);
  let t2 = pick(rng, traitKeys);
  if (t2 === t1) t2 = null;
  const weapon = level >= 4 && rng() < 0.3
    ? 'officerSaber'
    : CREW_WEAPONS[Math.min(CREW_WEAPONS.length - 2, rangeInt(rng, 0, 1 + Math.floor(level / 2)))];
  const maxHealth = 40 + level * 14 + rangeInt(rng, 0, 10);
  const rank = rankFor(level);
  return {
    id: `crew${nextCrewId++}_${seed.toString(36)}`,
    name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
    appearance: randomAppearance(seed ^ 0x5eed),
    level,
    maxHealth,
    health: maxHealth,
    weapon,
    traits: t2 ? [t1, t2] : [t1],
    // Clan identity. Everyone came from somewhere, and loyalty is what
    // they think of you now rather than who they used to sail with.
    rank: rank.id,
    originClan: clanId ?? pick(rng, CLAN_IDS),
    loyalty: 50,
    ship: null,
    joinedBy: null,
  };
}

export class CrewSystem {
  constructor(game, saved) {
    this.game = game;
    this.members = saved?.map((m) => ({ ...m })) ?? [];
    /** Crew lost in the current battle, pending a possible rescue. */
    this.fallen = [];
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
      // Held aside so the surgeon still has a chance to save them once
      // the fighting stops (see the rewarded-ad offer in game.js).
      this.fallen.push(dead);
      this.game.events.emit('crew:died', { name: dead.name });
      this.game.events.emit('crew:changed');
    }
  }

  /** Bring back everyone who fell in the last battle. */
  reviveFallen() {
    const revived = this.fallen.splice(0, this.fallen.length);
    for (const m of revived) {
      if (this.members.length >= this.capacity) break;
      m.health = Math.max(1, Math.round(m.maxHealth * 0.5));
      this.members.push(m);
    }
    if (revived.length) this.game.events.emit('crew:changed');
    return revived;
  }

  clearFallen() {
    this.fallen.length = 0;
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

/* ------------------------------------------------------------------ */
/* Roles: what a crew member is FOR                                    */
/* ------------------------------------------------------------------ */

// A crew member's traits already decide what they are good at; naming
// that gives the card something to be about besides a level number.
const ROLES = [
  { trait: 'surgeon',    name: 'Surgeon',    icon: '✚', mood: 'warm' },
  { trait: 'cook',       name: 'Cook',       icon: '🍲', mood: 'warm' },
  { trait: 'navigator',  name: 'Navigator',  icon: '🧭', mood: 'neutral' },
  { trait: 'eagleEye',   name: 'Gunner',     icon: '🎯', mood: 'grim' },
  { trait: 'fastReload', name: 'Powder Monkey', icon: '💨', mood: 'grin' },
  { trait: 'fearless',   name: 'Boarder',    icon: '⚔', mood: 'angry' },
  { trait: 'strong',     name: 'Bruiser',    icon: '💪', mood: 'grim' },
  { trait: 'lucky',      name: 'Lookout',    icon: '👁', mood: 'sly' },
  { trait: 'greedy',     name: 'Quartermaster', icon: '💰', mood: 'sly' },
  { trait: 'coward',     name: 'Swabbie',    icon: '🧹', mood: 'sad' },
];

export function crewRole(m) {
  for (const r of ROLES) if (m.traits.includes(r.trait)) return r;
  return { name: 'Deckhand', icon: '⚓', mood: 'neutral' };
}

/** Stable numeric seed from a crew id, for portrait detail variation. */
export function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
