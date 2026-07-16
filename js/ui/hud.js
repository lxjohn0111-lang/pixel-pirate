// In-game HUD: resource counters, compass, health/XP, ship hull, quick
// bar, interact prompt, toasts, quest guide arrow and touch buttons.
// DOM-based so it stays crisp at any resolution.

import { hudCoinIcon, hudWoodIcon } from '../render/sprites.js';
import { ITEMS, itemIcon } from '../items/itemdefs.js';
import { QUICKBAR_SIZE } from '../items/inventory.js';

export class HUD {
  constructor(uiRoot, game) {
    this.game = game;
    const touch = 'ontouchstart' in window;
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-topleft">
        <div class="hud-resources">
          <div class="hud-counter" id="hud-coins"><img alt="gold"><span>0</span></div>
          <div class="hud-counter" id="hud-wood"><img alt="wood"><span>0</span></div>
        </div>
        <div class="hud-bars">
          <div class="hud-bar hp-bar" title="Health"><div class="fill"></div><span class="bar-text"></span></div>
          <div class="hud-bar xp-bar" title="Experience"><div class="fill"></div><span class="bar-text lvl-text"></span></div>
          <div class="hud-bar hull-bar" title="Ship hull"><div class="fill"></div><span class="bar-text"></span></div>
        </div>
      </div>
      <div class="hud-sidebtns">
        <button class="pause-btn hud-btn" aria-label="Pause">II</button>
        <button class="hud-btn bag-btn" aria-label="Inventory (I)">⚔</button>
        <button class="hud-btn map-btn" aria-label="Map (M)">🗺</button>
      </div>
      <div class="compass">
        <span class="compass-n">N</span><span class="compass-e">E</span>
        <span class="compass-s">S</span><span class="compass-w">W</span>
        <div class="compass-needle"></div>
        <div class="quest-arrow hidden"></div>
      </div>
      <div class="quickbar"></div>
      <div class="interact-prompt hidden"></div>
      <div class="toasts"></div>
      <div class="hint">${touch ? 'Drag to sail · tap ✕ to fire' : 'WASD sail · Space fire · F interact · I inventory · M map'}</div>
      ${touch ? `
      <div class="touch-actions">
        <button class="hud-btn fire-btn" aria-label="Fire cannons">✕</button>
        <button class="hud-btn interact-btn hidden" aria-label="Interact">F</button>
      </div>
      <div class="board-actions hidden">
        <button class="hud-btn sword-tbtn">🗡</button>
        <button class="hud-btn pistol-tbtn">🔫</button>
        <button class="hud-btn dash-tbtn">💨</button>
      </div>` : ''}`;
    uiRoot.appendChild(this.el);

    this.el.querySelector('#hud-coins img').src = hudCoinIcon().toDataURL();
    this.el.querySelector('#hud-wood img').src = hudWoodIcon().toDataURL();
    this.coinsEl = this.el.querySelector('#hud-coins span');
    this.woodEl = this.el.querySelector('#hud-wood span');
    this.needle = this.el.querySelector('.compass-needle');
    this.questArrow = this.el.querySelector('.quest-arrow');
    this.hint = this.el.querySelector('.hint');
    this.prompt = this.el.querySelector('.interact-prompt');
    this.toastsEl = this.el.querySelector('.toasts');
    this.quickbarEl = this.el.querySelector('.quickbar');
    this.hpFill = this.el.querySelector('.hp-bar .fill');
    this.hpText = this.el.querySelector('.hp-bar .bar-text');
    this.xpFill = this.el.querySelector('.xp-bar .fill');
    this.lvlText = this.el.querySelector('.lvl-text');
    this.hullBar = this.el.querySelector('.hull-bar');
    this.hullFill = this.el.querySelector('.hull-bar .fill');
    this.hullText = this.el.querySelector('.hull-bar .bar-text');

    this.el.querySelector('.pause-btn').addEventListener('click', () => game.events.emit('input:pause'));
    this.el.querySelector('.bag-btn').addEventListener('click', () => game.inventoryUI.toggle());
    this.el.querySelector('.map-btn').addEventListener('click', () => game.mapUI.toggle());
    this.el.querySelector('.fire-btn')?.addEventListener('pointerdown', () => game.input.pressVirtual('Space'));
    this.el.querySelector('.interact-btn')?.addEventListener('pointerdown', () => game.input.pressVirtual('KeyF'));
    this.el.querySelector('.sword-tbtn')?.addEventListener('pointerdown', () => game.input.pressVirtual('SwordBtn'));
    this.el.querySelector('.pistol-tbtn')?.addEventListener('pointerdown', () => game.input.pressVirtual('PistolBtn'));
    this.el.querySelector('.dash-tbtn')?.addEventListener('pointerdown', () => game.input.pressVirtual('DashBtn'));

    game.events.on('resources:changed', (r) => this._setResources(r));
    game.events.on('player:changed', () => this._refreshBars());
    game.events.on('playership:damaged', () => this._refreshBars());
    game.events.on('quickbar:changed', () => this.renderQuickbar());
    game.events.on('player:levelup', ({ level }) => this.toast(`Level up! You are now level ${level}`, '#f0d090'));
    game.events.on('boarding:start', () => this.el.querySelector('.board-actions')?.classList.remove('hidden'));
    game.events.on('boarding:end', () => this.el.querySelector('.board-actions')?.classList.add('hidden'));

    this._setResources(game.resources);
    this._refreshBars();
    this.renderQuickbar();
    setTimeout(() => this.hint.classList.add('fade'), 10000);
  }

  _setResources(r) {
    this._pop(this.coinsEl, r.coins);
    this._pop(this.woodEl, this.game.inventory.totalCount('wood'));
  }

  _pop(el, value) {
    const str = String(value);
    if (el.textContent !== str) {
      el.textContent = str;
      el.parentElement.classList.remove('pop');
      void el.parentElement.offsetWidth;
      el.parentElement.classList.add('pop');
    }
  }

  _refreshBars() {
    const p = this.game.player;
    const st = this.game.shipState;
    const hpFrac = p.health / p.maxHealth;
    this.hpFill.style.width = `${hpFrac * 100}%`;
    this.hpFill.style.background = hpFrac > 0.5 ? '#6fce62' : hpFrac > 0.25 ? '#e0b345' : '#e05a4a';
    this.hpText.textContent = `${Math.round(p.health)}/${p.maxHealth}`;
    this.xpFill.style.width = `${(p.xp / p.xpNext) * 100}%`;
    this.lvlText.textContent = `Lv ${p.level}`;
    const hullFrac = st.hull / st.maxHull;
    this.hullFill.style.width = `${hullFrac * 100}%`;
    this.hullFill.style.background = hullFrac > 0.5 ? '#c9a06a' : hullFrac > 0.25 ? '#e0b345' : '#e05a4a';
    this.hullText.textContent = `Hull ${Math.round(st.hull)}`;
    this.hullBar.classList.toggle('danger', st.inDanger);
  }

  renderQuickbar() {
    const { game } = this;
    this.quickbarEl.innerHTML = '';
    for (let i = 0; i < QUICKBAR_SIZE; i++) {
      const id = game.inventory.quickbar[i];
      const count = id ? game.inventory.totalCount(id) : 0;
      const cell = document.createElement('div');
      cell.className = `slot qb-slot ${id && count > 0 ? 'filled' : ''}`;
      cell.dataset.addr = JSON.stringify({ container: 'quickbar', index: i });
      cell.innerHTML = `<span class="qb-key">${i + 1}</span>` + (id
        ? `<img draggable="false" src="${itemIcon(id).toDataURL()}" alt="${ITEMS[id].name}"><span class="qty">${count}</span>`
        : '');
      cell.addEventListener('click', () => game.useQuickbar(i));
      this.quickbarEl.appendChild(cell);
    }
  }

  toast(text, color = '#e8ddc4') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderColor = color;
    t.style.color = color;
    t.textContent = text;
    this.toastsEl.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3400);
    setTimeout(() => t.remove(), 4000);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstChild.remove();
  }

  showPrompt(text) {
    this.prompt.textContent = text;
    this.prompt.classList.remove('hidden');
    this.el.querySelector('.interact-btn')?.classList.remove('hidden');
  }

  hidePrompt() {
    this.prompt.classList.add('hidden');
    this.el.querySelector('.interact-btn')?.classList.add('hidden');
  }

  /** Called every frame. */
  update() {
    const { game } = this;
    const deg = (game.ship.heading * 180) / Math.PI + 90;
    this.needle.style.transform = `translate(-50%,-100%) rotate(${deg}deg)`;

    // guide arrow to the nearest contract objective
    const q = game.quests.trackedTarget();
    if (q) {
      const a = Math.atan2(q.y - game.ship.y, q.x - game.ship.x);
      this.questArrow.classList.remove('hidden');
      this.questArrow.style.transform = `translate(-50%,-50%) rotate(${(a * 180) / Math.PI + 90}deg)`;
    } else {
      this.questArrow.classList.add('hidden');
    }
  }

  destroy() {
    this.el.remove();
  }
}
