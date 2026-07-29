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
  ghost:    { hull: 110, speed: 60,  turn: 1.6, cannons: 3, crew: [0, 0], table: 'lockedChest' },
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
    // living-world state
    this.foe = null;
    this.fleeFrom = null;
    this.waypoint = null;
    this.convoyLeader = null;
    this.convoyOffset = 0;
    this._retarget = Math.random() * 1.2;
  }

  /** Choose a ship-vs-ship target based on faction instincts. */
  _pickFoe(game) {
    const hunts = {
      pirate: (s) => s.type === 'merchant' || s.type === 'civilian' || s.type === 'fishing',
      navy: (s) => s.type === 'pirate' || s.type === 'ghost',
    }[this.type];
    if (!hunts) return null;
    let best = null;
    let bestD = 380 * 380;
    for (const s of game.combat.ships) {
      if (s === this || s.state !== 'sailing' || !hunts(s)) continue;
      const dx = s.x - this.x;
      const dy = s.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = s;
      }
    }
    // A pirate that spots the player nearby prefers richer prey.
    if (this.type === 'pirate' && this.hostileToPlayer) {
      const dp = Math.hypot(game.ship.x - this.x, game.ship.y - this.y);
      if (dp * dp < bestD) return null; // player handled by main brain
    }
    return best;
  }

  get boardable() {
    if (this.state !== 'sailing' || this.looted) return false;
    // Peaceful ships can always be boarded; fighters must be softened up.
    if (this.type === 'pirate' || this.type === 'navy') return this.hull < this.maxHull * 0.55;
    return true;
  }

  get label() {
    // Named ships (bounty targets) announce themselves by name.
    if (this.customLabel) return this.customLabel;
    return {
      fishing: 'Fishing Boat', civilian: 'Sloop', merchant: 'Merchant Ship',
      pirate: 'Pirate Raider', navy: 'Navy Patrol', ghost: 'Ghost Ship',
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

    // ---- living world: pick a foe (the player is just one ship among many)
    // Pirates raid merchants; the navy hunts pirates; fights play out with
    // real cannons whether or not the player is watching.
    this._retarget -= dt;
    if (this._retarget <= 0) {
      this._retarget = 1.2;
      this.foe = this._pickFoe(game);
    }
    if (this.foe && (this.foe.state !== 'sailing' && this.foe !== ship)) this.foe = null;

    // ---- pick a behavior -------------------------------------------------
    let targetHeading = this._wanderDir;
    let throttle = 0.55;
    let wantFire = null; // {x, y} to shoot at

    const playerFoe = this.hostileToPlayer && distPlayer < 420;
    const aiFoe = !playerFoe && this.foe && this.foe !== ship;

    if (this.fleeing) {
      const threat = this.fleeFrom ?? ship;
      const away = Math.atan2(this.y - threat.y, this.x - threat.x);
      targetHeading = away;
      throttle = 1;
      if (Math.hypot(this.x - threat.x, this.y - threat.y) > 700) {
        this.fleeing = false;
        this.fleeFrom = null;
      }
    } else if (playerFoe || aiFoe) {
      const foe = playerFoe ? ship : this.foe;
      const dist = Math.hypot(foe.x - this.x, foe.y - this.y);
      const bearing = Math.atan2(foe.y - this.y, foe.x - this.x);
      if (dist > 210) {
        targetHeading = bearing;
        throttle = 1;
      } else {
        // Turn perpendicular to the target to bring cannons to bear,
        // slowing down so the duel stays readable (and hittable).
        const side = angleDiff(this.heading, bearing) > 0 ? 1 : -1;
        targetHeading = bearing - (Math.PI / 2) * side;
        throttle = dist < 120 ? 0.25 : 0.5;
        wantFire = { x: foe.x, y: foe.y, dist };
      }
    } else if (this.convoyLeader && this.convoyLeader.state === 'sailing') {
      // Convoy escorts keep formation off the leader's quarter.
      const lx = this.convoyLeader.x - Math.cos(this.convoyLeader.heading) * 50 + this.convoyOffset;
      const ly = this.convoyLeader.y - Math.sin(this.convoyLeader.heading) * 50;
      const d = Math.hypot(lx - this.x, ly - this.y);
      targetHeading = d > 12 ? Math.atan2(ly - this.y, lx - this.x) : this.convoyLeader.heading;
      throttle = d > 90 ? 1 : 0.55;
    } else {
      // Travel with purpose: pick a distant waypoint, sail to it, repeat.
      // (Reads as ships going somewhere rather than milling about.)
      if (!this.waypoint || Math.hypot(this.waypoint.x - this.x, this.waypoint.y - this.y) < 90) {
        const a = Math.random() * TAU;
        const d = 600 + Math.random() * 900;
        this.waypoint = { x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d };
      }
      this._wanderT -= dt;
      if (this._wanderT <= 0) {
        this._wanderT = 3 + Math.random() * 4;
        this._wanderDir = Math.atan2(this.waypoint.y - this.y, this.waypoint.x - this.x)
          + (Math.random() - 0.5) * 0.5;
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
  takeDamage(amount, game, fromPlayer, attacker = null) {
    if (this.state !== 'sailing') return false;
    this.hull -= amount;
    if (Math.random() < 0.35) this.sailHp = Math.max(0.3, this.sailHp - 0.15);
    const peaceful = this.type === 'merchant' || this.type === 'civilian' || this.type === 'fishing';
    if (fromPlayer) {
      // Peaceful ships panic; fighters remember.
      if (peaceful) {
        this.fleeing = true;
        this.fleeFrom = game.ship;
        if (this.type === 'merchant' && Math.random() < 0.4) {
          game.combat.jettisonCargo(this); // drops a crate to distract you
        }
      } else {
        this.hostileToPlayer = true;
      }
    } else if (attacker && peaceful) {
      // Merchants run from raiders too — and shed cargo in the panic.
      this.fleeing = true;
      this.fleeFrom = attacker;
      if (this.type === 'merchant' && Math.random() < 0.25) game.combat.jettisonCargo(this);
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
    const ghostly = this.type === 'ghost';
    g.globalAlpha = (ghostly ? 0.68 + Math.sin(this.bob * 2.4) * 0.1 : 1) * (1 - sink * 0.85);
    const scale = 1 - sink * 0.25; // slipping under
    g.scale(scale, scale);
    if (ghostly) {
      // spectral aura
      g.fillStyle = 'rgba(120,240,190,0.14)';
      g.beginPath();
      g.ellipse(0, 0, hull.width * 0.62, hull.height * 0.55, 0, 0, TAU);
      g.fill();
    }
    g.drawImage(hull, -hull.width / 2, -hull.height / 2);
    if ((this.speed > 8 || ghostly) && sink === 0) g.drawImage(sail, -sail.width / 2, -sail.height / 2);
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
