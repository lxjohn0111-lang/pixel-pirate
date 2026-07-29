// Boarding combat: when ships lie hull-to-hull, the fight moves to the
// enemy deck. Top-down real-time skirmish — the captain (WASD + mouse,
// or joystick) fights beside the crew, who battle on their own. Losing
// crew here is permanent. Winning opens the enemy hold.
//
// Deck space: local coordinates centered on the enemy deck; the scene
// is rendered instead of the world while active (same backbuffer, same
// pixel scale, same particle system — cleared on entry and exit).

import { TAU, clamp, dist2 } from '../util/math.js';
import { buildMiniCaptain, randomAppearance } from '../render/pirate.js';
import { ITEMS } from '../items/itemdefs.js';

const DECK = { x0: -104, x1: 104, y0: -46, y1: 46 };

export class Boarding {
  constructor(game) {
    this.game = game;
    this.active = false;
  }

  start(aiShip) {
    const { game } = this;
    this.aiShip = aiShip;
    this.active = true;
    this.timer = 0;
    this.banner = 1.1;
    this.outcome = null;
    this.endTimer = 0;
    this.actors = [];
    this.effects = []; // swing arcs, tracers
    game.particles.above.length = 0;
    game.particles.below.length = 0;
    game.particles.texts.length = 0;

    // Player fights from the left side.
    const p = game.player;
    this.player = this._actor({
      kind: 'player',
      x: DECK.x0 + 16,
      y: 0,
      hp: p.health,
      maxHp: p.maxHealth,
      speed: p.speed,
      sprite: buildMiniCaptain(game.appearance),
    });
    this.actors.push(this.player);

    // Crew boards alongside.
    game.crew.members.forEach((m, i) => {
      this.actors.push(this._actor({
        kind: 'ally',
        member: m,
        x: DECK.x0 + 10,
        y: -30 + i * (60 / Math.max(1, game.crew.members.length - 1) || 1),
        hp: m.health,
        maxHp: m.maxHealth,
        speed: 52,
        damage: game.crew.meleeDamage(m),
        shooter: ITEMS[m.weapon]?.slot !== 'sword',
        sprite: buildMiniCaptain(m.appearance),
      }));
    });

    // Defenders muster on the right.
    const lvl = 1 + aiShip.tier;
    for (let i = 0; i < aiShip.crewCount; i++) {
      const shooter = Math.random() < 0.3;
      game.collection?.discover('foes', shooter ? 'marksman' : 'brawler');
      this.actors.push(this._actor({
        kind: 'enemy',
        x: DECK.x1 - 14 - Math.random() * 30,
        y: DECK.y0 + 10 + Math.random() * (DECK.y1 - DECK.y0 - 20),
        hp: 26 + lvl * 13,
        maxHp: 26 + lvl * 13,
        speed: 40 + Math.random() * 14,
        damage: 4 + lvl * 2,
        shooter,
        sprite: buildMiniCaptain(randomAppearance()),
      }));
    }

    this.pistolCd = 0;
    this.musketCd = 0;
    this.swordCd = 0;
    this.dashCd = 0;
    this.dashT = 0;
    game.hud.hidePrompt();
    game.events.emit('sfx', 'boarding');
    game.events.emit('boarding:start');
  }

  _actor(props) {
    return {
      facing: props.kind === 'enemy' ? -1 : 1,
      kx: 0, ky: 0, // knockback velocity
      attackCd: 1 + Math.random(),
      hitFlash: 0,
      dead: false,
      deathT: 0,
      ...props,
    };
  }

  /* ------------------------------------------------------------------ */

  update(dt) {
    this.timer += dt;
    if (this.banner > 0) {
      this.banner -= dt;
      return;
    }
    if (this.outcome) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this._finish();
      return;
    }
    this._updateCombat(dt);
    this._checkOutcome();
  }

  /** Shared actor simulation (also used by dungeons). */
  _updateCombat(dt) {
    const { game } = this;
    this._updatePlayer(dt);
    for (const a of this.actors) {
      if (a === this.player) continue;
      this._updateNpc(a, dt);
    }
    // shared physics: knockback, clamping, death fade
    const b = this.bounds ?? DECK;
    for (const a of this.actors) {
      a.x = clamp(a.x + a.kx * dt, b.x0 + 4, b.x1 - 4);
      a.y = clamp(a.y + a.ky * dt, b.y0 + 4, b.y1 - 4);
      const k = Math.exp(-8 * dt);
      a.kx *= k;
      a.ky *= k;
      a.hitFlash = Math.max(0, a.hitFlash - dt * 5);
      if (a.dead) a.deathT += dt;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].t -= dt;
      if (this.effects[i].t <= 0) this.effects.splice(i, 1);
    }
    game.particles.update(dt);
  }

  /** Win/lose evaluation — overridable (dungeons chain rooms). */
  _checkOutcome() {
    const enemiesLeft = this.actors.some((a) => a.kind === 'enemy' && !a.dead);
    if (!enemiesLeft) {
      this.outcome = 'win';
      this.endTimer = 1.2;
      this.game.events.emit('sfx', 'victory');
    } else if (this.player.dead) {
      this.outcome = 'loss';
      this.endTimer = 1.6;
    }
  }

  _updatePlayer(dt) {
    const { game } = this;
    const { input } = game;
    const p = this.player;
    if (p.dead) return;

    // movement
    let mx = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
    let my = (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0) - (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0);
    if (input.headingTarget !== null) {
      mx = Math.cos(input.headingTarget) * input.throttle;
      my = Math.sin(input.headingTarget) * input.throttle;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }

    // dash: brief burst of speed + i-frames
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.dashT = Math.max(0, this.dashT - dt);
    if (input.pressed('ShiftLeft') || input.pressed('ShiftRight') || input.pressed('DashBtn')) {
      if (this.dashCd <= 0 && len > 0.1) {
        this.dashT = 0.16;
        this.dashCd = 1.1;
        game.events.emit('sfx', 'dash');
      }
    }
    const speed = p.speed * (this.dashT > 0 ? 3.2 : 1);
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    if (Math.abs(mx) > 0.05) p.facing = mx > 0 ? 1 : -1;

    // aim: pointer if available, else movement/facing
    const aim = this._aimAngle(p, mx, my, len);

    // sword
    this.swordCd = Math.max(0, this.swordCd - dt);
    if ((input.consumeClick() || input.pressed('KeyJ') || input.pressed('SwordBtn')) && this.swordCd <= 0) {
      this.swordCd = 0.42;
      this._swing(p, aim, game.player.attack, 'player');
    }
    // pistol
    const reloadMult = 1 / (1 + game.player.reloadSpeed / 100);
    this.pistolCd = Math.max(0, this.pistolCd - dt);
    if ((input.pressed('KeyK') || input.pressed('PistolBtn')) && this.pistolCd <= 0) {
      if (!game.inventory.equipment.pistol) game.hud.toast('No pistol equipped', '#e0b345');
      else if (game.inventory.totalCount('bullets') < 1) game.hud.toast('No shot left!', '#e05a4a');
      else {
        this.pistolCd = 1.6 * reloadMult;
        game.inventory.removeAnywhere('bullets', 1);
        this._shoot(p, aim, Math.round(game.player.attack * 1.25), 85, 'player');
        game.events.emit('sfx', 'pistol');
      }
    }
    // musket
    this.musketCd = Math.max(0, this.musketCd - dt);
    if ((input.pressed('KeyL') || input.pressed('MusketBtn')) && this.musketCd <= 0) {
      if (!game.inventory.equipment.musket) game.hud.toast('No musket equipped', '#e0b345');
      else if (game.inventory.totalCount('bullets') < 1) game.hud.toast('No shot left!', '#e05a4a');
      else {
        this.musketCd = 3 * reloadMult;
        game.inventory.removeAnywhere('bullets', 1);
        this._shoot(p, aim, Math.round(game.player.attack * 2.1), 200, 'player');
        game.events.emit('sfx', 'musket');
      }
    }
  }

  _aimAngle(p, mx, my, len) {
    const { game } = this;
    if (!('ontouchstart' in window)) {
      // convert pointer to deck coords
      const r = game.renderer;
      const scale = r.blitScale();
      const dx = (game.input.pointerX - r.canvas.width / 2) / scale - p.x;
      const dy = (game.input.pointerY - r.canvas.height / 2) / scale - p.y;
      if (Math.hypot(dx, dy) > 3) return Math.atan2(dy, dx);
    }
    if (len > 0.1) return Math.atan2(my, mx);
    return p.facing > 0 ? 0 : Math.PI;
  }

  _updateNpc(a, dt) {
    if (a.dead) return;
    const foes = this.actors.filter((o) => !o.dead && (a.kind === 'enemy' ? o.kind !== 'enemy' : o.kind === 'enemy'));
    if (!foes.length) return;
    let target = foes[0];
    let best = Infinity;
    for (const f of foes) {
      const d = dist2(a.x, a.y, f.x, f.y);
      if (d < best) {
        best = d;
        target = f;
      }
    }
    const d = Math.sqrt(best);
    const dx = (target.x - a.x) / (d || 1);
    const dy = (target.y - a.y) / (d || 1);

    // cowards break at low health
    const cowardly = a.member?.traits.includes('coward') && !a.member?.traits.includes('fearless');
    if (cowardly && a.hp < a.maxHp * 0.3) {
      a.x -= dx * a.speed * dt;
      a.y -= dy * a.speed * dt;
      return;
    }

    const wantDist = a.shooter ? 58 : 12;
    if (d > wantDist) {
      a.x += dx * a.speed * dt;
      a.y += dy * a.speed * dt;
    } else if (a.shooter && d < 36) {
      a.x -= dx * a.speed * 0.7 * dt;
      a.y -= dy * a.speed * 0.7 * dt;
    }
    // slight strafe keeps fights lively
    a.y += Math.sin(this.timer * 2 + a.x) * 6 * dt;
    if (Math.abs(dx) > 0.05) a.facing = dx > 0 ? 1 : -1;

    a.attackCd -= dt;
    if (a.attackCd <= 0 && d < (a.shooter ? 90 : 16)) {
      a.attackCd = a.shooter ? 2.2 + Math.random() : 0.85 + Math.random() * 0.3;
      const aim = Math.atan2(target.y - a.y, target.x - a.x);
      if (a.shooter) {
        this._shoot(a, aim, a.damage + 2, 100, a.kind);
        this.game.events.emit('sfx', 'pistolFar');
      } else {
        this._swing(a, aim, a.damage, a.kind);
      }
    }
  }

  /* ---- attacks -------------------------------------------------------- */

  _swing(attacker, aim, damage, side) {
    this.effects.push({ kind: 'swing', x: attacker.x, y: attacker.y, a: aim, t: 0.14, max: 0.14 });
    this.game.events.emit('sfx', 'swing');
    for (const target of this.actors) {
      if (target.dead || target === attacker) continue;
      const hostile = side === 'enemy' ? target.kind !== 'enemy' : target.kind === 'enemy';
      if (!hostile) continue;
      const d = Math.hypot(target.x - attacker.x, target.y - attacker.y);
      if (d > 22) continue;
      const ang = Math.atan2(target.y - attacker.y, target.x - attacker.x);
      let diff = Math.abs(ang - aim);
      if (diff > Math.PI) diff = TAU - diff;
      if (diff < 1.1) this._hit(target, damage, ang, side);
    }
  }

  _shoot(attacker, aim, damage, range, side) {
    // instant tracer with a small cone of forgiveness
    let best = null;
    let bestD = range;
    for (const target of this.actors) {
      if (target.dead || target === attacker) continue;
      const hostile = side === 'enemy' ? target.kind !== 'enemy' : target.kind === 'enemy';
      if (!hostile) continue;
      const d = Math.hypot(target.x - attacker.x, target.y - attacker.y);
      if (d > range) continue;
      const ang = Math.atan2(target.y - attacker.y, target.x - attacker.x);
      let diff = Math.abs(ang - aim);
      if (diff > Math.PI) diff = TAU - diff;
      if (diff < 0.3 && d < bestD) {
        best = target;
        bestD = d;
      }
    }
    const ex = attacker.x + Math.cos(aim) * (best ? bestD : range);
    const ey = attacker.y + Math.sin(aim) * (best ? bestD : range);
    this.effects.push({ kind: 'tracer', x0: attacker.x, y0: attacker.y - 4, x1: ex, y1: ey - 4, t: 0.09, max: 0.09 });
    this.game.particles.spawnSmoke(attacker.x + Math.cos(aim) * 6, attacker.y - 4);
    if (best) this._hit(best, damage, aim, side);
  }

  _hit(target, damage, angle, side) {
    const { game } = this;
    let dmg = damage;
    let crit = false;
    if (side === 'player' && Math.random() * 100 < game.player.critChance) {
      dmg = Math.round(dmg * 2);
      crit = true;
    }
    if (target === this.player) {
      if (this.dashT > 0) return; // dodged!
      dmg = game.player.hurt(dmg);
      game.camera.addShake(1.5);
    } else {
      target.hp -= dmg;
    }
    target.hitFlash = 1;
    target.kx += Math.cos(angle) * 90;
    target.ky += Math.sin(angle) * 90;
    game.particles.burstBlood(target.x, target.y - 4, 4);
    game.particles.spawnText(target.x, target.y - 14, crit ? `${dmg}!` : `${dmg}`, crit ? '#f05a78' : target === this.player ? '#e05a4a' : '#e8ddc4');
    game.events.emit('sfx', crit ? 'crit' : 'hit');

    if (target !== this.player && target.hp <= 0 && !target.dead) {
      target.dead = true;
      game.events.emit('sfx', 'death');
      if (target.kind === 'enemy') {
        game.player.addXp(6 + (1 + this.aiShip.tier) * 4);
      } else if (target.member) {
        game.crew.kill(target.member.id);
        game.hud.toast(`${target.member.name} was slain!`, '#e05a4a');
      }
    }
    if (target === this.player && game.player.health <= 0) {
      this.player.dead = true;
    }
  }

  /* ---- resolution ---------------------------------------------------------- */

  _finish() {
    const { game } = this;
    this.active = false;
    // surviving crew keep their wounds
    for (const a of this.actors) {
      if (a.kind === 'ally' && a.member && !a.dead) {
        a.member.health = Math.max(1, Math.round(a.hp));
      }
    }
    game.particles.above.length = 0;
    game.particles.texts.length = 0;
    if (this.outcome === 'win') {
      game.crew.afterBattle();
      game.onBoardingWin(this.aiShip);
    } else {
      game.onBoardingLoss(this.aiShip);
    }
    game.events.emit('boarding:end', { outcome: this.outcome, ship: this.aiShip });
  }

  /* ---- rendering -------------------------------------------------------------- */

  draw(g, bufW, bufH, t) {
    const { game } = this;
    g.save();
    g.translate(Math.round(bufW / 2), Math.round(bufH / 2));

    // sea backdrop
    const s = game.dayNight.snapshot;
    g.fillStyle = `rgb(${s.deep[0] | 0},${s.deep[1] | 0},${s.deep[2] | 0})`;
    g.fillRect(-bufW / 2, -bufH / 2, bufW, bufH);
    g.fillStyle = `rgba(${s.hi[0] | 0},${s.hi[1] | 0},${s.hi[2] | 0},0.5)`;
    for (let i = 0; i < 14; i++) {
      const wx = ((i * 97 + t * 20) % bufW) - bufW / 2;
      const wy = ((i * 61) % bufH) - bufH / 2;
      g.fillRect(Math.round(wx), Math.round(wy), 6, 1);
    }

    // enemy deck
    this._drawDeck(g);

    // the player's ship nudged against the port side
    g.fillStyle = '#8a5a34';
    g.fillRect(DECK.x0 - 26, -30, 22, 60);
    g.fillStyle = '#b98a55';
    g.fillRect(DECK.x0 - 24, -28, 18, 56);
    g.fillStyle = '#5e3c22';
    for (let y = -28; y < 28; y += 6) g.fillRect(DECK.x0 - 24, y, 18, 1);
    // boarding plank
    g.fillStyle = '#96703f';
    g.fillRect(DECK.x0 - 8, -5, 14, 10);
    g.fillStyle = '#5a3a20';
    g.fillRect(DECK.x0 - 8, -5, 14, 1);
    g.fillRect(DECK.x0 - 8, 4, 14, 1);

    // actors, y-sorted
    const sorted = [...this.actors].sort((a, b) => a.y - b.y);
    for (const a of sorted) this._drawActor(g, a);

    // effects
    for (const e of this.effects) {
      const k = e.t / e.max;
      if (e.kind === 'swing') {
        g.strokeStyle = `rgba(240,240,250,${k})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(e.x, e.y - 4, 14, e.a - 0.9 + (1 - k) * 0.9, e.a + 0.9 - 0 * k);
        g.stroke();
      } else if (e.kind === 'tracer') {
        g.strokeStyle = `rgba(255,230,160,${k})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(e.x0, e.y0);
        g.lineTo(e.x1, e.y1);
        g.stroke();
      }
    }

    game.particles.drawLayer(g, 'above');
    game.particles.drawTexts(g);
    g.restore();

    // banner
    if (this.banner > 0 || this.outcome) {
      const text = this.banner > 0 ? 'BOARDING!' : this.outcome === 'win' ? 'DECK CLEARED!' : 'DRIVEN BACK...';
      const color = this.outcome === 'loss' ? '#e05a4a' : '#f0d090';
      g.fillStyle = 'rgba(8,12,24,0.55)';
      g.fillRect(0, bufH / 2 - 16, bufW, 30);
      g.font = 'bold 14px monospace';
      g.textAlign = 'center';
      g.fillStyle = color;
      g.fillText(text, bufW / 2, bufH / 2 + 4);
      g.textAlign = 'left';
    }
  }

  _drawDeck(g) {
    const w = DECK.x1 - DECK.x0;
    const h = DECK.y1 - DECK.y0;
    // hull silhouette around the deck
    g.fillStyle = '#4a3624';
    g.fillRect(DECK.x0 - 6, DECK.y0 - 6, w + 12, h + 12);
    g.fillStyle = '#5e4630';
    g.fillRect(DECK.x0 - 6, DECK.y0 - 6, w + 12, h + 8);
    // planks
    for (let y = DECK.y0; y < DECK.y1; y += 6) {
      g.fillStyle = ((y / 6) | 0) % 2 ? '#8a6f4a' : '#96784f';
      g.fillRect(DECK.x0, y, w, 6);
      g.fillStyle = '#5e4630';
      g.fillRect(DECK.x0, y, w, 1);
    }
    // rails
    g.fillStyle = '#3a2b1e';
    g.fillRect(DECK.x0, DECK.y0 - 3, w, 3);
    g.fillRect(DECK.x0, DECK.y1, w, 3);
    // mast + hatch + props
    g.fillStyle = '#3a2b1e';
    g.beginPath();
    g.arc(20, 0, 4, 0, TAU);
    g.fill();
    g.fillStyle = '#42332a';
    g.fillRect(-30, -10, 16, 12);
    g.fillStyle = '#5e4630';
    g.fillRect(-29, -9, 14, 10);
    g.fillStyle = '#7a5a34'; // barrels
    g.fillRect(60, -34, 8, 8);
    g.fillRect(70, -30, 8, 8);
    g.fillStyle = '#4a4a52';
    g.fillRect(62, -34, 1, 8);
    g.fillRect(72, -30, 1, 8);
  }

  _drawActor(g, a) {
    const alpha = a.dead ? Math.max(0, 1 - a.deathT / 1.2) : 1;
    if (alpha <= 0) return;
    const w = a.isGuardian ? 16 : 8;
    const h = a.isGuardian ? 20 : 11;
    g.save();
    g.globalAlpha = alpha;
    g.translate(Math.round(a.x), Math.round(a.y));
    // shadow
    g.fillStyle = 'rgba(20,14,8,0.3)';
    g.fillRect(-w / 2, -1, w, 2);
    const bob = a.dead ? 0 : Math.round(Math.sin(this.timer * 8 + a.x) * 0.5);
    g.save();
    if (a.dead) {
      g.rotate(Math.PI / 2);
      g.translate(-4, 2);
    }
    if (a.facing < 0) g.scale(-1, 1);
    g.drawImage(a.sprite, -w / 2, -h + bob, w, h);
    g.restore();
    // hit flash
    if (a.hitFlash > 0.4) {
      g.globalAlpha = alpha * (a.hitFlash - 0.4);
      g.fillStyle = '#ffffff';
      g.fillRect(-w / 2, -h, w, h);
    }
    g.globalAlpha = alpha;
    // health bar (not for the player: HUD shows theirs)
    if (!a.dead && a.kind !== 'player' && a.hp < a.maxHp) {
      const frac = clamp(a.hp / a.maxHp, 0, 1);
      g.fillStyle = 'rgba(10,16,30,0.7)';
      g.fillRect(-6, -15, 12, 2);
      g.fillStyle = a.kind === 'ally' ? '#6fce62' : '#e05a4a';
      g.fillRect(-6, -15, Math.round(12 * frac), 2);
    }
    // dash ghost
    if (a === this.player && this.dashT > 0) {
      g.globalAlpha = 0.4;
      g.fillStyle = '#bcd6f0';
      g.fillRect(-5, -12, 10, 13);
    }
    g.restore();
    g.globalAlpha = 1;
  }
}
