// The player's ship: momentum-based sailing physics, land collision,
// rocking animation, wake and spray. Drawing is done in world space
// (the renderer has already translated the context).

import { SHIP } from '../core/constants.js';
import { clamp, damp, lerp, angleDiff, TAU } from '../util/math.js';
import { shipHull, shipSail, shipSailFurled, shipFlag, styledFlag, figureheadSprite, SHIP_W, SHIP_H } from '../render/sprites.js';
import { buildMiniCaptain } from '../render/pirate.js';
import { drawSailPattern, drawDeckDecor } from '../render/shipdecor.js';

export class Ship {
  constructor(state, appearance) {
    this.x = state?.x ?? 0;
    this.y = state?.y ?? 0;
    this.heading = state?.heading ?? -Math.PI / 2;
    this.speed = 0;
    this.velX = 0;
    this.velY = 0;
    this.roll = 0; // visual rocking
    this.bob = 0;
    this._time = Math.random() * 100;
    this._wakeTimer = 0;
    this._sprayTimer = 0;
    this.captain = buildMiniCaptain(appearance);
  }

  get speedNorm() {
    return clamp(Math.abs(this.speed) / SHIP.maxSpeed, 0, 1);
  }

  /** Sail sprite, tinted & marked by the equipped sail cosmetic. */
  _styledSail(base, key) {
    const pat = this.sailPattern;
    if (!this.sailStyle || (!this.sailStyle.tint && !this.sailStyle.mark)) {
      return pat && pat.pattern ? this._patternedSail(base, key) : base;
    }
    const cacheKey = `${key}:${this.sailStyle.id}:${pat?.id ?? 'none'}`;
    if (this._sailCache?.key !== cacheKey) {
      const c = document.createElement('canvas');
      c.width = base.width;
      c.height = base.height;
      const g = c.getContext('2d');
      g.drawImage(base, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      if (this.sailStyle.tint) {
        g.fillStyle = this.sailStyle.tint;
        g.fillRect(0, 0, c.width, c.height);
      }
      if (this.sailStyle.mark) {
        g.fillStyle = this.sailStyle.mark;
        g.fillRect(28, 12, 4, 4); // emblem on the canvas
        g.fillRect(29, 11, 2, 6);
      }
      if (pat && pat.pattern) drawSailPattern(g, c.width, c.height, pat);
      this._sailCache = { key: cacheKey, canvas: c };
    }
    return this._sailCache.canvas;
  }

  /** A pattern with no tint underneath it — the common case. */
  _patternedSail(base, key) {
    const pat = this.sailPattern;
    const cacheKey = `pat:${key}:${pat.id}:${pat.mark ?? ''}`;
    if (this._patCache?.key !== cacheKey) {
      const c = document.createElement('canvas');
      c.width = base.width;
      c.height = base.height;
      const g = c.getContext('2d');
      g.drawImage(base, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      drawSailPattern(g, c.width, c.height, pat);
      this._patCache = { key: cacheKey, canvas: c };
    }
    return this._patCache.canvas;
  }

  /** Hull sprite, tinted by the active paint job (Part 2 cosmetics). */
  _paintedHull() {
    const base = shipHull();
    if (!this.paintTint) return base;
    if (this._tintCache?.tint !== this.paintTint) {
      const c = document.createElement('canvas');
      c.width = base.width;
      c.height = base.height;
      const g = c.getContext('2d');
      g.drawImage(base, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = this.paintTint;
      g.fillRect(0, 0, c.width, c.height);
      this._tintCache = { tint: this.paintTint, canvas: c };
    }
    return this._tintCache.canvas;
  }

  update(dt, input, world, game) {
    this._time += dt;
    const weather = game.weather;

    // Upgrades and sail damage modify performance (Part 2).
    const speedMult = game.shipState?.speedMult ?? 1;
    const turnMult = game.shipState?.turnMult ?? 1;

    // --- throttle -----------------------------------------------------
    const throttle = clamp(input.throttle, -1, 1);
    if (throttle > 0) {
      this.speed = Math.min(this.speed + SHIP.accel * dt * throttle, SHIP.maxSpeed * speedMult * throttle);
    } else if (throttle < 0) {
      this.speed = Math.max(this.speed - SHIP.reverseAccel * dt, -SHIP.reverseSpeed);
    } else {
      // Water drag: coast to a stop.
      this.speed *= Math.exp(-SHIP.drag * dt);
      if (Math.abs(this.speed) < 1.2) this.speed = 0;
    }

    // --- steering -------------------------------------------------------
    // A ship turns best with way on: effectiveness grows with speed.
    const effectiveness = 0.45 + 0.55 * this.speedNorm;
    let steer = clamp(input.steer, -1, 1);
    if (input.headingTarget !== null) {
      // Touch: steer toward the joystick's absolute direction.
      const diff = angleDiff(this.heading, input.headingTarget);
      steer = clamp(diff * 2.4, -1, 1);
    }
    this.heading += steer * SHIP.turnRate * turnMult * effectiveness * dt;
    this.heading = ((this.heading % TAU) + TAU) % TAU;

    // --- velocity: mostly along the keel, lateral slip damped ------------
    const fx = Math.cos(this.heading);
    const fy = Math.sin(this.heading);
    const targetVX = fx * this.speed;
    const targetVY = fy * this.speed;
    const grip = damp(4.2, dt);
    this.velX = lerp(this.velX, targetVX, grip);
    this.velY = lerp(this.velY, targetVY, grip);

    // Storm wind pushes the ship a little.
    const windPush = weather.windSpeed > 60 ? (weather.windSpeed - 60) * 0.06 : 0;
    const nx = this.x + (this.velX + weather.windX * 0.002 * windPush) * dt;
    const ny = this.y + (this.velY + weather.windY * 0.002 * windPush) * dt;

    // --- collision: probe the bow and the hull center --------------------
    const bowX = nx + fx * (SHIP.hullLength * 0.42);
    const bowY = ny + fy * (SHIP.hullLength * 0.42);
    if (world.solidAt(bowX, bowY) || world.solidAt(nx, ny)) {
      const impact = this.speedNorm;
      if (impact > 0.12) {
        game.events.emit('ship:collide', { x: bowX, y: bowY, speed: this.speed });
        game.camera.addShake(1.5 + impact * 3);
        game.particles.burstSplash(bowX, bowY, 6 + impact * 10);
      }
      this.speed *= -0.25; // gentle bounce off
      this.velX *= -0.25;
      this.velY *= -0.25;
    } else {
      this.x = nx;
      this.y = ny;
    }

    // --- rocking: waves + lean into turns --------------------------------
    const sea = 1 + weather.windSpeed / 45;
    const targetRoll = Math.sin(this._time * 1.7) * 0.028 * sea + steer * this.speedNorm * 0.06;
    this.roll = lerp(this.roll, targetRoll, damp(3, dt));
    this.bob = Math.sin(this._time * 1.3) * (0.7 + weather.rain * 0.8);

    // --- wake & spray ------------------------------------------------------
    const spd = Math.abs(this.speed);
    if (spd > 22) {
      this._wakeTimer -= dt;
      if (this._wakeTimer <= 0) {
        this._wakeTimer = lerp(0.09, 0.03, this.speedNorm);
        const sternX = this.x - fx * SHIP.hullLength * 0.4;
        const sternY = this.y - fy * SHIP.hullLength * 0.4;
        game.particles.spawnWake(sternX, sternY, this.velX, this.velY);
      }
      this._sprayTimer -= dt;
      if (spd > 80 && this._sprayTimer <= 0) {
        this._sprayTimer = 0.12;
        const bx = this.x + fx * SHIP.hullLength * 0.38;
        const by = this.y + fy * SHIP.hullLength * 0.38;
        game.particles.spawnBowSpray(bx, by, fx, fy);
      }
    }
  }

  /** Draw in world space. t = global time for animation frames. */
  draw(g, t, dayNight) {
    const hull = this._paintedHull();
    // Sail furls at anchor and fills progressively with speed.
    const sailKey = this.speedNorm < 0.08 ? 'furled' : `s${Math.min(2, Math.floor(this.speedNorm * 3))}`;
    const sailBase = sailKey === 'furled' ? shipSailFurled() : shipSail(Math.min(2, Math.floor(this.speedNorm * 3)));
    const sail = this._styledSail(sailBase, sailKey);
    const flag = this.flagStyle
      ? styledFlag(((t * 6) | 0) % 3, this.flagStyle.id, this.flagStyle.body, this.flagStyle.mark)
      : shipFlag(((t * 6) | 0) % 3);

    // Bought hulls are bigger boats, not just bigger numbers — a galleon
    // has to read as a galleon from across the water.
    const hs = this.hullScale ?? 1;

    g.save();
    g.translate(Math.round(this.x), Math.round(this.y + this.bob));

    // Hull shadow on the water.
    g.save();
    g.rotate(this.heading);
    g.fillStyle = 'rgba(8,20,40,0.28)';
    g.beginPath();
    g.ellipse(0, 4 * hs, SHIP.hullLength * 0.52 * hs, SHIP.hullWidth * 0.5 * hs, 0, 0, TAU);
    g.fill();
    g.restore();

    g.rotate(this.heading + this.roll);
    g.save();
    g.scale(hs, hs);
    g.drawImage(hull, -SHIP_W / 2, -SHIP_H / 2);
    // figurehead rides the bow
    if (this.figurehead && this.figurehead !== 'none') {
      g.drawImage(figureheadSprite(this.figurehead), SHIP_W / 2 - 6, -4);
    }
    g.drawImage(sail, -SHIP_W / 2, -SHIP_H / 2);
    g.drawImage(flag, -12, -3); // pennant streaming behind the mast
    // Gun barrels poking from the ports, in whatever metal is fitted.
    if (this.cannonColor) {
      g.fillStyle = this.cannonColor;
      for (let i = -1; i <= 1; i++) {
        g.fillRect(i * 7 - 1, -SHIP_H / 2 - 1, 2, 3);
        g.fillRect(i * 7 - 1, SHIP_H / 2 - 2, 2, 3);
      }
    }
    drawDeckDecor(g, this.decorId, t);
    g.restore();

    // Stern lantern glow at night (color follows the fitted lantern).
    if (dayNight.snapshot.sun < 0.35) {
      const glow = (0.35 - dayNight.snapshot.sun) / 0.35;
      const lc = this.lanternColor ?? [255, 196, 90];
      g.fillStyle = `rgba(${lc[0]},${lc[1]},${lc[2]},${0.75 * glow})`;
      g.fillRect(-22 * hs, -1, 2, 2);
    }
    g.restore();

    // The captain always stands upright on the stern deck (a person,
    // not part of the hull), at the helm position rotated into place.
    // The helm moves aft with the hull, but the captain stays one size.
    const hx = this.x + Math.cos(this.heading) * -13 * hs;
    const hy = this.y + Math.sin(this.heading) * -13 * hs + this.bob;
    g.drawImage(this.captain, Math.round(hx - 4), Math.round(hy - 9));

    // The ship's pet keeps the captain company.
    if (this.petId) {
      const px = Math.round(hx + 7);
      const py = Math.round(hy - 3 + Math.sin(t * 2.4) * 0.8);
      if (this.petId === 'parrot') {
        g.fillStyle = '#c9506a';
        g.fillRect(px, py - 4, 2, 3);
        g.fillStyle = '#2e6e4e';
        g.fillRect(px, py - 1, 2, 1);
        g.fillStyle = '#e0b345';
        g.fillRect(px + 2, py - 4, 1, 1);
      } else {
        g.fillStyle = '#7a5a34';
        g.fillRect(px, py - 3, 3, 3);
        g.fillStyle = '#c9a06a';
        g.fillRect(px + 1, py - 2, 1, 1);
      }
    }
  }

  serialize() {
    return { x: Math.round(this.x), y: Math.round(this.y), heading: +this.heading.toFixed(3) };
  }
}
