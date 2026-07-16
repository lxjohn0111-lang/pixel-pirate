// AI ships: merchants, fishing boats, civilians, pirate raiders and
// navy patrols. Each has hull/sail health, a crew for boardings, and a
// simple behavior brain (wander / flee / hunt-and-broadside). Sinking
// is dramatic: listing, smoke, bubbles, then floating loot.

import { TAU, clamp, angleDiff, lerp, damp } from '../util/math.js';
import { aiShipHull, aiShipSail } from '../render/sprites.js';
import { mulberry32, rangeInt, range } from '../util/random.js';

let nextShipId = 1;

const TYPE_STATS = {
  //          hull  speed turn  cannons crew  aggro  loot
  fishing:  { hull: 40,  speed: 34,  turn: 1.4, cannons: 0, crew: [1, 2], table: 'fishingBoat' },
  civilian: { hull: 60,  speed: 52,  turn: 1.2, cannons: 0, crew: [1, 3], table: 'merchantShip' },
  merchant: { hull: 90,  speed: 48,  turn: 0.9, cannons: 1, crew: [2, 3], table: 'merchantShip' },
  pirate:   { hull: 80,  speed: 72,  turn: 1.5, cannons: 2, crew: [2, 4], table: 'pirateShip' },
  navy:     { hull: 130, speed: 64,  turn: 1.2, cannons: 3, crew: [3, 5], table: 'navyShip' },
};

export class AIShip {
  constructor(type, x, y, tier = 0) {
    const stats = TYPE_STATS[type];
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    this.id = `ship${nextShipId++}`;
    this.type = type;
    this.tier = tier; // scales with distance from spawn: tougher far out
    this.x = x;
    this.y = y;
    this.heading = rng() * TAU;
    this.speed = 0;
    this.maxSpeed = stats.speed * (1 + tier * 0.08);
    this.turnRate = stats.turn;
    this.maxHull = Math.round(stats.hull * (1 + tier * 0.35));
    this.hull = this.maxHull;
    this.sailHp = 1; // 0..1, damage slows the ship
    this.cannons = stats.cannons + (tier >= 2 ? 1 : 0);
    this.cannonDamage = 6 + tier * 3;
    this.crewCount = rangeInt(rng, stats.crew[0], stats.crew[1]) + Math.floor(tier / 2);
    this.lootTable = stats.table;
    this.state = 'sailing'; // sailing | sinking | gone
    this.hostileToPlayer = type === 'pirate';
    this.fleeing = false;
    this.reload = range(rng, 1, 3);
    this.bob = rng() * TAU;
    this.sinkT = 0;
    this.onFire = false;
    this._wanderT = 0;
    this._wanderDir = this.heading;
    this._fireTimer = 0;
    this.looted = false;
  }

  get boardable() {
    if (this.state !== 'sailing' || this.looted) return false;
    // Peaceful ships can always be boarded; fighters must be softened up.
    if (this.type === 'pirate' || this.type === 'navy') return this.hull < this.maxHull * 0.55;
    return true;
  }

  get label() {
    return {
      fishing: 'Fishing Boat', civilian: 'Sloop', merchant: 'Merchant Ship',
      pirate: 'Pirate Raider', navy: 'Navy Patrol',
    }[this.type];
  }

  update(dt, game, combat) {
    this.bob += dt;
    if (this.state === 'sinking') {
      this.sinkT += dt;
      if (this.sinkT > 3.2) this.state = 'gone';
      // bubbles + smoke while going down
      if (Math.random() < dt * 14) {
        game.particles.splashRing(this.x + (Math.random() - 0.5) * 24, this.y + (Math.random() - 0.5) * 12, 1 + Math.random() * 2);
      }
      return;
    }

    const stats = TYPE_STATS[this.type];
    const { ship } = game;
    const distPlayer = Math.hypot(ship.x - this.x, ship.y - this.y);

    // ---- pick a behavior -------------------------------------------------
    let targetHeading = this._wanderDir;
    let throttle = 0.55;
    let wantFire = null; // {x, y} to shoot at

    if (this.fleeing) {
      const away = Math.atan2(this.y - ship.y, this.x - ship.x);
      targetHeading = away;
      throttle = 1;
      if (distPlayer > 700) this.fleeing = false;
    } else if (this.hostileToPlayer && distPlayer < 420) {
      // Hunt the player: close to gun range, then hold a broadside arc.
      const bearing = Math.atan2(ship.y - this.y, ship.x - this.x);
      if (distPlayer > 210) {
        targetHeading = bearing;
        throttle = 1;
      } else {
        // Turn perpendicular to the target to bring cannons to bear,
        // slowing down so the duel stays readable (and hittable).
        const side = angleDiff(this.heading, bearing) > 0 ? 1 : -1;
        targetHeading = bearing - (Math.PI / 2) * side;
        throttle = distPlayer < 120 ? 0.25 : 0.5;
        wantFire = { x: ship.x, y: ship.y, dist: distPlayer };
      }
    } else {
      // Wander with occasional course changes.
      this._wanderT -= dt;
      if (this._wanderT <= 0) {
        this._wanderT = 4 + Math.random() * 6;
        this._wanderDir += (Math.random() - 0.5) * 1.6;
      }
      targetHeading = this._wanderDir;
      throttle = this.type === 'fishing' ? 0.3 : 0.55;
    }

    // Land avoidance overrides everything.
    const px = this.x + Math.cos(this.heading) * 60;
    const py = this.y + Math.sin(this.heading) * 60;
    if (!game.world.isOpenWater(px, py)) {
      targetHeading = this.heading + 1.8;
      throttle = 0.6;
      this._wanderDir = targetHeading;
    }

    // ---- steer & move --------------------------------------------------
    const diff = angleDiff(this.heading, targetHeading);
    this.heading += clamp(diff, -1, 1) * this.turnRate * dt;
    const speedCap = this.maxSpeed * (0.5 + 0.5 * this.sailHp) * throttle;
    this.speed = lerp(this.speed, speedCap, damp(1.2, dt));
    const nx = this.x + Math.cos(this.heading) * this.speed * dt;
    const ny = this.y + Math.sin(this.heading) * this.speed * dt;
    if (game.world.isOpenWater(nx, ny)) {
      this.x = nx;
      this.y = ny;
    } else {
      this.speed = 0;
      this._wanderDir += 1.5;
    }

    // ---- gunnery ---------------------------------------------------------
    this.reload -= dt;
    if (wantFire && this.cannons > 0 && this.reload <= 0 && wantFire.dist < 260) {
      const perp = Math.abs(Math.abs(angleDiff(this.heading, Math.atan2(wantFire.y - this.y, wantFire.x - this.x))) - Math.PI / 2);
      if (perp < 0.5) {
        this.reload = 4.4 - this.tier * 0.25;
        combat.fireBroadside(this, wantFire.x, wantFire.y);
      }
    }

    // ---- fire spreads on a badly damaged ship ------------------------------
    this.onFire = this.hull < this.maxHull * 0.3;
    if (this.onFire) {
      this._fireTimer -= dt;
      if (this._fireTimer <= 0) {
        this._fireTimer = 0.12;
        game.particles.spawnFlame(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 10);
      }
    }
  }

  /** Returns true if this hit sank the ship. */
  takeDamage(amount, game, fromPlayer) {
    if (this.state !== 'sailing') return false;
    this.hull -= amount;
    if (Math.random() < 0.35) this.sailHp = Math.max(0.3, this.sailHp - 0.15);
    if (fromPlayer) {
      // Peaceful ships panic; fighters remember.
      if (this.type === 'merchant' || this.type === 'civilian' || this.type === 'fishing') {
        this.fleeing = true;
        if (this.type === 'merchant' && Math.random() < 0.4) {
          game.combat.jettisonCargo(this); // drops a crate to distract you
        }
      } else {
        this.hostileToPlayer = true;
      }
    }
    if (this.hull <= 0) {
      this.state = 'sinking';
      this.sinkT = 0;
      game.events.emit('ship:sunk', { id: this.id, type: this.type, byPlayer: !!fromPlayer, x: this.x, y: this.y });
      return true;
    }
    return false;
  }

  draw(g, t) {
    const hull = aiShipHull(this.type);
    const sail = aiShipSail(this.type);
    const sink = this.state === 'sinking' ? this.sinkT / 3.2 : 0;
    const bobY = Math.sin(this.bob * 1.3) * 0.8;

    g.save();
    g.translate(Math.round(this.x), Math.round(this.y + bobY + sink * 6));

    // shadow
    g.save();
    g.rotate(this.heading);
    g.fillStyle = `rgba(8,20,40,${0.28 * (1 - sink)})`;
    g.beginPath();
    g.ellipse(0, 4, hull.width * 0.46, hull.height * 0.4, 0, 0, TAU);
    g.fill();
    g.restore();

    g.rotate(this.heading + Math.sin(this.bob * 1.7) * 0.03 + sink * 0.5);
    if (sink > 0) g.globalAlpha = 1 - sink * 0.85;
    const scale = 1 - sink * 0.25; // slipping under
    g.scale(scale, scale);
    g.drawImage(hull, -hull.width / 2, -hull.height / 2);
    if (this.speed > 8 && sink === 0) g.drawImage(sail, -sail.width / 2, -sail.height / 2);
    g.restore();
    g.globalAlpha = 1;

    // health bar when damaged (fades when full)
    if (this.state === 'sailing' && this.hull < this.maxHull) {
      const w = 26;
      const frac = this.hull / this.maxHull;
      g.fillStyle = 'rgba(10,16,30,0.7)';
      g.fillRect(Math.round(this.x - w / 2), Math.round(this.y - hull.height / 2 - 9), w, 3);
      g.fillStyle = frac > 0.5 ? '#6fce62' : frac > 0.25 ? '#e0b345' : '#e05a4a';
      g.fillRect(Math.round(this.x - w / 2), Math.round(this.y - hull.height / 2 - 9), Math.round(w * frac), 3);
    }
  }
}

export { TYPE_STATS };
