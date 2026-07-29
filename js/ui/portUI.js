// The port screen.
//
// Docking takes over the whole screen. The ship is tied up and the world
// is on hold (game.docked), so there is no sea to watch and no reason to
// keep it visible — what matters is that leaving is always one obvious
// button away.
//
// The layout is a harbour square: districts as cards you walk into, each
// its own view with a way back. Everything a port does lives in exactly
// one district, so "where do I buy a ship" has one answer.

import { ITEMS, RARITY, itemIcon } from '../items/itemdefs.js';
import { UPGRADES, PAINTS } from '../entities/shipstate.js';
import { HULLS, HULL_ORDER, HULL_STATS, hullUnlocked } from '../entities/ships.js';
import { createCrewMember, TRAITS, crewRole, hashId, RANKS } from '../crew/crew.js';
import { mulberry32, rangeInt } from '../util/random.js';
import { drawPirate } from '../render/pirate.js';
import { portraitCanvas, faceFromAppearance } from '../render/portrait.js';
import { crewCardHTML, paintCrewPortraits } from './crewcard.js';
import { MAX_ACTIVE } from '../quests/quests.js';
import { makeCanvas } from '../render/sprites.js';
import { CLANS, CLAN_IDS } from '../world/clans.js';
import { clanBadge, clanEmblem, clanBanner } from '../render/clanart.js';

const SHOPS = {
  general:  { name: 'General Store', pool: ['wood', 'stone', 'iron', 'cloth', 'food', 'rum', 'repairKit', 'cannonball', 'bullets', 'gunpowder', 'strawHat', 'sailorCoat', 'deckBoots', 'hullPlanks'] },
  weapons:  { name: 'Weapon Merchant', pool: ['rustyCutlass', 'cutlass', 'flintlock', 'musket', 'officerSaber', 'duelPistol', 'tricornHat', 'leatherCoat', 'navalCoat', 'buccaneerBoots', 'bullets', 'gunpowder', 'cannonBarrel'] },
  black:    { name: 'Black Market', pool: ['rustyKey', 'treasureMap', 'weatheredChart', 'fineRum', 'signetRing', 'boneCharm', 'sharkTooth', 'pearlNecklace', 'monkey', 'spyglass', 'corsairBlade', 'dragonPistol', 'longRifle', 'captainsHat', 'silkSails', 'parrot'] },
};

/** The districts of the square, in the order they appear. */
const DISTRICTS = [
  { id: 'harbour',  name: 'Harbour Office', icon: 'anchor', blurb: 'Repairs, cargo sales and paperwork.' },
  { id: 'shipyard', name: 'Shipyard',       icon: 'ship',   blurb: 'Hulls for sale. Trade up when you can afford to.' },
  { id: 'wright',   name: 'Shipwright',     icon: 'hammer', blurb: 'Fit upgrades and repaint the hull.' },
  { id: 'bounty',   name: 'Bounty Board',   icon: 'skull',  blurb: 'Wanted captains. Bring proof.' },
  { id: 'tavern',   name: 'The Tavern',     icon: 'tankard', blurb: 'Hands for hire, contracts and gossip.' },
  { id: 'market',   name: 'Market Row',     icon: 'crate',  blurb: 'Three merchants, restocked daily.' },
  { id: 'outfitter', name: 'Outfitter',     icon: 'sail',   blurb: 'Sails, flags, figureheads and lanterns.' },
];

/* ------------------------------------------------------------------ */
/* Procedural district icons — 32x32, same pixel grammar as the game   */
/* ------------------------------------------------------------------ */

const _iconCache = new Map();

function districtIcon(kind) {
  if (_iconCache.has(kind)) return _iconCache.get(kind);
  const c = makeCanvas(32, 32);
  const g = c.getContext('2d');
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const GOLD = '#e0b345';
  const WOOD = '#8a5a34';
  const IRON = '#9aa4b0';
  const BONE = '#e8e4da';

  if (kind === 'anchor') {
    px(14, 4, 4, 20, IRON);
    px(10, 9, 12, 3, IRON);
    px(7, 18, 3, 6, IRON);
    px(22, 18, 3, 6, IRON);
    px(7, 22, 18, 3, IRON);
    px(13, 2, 6, 3, GOLD);
  } else if (kind === 'ship') {
    px(5, 20, 22, 5, WOOD);        // hull
    px(7, 25, 18, 2, '#5e3a22');
    px(15, 5, 2, 15, '#6b4a2a');   // mast
    px(9, 8, 6, 10, BONE);         // sails
    px(17, 10, 6, 8, '#d8d2c4');
    px(15, 2, 7, 4, '#8e2f2f');    // pennant
  } else if (kind === 'hammer') {
    px(8, 6, 14, 7, IRON);
    px(6, 8, 3, 3, '#6f7783');
    px(14, 13, 4, 15, WOOD);
    px(14, 13, 4, 2, '#5e3a22');
  } else if (kind === 'skull') {
    px(9, 6, 14, 13, BONE);
    px(11, 19, 10, 4, BONE);
    px(12, 10, 3, 4, '#1a1420');
    px(17, 10, 3, 4, '#1a1420');
    px(15, 15, 2, 3, '#1a1420');
    px(6, 24, 20, 3, BONE);        // crossed bones
    px(6, 23, 3, 5, BONE);
    px(23, 23, 3, 5, BONE);
  } else if (kind === 'tankard') {
    px(9, 9, 13, 17, '#b08a55');
    px(9, 6, 13, 4, '#e8e0cc');    // foam
    px(22, 13, 4, 8, '#8a6a3a');   // handle
    px(11, 12, 9, 12, '#c9973f');
  } else if (kind === 'crate') {
    px(5, 12, 13, 13, WOOD);
    px(5, 12, 13, 2, '#a86f42');
    px(10, 12, 3, 13, '#5e3a22');
    px(17, 8, 10, 17, '#a86f42');
    px(17, 8, 10, 2, '#c08a52');
    px(20, 8, 3, 17, '#6f4626');
  } else if (kind === 'sail') {
    px(15, 3, 2, 26, '#6b4a2a');
    px(6, 6, 9, 16, BONE);
    px(17, 9, 9, 13, '#d8d2c4');
    px(6, 6, 9, 2, GOLD);
  }
  _iconCache.set(kind, c);
  return c;
}

export class PortUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.uiRoot = uiRoot;
    this.el = document.createElement('div');
    this.el.className = 'port-screen hidden';
    uiRoot.appendChild(this.el);
    this.view = 'square';
    this.shopTab = 'general';
    this.shipyardPick = null;
    this.cosmeticTab = 'paint';
    this.port = null;
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open(port) {
    this.port = port;
    this.view = 'square';
    this.shipyardPick = null;
    this.el.classList.remove('hidden');
    // Tie up: the ship is stationary for as long as we are ashore, so it
    // is exactly where we left it when we cast off.
    const { ship } = this.game;
    ship.speed = 0;
    ship.velX = 0;
    ship.velY = 0;
    this.game.events.emit('port:docked', port);
    this.game.events.emit('sfx', 'ui');
    this.render();
  }

  close() {
    this.el.classList.add('hidden');
    this.game.events.emit('sfx', 'ui');
    this.game.hud.toast('Cast off. Fair winds.', '#6fce62');
    this.game.save();
  }

  _rng(salt = 0) {
    return mulberry32((this.port.seed ^ (this.game.dayNight.day * 0x9e37) ^ salt) >>> 0);
  }

  _go(view) {
    this.view = view;
    this.game.events.emit('sfx', 'ui');
    this.render();
  }

  /* ---- shell ---------------------------------------------------------- */

  render() {
    const { game } = this;
    if (!this.port) return; // nothing to draw until we have docked somewhere
    const district = DISTRICTS.find((d) => d.id === this.view);
    const ownerId = game.clans?.portOwner(this.port) ?? null;
    const clan = ownerId ? CLANS[ownerId] : null;
    // Standing with the harbour's owner is what actually moves prices,
    // so it belongs in the header next to the purse.
    const mult = ownerId ? game.clans.priceMult('general', this.port) : 1;
    const discount = mult < 0.995 ? Math.round((1 - mult) * 100) : 0;
    this.el.innerHTML = `
      <div class="port-sky"></div>
      <div class="port-shell">
        <header class="port-head">
          <div class="port-ident">
            ${district ? '<button class="port-back">‹ Harbour Square</button>' : ''}
            <h2>${district ? district.name : this.port.name}</h2>
            <span class="port-sub">${district ? this.port.name : 'Harbour Square · Day ' + game.dayNight.day}</span>
          </div>
          ${clan ? `<div class="port-owner" style="--clan:${clan.color}">
            <canvas class="port-owner-badge" width="34" height="34"></canvas>
            <div>
              <span>Held by</span>
              <b>${clan.name}</b>
              <i>${game.clans.label(ownerId)}${discount ? ` · ${discount}% off` : ''}</i>
            </div>
          </div>` : ''}
          <div class="port-head-right">
            <div class="port-purse"><span class="purse-coin"></span><b>${game.resources.coins}</b><span>gold</span></div>
            <button class="port-leave">⚓ Set Sail</button>
          </div>
        </header>
        <div class="port-body"></div>
      </div>`;

    const body = this.el.querySelector('.port-body');
    const badge = this.el.querySelector('.port-owner-badge');
    if (badge && clan) badge.getContext('2d').drawImage(clanBadge(clan, 34), 0, 0);
    this.el.querySelector('.port-leave').addEventListener('click', () => this.close());
    this.el.querySelector('.port-back')?.addEventListener('click', () => this._go('square'));

    if (this.view === 'square') this._renderSquare(body);
    else if (this.view === 'harbour') this._renderHarbour(body);
    else if (this.view === 'shipyard') this._renderShipyard(body);
    else if (this.view === 'wright') this._renderWright(body);
    else if (this.view === 'bounty') this._renderBounty(body);
    else if (this.view === 'tavern') this._renderTavern(body);
    else if (this.view === 'market') this._renderMarket(body);
    else if (this.view === 'outfitter') this._renderOutfitter(body);
  }

  /** One-line live status per district, so the square reads as a dashboard. */
  _statusFor(id) {
    const { game } = this;
    const st = game.shipState;
    switch (id) {
      case 'harbour': {
        const missing = Math.ceil(st.maxHull - st.hull);
        return missing > 0 ? `Hull ${Math.round(st.hull)}/${st.maxHull} — repairs available` : 'Hull sound';
      }
      case 'shipyard': {
        const next = HULL_ORDER.find((h) => !st.ownedHulls.includes(h));
        return next ? `Sailing the ${st.hullDef.name} · ${HULLS[next].name} on the slip` : `Sailing the ${st.hullDef.name}`;
      }
      case 'wright': {
        const open = Object.entries(UPGRADES).filter(([k, u]) => st.levels[k] < u.max).length;
        return open ? `${open} upgrade${open > 1 ? 's' : ''} available` : 'Fully fitted';
      }
      case 'bounty': {
        if (game.bounties.hasActive) return `Hunting ${game.bounties.active.name}`;
        return `${game.bounties.offersAt(this.port).filter((o) => !o.taken).length} posters up`;
      }
      case 'tavern': {
        const room = game.crew.capacity - game.crew.members.length;
        return room > 0 ? `${room} berth${room > 1 ? 's' : ''} free · hands for hire` : 'Crew quarters full';
      }
      case 'market':
        return 'Restocked at dawn';
      case 'outfitter':
        return 'Sails, flags and figureheads';
      default:
        return '';
    }
  }

  _renderSquare(body) {
    const st = this.game.shipState;
    body.innerHTML = `
      <div class="square-main">
      <div class="port-panorama">
        <canvas class="panorama-art" width="1280" height="220"></canvas>
        <div class="panorama-caption">
          <span>Your ship is tied up and the tide can wait — nothing out there moves until you cast off.</span>
          <b>${st.hullDef.name} · hull ${Math.round(st.hull)}/${st.maxHull}</b>
        </div>
      </div>
      <div class="district-grid">
        ${DISTRICTS.map((d) => `
          <button class="district" data-go="${d.id}">
            <span class="district-icon"><img alt="" src="${districtIcon(d.icon).toDataURL()}"></span>
            <span class="district-text">
              <b>${d.name}</b>
              <em>${d.blurb}</em>
              <i class="district-status">${this._statusFor(d.id)}</i>
            </span>
            <span class="district-go">›</span>
          </button>`).join('')}
      </div>
      </div>
      <div class="port-street" aria-hidden="true"></div>`;

    body.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => this._go(b.dataset.go)));
    this._drawPanorama(body.querySelector('.panorama-art'));
    this._populateStreet(body.querySelector('.port-street'));
  }

  /**
   * The harbour itself, seen from the quay. Deterministic per port and
   * lit by the current hour, so every port looks like a specific place
   * and docking at dusk looks like dusk.
   */
  _drawPanorama(canvas) {
    if (!canvas) return;
    const g = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const rng = this._rng(0x9a17);
    const sun = this.game.dayNight.snapshot.sun;
    const night = 1 - Math.max(0, Math.min(1, sun));
    g.clearRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;

    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const rgb = (c, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    const skyTop = mix([92, 140, 190], [12, 18, 40], night);
    const skyLow = mix([238, 186, 120], [26, 34, 62], night);

    const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, rgb(skyTop));
    sky.addColorStop(1, rgb(skyLow));
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H * 0.62);

    // sun or moon low over the water
    const orbX = W * 0.76;
    const orbY = H * 0.42;
    g.fillStyle = night > 0.5 ? 'rgba(226,232,240,0.9)' : 'rgba(255,226,150,0.95)';
    g.beginPath();
    g.arc(orbX, orbY, night > 0.5 ? 11 : 15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = night > 0.5 ? 'rgba(226,232,240,0.10)' : 'rgba(255,206,120,0.16)';
    g.beginPath();
    g.arc(orbX, orbY, 42, 0, Math.PI * 2);
    g.fill();

    if (night > 0.45) {
      for (let i = 0; i < 60; i++) {
        const sx = rng() * W;
        const sy = rng() * H * 0.45;
        g.fillStyle = `rgba(255,255,255,${0.15 + rng() * 0.5})`;
        g.fillRect(sx | 0, sy | 0, 1, 1);
      }
    }

    // far headland
    const hillY = H * 0.52;
    g.fillStyle = rgb(mix([58, 92, 74], [14, 26, 36], night));
    g.beginPath();
    g.moveTo(0, hillY + 20);
    for (let x = 0; x <= W; x += 24) {
      g.lineTo(x, hillY - Math.sin(x * 0.011 + rng() * 0.2) * 14 - 6);
    }
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();

    // The town: roofs climbing the shore. Heights vary hard and a third
    // of the plots stay empty, otherwise the skyline reads as one solid
    // wall of identical blocks rather than a town.
    const roofs = mix([120, 82, 52], [40, 32, 34], night);
    const walls = mix([196, 168, 128], [56, 52, 62], night);
    const plots = 30;
    for (let i = 0; i < plots; i++) {
      if (rng() < 0.3) continue;
      const bw = 22 + rng() * 30;
      const tall = rng() < 0.25;
      const bh = (tall ? 40 : 16) + rng() * (tall ? 26 : 20);
      const bx = (i / plots) * W + (rng() - 0.5) * 16;
      const by = H * 0.62 - bh;
      g.fillStyle = rgb(walls);
      g.fillRect(bx | 0, by | 0, bw | 0, bh | 0);
      g.fillStyle = rgb(roofs);
      g.fillRect((bx - 2) | 0, (by - 6) | 0, (bw + 4) | 0, 7);
      for (let wy = by + 9; wy < by + bh - 7; wy += 13) {
        for (let wx = bx + 5; wx < bx + bw - 7; wx += 12) {
          const lit = night > 0.4 && rng() < 0.55;
          g.fillStyle = lit ? 'rgba(255,196,90,0.95)' : rgb(mix([70, 60, 54], [24, 24, 34], night));
          g.fillRect(wx | 0, wy | 0, 4, 5);
        }
      }
    }

    // the water, and the quay in the foreground
    const waterY = H * 0.62;
    const water = g.createLinearGradient(0, waterY, 0, H);
    water.addColorStop(0, rgb(mix([46, 96, 140], [10, 22, 44], night)));
    water.addColorStop(1, rgb(mix([22, 58, 96], [6, 14, 30], night)));
    g.fillStyle = water;
    g.fillRect(0, waterY, W, H - waterY);
    // reflection of the orb, broken into ripples
    for (let y = waterY + 2; y < H - 16; y += 4) {
      const w = 26 - (y - waterY) * 0.12;
      g.fillStyle = night > 0.5 ? 'rgba(226,232,240,0.10)' : 'rgba(255,214,130,0.14)';
      g.fillRect(orbX - w / 2 + (rng() - 0.5) * 10, y, w, 2);
    }

    // moored ships along the quay, silhouetted
    for (let i = 0; i < 4; i++) {
      const sx = 60 + i * (W / 4.4) + rng() * 40;
      const sy = waterY + 14 + rng() * 20;
      const sw = 42 + rng() * 30;
      g.fillStyle = rgb(mix([58, 40, 26], [18, 16, 24], night * 0.8));
      g.fillRect(sx, sy, sw, 9);
      g.fillRect(sx + sw * 0.45, sy - 30, 2, 30);
      g.fillStyle = rgb(mix([222, 214, 196], [70, 74, 90], night * 0.85));
      g.fillRect(sx + sw * 0.2, sy - 26, sw * 0.5, 17);
    }

    // the quay we are standing on
    g.fillStyle = rgb(mix([124, 86, 52], [40, 30, 24], night));
    g.fillRect(0, H - 18, W, 18);
    g.fillStyle = rgb(mix([150, 108, 66], [52, 40, 30], night));
    for (let x = 0; x < W; x += 18) g.fillRect(x, H - 18, 15, 3);
    // pilings
    g.fillStyle = rgb(mix([84, 58, 34], [26, 20, 18], night));
    for (let x = 10; x < W; x += 96) g.fillRect(x, H - 26, 7, 9);

    // vignette so the strip sits into the page instead of on top of it
    const vg = g.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(10,22,38,0.35)');
    vg.addColorStop(0.5, 'rgba(10,22,38,0)');
    vg.addColorStop(1, 'rgba(10,22,38,0.5)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  }

  /**
   * Dockhands strolling the quay. Purely decorative, but a port with
   * nobody in it reads as a menu — and this is supposed to be a place.
   */
  _populateStreet(street) {
    const rng = this._rng(0x5417);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const c = makeCanvas(22, 30);
      drawPirate(c.getContext('2d'), {
        skin: rangeInt(rng, 0, 5), hair: rangeInt(rng, 0, 5), hairColor: rangeInt(rng, 0, 7),
        beard: rangeInt(rng, 0, 5), hat: rangeInt(rng, 0, 5), coat: rangeInt(rng, 0, 4),
        pants: rangeInt(rng, 0, 3), boots: rangeInt(rng, 0, 3),
        eyepatch: rng() < 0.2 ? 1 : 0, hook: 0, woodenLeg: rng() < 0.1 ? 1 : 0,
        primary: rangeInt(rng, 0, 11), secondary: rangeInt(rng, 0, 11),
      });
      const walker = document.createElement('img');
      walker.className = 'walker';
      walker.src = c.toDataURL();
      walker.alt = '';
      // Staggered durations and delays so they never march in lockstep.
      walker.style.setProperty('--dur', `${16 + rng() * 16}s`);
      walker.style.setProperty('--delay', `${-rng() * 24}s`);
      walker.style.setProperty('--bottom', `${4 + rng() * 16}px`);
      walker.style.setProperty('--scale', `${1.6 + rng() * 0.8}`);
      if (rng() < 0.5) walker.classList.add('rtl');
      street.appendChild(walker);
    }
  }

  /* ---- harbour office --------------------------------------------------- */

  _renderHarbour(body) {
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
    const sellAllValue = sellables.reduce((n, s) => n + Math.max(1, Math.floor(ITEMS[s.id].value * 0.6)) * s.qty, 0);

    body.innerHTML = `
      <div class="port-cols">
        <section class="port-card">
          <h3>Careening</h3>
          <div class="repair-state">
            <div class="repair-bar"><div style="width:${(st.hull / st.maxHull) * 100}%"></div></div>
            <span>${Math.round(st.hull)} / ${st.maxHull} hull</span>
          </div>
          <button class="btn wide repair-btn" ${missing <= 0 || game.resources.coins < cost ? 'disabled' : ''}>
            ${missing <= 0 ? 'Hull is sound' : `Repair all — ${cost} gold`}
          </button>
          <div class="ad-slot"></div>
        </section>
        <section class="port-card">
          <h3>Deed to a Private Isle</h3>
          ${game.homestead.owned
            ? `<p class="port-note">You already hold the deed to ${game.homestead.isle?.name ?? 'an isle'}.</p>`
            : `<p class="port-note">Claim a wild island near this port as your own — build a house, a garden and a bonfire.</p>
               <button class="btn wide deed-btn" ${game.resources.coins < 2500 ? 'disabled' : ''}>Buy the deed — 2500 gold</button>`}
        </section>
      </div>
      ${game.clans.playerClan ? `
        <section class="port-card own-clan" style="--clan:${game.clans.playerClan.color}">
          <div class="own-clan-head">
            <canvas class="own-clan-badge" width="40" height="40"></canvas>
            <div>
              <span class="port-note">Registered colours</span>
              <h3>${game.clans.playerClan.name}</h3>
              <p class="port-note">${game.clans.playerClan.members?.length ?? 0} sworn hands · founded day ${game.clans.playerClan.founded}</p>
            </div>
          </div>
        </section>`
        : game.clans.canFound ? `
        <section class="port-card found-card">
          <h3>Register Your Colours</h3>
          <p class="port-note">Word of you has travelled. The harbourmaster will enter a new
          clan in the register — your name, your flag, your rules.</p>
          <button class="btn wide found-btn">Found your clan</button>
        </section>`
        : `
        <section class="port-card">
          <h3>The Register</h3>
          <p class="port-note">The harbourmaster keeps the roll of recognised clans.
          Reach an average standing of +35 across the six and yours can join it —
          currently ${game.clans.globalRep >= 0 ? '+' : ''}${game.clans.globalRep}.</p>
        </section>`}
      <section class="port-card">
        <div class="card-head">
          <h3>Sell Cargo</h3>
          <div class="card-head-right">
            <span class="port-note">60% of value · click to sell one</span>
            <button class="mini-btn sell-all" ${sellables.length ? '' : 'disabled'}>Sell all — ${sellAllValue}g</button>
          </div>
        </div>
        <div class="item-grid sell-grid">
          ${sellables.map((s, idx) => {
            const def = ITEMS[s.id];
            const price = Math.max(1, Math.floor(def.value * 0.6));
            return `<div class="slot filled sell-slot" data-idx="${idx}" style="--rar:${RARITY[def.rarity].color}"
              title="${def.name} — ${price} gold each">
              <img src="${itemIcon(s.id).toDataURL()}" alt="${def.name}">${s.qty > 1 ? `<span class="qty">${s.qty}</span>` : ''}
              <span class="price-tag">${price}</span>
            </div>`;
          }).join('') || '<p class="empty-note">Your holds are empty.</p>'}
        </div>
      </section>`;

    // Free careening — genuinely useful exactly when repairs hurt most:
    // a battered hull and an empty purse.
    if (missing > 0 && game.ads.canOffer('freeRepair')) {
      const slot = body.querySelector('.ad-slot');
      slot.innerHTML = '<p class="port-note">The shipwright owes a favour — no gold needed.</p>';
      slot.appendChild(game.ads.button('freeRepair', 'Free full repair', () => {
        st.repair(st.maxHull);
        st.sailHp = st.maxSail;
        game.events.emit('sfx', 'repair');
        game.hud.toast('Hull and sails made whole — free of charge.', '#6fce62');
        this.render();
      }));
    }

    const ownBadge = body.querySelector('.own-clan-badge');
    if (ownBadge) ownBadge.getContext('2d').drawImage(clanBadge(game.clans.playerClan, 40), 0, 0);
    body.querySelector('.found-btn')?.addEventListener('click', () => this._openFounding());
    body.querySelector('.repair-btn')?.addEventListener('click', () => {
      if (missing <= 0 || game.resources.coins < cost) return;
      game.resources.coins -= cost;
      st.repair(missing);
      game.events.emit('resources:changed', { ...game.resources });
      game.events.emit('sfx', 'repair');
      this.render();
    });
    body.querySelector('.deed-btn')?.addEventListener('click', () => {
      if (game.resources.coins < 2500) return;
      if (game.homestead.claimNear(this.port)) {
        game.resources.coins -= 2500;
        game.events.emit('resources:changed', { ...game.resources });
        this.render();
      } else {
        game.hud.toast('No suitable island near this port — try another.', '#e0b345');
      }
    });
    const sell = (s) => {
      const def = ITEMS[s.id];
      const cont = s.addr.cname === 'cargo' ? game.inventory.cargo : game.inventory.backpack;
      cont.remove(s.id, 1);
      game.resources.coins += Math.max(1, Math.floor(def.value * 0.6));
    };
    body.querySelectorAll('.sell-slot').forEach((el) => {
      el.addEventListener('click', () => {
        sell(sellables[Number(el.dataset.idx)]);
        game.events.emit('resources:changed', { ...game.resources });
        game.events.emit('sfx', 'coin');
        this.render();
      });
    });
    body.querySelector('.sell-all')?.addEventListener('click', () => {
      for (const s of sellables) for (let i = 0; i < s.qty; i++) sell(s);
      game.events.emit('resources:changed', { ...game.resources });
      game.events.emit('sfx', 'coin');
      this.render();
    });
  }

  /* ---- founding your own clan ------------------------------------------- */

  /**
   * The founding sheet. Every choice here is visual and permanent-feeling,
   * so it gets a live preview of the flag rather than a list of names —
   * you should be looking at your colours before you commit to them.
   */
  _openFounding() {
    const { game } = this;
    const palette = ['#c9384a', '#e0b345', '#3fc2b0', '#9b6ef0', '#6fce62', '#5aa5f0', '#f07a3c', '#e8e4da'];
    const emblems = ['skull', 'blade', 'anchor', 'crown', 'star', 'eye', 'wave', 'gull', 'coin'];
    const state = { name: '', color: palette[0], emblem: 'skull' };

    const el = document.createElement('div');
    el.className = 'found-modal';
    el.innerHTML = `
      <div class="found-sheet">
        <span class="fanfare-eyebrow">A new power at sea</span>
        <h2>Found Your Clan</h2>
        <div class="found-body">
          <div class="found-preview">
            <canvas class="found-badge" width="96" height="96"></canvas>
            <canvas class="found-flag" width="120" height="76"></canvas>
            <b class="found-name-preview">Your Clan</b>
          </div>
          <div class="found-controls">
            <label class="found-field">
              <span>Clan name</span>
              <input class="found-name" maxlength="28" placeholder="The Iron Verdict" />
            </label>
            <div class="found-field">
              <span>Colour</span>
              <div class="found-swatches">
                ${palette.map((c, i) => `<button class="swatch ${i === 0 ? 'active' : ''}"
                  data-color="${c}" style="background:${c}" aria-label="colour ${i + 1}"></button>`).join('')}
              </div>
            </div>
            <div class="found-field">
              <span>Emblem</span>
              <div class="found-emblems">
                ${emblems.map((e, i) => `<button class="emblem-pick ${i === 0 ? 'active' : ''}" data-emblem="${e}">
                  <canvas width="22" height="22" data-e="${e}"></canvas></button>`).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="found-actions">
          <button class="mini-btn ghost found-cancel">Not yet</button>
          <button class="btn found-confirm" disabled>Raise the colours</button>
        </div>
      </div>`;
    this.el.appendChild(el);

    const badge = el.querySelector('.found-badge');
    const flag = el.querySelector('.found-flag');
    const nameOut = el.querySelector('.found-name-preview');
    const confirm = el.querySelector('.found-confirm');

    const redraw = () => {
      const mock = {
        color: state.color,
        accent: '#f4ecd8',
        emblem: state.emblem,
        flagBody: state.color,
        flagMark: '#f4ecd8',
      };
      badge.getContext('2d').clearRect(0, 0, 96, 96);
      badge.getContext('2d').drawImage(clanBadge(mock, 96), 0, 0);
      const fg = flag.getContext('2d');
      fg.clearRect(0, 0, 120, 76);
      fg.imageSmoothingEnabled = false;
      // A hanging banner rather than the sea pennant: the pennant's ripple
      // is authored for 11 pixels wide and turns into a jagged blob when
      // it is blown up this far.
      const bn = clanBanner(mock, 26, 38);
      fg.drawImage(bn, (120 - 26 * 2) / 2, 0, 26 * 2, 38 * 2);
      nameOut.textContent = state.name || 'Your Clan';
      nameOut.style.color = state.color;
      confirm.disabled = state.name.trim().length < 3;
    };

    el.querySelectorAll('[data-e]').forEach((c) => {
      c.getContext('2d').drawImage(clanEmblem(c.dataset.e, '#e8ddc4', 22, '#12101a'), 0, 0);
    });
    el.querySelector('.found-name').addEventListener('input', (ev) => {
      state.name = ev.target.value;
      redraw();
    });
    el.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('.swatch').forEach((o) => o.classList.remove('active'));
      b.classList.add('active');
      state.color = b.dataset.color;
      redraw();
    }));
    el.querySelectorAll('.emblem-pick').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('.emblem-pick').forEach((o) => o.classList.remove('active'));
      b.classList.add('active');
      state.emblem = b.dataset.emblem;
      redraw();
    }));
    el.querySelector('.found-cancel').addEventListener('click', () => el.remove());
    confirm.addEventListener('click', () => {
      const clan = game.clans.foundClan({
        name: state.name.trim(),
        color: state.color,
        emblem: state.emblem,
        flagBody: state.color,
        flagMark: '#f4ecd8',
      });
      // Your colours go up on your own mast immediately.
      game.cosmetics.unlock('flag', 'clan');
      game.cosmetics.equip('flag', 'clan');
      game.events.emit('sfx', 'victory');
      game.ads?.happytime?.();
      el.remove();
      this.render();
      this._celebrateClan(clan);
    });
    redraw();
  }

  _celebrateClan(clan) {
    const el = document.createElement('div');
    el.className = 'ship-fanfare';
    el.innerHTML = `
      <div class="fanfare-card" style="box-shadow: inset 0 0 0 2px ${clan.color}, 0 10px 0 rgba(0,0,0,0.5), 0 0 60px ${clan.color}55">
        <span class="fanfare-eyebrow">The register is signed</span>
        <h2 style="color:${clan.color}">${clan.name}</h2>
        <p>Your colours fly. Every hand you take from now on sails under them.</p>
        <canvas class="fanfare-clan" width="110" height="110"></canvas>
        <button class="btn">Take the helm</button>
      </div>`;
    this.el.appendChild(el);
    el.querySelector('.fanfare-clan').getContext('2d').drawImage(clanBadge(clan, 110), 0, 0);
    el.querySelector('.btn').addEventListener('click', () => el.remove());
  }

  /* ---- shipyard: the ship shop ------------------------------------------ */

  _renderShipyard(body) {
    const { game } = this;
    const st = game.shipState;
    const pickId = this.shipyardPick ?? st.hullId;
    const pick = HULLS[pickId];
    const owned = st.ownedHulls.includes(pickId);
    const current = st.hullDef;
    const gate = hullUnlocked(pickId, game);
    const afford = game.resources.coins >= pick.cost;

    const compare = HULL_STATS.map((s) => {
      const mine = current[s.key];
      const theirs = pick[s.key];
      const delta = theirs - mine;
      const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
      const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '·';
      return `<tr class="${cls}">
        <th>${s.label}</th>
        <td>${s.format(mine)}</td>
        <td class="cmp-arrow">${arrow}</td>
        <td><b>${s.format(theirs)}</b></td>
      </tr>`;
    }).join('');

    body.innerHTML = `
      <div class="yard">
        <aside class="yard-list">
          ${HULL_ORDER.map((id) => {
            const h = HULLS[id];
            const isOwned = st.ownedHulls.includes(id);
            const isCurrent = st.hullId === id;
            const g2 = hullUnlocked(id, game);
            return `<button class="yard-item ${id === pickId ? 'active' : ''} ${g2.ok ? '' : 'locked'}" data-hull="${id}">
              <span class="yard-item-top">
                <b>${h.name}</b>
                ${isCurrent ? '<i class="tag now">Sailing</i>'
                  : isOwned ? '<i class="tag owned">Owned</i>'
                  : g2.ok ? `<i class="tag price">${h.cost}g</i>`
                  : '<i class="tag locked">🔒</i>'}
              </span>
              <span class="yard-item-bar"><i style="width:${Math.round((h.hull / 600) * 100)}%"></i></span>
            </button>`;
          }).join('')}
        </aside>
        <section class="yard-detail">
          <div class="yard-hero">
            <canvas class="yard-art" width="150" height="122"></canvas>
            <div class="yard-title">
              <h3>${pick.name}</h3>
              <p class="yard-tagline">${pick.tagline}</p>
            </div>
          </div>
          <p class="yard-desc">${pick.desc}</p>
          <table class="yard-table">
            <thead><tr><th></th><th>${current.name}</th><th></th><th>${pick.name}</th></tr></thead>
            <tbody>${compare}</tbody>
          </table>
          <div class="yard-buy">
            ${owned
              ? (st.hullId === pickId
                ? '<p class="yard-status">This is the ship under your feet.</p>'
                : '<button class="btn wide switch-btn">Move your flag to the ' + pick.name + '</button>')
              : !gate.ok
                ? `<p class="yard-status locked">🔒 Requires ${gate.label} <span>(${gate.have}/${gate.need})</span></p>`
                : `<button class="btn wide buy-hull" ${afford ? '' : 'disabled'}>
                     ${afford ? `Commission her — ${pick.cost} gold` : `Need ${pick.cost - game.resources.coins} more gold`}
                   </button>`}
            <p class="port-note">Fitted upgrades stay with you — they move to the new hull.</p>
          </div>
        </section>
      </div>`;

    this._drawHullArt(body.querySelector('.yard-art'), pickId);
    body.querySelectorAll('[data-hull]').forEach((b) => b.addEventListener('click', () => {
      this.shipyardPick = b.dataset.hull;
      this.game.events.emit('sfx', 'ui');
      this.render();
    }));
    body.querySelector('.switch-btn')?.addEventListener('click', () => {
      st.setHull(pickId);
      game.events.emit('sfx', 'upgrade');
      game.hud.toast(`Your flag flies over the ${pick.name}.`, '#6fce62');
      this.render();
    });
    body.querySelector('.buy-hull')?.addEventListener('click', () => {
      if (game.resources.coins < pick.cost) return;
      game.resources.coins -= pick.cost;
      st.setHull(pickId);
      game.events.emit('resources:changed', { ...game.resources });
      game.events.emit('ship:bought', { id: pickId });
      game.events.emit('sfx', 'victory');
      game.ads.happytime?.();
      // Redraw first — render() replaces the whole shell, which would
      // take the fanfare with it if it were already on screen.
      this.render();
      this._celebrate(pick);
    });
  }

  /** A new ship is a milestone, so it gets a moment rather than a toast. */
  _celebrate(hull) {
    const el = document.createElement('div');
    el.className = 'ship-fanfare';
    el.innerHTML = `
      <div class="fanfare-card">
        <span class="fanfare-eyebrow">A new command</span>
        <h2>${hull.name}</h2>
        <p>${hull.tagline}</p>
        <canvas class="fanfare-art" width="170" height="130"></canvas>
        <button class="btn">Take the helm</button>
      </div>`;
    this.el.appendChild(el);
    this._drawHullArt(el.querySelector('.fanfare-art'), this.shipyardPick ?? this.game.shipState.hullId, 1.15);
    const done = () => el.remove();
    el.querySelector('.btn').addEventListener('click', done);
    el.addEventListener('click', (e) => { if (e.target === el) done(); });
  }

  /**
   * Broadside portrait of a hull, drawn to scale against the others so
   * the list reads as a fleet — a galleon has to look like a galleon
   * before any of the numbers matter.
   */
  _drawHullArt(canvas, hullId, zoom = 1) {
    if (!canvas) return;
    const g = canvas.getContext('2d');
    const h = HULLS[hullId];
    const W = canvas.width;
    const H = canvas.height;
    g.clearRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;

    // sky + water backdrop
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#20304e');
    sky.addColorStop(0.75, '#2c4568');
    sky.addColorStop(0.76, '#1c3252');
    sky.addColorStop(1, '#12213a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const waterY = H * 0.76;
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = waterY; y < H; y += 4) g.fillRect(0, y, W, 1);

    // One scale for every hull, chosen so the largest just fits. Sizing
    // each ship to its own frame would make them all look identical —
    // the whole point of the preview is that a galleon dwarfs a sloop.
    const s = 2.9 * zoom;
    const cx = W / 2;
    const cy = waterY;
    const px = (x, y, w, ht, col) => {
      g.fillStyle = col;
      g.fillRect(Math.round(cx + x * s), Math.round(cy + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(ht * s)));
    };

    const masts = h.cannons <= 2 ? 1 : h.cannons <= 4 ? 2 : 3;
    const len = 16 + h.cannons * 2.6;      // hull length grows with the gun deck
    const deck = h.crew >= 10 ? 7 : h.crew >= 5 ? 6 : 5;

    // masts + sails, drawn behind the hull
    for (let m = 0; m < masts; m++) {
      const mx = -len / 2 + 5 + (m * (len - 10)) / Math.max(1, masts - 1 || 1);
      const mh = 20 + (masts - m) * 2;
      px(mx - 0.5, -mh, 1.2, mh, '#6b4a2a');
      px(mx - 4.5, -mh + 3, 9, mh * 0.52, '#e8e4da');
      px(mx - 4.5, -mh + 3, 9, 1.2, '#c9bfa8');
      px(mx - 3.8, -mh * 0.42, 7.6, mh * 0.34, '#d8d2c4');
    }
    // pennant on the tallest mast
    px(-len / 2 + 4.5, -20 - masts * 2 - 3, 6, 2.4, '#8e2f2f');

    // hull: sheer line, then the gun deck
    px(-len / 2, -deck, len, deck, '#a86f42');
    px(-len / 2, -deck, len, 1.4, '#c08a52');
    px(-len / 2 + 1, 0, len - 2, 2.4, '#6f4626');
    px(len / 2 - 3, -deck - 2.5, 3, 3, '#a86f42'); // bow rise
    px(-len / 2, -deck - 2, 3.5, 3, '#8a5a34');    // stern castle
    // gun ports
    for (let i = 0; i < h.cannons; i++) {
      const gx = -len / 2 + 4 + i * ((len - 8) / Math.max(1, h.cannons));
      px(gx, -deck + 2.2, 1.8, 1.8, '#2a1e18');
    }
    // waterline reflection
    g.globalAlpha = 0.16;
    px(-len / 2, 2.6, len, 3, '#a86f42');
    g.globalAlpha = 1;
  }

  /* ---- shipwright ------------------------------------------------------- */

  _renderWright(body) {
    const { game } = this;
    const st = game.shipState;
    const rows = Object.entries(UPGRADES).map(([key, u]) => {
      const lvl = st.levels[key];
      const maxed = lvl >= u.max;
      const cost = maxed ? null : u.cost(lvl + 1);
      const parts = cost ? Object.entries(cost).map(([res, amt]) => {
        const have = res === 'gold' ? game.resources.coins : game.inventory.totalCount(res);
        return `<span class="${have >= amt ? '' : 'missing'}">${amt} ${res}</span>`;
      }).join('') : '';
      const can = cost && Object.entries(cost).every(([res, amt]) =>
        (res === 'gold' ? game.resources.coins : game.inventory.totalCount(res)) >= amt);
      return `<div class="up-card ${maxed ? 'maxed' : ''}">
        <div class="up-top">
          <b>${u.name}</b>
          <span class="pips">${'●'.repeat(lvl)}${'○'.repeat(u.max - lvl)}</span>
        </div>
        <p class="up-desc">${u.desc}</p>
        <div class="up-foot">
          <div class="up-cost">${maxed ? '<b>Fully fitted</b>' : parts}</div>
          ${maxed ? '' : `<button class="mini-btn up-btn" data-key="${key}" ${can ? '' : 'disabled'}>Fit</button>`}
        </div>
      </div>`;
    }).join('');
    const paints = PAINTS.map((p) => {
      const ownedPaint = st.paints.includes(p.id);
      const locked = p.unlock && !ownedPaint;
      return `<button class="paint-chip ${st.paint === p.id ? 'active' : ''} ${locked ? 'locked' : ''}"
        data-id="${p.id}" ${locked ? 'disabled' : ''} title="${p.name}">
        <i style="background:${p.tint ? p.tint.replace(/[\d.]+\)$/, '1)') : '#a86f42'}"></i>
        <span>${p.name}${ownedPaint || locked ? '' : ` · ${p.cost}g`}</span>
      </button>`;
    }).join('');

    body.innerHTML = `
      <section class="port-card">
        <h3>Fittings <span class="port-note">Upgrades stay with you when you change hulls</span></h3>
        <div class="up-grid">${rows}</div>
      </section>
      <section class="port-card">
        <h3>Hull Paint</h3>
        <div class="paint-grid">${paints}</div>
      </section>`;

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
    body.querySelectorAll('.paint-chip').forEach((b) => {
      b.addEventListener('click', () => {
        const p = PAINTS.find((x) => x.id === b.dataset.id);
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

  /* ---- bounty board ------------------------------------------------------ */

  _renderBounty(body) {
    const { game } = this;
    const active = game.bounties.active;
    const offers = game.bounties.offersAt(this.port);

    body.innerHTML = `
      ${active ? `
        <section class="port-card hunt-card">
          <div class="hunt-head">
            <canvas class="hunt-portrait" width="64" height="64"></canvas>
            <div>
              <span class="port-note">Contract in hand</span>
              <h3>${active.name}</h3>
              <p class="hunt-sub">${'☠'.repeat(active.skulls)} ${active.rankName} · ${active.shipName}</p>
              <p class="hunt-sub">Escapes in ${game.bounties.escapeClock} · ${active.reward} gold on delivery</p>
            </div>
          </div>
          <p class="port-note">Your compass points to them. They are still sailing.</p>
          <button class="mini-btn abandon-btn">Abandon the hunt</button>
        </section>`
        : '<p class="board-intro">One contract at a time. Take a name and the compass will find them — but they do not wait around.</p>'}
      <div class="poster-wall">
        ${offers.map((o, i) => `
          <article class="poster ${o.taken ? 'taken' : ''}">
            <div class="poster-nail"></div>
            <h4>WANTED</h4>
            <div class="poster-sub">dead or alive</div>
            <canvas class="poster-face" width="64" height="64" data-i="${i}"></canvas>
            <div class="poster-name">${o.name}</div>
            <div class="poster-ship">${o.shipName}</div>
            <div class="poster-skulls">${'☠'.repeat(o.skulls)}<span>${o.rankName}</span></div>
            <p class="poster-crime">${o.crime}</p>
            <div class="poster-reward"><span>Reward</span><b>${o.reward}</b><span>gold</span></div>
            <button class="btn poster-btn" data-i="${i}"
              ${o.taken || active ? 'disabled' : ''}>
              ${o.taken ? 'Claimed' : active ? 'Board is full' : 'Take the contract'}
            </button>
          </article>`).join('')}
      </div>`;

    if (active) {
      const c = body.querySelector('.hunt-portrait');
      c.getContext('2d').drawImage(portraitCanvas(faceFromAppearance(active.appearance, active.seed, {
        bgTop: '#4a2020', bgBottom: '#1a0e10',
      }), 'angry'), 0, 0);
      body.querySelector('.abandon-btn').addEventListener('click', () => {
        game.bounties.abandon();
        this.render();
      });
    }
    body.querySelectorAll('.poster-face').forEach((c) => {
      const o = offers[Number(c.dataset.i)];
      c.getContext('2d').drawImage(portraitCanvas(
        faceFromAppearance(o.appearance, o.seed, { bgTop: '#5a4a34', bgBottom: '#2e2418' }),
        o.skulls >= 4 ? 'angry' : o.skulls >= 3 ? 'grim' : 'sly',
      ), 0, 0);
    });
    body.querySelectorAll('.poster-btn').forEach((b) => {
      b.addEventListener('click', () => {
        if (game.bounties.accept(offers[Number(b.dataset.i)], this.port)) this.render();
      });
    });
  }

  /* ---- tavern: crew cards + contracts ------------------------------------ */

  _renderTavern(body) {
    const { game } = this;
    const rng = this._rng(0x7a7);
    const ownerId = game.clans.portOwner(this.port);
    const hirelings = [];
    for (let i = 0; i < 3; i++) {
      const seed = (this.port.seed ^ (game.dayNight.day * 131) ^ (i * 7919)) >>> 0;
      const level = 1 + rangeInt(rng, 0, 1 + game.tierAt(this.port.x, this.port.y));
      // Most hands in a tavern belong to whoever holds the harbour; the
      // odd stranger is passing through from somewhere else.
      const clanId = rng() < 0.75 ? ownerId : CLAN_IDS[rangeInt(rng, 0, CLAN_IDS.length - 1)];
      const m = createCrewMember(seed, level, clanId);
      const rank = RANKS.find((r) => r.id === m.rank) ?? RANKS[0];
      m.wage = Math.round((40 + level * 35) * rank.wageMult) + (m.traits.includes('greedy') ? 20 : 0);
      m.check = game.recruitment.evaluate(m, 'pay');
      hirelings.push(m);
    }
    const hiredKey = `hired:${this.port.seed}:${game.dayNight.day}`;
    const hiredSet = game.portHired[hiredKey] ?? [];
    const offers = game.quests.offersAt(this.port);
    const activeIds = new Set(game.quests.active.map((q) => q.name + q.originPort));
    const full = game.crew.members.length >= game.crew.capacity;

    body.innerHTML = `
      <section class="port-card">
        <div class="card-head">
          <h3>Hands for Hire</h3>
          <span class="port-note">${game.crew.members.length}/${game.crew.capacity} berths filled${full ? ' · quarters full' : ''}</span>
        </div>
        <div class="crew-cards">
          ${hirelings.map((m, i) => this._crewCardHTML(m, i, {
            hired: hiredSet.includes(i),
            disabled: hiredSet.includes(i) || full || !m.check.ok || game.resources.coins < m.wage,
            action: hiredSet.includes(i) ? 'Signed on'
              : full ? 'No berth'
              : !m.check.ok ? 'Will not sign'
              : `Hire · ${m.wage}g`,
            note: !m.check.ok && !hiredSet.includes(i) ? (m.check.need ?? m.check.reason) : null,
          })).join('')}
        </div>
      </section>
      ${game.player.level >= 20 ? `
      <section class="port-card prestige-card">
        <h3>Retire into Legend <span class="port-note">Prestige ${game.prestige} → ${game.prestige + 1}</span></h3>
        <p class="port-note">Your level resets to 1. You keep everything else — and gain a permanent
        +2% ship speed and +1 luck, forever. The Flag of Legend flies for those who dare.</p>
        <button class="mini-btn prestige-btn">Retire</button>
      </section>` : ''}
      <section class="port-card">
        <div class="card-head">
          <h3>Contracts</h3>
          <span class="port-note">${game.quests.active.length}/${MAX_ACTIVE} active</span>
        </div>
        <div class="quest-list">
          ${offers.map((o, i) => {
            const taken = activeIds.has(o.name + this.port.name);
            return `<div class="quest-row">
              <div class="quest-info">
                <div class="quest-name">${o.name}</div>
                <div class="quest-desc">${o.desc}</div>
                <div class="quest-reward">${o.reward.gold} gold · ${o.reward.xp} XP</div>
              </div>
              <button class="mini-btn quest-btn" data-i="${i}"
                ${taken || game.quests.active.length >= MAX_ACTIVE ? 'disabled' : ''}>${taken ? 'Taken' : 'Accept'}</button>
            </div>`;
          }).join('')}
          ${game.quests.active.filter((q) => q.type === 'collect').map((q) => {
            const have = game.inventory.totalCount(q.itemId);
            return `<div class="quest-row turnin-row">
              <div class="quest-info"><div class="quest-name">${q.name}</div>
              <div class="quest-desc">You carry ${have}/${q.qty}</div></div>
              <button class="mini-btn turnin-btn" data-id="${q.id}" ${have >= q.qty ? '' : 'disabled'}>Turn In</button>
            </div>`;
          }).join('')}
        </div>
      </section>`;

    this._paintCrewCards(body, hirelings);
    body.querySelectorAll('.crew-action').forEach((b) => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        const m = hirelings[i];
        const r = game.recruitment.attempt(m, 'pay');
        if (!r.joined) {
          game.hud.toast(r.message ?? 'They decline.', '#e0b345');
          return;
        }
        (game.portHired[hiredKey] = game.portHired[hiredKey] ?? []).push(i);
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
    body.querySelector('.prestige-btn')?.addEventListener('click', () => {
      if (confirm('Retire into Legend? Your level resets to 1; everything else stays — plus permanent bonuses.')) {
        game.doPrestige();
        this.render();
      }
    });
  }

  /** Shared crew card markup — the tavern and the Captain's Log both use it. */
  _crewCardHTML(m, i, opts = {}) {
    return crewCardHTML(m, i, opts);
  }

  _paintCrewCards(root, list) {
    paintCrewPortraits(root, list);
  }

  /* ---- market ------------------------------------------------------------ */

  _renderMarket(body) {
    const { game } = this;
    const keys = Object.keys(SHOPS);
    if (!keys.includes(this.shopTab)) this.shopTab = 'general';
    body.innerHTML = `
      <div class="market-tabs">
        ${keys.map((k) => `<button class="market-tab ${k === this.shopTab ? 'active' : ''}" data-shop="${k}">${SHOPS[k].name}</button>`).join('')}
      </div>
      <section class="port-card"><div class="shop-host"></div></section>`;
    body.querySelectorAll('[data-shop]').forEach((b) => b.addEventListener('click', () => {
      this.shopTab = b.dataset.shop;
      game.events.emit('sfx', 'ui');
      this.render();
    }));
    this._renderShop(body.querySelector('.shop-host'), this.shopTab);
  }

  _renderShop(host, shopKey) {
    const { game } = this;
    const shop = SHOPS[shopKey];
    const rng = this._rng(shopKey.length);
    const factionMult = game.clans?.priceMult(shopKey, this.port) ?? 1;
    const dailyMult = game.daily?.modifier?.prices ?? 1;
    const markup = (shopKey === 'black' ? 1.4 : 1) * factionMult * dailyMult;
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
    host.innerHTML = `
      <div class="card-head"><h3>${shop.name}</h3><span class="port-note">Stock changes daily</span></div>
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
    host.querySelectorAll('.buy-btn').forEach((b) => {
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
        this.el.querySelector('.port-purse b').textContent = game.resources.coins;
      });
    });
  }

  /* ---- outfitter --------------------------------------------------------- */

  _renderOutfitter(body) {
    const { game } = this;
    const defs = game.cosmeticsDefs;
    const own = game.clans.playerClan;
    // Categories in the order a shipwright would work through them.
    const CATS = [
      { kind: 'paint', name: 'Hull Paint', entries: null },
      { kind: 'sail', name: 'Sails', entries: defs.SAILS },
      { kind: 'pattern', name: 'Sail Patterns', entries: defs.SAIL_PATTERNS },
      { kind: 'flag', name: 'Flags', entries: defs.FLAGS },
      { kind: 'figurehead', name: 'Figureheads', entries: defs.FIGUREHEADS },
      { kind: 'cannon', name: 'Cannons', entries: defs.CANNONS },
      { kind: 'cannonfx', name: 'Cannon Effects', entries: defs.CANNON_FX },
      { kind: 'lantern', name: 'Lanterns', entries: defs.LANTERNS },
      { kind: 'decor', name: 'Deck Fittings', entries: defs.DECOR },
    ];
    if (!CATS.some((c) => c.kind === this.cosmeticTab)) this.cosmeticTab = 'paint';
    const cat = CATS.find((c) => c.kind === this.cosmeticTab);

    const optionHTML = (id, def, kind) => {
      const owned = kind === 'paint'
        ? game.shipState.paints.includes(id)
        : game.cosmetics.isUnlocked(kind, id);
      const active = kind === 'paint'
        ? game.shipState.paint === id
        : game.cosmetics.equipped[kind] === id;
      const cost = def.cost ?? 0;
      // No cost and not owned means it is an unlock — earned, not bought.
      const locked = !owned && !def.cost;
      const swatch = def.tint ? def.tint.replace(/[\d.]+\)$/, '1)')
        : def.barrel ? def.barrel
        : def.color ? `rgb(${def.color.join(',')})`
        : def.body ? def.body
        : null;
      return `<button class="cos-option ${active ? 'active' : ''} ${locked ? 'locked' : ''}"
        data-kind="${kind}" data-id="${id}" ${locked ? 'disabled' : ''}>
        ${swatch ? `<i class="cos-swatch" style="background:${swatch}"></i>`
          : '<i class="cos-swatch none"></i>'}
        <span class="cos-name">${def.name}</span>
        <span class="cos-state">${active ? 'Fitted' : owned ? 'Owned' : locked ? '🔒 Earned' : `${cost}g`}</span>
      </button>`;
    };

    const entries = cat.kind === 'paint'
      ? PAINTS.map((p) => optionHTML(p.id, p, 'paint')).join('')
      : Object.entries(cat.entries).map(([id, def]) => {
        // The clan pattern and clan flag only mean anything once you have
        // colours of your own to put on them.
        if ((id === 'clan') && !own) return '';
        return optionHTML(id, def, cat.kind);
      }).join('');

    body.innerHTML = `
      <div class="customize">
        <section class="cos-preview-panel">
          <canvas class="cos-preview" width="150" height="150"></canvas>
          <div class="cos-fitted">
            ${CATS.map((c) => {
              const id = c.kind === 'paint' ? game.shipState.paint : game.cosmetics.equipped[c.kind];
              const def = c.kind === 'paint' ? PAINTS.find((p) => p.id === id) : c.entries[id];
              return `<div><span>${c.name}</span><b>${def?.name ?? '—'}</b></div>`;
            }).join('')}
          </div>
        </section>
        <section class="cos-picker">
          <div class="cos-tabs">
            ${CATS.map((c) => `<button class="cos-tab ${c.kind === this.cosmeticTab ? 'active' : ''}"
              data-cat="${c.kind}">${c.name}</button>`).join('')}
          </div>
          <div class="cos-options">${entries}</div>
          <p class="port-note">Everything here is a look, not a stat. Locked pieces come from
          collections, achievements, legend and the great ships.</p>
        </section>
      </div>`;

    this._drawShipPreview(body.querySelector('.cos-preview'));
    body.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      this.cosmeticTab = b.dataset.cat;
      game.events.emit('sfx', 'ui');
      this.render();
    }));
    body.querySelectorAll('.cos-option').forEach((b) => {
      b.addEventListener('click', () => {
        const { kind, id } = b.dataset;
        if (kind === 'paint') {
          const p = PAINTS.find((x) => x.id === id);
          if (!game.shipState.paints.includes(id)) {
            if (game.resources.coins < p.cost) {
              game.hud.toast('Not enough gold.', '#e05a4a');
              return;
            }
            game.resources.coins -= p.cost;
            game.shipState.paints.push(id);
            game.events.emit('resources:changed', { ...game.resources });
          }
          game.shipState.paint = id;
        } else {
          const def = game.cosmeticsDefs[{
            sail: 'SAILS', flag: 'FLAGS', figurehead: 'FIGUREHEADS', lantern: 'LANTERNS',
            cannon: 'CANNONS', cannonfx: 'CANNON_FX', pattern: 'SAIL_PATTERNS', decor: 'DECOR',
          }[kind]][id];
          if (!game.cosmetics.isUnlocked(kind, id)) {
            const cost = def.cost ?? 0;
            if (!cost || game.resources.coins < cost) {
              game.hud.toast(cost ? 'Not enough gold.' : 'That one has to be earned.', '#e05a4a');
              return;
            }
            game.resources.coins -= cost;
            game.cosmetics.unlock(kind, id);
            game.events.emit('resources:changed', { ...game.resources });
          }
          game.cosmetics.equip(kind, id);
        }
        game.events.emit('sfx', 'buy');
        this.render();
      });
    });
  }

  /**
   * The player's actual ship, drawn with everything currently fitted —
   * the point of a customization screen is seeing the change before you
   * pay for it, not reading a list of names.
   */
  _drawShipPreview(canvas) {
    if (!canvas) return;
    const { game } = this;
    const g = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    g.clearRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    const water = g.createLinearGradient(0, 0, 0, H);
    water.addColorStop(0, '#1c3252');
    water.addColorStop(1, '#0e1e36');
    g.fillStyle = water;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);

    // Sync fittings, then let the ship draw itself bow-up in the middle.
    game._syncPaint();
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(2.1, 2.1);
    // Point her north by setting the heading rather than rotating the
    // context: the captain sprite is deliberately drawn unrotated in
    // world space, so a rotated context lays them on their side.
    const ship = game.ship;
    const keep = { x: ship.x, y: ship.y, heading: ship.heading, bob: ship.bob, roll: ship.roll };
    ship.x = 0;
    ship.y = 0;
    ship.heading = -Math.PI / 2;
    ship.bob = 0;
    ship.roll = 0;
    ship.draw(g, game.time, game.dayNight);
    Object.assign(ship, keep);
    g.restore();
  }

}
