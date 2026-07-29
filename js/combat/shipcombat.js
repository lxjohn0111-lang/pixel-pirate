// Naval combat system: manages AI ships, cannonball projectiles and
// floating loot drops. The player fires broadsides with Space (or the
// HUD fire button); balls have real travel time, arc over the water and
// throw splinters on impact. Destroyed ships sink and spill loot that
// can be scooped by sailing over it.

import { TAU, clamp, angleDiff, dist2 } from '../util/math.js';
import { AIShip } from '../entities/aiship.js';
import { CLANS, CLAN_IDS } from '../world/clans.js';
import { rollLoot, bestRarity, RARITY } from '../items/itemdefs.js';
import { mulberry32 } from '../util/random.js';
import { chestSprite, crateSprite } from '../render/sprites.js';

const BALL_SPEED = 175;
const SPAWN_RADIUS = 640;
const DESPAWN_RADIUS = 1100;

export class ShipCombat {
  constructor(game) {
    this.game = game;
    this.ships = [];
    this.balls = [];
    this.drops = []; // floating loot from sunk ships
    this._spawnTimer = 3;
    this._sunkCleanup = [];

    game.events.on('ship:sunk', (e) => {
      if (e.byPlayer) {
        const xp = { fishing: 8, civilian: 14, merchant: 22, pirate: 35, navy: 50 }[e.type] ?? 20;
        game.player.addXp(xp + game.tierAt(e.x, e.y) * 10);
      }
    });
  }

  /** Difficulty tier grows away from the spawn — the far seas are dangerous. */
  targetCounts() {
    const t = this.game.tierAt(this.game.ship.x, this.game.ship.y);
    const mod = this.game.daily?.modifier ?? {};
    return {
      fishing: 1,
      civilian: 1,
      merchant: 1,
      pirate: 1 + (t >= 2 ? 1 : 0) + (mod.pirates ? 1 : 0),
      navy: (t >= 1 ? 1 : 0) + (mod.navy ? 1 : 0),
    };
  }

  update(dt) {
    const { game } = this;
    const { ship, input } = game;

    // ---- player broadsides -----------------------------------------------
    if (input.pressed('Space') && game.state === 'playing') this.playerFire();

    // ---- AI ships -----------------------------------------------------------
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const s = this.ships[i];
      s.update(dt, game, this);
      if (s.state === 'gone') {
        this.spawnDrops(s);
        this.ships.splice(i, 1);
        continue;
      }
      if (Math.hypot(s.x - ship.x, s.y - ship.y) > DESPAWN_RADIUS) this.ships.splice(i, 1);
    }

    // ---- spawner --------------------------------------------------------------
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnTimer = 2.5;
      const targets = this.targetCounts();
      const counts = {};
      for (const s of this.ships) counts[s.type] = (counts[s.type] || 0) + 1;
      for (const [type, target] of Object.entries(targets)) {
        if ((counts[type] || 0) < target && Math.random() < 0.4) {
          this._spawn(type);
          break;
        }
      }
    }

    // ---- cannonballs ---------------------------------------------------------
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let done = b.t >= b.life;

      // Hit tests against ships (skip the shooter). The ball only
      // connects in the lower half of its arc.
      if (!done && b.t / b.life > 0.25) {
        if (b.from !== 'player') {
          if (dist2(b.x, b.y, ship.x, ship.y) < 20 * 20) {
            game.shipState.damage(b.damage, Math.random() < 0.4 ? 6 : 0);
            game.particles.burstSplinters(b.x, b.y, 8);
            game.camera.addShake(2.5);
            game.events.emit('sfx', 'woodhit');
            done = true;
          }
        }
        // Legendary creatures (Part 3) get first refusal on player shots.
        // A boss shares the water with whatever else is sailing, and a
        // world event can park four hulls on top of it — testing ships
        // first meant the chaff soaked the entire broadside and the beast
        // sat untouched at point-blank range.
        if (!done && b.from === 'player' && game.legends?.hitTest(b)) {
          game.events.emit('cannon:hit');
          done = true;
        }
        if (!done) {
          for (const s of this.ships) {
            if (s.id === b.from || s.state !== 'sailing') continue;
            if (dist2(b.x, b.y, s.x, s.y) < 24 * 24) {
              const attacker = b.from === 'player' ? game.ship : this.ships.find((o) => o.id === b.from);
              const sank = s.takeDamage(b.damage, game, b.from === 'player', attacker);
              game.particles.burstSplinters(b.x, b.y, 8);
              game.events.emit('sfx', 'woodhit');
              if (b.from === 'player') {
                game.events.emit('cannon:hit');
                game.particles.spawnText(b.x, b.y - 10, `${b.damage}`, '#f0a83c');
                if (sank) game.events.emit('sfx', 'sink');
              }
              done = true;
              break;
            }
          }
        }
      }

      if (done) {
        if (b.t >= b.life) {
          // splash-down miss
          game.particles.burstSplash(b.x, b.y, 5);
          game.events.emit('sfx', 'splash');
        }
        this.balls.splice(i, 1);
      }
    }

    // ---- floating loot drops -----------------------------------------------
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      const dd = Math.hypot(d.x - ship.x, d.y - ship.y);
      if (dd < 80) {
        // magnet drift
        d.x += (ship.x - d.x) * dt * 3;
        d.y += (ship.y - d.y) * dt * 3;
      }
      if (dd < 26) {
        this.drops.splice(i, 1);
        game.grantLoot(d.loot, d.x, d.y);
      } else if (d.age > 90 || dd > DESPAWN_RADIUS) {
        this.drops.splice(i, 1);
      }
    }
  }

  playerFire() {
    const { game } = this;
    const { ship, shipState, inventory } = game;
    if (!shipState.canFire) return;
    const shots = shipState.cannonsPerSide;
    const ammo = inventory.totalCount('cannonball');
    if (ammo <= 0) {
      game.hud.toast('Out of cannonballs!', '#e05a4a');
      game.events.emit('sfx', 'click');
      return;
    }

    // Fire toward the nearest hostile-ish ship; default to starboard.
    let side = 1;
    let target = null;
    let bestD = 300 * 300;
    for (const s of this.ships) {
      if (s.state !== 'sailing') continue;
      const d2 = dist2(s.x, s.y, ship.x, ship.y);
      if (d2 < bestD) {
        bestD = d2;
        target = s;
      }
    }
    // A surfaced legend outranks every other target. nearestTarget already
    // gates on its own range, so if it answers, the beast is on top of you
    // — and during a world event there is always some blockade sloop nearer
    // than the kraken, which would otherwise walk your broadside off the
    // boss and make the fight unwinnable through no fault of the player.
    const legendAim = game.legends?.nearestTarget?.(ship.x, ship.y);
    if (legendAim) {
      target = { x: legendAim.x, y: legendAim.y, heading: 0, speed: 0 };
    }
    if (target) {
      side = angleDiff(ship.heading, Math.atan2(target.y - ship.y, target.x - ship.x)) > 0 ? 1 : -1;
    }

    const n = Math.min(shots, ammo);
    inventory.removeAnywhere('cannonball', n);
    shipState.didFire();

    const crewBonus = game.crew.bonuses().cannon;
    const dmg = Math.round(shipState.cannonDamage * (1 + crewBonus));
    const perp = ship.heading + (Math.PI / 2) * side;
    for (let i = 0; i < n; i++) {
      const along = (i - (n - 1) / 2) * 10;
      const sx = ship.x + Math.cos(ship.heading) * along + Math.cos(perp) * 10;
      const sy = ship.y + Math.sin(ship.heading) * along + Math.sin(perp) * 10;
      let aim = perp;
      let range = 220;
      if (target) {
        // Lead the shot by (most of) its flight time — circling targets
        // curve back toward their current position, so a full linear
        // lead overshoots.
        const lead = (Math.hypot(target.x - sx, target.y - sy) / BALL_SPEED) * 0.6;
        const tx = target.x + Math.cos(target.heading) * target.speed * lead;
        const ty = target.y + Math.sin(target.heading) * target.speed * lead;
        const want = Math.atan2(ty - sy, tx - sx);
        // Cannons can only traverse so far from the broadside.
        aim = perp + clamp(angleDiff(perp, want), -0.65, 0.65);
        range = clamp(Math.hypot(tx - sx, ty - sy) + 14, 60, 270);
      }
      aim += (Math.random() - 0.5) * 0.06;
      this._spawnBall('player', sx, sy, aim, range, dmg);
      game.particles.spawnSmoke(sx, sy, true, this.playerMuzzleTint());
    }
    game.camera.addShake(1.6);
    game.events.emit('sfx', 'cannon');
    game.events.emit('playership:fired', { count: n });
  }

  /** AI broadside toward a point. */
  fireBroadside(aiShip, tx, ty) {
    const n = aiShip.cannons;
    for (let i = 0; i < n; i++) {
      const along = (i - (n - 1) / 2) * 10;
      const sx = aiShip.x + Math.cos(aiShip.heading) * along;
      const sy = aiShip.y + Math.sin(aiShip.heading) * along;
      const aim = Math.atan2(ty - sy, tx - sx) + (Math.random() - 0.5) * 0.22;
      const range = clamp(Math.hypot(tx - sx, ty - sy) + (Math.random() - 0.4) * 50, 60, 280);
      this._spawnBall(aiShip.id, sx, sy, aim, range, aiShip.cannonDamage);
      this.game.particles.spawnSmoke(sx, sy, true);
    }
    this.game.events.emit('sfx', 'cannonFar');
  }

  _spawnBall(from, x, y, angle, range, damage) {
    this.balls.push({
      from, x, y,
      vx: Math.cos(angle) * BALL_SPEED,
      vy: Math.sin(angle) * BALL_SPEED,
      t: 0,
      life: range / BALL_SPEED,
      damage,
    });
  }

  /** A merchant under fire dumps a crate overboard. */
  jettisonCargo(aiShip) {
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    this.drops.push({
      x: aiShip.x - Math.cos(aiShip.heading) * 24,
      y: aiShip.y - Math.sin(aiShip.heading) * 24,
      kind: 'crate',
      age: 0,
      loot: rollLoot(rng, 'crate', this.game.player.luck),
    });
  }

  /** Sunken ships leave their cargo bobbing on the surface. */
  spawnDrops(aiShip) {
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    const n = { fishing: 1, civilian: 2, merchant: 3, pirate: 2, navy: 3 }[aiShip.type] ?? 2;
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU;
      const d = 8 + rng() * 26;
      this.drops.push({
        x: aiShip.x + Math.cos(a) * d,
        y: aiShip.y + Math.sin(a) * d,
        kind: i === 0 ? 'chest' : 'crate',
        age: 0,
        loot: rollLoot(rng, aiShip.lootTable, this.game.player.luck + this.game.crew.bonuses().luck),
      });
    }
  }

  /** Nearest boardable ship within range, or null. */
  boardingTarget() {
    const { ship } = this.game;
    for (const s of this.ships) {
      if (!s.boardable) continue;
      if (dist2(s.x, s.y, ship.x, ship.y) < 62 * 62 && Math.abs(this.game.ship.speed) < 60) return s;
    }
    return null;
  }

  removeShip(id) {
    const i = this.ships.findIndex((s) => s.id === id);
    if (i >= 0) this.ships.splice(i, 1);
  }

  /** The fitted cannon effect, as an "r,g,b" string for the particles. */
  playerMuzzleTint() {
    const fx = this.game.cosmeticsDefs?.CANNON_FX?.[this.game.cosmetics?.equipped?.cannonfx];
    return fx?.color ? fx.color.join(',') : null;
  }

  _spawn(type) {
    const { ship, world, clans } = this.game;
    const a = Math.random() * TAU;
    const d = SPAWN_RADIUS + Math.random() * 220;
    const x = ship.x + Math.cos(a) * d;
    const y = ship.y + Math.sin(a) * d;
    if (!world.isOpenWater(x, y)) return null;
    const s = new AIShip(type, x, y, this.game.tierAt(x, y));
    this.assignClan(s, x, y);
    this.ships.push(s);
    // Merchants sometimes sail as convoys with a sloop in trail.
    if (type === 'merchant' && Math.random() < 0.35 && this.ships.length < 9) {
      const escort = new AIShip('civilian', x - 60, y + 20, this.game.tierAt(x, y));
      escort.convoyLeader = s;
      escort.convoyOffset = (Math.random() - 0.5) * 60;
      // An escort flies its charge's colours.
      escort.clanId = s.clanId;
      escort.hostileToPlayer = s.hostileToPlayer;
      this.ships.push(escort);
      this.game.collection?.discover('ships', 'convoy');
    }
    return s;
  }

  /**
   * Give a ship its colours. Whoever holds these waters usually owns the
   * hull sailing through them, but a clan whose ship types do not match
   * yields to one whose do — a Tideborn ghost ship in Goldwake waters
   * still reads as Tideborn, which is what makes borders feel porous.
   */
  assignClan(s, x, y) {
    const { clans } = this.game;
    if (!clans) return;
    const local = clans.ownerOfRegion(x, y);
    let owner = local;
    if (!CLANS[local]?.shipTypes.includes(s.type)) {
      const fits = CLAN_IDS.filter((id) => CLANS[id].shipTypes.includes(s.type));
      // Prefer a clan that actually sails this kind of hull; fall back to
      // the local power so every ship still belongs to somebody.
      if (fits.length && Math.random() < 0.75) {
        fits.sort((a, b) => clans.strength[b] - clans.strength[a]);
        owner = fits[(Math.random() * Math.min(2, fits.length)) | 0];
      }
    }
    s.clanId = owner;
    // Standing decides the greeting. A clan that hunts you needs no
    // provocation; one that is sworn to you will not raise a gun.
    if (clans.isHunting(owner)) s.hostileToPlayer = s.cannons > 0;
    else if (clans.isHostile(owner)) s.hostileToPlayer = s.cannons > 0 && Math.random() < 0.7;
    else if (clans.isFriendly(owner)) s.hostileToPlayer = false;
    if (clans.isHostile(owner) && s.cannons === 0) s.fleeing = true;
    this.game.collection?.discover?.('clans', owner);
  }

  /* ---- drawing (hooked into the renderer's layers) -------------------- */

  collectSurfaceDrawables(out, t) {
    for (const s of this.ships) {
      out.push({ y: s.y, draw: (g) => s.draw(g, t) });
    }
    for (const d of this.drops) {
      out.push({
        y: d.y,
        draw: (g) => {
          const spr = d.kind === 'chest' ? chestSprite() : crateSprite();
          const bob = Math.sin(t * 1.8 + d.x) * 1.5;
          const rar = RARITY[bestRarity(d.loot)];
          if (rar.glow) {
            g.fillStyle = `rgba(${hexRgb(rar.glow)},${0.2 + Math.sin(t * 4) * 0.1})`;
            g.beginPath();
            g.arc(Math.round(d.x), Math.round(d.y + bob), 10, 0, TAU);
            g.fill();
          }
          g.drawImage(spr, Math.round(d.x - spr.width / 2), Math.round(d.y - spr.height / 2 + bob));
        },
      });
    }
  }

  drawProjectiles(g, t) {
    for (const b of this.balls) {
      const arc = Math.sin((b.t / b.life) * Math.PI) * 9;
      // shadow on the water
      g.fillStyle = 'rgba(8,20,40,0.3)';
      g.fillRect(Math.round(b.x - 1), Math.round(b.y - 1), 2, 2);
      // ball in flight
      g.fillStyle = '#26262e';
      g.beginPath();
      g.arc(Math.round(b.x), Math.round(b.y - arc), 1.6, 0, TAU);
      g.fill();
    }
  }
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
