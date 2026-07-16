// Global tuning constants. One place to balance the feel of the game.

/** How many screen pixels one world pixel occupies. */
export const PIXEL_SCALE = 3;

/** Backbuffer overscan so the camera can zoom out without exposing edges. */
export const OVERSCAN = 1.12;

/** World-space size of one chunk (in world pixels). Islands never cross chunks. */
export const CHUNK_SIZE = 384;

/** Extra chunk ring kept generated beyond the visible area. */
export const CHUNK_MARGIN = 1;

/** Chunks farther than this (in chunks) from the camera get unloaded. */
export const CHUNK_UNLOAD_RADIUS = 5;

/** Seconds for a full day/night cycle. */
export const DAY_LENGTH = 480;

/** Terrain elevation thresholds (see world/island.js). */
export const SEA_LEVEL = 0.3;

/** Seconds between autosaves while playing. */
export const AUTOSAVE_INTERVAL = 5;

export const SAVE_KEY = 'sea-of-rogues:v1';

/** Ship handling. */
export const SHIP = {
  maxSpeed: 130, // world px / s
  reverseSpeed: 42,
  accel: 68,
  reverseAccel: 40,
  drag: 0.55, // exponential decay rate when coasting
  turnRate: 1.7, // rad / s at full effectiveness
  hullLength: 44,
  hullWidth: 20,
};

/** Camera feel. */
export const CAMERA = {
  followRate: 3.4,
  lookAhead: 0.55, // seconds of velocity to look ahead
  lookAheadMax: 72,
  zoomMin: 0.9,
  zoomMax: 1.04,
  zoomRate: 1.2,
};

/** Gameplay radii. */
export const COLLECT = {
  magnetRadius: 78,
  pickupRadius: 26,
};
