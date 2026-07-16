// Infinite, deterministic, chunked world. Chunks generate on demand
// around the camera and unload when far away; because every feature is
// derived from (worldSeed, chunkX, chunkY), revisited places regenerate
// identically. Nothing is drawn per-chunk that could reveal a border —
// water is a continuous global field, and islands never touch chunk
// edges.
//
// Extensibility: chunk content is produced by an ordered list of feature
// generators (`featureGens`). Future systems (wrecks, enemy camps, trade
// routes, quest markers...) register additional generators via
// `world.addFeatureGenerator(fn)` without touching existing ones.

import { CHUNK_SIZE, CHUNK_MARGIN, CHUNK_UNLOAD_RADIUS } from '../core/constants.js';
import { Noise2D } from '../util/noise.js';
import { mulberry32, hash2u, range, rangeInt } from '../util/random.js';
import { islandForChunk } from './island.js';

/** Loot table for floating collectibles: [type, weight]. */
const LOOT = [
  ['wood', 34], ['barrel', 20], ['crate', 18], ['coin', 18], ['chest', 4],
];

export class World {
  constructor(seed, collectedIds = []) {
    this.seed = seed >>> 0;
    this.chunks = new Map();
    this.maskNoise = new Noise2D(this.seed ^ 0x1517);
    /** Permanent record of picked-up collectibles (persisted in the save). */
    this.collected = new Set(collectedIds);

    this.featureGens = [
      genIsland,
      genSeaRocks,
      genSeaweed,
      genCollectibles,
    ];
  }

  addFeatureGenerator(fn) {
    this.featureGens.push(fn);
  }

  chunkCoord(v) {
    return Math.floor(v / CHUNK_SIZE);
  }

  key(cx, cy) {
    return `${cx},${cy}`;
  }

  getChunk(cx, cy) {
    return this.chunks.get(this.key(cx, cy)) ?? null;
  }

  /** Ensure all chunks covering the view (plus margin) exist; unload far ones. */
  ensure(viewX, viewY, viewW, viewH) {
    const x0 = this.chunkCoord(viewX) - CHUNK_MARGIN;
    const y0 = this.chunkCoord(viewY) - CHUNK_MARGIN;
    const x1 = this.chunkCoord(viewX + viewW) + CHUNK_MARGIN;
    const y1 = this.chunkCoord(viewY + viewH) + CHUNK_MARGIN;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cy);
        if (!this.chunks.has(k)) this.chunks.set(k, this._generate(cx, cy));
      }
    }

    // Unload distant chunks so memory stays bounded on long voyages.
    const ccx = this.chunkCoord(viewX + viewW / 2);
    const ccy = this.chunkCoord(viewY + viewH / 2);
    for (const [k, chunk] of this.chunks) {
      if (Math.max(Math.abs(chunk.cx - ccx), Math.abs(chunk.cy - ccy)) > CHUNK_UNLOAD_RADIUS) {
        this.chunks.delete(k);
      }
    }
  }

  _generate(cx, cy) {
    const chunk = {
      cx, cy,
      x: cx * CHUNK_SIZE,
      y: cy * CHUNK_SIZE,
      island: null,
      rocks: [],    // small sea rocks (with collision)
      seaweed: [],  // underwater ambience
      items: [],    // floating collectibles
    };
    const rng = mulberry32((this.seed ^ hash2u(0xabcd, cx, cy)) >>> 0);
    for (const gen of this.featureGens) gen(chunk, rng, this);
    return chunk;
  }

  /** Iterate chunks overlapping a world-space rectangle. */
  forEachChunkIn(x, y, w, h, fn) {
    const x0 = this.chunkCoord(x);
    const y0 = this.chunkCoord(y);
    const x1 = this.chunkCoord(x + w);
    const y1 = this.chunkCoord(y + h);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = this.getChunk(cx, cy);
        if (c) fn(c);
      }
    }
  }

  /** Islands whose bounds may overlap a point (they can span into
   *  neighboring chunks' query range, so check a 3x3 neighborhood). */
  _islandsNear(x, y, fn) {
    const cx = this.chunkCoord(x);
    const cy = this.chunkCoord(y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.getChunk(cx + dx, cy + dy);
        if (c?.island) {
          if (fn(c.island)) return true;
        }
      }
    }
    return false;
  }

  /** True if a point is blocked (land or a sea rock). */
  solidAt(x, y) {
    if (this._islandsNear(x, y, (isl) => isl.solidAt(x, y))) return true;
    const cx = this.chunkCoord(x);
    const cy = this.chunkCoord(y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.getChunk(cx + dx, cy + dy);
        if (!c) continue;
        for (const r of c.rocks) {
          const ddx = x - r.x;
          const ddy = y - r.y;
          if (ddx * ddx + ddy * ddy < r.r * r.r) return true;
        }
      }
    }
    return false;
  }

  /** True if a point is deep, open water (used for spawning). */
  isOpenWater(x, y) {
    let shallow = false;
    this._islandsNear(x, y, (isl) => {
      if (isl.elevationAt(x, y) > 0.04) shallow = true;
      return shallow;
    });
    return !shallow;
  }
}

/* ------------------------------------------------------------------ */
/* Feature generators                                                  */
/* ------------------------------------------------------------------ */

function genIsland(chunk, rng, world) {
  const chunkRand = mulberry32((world.seed ^ hash2u(0x151a4d, chunk.cx, chunk.cy)) >>> 0);
  chunk.island = islandForChunk(world.seed, chunk.cx, chunk.cy, CHUNK_SIZE, world.maskNoise, chunkRand);
}

function genSeaRocks(chunk, rng) {
  if (chunk.island || rng() > 0.16) return;
  const n = rangeInt(rng, 1, 2);
  for (let i = 0; i < n; i++) {
    chunk.rocks.push({
      x: chunk.x + range(rng, 40, CHUNK_SIZE - 40),
      y: chunk.y + range(rng, 40, CHUNK_SIZE - 40),
      r: range(rng, 6, 9),
      variant: rangeInt(rng, 0, 2),
    });
  }
}

function genSeaweed(chunk, rng) {
  const n = rangeInt(rng, 0, 3);
  for (let i = 0; i < n; i++) {
    const x = chunk.x + rng() * CHUNK_SIZE;
    const y = chunk.y + rng() * CHUNK_SIZE;
    chunk.seaweed.push({ x, y, blades: rangeInt(rng, 3, 6), phase: rng() * 6.28 });
  }
}

function genCollectibles(chunk, rng, world) {
  // More flotsam near islands — wrecks wash up around land.
  const base = chunk.island ? 3.4 : 1.5;
  const n = Math.floor(rng() * base);
  const totalWeight = LOOT.reduce((s, [, w]) => s + w, 0);
  for (let i = 0; i < n; i++) {
    const id = `${chunk.cx},${chunk.cy},${i}`;
    if (world.collected.has(id)) continue;
    const x = chunk.x + range(rng, 20, CHUNK_SIZE - 20);
    const y = chunk.y + range(rng, 20, CHUNK_SIZE - 20);
    let roll = rng() * totalWeight;
    let type = 'wood';
    for (const [t, w] of LOOT) {
      roll -= w;
      if (roll <= 0) {
        type = t;
        break;
      }
    }
    // Consume rng before the water check so item streams stay stable.
    const phase = rng() * 6.28;
    if (chunk.island && chunk.island.elevationAt(x, y) > 0.02) continue;
    chunk.items.push({ id, type, x, y, phase, drawX: x, drawY: y });
  }
}
