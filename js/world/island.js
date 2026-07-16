// Procedural island generation. Each island is deterministic from its
// seed: shape, biome, terrain colors, cliffs, ponds, shoreline and decor
// all regenerate identically when a chunk is revisited.
//
// The terrain is rendered once to an offscreen canvas when the chunk
// loads; decorations (trees, rocks, ruins...) stay dynamic so they can
// sway with the wind. The same elevation function drives both rendering
// and ship collision, so what you see is exactly what you hit.

import { Noise2D } from '../util/noise.js';
import { mulberry32, range, rangeInt, pick } from '../util/random.js';
import { SEA_LEVEL } from '../core/constants.js';
import { makeCanvas } from '../render/sprites.js';
import { TAU, clamp } from '../util/math.js';

export const BIOMES = ['sand', 'palm', 'rock', 'jungle', 'coral'];

// Terrain palettes per biome: [wet sand, sand, grass, high, cliff]
const TERRAIN = {
  sand:   { wet: [201, 178, 128], sand: [232, 210, 154], grass: [214, 194, 138], high: [196, 176, 122], cliff: [150, 128, 88] },
  palm:   { wet: [198, 176, 126], sand: [230, 208, 152], grass: [92, 158, 82],  high: [70, 132, 66],  cliff: [140, 118, 80] },
  rock:   { wet: [148, 142, 132], sand: [172, 166, 152], grass: [126, 131, 136], high: [94, 99, 105],  cliff: [70, 74, 80] },
  jungle: { wet: [188, 168, 120], sand: [216, 196, 142], grass: [64, 130, 62],  high: [42, 104, 52],  cliff: [120, 100, 70] },
  coral:  { wet: [214, 186, 150], sand: [240, 216, 168], grass: [206, 186, 140], high: [188, 168, 126], cliff: [160, 136, 100] },
};

const SHALLOW = {
  sand:   [64, 168, 180],
  palm:   [62, 170, 178],
  rock:   [58, 140, 160],
  jungle: [56, 158, 164],
  coral:  [72, 182, 184],
};

export class Island {
  constructor(seed, x, y, radius) {
    this.seed = seed >>> 0;
    this.x = x;
    this.y = y;
    this.r = radius;
    this.noise = new Noise2D(this.seed);
    const rng = mulberry32(this.seed);

    this.shapeFreq = range(rng, 1.1, 2.2);
    this.rough = range(rng, 0.14, 0.26);

    // Biome: size-aware so tiny islands are sand bars, big ones jungles.
    if (radius < 34) this.biome = rng() < 0.5 ? 'sand' : 'coral';
    else if (radius < 60) this.biome = pick(rng, ['palm', 'sand', 'rock', 'coral']);
    else this.biome = pick(rng, ['palm', 'jungle', 'rock', 'jungle']);

    // Optional pond on large islands.
    this.pond = null;
    if (radius > 80 && rng() < 0.55) {
      const a = rng() * TAU;
      const d = radius * range(rng, 0.1, 0.35);
      this.pond = { x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d, r: range(rng, 9, Math.min(20, radius * 0.22)) };
    }

    this.decor = [];
    this.shore = [];
    this.canvas = null;
    this._rng = rng;

    this._build();
  }

  /**
   * Signed elevation at a world position. > SEA_LEVEL is land,
   * [shallow..SEA_LEVEL] is shallow water. Must stay in sync with _build.
   */
  elevationAt(wx, wy) {
    const dx = wx - this.x;
    const dy = wy - this.y;
    const d = Math.hypot(dx, dy);
    if (d > this.r * 1.9) return -1;
    const ang = Math.atan2(dy, dx);
    const rim = this.noise.fbm(Math.cos(ang) * this.shapeFreq + 40, Math.sin(ang) * this.shapeFreq + 40, 3);
    const R = this.r * (0.62 + 0.55 * rim);
    let e = 1 - d / Math.max(1, R);
    e += (this.noise.fbm(wx * 0.045, wy * 0.045, 2) - 0.5) * this.rough * 2;
    if (this.pond) {
      const pd = Math.hypot(wx - this.pond.x, wy - this.pond.y);
      if (pd < this.pond.r + 4) e = Math.min(e, SEA_LEVEL - 0.08 + (pd / this.pond.r) * 0.06);
    }
    return e;
  }

  solidAt(wx, wy) {
    return this.elevationAt(wx, wy) > SEA_LEVEL - 0.02;
  }

  _build() {
    const pad = Math.ceil(this.r * 0.9) + 14;
    const size = (this.r + pad) * 2;
    this.ox = this.x - size / 2; // canvas top-left in world space
    this.oy = this.y - size / 2;
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const px = img.data;

    const pal = TERRAIN[this.biome];
    const shallow = SHALLOW[this.biome];
    const isCoral = this.biome === 'coral';
    const landMask = new Uint8Array(size * size);

    for (let py = 0; py < size; py++) {
      for (let pxi = 0; pxi < size; pxi++) {
        const wx = this.ox + pxi;
        const wy = this.oy + py;
        const e = this.elevationAt(wx, wy);
        const i = (py * size + pxi) * 4;
        const dither = ((pxi + py) & 1) * 6 - 3;

        if (e <= 0.04) continue; // open water: leave transparent

        let col = null;
        let alpha = 255;
        if (e <= SEA_LEVEL) {
          // Shallow water ring, fading out into the ocean.
          col = shallow;
          alpha = Math.round(clamp((e - 0.04) / 0.1, 0, 1) * 210);
          if (isCoral) {
            // Coral heads speckled through the shallows.
            const n = this.noise.fbm(wx * 0.12, wy * 0.12, 2);
            if (n > 0.62 && e > 0.1) col = n > 0.72 ? [224, 122, 106] : [224, 162, 106];
            alpha = Math.max(alpha, n > 0.62 ? 235 : alpha);
          }
        } else if (e <= SEA_LEVEL + 0.045) {
          col = pal.wet;
        } else if (e <= SEA_LEVEL + 0.14) {
          col = pal.sand;
        } else if (e <= SEA_LEVEL + 0.34) {
          col = pal.grass;
        } else {
          col = pal.high;
        }

        // Pond water overrides land colors.
        if (this.pond && e > SEA_LEVEL - 0.1) {
          const pd = Math.hypot(wx - this.pond.x, wy - this.pond.y);
          if (pd < this.pond.r) {
            col = pd > this.pond.r - 2 ? pal.wet : [70, 160, 172];
            alpha = 255;
          }
        }

        if (e > SEA_LEVEL) landMask[py * size + pxi] = 1;
        px[i] = clamp(col[0] + dither, 0, 255);
        px[i + 1] = clamp(col[1] + dither, 0, 255);
        px[i + 2] = clamp(col[2] + dither, 0, 255);
        px[i + 3] = alpha;
      }
    }

    // Cliff pass: extrude the southern land edge downward to fake height
    // (this sells the "bird's-eye with a slight angle" perspective).
    const cliffH = this.biome === 'rock' ? 4 : 3;
    const cliff = pal.cliff;
    for (let pxi = 0; pxi < size; pxi++) {
      for (let py = size - 2; py >= 0; py--) {
        if (landMask[py * size + pxi] && !landMask[(py + 1) * size + pxi]) {
          for (let k = 1; k <= cliffH; k++) {
            const yy = py + k;
            if (yy >= size) break;
            const i = (yy * size + pxi) * 4;
            const fade = 1 - (k - 1) / cliffH * 0.35;
            px[i] = cliff[0] * fade;
            px[i + 1] = cliff[1] * fade;
            px[i + 2] = cliff[2] * fade;
            px[i + 3] = 255;
          }
          py -= cliffH; // skip past the wall we just drew
        }
      }
    }

    g.putImageData(img, 0, 0);
    this.canvas = c;

    this._traceShore();
    this._placeDecor();
  }

  /** Sample shoreline points (for animated foam). */
  _traceShore() {
    const steps = Math.max(26, Math.round(this.r * 0.9));
    for (let s = 0; s < steps; s++) {
      const ang = (s / steps) * TAU;
      // March outward until we cross from land to water.
      let lo = 0;
      let hi = this.r * 1.9;
      if (this.elevationAt(this.x + Math.cos(ang) * lo, this.y + Math.sin(ang) * lo) <= SEA_LEVEL) continue;
      for (let it = 0; it < 14; it++) {
        const mid = (lo + hi) / 2;
        const e = this.elevationAt(this.x + Math.cos(ang) * mid, this.y + Math.sin(ang) * mid);
        if (e > SEA_LEVEL) lo = mid;
        else hi = mid;
      }
      this.shore.push({
        x: this.x + Math.cos(ang) * hi,
        y: this.y + Math.sin(ang) * hi,
        nx: Math.cos(ang),
        ny: Math.sin(ang),
      });
    }
  }

  _placeDecor() {
    const rng = this._rng;
    const area = this.r * this.r;
    const isRocky = this.biome === 'rock';

    const densities = {
      sand:   { palm: 0.6, tree: 0, rock: 0.8, shrub: 1.2 },
      coral:  { palm: 1.0, tree: 0, rock: 1.0, shrub: 1.0 },
      palm:   { palm: 4.5, tree: 0, rock: 1.2, shrub: 2.4 },
      rock:   { palm: 0.2, tree: 0.4, rock: 5.5, shrub: 0.8 },
      jungle: { palm: 2.0, tree: 5.5, rock: 1.4, shrub: 3.6 },
    }[this.biome];

    const tryPlace = (type, minE, maxE, count) => {
      let placed = 0;
      for (let i = 0; i < count * 8 && placed < count; i++) {
        const a = rng() * TAU;
        const d = Math.sqrt(rng()) * this.r * 1.1;
        const x = this.x + Math.cos(a) * d;
        const y = this.y + Math.sin(a) * d;
        const e = this.elevationAt(x, y);
        if (e < minE || e > maxE) continue;
        if (this.pond && Math.hypot(x - this.pond.x, y - this.pond.y) < this.pond.r + 4) continue;
        this.decor.push({
          type, x, y,
          variant: rangeInt(rng, 0, 2),
          size: range(rng, 0.8, 1.25),
          phase: rng() * TAU,
        });
        placed++;
      }
    };

    const scale = clamp(area / 2600, 0.5, 6);
    tryPlace('palm', SEA_LEVEL + 0.03, SEA_LEVEL + 0.34, Math.ceil(densities.palm * scale));
    tryPlace('tree', SEA_LEVEL + 0.14, 2, Math.ceil(densities.tree * scale));
    tryPlace('rock', SEA_LEVEL + 0.05, 2, Math.ceil(densities.rock * scale));
    tryPlace('shrub', SEA_LEVEL + 0.08, SEA_LEVEL + 0.5, Math.ceil(densities.shrub * scale));

    // Rare landmarks — every island gets at most one, so each feels distinct.
    if (this.r > 55 && rng() < 0.22) tryPlace('ruin', SEA_LEVEL + 0.14, SEA_LEVEL + 0.5, rangeInt(rng, 2, 4));
    if ((isRocky || this.biome === 'jungle') && this.r > 60 && rng() < 0.3) {
      tryPlace('cave', SEA_LEVEL + 0.28, 2, 1);
    }

    // Sort by y so lower decor draws in front (painter's algorithm).
    this.decor.sort((a, b) => a.y - b.y);
  }
}

/**
 * Deterministically decide whether a chunk hosts an island and build it.
 * Density comes from low-frequency noise, so islands cluster into
 * archipelagos separated by stretches of open ocean.
 */
export function islandForChunk(worldSeed, cx, cy, chunkSize, maskNoise, chunkRand) {
  // Keep a guaranteed-clear spawn area so the player starts in open water.
  if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) return null;

  const mask = maskNoise.fbm(cx * 0.09, cy * 0.09, 2);
  const density = clamp((mask - 0.35) * 1.4, 0, 1) * 0.34 + 0.02;
  if (chunkRand() > density) return null;

  const rng = mulberry32((worldSeed ^ (cx * 0x9e3779b9) ^ (cy * 0x85ebca6b)) >>> 0);
  const maxR = chunkSize / 2 - 40;
  const roll = rng();
  // Size distribution: mostly small, occasionally large.
  const r = roll < 0.45 ? range(rng, 22, 44) : roll < 0.85 ? range(rng, 44, 90) : range(rng, 90, Math.min(140, maxR));
  const wiggle = chunkSize / 2 - r * 1.15 - 20;
  const x = (cx + 0.5) * chunkSize + range(rng, -1, 1) * Math.max(0, wiggle);
  const y = (cy + 0.5) * chunkSize + range(rng, -1, 1) * Math.max(0, wiggle);
  const seed = (worldSeed ^ (cx * 0x27d4eb2d) ^ (cy * 0x165667b1) ^ 0x5f356495) >>> 0;
  return new Island(seed, Math.round(x), Math.round(y), Math.round(r));
}
