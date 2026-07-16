// Ambient ocean life: fish schools, seagulls, dolphins, sea turtles,
// whales and the occasional shark. Purely atmospheric — animals spawn
// just outside the view, live their little lives, and despawn when the
// player sails away. Population targets react to time of day and weather.

import { TAU } from '../util/math.js';
import { Noise2D } from '../util/noise.js';

const SPAWN_RADIUS = 560;
const DESPAWN_RADIUS = 820;

export class Wildlife {
  constructor(game) {
    this.game = game;
    this.animals = [];
    this.noise = new Noise2D(4242);
    this._spawnTimer = 0;
    this._gullCallTimer = 6;
  }

  _targets() {
    const { dayNight, weather } = this.game;
    const day = dayNight.snapshot.sun;
    const calm = 1 - weather.rain;
    return {
      fish: Math.round(6 * this.game.particles.quality),
      gull: Math.round(4 * day * calm),
      dolphin: weather.rain > 0.7 ? 0 : 1,
      turtle: Math.round(2 * calm),
      whale: 1,
      shark: 1,
    };
  }

  update(dt) {
    const { ship } = this.game;

    // Despawn animals the player left behind.
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      if (Math.hypot(a.x - ship.x, a.y - ship.y) > DESPAWN_RADIUS) {
        this.animals.splice(i, 1);
      }
    }

    // Top up populations gradually.
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnTimer = 0.8;
      const targets = this._targets();
      const counts = {};
      for (const a of this.animals) counts[a.type] = (counts[a.type] || 0) + 1;
      for (const [type, target] of Object.entries(targets)) {
        if ((counts[type] || 0) < target) {
          // Rare types only sometimes take the spawn slot.
          const chance = { whale: 0.04, shark: 0.06, dolphin: 0.3 }[type] ?? 1;
          if (Math.random() < chance) this._spawn(type);
          break;
        }
      }
    }

    for (const a of this.animals) this._update(a, dt);

    // Gull cries when birds are around (day ambience).
    this._gullCallTimer -= dt;
    if (this._gullCallTimer <= 0) {
      this._gullCallTimer = 5 + Math.random() * 12;
      if (this.animals.some((a) => a.type === 'gull' && Math.hypot(a.x - ship.x, a.y - ship.y) < 320)) {
        this.game.events.emit('sfx', 'gull');
      }
    }
  }

  _spawn(type) {
    const { ship, world } = this.game;
    const ang = Math.random() * TAU;
    const d = SPAWN_RADIUS + Math.random() * 160;
    const x = ship.x + Math.cos(ang) * d;
    const y = ship.y + Math.sin(ang) * d;
    if (type !== 'gull' && !world.isOpenWater(x, y)) return;

    const dir = Math.random() * TAU;
    const base = { type, x, y, dir, t: Math.random() * 100 };
    switch (type) {
      case 'fish':
        base.speed = 14;
        base.members = Array.from({ length: 5 + ((Math.random() * 7) | 0) }, () => ({
          ox: (Math.random() - 0.5) * 26,
          oy: (Math.random() - 0.5) * 26,
          phase: Math.random() * TAU,
        }));
        break;
      case 'gull':
        base.speed = 34 + Math.random() * 18;
        base.alt = 24 + Math.random() * 10;
        break;
      case 'dolphin':
        base.speed = 56;
        base.members = Array.from({ length: 2 + ((Math.random() * 3) | 0) }, (_, i) => ({
          lag: i * 14,
          phase: i * 0.9,
        }));
        break;
      case 'turtle':
        base.speed = 7;
        break;
      case 'whale':
        base.speed = 13;
        base.cycle = 0; // surfacing cycle
        break;
      case 'shark':
        base.speed = 27;
        break;
    }
    this.animals.push(base);
  }

  _update(a, dt) {
    const { world } = this.game;
    a.t += dt;

    // Gentle wandering steered by noise; unique per animal via its phase.
    const wander = (this.noise.value(a.x * 0.004 + a.t * 0.05, a.y * 0.004) - 0.5) * 2;
    const turnRate = { fish: 1.2, gull: 0.5, dolphin: 0.4, turtle: 0.8, whale: 0.25, shark: 1.5 }[a.type];
    a.dir += wander * turnRate * dt;

    // Swimmers avoid land: probe ahead and veer off.
    if (a.type !== 'gull') {
      const px = a.x + Math.cos(a.dir) * 30;
      const py = a.y + Math.sin(a.dir) * 30;
      if (!world.isOpenWater(px, py)) a.dir += 2.4 * dt * 60 * dt + 1.6 * dt; // strong steady turn
    }

    a.x += Math.cos(a.dir) * a.speed * dt;
    a.y += Math.sin(a.dir) * a.speed * dt;

    if (a.type === 'whale') {
      a.cycle = (a.cycle + dt) % 16;
      if (a.cycle > 11 && a.cycle - dt <= 11) {
        // Surfacing moment: blow spout.
        this.game.particles.burstSplash(a.x, a.y, 8);
      }
    }
    if (a.type === 'dolphin') {
      for (const m of a.members) {
        const jump = this._dolphinJump(a, m);
        if (jump.splash) {
          const px = a.x - Math.cos(a.dir) * m.lag;
          const py = a.y - Math.sin(a.dir) * m.lag;
          this.game.particles.splashRing(px, py, 2);
        }
      }
    }
  }

  _dolphinJump(a, m) {
    const cycle = (a.t * 0.55 + m.phase) % 2.6;
    const wasAir = m.air;
    const air = cycle < 0.9;
    m.air = air;
    return { air, progress: air ? cycle / 0.9 : 0, splash: wasAir !== undefined && wasAir !== air };
  }

  /** Underwater layer: fish, shadows of big animals. */
  drawUnderwater(g, t) {
    for (const a of this.animals) {
      switch (a.type) {
        case 'fish': {
          for (const m of a.members) {
            const fx = a.x + m.ox + Math.sin(t * 2 + m.phase) * 3;
            const fy = a.y + m.oy + Math.cos(t * 1.6 + m.phase) * 2;
            g.fillStyle = 'rgba(30,60,95,0.55)';
            g.fillRect(Math.round(fx), Math.round(fy), 3, 1);
            g.fillRect(Math.round(fx - 1), Math.round(fy - 1), 1, 1); // tail flick
            if (Math.sin(t * 3 + m.phase) > 0.94) {
              g.fillStyle = 'rgba(190,220,240,0.8)';
              g.fillRect(Math.round(fx + 1), Math.round(fy), 1, 1);
            }
          }
          break;
        }
        case 'whale': {
          const surfaced = a.cycle > 11 && a.cycle < 15;
          if (!surfaced) {
            g.save();
            g.translate(Math.round(a.x), Math.round(a.y));
            g.rotate(a.dir);
            g.fillStyle = 'rgba(12,30,54,0.3)';
            g.beginPath();
            g.ellipse(0, 0, 34, 11, 0, 0, TAU);
            g.fill();
            g.restore();
          }
          break;
        }
        case 'shark': {
          g.save();
          g.translate(Math.round(a.x), Math.round(a.y));
          g.rotate(a.dir);
          g.fillStyle = 'rgba(14,32,56,0.35)';
          g.beginPath();
          g.ellipse(0, 0, 12, 4, 0, 0, TAU);
          g.fill();
          g.restore();
          break;
        }
        case 'dolphin': {
          for (const m of a.members) {
            if (!m.air) {
              const px = a.x - Math.cos(a.dir) * m.lag;
              const py = a.y - Math.sin(a.dir) * m.lag;
              g.fillStyle = 'rgba(20,42,70,0.4)';
              g.fillRect(Math.round(px - 4), Math.round(py - 1), 8, 3);
            }
          }
          break;
        }
      }
    }
  }

  /** Surface layer: y-sortable drawables for turtles, dolphins, whale, fins. */
  collectSurfaceDrawables(out, t) {
    for (const a of this.animals) {
      switch (a.type) {
        case 'turtle':
          out.push({ y: a.y, draw: (g) => this._drawTurtle(g, a, t) });
          break;
        case 'shark':
          out.push({ y: a.y, draw: (g) => this._drawSharkFin(g, a, t) });
          break;
        case 'whale':
          if (a.cycle > 11 && a.cycle < 15) {
            out.push({ y: a.y, draw: (g) => this._drawWhaleBack(g, a) });
          }
          break;
        case 'dolphin':
          for (const m of a.members) {
            if (m.air) {
              out.push({ y: a.y, draw: (g) => this._drawDolphin(g, a, m) });
            }
          }
          break;
      }
    }
  }

  _drawTurtle(g, a, t) {
    g.save();
    g.translate(Math.round(a.x), Math.round(a.y));
    g.rotate(a.dir + Math.PI / 2);
    const paddle = Math.sin(t * 2.4 + a.t);
    g.fillStyle = '#6b8a4a'; // flippers
    g.fillRect(-4, -2 + paddle, 2, 2);
    g.fillRect(2, -2 - paddle, 2, 2);
    g.fillRect(-4, 2 - paddle, 2, 2);
    g.fillRect(2, 2 + paddle, 2, 2);
    g.fillStyle = '#4a6e3a'; // shell
    g.fillRect(-3, -3, 6, 7);
    g.fillStyle = '#5d8a48';
    g.fillRect(-2, -2, 4, 5);
    g.fillStyle = '#6b8a4a'; // head
    g.fillRect(-1, -5, 2, 2);
    g.restore();
  }

  _drawSharkFin(g, a, t) {
    g.save();
    g.translate(Math.round(a.x), Math.round(a.y));
    g.rotate(a.dir);
    g.fillStyle = '#5a6a78';
    g.beginPath();
    g.moveTo(3, 0);
    g.lineTo(-3, -5);
    g.lineTo(-3, 0);
    g.closePath();
    g.fill();
    g.restore();
    // fin wake
    g.fillStyle = 'rgba(230,242,250,0.35)';
    g.fillRect(Math.round(a.x - Math.cos(a.dir) * 5), Math.round(a.y - Math.sin(a.dir) * 5), 2, 1);
  }

  _drawWhaleBack(g, a) {
    g.save();
    g.translate(Math.round(a.x), Math.round(a.y));
    g.rotate(a.dir);
    g.fillStyle = '#26384e';
    g.beginPath();
    g.ellipse(0, 0, 26, 8, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#324a66';
    g.beginPath();
    g.ellipse(-2, -2, 20, 5, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#26384e'; // dorsal ridge
    g.fillRect(6, -2, 4, 3);
    g.restore();
  }

  _drawDolphin(g, a, m) {
    const jump = this._dolphinJump(a, m);
    const px = a.x - Math.cos(a.dir) * m.lag;
    const py = a.y - Math.sin(a.dir) * m.lag;
    const h = Math.sin(jump.progress * Math.PI) * 9;
    g.save();
    g.translate(Math.round(px), Math.round(py - h));
    g.rotate(a.dir);
    g.fillStyle = '#7e93a8';
    g.fillRect(-5, -1, 10, 3);
    g.fillRect(3, -2, 3, 2); // nose up
    g.fillRect(-7, -2, 2, 2); // tail
    g.fillStyle = '#9db2c4';
    g.fillRect(-4, -1, 8, 1);
    g.fillStyle = '#7e93a8'; // dorsal fin
    g.fillRect(-1, -3, 2, 2);
    g.restore();
  }

  /** Air layer: gulls fly above everything, casting shadows on the sea. */
  drawAir(g, t) {
    for (const a of this.animals) {
      if (a.type !== 'gull') continue;
      const flap = Math.sin(t * 9 + a.t * 3);
      const x = Math.round(a.x);
      const y = Math.round(a.y - a.alt);
      // shadow on the water
      g.fillStyle = 'rgba(8,20,40,0.16)';
      g.fillRect(Math.round(a.x) - 2, Math.round(a.y), 5, 2);
      // body
      g.save();
      g.translate(x, y);
      g.rotate(a.dir + Math.PI / 2);
      g.fillStyle = '#eef2f4';
      g.fillRect(-1, -2, 2, 4);
      g.fillStyle = '#d8dee2';
      const wing = flap > 0 ? 1 : 2;
      g.fillRect(-1 - 4, -wing, 4, wing); // left wing
      g.fillRect(1, -wing, 4, wing); // right wing
      g.fillStyle = '#e0b345';
      g.fillRect(-1, 2, 1, 1); // beak
      g.restore();
    }
  }
}
