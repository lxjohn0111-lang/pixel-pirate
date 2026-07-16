// Small modal popups: loot results (with rarity fanfare), crew recruit
// offers, and message-bottle notes. All DOM, all keyboard/touch friendly.

import { ITEMS, RARITY, itemIcon, bestRarity } from '../items/itemdefs.js';

export class LootUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.uiRoot = uiRoot;
    this.el = null;
  }

  get isOpen() {
    return !!this.el;
  }

  _open(html, className = '') {
    this.close();
    const el = document.createElement('div');
    el.className = `screen modal-screen ${className}`;
    el.innerHTML = html;
    this.uiRoot.appendChild(el);
    this.el = el;
    return el;
  }

  close() {
    this.el?.remove();
    this.el = null;
  }

  /** Show rolled loot; taking it grants everything. */
  showLoot(title, drops, onTaken) {
    const rare = RARITY[bestRarity(drops)];
    const rows = drops.items.map((it) => {
      const def = ITEMS[it.id];
      const r = RARITY[def.rarity];
      return `<div class="loot-row" style="--rar:${r.color}">
        <img src="${itemIcon(it.id).toDataURL()}" alt="">
        <span class="loot-name">${def.name}</span>
        <span class="loot-qty">${it.qty > 1 ? 'x' + it.qty : ''}</span>
        <span class="loot-rar">${r.name}</span>
      </div>`;
    }).join('');
    const gold = drops.gold > 0
      ? `<div class="loot-row loot-gold"><span class="loot-coin"></span><span class="loot-name">Gold</span><span class="loot-qty">x${drops.gold}</span></div>`
      : '';
    const el = this._open(`
      <div class="modal loot-modal ${rare.glow ? 'loot-shine' : ''}" style="--shine:${rare.color}">
        <h3>${title}</h3>
        <div class="loot-list">${gold}${rows || (drops.gold ? '' : '<p class="loot-empty">Nothing but seaweed...</p>')}</div>
        <button class="btn btn-primary take-btn">Take All</button>
      </div>`);
    el.querySelector('.take-btn').addEventListener('click', () => {
      this.close();
      onTaken();
    });
  }

  /** Yes/no recruit offer for a rescued or hired pirate. */
  showRecruit(member, flavor, onAnswer) {
    const traits = member.traits.map((t) => `<span class="trait">${t}</span>`).join(' ');
    const full = this.game.crew.members.length >= this.game.crew.capacity;
    const el = this._open(`
      <div class="modal recruit-modal">
        <h3>${flavor}</h3>
        <div class="recruit-card">
          <canvas class="recruit-face" width="22" height="30"></canvas>
          <div>
            <div class="recruit-name">${member.name}</div>
            <div class="recruit-meta">Level ${member.level} &middot; ${ITEMS[member.weapon]?.name ?? 'Fists'}</div>
            <div class="recruit-traits">${traits}</div>
          </div>
        </div>
        ${full ? '<p class="warn">Your crew quarters are full!</p>' : ''}
        <div class="modal-btns">
          <button class="btn btn-primary yes-btn" ${full ? 'disabled' : ''}>Welcome Aboard</button>
          <button class="btn btn-ghost no-btn">Turn Away</button>
        </div>
      </div>`);
    // draw the face using the full pirate renderer
    import('../render/pirate.js').then(({ drawPirate }) => {
      const ctx = el.querySelector('.recruit-face')?.getContext('2d');
      if (ctx) drawPirate(ctx, member.appearance);
    });
    el.querySelector('.yes-btn').addEventListener('click', () => {
      this.close();
      onAnswer(true);
    });
    el.querySelector('.no-btn').addEventListener('click', () => {
      this.close();
      onAnswer(false);
    });
  }

  /** Flavor-text note (message bottles, port rumors). */
  showMessage(title, body, footer = '') {
    const el = this._open(`
      <div class="modal message-modal">
        <h3>${title}</h3>
        <p class="message-body">${body}</p>
        ${footer ? `<p class="message-footer">${footer}</p>` : ''}
        <button class="btn btn-primary ok-btn">Aye</button>
      </div>`);
    el.querySelector('.ok-btn').addEventListener('click', () => this.close());
  }
}
