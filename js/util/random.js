// Deterministic hashing & pseudo-random utilities.
// Everything world-related must flow through these so that revisited
// locations regenerate identically from the same seed.

/** Hash a string into a 32-bit unsigned seed. */
export function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Fast seeded PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless 2D integer hash -> uint32. */
export function hash2u(seed, x, y) {
  let h = (seed >>> 0) ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Stateless 2D hash -> float in [0, 1). */
export function rand2(seed, x, y) {
  return hash2u(seed, x, y) / 4294967296;
}

/** Stateless 3D hash -> float in [0, 1). */
export function rand3(seed, x, y, z) {
  return hash2u(hash2u(seed, x, y), z | 0, 0x9e3779b9) / 4294967296;
}

/** Pick a random element of an array using an rng function. */
export function pick(rng, arr) {
  return arr[Math.min(arr.length - 1, (rng() * arr.length) | 0)];
}

/** Random float in [a, b). */
export function range(rng, a, b) {
  return a + rng() * (b - a);
}

/** Random integer in [a, b] inclusive. */
export function rangeInt(rng, a, b) {
  return a + ((rng() * (b - a + 1)) | 0);
}
