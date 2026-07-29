// Named ships: the five hulls everyone at sea has heard of.
//
// Each belongs to a clan, hunts its own stretch of water, and is a real
// fight rather than a tougher raider — heavier hull, more guns, a captain
// with a name and a story, and a relic nobody else drops. They are found,
// not spawned at you: each one patrols near its clan's home waters, and
// sailing into that region is what puts you in its path.
//
// Sink one and it stays sunk. There are five in the world, ever.

import { AIShip } from '../entities/aiship.js';
import { CLANS, REGION_SIZE } from './clans.js';
import { mulberry32 } from '../util/random.js';
import { TAU } from '../util/math.js';

export const NAMED_SHIPS = {
  crimsonWidow: {
    name: 'The Crimson Widow',
    captain: 'Admiral Rosa Sanguine',
    clanId: 'crimson',
    type: 'pirate',
    hullMult: 4.5,
    cannons: 4,
    damageBonus: 8,
    speedMult: 1.12,
    scale: 1.35,
    reward: { gold: 4500, item: 'widowsLocket', xp: 400 },
    tale: 'She buried three husbands and every crew that sailed against her. '
      + 'The hull is painted the colour it is so the blood does not show.',
    sighting: 'A red hull on the horizon. The Crimson Widow has found you.',
  },
  seaGhost: {
    name: 'Sea Ghost',
    captain: 'The Whisper',
    clanId: 'nightglass',
    type: 'ghost',
    hullMult: 3.6,
    cannons: 4,
    damageBonus: 6,
    speedMult: 1.3,
    scale: 1.2,
    reward: { gold: 3800, item: 'ghostlight', xp: 380 },
    tale: 'Logged as lost with all hands forty years ago. Logged again last month, '
      + 'off a different coast, by a captain who did not survive to file it twice.',
    sighting: 'The water goes quiet. Sea Ghost is here.',
  },
  goldenFortune: {
    name: 'Golden Fortune',
    captain: 'Factor Mireille Vasque',
    clanId: 'goldwake',
    type: 'merchant',
    hullMult: 5.2,
    cannons: 5,
    damageBonus: 5,
    speedMult: 0.95,
    scale: 1.5,
    reward: { gold: 9000, item: 'fortuneChain', xp: 420 },
    tale: 'The richest hull afloat, and the best defended. Everyone has considered taking her. '
      + 'The ones who tried are a matter of public record.',
    sighting: 'Gold leaf on her rails, and eleven guns behind them.',
  },
  ironLeviathan: {
    name: 'Iron Leviathan',
    captain: 'Commodore Iyare Okonkwo',
    clanId: 'ashen',
    type: 'navy',
    hullMult: 6.5,
    cannons: 6,
    damageBonus: 10,
    speedMult: 0.9,
    scale: 1.6,
    reward: { gold: 6500, item: 'leviathanPlate', xp: 500 },
    tale: 'Plated below the waterline with something they will not name. '
      + 'She has never been boarded. Twice she has been rammed, and twice the other ship sank.',
    sighting: 'That is not a patrol. That is the Iron Leviathan.',
  },
  blackTempest: {
    name: 'Black Tempest',
    captain: 'Mother Kelune',
    clanId: 'tideborn',
    type: 'ghost',
    hullMult: 7,
    cannons: 6,
    damageBonus: 12,
    speedMult: 1.15,
    scale: 1.55,
    reward: { gold: 12000, item: 'tempestCore', xp: 700 },
    tale: 'She sails inside her own weather. Where she goes the glass drops, '
      + 'the birds leave, and the sea starts to lean. The Tideborn do not call her a ship.',
    sighting: 'The sky turns the colour of a bruise. The Black Tempest is running.',
  },
};

export const NAMED_IDS = Object.keys(NAMED_SHIPS);

/** How close to its home waters a named ship patrols. */
const PATROL_RADIUS = REGION_SIZE * 0.9;
/** The player has to be this close before one is put on the water. */
const APPROACH = 900;

export class NamedShips {
  constructor(game, saved) {
    this.game = game;
    /** Ids already sunk — permanent. */
    this.defeated = new Set(saved?.defeated ?? []);
    /** Ids the player has laid eyes on, for the Clans tab and collection. */
    this.seen = new Set(saved?.seen ?? []);
    /** id -> live AIShip while one is on the water. */
    this._live = new Map();
    this._checkTimer = 4;

    game.events.on('ship:sunk', (e) => this._onSunk(e));
  }

  /** Where a named ship keeps station — deterministic per world seed. */
  anchorFor(id) {
    const def = NAMED_SHIPS[id];
    const home = CLANS[def.clanId].homeRegion;
    const rng = mulberry32((this.game.seed ^ id.length * 7919 ^ 0x5eaf) >>> 0);
    const a = rng() * TAU;
    return {
      x: home.x * REGION_SIZE + Math.cos(a) * PATROL_RADIUS,
      y: home.y * REGION_SIZE + Math.sin(a) * PATROL_RADIUS,
    };
  }

  update(dt) {
    this._checkTimer -= dt;
    if (this._checkTimer > 0) return;
    this._checkTimer = 2.5;
    const { ship, world } = this.game;

    // Retire any that have wandered off or gone down.
    for (const [id, s] of [...this._live]) {
      if (s.state === 'gone' || !this.game.combat.ships.includes(s)) this._live.delete(id);
    }

    for (const id of NAMED_IDS) {
      if (this.defeated.has(id) || this._live.has(id)) continue;
      const anchor = this.anchorFor(id);
      if (Math.hypot(anchor.x - ship.x, anchor.y - ship.y) > APPROACH) continue;
      // Put her on the water just off the player's bow quarter, in water
      // that actually exists.
      const a = Math.random() * TAU;
      const x = ship.x + Math.cos(a) * 420;
      const y = ship.y + Math.sin(a) * 420;
      if (!world.isOpenWater(x, y)) continue;
      this._spawn(id, x, y);
    }
  }

  _spawn(id, x, y) {
    const def = NAMED_SHIPS[id];
    const { game } = this;
    const s = new AIShip(def.type, x, y, 4);
    s.maxHull = Math.round(s.maxHull * def.hullMult);
    s.hull = s.maxHull;
    s.cannons = def.cannons;
    s.cannonDamage += def.damageBonus;
    s.maxSpeed *= def.speedMult;
    s.crewCount += 4;
    s.clanId = def.clanId;
    s.shipName = def.name;
    s.hullScale = def.scale;
    s.namedId = id;
    s.lootTable = 'pirateShip';
    // A named ship answers to nobody's standing but its own: it will not
    // start a fight with a captain its clan likes, and it absolutely will
    // with one they do not.
    s.hostileToPlayer = game.clans.rep[def.clanId] < 20;
    game.combat.ships.push(s);
    this._live.set(id, s);

    if (!this.seen.has(id)) {
      this.seen.add(id);
      game.collection?.discover('named', id);
    }
    game.hud.toast(def.sighting, CLANS[def.clanId].color);
    game.events.emit('sfx', 'alert');
    game.events.emit('named:sighted', { id, ...def });
    game.audio?.setMusicMode?.('boss');
  }

  _onSunk(e) {
    const id = [...this._live].find(([, s]) => s.id === e.id)?.[0];
    if (!id) return;
    this._live.delete(id);
    this.game.audio?.setMusicMode?.('normal');
    if (!e.byPlayer) return;

    const def = NAMED_SHIPS[id];
    this.defeated.add(id);
    const { game } = this;
    game.resources.coins += def.reward.gold;
    game.player.addXp(def.reward.xp);
    game.inventory.addAnywhere(def.reward.item, 1);
    game.events.emit('resources:changed', { ...game.resources });
    game.events.emit('resources:earned', def.reward.gold);
    game.events.emit('named:defeated', { id, ...def });
    game.events.emit('sfx', 'victory');
    game.ads?.happytime?.();
    // Killing a clan's flagship is not a small thing.
    game.clans.add(def.clanId, -25);
    game.clans.strength[def.clanId] = Math.max(15, game.clans.strength[def.clanId] - 12);
    for (const other of Object.keys(CLANS)) {
      if (other !== def.clanId && game.clans.atWar(def.clanId, other)) game.clans.add(other, 10);
    }
    game.clans._note(`${def.name} goes down. ${CLANS[def.clanId].short} reels.`);
    game.showMessage?.(
      def.name,
      `${def.tale}<br><br><b>${def.captain}</b> is finished.`,
      `+${def.reward.gold} gold · ${def.reward.item ? 'a relic taken from her hold' : ''}`,
    );
    game.save();
  }

  /** For the Clans tab: what the player knows about each great ship. */
  roster() {
    return NAMED_IDS.map((id) => ({
      id,
      ...NAMED_SHIPS[id],
      seen: this.seen.has(id),
      defeated: this.defeated.has(id),
    }));
  }

  serialize() {
    return { defeated: [...this.defeated], seen: [...this.seen] };
  }
}
