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
