// Port screen: Harbor (repair), Merchants (buy/sell across three shops),
// Shipwright (upgrades + paint), Tavern (hire crew, contracts).
// Stock and offers are deterministic per port and in-game day.

import { ITEMS, RARITY, itemIcon } from '../items/itemdefs.js';
import { UPGRADES, PAINTS } from '../entities/shipstate.js';
import { createCrewMember, TRAITS } from '../crew/crew.js';
import { mulberry32, rangeInt } from '../util/random.js';
import { drawPirate } from '../render/pirate.js';
import { MAX_ACTIVE } from '../quests/quests.js';

const SHOPS = {
  general:  { name: 'General Store', pool: ['wood', 'stone', 'iron', 'cloth', 'food', 'rum', 'repairKit', 'cannonball', 'bullets', 'gunpowder', 'strawHat', 'sailorCoat', 'deckBoots', 'hullPlanks'] },
  weapons:  { name: 'Weapon Merchant', pool: ['rustyCutlass', 'cutlass', 'flintlock', 'musket', 'officerSaber', 'duelPistol', 'tricornHat', 'leatherCoat', 'navalCoat', 'buccaneerBoots', 'bullets', 'gunpowder', 'cannonBarrel'] },
  black:    { name: 'Black Market', pool: ['rustyKey', 'treasureMap', 'fineRum', 'signetRing', 'boneCharm', 'sharkTooth', 'pearlNecklace', 'monkey', 'spyglass', 'corsairBlade', 'dragonPistol', 'longRifle', 'captainsHat', 'silkSails', 'parrot'] },
};

export class PortUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.uiRoot = uiRoot;
    this.el = document.createElement('div');
    this.el.className = 'panel captain-panel port-panel hidden';
    uiRoot.appendChild(this.el);
    this.tab = 'harbor';
    this.port = null;
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open(port) {
    this.port = port;
    this.tab = 'harbor';
    this.el.classList.remove('hidden');
    this.game.events.emit('port:docked', port);
    this.game.events.emit('sfx', 'ui');
    this.render();
  }

  close() {
    this.el.classList.add('hidden');
    this.game.save();
  }

  _rng(salt = 0) {
    return mulberry32((this.port.seed ^ (this.game.dayNight.day * 0x9e37) ^ salt) >>> 0);
  }

  render() {
    const tabs = [['harbor', 'Harbor'], ['general', 'Store'], ['weapons', 'Weapons'], ['black', 'Black Market'], ['wright', 'Shipwright'], ['tavern', 'Tavern']];
    this.el.innerHTML = `
      <div class="panel-head">
        <div class="port-title"><h3>${this.port.name}</h3><span>${this.game.resources.coins} gold</span></div>
        <button class="close-btn" aria-label="Leave port">✕</button>
      </div>
      <div class="panel-tabs port-tabs">
        ${tabs.map(([k, l]) => `<button class="tab-btn ${k === this.tab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
      </div>
      <div class="panel-body"></div>`;
    this.el.querySelector('.close-btn').addEventListener('click', () => this.close());
    this.el.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.tab;
      this.render();
    }));
    const body = this.el.querySelector('.panel-body');
    if (this.tab === 'harbor') this._renderHarbor(body);
    else if (this.tab === 'wright') this._renderWright(body);
    else if (this.tab === 'tavern') this._renderTavern(body);
    else this._renderShop(body, this.tab);
  }

  /* ---- harbor: repair + sell ------------------------------------------ */

  _renderHarbor(body) {
    const { game } = this;
    const st = game.shipState;
    const missing = Math.ceil(st.maxHull - st.hull);
    const cost = Math.ceil(missing * 0.8);
    const sellables = [];
    for (const [cname, cont] of [['backpack', game.inventory.backpack], ['cargo', game.inventory.cargo]]) {
      cont.slots.forEach((s, i) => {
        if (s) sellables.push({ addr: { cname, i }, ...s });
      });
    }
    body.innerHTML = `
      <div class="harbor-repair">
        <span>Hull: ${Math.round(st.hull)}/${st.maxHull}</span>
        <button class="btn repair-btn" ${missing <= 0 || game.resources.coins < cost ? 'disabled' : ''}>
          Repair All (${cost} gold)
        </button>
      </div>
      <h4>Sell Loot <span class="hint-inline">(60% of value · click an item)</span></h4>
      <div class="item-grid sell-grid">
        ${sellables.map((s, idx) => {
          const def = ITEMS[s.id];
          const price = Math.max(1, Math.floor(def.value * 0.6));
          return `<div class="slot filled sell-slot" data-idx="${idx}" style="--rar:${RARITY[def.rarity].color}" title="${def.name} — sell for ${price * s.qty} gold">
            <img src="${itemIcon(s.id).toDataURL()}" alt="${def.name}">${s.qty > 1 ? `<span class="qty">${s.qty}</span>` : ''}
            <span class="price-tag">${price}</span>
          </div>`;
        }).join('') || '<p class="empty-note">Nothing to sell.</p>'}
      </div>`;
    body.querySelector('.repair-btn')?.addEventListener('click', () => {
      game.resources.coins -= cost;
      st.repair(missing);
      game.events.emit('resources:changed', { ...game.resources });
      game.events.emit('sfx', 'repair');
      this.render();
    });
    body.querySelectorAll('.sell-slot').forEach((el) => {
      el.addEventListener('click', () => {
        const s = sellables[Number(el.dataset.idx)];
        const def = ITEMS[s.id];
        const cont = s.addr.cname === 'cargo' ? game.inventory.cargo : game.inventory.backpack;
        cont.remove(s.id, 1);
        game.resources.coins += Math.max(1, Math.floor(def.value * 0.6));
        game.events.emit('resources:changed', { ...game.resources });
        game.events.emit('sfx', 'coin');
        this.render();
      });
    });
  }

  /* ---- shops -------------------------------------------------------------- */

  _renderShop(body, shopKey) {
    const { game } = this;
    const shop = SHOPS[shopKey];
    const rng = this._rng(shopKey.length);
    const markup = shopKey === 'black' ? 1.4 : 1;
    // Deterministic daily stock: 6-8 entries from the pool.
    const stock = [];
    const pool = [...shop.pool];
    const n = rangeInt(rng, 6, Math.min(8, pool.length));
    for (let i = 0; i < n; i++) {
      const idx = rangeInt(rng, 0, pool.length - 1);
      const id = pool.splice(idx, 1)[0];
      const def = ITEMS[id];
      stock.push({
        id,
        qty: def.stack > 1 ? rangeInt(rng, 3, 12) : 1,
        price: Math.max(1, Math.ceil(def.value * markup)),
      });
    }
    body.innerHTML = `
      <h4>${shop.name} <span class="hint-inline">(stock changes daily)</span></h4>
      <div class="shop-list">
        ${stock.map((s, i) => {
          const def = ITEMS[s.id];
          const r = RARITY[def.rarity];
          const afford = game.resources.coins >= s.price;
          return `<div class="shop-row" style="--rar:${r.color}">
            <img src="${itemIcon(s.id).toDataURL()}" alt="">
            <div class="shop-info">
              <span class="shop-name" style="color:${r.color}">${def.name}</span>
              <span class="shop-desc">${def.desc}</span>
            </div>
            <button class="mini-btn buy-btn" data-i="${i}" ${afford ? '' : 'disabled'}>${s.price}g${s.qty > 1 ? ` x${s.qty}` : ''}</button>
          </div>`;
        }).join('')}
      </div>`;
    body.querySelectorAll('.buy-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const s = stock[Number(b.dataset.i)];
        if (game.resources.coins < s.price) return;
        const left = game.inventory.addAnywhere(s.id, s.qty);
        if (left === s.qty) {
          game.hud.toast('No room in your hold!', '#e05a4a');
          return;
        }
        game.resources.coins -= s.price;
        game.events.emit('resources:changed', { ...game.resources });
        game.events.emit('sfx', 'buy');
        b.disabled = true;
        b.textContent = 'Sold';
        this.el.querySelector('.port-title span').textContent = `${game.resources.coins} gold`;
      });
    });
  }

  /* ---- shipwright --------------------------------------------------------------- */

  _renderWright(body) {
    const { game } = this;
    const st = game.shipState;
    const rows = Object.entries(UPGRADES).map(([key, u]) => {
      const lvl = st.levels[key];
      if (lvl >= u.max) {
        return `<div class="up-row done"><span>${u.name}</span><span class="pips">${'●'.repeat(u.max)}</span><b>MAX</b></div>`;
      }
      const cost = u.cost(lvl + 1);
      const parts = Object.entries(cost).map(([res, amt]) => {
        const have = res === 'gold' ? game.resources.coins : game.inventory.totalCount(res);
        return `<span class="${have >= amt ? '' : 'missing'}">${amt} ${res}</span>`;
      }).join(' · ');
      const can = Object.entries(cost).every(([res, amt]) =>
        (res === 'gold' ? game.resources.coins : game.inventory.totalCount(res)) >= amt);
      return `<div class="up-row">
        <div><span>${u.name} ${lvl + 1}</span><div class="up-desc">${u.desc}</div></div>
        <div class="up-cost">${parts}</div>
        <button class="mini-btn up-btn" data-key="${key}" ${can ? '' : 'disabled'}>Fit</button>
      </div>`;
    }).join('');
    const paints = PAINTS.map((p) => {
      const owned = st.paints.includes(p.id);
      return `<button class="mini-btn paint-btn ${st.paint === p.id ? 'active' : ''}" data-id="${p.id}">
        ${p.name}${owned ? '' : ` (${p.cost}g)`}</button>`;
    }).join('');
    body.innerHTML = `<h4>Shipwright</h4>${rows}<h4>Hull Paint</h4><div class="paint-row">${paints}</div>`;
    body.querySelectorAll('.up-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.dataset.key;
        const cost = UPGRADES[key].cost(st.levels[key] + 1);
        for (const [res, amt] of Object.entries(cost)) {
          if (res === 'gold') game.resources.coins -= amt;
          else game.inventory.removeAnywhere(res, amt);
        }
        st.levels[key]++;
        if (key === 'hull') st.hull += 40;
        if (key === 'storage') game.inventory.cargo.resize(st.cargoSlots);
        game.events.emit('resources:changed', { ...game.resources });
        game.events.emit('sfx', 'upgrade');
        game.hud.toast(`${UPGRADES[key].name} upgraded!`, '#6fce62');
        this.render();
      });
    });
    body.querySelectorAll('.paint-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const p = PAINTS.find((p) => p.id === b.dataset.id);
        if (!st.paints.includes(p.id)) {
          if (game.resources.coins < p.cost) return;
          game.resources.coins -= p.cost;
          st.paints.push(p.id);
          game.events.emit('resources:changed', { ...game.resources });
        }
        st.paint = p.id;
        game.events.emit('sfx', 'buy');
        this.render();
      });
    });
  }

  /* ---- tavern: crew + contracts ---------------------------------------------------- */

  _renderTavern(body) {
    const { game } = this;
    const rng = this._rng(0x7a7);
    // hirelings (deterministic per day; already-hired ones filtered by id salt)
    const hirelings = [];
    for (let i = 0; i < 2; i++) {
      const seed = (this.port.seed ^ (game.dayNight.day * 131) ^ (i * 7919)) >>> 0;
      const level = 1 + rangeInt(rng, 0, 1 + game.tierAt(this.port.x, this.port.y));
      const m = createCrewMember(seed, level);
      m.wage = 40 + level * 35 + (m.traits.includes('greedy') ? 20 : 0);
      hirelings.push(m);
    }
    const hiredKey = `hired:${this.port.seed}:${game.dayNight.day}`;
    const hiredSet = game.portHired[hiredKey] ?? [];

    const offers = game.quests.offersAt(this.port);
    const activeIds = new Set(game.quests.active.map((q) => q.name + q.originPort));

    body.innerHTML = `
      <h4>Hire Crew</h4>
      <div class="hire-list">
        ${hirelings.map((m, i) => {
          const traits = m.traits.map((t) => `<span class="trait" title="${TRAITS[t].desc}">${TRAITS[t].name}</span>`).join('');
          const hired = hiredSet.includes(i);
          return `<div class="crew-row">
            <canvas class="crew-face" width="22" height="30" data-i="${i}"></canvas>
            <div class="crew-info">
              <div class="crew-name">${m.name} <span class="crew-lvl">Lv ${m.level}</span></div>
              <div class="crew-meta">${ITEMS[m.weapon]?.name} · ${traits}</div>
            </div>
            <button class="mini-btn hire-btn" data-i="${i}" ${hired || game.resources.coins < m.wage ? 'disabled' : ''}>
              ${hired ? 'Hired' : `${m.wage}g`}
            </button>
          </div>`;
        }).join('')}
      </div>
      <h4>Contracts <span class="hint-inline">(${game.quests.active.length}/${MAX_ACTIVE} active)</span></h4>
      <div class="quest-list">
        ${offers.map((o, i) => {
          const taken = activeIds.has(o.name + this.port.name);
          const canTurnIn = o.type === 'collect' && false;
          return `<div class="quest-row">
            <div class="quest-info">
              <div class="quest-name">${o.name}</div>
              <div class="quest-desc">${o.desc}</div>
              <div class="quest-reward">${o.reward.gold} gold · ${o.reward.xp} XP</div>
            </div>
            <button class="mini-btn quest-btn" data-i="${i}" ${taken || game.quests.active.length >= MAX_ACTIVE ? 'disabled' : ''}>${taken ? 'Taken' : 'Accept'}</button>
          </div>`;
        }).join('')}
      </div>
      ${game.quests.active.filter((q) => q.type === 'collect').map((q) => {
        const have = game.inventory.totalCount(q.itemId);
        return `<div class="quest-row turnin-row">
          <div class="quest-info"><div class="quest-name">${q.name}</div>
          <div class="quest-desc">You carry ${have}/${q.qty}</div></div>
          <button class="mini-btn turnin-btn" data-id="${q.id}" ${have >= q.qty ? '' : 'disabled'}>Turn In</button>
        </div>`;
      }).join('')}`;

    body.querySelectorAll('.crew-face').forEach((c) => {
      drawPirate(c.getContext('2d'), hirelings[Number(c.dataset.i)].appearance);
    });
    body.querySelectorAll('.hire-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        const m = hirelings[i];
        if (game.resources.coins < m.wage) return;
        if (!game.crew.recruit(m)) {
          game.hud.toast('Crew quarters are full!', '#e05a4a');
          return;
        }
        game.resources.coins -= m.wage;
        (game.portHired[hiredKey] = game.portHired[hiredKey] ?? []).push(i);
        game.events.emit('resources:changed', { ...game.resources });
        this.render();
      });
    });
    body.querySelectorAll('.quest-btn').forEach((b) => {
      b.addEventListener('click', () => {
        game.quests.accept(offers[Number(b.dataset.i)], this.port);
        this.render();
      });
    });
    body.querySelectorAll('.turnin-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const q = game.quests.active.find((q) => q.id === b.dataset.id);
        if (q && game.quests.tryTurnIn(q)) this.render();
      });
    });
  }
}
