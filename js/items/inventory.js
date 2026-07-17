// Inventory model: slot-based containers with stacking, plus the
// player's equipment and quick bar. Pure data + rules — the DOM UI in
// ui/inventoryUI.js renders whatever this holds. No weight, by design.

import { ITEMS } from './itemdefs.js';

export const EQUIP_SLOTS = ['sword', 'pistol', 'musket', 'hat', 'coat', 'boots', 'ring', 'necklace', 'charm', 'relic'];
export const QUICKBAR_SIZE = 4;
export const PLAYER_SLOTS = 24;
export const CARGO_BASE_SLOTS = 12;

export class Container {
  constructor(size, slots) {
    this.slots = new Array(size).fill(null);
    if (slots) {
      for (let i = 0; i < Math.min(size, slots.length); i++) {
        this.slots[i] = slots[i] ? { ...slots[i] } : null;
      }
    }
  }

  resize(size) {
    const old = this.slots;
    this.slots = new Array(size).fill(null);
    for (let i = 0; i < Math.min(size, old.length); i++) this.slots[i] = old[i];
  }

  /** Add qty of an item, stacking first. Returns leftover qty (0 = all fit). */
  add(id, qty = 1) {
    const def = ITEMS[id];
    if (!def) return qty;
    let left = qty;
    if (def.stack > 1) {
      for (const s of this.slots) {
        if (left <= 0) break;
        if (s && s.id === id && s.qty < def.stack) {
          const take = Math.min(def.stack - s.qty, left);
          s.qty += take;
          left -= take;
        }
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(def.stack, left);
        this.slots[i] = { id, qty: take };
        left -= take;
      }
    }
    return left;
  }

  /** Remove up to qty of an item. Returns how many were removed. */
  remove(id, qty = 1) {
    let need = qty;
    for (let i = this.slots.length - 1; i >= 0 && need > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.qty, need);
        s.qty -= take;
        need -= take;
        if (s.qty <= 0) this.slots[i] = null;
      }
    }
    return qty - need;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.qty;
    return n;
  }

  get used() {
    return this.slots.filter(Boolean).length;
  }

  /** Sort: by type, then rarity (desc), then name; merges stacks. */
  sort() {
    const counts = new Map();
    for (const s of this.slots) {
      if (s) counts.set(s.id, (counts.get(s.id) || 0) + s.qty);
    }
    const order = ['weapon', 'armor', 'trinket', 'consumable', 'ammo', 'resource', 'shippart', 'special', 'valuable'];
    const rarities = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
    const ids = [...counts.keys()].sort((a, b) => {
      const da = ITEMS[a];
      const db = ITEMS[b];
      const t = order.indexOf(da.type) - order.indexOf(db.type);
      if (t) return t;
      const r = rarities.indexOf(da.rarity) - rarities.indexOf(db.rarity);
      if (r) return r;
      return da.name.localeCompare(db.name);
    });
    this.slots.fill(null);
    let i = 0;
    for (const id of ids) {
      let qty = counts.get(id);
      const max = ITEMS[id].stack;
      while (qty > 0 && i < this.slots.length) {
        const take = Math.min(max, qty);
        this.slots[i++] = { id, qty: take };
        qty -= take;
      }
    }
  }

  serialize() {
    return this.slots.map((s) => (s ? { id: s.id, qty: s.qty } : null));
  }
}

/**
 * The player's whole carrying state: backpack, ship cargo, equipment
 * and quick bar. Equipment slots hold { id } (never stacked).
 */
export class Inventory {
  constructor(saved, cargoSlots = CARGO_BASE_SLOTS) {
    this.backpack = new Container(PLAYER_SLOTS, saved?.backpack);
    this.cargo = new Container(cargoSlots, saved?.cargo);
    this.equipment = {};
    for (const slot of EQUIP_SLOTS) {
      this.equipment[slot] = saved?.equipment?.[slot] ?? null; // item id or null
    }
    this.quickbar = new Array(QUICKBAR_SIZE).fill(null);
    if (saved?.quickbar) {
      for (let i = 0; i < QUICKBAR_SIZE; i++) this.quickbar[i] = saved.quickbar[i] ?? null; // item id
    }
  }

  /** Add loot anywhere it fits: backpack first, then cargo. Returns leftover. */
  addAnywhere(id, qty = 1) {
    const left = this.backpack.add(id, qty);
    return left > 0 ? this.cargo.add(id, left) : 0;
  }

  /** Total count across backpack + cargo. */
  totalCount(id) {
    return this.backpack.count(id) + this.cargo.count(id);
  }

  /** Remove from backpack first, then cargo. Returns how many removed. */
  removeAnywhere(id, qty = 1) {
    const got = this.backpack.remove(id, qty);
    return got < qty ? got + this.cargo.remove(id, qty - got) : got;
  }

  /** Equip an item id into its slot; returns the previously equipped id. */
  equip(id) {
    const def = ITEMS[id];
    if (!def?.slot) return undefined;
    const prev = this.equipment[def.slot];
    this.equipment[def.slot] = id;
    return prev ?? null;
  }

  /** Combined stat bonuses from all equipped items. */
  equipmentStats() {
    const total = { attack: 0, defense: 0, maxHealth: 0, speed: 0, reloadSpeed: 0, critChance: 0, luck: 0 };
    for (const slot of EQUIP_SLOTS) {
      const id = this.equipment[slot];
      const stats = id && ITEMS[id]?.stats;
      if (stats) {
        for (const [k, v] of Object.entries(stats)) total[k] = (total[k] || 0) + v;
      }
    }
    return total;
  }

  serialize() {
    return {
      backpack: this.backpack.serialize(),
      cargo: this.cargo.serialize(),
      equipment: { ...this.equipment },
      quickbar: [...this.quickbar],
    };
  }
}
