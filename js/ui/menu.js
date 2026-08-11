// The main menu: the first ten seconds of the game.
//
// Whoever lands here has not decided to play yet, so this screen has one
// job — make the next click obvious and make it look worth taking. Three
// things do that work:
//
//   1. The backdrop is not a picture of the game, it *is* the game. The
//      same Water, DayNight and Weather systems the ocean uses at sea run
//      here, with real ships sailing across a real sea. Nothing on this
//      screen promises something the game does not deliver.
//   2. One primary action, sized and coloured so it cannot be missed. A
//      returning captain gets Continue with their own name, level, purse
//      and chapter on it — the strongest possible reason to press it.
//   3. Everything else is small and out of the way. Character creation is
//      a whole screen of choices, so it waits behind New Game rather than
//      standing between a first-time player and the sea.

import { Water } from '../render/water.js';
import { DayNight } from '../world/daynight.js';
import { Weather } from '../world/weather.js';
import {
  shipHull, shipSail, shipFlag, aiShipHull, aiShipSail, SHIP_W, SHIP_H,
} from '../render/sprites.js';
import { Graveyard } from '../meta/graveyard.js';
import { CAUSES } from '../core/mortality.js';
import { MAIN_CHAPTERS } from '../quests/mainquest.js';
import { HULLS } from '../entities/ships.js';
import { rgb, TAU } from '../util/math.js';
import { rand2 } from '../util/random.js';

/** Backbuffer scale: the same 1/3 the game renders at, so it matches. */
const SCALE = 3;

/** What the game is, in five words the player can scan in a second. */
const CHIPS = [
  ['⚔', 'Board and fight'],
  ['⚑', 'Six pirate clans'],
  ['☠', 'Five great ships'],
  ['🗺', 'An endless ocean'],
  ['♛', 'Become Pirate King'],
];

const HOW_TO = [
  ['Sail', 'WASD or arrow keys — or drag anywhere on a touchscreen.'],
  ['Fire', 'Space fires a broadside. Turn side-on to bring the guns to bear.'],
  ['Board', 'Beat a ship down, pull alongside and press F to fight on their deck.'],
  ['Dock', 'Press F at a harbour: shipyard, tavern, market and the bounty board.'],
  ['Everything else', 'I for your hold and crew, M for the chart, L for the log.'],
];

export class MainMenu {
  /**
   * @param {HTMLElement} uiRoot
   * @param {object|null} save    the stored voyage, if there is one
   * @param {{onContinue: Function, onNew: Function}} handlers
   */
  constructor(uiRoot, save, handlers) {
    this.uiRoot = uiRoot;
    this.save = save;
    this.handlers = handlers;
    this.el = null;
    this._raf = 0;
    this.t = 0;

    // The live ocean. Same systems, same look, no special case.
    this.water = new Water();
    this.dayNight = new DayNight({ t: 0.42 });   // bright, inviting morning
    this.weather = new Weather(0x5ea0f, { current: 'sunny' });
    this._events = { emit() {} };                // the sea talks to nobody here
    this.camX = 0;
    this.camY = 0;
    this.ships = this._makeFleet();
    this.gulls = this._makeGulls();
  }

  /* ------------------------------------------------------------------ */
  /* The scene                                                           */
  /* ------------------------------------------------------------------ */

  _makeFleet() {
    // One hero ship close to the camera and a small convoy behind it, so
    // the sea reads as inhabited rather than empty.
    // Sized to read at a glance rather than to dominate: the hero hull is
    // about what a player sees under their own camera, and everything
    // behind it is smaller and slower, which is what makes it look deep.
    return [
      { hero: true, x: -160, y: 76, heading: 0.24, speed: 20, scale: 0.72, wake: [] },
      { type: 'merchant', x: 250, y: -150, heading: Math.PI * 0.84, speed: 12, scale: 0.42, wake: [] },
      { type: 'pirate', x: 470, y: 210, heading: Math.PI * 1.14, speed: 15, scale: 0.4, wake: [] },
      { type: 'fishing', x: -430, y: -210, heading: 0.46, speed: 8, scale: 0.3, wake: [] },
      { type: 'navy', x: 90, y: -280, heading: Math.PI * 0.96, speed: 13, scale: 0.36, wake: [] },
      { type: 'merchant', x: -120, y: 300, heading: Math.PI * 0.12, speed: 10, scale: 0.34, wake: [] },
    ];
  }

  _makeGulls() {
    return Array.from({ length: 5 }, (_, i) => ({
      x: rand2(4242, i, 0) * 900 - 300,
      y: rand2(4242, i, 1) * 500 - 250,
      speed: 34 + rand2(4242, i, 2) * 26,
      phase: rand2(4242, i, 3) * TAU,
    }));
  }

  _step(dt) {
    this.t += dt;
    this.dayNight.update(dt * 0.55, this._events);
    this.weather.update(dt, this._events);
    // A slow drift is what sells "endless" — the ocean is never still.
    this.camX += dt * 9;
    this.camY += dt * 3;

    for (const s of this.ships) {
      s.x += Math.cos(s.heading) * s.speed * dt;
      s.y += Math.sin(s.heading) * s.speed * dt;
      s.wake.push({ x: s.x - Math.cos(s.heading) * 26 * s.scale, y: s.y - Math.sin(s.heading) * 26 * s.scale, life: 1 });
      if (s.wake.length > 26) s.wake.shift();
      for (const w of s.wake) w.life -= dt * 0.5;
      // Wrap around the actual view so the fleet stays on screen at any
      // window size, and always re-enters from just off the edge.
      const halfW = (this.canvas?.width ?? 480) / 2 + 70;
      const halfH = (this.canvas?.height ?? 280) / 2 + 70;
      const dx = s.x - this.camX;
      if (dx > halfW) s.x -= halfW * 2;
      if (dx < -halfW) s.x += halfW * 2;
      const dy = s.y - this.camY;
      if (dy > halfH) s.y -= halfH * 2;
      if (dy < -halfH) s.y += halfH * 2;
    }
    const gw = (this.canvas?.width ?? 480) / 2 + 40;
    const gh = (this.canvas?.height ?? 280) / 2 + 40;
    for (const bird of this.gulls) {
      bird.x += bird.speed * dt;
      if (bird.x - this.camX > gw) bird.x -= gw * 2;
      const dy = bird.y - this.camY;
      if (dy > gh) bird.y -= gh * 2;
      if (dy < -gh) bird.y += gh * 2;
    }
  }

  _draw() {
    const c = this.canvas;
    if (!c) return;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const w = c.width;
    const h = c.height;
    const viewX = Math.round(this.camX - w / 2);
    const viewY = Math.round(this.camY - h / 2);

    g.save();
    g.translate(-viewX, -viewY);
    this.water.draw(g, viewX, viewY, w, h, this.t, this.dayNight, this.weather);

    // Wakes first, so hulls sit on top of their own foam.
    const s = this.dayNight.snapshot;
    g.fillStyle = rgb(s.hi);
    for (const ship of this.ships) {
      for (const p of ship.wake) {
        if (p.life <= 0) continue;
        g.globalAlpha = p.life * 0.4;
        g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
      }
    }
    g.globalAlpha = 1;

    for (const ship of this.ships) this._drawShip(g, ship);

    // Gulls: two strokes each, and the sea feels twice as big.
    g.fillStyle = 'rgba(232,221,196,0.75)';
    for (const bird of this.gulls) {
      const flap = Math.sin(this.t * 6 + bird.phase) * 2;
      const x = Math.round(bird.x);
      const y = Math.round(bird.y);
      g.fillRect(x - 3, y - flap, 3, 1);
      g.fillRect(x + 1, y - flap, 3, 1);
    }
    g.restore();
  }

  _drawShip(g, ship) {
    const hull = ship.hero ? shipHull() : aiShipHull(ship.type);
    const sail = ship.hero ? shipSail(2) : aiShipSail(ship.type);
    g.save();
    g.translate(Math.round(ship.x), Math.round(ship.y + Math.sin(this.t * 1.6 + ship.x) * 1.2));
    g.rotate(ship.heading);
    g.scale(ship.scale, ship.scale);
    g.fillStyle = 'rgba(8,20,40,0.28)';
    g.beginPath();
    g.ellipse(0, 4, SHIP_W * 0.5, SHIP_H * 0.32, 0, 0, TAU);
    g.fill();
    g.drawImage(hull, -hull.width / 2, -hull.height / 2);
    g.drawImage(sail, -sail.width / 2, -sail.height / 2);
    if (ship.hero) g.drawImage(shipFlag(((this.t * 6) | 0) % 3), -12, -3);
    g.restore();
  }

  /* ------------------------------------------------------------------ */
  /* The screen                                                          */
  /* ------------------------------------------------------------------ */

  show() {
    this.hide();
    const save = this.save;
    const graves = Graveyard.list();

    const el = document.createElement('div');
    el.className = 'screen main-menu';
    el.innerHTML = `
      <canvas class="menu-sea"></canvas>
      <div class="menu-veil"></div>
      <div class="menu-inner">
        <header class="menu-title">
          <h1>Sea of Rogues</h1>
          <p class="menu-tagline">An endless ocean. Six clans. One crown.</p>
        </header>

        <div class="menu-actions">
          ${save ? `
            <button class="btn menu-cta menu-continue">
              <span class="menu-cta-main"><span class="menu-play">▸</span> Continue Voyage</span>
              <span class="menu-cta-sub"></span>
            </button>
            <button class="btn btn-ghost menu-new">New Game<small>A new pirate and a new sea</small></button>
          ` : `
            <button class="btn menu-cta menu-new">
              <span class="menu-cta-main"><span class="menu-play">▸</span> Set Sail</span>
              <span class="menu-cta-sub">Make your pirate and take the helm</span>
            </button>
          `}
        </div>

        <ul class="menu-chips">
          ${CHIPS.map(([icon, label]) => `<li><span>${icon}</span>${label}</li>`).join('')}
        </ul>

        <footer class="menu-foot">
          <button class="menu-link menu-how">How to Play</button>
          ${graves.length ? '<button class="menu-link menu-graves">The Graveyard</button>' : ''}
          <span class="menu-note">Plays in your browser. Saves as you go.</span>
        </footer>
      </div>
      <div class="menu-panel hidden"></div>`;
    this.uiRoot.appendChild(el);
    this.el = el;

    if (save) this._fillSaveLine(el.querySelector('.menu-cta-sub'));

    this.canvas = el.querySelector('.menu-sea');
    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);

    el.querySelector('.menu-continue')?.addEventListener('click', () => {
      this.hide();
      this.handlers.onContinue();
    });
    el.querySelector('.menu-new').addEventListener('click', () => {
      // Starting over throws away a voyage in progress, so it asks once —
      // but only when there is actually something to lose.
      if (save && !window.confirm('Start a new voyage? Your current captain and progress will be lost.')) return;
      this.hide();
      this.handlers.onNew();
    });
    el.querySelector('.menu-how').addEventListener('click', () => this._panel('how'));
    el.querySelector('.menu-graves')?.addEventListener('click', () => this._panel('graves'));

    let last = performance.now();
    const loop = (ts) => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      this._step(dt);
      this._draw();
    };
    this._raf = requestAnimationFrame(loop);
  }

  /** The single most persuasive line on the screen: their own captain. */
  _fillSaveLine(node) {
    const s = this.save;
    const bits = [];
    if (s.captainName) bits.push(s.captainName);
    if (s.player?.level) bits.push(`Level ${s.player.level}`);
    if (s.resources?.coins) bits.push(`${Math.round(s.resources.coins).toLocaleString()} gold`);
    const hull = HULLS[s.shipState?.hullId]?.name;
    if (hull) bits.push(hull);
    const chapter = MAIN_CHAPTERS[s.mainQuest?.chapter ?? 0];
    // Two lines: who they are, then what they were in the middle of. One
    // line ran long enough to truncate, which is the opposite of enticing.
    node.innerHTML = '<b></b><i></i>';
    node.querySelector('b').textContent = bits.join(' · ');
    node.querySelector('i').textContent = s.mainQuest?.complete
      ? 'Pirate King — the sea is yours'
      : (chapter?.objective ?? '');
  }

  _panel(kind) {
    const panel = this.el.querySelector('.menu-panel');
    const close = () => panel.classList.add('hidden');
    if (kind === 'how') {
      panel.innerHTML = `
        <div class="menu-panel-card">
          <h3>How to Play</h3>
          <dl class="how-list">
            ${HOW_TO.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}
          </dl>
          <button class="btn btn-ghost menu-panel-close">Back</button>
        </div>`;
    } else {
      const graves = Graveyard.list().slice(0, 10);
      panel.innerHTML = `
        <div class="menu-panel-card">
          <h3>The Graveyard</h3>
          <p class="menu-panel-note">Captains who sailed before you.</p>
          <ul class="grave-list">
            ${graves.map(() => `
              <li class="grave-row">
                <span class="grave-num"></span>
                <span class="grave-name"></span>
                <span class="grave-cause"></span>
                <span class="grave-gold"></span>
              </li>`).join('')}
          </ul>
          <button class="btn btn-ghost menu-panel-close">Back</button>
        </div>`;
      graves.forEach((entry, i) => {
        const row = panel.querySelectorAll('.grave-row')[i];
        row.querySelector('.grave-num').textContent = `#${entry.number ?? i + 1}`;
        row.querySelector('.grave-name').textContent = entry.name ?? 'Unknown';
        row.querySelector('.grave-cause').textContent = (CAUSES[entry.cause] ?? CAUSES.sea).label;
        row.querySelector('.grave-gold').textContent = `${(entry.goldEarned ?? 0).toLocaleString()}g`;
      });
    }
    panel.classList.remove('hidden');
    panel.querySelector('.menu-panel-close').addEventListener('click', close);
    panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  }

  _resize() {
    const c = this.canvas;
    if (!c) return;
    c.width = Math.max(160, Math.ceil(window.innerWidth / SCALE));
    c.height = Math.max(120, Math.ceil(window.innerHeight / SCALE));
    this._draw();
  }

  hide() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this.el?.remove();
    this.el = null;
    this.canvas = null;
  }
}
