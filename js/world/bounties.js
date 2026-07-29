// The bounty board.
//
// Every port posts wanted captains. Taking a contract starts a hunt: the
// target is a real ship with a real position that keeps sailing whether
// or not the player is anywhere near it. Get close and it materialises
// as an AI ship you can fight; lose it and it keeps running.
//
// The hunt is deliberately losable. A bounty can slip away when its
// escape clock runs out, or be claimed by some other captain first —
// which is what makes intercepting one feel like a chase rather than a
// pickup. Only one bounty runs at a time, so the arrow on the compass
// always means exactly one thing.

import { mulberry32, pick, rangeInt, range } from '../util/random.js';
import { randomAppearance } from '../render/pirate.js';
import { AIShip } from '../entities/aiship.js';
import { TAU } from '../util/math.js';

const EPITHET = ['Red', 'Black', 'Mad', 'Iron', 'Bloody', 'Grim', 'Silent', 'Gilded',
  'One-Eyed', 'Salt', 'Cruel', 'Laughing', 'Pale', 'Hungry'];
const GIVEN = ['Anne', 'Marcus', 'Esteban', 'Nadia', 'Cormac', 'Yusuf', 'Ilsa', 'Rook',
  'Vale', 'Delacroix', 'Okonkwo', 'Sable', 'Mireille', 'Hargrave'];
const SHIPNAME = ['Vulture', 'Widowmaker', 'Black Tide', 'Gallows Wind', 'Carrion',
  'Sea Wolf', 'Iron Verdict', 'Last Coin', 'Drowned Crown', 'Hangman\'s Bell'];
const CRIME = [
  'Sank three grain hulks off the shallows and left no survivors.',
  'Burned a harbour to the waterline over an unpaid debt.',
  'Took a governor\'s daughter and returned only her rings.',
  'Cut out a navy brig from her own anchorage in daylight.',
  'Sold an entire crew to the reef and called it weather.',
  'Robbed the tithe barge, twice, on the same tide.',
  'Keelhauled a magistrate for reading the charges too slowly.',
  'Runs guns to anyone with coin and no questions worth asking.',
];

/** Difficulty bands: the poster's skull rating. */
const RANKS = [
  { skulls: 1, name: 'Wanted',   hullMult: 1.0, reward: 400 },
  { skulls: 2, name: 'Notorious', hullMult: 1.5, reward: 900 },
  { skulls: 3, name: 'Feared',   hullMult: 2.1, reward: 1700 },
  { skulls: 4, name: 'Dreaded',  hullMult: 3.0, reward: 3200 },
  { skulls: 5, name: 'Legendary', hullMult: 4.2, reward: 6000 },
];

/** How far the player must be before the target is only simulated. */
const MATERIALIZE_RADIUS = 780;
/** Simulated cruising speed while off-screen (world px/s). */
const CRUISE = 46;

export class Bounties {
  constructor(game, saved) {
    this.game = game;
    /** The one active hunt, or null. */
    this.active = saved?.active ? { ...saved.active } : null;
    /** Poster ids already taken/claimed, so a board never re-offers them. */
    this.done = new Set(saved?.done ?? []);
    this._ship = null; // live AIShip while materialised
    this._courseTimer = 0;

    game.events.on('ship:sunk', (e) => this._onSunk(e));
  }

  /* ---- the board ------------------------------------------------------ */

  /** Deterministic posters for a port on a given day. */
  offersAt(port) {
    const day = this.game.dayNight.day;
    const rng = mulberry32((port.seed ^ (day * 0x51ed) ^ 0xb0b0) >>> 0);
    const tier = this.game.tierAt(port.x, port.y);
    const out = [];
    for (let i = 0; i < 3; i++) {
      const seed = (port.seed ^ (day * 977) ^ (i * 7717)) >>> 0;
      const r = mulberry32(seed);
      // Rank drifts up with distance from spawn, so far ports post the
      // names worth chasing.
      const rank = Math.min(4, Math.max(0, rangeInt(r, 0, 2) + Math.floor(tier / 2)));
      const def = RANKS[rank];
      const id = `bounty:${port.seed}:${day}:${i}`;
      out.push({
        id,
        name: `${pick(r, EPITHET)} ${pick(r, GIVEN)}`,
        shipName: `The ${pick(r, SHIPNAME)}`,
        crime: pick(r, CRIME),
        rank,
        skulls: def.skulls,
        rankName: def.name,
        reward: Math.round(def.reward * range(r, 0.9, 1.2)),
        hullMult: def.hullMult,
        tier: tier + rank,
        appearance: randomAppearance((seed ^ 0xface) >>> 0),
        seed,
        portName: port.name,
        taken: this.done.has(id) || this.active?.id === id,
      });
    }
    return out;
  }

  get hasActive() {
    return !!this.active;
  }

  accept(offer, port) {
    if (this.active) return false;
    // Start the target a good sail away, in open water, so accepting is
    // the beginning of a hunt rather than a fight already in progress.
    const a = Math.random() * TAU;
    const d = 1400 + Math.random() * 1200;
    this.active = {
      id: offer.id,
      name: offer.name,
      shipName: offer.shipName,
      crime: offer.crime,
      rank: offer.rank,
      skulls: offer.skulls,
      rankName: offer.rankName,
      reward: offer.reward,
      hullMult: offer.hullMult,
      tier: offer.tier,
      appearance: offer.appearance,
      seed: offer.seed,
      portName: port.name,
      x: Math.round(port.x + Math.cos(a) * d),
      y: Math.round(port.y + Math.sin(a) * d),
      heading: Math.random() * TAU,
      // Generous but finite: long enough to cross open water, short
      // enough that dawdling costs you the contract.
      escapeIn: 420 + offer.rank * 90,
      hull: null, // filled once materialised, so damage persists
    };
    this.game.events.emit('bounty:accepted', { ...this.active });
    this.game.events.emit('sfx', 'ui');
    this.game.hud.toast(`Hunt begun: ${offer.name}`, '#e0b345');
    return true;
  }

  abandon() {
    if (!this.active) return;
    const name = this.active.name;
    this._releaseShip();
    this.done.add(this.active.id);
    this.active = null;
    this.game.hud.toast(`Abandoned the hunt for ${name}.`, '#c8cdd2');
    this.game.events.emit('bounty:ended', { reason: 'abandoned' });
  }

  /* ---- the hunt -------------------------------------------------------- */

  update(dt) {
    const b = this.active;
    if (!b) return;
    const { game } = this;

    b.escapeIn -= dt;
    if (b.escapeIn <= 0) {
      this._fail(`${b.name} slipped over the horizon.`);
      return;
    }

    // Someone else may get there first. Rare, but it makes the clock feel
    // like other captains are hunting the same name — which they are.
    if (Math.random() < dt / 900) {
      this._fail(`Word from port: ${b.name} was taken by another crew.`);
      return;
    }

    const dist = Math.hypot(b.x - game.ship.x, b.y - game.ship.y);

    // ---- materialised: a real ship on the water ------------------------
    if (this._ship) {
      if (this._ship.state === 'gone' || !game.combat.ships.includes(this._ship)) {
        // Culled by distance or sunk elsewhere — fall back to simulation
        // from wherever it actually got to.
        b.x = Math.round(this._ship.x);
        b.y = Math.round(this._ship.y);
        b.heading = this._ship.heading;
        b.hull = this._ship.state === 'sailing' ? this._ship.hull : b.hull;
        this._ship = null;
      } else {
        b.x = Math.round(this._ship.x);
        b.y = Math.round(this._ship.y);
        b.heading = this._ship.heading;
        b.hull = this._ship.hull;
        return;
      }
    }

    // ---- close enough to meet: put a hull under the name ----------------
    if (dist < MATERIALIZE_RADIUS && game.world.isOpenWater(b.x, b.y)) {
      this._materialize();
      return;
    }

    // ---- simulated: keeps sailing whether or not anyone is watching -----
    this._courseTimer -= dt;
    if (this._courseTimer <= 0) {
      this._courseTimer = 4 + Math.random() * 5;
      b.heading += (Math.random() - 0.5) * 1.1;
    }
    const nx = b.x + Math.cos(b.heading) * CRUISE * dt;
    const ny = b.y + Math.sin(b.heading) * CRUISE * dt;
    // isOpenWater only knows about chunks that are actually loaded, so
    // out in ungenerated water this always passes — the target sails
    // freely and only steers around land near the player, which is the
    // only land anyone can see it hit.
    if (game.world.isOpenWater(nx, ny)) {
      b.x = nx;
      b.y = ny;
    } else {
      b.heading += 1.4;
    }
  }

  _materialize() {
    const b = this.active;
    const { game } = this;
    const s = new AIShip('pirate', b.x, b.y, b.tier);
    s.maxHull = Math.round(s.maxHull * b.hullMult);
    s.hull = b.hull ?? s.maxHull;
    s.cannons += Math.ceil(b.rank / 2);
    s.cannonDamage += b.rank * 2;
    s.crewCount += b.rank;
    s.maxSpeed *= 1.08;
    s.hostileToPlayer = true;
    s.bountyId = b.id;
    s.customLabel = b.shipName;
    s.lootTable = 'pirateShip';
    game.combat.ships.push(s);
    this._ship = s;
    game.hud.toast(`${b.name} sighted!`, '#e05a4a');
    game.events.emit('sfx', 'alert');
    game.events.emit('bounty:sighted', { ...b });
  }

  _releaseShip() {
    if (!this._ship) return;
    const i = this.game.combat.ships.indexOf(this._ship);
    if (i >= 0) this.game.combat.ships.splice(i, 1);
    this._ship = null;
  }

  _onSunk(e) {
    const b = this.active;
    if (!b || !this._ship || this._ship.id !== e.id) return;
    this._ship = null;
    if (!e.byPlayer) {
      this._fail(`${b.name} went down — but not to your guns.`);
      return;
    }
    // Claimed.
    this.done.add(b.id);
    this.game.resources.coins += b.reward;
    this.game.player.addXp(60 + b.rank * 45);
    this.game.events.emit('resources:changed', { ...this.game.resources });
    this.game.events.emit('resources:earned', b.reward);
    this.game.events.emit('bounty:claimed', { ...b });
    this.game.events.emit('sfx', 'victory');
    this.game.hud.toast(`Bounty claimed: ${b.name} — ${b.reward} gold`, '#f0a83c');
    this.active = null;
    this.game.save();
  }

  _fail(message) {
    this._releaseShip();
    this.done.add(this.active.id);
    this.active = null;
    this.game.hud.toast(message, '#e05a4a');
    this.game.events.emit('bounty:ended', { reason: 'lost' });
    this.game.save();
  }

  /* ---- readouts -------------------------------------------------------- */

  /** Compass arrow target (hud.js), or null. */
  trackedTarget() {
    return this.active ? { x: this.active.x, y: this.active.y } : null;
  }

  /** Minutes:seconds left before the target escapes. */
  get escapeClock() {
    if (!this.active) return null;
    const s = Math.max(0, Math.round(this.active.escapeIn));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  serialize() {
    return {
      active: this.active ? { ...this.active } : null,
      done: [...this.done].slice(-60), // only recent boards matter
    };
  }
}
