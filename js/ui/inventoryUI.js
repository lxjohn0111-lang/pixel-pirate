// The Captain's Log panel: Inventory (backpack, ship hold, equipment,
// stats), Crew and Ship tabs. Drag & drop between any grids, stacking,
// rarity-colored tooltips, sorting, double-click to equip/use, and
// quick-bar assignment. Opens with I (or the bag button).

import { ITEMS, RARITY, itemIcon } from '../items/itemdefs.js';
import { EQUIP_SLOTS } from '../items/inventory.js';
import { TRAITS } from '../crew/crew.js';
import { UPGRADES, PAINTS } from '../entities/shipstate.js';
import { drawPirate } from '../render/pirate.js';

const SLOT_LABELS = {
  sword: 'Sword', pistol: 'Pistol', musket: 'Musket', hat: 'Hat', coat: 'Coat',
  boots: 'Boots', ring: 'Ring', necklace: 'Necklace', charm: 'Charm', relic: 'Relic',
};

export class InventoryUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.uiRoot = uiRoot;
    this.tab = 'inventory';
    this.el = document.createElement('div');
    this.el.className = 'panel captain-panel hidden';
    uiRoot.appendChild(this.el);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip hidden';
    uiRoot.appendChild(this.tooltip);

    this.drag = null; // { from, index, id, qty, ghost }
    window.addEventListener('pointermove', (e) => this._dragMove(e));
    window.addEventListener('pointerup', (e) => this._dragEnd(e));

    game.events.on('crew:changed', () => this.isOpen && this.tab === 'crew' && this.render());
    game.events.on('player:changed', () => this.isOpen && this.render());
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open(tab = this.tab) {
    this.tab = tab;
    this.el.classList.remove('hidden');
    this.game.events.emit('sfx', 'ui');
    this.render();
  }

  close() {
    this.el.classList.add('hidden');
    this.tooltip.classList.add('hidden');
    this.game.save();
  }

  /* ------------------------------------------------------------------ */

  render() {
    const tabs = ['inventory', 'crew', 'ship'];
    const labels = { inventory: 'Inventory', crew: `Crew (${this.game.crew.members.length}/${this.game.crew.capacity})`, ship: 'Ship' };
    this.el.innerHTML = `
      <div class="panel-head">
        <div class="panel-tabs">
          ${tabs.map((t) => `<button class="tab-btn ${t === this.tab ? 'active' : ''}" data-tab="${t}">${labels[t]}</button>`).join('')}
        </div>
        <button class="close-btn" aria-label="Close">✕</button>
      </div>
      <div class="panel-body"></div>`;
    this.el.querySelector('.close-btn').addEventListener('click', () => this.close());
    this.el.querySelectorAll('.tab-btn').forEach((b) => {
      b.addEventListener('click', () => this.open(b.dataset.tab));
    });
    const body = this.el.querySelector('.panel-body');
    if (this.tab === 'inventory') this._renderInventory(body);
    else if (this.tab === 'crew') this._renderCrew(body);
    else this._renderShip(body);
  }

  /* ---- inventory tab -------------------------------------------------- */

  _renderInventory(body) {
    const { game } = this;
    const p = game.player;
    body.innerHTML = `
      <div class="inv-layout">
        <div class="inv-left">
          <div class="equip-grid"></div>
          <div class="stats-list">
            <div><span>Health</span><b>${Math.round(p.health)}/${p.maxHealth}</b></div>
            <div><span>Attack</span><b>${p.attack}</b></div>
            <div><span>Defense</span><b>${p.defense}</b></div>
            <div><span>Crit</span><b>${p.critChance}%</b></div>
            <div><span>Reload</span><b>+${p.reloadSpeed}%</b></div>
            <div><span>Luck</span><b>${p.luck}</b></div>
            <div class="stat-level"><span>Level ${p.level}</span><b>${p.xp}/${p.xpNext} XP</b></div>
          </div>
        </div>
        <div class="inv-right">
          <div class="grid-head"><span>Backpack</span><button class="mini-btn sort-bp">Sort</button></div>
          <div class="item-grid" data-container="backpack"></div>
          <div class="grid-head"><span>Ship Hold (${game.inventory.cargo.used}/${game.inventory.cargo.slots.length})</span><button class="mini-btn sort-cargo">Sort</button></div>
          <div class="item-grid" data-container="cargo"></div>
        </div>
      </div>`;

    // equipment slots
    const eq = body.querySelector('.equip-grid');
    for (const slot of EQUIP_SLOTS) {
      const id = game.inventory.equipment[slot];
      const cell = this._slotEl({ container: 'equip', slot }, id ? { id, qty: 1 } : null, SLOT_LABELS[slot]);
      eq.appendChild(cell);
    }
    this._fillGrid(body.querySelector('[data-container="backpack"]'), game.inventory.backpack, 'backpack');
    this._fillGrid(body.querySelector('[data-container="cargo"]'), game.inventory.cargo, 'cargo');

    body.querySelector('.sort-bp').addEventListener('click', () => {
      game.inventory.backpack.sort();
      game.events.emit('sfx', 'ui');
      this.render();
    });
    body.querySelector('.sort-cargo').addEventListener('click', () => {
      game.inventory.cargo.sort();
      game.events.emit('sfx', 'ui');
      this.render();
    });
  }

  _fillGrid(gridEl, container, name) {
    container.slots.forEach((s, i) => {
      gridEl.appendChild(this._slotEl({ container: name, index: i }, s));
    });
  }

  _slotEl(addr, item, placeholder = '') {
    const cell = document.createElement('div');
    cell.className = 'slot';
    cell.dataset.addr = JSON.stringify(addr);
    if (item) {
      const def = ITEMS[item.id];
      const r = RARITY[def.rarity];
      cell.classList.add('filled');
      cell.style.setProperty('--rar', r.color);
      if (r.glow) cell.classList.add('glow');
      cell.innerHTML = `<img draggable="false" src="${itemIcon(item.id).toDataURL()}" alt="${def.name}">
        ${item.qty > 1 ? `<span class="qty">${item.qty}</span>` : ''}`;
      cell.addEventListener('pointerenter', () => this._showTooltip(cell, item.id));
      cell.addEventListener('pointerleave', () => this.tooltip.classList.add('hidden'));
      cell.addEventListener('pointerdown', (e) => this._dragStart(e, addr, item));
      cell.addEventListener('dblclick', () => this._quickAction(addr, item));
    } else if (placeholder) {
      cell.innerHTML = `<span class="slot-label">${placeholder}</span>`;
    }
    return cell;
  }

  _showTooltip(cell, id) {
    const def = ITEMS[id];
    const r = RARITY[def.rarity];
    const stats = def.stats
      ? Object.entries(def.stats).map(([k, v]) => `<div class="tt-stat">+${v} ${k === 'critChance' ? 'crit%' : k === 'maxHealth' ? 'max health' : k === 'reloadSpeed' ? 'reload%' : k}</div>`).join('')
      : '';
    const extra = def.heal ? `<div class="tt-stat">Restores ${def.heal} health</div>`
      : def.repair ? `<div class="tt-stat">Repairs ${def.repair} hull</div>` : '';
    this.tooltip.innerHTML = `
      <div class="tt-name" style="color:${r.color}">${def.name}</div>
      <div class="tt-type">${r.name} ${def.slot ? SLOT_LABELS[def.slot] : def.type}</div>
      ${stats}${extra}
      <div class="tt-desc">${def.desc}</div>
      <div class="tt-value">${def.value} gold${def.slot ? ' · double-click to equip' : def.heal || def.repair ? ' · double-click to use' : ''}</div>`;
    const rect = cell.getBoundingClientRect();
    this.tooltip.classList.remove('hidden');
    const tw = this.tooltip.offsetWidth;
    this.tooltip.style.left = `${Math.min(window.innerWidth - tw - 8, rect.right + 6)}px`;
    this.tooltip.style.top = `${Math.min(window.innerHeight - this.tooltip.offsetHeight - 8, rect.top)}px`;
  }

  _quickAction(addr, item) {
    const { game } = this;
    const def = ITEMS[item.id];
    if (addr.container === 'equip') {
      // unequip back to backpack
      if (game.inventory.backpack.add(item.id, 1) === 0) {
        game.inventory.equipment[addr.slot] = null;
        game.player.recompute();
        game.events.emit('sfx', 'ui');
      }
    } else if (def.slot) {
      const source = addr.container === 'cargo' ? game.inventory.cargo : game.inventory.backpack;
      source.remove(item.id, 1);
      const prev = game.inventory.equip(item.id);
      if (prev) source.add(prev, 1);
      game.player.recompute();
      game.events.emit('sfx', 'equip');
    } else if (def.heal || def.repair || def.use) {
      game.useItem(item.id);
    } else {
      // shuttle between backpack and hold
      const from = addr.container === 'cargo' ? game.inventory.cargo : game.inventory.backpack;
      const to = addr.container === 'cargo' ? game.inventory.backpack : game.inventory.cargo;
      const moved = item.qty - to.add(item.id, item.qty);
      if (moved > 0) {
        from.remove(item.id, moved);
        game.events.emit('sfx', 'ui');
      }
    }
    this.render();
    this.tooltip.classList.add('hidden');
  }

  /* ---- drag & drop ------------------------------------------------------ */

  _dragStart(e, addr, item) {
    if (this.drag) return;
    e.preventDefault();
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.innerHTML = `<img src="${itemIcon(item.id).toDataURL()}" alt="">`;
    document.body.appendChild(ghost);
    this.drag = { from: addr, id: item.id, qty: item.qty, ghost };
    this._dragMove(e);
    this.tooltip.classList.add('hidden');
  }

  _dragMove(e) {
    if (!this.drag) return;
    this.drag.ghost.style.left = `${e.clientX}px`;
    this.drag.ghost.style.top = `${e.clientY}px`;
  }

  _dragEnd(e) {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    drag.ghost.remove();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = el?.closest?.('[data-addr]');
    if (slotEl) {
      this._drop(drag, JSON.parse(slotEl.dataset.addr));
    } else if (el?.closest?.('.quickbar')) {
      // dropped on quickbar background: ignore
    }
    this.render();
    this.game.events.emit('quickbar:changed');
  }

  _drop(drag, to) {
    const { game } = this;
    const inv = game.inventory;
    const def = ITEMS[drag.id];
    const containerOf = (a) => (a.container === 'backpack' ? inv.backpack : a.container === 'cargo' ? inv.cargo : null);

    // -> quickbar: assign a reference (consumables only)
    if (to.container === 'quickbar') {
      if (def.type === 'consumable') {
        inv.quickbar[to.index] = drag.id;
        game.events.emit('sfx', 'ui');
      } else {
        game.hud.toast('Only consumables go on the quick bar', '#e0b345');
      }
      return;
    }

    // from quickbar: dragging off clears the assignment
    if (drag.from.container === 'quickbar') {
      inv.quickbar[drag.from.index] = null;
      return;
    }

    // -> equipment
    if (to.container === 'equip') {
      if (def.slot !== to.slot) {
        game.hud.toast(`That doesn't fit the ${SLOT_LABELS[to.slot]} slot`, '#e0b345');
        return;
      }
      const src = containerOf(drag.from);
      if (drag.from.container === 'equip') return;
      src.remove(drag.id, 1);
      const prev = inv.equipment[to.slot];
      inv.equipment[to.slot] = drag.id;
      if (prev) src.add(prev, 1);
      game.player.recompute();
      game.events.emit('sfx', 'equip');
      return;
    }

    // from equipment -> grid
    if (drag.from.container === 'equip') {
      const dst = containerOf(to);
      if (dst.add(drag.id, 1) === 0) {
        inv.equipment[drag.from.slot] = null;
        game.player.recompute();
        game.events.emit('sfx', 'ui');
      }
      return;
    }

    // grid -> grid: merge stacks or swap
    const src = containerOf(drag.from);
    const dst = containerOf(to);
    if (!src || !dst) return;
    const sSlot = src.slots[drag.from.index];
    if (!sSlot || sSlot.id !== drag.id) return; // stale drag
    const dSlot = dst.slots[to.index];
    if (dSlot && dSlot.id === sSlot.id && ITEMS[sSlot.id].stack > 1) {
      const room = ITEMS[sSlot.id].stack - dSlot.qty;
      const move = Math.min(room, sSlot.qty);
      dSlot.qty += move;
      sSlot.qty -= move;
      if (sSlot.qty <= 0) src.slots[drag.from.index] = null;
    } else {
      src.slots[drag.from.index] = dSlot ?? null;
      dst.slots[to.index] = sSlot;
    }
    game.events.emit('sfx', 'ui');
  }

  /* ---- crew tab ---------------------------------------------------------- */

  _renderCrew(body) {
    const { game } = this;
    const rows = game.crew.members.map((m) => {
      const traits = m.traits.map((t) => `<span class="trait" title="${TRAITS[t].desc}">${TRAITS[t].name}</span>`).join('');
      const frac = m.health / m.maxHealth;
      return `<div class="crew-row" data-id="${m.id}">
        <canvas class="crew-face" width="22" height="30" data-id="${m.id}"></canvas>
        <div class="crew-info">
          <div class="crew-name">${m.name} <span class="crew-lvl">Lv ${m.level}</span></div>
          <div class="crew-hpbar"><div style="width:${Math.round(frac * 100)}%"></div></div>
          <div class="crew-meta">${ITEMS[m.weapon]?.name ?? 'Fists'} · ${traits}</div>
        </div>
        <button class="mini-btn dismiss-btn" data-id="${m.id}">Dismiss</button>
      </div>`;
    }).join('');
    body.innerHTML = `
      <div class="crew-list">
        ${rows || '<p class="empty-note">No crew yet. Rescue survivors, free castaways, or hire hands in port taverns.</p>'}
      </div>
      <p class="panel-note">Crew man the guns (faster reload), fight beside you in boardings — and can die there. Forever.</p>`;
    body.querySelectorAll('.crew-face').forEach((c) => {
      const m = game.crew.members.find((m) => m.id === c.dataset.id);
      if (m) drawPirate(c.getContext('2d'), m.appearance);
    });
    body.querySelectorAll('.dismiss-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const m = game.crew.members.find((m) => m.id === b.dataset.id);
        if (m && confirm(`Put ${m.name} ashore for good?`)) {
          game.crew.dismiss(b.dataset.id);
          this.render();
        }
      });
    });
  }

  /* ---- ship tab ------------------------------------------------------------ */

  _renderShip(body) {
    const { game } = this;
    const st = game.shipState;
    const hullFrac = st.hull / st.maxHull;
    const sailFrac = st.sailHp / st.maxSail;
    const upgrades = Object.entries(UPGRADES).map(([key, u]) => {
      const lvl = st.levels[key];
      return `<div class="up-row"><span>${u.name}</span>
        <span class="pips">${'●'.repeat(lvl)}${'○'.repeat(u.max - lvl)}</span></div>`;
    }).join('');
    const paints = PAINTS.filter((p) => st.paints.includes(p.id)).map((p) =>
      `<button class="mini-btn paint-btn ${st.paint === p.id ? 'active' : ''}" data-id="${p.id}">${p.name}</button>`).join('');
    body.innerHTML = `
      <div class="ship-panel">
        <div class="bar-row"><span>Hull</span><div class="bigbar"><div style="width:${hullFrac * 100}%;background:${hullFrac > 0.5 ? '#6fce62' : hullFrac > 0.25 ? '#e0b345' : '#e05a4a'}"></div></div><b>${Math.round(st.hull)}/${st.maxHull}</b></div>
        <div class="bar-row"><span>Sails</span><div class="bigbar"><div style="width:${sailFrac * 100}%;background:#bcd6f0"></div></div><b>${Math.round(st.sailHp)}/${st.maxSail}</b></div>
        <div class="ship-facts">
          <div><span>Cannons</span><b>${st.cannonsPerSide} / side (${st.cannonDamage} dmg)</b></div>
          <div><span>Cannonballs</span><b>${game.inventory.totalCount('cannonball')}</b></div>
          <div><span>Cargo</span><b>${game.inventory.cargo.used}/${st.cargoSlots} slots</b></div>
          <div><span>Crew</span><b>${game.crew.members.length}/${st.crewCapacity}</b></div>
        </div>
        <h4>Upgrades <span class="hint-inline">(fitted at any shipwright)</span></h4>
        ${upgrades}
        <h4>Paint</h4>
        <div class="paint-row">${paints}</div>
      </div>`;
    body.querySelectorAll('.paint-btn').forEach((b) => {
      b.addEventListener('click', () => {
        st.paint = b.dataset.id;
        game.events.emit('sfx', 'ui');
        this._renderShip(body);
      });
    });
  }
}
