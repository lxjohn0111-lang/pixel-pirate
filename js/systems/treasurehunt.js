// Expedition treasure maps: multi-stage hunts. A Weathered Chart (rare
// find, black-market buy, or bottle prize) opens an expedition — riddle
// clues each point at a search circle on the map; reaching each area
// (matching its condition) reveals the next, and the trail ends at a
// hidden cave vault or a grand sunken hoard.

import { TAU, dist2 } from '../util/math.js';
import { mulberry32, pick, range } from '../util/random.js';
import { rollLoot, ITEMS } from '../items/itemdefs.js';
import { CLANS } from '../world/clans.js';
import { drawTreasureChart } from '../render/chart.js';

const CLUES = {
  island: [
    'Where %BIOME shores rise from the blue, the trail begins anew.',
    'Seek the isle of %BIOME sands — the dead man buried it with his own hands.',
    'An island of %BIOME kind holds the next mark, if ye care to find.',
  ],
  open: [
    'Sail where no land mars the ring of the horizon.',
    'In open water the gulls fall silent. Listen there.',
    'Far from every shore, the sea keeps its promise.',
  ],
  final: [
    'X marks where the moon touched the water. Dig deep, haul hard.',
    'The last of it sleeps below. Bring rope, bring nerve.',
    'What was taken returns to the taker. Claim it.',
  ],
};

const BIOMES = ['sand', 'palm', 'rock', 'jungle', 'coral'];

/** Relics that only ever come out of a buried hoard. */
const CLAN_RELICS = ['widowsLocket', 'ghostlight', 'fortuneChain', 'leviathanPlate', 'tempestCore'];

let nextHuntId = 1;

export class TreasureHunts {
  constructor(game, saved) {
    this.game = game;
    this.hunts = saved?.map((h) => ({ ...h })) ?? [];
    for (const h of this.hunts) nextHuntId = Math.max(nextHuntId, (parseInt(h.id.slice(1), 10) || 0) + 1);
  }

  /** Begin an expedition from a Weathered Chart item. */
  begin() {
    const { game } = this;
    if (this.hunts.length >= 2) {
      game.hud.toast('Two expeditions at once is enough, Captain.', '#e0b345');
      return false;
    }
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    const stages = [];
    let cx = game.ship.x;
    let cy = game.ship.y;
    const count = 2 + (rng() < 0.5 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU;
      const d = range(rng, 900, 1600);
      cx = Math.round(cx + Math.cos(a) * d);
      cy = Math.round(cy + Math.sin(a) * d);
      const last = i === count - 1;
      const kind = last ? 'final' : rng() < 0.6 ? 'island' : 'open';
      const biome = pick(rng, BIOMES);
      stages.push({
        x: cx,
        y: cy,
        radius: last ? 140 : 320,
        kind,
        biome,
        clue: pick(rng, CLUES[kind]).replace('%BIOME', biome),
      });
    }
    const hunt = { id: `h${nextHuntId++}`, stage: 0, stages };
    this.hunts.push(hunt);
    game.hud.toast('An expedition begins! The first clue is marked on your chart.', '#f0a83c');
    this.showChart(hunt, 'The Weathered Chart');
    game.events.emit('sfx', 'quest');
    return true;
  }

  update() {
    const { game } = this;
    for (let i = this.hunts.length - 1; i >= 0; i--) {
      const h = this.hunts[i];
      const st = h.stages[h.stage];
      if (dist2(game.ship.x, game.ship.y, st.x, st.y) > st.radius * st.radius) continue;

      if (h.stage < h.stages.length - 1) {
        // clue found — reveal the next leg
        h.stage++;
        const next = h.stages[h.stage];
        game.hud.toast('Clue found! The chart shows the next leg.', '#6fce62');
        this.showChart(h, 'The Trail Continues');
        game.player.addXp(20);
        game.events.emit('sfx', 'quest');
      } else {
        // the hoard itself — a grand spawn at the exact spot
        this.hunts.splice(i, 1);
        let x = st.x;
        let y = st.y;
        let tries = 0;
        while (!game.world.isOpenWater(x, y) && tries++ < 40) {
          x = st.x + (Math.random() - 0.5) * 240;
          y = st.y + (Math.random() - 0.5) * 240;
        }
        const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
        const loot = rollLoot(rng, 'treasure', game.player.luck + 5);
        loot.gold += 150 + game.tierAt(x, y) * 100;
        if (rng() < 0.4) {
          loot.items.push({ id: pick(rng, ['goldenCompass', 'treasureLocator', 'kingsHat', 'stormLantern']), qty: 1 });
        }
        // Whoever's waters these are buried something of their own here.
        const owner = game.clans?.ownerOfRegion(x, y);
        if (owner && rng() < 0.5) {
          loot.items.push({ id: pick(rng, CLAN_RELICS), qty: 1 });
          game.hud.toast(`${CLANS[owner].name} lost something in these waters.`, CLANS[owner].color);
        }
        // Cosmetics and ship parts make the hoard worth opening even when
        // the gold is unremarkable.
        if (rng() < 0.35) loot.items.push({ id: pick(rng, ['cannonBarrel', 'silkSails', 'hullPlanks']), qty: 1 });
        game.combat.drops.push({ x, y, kind: 'chest', age: 0, loot });
        game.hud.toast('THE HOARD! It floats free of the depths — claim it!', '#f0a83c');
        game.player.addXp(80);
        game.events.emit('treasure:recovered', {});
        game.events.emit('sfx', 'victory');
      }
    }
  }

  /**
   * Show the hunt as an actual chart: hand-drawn coastlines, a dashed
   * trail with the legs already walked crossed off, and the clue written
   * along the bottom in the same ink. Reading a riddle off a piece of
   * parchment is most of what treasure hunting is.
   */
  showChart(hunt, title) {
    const { game } = this;
    const st = hunt.stages[hunt.stage];
    const c = drawTreasureChart(hunt, game);
    game.showMessage(
      title,
      `<img class="chart-img" alt="A weathered chart" src="${c.toDataURL()}">
       <p class="chart-clue">“${st.clue}”</p>`,
      `Leg ${hunt.stage + 1} of ${hunt.stages.length} · the search area is marked on your sea chart (M).`,
    );
    game.events.emit('sfx', 'quest');
  }

  /** Current search areas, for the map screen. */
  mapAreas() {
    return this.hunts.map((h) => {
      const st = h.stages[h.stage];
      return { x: st.x, y: st.y, radius: st.radius, final: h.stage === h.stages.length - 1 };
    });
  }

  serialize() {
    return this.hunts.map((h) => ({ ...h, stages: h.stages.map((s) => ({ ...s })) }));
  }
}
