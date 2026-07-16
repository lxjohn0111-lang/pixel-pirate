// Seeded 2D value noise + fractal brownian motion.
// Deterministic: the same seed and coordinates always give the same value.

import { rand2 } from './random.js';

export class Noise2D {
  constructor(seed) {
    this.seed = seed >>> 0;
  }

  /** Smooth value noise in [0, 1). */
  value(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    // Smoothstep fade for C1-continuous interpolation.
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = rand2(this.seed, xi, yi);
    const b = rand2(this.seed, xi + 1, yi);
    const c = rand2(this.seed, xi, yi + 1);
    const d = rand2(this.seed, xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /** Fractal noise in [0, 1). More octaves = more detail. */
  fbm(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let fx = x;
    let fy = y;
    for (let i = 0; i < octaves; i++) {
      sum += this.value(fx, fy) * amp;
      norm += amp;
      amp *= gain;
      fx = fx * lacunarity + 31.7;
      fy = fy * lacunarity + 17.3;
    }
    return sum / norm;
  }
}
