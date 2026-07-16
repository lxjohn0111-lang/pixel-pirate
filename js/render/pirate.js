// Layered pixel-art pirate. The captain is drawn procedurally from an
// appearance object so every combination of options composes cleanly.
// The same drawing code powers the character creator (large, animated)
// and the tiny captain standing on the ship deck.

import { mulberry32 } from '../util/random.js';

export const SKIN_COLORS = ['#f2cda6', '#e6b98d', '#cf9d6e', '#b07c50', '#8a5a3b', '#67422b'];
export const HAIR_COLORS = ['#26202a', '#4d3421', '#7a4a26', '#c9973f', '#b5502a', '#8b8b90', '#e8e4da', '#3e6e8e'];

/** Shared 12-color palette for primary / secondary outfit colors. */
export const PALETTE = [
  '#8e2f2f', '#b5502a', '#c9973f', '#5d7a2e',
  '#2e6e4e', '#2f6e8e', '#3a4e8e', '#5e3a7a',
  '#8e3a62', '#5a4632', '#3a3a42', '#d9d0c0',
];

export const OPTIONS = {
  skin: { label: 'Skin', values: ['Pale', 'Tan', 'Olive', 'Bronze', 'Brown', 'Ebony'] },
  hair: { label: 'Hair', values: ['Bald', 'Short', 'Long', 'Ponytail', 'Curly', 'Dreads'] },
  hairColor: { label: 'Hair Color', values: HAIR_COLORS.map((_, i) => `${i + 1}`) },
  beard: { label: 'Beard', values: ['None', 'Stubble', 'Mustache', 'Goatee', 'Full', 'Braided'] },
  hat: { label: 'Hat', values: ['None', 'Bandana', 'Tricorne', 'Captain', 'Straw', 'Cavalier'] },
  coat: { label: 'Coat', values: ['Shirt', 'Vest', 'Long Coat', 'Naval', 'Ragged'] },
  pants: { label: 'Pants', values: ['Plain', 'Striped', 'Ragged', 'Fine'] },
  boots: { label: 'Boots', values: ['Leather', 'Tall', 'Worn', 'Buckled'] },
  eyepatch: { label: 'Eye Patch', values: ['None', 'Left', 'Right'] },
  hook: { label: 'Hook', values: ['None', 'Left', 'Right'] },
  woodenLeg: { label: 'Wooden Leg', values: ['None', 'Left', 'Right'] },
};

export function defaultAppearance() {
  return {
    skin: 1, hair: 1, hairColor: 1, beard: 0, hat: 2, coat: 2, pants: 0, boots: 0,
    eyepatch: 0, hook: 0, woodenLeg: 0, primary: 0, secondary: 10,
  };
}

export function randomAppearance(seed = (Math.random() * 0xffffffff) >>> 0) {
  const rng = mulberry32(seed);
  const idx = (n) => (rng() * n) | 0;
  const maybe = (p, n) => (rng() < p ? 1 + idx(n - 1) : 0);
  return {
    skin: idx(OPTIONS.skin.values.length),
    hair: idx(OPTIONS.hair.values.length),
    hairColor: idx(HAIR_COLORS.length),
    beard: idx(OPTIONS.beard.values.length),
    hat: idx(OPTIONS.hat.values.length),
    coat: idx(OPTIONS.coat.values.length),
    pants: idx(OPTIONS.pants.values.length),
    boots: idx(OPTIONS.boots.values.length),
    eyepatch: maybe(0.28, 2),
    hook: maybe(0.22, 2),
    woodenLeg: maybe(0.18, 2),
    primary: idx(PALETTE.length),
    secondary: idx(PALETTE.length),
  };
}

export const PIRATE_W = 22;
export const PIRATE_H = 30;

const DARK = '#26202a';
const WOOD = '#b08a55';
const WOOD_DARK = '#7a5a34';
const METAL = '#c8ccd4';
const GOLD = '#e0b345';

/**
 * Draw the pirate at 1px-per-pixel into ctx at (0,0), 22x30.
 * opts.t drives idle animation (bob + blink); omit for a static pose.
 */
export function drawPirate(g, a, opts = {}) {
  const t = opts.t ?? 0;
  const bob = opts.animate ? Math.round(Math.sin(t * 2.1) * 0.6 + 0.5) : 0;
  const blink = opts.animate && t % 3.7 < 0.12;

  const skin = SKIN_COLORS[a.skin];
  const skinShade = shade(skin, -24);
  const hc = HAIR_COLORS[a.hairColor];
  const pc = PALETTE[a.primary];
  const sc = PALETTE[a.secondary];

  const p = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x, y + bob, w, h);
  };

  // ---- legs / pants -------------------------------------------------
  const pantsCol = ['#4a3a2e', '#8e2f2f', '#5a4a38', sc][a.pants];
  const legX = [8, 12]; // left leg, right leg (viewer space)
  const pegLeg = a.woodenLeg; // 0 none, 1 pirate-left (viewer right), 2 pirate-right
  const pegSide = pegLeg === 1 ? 1 : pegLeg === 2 ? 0 : -1;

  for (let i = 0; i < 2; i++) {
    const x = legX[i];
    if (i === pegSide) {
      // Wooden peg: thin post from the knee down.
      p(x, 22, 2, 2, pantsCol);
      p(x, 24, 1, 5, WOOD);
      p(x, 28, 1, 1, WOOD_DARK);
      continue;
    }
    p(x, 22, 2, 4, pantsCol);
    if (a.pants === 1) {
      // Striped
      p(x, 23, 2, 1, '#d9d0c0');
      p(x, 25, 2, 1, '#d9d0c0');
    }
    if (a.pants === 3) p(x, 22, 1, 4, shade(pantsCol, 18)); // fine seam
    // ---- boots
    const bootCol = ['#3a2b20', '#2c2118', '#4d3d30', '#3a2b20'][a.boots];
    const bootTop = a.boots === 1 ? 24 : 26; // tall boots ride higher
    p(x, bootTop, 2, 29 - bootTop, bootCol);
    p(i === 0 ? x - 1 : x + 2, 28, 1, 1, bootCol); // toe
    if (a.boots === 3) p(x, 26, 2, 1, GOLD); // buckle
    if (a.boots === 2) p(x + i, 27, 1, 1, pantsCol); // worn hole
  }

  // ---- long-coat tails hang over the hips ---------------------------
  if (a.coat === 2) {
    p(6, 21, 2, 4, pc);
    p(14, 21, 2, 4, pc);
    p(6, 24, 2, 1, shade(pc, -20));
    p(14, 24, 2, 1, shade(pc, -20));
  }

  // ---- torso ---------------------------------------------------------
  const shirtCol = a.coat === 1 ? sc : pc;
  p(6, 14, 10, 7, shirtCol);
  p(6, 20, 10, 1, shade(shirtCol, -18));
  switch (a.coat) {
    case 0: // Shirt: lace-up collar
      p(10, 14, 2, 1, sc);
      p(11, 15, 1, 2, '#d9d0c0');
      break;
    case 1: // Vest over shirt
      p(6, 14, 3, 7, pc);
      p(13, 14, 3, 7, pc);
      p(10, 16, 1, 1, GOLD);
      p(11, 18, 1, 1, GOLD);
      break;
    case 2: // Long coat: lapels + buttons
      p(8, 14, 1, 4, sc);
      p(13, 14, 1, 4, sc);
      p(10, 15, 1, 1, GOLD);
      p(11, 17, 1, 1, GOLD);
      p(10, 19, 1, 1, GOLD);
      break;
    case 3: // Naval: epaulettes + sash
      p(5, 14, 3, 1, GOLD);
      p(14, 14, 3, 1, GOLD);
      for (let i = 0; i < 6; i++) p(7 + i, 15 + i, 1, 1, '#d9d0c0');
      break;
    case 4: // Ragged: patches + torn hem
      p(8, 16, 2, 2, sc);
      p(12, 18, 2, 1, sc);
      g.clearRect(7, 20 + bob, 1, 1);
      g.clearRect(11, 20 + bob, 1, 1);
      g.clearRect(14, 20 + bob, 1, 1);
      break;
  }
  // Belt + buckle
  p(6, 21, 10, 1, '#2c2118');
  p(10, 21, 2, 1, GOLD);

  // ---- arms ----------------------------------------------------------
  const sleeve = a.coat === 4 ? [true, false] : [true, true]; // ragged: one torn sleeve
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? 4 : 16;
    if (sleeve[i]) {
      p(x, 14, 2, 5, shirtCol);
      if (a.coat === 2 || a.coat === 3) p(x, 18, 2, 1, sc); // cuff
    } else {
      p(x, 14, 2, 2, shirtCol);
      p(x, 16, 2, 3, skin);
    }
    // hand or hook
    const hookHere = (a.hook === 1 && i === 1) || (a.hook === 2 && i === 0);
    if (hookHere) {
      p(x, 19, 2, 1, '#2c2118'); // cuff band
      p(x, 20, 1, 1, METAL);
      p(x + 1, 20, 1, 2, METAL);
      p(x, 22, 1, 1, METAL);
    } else {
      p(x, 19, 2, 2, skin);
    }
  }

  // ---- head ----------------------------------------------------------
  p(10, 13, 2, 1, skin); // neck
  p(7, 5, 8, 8, skin);
  p(7, 11, 8, 2, skinShade); // jaw shading
  p(7, 11, 8, 1, skin);
  p(6, 8, 1, 2, skin); // ears
  p(15, 8, 1, 2, skin);

  // ---- hair (behind hat) ----------------------------------------------
  switch (a.hair) {
    case 1: // Short
      p(7, 4, 8, 2, hc);
      p(7, 5, 1, 3, hc);
      p(14, 5, 1, 3, hc);
      break;
    case 2: // Long
      p(7, 4, 8, 2, hc);
      p(5, 5, 2, 11, hc);
      p(15, 5, 2, 11, hc);
      break;
    case 3: // Ponytail
      p(7, 4, 8, 2, hc);
      p(9, 2, 4, 2, hc);
      p(15, 5, 2, 8, hc);
      p(16, 12, 1, 2, hc);
      break;
    case 4: // Curly
      p(6, 3, 10, 3, hc);
      p(6, 5, 2, 4, hc);
      p(14, 5, 2, 4, hc);
      p(8, 2, 2, 1, hc);
      p(12, 2, 2, 1, hc);
      break;
    case 5: // Dreads
      p(7, 3, 8, 3, hc);
      p(5, 5, 2, 9, hc);
      p(15, 5, 2, 9, hc);
      p(6, 13, 1, 2, hc);
      p(16, 13, 1, 2, hc);
      break;
  }

  // ---- face ------------------------------------------------------------
  p(9, 7, 1, 1, hc); // brows
  p(13, 7, 1, 1, hc);
  if (blink) {
    p(9, 8, 1, 1, skinShade);
    p(13, 8, 1, 1, skinShade);
  } else {
    p(9, 8, 1, 1, DARK);
    p(13, 8, 1, 1, DARK);
  }
  p(11, 9, 1, 2, skinShade); // nose
  p(10, 11, 3, 1, '#7a4038'); // mouth

  // Eye patch (pirate's left = viewer right)
  if (a.eyepatch) {
    const ex = a.eyepatch === 1 ? 12 : 8;
    p(7, 7, 8, 1, DARK); // strap
    p(ex, 7, 2, 2, DARK);
  }

  // ---- beard -------------------------------------------------------------
  switch (a.beard) {
    case 1: { // Stubble
      g.globalAlpha = 0.4;
      p(8, 10, 6, 3, hc);
      g.globalAlpha = 1;
      break;
    }
    case 2: // Mustache
      p(9, 10, 4, 1, hc);
      p(8, 11, 1, 1, hc);
      p(13, 11, 1, 1, hc);
      break;
    case 3: // Goatee
      p(10, 12, 3, 2, hc);
      p(9, 10, 4, 1, hc);
      break;
    case 4: // Full
      p(8, 10, 1, 3, hc);
      p(13, 10, 1, 3, hc);
      p(8, 12, 6, 3, hc);
      p(9, 10, 4, 1, hc);
      p(10, 11, 3, 1, '#7a4038'); // keep the mouth visible
      break;
    case 5: // Braided
      p(8, 10, 1, 3, hc);
      p(13, 10, 1, 3, hc);
      p(8, 12, 6, 3, hc);
      p(9, 15, 1, 3, hc);
      p(12, 15, 1, 3, hc);
      p(9, 16, 1, 1, GOLD);
      p(12, 16, 1, 1, GOLD);
      break;
  }

  // ---- hat (covers hair top) -----------------------------------------------
  switch (a.hat) {
    case 1: // Bandana
      p(6, 4, 10, 2, sc);
      p(7, 3, 8, 1, sc);
      p(16, 5, 1, 1, sc);
      p(16, 6, 1, 3, shade(sc, -16));
      p(9, 4, 1, 1, shade(sc, 24));
      p(12, 4, 1, 1, shade(sc, 24));
      break;
    case 2: // Tricorne
      p(4, 4, 14, 1, '#3a2b1e');
      p(4, 3, 2, 1, '#3a2b1e');
      p(16, 3, 2, 1, '#3a2b1e');
      p(7, 1, 8, 3, '#4d3a28');
      p(7, 3, 8, 1, sc);
      break;
    case 3: // Captain
      p(4, 4, 14, 2, shade(pc, -14));
      p(3, 3, 2, 1, shade(pc, -14));
      p(17, 3, 2, 1, shade(pc, -14));
      p(6, 0, 10, 4, pc);
      p(6, 3, 10, 1, GOLD);
      p(10, 1, 2, 1, '#e8e4da'); // skull mark
      break;
    case 4: // Straw
      p(4, 5, 14, 1, '#d9b96a');
      p(7, 2, 8, 3, '#c9a95a');
      p(7, 4, 8, 1, sc);
      break;
    case 5: // Cavalier
      p(4, 4, 12, 1, '#2b2b33');
      p(15, 3, 3, 1, '#2b2b33');
      p(7, 1, 8, 3, '#34343e');
      p(14, 0, 2, 1, '#e8e4da'); // feather
      p(16, 1, 2, 1, '#c9506a');
      break;
  }
}

/** Build a static offscreen canvas of the pirate. */
export function buildPirateCanvas(a) {
  const c = document.createElement('canvas');
  c.width = PIRATE_W;
  c.height = PIRATE_H;
  drawPirate(c.getContext('2d'), a);
  return c;
}

/**
 * Tiny 8x11 captain used on the ship deck. Reads the appearance's key
 * colors so the deck figure matches the created character.
 */
export function buildMiniCaptain(a) {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 11;
  const g = c.getContext('2d');
  const skin = SKIN_COLORS[a.skin];
  const pc = PALETTE[a.primary];
  const sc = PALETTE[a.secondary];
  const hc = HAIR_COLORS[a.hairColor];
  const hatCol = [null, sc, '#4d3a28', pc, '#c9a95a', '#34343e'][a.hat];
  const p = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  // head
  p(3, 1, 3, 3, skin);
  if (hatCol) {
    p(2, 0, 5, 1, hatCol);
    p(3, 1, 3, 1, hatCol);
  } else if (a.hair !== 0) {
    p(3, 0, 3, 1, hc);
  }
  // torso
  p(2, 4, 5, 4, pc);
  p(4, 4, 1, 3, shade(pc, 20));
  // legs
  p(3, 8, 1, 3, '#3a2b20');
  p(5, 8, 1, 3, a.woodenLeg ? WOOD : '#3a2b20');
  return c;
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb color. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
