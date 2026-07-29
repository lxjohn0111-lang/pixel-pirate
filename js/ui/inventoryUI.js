// The Captain's Log panel: Inventory (backpack, ship hold, equipment,
// stats), Crew and Ship tabs. Drag & drop between any grids, stacking,
// rarity-colored tooltips, sorting, double-click to equip/use, and
// quick-bar assignment. Opens with I (or the bag button).

import { ITEMS, RARITY, itemIcon } from '../items/itemdefs.js';
import { EQUIP_SLOTS } from '../items/inventory.js';
import { TRAITS, crewRole, hashId } from '../crew/crew.js';
import { UPGRADES, PAINTS } from '../entities/shipstate.js';
import { HULLS, HULL_ORDER } from '../entities/ships.js';
import { portraitCanvas, faceFromAppearance } from '../render/portrait.js';
import { crewCardHTML, paintCrewPortraits } from './crewcard.js';


const SLOT_LABELS = {
  sword: 'Sword', pistol: 'Pistol', musket: 'Musket', hat: 'Hat', coat: 'Coat',
  boots: 'Boots', ring: 'Ring', necklace: 'Necklace', charm: 'Charm', relic: 'Relic',
};

/** Filter chips. Item `type` is the source of truth; these just group it. */
const CATEGORIES = [
  { id: 'all', name: 'All', icon: '▦', types: null },
  { id: 'gear', name: 'Gear', icon: '⚔', types: ['weapon', 'armor'] },
  { id: 'trinket', name: 'Trinkets', icon: '💍', types: ['trinket', 'special'] },
  { id: 'supplies', name: 'Supplies', icon: '🍎', types: ['consumable', 'ammo'] },
  { id: 'materials', name: 'Materials', icon: '🪵', types: ['resource', 'shippart'] },
  { id: 'valuables', name: 'Valuables', icon: '💎', types: ['valuable', 'fish'] },
];

function matchesCategory(itemId, catId) {
  const cat = CATEGORIES.find((c) => c.id === catId);
  if (!cat || !cat.types) return true;
  return cat.types.includes(ITEMS[itemId]?.type);
}

/** One label/value row, optionally with a bar behind it. */
function statRow(label, value, frac = null, color = '#e0b345') {
  return `<div class="stat-row">
    <span>${label}</span>
    ${frac !== null ? `<div class="stat-bar"><i style="width:${Math.max(0, Math.min(1, frac)) * 100}%;background:${color}"></i></div>` : ''}
    <b>${value}</b>
  </div>`;
}

/** Human labels for the raw stat keys on item definitions. */
const STAT_LABELS = {
  attack: 'attack', defense: 'defense', critChance: 'crit %',
  maxHealth: 'max health', reloadSpeed: 'reload %', luck: 'luck', speed: 'speed',
};

export class InventoryUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.uiRoot = uiRoot;
    this.tab = 'inventory';
    this.filter = 'all';
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
    // Any tooltip belongs to a cell that is about to be replaced, so it
    // would otherwise hang around over whatever renders next.
    this.tooltip.classList.add('hidden');
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
    const bp = game.inventory.backpack;
    const cargo = game.inventory.cargo;
    const carried = bp.used + cargo.used;
    const total = bp.slots.length + cargo.slots.length;
    const worth = [...bp.slots, ...cargo.slots]
      .reduce((n, s) => n + (s ? (ITEMS[s.id]?.value ?? 0) * s.qty : 0), 0);

    body.innerHTML = `
      <div class="inv-layout">
        <aside class="inv-left">
          <section class="inv-panel">
            <h4>Equipped</h4>
            <div class="equip-grid"></div>
          </section>
          <section class="inv-panel">
            <h4>Captain</h4>
            <div class="stat-rows">
              ${statRow('Health', `${Math.round(p.health)}/${p.maxHealth}`, p.health / p.maxHealth, '#6fce62')}
              ${statRow('Attack', p.attack)}
              ${statRow('Defense', p.defense)}
              ${statRow('Crit', `${p.critChance}%`)}
              ${statRow('Reload', `+${p.reloadSpeed}%`)}
              ${statRow('Luck', p.luck)}
            </div>
            <div class="xp-row">
              <div class="xp-head"><span>Level ${p.level}</span><b>${p.xp}/${p.xpNext} XP</b></div>
              <div class="xp-bar"><i style="width:${Math.min(100, (p.xp / p.xpNext) * 100)}%"></i></div>
            </div>
          </section>
        </aside>
        <div class="inv-right">
          <div class="inv-toolbar">
            <div class="cat-chips">
              ${CATEGORIES.map((c) => `<button class="cat-chip ${c.id === this.filter ? 'active' : ''}"
                data-cat="${c.id}" title="${c.name}"><span>${c.icon}</span>${c.name}</button>`).join('')}
            </div>
            <div class="inv-meta">
              <span>${carried}/${total} slots</span>
              <span class="inv-worth">${worth}g of cargo</span>
              <button class="mini-btn sort-all">Sort</button>
            </div>
          </div>
          <section class="inv-panel">
            <div class="grid-head"><span>Backpack</span><i>${bp.used}/${bp.slots.length}</i></div>
            <div class="item-grid" data-container="backpack"></div>
          </section>
          <section class="inv-panel">
            <div class="grid-head"><span>Ship Hold</span><i>${cargo.used}/${cargo.slots.length}</i></div>
            <div class="item-grid" data-container="cargo"></div>
          </section>
          <p class="inv-hint">Drag to move · double-click to equip or use · drag onto the quick bar for consumables</p>
        </div>
      </div>`;

    // equipment slots
    const eq = body.querySelector('.equip-grid');
    for (const slot of EQUIP_SLOTS) {
      const id = game.inventory.equipment[slot];
      const cell = this._slotEl({ container: 'equip', slot }, id ? { id, qty: 1 } : null, SLOT_LABELS[slot]);
      eq.appendChild(cell);
    }
    this._fillGrid(body.querySelector('[data-container="backpack"]'), bp, 'backpack');
    this._fillGrid(body.querySelector('[data-container="cargo"]'), cargo, 'cargo');

    body.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      // Clicking the active category clears it, so the filter is never a trap.
      this.filter = this.filter === b.dataset.cat ? 'all' : b.dataset.cat;
      game.events.emit('sfx', 'ui');
      this.render();
    }));
    body.querySelector('.sort-all').addEventListener('click', () => {
      bp.sort();
      cargo.sort();
      game.events.emit('sfx', 'ui');
      this.render();
    });
  }

  _fillGrid(gridEl, container, name) {
    container.slots.forEach((s, i) => {
      const cell = this._slotEl({ container: name, index: i }, s);
      // Filtering dims rather than hides: slots keep their positions, so
      // drag targets never move under the cursor mid-filter.
      if (s && this.filter !== 'all' && !matchesCategory(s.id, this.filter)) {
        cell.classList.add('dimmed');
      }
      gridEl.appendChild(cell);
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
      cell.addEventListener('pointerenter', () => this._showTooltip(cell, item.id, addr));
      cell.addEventListener('pointerleave', () => this.tooltip.classList.add('hidden'));
      cell.addEventListener('pointerdown', (e) => this._dragStart(e, addr, item));
      cell.addEventListener('dblclick', () => this._quickAction(addr, item));
    } else if (placeholder) {
      cell.innerHTML = `<span class="slot-label">${placeholder}</span>`;
    }
    return cell;
  }

  _showTooltip(cell, id, addr = null) {
    const def = ITEMS[id];
    const r = RARITY[def.rarity];
    // For anything wearable, compare against what is already in that slot
    // — the useful question is never "what does this do", it is "is this
    // better than mine".
    const equippedId = def.slot ? this.game.inventory.equipment[def.slot] : null;
    const comparing = def.slot && equippedId && equippedId !== id && addr?.container !== 'equip';
    const equipped = comparing ? ITEMS[equippedId] : null;

    const keys = new Set([
      ...Object.keys(def.stats ?? {}),
      ...Object.keys(equipped?.stats ?? {}),
    ]);
    const stats = [...keys].map((k) => {
      const mine = def.stats?.[k] ?? 0;
      const theirs = equipped?.stats?.[k] ?? 0;
      const label = STAT_LABELS[k] ?? k;
      if (!comparing) return `<div class="tt-stat">+${mine} ${label}</div>`;
      const d = mine - theirs;
      const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'same';
      const sign = d > 0 ? `+${d}` : d < 0 ? `${d}` : '±0';
      return `<div class="tt-stat cmp ${cls}"><span>+${mine} ${label}</span><b>${sign}</b></div>`;
    }).join('');

    const extra = def.heal ? `<div class="tt-stat">Restores ${def.heal} health</div>`
      : def.repair ? `<div class="tt-stat">Repairs ${def.repair} hull</div>` : '';
    const action = def.slot ? 'double-click to equip'
      : def.heal || def.repair || def.use ? 'double-click to use' : '';

    this.tooltip.innerHTML = `
      <div class="tt-head" style="--rar:${r.color}">
        <img class="tt-icon" src="${itemIcon(id).toDataURL()}" alt="">
        <div>
          <div class="tt-name" style="color:${r.color}">${def.name}</div>
          <div class="tt-type">${r.name} · ${def.slot ? SLOT_LABELS[def.slot] : def.type}</div>
        </div>
      </div>
      ${stats ? `<div class="tt-stats">${stats}</div>` : ''}${extra}
      ${comparing ? `<div class="tt-vs">compared with ${equipped.name}</div>` : ''}
      <div class="tt-desc">${def.desc}</div>
      <div class="tt-foot"><span class="tt-value">${def.value} gold</span>${action ? `<span class="tt-action">${action}</span>` : ''}</div>`;
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
    const members = game.crew.members;
    const b = game.crew.bonuses();
    // What the crew is actually worth, stated once, so the cards read as
    // people rather than as a list of modifiers.
    const summary = [
      b.reload ? `+${Math.round(b.reload * 100)}% reload` : null,
      b.sail ? `+${Math.round(b.sail * 100)}% speed` : null,
      b.cannon ? `+${Math.round(b.cannon * 100)}% cannon damage` : null,
      b.luck ? `+${b.luck} luck` : null,
    ].filter(Boolean).join(' · ');

    body.innerHTML = `
      <div class="crew-head">
        <div>
          <h4>Your Crew <span class="crew-count">${members.length}/${game.crew.capacity}</span></h4>
          <p class="panel-note">${summary || 'An empty deck. Hire hands at any port tavern.'}</p>
        </div>
      </div>
      <div class="crew-cards">
        ${members.map((m, i) => crewCardHTML(m, i, { action: 'Put ashore', ghost: true })).join('')
          || '<p class="empty-note">No crew yet. Rescue survivors, free castaways, or hire hands in port taverns.</p>'}
      </div>
      <p class="panel-note">Crew man the guns, fight beside you in boardings — and can die there. Forever.</p>`;

    paintCrewPortraits(body, members);
    body.querySelectorAll('.crew-action').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = members[Number(btn.dataset.i)];
        if (m && confirm(`Put ${m.name} ashore for good?`)) {
          game.crew.dismiss(m.id);
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
    const ownedCount = st.ownedHulls.length;
    body.innerHTML = `
      <div class="ship-panel">
        <div class="ship-ident">
          <div>
            <span class="ship-eyebrow">Your command</span>
            <h4>${st.hullDef.name}</h4>
            <p class="panel-note">${st.hullDef.tagline}</p>
          </div>
          <span class="ship-fleet">${ownedCount}/${HULL_ORDER.length} hulls owned</span>
        </div>
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
        <p class="panel-note">Bigger hulls are bought at a port Shipyard. Upgrades move with you.</p>
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
