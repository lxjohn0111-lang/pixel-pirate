// Procedural world encounters. A deterministic chunk feature generator
// (plugged in via world.addFeatureGenerator) scatters wrecks, supply
// rafts, drifting survivors, message bottles and locked chests across
// the sea, and abandoned camps onto islands. Searched encounters are
// remembered in world.collected so they never respawn.
//
// Also owns dynamic treasure sites charted by treasure maps.

import { CHUNK_SIZE } from '../core/constants.js';
import { mulberry32, hash2u, rand2, range, rangeInt } from '../util/random.js';
import { rollLoot } from '../items/itemdefs.js';
import { createCrewMember } from '../crew/crew.js';
import { wreckSprite, raftSprite, tentSprite, bottleSprite, lockedChestSprite, chestSprite } from '../render/sprites.js';
import { TAU, dist2 } from '../util/math.js';

const INTERACT_RANGE = 64;

export class Encounters {
  constructor(game) {
    this.game = game;
    /** Charted treasure sites: { x, y, spawned, questId? } */
    this.treasures = game._savedTreasures ?? [];
    game.world.addFeatureGenerator((chunk, rng, world) => this._generate(chunk, rng, world));
  }

  /* ------------------------------------------------------------------ */
  /* Deterministic chunk content                                        */
  /* ------------------------------------------------------------------ */

  _generate(chunk, rng, world) {
    chunk.encounters = [];
    const baseId = `enc:${chunk.cx},${chunk.cy}`;
    const roll = rng();

    const place = (margin = 60) => ({
      x: chunk.x + range(rng, margin, CHUNK_SIZE - margin),
      y: chunk.y + range(rng, margin, CHUNK_SIZE - margin),
    });
    const inWater = (p) => !chunk.island || chunk.island.elevationAt(p.x, p.y) <= 0;

    // Open-sea encounters (one per chunk at most, so they stay special).
    if (!chunk.island) {
      if (roll < 0.030) {
        const p = place();
        chunk.encounters.push({
          kind: 'wreck', id: `${baseId}:wreck`, x: p.x, y: p.y,
          variant: rangeInt(rng, 0, 1), searched: world.collected.has(`${baseId}:wreck`),
        });
        // survivors sometimes cling to the wreckage
        if (rng() < 0.4) {
          chunk.encounters.push({
            kind: 'survivor', id: `${baseId}:wsurv`, x: p.x + range(rng, 24, 40), y: p.y + range(rng, -20, 20),
            seed: hash2u(world.seed, chunk.cx * 3, chunk.cy * 5),
            searched: world.collected.has(`${baseId}:wsurv`),
          });
        }
      } else if (roll < 0.048) {
        const p = place();
        chunk.encounters.push({
          kind: 'raft', id: `${baseId}:raft`, x: p.x, y: p.y,
          searched: world.collected.has(`${baseId}:raft`),
        });
      } else if (roll < 0.060) {
        const p = place();
        chunk.encounters.push({
          kind: 'survivor', id: `${baseId}:surv`, x: p.x, y: p.y,
          seed: hash2u(world.seed, chunk.cx * 7, chunk.cy * 11),
          searched: world.collected.has(`${baseId}:surv`),
        });
      } else if (roll < 0.085) {
        const p = place();
        chunk.encounters.push({
          kind: 'bottle', id: `${baseId}:bottle`, x: p.x, y: p.y,
          searched: world.collected.has(`${baseId}:bottle`),
        });
      } else if (roll < 0.095) {
        const p = place();
        chunk.encounters.push({
          kind: 'lockedChest', id: `${baseId}:locked`, x: p.x, y: p.y,
          searched: world.collected.has(`${baseId}:locked`),
        });
      }
    }

    // Dungeon entrances (Part 3): a dark mouth at the shoreline of
    // larger wild islands. Cleared dungeons stay sealed forever.
    if (chunk.island && chunk.island.r > 55 && chunk.island.shore.length > 6) {
      const droll = rand2(world.seed ^ 0xd0d6, chunk.cx, chunk.cy);
      if (droll < 0.12) {
        const isl = chunk.island;
        const themes = {
          rock: ['cave', 'volcano', 'hideout'],
          jungle: ['temple', 'ruins', 'hideout'],
          palm: ['cave', 'hideout'],
          sand: ['cave'],
          coral: ['ruins'],
        }[isl.biome] ?? ['cave'];
        const drng = mulberry32(hash2u(world.seed ^ 0xd0d7, chunk.cx, chunk.cy));
        const sp = isl.shore[rangeInt(drng, 0, isl.shore.length - 1)];
        chunk.encounters.push({
          kind: 'dungeon',
          id: `${baseId}:dungeon`,
          theme: themes[rangeInt(drng, 0, themes.length - 1)],
          x: Math.round(sp.x + sp.nx * 6),
          y: Math.round(sp.y + sp.ny * 6),
          seed: hash2u(world.seed ^ 0xd0d8, chunk.cx, chunk.cy),
          searched: world.collected.has(`${baseId}:dungeon`),
        });
      }
    }

    // Island camps: a campfire, a tent and whatever was left behind.
    if (chunk.island && chunk.island.r > 40 && rng() < 0.3) {
      // reuse decor placement logic: pick a beach-ish spot
      for (let i = 0; i < 24; i++) {
        const a = rng() * TAU;
        const d = Math.sqrt(rng()) * chunk.island.r;
        const x = chunk.island.x + Math.cos(a) * d;
        const y = chunk.island.y + Math.sin(a) * d;
        const e = chunk.island.elevationAt(x, y);
        if (e > 0.34 && e < 0.52) {
          chunk.encounters.push({
            kind: 'camp', id: `${baseId}:camp`, x, y,
            hermit: rng() < 0.3,
            seed: hash2u(world.seed, chunk.cx * 13, chunk.cy * 17),
            searched: world.collected.has(`${baseId}:camp`),
          });
          break;
        }
      }
    }

    // Wrecks leave debris trails even without a full wreck.
    if (!chunk.island && rng() < 0.05) {
      const p = place(40);
      chunk.debris = [];
      const n = rangeInt(rng, 3, 6);
      for (let i = 0; i < n; i++) {
        chunk.debris.push({
          x: p.x + range(rng, -40, 40),
          y: p.y + range(rng, -30, 30),
          w: rangeInt(rng, 3, 8),
          a: rng() * TAU,
        });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Interaction                                                        */
  /* ------------------------------------------------------------------ */

  /** The closest interactable thing near the ship, or null. */
  findInteractable() {
    const { game } = this;
    const { ship, world } = game;
    let best = null;
    let bestD = INTERACT_RANGE * INTERACT_RANGE;
    world.forEachChunkIn(ship.x - 300, ship.y - 300, 600, 600, (chunk) => {
      for (const e of chunk.encounters ?? []) {
        if (e.searched) continue;
        const d = dist2(e.x, e.y, ship.x, ship.y);
        const reach = e.kind === 'camp' ? 110 * 110 : bestD; // camps sit inland
        if (d < Math.min(reach, bestD) || (e.kind === 'camp' && d < reach && !best)) {
          best = e;
          bestD = Math.min(d, bestD);
        }
      }
    });
    // charted treasure
    for (const tr of this.treasures) {
      if (!tr.spawned) continue;
      const d = dist2(tr.x, tr.y, ship.x, ship.y);
      if (d < bestD) {
        best = { kind: 'treasure', treasure: tr, x: tr.x, y: tr.y, id: null };
        bestD = d;
      }
    }
    return best;
  }

  promptFor(e) {
    switch (e.kind) {
      case 'wreck': return 'Search the wreck';
      case 'raft': return 'Search the raft';
      case 'survivor': return 'Rescue the survivor';
      case 'bottle': return 'Fish out the bottle';
      case 'lockedChest':
        return this.game.inventory.totalCount('rustyKey') > 0 ? 'Unlock the chest (uses Rusty Key)' : 'Locked chest (needs a Rusty Key)';
      case 'camp': return 'Search the camp';
      case 'kingdom': return 'Descend into the drowned city';
      case 'treasure': return 'Haul up the treasure!';
      case 'dungeon': {
        const names = { temple: 'ancient temple', cave: 'sea cave', volcano: 'smoking cavern', ruins: 'sunken ruins', hideout: 'pirate hideout' };
        return `Enter the ${names[e.theme] ?? 'cave'}`;
      }
      default: return 'Investigate';
    }
  }

  interact(e) {
    const { game } = this;
    const luck = game.player.luck + game.crew.bonuses().luck;
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    const consume = () => {
      if (e.id) {
        game.world.collected.add(e.id);
        e.searched = true;
      }
    };

    switch (e.kind) {
      case 'wreck': {
        consume();
        const drops = rollLoot(rng, 'wreck', luck);
        if (e.storyFlag) {
          // A story wreck always yields its chart fragment.
          drops.items.push({ id: 'treasureFragment', qty: 1 });
          game.openLoot('The Gracechurch\'s Boat', drops, e.x, e.y, () => {
            game.story.onSiteSearched(e.storyFlag);
          });
        } else {
          game.openLoot('Shipwreck', drops, e.x, e.y);
        }
        break;
      }
      case 'kingdom': {
        consume();
        game.story.onSiteSearched(e.storyFlag);
        break;
      }
      case 'raft': {
        consume();
        game.openLoot('Supply Raft', rollLoot(rng, 'raft', luck), e.x, e.y);
        break;
      }
      case 'camp': {
        consume();
        game.openLoot('Abandoned Camp', rollLoot(rng, 'camp', luck), e.x, e.y);
        if (e.hermit) {
          const member = createCrewMember(e.seed, 1 + game.tierAt(e.x, e.y));
          game.offerRecruit(member, 'A castaway wants to join your crew!');
        }
        break;
      }
      case 'survivor': {
        consume();
        game.events.emit('survivor:rescued', { x: e.x, y: e.y });
        const member = createCrewMember(e.seed, 1 + Math.floor(game.tierAt(e.x, e.y) / 2));
        game.offerRecruit(member, 'You pulled a grateful sailor from the sea!');
        game.player.addXp(12);
        break;
      }
      case 'bottle': {
        consume();
        this._openBottle(rng);
        break;
      }
      case 'lockedChest': {
        if (game.inventory.totalCount('rustyKey') < 1) {
          game.hud.toast('You need a Rusty Key for this chest.', '#e0b345');
          return;
        }
        game.inventory.removeAnywhere('rustyKey', 1);
        consume();
        game.openLoot('Locked Sea Chest', rollLoot(rng, 'lockedChest', luck), e.x, e.y);
        break;
      }
      case 'dungeon': {
        game.dungeon.enter(e); // clearing it marks it searched
        break;
      }
      case 'treasure': {
        const tr = e.treasure;
        this.treasures.splice(this.treasures.indexOf(tr), 1);
        game.openLoot('Buried... well, Sunken Treasure', rollLoot(rng, 'treasure', luck + 2), e.x, e.y);
        game.events.emit('treasure:recovered', { questId: tr.questId });
        game.player.addXp(40);
        break;
      }
    }
  }

  _openBottle(rng) {
    const { game } = this;
    const r = rng();
    if (r < 0.4) {
      const gold = 15 + Math.floor(rng() * 40);
      game.resources.coins += gold;
      game.events.emit('resources:changed', { ...game.resources });
      game.showMessage('Message in a Bottle',
        '"If ye read this, take what little I saved. Spend it on rum, not regrets."',
        `${gold} gold was tucked inside.`);
      game.events.emit('sfx', 'coin');
    } else if (r < 0.72) {
      game.inventory.addAnywhere('treasureMap', 1);
      game.showMessage('Message in a Bottle',
        '"Half the crew mutinied. I hid the cargo where the gulls circle. The map never lies."',
        'A Treasure Map slipped out of the bottle!');
      game.events.emit('sfx', 'chest');
    } else {
      game.showMessage('Message in a Bottle',
        '"Day 214. The horizon is a circle with no door. Still, the sunsets are lovely."',
        'Just a lonely note. It deserves to be read.');
      game.player.addXp(5);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Treasure maps                                                       */
  /* ------------------------------------------------------------------ */

  chartTreasure(questId = null) {
    const { game } = this;
    const a = Math.random() * TAU;
    const d = 1100 + Math.random() * 1400;
    const tr = {
      x: Math.round(game.ship.x + Math.cos(a) * d),
      y: Math.round(game.ship.y + Math.sin(a) * d),
      spawned: false,
      questId,
    };
    this.treasures.push(tr);
    game.events.emit('map:marker', { kind: 'treasure', x: tr.x, y: tr.y });
    return tr;
  }

  update() {
    const { ship, world } = this.game;
    for (const tr of this.treasures) {
      if (!tr.spawned && dist2(tr.x, tr.y, ship.x, ship.y) < 400 * 400) {
        // nudge the chest into open water if the map pointed at land
        let tries = 0;
        while (!world.isOpenWater(tr.x, tr.y) && tries++ < 40) {
          tr.x += (Math.random() - 0.5) * 160;
          tr.y += (Math.random() - 0.5) * 160;
        }
        tr.spawned = true;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Drawing                                                             */
  /* ------------------------------------------------------------------ */

  collectSurfaceDrawables(out, t, viewX, viewY, viewW, viewH) {
    const { world } = this.game;
    world.forEachChunkIn(viewX, viewY, viewW, viewH, (chunk) => {
      for (const d of chunk.debris ?? []) {
        out.push({
          y: d.y,
          draw: (g) => {
            g.save();
            g.translate(Math.round(d.x), Math.round(d.y + Math.sin(t + d.a) * 1));
            g.rotate(d.a);
            g.fillStyle = '#6a5036';
            g.fillRect(-d.w / 2, -1, d.w, 2);
            g.fillStyle = '#54402c';
            g.fillRect(-d.w / 2, 0, d.w, 1);
            g.restore();
          },
        });
      }
      for (const e of chunk.encounters ?? []) {
        out.push({ y: e.y, draw: (g) => this._drawEncounter(g, e, t) });
      }
    });
    for (const tr of this.treasures) {
      if (!tr.spawned) continue;
      out.push({
        y: tr.y,
        draw: (g) => {
          const bob = Math.sin(t * 1.6) * 1.5;
          const pulse = 0.25 + Math.sin(t * 3.5) * 0.15;
          g.fillStyle = `rgba(240,168,60,${pulse})`;
          g.beginPath();
          g.arc(Math.round(tr.x), Math.round(tr.y + bob), 13, 0, TAU);
          g.fill();
          const spr = chestSprite();
          g.drawImage(spr, Math.round(tr.x - spr.width / 2), Math.round(tr.y - spr.height / 2 + bob));
        },
      });
    }
  }

  _drawEncounter(g, e, t) {
    const bob = Math.sin(t * 1.4 + e.x * 0.1) * 1.2;
    switch (e.kind) {
      case 'wreck': {
        const spr = wreckSprite(e.variant);
        g.drawImage(spr, Math.round(e.x - spr.width / 2), Math.round(e.y - spr.height / 2 + bob * 0.5));
        if (!e.searched && Math.sin(t * 2) > 0) {
          g.fillStyle = 'rgba(240,208,144,0.8)';
          g.fillRect(Math.round(e.x), Math.round(e.y - 26), 2, 2);
        }
        break;
      }
      case 'raft': {
        const spr = raftSprite();
        g.drawImage(spr, Math.round(e.x - spr.width / 2), Math.round(e.y - spr.height / 2 + bob));
        break;
      }
      case 'survivor': {
        // a head, a waving arm, some splashing
        const wave = Math.sin(t * 5 + e.x) > 0;
        g.fillStyle = '#e0b48a';
        g.fillRect(Math.round(e.x - 1), Math.round(e.y - 3 + bob * 0.5), 3, 3);
        g.fillStyle = '#8e2f2f'; // bandana
        g.fillRect(Math.round(e.x - 1), Math.round(e.y - 4 + bob * 0.5), 3, 1);
        if (wave) {
          g.fillStyle = '#e0b48a';
          g.fillRect(Math.round(e.x + 3), Math.round(e.y - 6 + bob * 0.5), 1, 4);
        }
        g.fillStyle = 'rgba(235,246,252,0.5)';
        g.fillRect(Math.round(e.x - 3), Math.round(e.y + 1), 8, 1);
        break;
      }
      case 'bottle': {
        const spr = bottleSprite();
        g.drawImage(spr, Math.round(e.x - 4), Math.round(e.y - 4 + bob));
        if (Math.sin(t * 3 + e.y) > 0.6) {
          g.fillStyle = 'rgba(230,246,252,0.9)';
          g.fillRect(Math.round(e.x + 1), Math.round(e.y - 6 + bob), 1, 1);
        }
        break;
      }
      case 'lockedChest': {
        const spr = lockedChestSprite();
        const pulse = 0.15 + Math.sin(t * 3) * 0.1;
        g.fillStyle = `rgba(180,110,240,${pulse})`;
        g.beginPath();
        g.arc(Math.round(e.x), Math.round(e.y + bob), 11, 0, TAU);
        g.fill();
        g.drawImage(spr, Math.round(e.x - spr.width / 2), Math.round(e.y - spr.height / 2 + bob));
        break;
      }
      case 'kingdom': {
        // A ring of drowned spires, lit from below. Unmistakable.
        const pulse = 0.4 + Math.sin(t * 1.4) * 0.2;
        g.fillStyle = `rgba(78,201,176,${pulse * 0.3})`;
        g.beginPath();
        g.arc(e.x, e.y, 46 + Math.sin(t) * 4, 0, TAU);
        g.fill();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + t * 0.06;
          const sx = Math.round(e.x + Math.cos(a) * 30);
          const sy = Math.round(e.y + Math.sin(a) * 20);
          const h = 10 + (i % 3) * 7;
          g.fillStyle = '#1e3a34';
          g.fillRect(sx - 2, sy - h, 5, h);
          g.fillStyle = `rgba(122,224,204,${0.4 + Math.sin(t * 2 + i) * 0.25})`;
          g.fillRect(sx - 2, sy - h, 5, 2);
          g.fillRect(sx - 1, sy - h + 4, 1, 3);
        }
        g.fillStyle = `rgba(122,224,204,${pulse})`;
        g.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 3, 3);
        break;
      }
      case 'dungeon': {
        // dark mouth in the rock, twin torches when unexplored
        g.fillStyle = '#4a4e54';
        g.fillRect(Math.round(e.x - 9), Math.round(e.y - 11), 18, 12);
        g.fillStyle = '#5d6165';
        g.fillRect(Math.round(e.x - 9), Math.round(e.y - 11), 18, 3);
        g.fillStyle = e.searched ? '#2a2c33' : '#0c0a12';
        g.fillRect(Math.round(e.x - 5), Math.round(e.y - 8), 10, 9);
        g.fillRect(Math.round(e.x - 3), Math.round(e.y - 10), 6, 2);
        if (!e.searched) {
          const f = Math.abs(Math.sin(t * 8 + e.x));
          g.fillStyle = '#f0a83c';
          g.fillRect(Math.round(e.x - 8), Math.round(e.y - 13 - f), 2, 2 + f);
          g.fillRect(Math.round(e.x + 6), Math.round(e.y - 13 - f), 2, 2 + f);
          g.fillStyle = 'rgba(255,180,80,0.12)';
          g.beginPath();
          g.arc(e.x, e.y - 8, 14, 0, TAU);
          g.fill();
        }
        break;
      }
      case 'camp': {
        const tent = tentSprite();
        g.drawImage(tent, Math.round(e.x - 18), Math.round(e.y - 12));
        // campfire: stones, logs and (if unsearched) a live flame
        g.fillStyle = '#5d6165';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          g.fillRect(Math.round(e.x + Math.cos(a) * 5), Math.round(e.y + Math.sin(a) * 3), 2, 2);
        }
        g.fillStyle = '#5a3a20';
        g.fillRect(Math.round(e.x - 3), Math.round(e.y - 1), 6, 2);
        if (!e.searched) {
          const f = Math.sin(t * 9 + e.x) * 1.5;
          g.fillStyle = '#e05a3c';
          g.fillRect(Math.round(e.x - 1), Math.round(e.y - 4 - Math.abs(f)), 3, 3 + Math.abs(f));
          g.fillStyle = '#f0a83c';
          g.fillRect(Math.round(e.x), Math.round(e.y - 3 - Math.abs(f) * 0.6), 1, 2);
        }
        break;
      }
    }
  }

  serialize() {
    return this.treasures.map((t) => ({ ...t }));
  }
}
