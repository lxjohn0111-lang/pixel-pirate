// Smooth-follow camera with velocity look-ahead, speed-based zoom
// and a small impact shake.

import { CAMERA } from './constants.js';
import { clamp, damp, lerp } from '../util/math.js';

export class Camera {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.zoom = 1;
    this._aheadX = 0;
    this._aheadY = 0;
    this._shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  addShake(amount) {
    this._shake = Math.min(6, this._shake + amount);
  }

  update(dt, ship) {
    // Look ahead of the ship along its velocity so the player sees
    // where they are going.
    const ax = clamp(ship.velX * CAMERA.lookAhead, -CAMERA.lookAheadMax, CAMERA.lookAheadMax);
    const ay = clamp(ship.velY * CAMERA.lookAhead, -CAMERA.lookAheadMax, CAMERA.lookAheadMax);
    const aheadK = damp(1.6, dt);
    this._aheadX = lerp(this._aheadX, ax, aheadK);
    this._aheadY = lerp(this._aheadY, ay, aheadK);

    const k = damp(CAMERA.followRate, dt);
    this.x = lerp(this.x, ship.x + this._aheadX, k);
    this.y = lerp(this.y, ship.y + this._aheadY, k);

    // Zoom out slightly at speed, back in when drifting.
    const speedNorm = ship.speedNorm;
    const targetZoom = lerp(CAMERA.zoomMax, CAMERA.zoomMin, speedNorm);
    this.zoom = lerp(this.zoom, targetZoom, damp(CAMERA.zoomRate, dt));

    // Shake decay.
    this._shake = Math.max(0, this._shake - dt * 10);
    if (this._shake > 0.01) {
      this.shakeX = (Math.random() * 2 - 1) * this._shake;
      this.shakeY = (Math.random() * 2 - 1) * this._shake;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  snapTo(x, y) {
    this.x = x;
    this.y = y;
    this._aheadX = 0;
    this._aheadY = 0;
  }
}
