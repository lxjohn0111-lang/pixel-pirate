// Minimal in-game HUD: resource counters, compass, pause button and a
// fading control hint. DOM-based so it stays crisp at any resolution.

import { hudCoinIcon, hudWoodIcon } from '../render/sprites.js';

export class HUD {
  constructor(uiRoot, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-resources">
        <div class="hud-counter" id="hud-coins"><img alt="gold"><span>0</span></div>
        <div class="hud-counter" id="hud-wood"><img alt="wood"><span>0</span></div>
      </div>
      <button class="pause-btn" aria-label="Pause">II</button>
      <div class="compass">
        <span class="compass-n">N</span><span class="compass-e">E</span>
        <span class="compass-s">S</span><span class="compass-w">W</span>
        <div class="compass-needle"></div>
      </div>
      <div class="hint">${'ontouchstart' in window ? 'Drag anywhere to sail' : 'WASD or Arrow Keys to sail &middot; Esc to pause'}</div>`;
    uiRoot.appendChild(this.el);

    this.el.querySelector('#hud-coins img').src = hudCoinIcon().toDataURL();
    this.el.querySelector('#hud-wood img').src = hudWoodIcon().toDataURL();
    this.coinsEl = this.el.querySelector('#hud-coins span');
    this.woodEl = this.el.querySelector('#hud-wood span');
    this.needle = this.el.querySelector('.compass-needle');
    this.hint = this.el.querySelector('.hint');

    this.el.querySelector('.pause-btn').addEventListener('click', () => {
      game.events.emit('input:pause');
    });

    game.events.on('resources:changed', (r) => this._setResources(r));
    this._setResources(game.resources);

    setTimeout(() => this.hint.classList.add('fade'), 9000);
  }

  _setResources(r) {
    this._pop(this.coinsEl, r.coins);
    this._pop(this.woodEl, r.wood);
  }

  _pop(el, value) {
    const str = String(value);
    if (el.textContent !== str) {
      el.textContent = str;
      el.parentElement.classList.remove('pop');
      // restart the pop animation
      void el.parentElement.offsetWidth;
      el.parentElement.classList.add('pop');
    }
  }

  /** Called every frame: compass needle tracks the ship's heading. */
  update() {
    const deg = (this.game.ship.heading * 180) / Math.PI + 90;
    this.needle.style.transform = `translate(-50%,-100%) rotate(${deg}deg)`;
  }

  destroy() {
    this.el.remove();
  }
}
