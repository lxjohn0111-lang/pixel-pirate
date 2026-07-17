// The homestead screen: build structures, use the warehouse, admire
// the treasure room. Opens when mooring at the captain's own isle.

import { BUILDINGS } from '../world/homestead.js';
import { ITEMS, RARITY, itemIcon } from '../items/itemdefs.js';

export class HomeUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'panel captain-panel hidden';
    uiRoot.appendChild(this.el);
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open() {
    this.el.classList.remove('hidden');
    this.game.homestead.onVisit();
    this.game.events.emit('sfx', 'ui');
    this.render();
  }

  close() {
    this.el.classList.add('hidden');
    this.game.save();
  }

  render() {
    const { game } = this;
    const home = game.homestead;
    const rows = Object.entries(BUILDINGS).map(([key, b]) => {
      if (home.built.has(key)) {
        return `<div class="up-row done"><div><span>${b.name}</span><div class="up-desc">${b.desc}</div></div><b>BUILT</b></div>`;
      }
      const parts = Object.entries(b.cost).map(([res, amt]) => {
        const have = res === 'gold' ? game.resources.coins : game.inventory.totalCount(res);
        return `<span class="${have >= amt ? '' : 'missing'}">${amt} ${res}</span>`;
      }).join(' · ');
      const can = Object.entries(b.cost).every(([res, amt]) =>
        (res === 'gold' ? game.resources.coins : game.inventory.totalCount(res)) >= amt);
      return `<div class="up-row">
        <div><span>${b.name}</span><div class="up-desc">${b.desc}</div></div>
        <div class="up-cost">${parts}</div>
        <button class="mini-btn build-btn" data-key="${key}" ${can ? '' : 'disabled'}>Build</button>
      </div>`;
    }).join('');

    const trophies = home.built.has('treasury')
      ? `<h4>Treasure Room</h4><div class="trophy-row">
          ${home.trophies().map((id) => {
            const def = ITEMS[id];
            const r = RARITY[def.rarity];
            return `<div class="slot filled glow" style="--rar:${r.color}" title="${def.name}">
              <img src="${itemIcon(id).toDataURL()}" alt="${def.name}"></div>`;
          }).join('') || '<p class="empty-note">Bring back wonders to display.</p>'}
        </div>`
      : '';

    const warehouse = home.built.has('warehouse')
      ? `<h4>Warehouse (${home.storage.used}/${home.storage.slots.length})
          <span class="hint-inline">(double-click items in your inventory panel to shuttle; here: click to withdraw)</span></h4>
        <div class="item-grid">
          ${home.storage.slots.map((s, i) => {
            if (!s) return '<div class="slot"></div>';
            const def = ITEMS[s.id];
            return `<div class="slot filled wh-slot" data-i="${i}" style="--rar:${RARITY[def.rarity].color}" title="${def.name} — click to withdraw">
              <img src="${itemIcon(s.id).toDataURL()}" alt="">${s.qty > 1 ? `<span class="qty">${s.qty}</span>` : ''}</div>`;
          }).join('')}
        </div>
        <button class="mini-btn deposit-btn">Deposit valuables from backpack</button>`
      : '';

    this.el.innerHTML = `
      <div class="panel-head">
        <div class="port-title"><h3>⚓ ${home.isle?.name ?? 'Your Isle'}</h3><span>${game.resources.coins} gold</span></div>
        <button class="close-btn" aria-label="Leave">✕</button>
      </div>
      <div class="panel-body">
        <h4>Build</h4>
        ${rows}
        ${warehouse}
        ${trophies}
      </div>`;
    this.el.querySelector('.close-btn').addEventListener('click', () => this.close());
    this.el.querySelectorAll('.build-btn').forEach((b) => {
      b.addEventListener('click', () => {
        if (game.homestead.build(b.dataset.key)) this.render();
      });
    });
    this.el.querySelectorAll('.wh-slot').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.dataset.i);
        const s = game.homestead.storage.slots[i];
        if (!s) return;
        const left = game.inventory.backpack.add(s.id, s.qty);
        const moved = s.qty - left;
        if (moved > 0) {
          s.qty -= moved;
          if (s.qty <= 0) game.homestead.storage.slots[i] = null;
          game.events.emit('sfx', 'ui');
          this.render();
        }
      });
    });
    this.el.querySelector('.deposit-btn')?.addEventListener('click', () => {
      // shuttle valuables & fish over
      let moved = 0;
      for (const s of [...game.inventory.backpack.slots]) {
        if (!s) continue;
        const def = ITEMS[s.id];
        if (def.type === 'valuable' || def.type === 'fish' || def.type === 'special') {
          const left = game.homestead.storage.add(s.id, s.qty);
          const took = s.qty - left;
          if (took > 0) {
            game.inventory.backpack.remove(s.id, took);
            moved += took;
          }
        }
      }
      game.hud.toast(moved ? `Stored ${moved} items.` : 'Nothing suitable to store.', moved ? '#6fce62' : '#e0b345');
      this.render();
    });
  }
}
