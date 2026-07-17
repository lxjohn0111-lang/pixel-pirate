// Procedural pixel-art sprite factory. All art is generated once at
// startup onto offscreen canvases — no external assets, always crisp.

import { shade } from './pirate.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const cache = new Map();

/** Get-or-build a named sprite canvas. */
export function sprite(name, builder) {
  let c = cache.get(name);
  if (!c) {
    c = builder();
    cache.set(name, c);
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Ship                                                                */
/* ------------------------------------------------------------------ */

const HULL = '#8a5a34';
const HULL_DARK = '#5e3c22';
const DECK = '#b98a55';
const DECK_DARK = '#9a6f42';
const SAIL = '#e8ddc4';
const SAIL_SHADE = '#cec2a6';

export const SHIP_W = 52;
export const SHIP_H = 34;

/** Hull half-width at position x along the ship (0..SHIP_W). Bow at high x. */
function hullHalf(x) {
  const bowStart = 36;
  const sternEnd = 8;
  let h = 8;
  if (x > bowStart) {
    const t = (x - bowStart) / (SHIP_W - 4 - bowStart);
    h = 8 * Math.sqrt(Math.max(0, 1 - t * t));
  } else if (x < sternEnd) {
    const t = (sternEnd - x) / sternEnd;
    h = 8 * (1 - t * t * 0.55);
  }
  return h;
}

/** Static hull, drawn facing +x. Slight top-down angle: the southern
 *  hull side is visible below the deck. */
export function shipHull() {
  return sprite('shipHull', () => {
    const c = makeCanvas(SHIP_W, SHIP_H);
    const g = c.getContext('2d');
    const cy = 15;
    for (let x = 4; x < SHIP_W - 2; x++) {
      const h = hullHalf(x);
      if (h < 0.6) continue;
      const top = Math.round(cy - h);
      const bot = Math.round(cy + h);
      // visible hull side (the "slight angle" look)
      g.fillStyle = HULL_DARK;
      g.fillRect(x, bot, 1, 3);
      g.fillStyle = HULL;
      g.fillRect(x, bot, 1, 1);
      // rail outline
      g.fillStyle = HULL_DARK;
      g.fillRect(x, top, 1, 1);
      g.fillRect(x, bot - 1, 1, 1);
      // deck planks (lengthwise)
      for (let y = top + 1; y < bot - 1; y++) {
        const lane = y - cy;
        g.fillStyle = (lane === -3 || lane === 0 || lane === 3) ? DECK_DARK : DECK;
        g.fillRect(x, y, 1, 1);
      }
    }
    // raised stern (captain's) deck
    g.fillStyle = shade(DECK, 14);
    g.fillRect(6, cy - 5, 8, 11);
    g.fillStyle = DECK_DARK;
    g.fillRect(13, cy - 5, 1, 11);
    g.fillStyle = HULL_DARK;
    g.fillRect(6, cy - 6, 8, 1);
    g.fillRect(6, cy + 6, 8, 1);
    // bowsprit
    g.fillStyle = HULL_DARK;
    g.fillRect(SHIP_W - 4, cy - 1, 4, 2);
    // stern lantern anchor (glows at night)
    g.fillStyle = '#e0b345';
    g.fillRect(4, cy - 1, 2, 2);
    return c;
  });
}

/** Sail frames: 3 billow states. Drawn separately so it can animate.
 *  A square-rigged sail seen from above: wider than the hull, bowing
 *  toward the bow (+x) as the wind fills it. */
export function shipSail(frame) {
  return sprite(`shipSail${frame}`, () => {
    const c = makeCanvas(SHIP_W, SHIP_H);
    const g = c.getContext('2d');
    const cy = 15;
    const mastX = 26;
    const half = 13;
    const billow = 3 + frame * 1.6;
    // yardarm (the spar the sail hangs from)
    g.fillStyle = '#3a2b1e';
    g.fillRect(mastX - 2, cy - half - 1, 2, 2);
    g.fillRect(mastX - 2, cy + half, 2, 2);
    for (let y = -half; y <= half; y++) {
      const t = Math.abs(y) / half;
      const bow = Math.round((1 - t * t) * billow);
      const x0 = mastX - 1 + bow;
      g.fillStyle = SAIL;
      g.fillRect(x0, cy + y, 5, 1);
      g.fillStyle = '#f6efdd'; // sunlit leading edge
      g.fillRect(x0 + 4, cy + y, 1, 1);
      g.fillStyle = SAIL_SHADE; // shaded trailing edge
      g.fillRect(x0, cy + y, 1, 1);
      if ((y + half) % 6 === 0 && t < 0.9) {
        g.fillStyle = SAIL_SHADE; // canvas seams
        g.fillRect(x0 + 1, cy + y, 3, 1);
      }
    }
    // mast
    g.fillStyle = '#3a2b1e';
    g.fillRect(mastX - 1, cy - 1, 2, 2);
    return c;
  });
}

/** Furled sail: canvas rolled up against the yard while at anchor. */
export function shipSailFurled() {
  return sprite('shipSailFurled', () => {
    const c = makeCanvas(SHIP_W, SHIP_H);
    const g = c.getContext('2d');
    const cy = 15;
    const mastX = 26;
    const half = 13;
    g.fillStyle = '#3a2b1e';
    g.fillRect(mastX - 2, cy - half - 1, 2, 2);
    g.fillRect(mastX - 2, cy + half, 2, 2);
    for (let y = -half; y <= half; y++) {
      const bulge = (y + half) % 4 === 0 ? 0 : 1;
      g.fillStyle = SAIL_SHADE;
      g.fillRect(mastX - 1, cy + y, 2 + bulge, 1);
      if (bulge) {
        g.fillStyle = SAIL;
        g.fillRect(mastX, cy + y, 1, 1);
      }
    }
    g.fillStyle = '#3a2b1e'; // ties + mast
    g.fillRect(mastX - 1, cy - 7, 3, 1);
    g.fillRect(mastX - 1, cy + 6, 3, 1);
    g.fillRect(mastX - 1, cy - 1, 2, 2);
    return c;
  });
}

/** Black pennant flag frames (flutters with wind). */
export function shipFlag(frame) {
  return sprite(`shipFlag${frame}`, () => {
    const c = makeCanvas(10, 6);
    const g = c.getContext('2d');
    g.fillStyle = '#1e1a22';
    for (let x = 0; x < 8; x++) {
      const wave = Math.round(Math.sin(x * 0.9 + frame * 2.1) * 1.2);
      g.fillRect(x, 2 + wave - (x > 4 ? 0 : 1), 1, 3);
    }
    g.fillStyle = '#e8e4da';
    g.fillRect(2, 2 + Math.round(Math.sin(2 * 0.9 + frame * 2.1)), 2, 1);
    return c;
  });
}

/* ------------------------------------------------------------------ */
/* Collectibles                                                        */
/* ------------------------------------------------------------------ */

export function coinSprite(frame) {
  return sprite(`coin${frame}`, () => {
    const c = makeCanvas(8, 8);
    const g = c.getContext('2d');
    const w = [6, 4, 2, 4][frame]; // spin by squashing width
    const x = Math.round((8 - w) / 2);
    g.fillStyle = '#a8781f';
    g.fillRect(x, 1, w, 6);
    g.fillStyle = '#e0b345';
    g.fillRect(x, 1, w, 5);
    if (w > 2) {
      g.fillStyle = '#f2d98a';
      g.fillRect(x + 1, 2, Math.max(1, w - 3), 2);
    }
    return c;
  });
}

export function woodSprite() {
  return sprite('wood', () => {
    const c = makeCanvas(12, 7);
    const g = c.getContext('2d');
    g.fillStyle = '#6e4a2a';
    g.fillRect(1, 1, 10, 5);
    g.fillStyle = '#8a5f38';
    g.fillRect(1, 1, 10, 3);
    g.fillStyle = '#5a3a20';
    g.fillRect(3, 2, 6, 1);
    g.fillStyle = '#c9a06a'; // cut end rings
    g.fillRect(10, 2, 2, 4);
    g.fillStyle = '#8a5f38';
    g.fillRect(10, 3, 1, 2);
    return c;
  });
}

export function barrelSprite() {
  return sprite('barrel', () => {
    const c = makeCanvas(11, 9);
    const g = c.getContext('2d');
    g.fillStyle = '#7a5a34';
    g.fillRect(1, 1, 9, 7);
    g.fillStyle = '#96703f';
    g.fillRect(1, 1, 9, 4);
    g.fillStyle = '#4a4a52'; // iron bands
    g.fillRect(2, 1, 1, 7);
    g.fillRect(8, 1, 1, 7);
    g.fillStyle = '#5a3a20';
    g.fillRect(4, 2, 3, 1);
    return c;
  });
}

export function crateSprite() {
  return sprite('crate', () => {
    const c = makeCanvas(10, 10);
    const g = c.getContext('2d');
    g.fillStyle = '#a8804c';
    g.fillRect(1, 1, 8, 8);
    g.fillStyle = '#c9a06a';
    g.fillRect(2, 2, 6, 6);
    g.fillStyle = '#8a6438'; // cross planks
    g.fillRect(2, 2, 6, 1);
    g.fillRect(2, 7, 6, 1);
    for (let i = 0; i < 5; i++) g.fillRect(2 + i, 3 + i * 0.8 | 0, 1, 1);
    return c;
  });
}

export function chestSprite() {
  return sprite('chest', () => {
    const c = makeCanvas(13, 11);
    const g = c.getContext('2d');
    g.fillStyle = '#6e4527';
    g.fillRect(1, 3, 11, 7);
    g.fillStyle = '#8a5c33';
    g.fillRect(1, 1, 11, 4); // curved lid
    g.fillRect(2, 0, 9, 2);
    g.fillStyle = '#e0b345'; // gold trim + lock
    g.fillRect(1, 4, 11, 1);
    g.fillRect(5, 4, 3, 3);
    g.fillStyle = '#a8781f';
    g.fillRect(6, 5, 1, 1);
    return c;
  });
}

export const COLLECTIBLE_SPRITES = {
  coin: () => coinSprite(0),
  wood: woodSprite,
  barrel: barrelSprite,
  crate: crateSprite,
  chest: chestSprite,
};

/* ------------------------------------------------------------------ */
/* Water props                                                         */
/* ------------------------------------------------------------------ */

export function seaRockSprite(variant) {
  return sprite(`seaRock${variant}`, () => {
    const c = makeCanvas(16, 12);
    const g = c.getContext('2d');
    const shapes = [
      [[4, 4, 8, 6], [6, 2, 5, 3], [3, 6, 3, 3]],
      [[3, 5, 10, 5], [5, 3, 4, 3]],
      [[5, 3, 6, 7], [3, 6, 4, 4], [9, 5, 5, 4]],
    ][variant % 3];
    for (const [x, y, w, h] of shapes) {
      g.fillStyle = '#5d6165';
      g.fillRect(x, y, w, h);
      g.fillStyle = '#7e8388';
      g.fillRect(x, y, w, Math.max(1, h - 2));
      g.fillStyle = '#9aa0a6';
      g.fillRect(x + 1, y, Math.max(1, w - 3), 1);
    }
    return c;
  });
}

/* ------------------------------------------------------------------ */
/* HUD icons                                                            */
/* ------------------------------------------------------------------ */

export function hudCoinIcon() {
  return sprite('hudCoin', () => {
    const c = makeCanvas(9, 9);
    const g = c.getContext('2d');
    g.fillStyle = '#a8781f';
    g.fillRect(1, 1, 7, 7);
    g.fillStyle = '#e0b345';
    g.fillRect(1, 1, 7, 6);
    g.fillStyle = '#f2d98a';
    g.fillRect(2, 2, 3, 2);
    g.fillStyle = '#a8781f';
    g.fillRect(4, 3, 2, 3);
    return c;
  });
}

export function hudWoodIcon() {
  return sprite('hudWood', () => {
    const c = makeCanvas(11, 9);
    const g = c.getContext('2d');
    g.fillStyle = '#6e4a2a';
    g.fillRect(0, 2, 10, 4);
    g.fillStyle = '#8a5f38';
    g.fillRect(0, 2, 10, 2);
    g.fillStyle = '#c9a06a';
    g.fillRect(9, 2, 2, 4);
    g.fillStyle = '#6e4a2a';
    g.fillRect(1, 5, 9, 3);
    g.fillStyle = '#8a5f38';
    g.fillRect(1, 5, 9, 1);
    return c;
  });
}

/* ------------------------------------------------------------------ */
/* Part 2: AI ships, encounters, ports                                 */
/* ------------------------------------------------------------------ */

const SHIP_STYLES = {
  fishing:  { w: 32, h: 22, hull: '#9a7448', deck: '#c9a06a', sail: null,      trim: '#7a5a34' },
  civilian: { w: 44, h: 30, hull: '#8a5a34', deck: '#b98a55', sail: '#e8ddc4', trim: '#5e3c22' },
  merchant: { w: 58, h: 38, hull: '#96703f', deck: '#c9a06a', sail: '#f0e8d8', trim: '#6e4a2a' },
  pirate:   { w: 52, h: 34, hull: '#5a4632', deck: '#8a6f4a', sail: '#4a4a52', trim: '#3a2b1e' },
  navy:     { w: 60, h: 38, hull: '#7a5a34', deck: '#c9b284', sail: '#eef2f4', trim: '#3a4e8e' },
  ghost:    { w: 56, h: 36, hull: '#3a5e56', deck: '#5a8a7c', sail: '#a8e0c8', trim: '#1e3a34' },
  duchess:  { w: 72, h: 44, hull: '#2e4a44', deck: '#4a7268', sail: '#8ad0b4', trim: '#142a26' },
};

/** Generic AI ship hull, pointing +x, in the same style as the player's. */
export function aiShipHull(type) {
  return sprite(`aiHull:${type}`, () => {
    const st = SHIP_STYLES[type];
    const c = makeCanvas(st.w, st.h + 4);
    const g = c.getContext('2d');
    const cy = Math.floor(st.h / 2);
    const half = Math.floor(st.h / 2) - 3;
    const bowStart = st.w * 0.68;
    const sternEnd = st.w * 0.16;
    for (let x = 3; x < st.w - 2; x++) {
      let hh = half;
      if (x > bowStart) {
        const t = (x - bowStart) / (st.w - 3 - bowStart);
        hh = half * Math.sqrt(Math.max(0, 1 - t * t));
      } else if (x < sternEnd) {
        const t = (sternEnd - x) / sternEnd;
        hh = half * (1 - t * t * 0.5);
      }
      if (hh < 0.6) continue;
      const top = Math.round(cy - hh);
      const bot = Math.round(cy + hh);
      g.fillStyle = st.trim;
      g.fillRect(x, bot, 1, 3);
      g.fillStyle = st.hull;
      g.fillRect(x, bot, 1, 1);
      g.fillStyle = st.trim;
      g.fillRect(x, top, 1, 1);
      g.fillRect(x, bot - 1, 1, 1);
      for (let y = top + 1; y < bot - 1; y++) {
        const lane = y - cy;
        g.fillStyle = lane % 3 === 0 ? shade(st.deck, -18) : st.deck;
        g.fillRect(x, y, 1, 1);
      }
    }
    // navy hull stripe
    if (type === 'navy') {
      g.fillStyle = st.trim;
      g.fillRect(6, cy + half - 1, st.w - 14, 1);
    }
    if (type === 'fishing') {
      // rowing bench + crates
      g.fillStyle = st.trim;
      g.fillRect(Math.round(st.w * 0.4), cy - half + 2, 2, half * 2 - 4);
      g.fillStyle = '#8a6438';
      g.fillRect(6, cy - 2, 4, 4);
    }
    return c;
  });
}

/** Sail for an AI ship (one billow state — AI doesn't need frames). */
export function aiShipSail(type) {
  return sprite(`aiSail:${type}`, () => {
    const st = SHIP_STYLES[type];
    const c = makeCanvas(st.w, st.h + 4);
    if (!st.sail) return c;
    const g = c.getContext('2d');
    const cy = Math.floor(st.h / 2);
    const mastX = Math.floor(st.w * 0.52);
    const half = Math.floor(st.h / 2) - 1;
    g.fillStyle = st.trim;
    g.fillRect(mastX - 2, cy - half - 1, 2, 2);
    g.fillRect(mastX - 2, cy + half, 2, 2);
    for (let y = -half; y <= half; y++) {
      const t = Math.abs(y) / half;
      const bow = Math.round((1 - t * t) * 4);
      g.fillStyle = st.sail;
      g.fillRect(mastX - 1 + bow, cy + y, 5, 1);
      g.fillStyle = shade(st.sail, -22);
      g.fillRect(mastX - 1 + bow, cy + y, 1, 1);
    }
    if (type === 'pirate') {
      // ragged skull mark
      g.fillStyle = '#e8e4da';
      g.fillRect(mastX + 2, cy - 2, 2, 2);
      g.fillRect(mastX + 1, cy + 1, 1, 1);
      g.fillRect(mastX + 4, cy + 1, 1, 1);
    }
    if (type === 'navy') {
      g.fillStyle = st.trim;
      g.fillRect(mastX + 1, cy - half + 2, 3, 1);
    }
    g.fillStyle = '#3a2b1e';
    g.fillRect(mastX - 1, cy - 1, 2, 2);
    return c;
  });
}

/** Broken ship wreck: two hull halves, snapped mast, cargo spill. */
export function wreckSprite(variant) {
  return sprite(`wreck${variant}`, () => {
    const c = makeCanvas(56, 36);
    const g = c.getContext('2d');
    const tilt = variant % 2 === 0 ? 1 : -1;
    // fore half
    g.save();
    g.translate(34, 18);
    g.rotate(0.18 * tilt);
    g.fillStyle = '#5e4630';
    g.fillRect(-10, -7, 22, 14);
    g.fillStyle = '#7a5c3c';
    g.fillRect(-10, -7, 22, 10);
    g.fillStyle = '#4a3624';
    g.fillRect(-10, -8, 22, 1);
    for (let i = 0; i < 5; i++) g.fillRect(-9 + i * 4, -7 + (i % 2), 1, 12); // broken planks
    g.restore();
    // aft half, sunk lower
    g.save();
    g.translate(12, 22);
    g.rotate(-0.3 * tilt);
    g.fillStyle = '#54402c';
    g.fillRect(-9, -5, 16, 10);
    g.fillStyle = '#6a5036';
    g.fillRect(-9, -5, 16, 6);
    g.restore();
    // snapped mast + torn sail
    g.fillStyle = '#3a2b1e';
    g.fillRect(28, 4, 2, 12);
    g.fillStyle = 'rgba(210,200,175,0.8)';
    g.fillRect(22, 5, 7, 4);
    g.fillRect(24, 9, 4, 2);
    return c;
  });
}

/** Small supply raft: lashed planks with a stub mast. */
export function raftSprite() {
  return sprite('raft', () => {
    const c = makeCanvas(22, 18);
    const g = c.getContext('2d');
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? '#96703f' : '#8a6438';
      g.fillRect(2, 2 + i * 3, 18, 3);
    }
    g.fillStyle = '#5a3a20';
    g.fillRect(2, 2, 18, 1);
    g.fillRect(2, 16, 18, 1);
    g.fillRect(6, 2, 1, 15);
    g.fillRect(15, 2, 1, 15);
    // stub mast + rag
    g.fillStyle = '#3a2b1e';
    g.fillRect(10, 3, 2, 6);
    g.fillStyle = '#d9c9a0';
    g.fillRect(12, 3, 5, 3);
    // barrel
    g.fillStyle = '#7a5a34';
    g.fillRect(4, 9, 5, 5);
    g.fillStyle = '#4a4a52';
    g.fillRect(5, 9, 1, 5);
    return c;
  });
}

/** Tent for abandoned camps. */
export function tentSprite() {
  return sprite('tent', () => {
    const c = makeCanvas(16, 12);
    const g = c.getContext('2d');
    g.fillStyle = '#a8917a';
    for (let y = 0; y < 9; y++) {
      const w = 2 + Math.round((y / 9) * 12);
      g.fillRect(8 - w / 2, 2 + y, w, 1);
    }
    g.fillStyle = '#8a755f';
    for (let y = 3; y < 11; y++) g.fillRect(8, y, Math.round(((y - 2) / 9) * 6), 1);
    g.fillStyle = '#42332a';
    g.fillRect(7, 6, 2, 5); // opening
    g.fillStyle = '#5a4632';
    g.fillRect(7, 1, 2, 2); // pole top
    return c;
  });
}

/** Port dock: planked pier reaching into the water, with posts. */
export function dockSprite() {
  return sprite('dock', () => {
    const c = makeCanvas(20, 46);
    const g = c.getContext('2d');
    for (let y = 0; y < 42; y += 3) {
      g.fillStyle = y % 6 ? '#96703f' : '#8a6438';
      g.fillRect(3, y, 14, 3);
    }
    g.fillStyle = '#5a3a20';
    g.fillRect(3, 0, 1, 42);
    g.fillRect(16, 0, 1, 42);
    // posts with water shadow
    for (const y of [4, 18, 32, 41]) {
      g.fillStyle = '#4a3624';
      g.fillRect(1, y, 3, 4);
      g.fillRect(16, y, 3, 4);
    }
    return c;
  });
}

/** Port buildings cluster (drawn on the island near the dock). */
export function portHouseSprite(variant) {
  return sprite(`portHouse${variant}`, () => {
    const c = makeCanvas(20, 18);
    const g = c.getContext('2d');
    const wall = ['#c9b284', '#b09a74', '#9a8a6f'][variant % 3];
    const roof = ['#8e2f2f', '#3a4e8e', '#5a4632'][variant % 3];
    g.fillStyle = wall;
    g.fillRect(3, 8, 14, 9);
    g.fillStyle = shade(wall, -24);
    g.fillRect(3, 16, 14, 1);
    g.fillStyle = roof;
    g.fillRect(1, 5, 18, 4);
    g.fillStyle = shade(roof, -30);
    g.fillRect(1, 8, 18, 1);
    g.fillStyle = '#42332a';
    g.fillRect(8, 11, 3, 6); // door
    g.fillStyle = '#f2d98a';
    g.fillRect(5, 10, 2, 2); // lit window
    g.fillRect(13, 10, 2, 2);
    return c;
  });
}

/** Message bottle bobbing in the sea. */
export function bottleSprite() {
  return sprite('bottle', () => {
    const c = makeCanvas(8, 8);
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(150,205,215,0.85)';
    g.fillRect(1, 3, 6, 3);
    g.fillStyle = '#7a5a34';
    g.fillRect(6, 3, 2, 3);
    g.fillStyle = '#d9c9a0';
    g.fillRect(2, 4, 3, 1);
    g.fillStyle = 'rgba(230,246,252,0.7)';
    g.fillRect(1, 3, 2, 1);
    return c;
  });
}

/** Locked chest (needs a rusty key). */
export function lockedChestSprite() {
  return sprite('lockedChest', () => {
    const c = makeCanvas(13, 11);
    const g = c.getContext('2d');
    g.fillStyle = '#4a3a52';
    g.fillRect(1, 3, 11, 7);
    g.fillStyle = '#635077';
    g.fillRect(1, 1, 11, 4);
    g.fillRect(2, 0, 9, 2);
    g.fillStyle = '#e0b345';
    g.fillRect(1, 4, 11, 1);
    g.fillRect(4, 3, 5, 5);
    g.fillStyle = '#26202a';
    g.fillRect(6, 5, 1, 2);
    return c;
  });
}

/* ------------------------------------------------------------------ */
/* Part 3: cosmetic flags & figureheads                                */
/* ------------------------------------------------------------------ */

/** Pennant flag in custom colors, with an optional skull mark. */
export function styledFlag(frame, flagId, body, mark) {
  return sprite(`flag:${flagId}:${frame}`, () => {
    const c = makeCanvas(10, 6);
    const g = c.getContext('2d');
    g.fillStyle = body;
    for (let x = 0; x < 8; x++) {
      const wave = Math.round(Math.sin(x * 0.9 + frame * 2.1) * 1.2);
      g.fillRect(x, 2 + wave - (x > 4 ? 0 : 1), 1, 3);
    }
    g.fillStyle = mark;
    const my = 2 + Math.round(Math.sin(2 * 0.9 + frame * 2.1));
    if (flagId === 'skull' || flagId === 'scourge' || flagId === 'kraken') {
      g.fillRect(2, my, 2, 1);
      g.fillRect(1, my + 1, 1, 1);
      g.fillRect(4, my + 1, 1, 1);
    } else if (flagId === 'legend') {
      g.fillRect(2, my - 1, 1, 1);
      g.fillRect(3, my, 1, 1);
      g.fillRect(2, my + 1, 1, 1);
      g.fillRect(1, my, 1, 1);
    } else {
      g.fillRect(2, my, 2, 1);
    }
    return c;
  });
}

/** Bow figurehead, drawn pointing +x (fitted at the bowsprit). */
export function figureheadSprite(id) {
  return sprite(`fig:${id}`, () => {
    const c = makeCanvas(8, 8);
    const g = c.getContext('2d');
    const p = (x, y, w, h, col) => {
      g.fillStyle = col;
      g.fillRect(x, y, w, h);
    };
    switch (id) {
      case 'swan':
        p(1, 3, 4, 3, '#eef2f4');
        p(4, 1, 2, 3, '#eef2f4');
        p(6, 1, 2, 2, '#e0b345');
        break;
      case 'skull':
        p(2, 2, 4, 4, '#e8e4da');
        p(3, 3, 1, 1, '#1e1a22');
        p(5, 3, 1, 1, '#1e1a22');
        p(3, 5, 3, 1, '#c8c4ba');
        break;
      case 'mermaid':
        p(1, 4, 4, 2, '#2e8e7e');
        p(4, 2, 3, 3, '#e0b48a');
        p(4, 1, 3, 1, '#b5502a');
        break;
      case 'dragon':
        p(1, 3, 4, 3, '#5d7a2e');
        p(4, 1, 3, 4, '#6e8e3a');
        p(6, 2, 2, 1, '#e05a3c');
        p(5, 2, 1, 1, '#f0d040');
        break;
      case 'kraken':
        p(2, 2, 4, 4, '#54407a');
        p(1, 5, 2, 2, '#3a2a52');
        p(5, 5, 2, 2, '#3a2a52');
        p(3, 3, 1, 1, '#f0d040');
        break;
      case 'leviathan':
        p(1, 3, 5, 3, '#2e6e64');
        p(5, 1, 3, 4, '#4ec9b0');
        p(6, 2, 1, 1, '#f0d040');
        p(2, 2, 1, 1, '#4ec9b0');
        break;
      default:
        break;
    }
    return c;
  });
}
