// Legends of the deep: very rare, unmistakable encounters. Two combat
// bosses simulated here (the Kraken and the Sea Serpent), one boss ship
// (the Wailing Duchess, riding on the AI-ship pipeline), and two
// peaceful wonders (the Wandering Isle and the Singing Reef). Each is
// throttled hard — sighting one should be a story, not a spawn table.

import { TAU, clamp, dist2, angleDiff } from '../util/math.js';
import { AIShip } from '../entities/aiship.js';
import { rollLoot } from '../items/itemdefs.js';
import { mulberry32 } from '../util/random.js';

const LEGEND_COOLDOWN = 600; // seconds between any two legend spawns

/* ==================================================================== */
/* The Kraken — three phases                                            */
/* ==================================================================== */

class Kraken {
  constructor(x, y, tier) {
    this.kind = 'kraken';
    this.name = 'THE KRAKEN';
    this.x = x;
    this.y = y;
    this.tier = tier;
    this.phase = 1;
    this.t = 0;
    this.dead = false;
    this.headMaxHp = 110 + tier * 30;
    this.headHp = this.headMaxHp;
    this.headState = 'hidden'; // hidden | surfaced
    this.headTimer = 0;
    this.inkClouds = [];
    this._attackTimer = 4;
    this.tentacles = [];
    for (let i = 0; i < 6; i++) {
      this.tentacles.push({
        angle: (i / 6) * TAU,
        dist: 70 + (i % 2) * 40,
        hp: 32 + tier * 10,
        maxHp: 32 + tier * 10,
        state: 'idle', // idle | telegraph | slam | dead
        timer: 0,
        targetX: 0,
        targetY: 0,
        x, y,
        sway: Math.random() * TAU,
      });
    }
  }

  get aliveTentacles() {
    return this.tentacles.filter((t) => t.state !== 'dead');
  }

  get barInfo() {
    if (this.headState === 'surfaced' || this.phase === 3) {
      return { name: this.name, hp: this.headHp, max: this.headMaxHp, phase: this.phase };
    }
    const alive = this.aliveTentacles;
    const hp = alive.reduce((s, t) => s + t.hp, 0);
    const max = this.tentacles.reduce((s, t) => s + t.maxHp, 0);
    return { name: this.name, hp: this.headHp + hp, max: this.headMaxHp + max, phase: this.phase };
  }

  update(dt, game) {
    this.t += dt;
    const { ship } = game;

    // The body drifts to keep the player inside the tentacle ring.
    const d = Math.hypot(ship.x - this.x, ship.y - this.y);
    if (d > 60) {
      this.x += ((ship.x - this.x) / d) * 14 * dt;
      this.y += ((ship.y - this.y) / d) * 14 * dt;
    }

    // Phase logic.
    if (this.phase === 1 && this.aliveTentacles.length <= 3) {
      this.phase = 2;
      game.hud.toast('The sea turns black — the Kraken rages!', '#b46ef0');
      game.events.emit('sfx', 'roar');
    }
    if (this.phase < 3 && this.aliveTentacles.length === 0) {
      this.phase = 3;
      this.headState = 'surfaced';
      this.headTimer = 9;
      game.hud.toast('The head rises! NOW — all cannons!', '#f05a78');
      game.events.emit('sfx', 'roar');
      game.camera.addShake(5);
    }

    // Tentacles: sway, telegraph, slam.
    const slamCd = this.phase === 2 ? 2.2 : 3.8;
    this._attackTimer -= dt;
    for (const ten of this.tentacles) {
      if (ten.state === 'dead') continue;
      ten.sway += dt;
      ten.angle += dt * 0.12;
      ten.x = this.x + Math.cos(ten.angle) * ten.dist;
      ten.y = this.y + Math.sin(ten.angle) * ten.dist;

      if (ten.state === 'telegraph') {
        ten.timer -= dt;
        if (ten.timer <= 0) {
          ten.state = 'slam';
          ten.timer = 0.35;
          game.particles.burstSplash(ten.targetX, ten.targetY, 18);
          game.camera.addShake(3);
          game.events.emit('sfx', 'slam');
          if (dist2(ship.x, ship.y, ten.targetX, ten.targetY) < 34 * 34) {
            game.shipState.damage(16 + this.tier * 4, 4);
          }
        }
      } else if (ten.state === 'slam') {
        ten.timer -= dt;
        if (ten.timer <= 0) ten.state = 'idle';
      }
    }
    if (this._attackTimer <= 0 && this.phase < 3) {
      this._attackTimer = slamCd;
      const alive = this.aliveTentacles.filter((t) => t.state === 'idle');
      if (alive.length) {
        const ten = alive[(Math.random() * alive.length) | 0];
        ten.state = 'telegraph';
        ten.timer = 1.1;
        // aim slightly ahead of the ship
        ten.targetX = ship.x + ship.velX * 0.8;
        ten.targetY = ship.y + ship.velY * 0.8;
      }
    }

    // Phase 2: ink clouds foul the water.
    if (this.phase >= 2 && Math.random() < dt * 0.4 && this.inkClouds.length < 5) {
      this.inkClouds.push({
        x: this.x + (Math.random() - 0.5) * 240,
        y: this.y + (Math.random() - 0.5) * 240,
        r: 40 + Math.random() * 30,
        life: 12,
      });
    }
    for (let i = this.inkClouds.length - 1; i >= 0; i--) {
      const c = this.inkClouds[i];
      c.life -= dt;
      if (c.life <= 0) this.inkClouds.splice(i, 1);
      else if (dist2(ship.x, ship.y, c.x, c.y) < c.r * c.r) {
        ship.speed *= Math.exp(-0.7 * dt); // ink drags the hull
      }
    }

    // Phase 3: vulnerability windows.
    if (this.phase === 3) {
      this.headTimer -= dt;
      if (this.headState === 'surfaced' && this.headTimer <= 0) {
        this.headState = 'hidden';
        this.headTimer = 5;
        // one tentacle regrows
        let revived = 0;
        for (const ten of this.tentacles) {
          if (ten.state === 'dead' && revived < 1) {
            ten.state = 'idle';
            ten.hp = ten.maxHp * 0.6;
            revived++;
          }
        }
        if (revived) this.phase = 2;
        game.particles.burstSplash(this.x, this.y, 24);
      } else if (this.headState === 'hidden' && this.headTimer <= 0) {
        this.headState = 'surfaced';
        this.headTimer = 9;
        game.events.emit('sfx', 'roar');
      }
    }
  }

  hitTest(ball, game) {
    for (const ten of this.tentacles) {
      if (ten.state === 'dead') continue;
      if (dist2(ball.x, ball.y, ten.x, ten.y) < 18 * 18) {
        ten.hp -= ball.damage;
        game.particles.burstBlood(ten.x, ten.y, 8);
        game.particles.spawnText(ten.x, ten.y - 12, `${ball.damage}`, '#b46ef0');
        game.events.emit('sfx', 'hit');
        if (ten.hp <= 0) {
          ten.state = 'dead';
          game.particles.burstSplash(ten.x, ten.y, 16);
          game.events.emit('sfx', 'death');
        }
        return true;
      }
    }
    if (this.headState === 'surfaced' && dist2(ball.x, ball.y, this.x, this.y) < 27 * 27) {
      this.headHp -= ball.damage;
      game.particles.burstBlood(this.x, this.y, 10);
      game.particles.spawnText(this.x, this.y - 20, `${ball.damage}`, '#f05a78');
      game.events.emit('sfx', 'hit');
      if (this.headHp <= 0) this.dead = true;
      return true;
    }
    return false;
  }

  drawUnder(g, t) {
    // vast shadow
    g.fillStyle = 'rgba(20,8,40,0.35)';
    g.beginPath();
    g.ellipse(this.x, this.y, 90, 60, 0, 0, TAU);
    g.fill();
    for (const c of this.inkClouds) {
      g.fillStyle = `rgba(10,6,20,${0.4 * Math.min(1, c.life / 3)})`;
      g.beginPath();
      g.arc(c.x, c.y, c.r, 0, TAU);
      g.fill();
    }
  }

  collectDrawables(out, t) {
    for (const ten of this.tentacles) {
      if (ten.state === 'dead') continue;
      out.push({ y: ten.y, draw: (g) => this._drawTentacle(g, ten, t) });
    }
    if (this.headState === 'surfaced') {
      out.push({ y: this.y, draw: (g) => this._drawHead(g, t) });
    }
    // slam telegraphs on the water
    for (const ten of this.tentacles) {
      if (ten.state !== 'telegraph') continue;
      out.push({
        y: ten.targetY - 100,
        draw: (g) => {
          const k = 1 - ten.timer / 1.1;
          g.strokeStyle = `rgba(240,90,120,${0.4 + k * 0.5})`;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(ten.targetX, ten.targetY, 30 * (1 - k * 0.6), 0, TAU);
          g.stroke();
        },
      });
    }
  }

  _drawTentacle(g, ten, t) {
    const rise = ten.state === 'telegraph' ? 1.4 : 1;
    const sway = Math.sin(t * 2 + ten.sway) * 3;
    g.strokeStyle = '#3a2a52';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(ten.x, ten.y + 6);
    g.quadraticCurveTo(ten.x + sway, ten.y - 14 * rise, ten.x + sway * 1.6, ten.y - 26 * rise);
    g.stroke();
    g.strokeStyle = '#54407a';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(ten.x, ten.y + 4);
    g.quadraticCurveTo(ten.x + sway, ten.y - 14 * rise, ten.x + sway * 1.6, ten.y - 25 * rise);
    g.stroke();
    // suckers
    g.fillStyle = '#c8b4e8';
    for (let i = 1; i <= 3; i++) {
      g.fillRect(Math.round(ten.x + sway * (i / 3) - 1), Math.round(ten.y - i * 7 * rise), 2, 2);
    }
    // foam at waterline
    g.fillStyle = 'rgba(235,246,252,0.5)';
    g.fillRect(Math.round(ten.x - 5), Math.round(ten.y + 5), 10, 2);
    // health pips
    if (ten.hp < ten.maxHp) {
      g.fillStyle = 'rgba(10,16,30,0.7)';
      g.fillRect(Math.round(ten.x - 7), Math.round(ten.y - 34 * rise), 14, 2);
      g.fillStyle = '#b46ef0';
      g.fillRect(Math.round(ten.x - 7), Math.round(ten.y - 34 * rise), Math.round(14 * (ten.hp / ten.maxHp)), 2);
    }
  }

  _drawHead(g, t) {
    const bob = Math.sin(t * 1.8) * 2;
    g.fillStyle = '#3a2a52';
    g.beginPath();
    g.ellipse(this.x, this.y + bob, 26, 20, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#54407a';
    g.beginPath();
    g.ellipse(this.x, this.y - 4 + bob, 22, 14, 0, 0, TAU);
    g.fill();
    // furious eyes
    g.fillStyle = '#f0d040';
    g.fillRect(Math.round(this.x - 12), Math.round(this.y - 6 + bob), 6, 6);
    g.fillRect(Math.round(this.x + 6), Math.round(this.y - 6 + bob), 6, 6);
    g.fillStyle = '#1e1a22';
    g.fillRect(Math.round(this.x - 10), Math.round(this.y - 4 + bob), 3, 3);
    g.fillRect(Math.round(this.x + 8), Math.round(this.y - 4 + bob), 3, 3);
    // churning water
    g.fillStyle = 'rgba(235,246,252,0.5)';
    g.fillRect(Math.round(this.x - 24), Math.round(this.y + 16 + bob), 48, 2);
  }

  onDefeat(game) {
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    for (let i = 0; i < 3; i++) {
      const loot = rollLoot(rng, 'treasure', game.player.luck + 4);
      if (i === 0) loot.items.push({ id: 'krakenHarpoon', qty: 1 });
      game.combat.drops.push({
        x: this.x + (Math.random() - 0.5) * 50,
        y: this.y + (Math.random() - 0.5) * 40,
        kind: 'chest', age: 0, loot,
      });
    }
    game.player.addXp(180);
    game.collection.discover('foes', 'kraken');
    game.collection.discover('bosses', 'kraken');
  }
}

/* ==================================================================== */
/* The Sea Serpent                                                      */
/* ==================================================================== */

class Serpent {
  constructor(x, y, tier) {
    this.kind = 'serpent';
    this.name = 'THE SEA SERPENT';
    this.x = x;
    this.y = y;
    this.tier = tier;
    this.heading = Math.random() * TAU;
    this.speed = 70;
    this.maxHp = 180 + tier * 60;
    this.hp = this.maxHp;
    this.dead = false;
    this.state = 'circle'; // circle | telegraph | lunge | dive
    this.timer = 4;
    this.dived = false;
    this.trail = []; // segment position history
    this.t = 0;
  }

  get barInfo() {
    return { name: this.name, hp: this.hp, max: this.maxHp, phase: this.dived ? 2 : 1 };
  }

  update(dt, game) {
    this.t += dt;
    const { ship } = game;
    const d = Math.hypot(ship.x - this.x, ship.y - this.y);
    const bearing = Math.atan2(ship.y - this.y, ship.x - this.x);

    this.timer -= dt;
    switch (this.state) {
      case 'circle': {
        // orbit the player at ~140px
        const want = d > 170 ? bearing : d < 110 ? bearing + Math.PI : bearing + Math.PI / 2;
        this.heading += clamp(angleDiff(this.heading, want), -1, 1) * 2.4 * dt;
        this.speed = 85;
        if (this.timer <= 0) {
          this.state = 'telegraph';
          this.timer = 0.8;
          this.speed = 10;
          game.events.emit('sfx', 'hiss');
        }
        break;
      }
      case 'telegraph': {
        this.heading += clamp(angleDiff(this.heading, bearing), -1, 1) * 4 * dt;
        if (this.timer <= 0) {
          this.state = 'lunge';
          this.timer = 0.8;
          this.speed = 300;
          game.particles.burstSplash(this.x, this.y, 10);
        }
        break;
      }
      case 'lunge': {
        if (d < 26) {
          game.shipState.damage(14 + this.tier * 3, 6);
          game.camera.addShake(4);
          game.events.emit('sfx', 'slam');
          // shove the ship
          ship.velX += Math.cos(this.heading) * 60;
          ship.velY += Math.sin(this.heading) * 60;
          this.state = 'circle';
          this.timer = 4 + Math.random() * 3;
        }
        if (this.timer <= 0) {
          this.state = 'circle';
          this.timer = 4 + Math.random() * 3;
        }
        break;
      }
      case 'dive': {
        this.speed = 140;
        this.heading += clamp(angleDiff(this.heading, bearing + Math.PI), -1, 1) * 2 * dt;
        if (this.timer <= 0) {
          // resurface behind the player
          const back = ship.heading + Math.PI + (Math.random() - 0.5);
          this.x = ship.x + Math.cos(back) * 220;
          this.y = ship.y + Math.sin(back) * 220;
          this.trail.length = 0;
          this.state = 'circle';
          this.timer = 2;
          game.particles.burstSplash(this.x, this.y, 22);
          game.events.emit('sfx', 'roar');
        }
        break;
      }
    }

    // half-health dive (once)
    if (!this.dived && this.hp <= this.maxHp / 2 && this.state !== 'dive') {
      this.dived = true;
      this.state = 'dive';
      this.timer = 4;
      game.particles.burstSplash(this.x, this.y, 22);
      game.hud.toast('The serpent slips beneath the waves...', '#4ec9b0');
    }

    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 60) this.trail.pop();
  }

  hitTest(ball, game) {
    if (this.state === 'dive') return false;
    // head
    if (dist2(ball.x, ball.y, this.x, this.y) < 14 * 14) {
      this._damage(ball.damage, game);
      return true;
    }
    // body segments take reduced damage
    for (let i = 6; i < this.trail.length; i += 6) {
      const p = this.trail[i];
      if (dist2(ball.x, ball.y, p.x, p.y) < 10 * 10) {
        this._damage(Math.round(ball.damage / 2), game, p);
        return true;
      }
    }
    return false;
  }

  _damage(dmg, game, at = this) {
    this.hp -= dmg;
    game.particles.burstBlood(at.x, at.y, 6);
    game.particles.spawnText(at.x, at.y - 10, `${dmg}`, '#4ec9b0');
    game.events.emit('sfx', 'hit');
    if (this.hp <= 0) this.dead = true;
  }

  drawUnder(g) {
    if (this.state !== 'dive') return;
    g.fillStyle = 'rgba(12,40,44,0.35)';
    g.beginPath();
    g.ellipse(this.x, this.y, 30, 12, this.heading, 0, TAU);
    g.fill();
  }

  collectDrawables(out, t) {
    if (this.state === 'dive') return;
    // body segments (rear first so the head draws on top)
    for (let i = Math.min(54, this.trail.length - 1); i >= 6; i -= 6) {
      const p = this.trail[i];
      const r = 7 - i * 0.07;
      out.push({
        y: p.y,
        draw: (g) => {
          g.fillStyle = '#2e6e64';
          g.beginPath();
          g.arc(p.x, p.y, r, 0, TAU);
          g.fill();
          g.fillStyle = '#4ec9b0';
          g.beginPath();
          g.arc(p.x, p.y - 2, r * 0.55, 0, TAU);
          g.fill();
        },
      });
    }
    out.push({
      y: this.y,
      draw: (g) => {
        const flash = this.state === 'telegraph' && Math.sin(t * 18) > 0;
        g.save();
        g.translate(this.x, this.y);
        g.rotate(this.heading);
        g.fillStyle = flash ? '#7ae0cc' : '#2e6e64';
        g.beginPath();
        g.ellipse(0, 0, 12, 7, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#4ec9b0';
        g.beginPath();
        g.ellipse(-2, -2, 8, 4, 0, 0, TAU);
        g.fill();
        // jaw + eye + fins
        g.fillStyle = '#1e4a42';
        g.fillRect(8, -2, 6, 4);
        g.fillStyle = '#f0d040';
        g.fillRect(4, -4, 2, 2);
        g.fillStyle = '#2e6e64';
        g.fillRect(-4, -10, 3, 6);
        g.fillRect(-4, 4, 3, 6);
        g.restore();
      },
    });
  }

  onDefeat(game) {
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    const loot = rollLoot(rng, 'treasure', game.player.luck + 2);
    loot.items.push({ id: 'serpentScale', qty: 1 });
    loot.gold += 120;
    game.combat.drops.push({ x: this.x, y: this.y, kind: 'chest', age: 0, loot });
    game.player.addXp(110);
    game.collection.discover('foes', 'serpent');
    game.collection.discover('bosses', 'serpent');
  }
}

/* ==================================================================== */
/* Legend manager                                                       */
/* ==================================================================== */

export class Legends {
  constructor(game, saved) {
    this.game = game;
    this.boss = null; // Kraken | Serpent instance
    this.duchess = null; // AIShip reference while the boss ship sails
    this._duchessMinions = false;
    this.wonders = []; // turtle island / living coral instances
    this.cooldown = 90; // grace period at session start
    this.defeated = new Set(saved?.defeated ?? []);

    game.events.on('ship:sunk', (e) => {
      if (this.duchess && e.id === this.duchess.id) {
        this._duchessDefeated(e.byPlayer);
      }
    });
  }

  get activeBoss() {
    if (this.boss) return this.boss.barInfo;
    if (this.duchess && this.duchess.state === 'sailing') {
      return {
        name: 'THE WAILING DUCHESS',
        hp: this.duchess.hull,
        max: this.duchess.maxHull,
        phase: this._duchessMinions ? 2 : 1,
      };
    }
    return null;
  }

  update(dt) {
    const { game } = this;
    this.cooldown -= dt;

    // ---- active boss ----------------------------------------------------
    if (this.boss) {
      this.boss.update(dt, game);
      if (this.boss.dead) {
        game.hud.toast(`${this.boss.name} is defeated!`, '#f0a83c');
        game.events.emit('sfx', 'victory');
        game.events.emit('boss:defeated', { kind: this.boss.kind });
        this.boss.onDefeat(game);
        this.defeated.add(this.boss.kind);
        this.boss = null;
        this.cooldown = LEGEND_COOLDOWN;
      } else if (dist2(this.boss.x, this.boss.y, game.ship.x, game.ship.y) > 1400 * 1400) {
        // fled far enough — it loses interest
        game.hud.toast('The legend sinks back into the deep...', '#9cc3ea');
        this.boss = null;
        this.cooldown = LEGEND_COOLDOWN / 2;
      }
    }

    // ---- Duchess phase 2 -------------------------------------------------
    if (this.duchess && this.duchess.state === 'sailing' && !this._duchessMinions
      && this.duchess.hull < this.duchess.maxHull / 2) {
      this._duchessMinions = true;
      for (let i = 0; i < 2; i++) {
        const m = new AIShip('ghost', this.duchess.x + (i ? 90 : -90), this.duchess.y + 40, this.duchess.tier);
        m.hostileToPlayer = true;
        game.combat.ships.push(m);
      }
      game.hud.toast('The Duchess wails — her escort answers from below!', '#b46ef0');
      game.events.emit('sfx', 'roar');
    }
    if (this.duchess && this.duchess.state === 'gone') this.duchess = null;

    // ---- wonders ---------------------------------------------------------
    for (const w of this.wonders) this._updateWonder(w, dt);
    this.wonders = this.wonders.filter((w) => !w.gone
      && dist2(w.x, w.y, game.ship.x, game.ship.y) < 1600 * 1600);

    // ---- spawner ------------------------------------------------------------
    if (this.cooldown <= 0 && !this.boss && !this.duchess) {
      this.cooldown = 45; // re-roll interval
      const tier = game.tierAt(game.ship.x, game.ship.y);
      const night = game.dayNight.isNight;
      const ghostTide = game.daily?.modifier?.legends;
      const roll = Math.random();
      // Wonders are gentler and a bit more common.
      if (roll < 0.10) this._spawnWonder();
      else if (roll < 0.16 && tier >= 1) this._spawnSerpent(tier);
      else if (roll < 0.20 && tier >= 2) this._spawnKraken(tier);
      else if (roll < (ghostTide ? 0.30 : 0.24) && night && tier >= 1) this._spawnDuchess(tier);
    }
  }

  _announce(text) {
    this.game.hud.toast(text, '#f05a78');
    this.game.events.emit('sfx', 'roar');
    this.game.events.emit('legend:sighted');
    this.game.camera.addShake(3);
  }

  _spawnKraken(tier) {
    const { game } = this;
    const p = this._openWaterNear(320);
    if (!p) return;
    this.boss = new Kraken(p.x, p.y, tier);
    this._announce('Tentacles breach the surface. THE KRAKEN has found you!');
  }

  _spawnSerpent(tier) {
    const p = this._openWaterNear(380);
    if (!p) return;
    this.boss = new Serpent(p.x, p.y, tier);
    this._announce('A vast coil rolls through the waves. SEA SERPENT!');
  }

  _spawnDuchess(tier) {
    const { game } = this;
    const p = this._openWaterNear(500);
    if (!p) return;
    const d = new AIShip('duchess', p.x, p.y, tier);
    d.hostileToPlayer = true;
    d.maxHull = 320 + tier * 80;
    d.hull = d.maxHull;
    d.cannons = 4;
    d.cannonDamage = 10 + tier * 3;
    d.lootTable = 'treasure';
    d.isBoss = true;
    game.combat.ships.push(d);
    this.duchess = d;
    this._duchessMinions = false;
    this._announce('A green glow parts the night. THE WAILING DUCHESS sails again!');
    game.collection.discover('ships', 'duchess');
  }

  _spawnWonder() {
    const { game } = this;
    const p = this._openWaterNear(520);
    if (!p) return;
    const kind = Math.random() < 0.5 ? 'turtleIsland' : 'livingCoral';
    if (this.wonders.some((w) => w.kind === kind)) return;
    this.wonders.push({
      kind,
      x: p.x,
      y: p.y,
      heading: Math.random() * TAU,
      t: 0,
      discovered: false,
      harvested: false,
      leaveTimer: null,
      gone: false,
    });
  }

  _updateWonder(w, dt) {
    const { game } = this;
    w.t += dt;
    if (w.kind === 'turtleIsland') {
      // it swims, slowly, with an island on its back
      w.heading += Math.sin(w.t * 0.1) * 0.02 * dt;
      w.x += Math.cos(w.heading) * 6 * dt;
      w.y += Math.sin(w.heading) * 6 * dt;
      if (w.leaveTimer !== null) {
        w.leaveTimer -= dt;
        if (w.leaveTimer <= 0) {
          game.particles.burstSplash(w.x, w.y, 30);
          game.hud.toast('The Wandering Isle dives beneath the sea.', '#4ec9b0');
          w.gone = true;
        }
      }
    }
    if (!w.discovered && dist2(w.x, w.y, game.ship.x, game.ship.y) < 200 * 200) {
      w.discovered = true;
      if (w.kind === 'turtleIsland') {
        this._announce('That island... is BREATHING. The Wandering Isle!');
        game.collection.discover('animals', 'turtleIsland');
        game.collection.discover('bosses', 'turtleIsland');
      } else {
        this._announce('The reef below is glowing — and singing. The Singing Reef!');
        game.collection.discover('plants', 'livingCoral');
        game.collection.discover('bosses', 'livingCoral');
      }
      game.player.addXp(40);
    }
  }

  /** Wonder interaction (hooked from the game's interact scan). */
  findInteractable() {
    for (const w of this.wonders) {
      if (w.harvested) continue;
      if (dist2(w.x, w.y, this.game.ship.x, this.game.ship.y) < 80 * 80) return w;
    }
    return null;
  }

  interactWonder(w) {
    const { game } = this;
    w.harvested = true;
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    if (w.kind === 'turtleIsland') {
      const loot = rollLoot(rng, 'treasure', game.player.luck + 3);
      loot.items.push({ id: 'treasureFragment', qty: 2 });
      game.openLoot('Gifts of the Wandering Isle', loot, w.x, w.y);
      w.leaveTimer = 25;
    } else {
      const loot = { gold: 60, items: [{ id: 'coralHeart', qty: 1 }, { id: 'parrotfish', qty: 2 }] };
      game.openLoot('The Reef\'s Song', loot, w.x, w.y);
    }
    game.player.addXp(60);
  }

  promptFor(w) {
    return w.kind === 'turtleIsland' ? 'Walk the Wandering Isle' : 'Dive to the Singing Reef';
  }

  /** Cannonball hit test, called from ship combat. */
  hitTest(ball) {
    return this.boss ? this.boss.hitTest(ball, this.game) : false;
  }

  /** Best aim point on the active boss (auto-aim assist for broadsides). */
  nearestTarget(x, y) {
    const b = this.boss;
    if (!b) return null;
    let best = null;
    let bestD = 300 * 300;
    const consider = (tx, ty) => {
      const d = dist2(tx, ty, x, y);
      if (d < bestD) {
        bestD = d;
        best = { x: tx, y: ty };
      }
    };
    if (b.kind === 'kraken') {
      for (const ten of b.tentacles) {
        if (ten.state !== 'dead') consider(ten.x, ten.y);
      }
      if (b.headState === 'surfaced') consider(b.x, b.y);
    } else if (b.kind === 'serpent' && b.state !== 'dive') {
      consider(b.x, b.y);
    }
    return best;
  }

  /* ---- drawing --------------------------------------------------------- */

  drawUnder(g, t) {
    this.boss?.drawUnder(g, t);
    for (const w of this.wonders) {
      if (w.kind === 'livingCoral') this._drawCoral(g, w, t);
    }
  }

  collectSurfaceDrawables(out, t) {
    this.boss?.collectDrawables(out, t);
    for (const w of this.wonders) {
      if (w.kind === 'turtleIsland') {
        out.push({ y: w.y, draw: (g) => this._drawTurtleIsland(g, w, t) });
      }
    }
  }

  _drawTurtleIsland(g, w, t) {
    const bob = Math.sin(t * 0.8) * 1.5;
    g.save();
    g.translate(Math.round(w.x), Math.round(w.y + bob));
    // flippers
    const paddle = Math.sin(t * 1.2) * 3;
    g.fillStyle = '#4a6e3a';
    g.beginPath();
    g.ellipse(-30, -14 + paddle, 10, 5, -0.4, 0, TAU);
    g.ellipse(-30, 14 - paddle, 10, 5, 0.4, 0, TAU);
    g.ellipse(26, -12 - paddle, 8, 4, 0.4, 0, TAU);
    g.ellipse(26, 12 + paddle, 8, 4, -0.4, 0, TAU);
    g.fill();
    // head
    g.fillStyle = '#5d8a48';
    g.beginPath();
    g.ellipse(38, 0, 9, 7, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#1e1a22';
    g.fillRect(42, -3, 2, 2);
    // shell = a tiny island: sand ring, grass, a palm
    g.fillStyle = '#c9b280';
    g.beginPath();
    g.ellipse(0, 0, 30, 20, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#e8d29a';
    g.beginPath();
    g.ellipse(0, -2, 26, 16, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#5c9e52';
    g.beginPath();
    g.ellipse(-2, -4, 16, 9, 0, 0, TAU);
    g.fill();
    // palm
    g.fillStyle = '#8a5a33';
    g.fillRect(-2, -16, 2, 10);
    g.strokeStyle = '#3f8a3f';
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      g.beginPath();
      g.moveTo(-1, -16);
      g.lineTo(-1 + Math.cos(a) * 7, -16 + Math.sin(a) * 3 - 2);
      g.stroke();
    }
    // wake foam
    g.fillStyle = 'rgba(235,246,252,0.4)';
    g.fillRect(-34, 20, 68, 2);
    g.restore();
  }

  _drawCoral(g, w, t) {
    const pulse = 0.5 + Math.sin(t * 1.6) * 0.3;
    g.fillStyle = `rgba(78,201,176,${0.1 + pulse * 0.08})`;
    g.beginPath();
    g.arc(w.x, w.y, 70 + pulse * 8, 0, TAU);
    g.fill();
    const rng = mulberry32(9911);
    for (let i = 0; i < 24; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * 55;
      const cx = w.x + Math.cos(a) * d;
      const cy = w.y + Math.sin(a) * d * 0.7;
      const glow = Math.sin(t * 2 + i) * 0.5 + 0.5;
      g.fillStyle = i % 3 === 0
        ? `rgba(224,122,106,${0.35 + glow * 0.3})`
        : i % 3 === 1
          ? `rgba(78,201,176,${0.35 + glow * 0.3})`
          : `rgba(180,110,240,${0.3 + glow * 0.3})`;
      g.fillRect(Math.round(cx), Math.round(cy), 3, 3);
      if (glow > 0.7) g.fillRect(Math.round(cx + 1), Math.round(cy - 2), 1, 2);
    }
  }

  _openWaterNear(dist) {
    const { game } = this;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * TAU;
      const x = game.ship.x + Math.cos(a) * (dist + Math.random() * 120);
      const y = game.ship.y + Math.sin(a) * (dist + Math.random() * 120);
      if (game.world.isOpenWater(x, y)) return { x, y };
    }
    return null;
  }

  _duchessDefeated(byPlayer) {
    const { game } = this;
    const d = this.duchess;
    this.duchess = null;
    this.cooldown = LEGEND_COOLDOWN;
    if (!byPlayer) return;
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    const loot = rollLoot(rng, 'treasure', game.player.luck + 4);
    loot.items.push({ id: 'ghostCannon', qty: 1 });
    if (Math.random() < 0.5) loot.items.push({ id: 'phoenixSail', qty: 1 });
    game.combat.drops.push({ x: d.x, y: d.y, kind: 'chest', age: 0, loot });
    game.player.addXp(160);
    game.events.emit('boss:defeated', { kind: 'duchess' });
    game.collection.discover('bosses', 'duchess');
    this.defeated.add('duchess');
    game.hud.toast('The Duchess sighs — and rests at last.', '#f0a83c');
  }

  serialize() {
    return { defeated: [...this.defeated] };
  }
}
