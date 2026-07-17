// Island dungeons: temples, sea caves, volcano depths, sunken ruins and
// pirate hideouts. Built on the boarding combat engine — a chain of
// procedurally furnished rooms with traps, foes, an occasional Ancient
// Guardian, and a treasure vault with hidden lore at the end.
//
// Entrances are deterministic shoreline encounters (generated in
// encounters.js); a cleared dungeon stays cleared forever.

import { Boarding } from '../combat/boarding.js';
import { dist2, TAU } from '../util/math.js';
import { mulberry32, pick, rangeInt } from '../util/random.js';
import { rollLoot } from '../items/itemdefs.js';
import { makeCanvas } from '../render/sprites.js';

const ROOM = { x0: -110, x1: 110, y0: -52, y1: 52 };

export const DUNGEON_THEMES = {
  temple:  { name: 'Ancient Temple', floor: '#8a8272', floorAlt: '#7a7264', wall: '#5a5448', hazard: 'spikes', foes: ['skeleton', 'cultist'], guardian: true },
  cave:    { name: 'Sea Cave', floor: '#5a5e66', floorAlt: '#50545c', wall: '#3a3e46', hazard: 'spikes', foes: ['skeleton', 'brawlerNpc'], guardian: false },
  volcano: { name: 'Volcano Depths', floor: '#5e4640', floorAlt: '#544038', wall: '#3a2c28', hazard: 'lava', foes: ['cultist', 'skeleton'], guardian: false },
  ruins:   { name: 'Sunken Ruins', floor: '#647a76', floorAlt: '#5a706c', wall: '#42524e', hazard: 'water', foes: ['skeleton', 'cultist'], guardian: true },
  hideout: { name: 'Pirate Hideout', floor: '#8a6f4a', floorAlt: '#7e6542', wall: '#54432c', hazard: 'spikes', foes: ['brawlerNpc', 'marksmanNpc'], guardian: false },
};

const FOE_STATS = {
  skeleton:    { hp: 22, dmg: 5, speed: 44, shooter: false, collect: 'skeleton' },
  cultist:     { hp: 28, dmg: 6, speed: 38, shooter: true, collect: 'cultist' },
  brawlerNpc:  { hp: 30, dmg: 6, speed: 46, shooter: false, collect: 'brawler' },
  marksmanNpc: { hp: 22, dmg: 7, speed: 40, shooter: true, collect: 'marksman' },
};

const LORE = [
  '"We built the vault below the tide line. The sea was meant to guard it. The sea kept it."',
  '"Day 40: the idols sing at low tide. The captain forbids us to listen. He listens the longest."',
  '"The kingdom did not drown. It descended. There is a difference, and it matters to them."',
  '"Whoever reads this: the gold is cursed, the rum is fine. Prioritize accordingly."',
  '"The Guardian does not sleep. It waits. There is a difference, and it matters to you."',
];

/** Small pixel sprites for dungeon foes & the guardian. */
function foeSprite(kind) {
  const c = makeCanvas(8, 11);
  const g = c.getContext('2d');
  const p = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  if (kind === 'skeleton') {
    p(3, 1, 3, 3, '#e8e4da');
    p(4, 2, 1, 1, '#1e1a22');
    p(2, 4, 5, 4, '#d8d4ca');
    p(3, 5, 3, 1, '#8a8578');
    p(3, 8, 1, 3, '#e8e4da');
    p(5, 8, 1, 3, '#e8e4da');
  } else if (kind === 'cultist') {
    p(2, 1, 5, 9, '#3a2a52');
    p(3, 2, 3, 2, '#14101e');
    p(3, 3, 1, 1, '#4ec9b0');
    p(5, 3, 1, 1, '#4ec9b0');
    p(3, 10, 1, 1, '#2a1e3c');
    p(5, 10, 1, 1, '#2a1e3c');
  } else {
    // hideout humans reuse pirate colors
    p(3, 1, 3, 3, '#cf9d6e');
    p(2, 0, 5, 1, '#8e2f2f');
    p(2, 4, 5, 4, kind === 'marksmanNpc' ? '#3a4e8e' : '#5a4632');
    p(3, 8, 1, 3, '#3a2b20');
    p(5, 8, 1, 3, '#3a2b20');
  }
  return c;
}

function guardianSprite() {
  const c = makeCanvas(16, 20);
  const g = c.getContext('2d');
  const p = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  p(4, 0, 8, 6, '#7a7264'); // head
  p(5, 2, 2, 2, '#4ec9b0'); // glowing eyes
  p(9, 2, 2, 2, '#4ec9b0');
  p(2, 6, 12, 9, '#8a8272'); // torso
  p(4, 8, 8, 2, '#5a5448');
  p(0, 6, 3, 8, '#7a7264'); // arms
  p(13, 6, 3, 8, '#7a7264');
  p(3, 15, 4, 5, '#6a6254'); // legs
  p(9, 15, 4, 5, '#6a6254');
  p(6, 11, 4, 3, '#4ec9b0'); // rune core
  return c;
}

export class Dungeon extends Boarding {
  constructor(game) {
    super(game);
    this.bounds = ROOM;
  }

  /** Enter a dungeon from its shoreline entrance encounter. */
  enter(entrance) {
    const { game } = this;
    this.entrance = entrance;
    this.theme = DUNGEON_THEMES[entrance.theme];
    this.rng = mulberry32(entrance.seed >>> 0);
    this.tier = game.tierAt(entrance.x, entrance.y);
    this.totalRooms = 2 + (this.rng() > 0.5 ? 1 : 0);
    this.roomIndex = 0;
    this.aiShip = { tier: this.tier, label: this.theme.name }; // xp shim
    this.active = true;
    this.timer = 0;
    this.banner = 1.2;
    this.bannerText = this.theme.name.toUpperCase();
    this.outcome = null;
    this.endTimer = 0;
    this.effects = [];
    this.vaultOpened = false;
    game.particles.above.length = 0;
    game.particles.texts.length = 0;

    const p = game.player;
    this.player = this._actor({
      kind: 'player',
      x: ROOM.x0 + 14,
      y: 0,
      hp: p.health,
      maxHp: p.maxHealth,
      speed: p.speed,
      sprite: this._playerSprite ?? (this._playerSprite = this._makePlayerSprite()),
    });
    this.actors = [this.player];
    this._buildRoom();

    this.pistolCd = 0;
    this.musketCd = 0;
    this.swordCd = 0;
    this.dashCd = 0;
    this.dashT = 0;
    game.hud.hidePrompt();
    game.audio.setMusicMode?.('dungeon');
    game.events.emit('sfx', 'dungeon');
    game.events.emit('boarding:start'); // reuse touch combat buttons
  }

  _makePlayerSprite() {
    // reuse the mini captain from the boarding kit
    const c = makeCanvas(8, 11);
    const g = c.getContext('2d');
    import('../render/pirate.js').then(({ buildMiniCaptain }) => {
      g.drawImage(buildMiniCaptain(this.game.appearance), 0, 0);
    });
    return c;
  }

  /* ---- room construction --------------------------------------------- */

  _buildRoom() {
    const rng = this.rng;
    const finalRoom = this.roomIndex === this.totalRooms; // the vault
    this.traps = [];
    this.props = [];
    this.vault = null;

    // furniture
    for (let i = 0; i < 5; i++) {
      this.props.push({
        x: ROOM.x0 + 30 + rng() * (ROOM.x1 - ROOM.x0 - 60),
        y: ROOM.y0 + 12 + rng() * (ROOM.y1 - ROOM.y0 - 24),
        kind: rangeInt(rng, 0, 2),
      });
    }

    if (finalRoom) {
      this.vault = { x: ROOM.x1 - 26, y: 0, opened: false };
      // maybe the Guardian stands watch
      if (this.theme.guardian && rng() < 0.6) {
        this._spawnGuardian();
      } else {
        this._spawnFoes(2 + Math.floor(this.tier / 2));
      }
      // secret lore tablet
      this.props.push({ x: ROOM.x1 - 26, y: ROOM.y0 + 14, kind: 'tablet' });
    } else {
      this._spawnFoes(2 + this.roomIndex + Math.floor(this.tier / 2));
      // traps between the door and the loot
      const n = rangeInt(rng, 2, 4);
      for (let i = 0; i < n; i++) {
        this.traps.push({
          x: ROOM.x0 + 50 + rng() * (ROOM.x1 - ROOM.x0 - 100),
          y: ROOM.y0 + 14 + rng() * (ROOM.y1 - ROOM.y0 - 28),
          r: 13,
          phase: rng() * 2.4,
          kind: this.theme.hazard,
        });
      }
    }
  }

  _spawnFoes(count) {
    const rng = this.rng;
    for (let i = 0; i < count; i++) {
      const kind = pick(rng, this.theme.foes);
      const st = FOE_STATS[kind];
      this.game.collection?.discover('foes', st.collect);
      this.actors.push(this._actor({
        kind: 'enemy',
        foeKind: kind,
        x: ROOM.x1 - 20 - rng() * 60,
        y: ROOM.y0 + 12 + rng() * (ROOM.y1 - ROOM.y0 - 24),
        hp: st.hp + this.tier * 8,
        maxHp: st.hp + this.tier * 8,
        speed: st.speed,
        damage: st.dmg + this.tier * 2,
        shooter: st.shooter,
        sprite: this._foeSprites?.[kind] ?? ((this._foeSprites = this._foeSprites ?? {})[kind] = foeSprite(kind)),
      }));
    }
  }

  _spawnGuardian() {
    this.game.collection?.discover('foes', 'guardian');
    this.game.hud.toast('Something ancient stirs...', '#4ec9b0');
    this.guardian = this._actor({
      kind: 'enemy',
      isGuardian: true,
      x: ROOM.x1 - 40,
      y: 0,
      hp: 130 + this.tier * 45,
      maxHp: 130 + this.tier * 45,
      speed: 22,
      damage: 12 + this.tier * 3,
      shooter: false,
      slamTimer: 3,
      sprite: this._guardianSprite ?? (this._guardianSprite = guardianSprite()),
    });
    this.actors.push(this.guardian);
  }

  /* ---- simulation ------------------------------------------------------- */

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
    this._updateTraps(dt);
    this._updateGuardian(dt);

    // room progression: enemies cleared -> door opens, walk through
    const enemiesLeft = this.actors.some((a) => a.kind === 'enemy' && !a.dead);
    if (!enemiesLeft) {
      if (this.vault) {
        // vault room: open the chest to win
        if (!this.vault.opened && Math.abs(this.player.x - this.vault.x) < 16 && Math.abs(this.player.y - this.vault.y) < 16) {
          this.vault.opened = true;
          this.outcome = 'win';
          this.endTimer = 1.4;
          this.game.events.emit('sfx', 'victory');
        }
      } else if (this.player.x > ROOM.x1 - 12) {
        // step through the doorway
        this.roomIndex++;
        this.banner = 0.9;
        this.bannerText = this.roomIndex === this.totalRooms ? 'THE VAULT' : 'DEEPER...';
        this.player.x = ROOM.x0 + 12;
        this.actors = this.actors.filter((a) => a === this.player);
        this._buildRoom();
        this.game.events.emit('sfx', 'dungeon');
      }
    }
    if (this.player.dead && !this.outcome) {
      this.outcome = 'loss';
      this.endTimer = 1.6;
    }
  }

  _updateTraps(dt) {
    for (const tr of this.traps) {
      tr.phase = (tr.phase + dt) % 2.4;
      const active = tr.kind === 'spikes' ? tr.phase > 1.7 : true; // pools always hurt
      if (!active) continue;
      for (const a of this.actors) {
        if (a.dead) continue;
        if (dist2(a.x, a.y, tr.x, tr.y) < tr.r * tr.r) {
          a.trapCd = a.trapCd ?? 0;
          a.trapCd -= dt;
          if (a.trapCd <= 0) {
            a.trapCd = 0.8;
            const dmg = tr.kind === 'spikes' ? 7 : 5;
            if (a === this.player) {
              this.game.player.hurt(dmg);
              this.game.camera.addShake(1.5);
            } else {
              a.hp -= dmg;
              if (a.hp <= 0 && !a.dead) a.dead = true;
            }
            a.hitFlash = 1;
            const away = Math.atan2(a.y - tr.y, a.x - tr.x);
            a.kx += Math.cos(away) * 70;
            a.ky += Math.sin(away) * 70;
            this.game.particles.burstBlood(a.x, a.y - 4, 3);
            this.game.events.emit('sfx', 'hit');
          }
        }
      }
    }
  }

  _updateGuardian(dt) {
    const gu = this.guardian;
    if (!gu || gu.dead) return;
    gu.slamTimer -= dt;
    if (gu.slamTimer <= 0) {
      gu.slamTimer = 3.4;
      gu.slamAt = 0.9; // telegraph
    }
    if (gu.slamAt !== undefined) {
      gu.slamAt -= dt;
      if (gu.slamAt <= 0) {
        gu.slamAt = undefined;
        this.game.camera.addShake(3);
        this.game.events.emit('sfx', 'slam');
        this.effects.push({ kind: 'ring', x: gu.x, y: gu.y, t: 0.3, max: 0.3 });
        if (dist2(this.player.x, this.player.y, gu.x, gu.y) < 34 * 34 && this.dashT <= 0) {
          const dmg = this.game.player.hurt(gu.damage + 4);
          this.player.hitFlash = 1;
          const away = Math.atan2(this.player.y - gu.y, this.player.x - gu.x);
          this.player.kx += Math.cos(away) * 160;
          this.player.ky += Math.sin(away) * 160;
          this.game.particles.spawnText(this.player.x, this.player.y - 14, `${dmg}`, '#e05a4a');
          if (this.game.player.health <= 0) this.player.dead = true;
        }
      }
    }
  }

  /* ---- resolution --------------------------------------------------------- */

  _finish() {
    const { game } = this;
    this.active = false;
    game.audio.setMusicMode?.('normal');
    game.particles.above.length = 0;
    game.particles.texts.length = 0;
    game.events.emit('boarding:end', { outcome: this.outcome });

    if (this.outcome === 'win') {
      game.world.collected.add(this.entrance.id);
      this.entrance.searched = true;
      const rng = mulberry32(this.entrance.seed ^ 0x7007);
      const loot = rollLoot(rng, 'treasure', game.player.luck + 3);
      loot.gold += 80 + this.tier * 60;
      // a relic sleeps in some vaults — likelier if the Guardian fell
      const relicChance = this.guardian ? 0.65 : 0.3;
      if (rng() < relicChance) {
        loot.items.push({ id: pick(rng, ['kingsHat', 'royalArmor', 'cursedSword', 'treasureLocator', 'goldenCompass', 'stormLantern']), qty: 1 });
      }
      game.player.addXp(60 + this.tier * 25 + (this.guardian ? 50 : 0));
      if (this.guardian) {
        game.events.emit('boss:defeated', { kind: 'guardian' });
        game.collection.discover('bosses', 'guardian');
      }
      game.events.emit('dungeon:cleared', { theme: this.entrance.theme });
      game.collection.discover('locations', `dungeon:${this.entrance.theme}`);
      game.openLoot(`${this.theme.name} — Vault`, loot, game.ship.x, game.ship.y);
      setTimeout(() => {
        game.showMessage('A Weathered Tablet', pick(rng, LORE), 'Recorded in your collection.');
      }, 700);
    } else {
      // stumble back to the boat, bruised
      game.player.health = Math.max(1, Math.round(game.player.maxHealth * 0.35));
      game.events.emit('player:changed');
      game.hud.toast('You barely crawl back to the daylight...', '#e05a4a');
    }
  }

  /* ---- rendering ---------------------------------------------------------------- */

  draw(g, bufW, bufH, t) {
    const th = this.theme;
    g.save();
    g.translate(Math.round(bufW / 2), Math.round(bufH / 2));

    // darkness beyond the walls
    g.fillStyle = '#0c0a10';
    g.fillRect(-bufW / 2, -bufH / 2, bufW, bufH);

    // walls + floor
    g.fillStyle = th.wall;
    g.fillRect(ROOM.x0 - 10, ROOM.y0 - 12, ROOM.x1 - ROOM.x0 + 20, ROOM.y1 - ROOM.y0 + 22);
    for (let y = ROOM.y0; y < ROOM.y1; y += 8) {
      for (let x = ROOM.x0; x < ROOM.x1; x += 8) {
        g.fillStyle = ((x + y) / 8) % 2 ? th.floor : th.floorAlt;
        g.fillRect(x, y, 8, 8);
      }
    }
    // wall top edge (slight-angle look, same trick as the islands)
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, 4);

    // doorway (right side) — glows when the room is clear
    const enemiesLeft = this.actors.some((a) => a.kind === 'enemy' && !a.dead);
    if (!this.vault) {
      g.fillStyle = enemiesLeft ? '#14121a' : th.floorAlt;
      g.fillRect(ROOM.x1 - 4, -14, 16, 28);
      if (!enemiesLeft) {
        g.fillStyle = `rgba(240,208,144,${0.25 + Math.sin(t * 4) * 0.15})`;
        g.fillRect(ROOM.x1 - 4, -14, 16, 28);
      }
    }

    // hazards
    for (const tr of this.traps) {
      if (tr.kind === 'spikes') {
        const up = tr.phase > 1.7;
        const warn = tr.phase > 1.4 && !up;
        g.fillStyle = warn ? 'rgba(224,90,74,0.5)' : 'rgba(0,0,0,0.28)';
        g.beginPath();
        g.arc(tr.x, tr.y, tr.r, 0, TAU);
        g.fill();
        if (up) {
          g.fillStyle = '#c8ccd4';
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU + 0.5;
            g.fillRect(Math.round(tr.x + Math.cos(a) * 6), Math.round(tr.y + Math.sin(a) * 5) - 4, 2, 5);
          }
        }
      } else {
        const glow = Math.sin(t * 2 + tr.phase * 3) * 0.15;
        g.fillStyle = tr.kind === 'lava' ? `rgba(224,110,50,${0.75 + glow})` : `rgba(60,140,150,${0.7 + glow})`;
        g.beginPath();
        g.arc(tr.x, tr.y, tr.r, 0, TAU);
        g.fill();
        g.fillStyle = tr.kind === 'lava' ? '#f2d98a' : '#a8e0d8';
        g.fillRect(Math.round(tr.x - 2 + Math.sin(t * 3 + tr.x) * 4), Math.round(tr.y - 1), 3, 2);
      }
    }

    // props
    for (const pr of this.props) {
      if (pr.kind === 'tablet') {
        g.fillStyle = '#9aa0a0';
        g.fillRect(pr.x - 3, pr.y - 8, 7, 10);
        g.fillStyle = '#4ec9b0';
        g.fillRect(pr.x - 1, pr.y - 6, 3, 1);
        g.fillRect(pr.x - 2, pr.y - 4, 5, 1);
      } else if (pr.kind === 0) {
        g.fillStyle = '#7a5a34'; // crate
        g.fillRect(pr.x - 4, pr.y - 6, 9, 8);
        g.fillStyle = '#96703f';
        g.fillRect(pr.x - 3, pr.y - 5, 7, 6);
      } else if (pr.kind === 1) {
        g.fillStyle = '#5d6165'; // rubble
        g.fillRect(pr.x - 4, pr.y - 3, 8, 4);
        g.fillStyle = '#7e8388';
        g.fillRect(pr.x - 2, pr.y - 5, 4, 3);
      } else {
        g.fillStyle = '#3a3e46'; // pillar stump
        g.fillRect(pr.x - 3, pr.y - 10, 7, 12);
        g.fillStyle = '#5a5e66';
        g.fillRect(pr.x - 3, pr.y - 10, 7, 3);
      }
    }

    // the vault chest
    if (this.vault) {
      const v = this.vault;
      const pulse = 0.3 + Math.sin(t * 3) * 0.15;
      g.fillStyle = `rgba(240,168,60,${pulse})`;
      g.beginPath();
      g.arc(v.x, v.y, 16, 0, TAU);
      g.fill();
      g.fillStyle = '#6e4527';
      g.fillRect(v.x - 8, v.y - 6, 16, 11);
      g.fillStyle = '#8a5c33';
      g.fillRect(v.x - 8, v.y - 8, 16, 6);
      g.fillStyle = '#e0b345';
      g.fillRect(v.x - 8, v.y - 3, 16, 2);
      g.fillRect(v.x - 2, v.y - 4, 4, 5);
    }

    // torch light pools
    for (const tx of [ROOM.x0 + 20, 0, ROOM.x1 - 20]) {
      const flicker = 0.8 + Math.sin(t * 9 + tx) * 0.1;
      g.fillStyle = `rgba(255,180,80,${0.06 * flicker})`;
      g.beginPath();
      g.arc(tx, ROOM.y0 + 6, 30, 0, TAU);
      g.fill();
      g.fillStyle = '#f0a83c';
      g.fillRect(tx - 1, ROOM.y0 - 6, 2, 3);
      g.fillStyle = '#5a3a20';
      g.fillRect(tx - 1, ROOM.y0 - 3, 2, 5);
    }

    // actors + effects (same pipeline as boarding)
    const sorted = [...this.actors].sort((a, b) => a.y - b.y);
    for (const a of sorted) this._drawActor(g, a);
    for (const e of this.effects) {
      const k = e.t / e.max;
      if (e.kind === 'swing') {
        g.strokeStyle = `rgba(240,240,250,${k})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(e.x, e.y - 4, 14, e.a - 0.9 + (1 - k) * 0.9, e.a + 0.9);
        g.stroke();
      } else if (e.kind === 'tracer') {
        g.strokeStyle = `rgba(255,230,160,${k})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(e.x0, e.y0);
        g.lineTo(e.x1, e.y1);
        g.stroke();
      } else if (e.kind === 'ring') {
        g.strokeStyle = `rgba(78,201,176,${k})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(e.x, e.y, 34 * (1 - k), 0, TAU);
        g.stroke();
      }
    }

    // guardian slam telegraph
    if (this.guardian && !this.guardian.dead && this.guardian.slamAt !== undefined) {
      const k = 1 - this.guardian.slamAt / 0.9;
      g.strokeStyle = `rgba(240,90,120,${0.3 + k * 0.5})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(this.guardian.x, this.guardian.y, 34, 0, TAU);
      g.stroke();
    }

    this.game.particles.drawLayer(g, 'above');
    this.game.particles.drawTexts(g);

    // vignette: dungeons are dark places
    g.fillStyle = 'rgba(6,4,10,0.22)';
    g.fillRect(-bufW / 2, -bufH / 2, bufW, bufH);
    g.restore();

    // banner
    if (this.banner > 0 || this.outcome) {
      const text = this.banner > 0 ? this.bannerText
        : this.outcome === 'win' ? 'VAULT CLAIMED!' : 'DRIVEN OUT...';
      g.fillStyle = 'rgba(8,12,24,0.55)';
      g.fillRect(0, bufH / 2 - 16, bufW, 30);
      g.font = 'bold 14px monospace';
      g.textAlign = 'center';
      g.fillStyle = this.outcome === 'loss' ? '#e05a4a' : '#4ec9b0';
      g.fillText(text, bufW / 2, bufH / 2 + 4);
      g.textAlign = 'left';
    }
  }
}
