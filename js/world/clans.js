// Pirate Clans — the spine the rest of the game hangs off.
//
// This takes over from the old faction standing system rather than
// sitting beside it: the API other systems already call (rep, add,
// label, isHostile, isFriendly, priceMult) is preserved exactly, so
// shops, spawners and quests keep working while the meaning underneath
// becomes "which clan is this".
//
// Six clans hold the sea between them. Every NPC ship flies one of their
// colours, every port answers to one of them, and they fight each other
// over both whether or not the player is involved. Territory is a coarse
// grid: a clan's influence radiates from its home waters, so sailing far
// enough in any direction takes you into somebody's back yard.

import { clamp } from '../util/math.js';
import { mulberry32, pick } from '../util/random.js';

/** One region = one square of the control grid, in world pixels. */
export const REGION_SIZE = 3200;

export const CLANS = {
  crimson: {
    name: 'The Crimson Tide',
    short: 'Crimson',
    color: '#c9384a',
    accent: '#f0d0a0',
    emblem: 'blade',
    leader: 'Admiral Rosa Sanguine',
    leaderTitle: 'the Red Verdict',
    personality: 'Aggressive',
    playstyle: 'Attacks on sight. Fields the heaviest raiders on the water and expects tribute from everyone else.',
    home: 'The Bleeding Shoals',
    homeRegion: { x: 2, y: -1 },
    baseRep: -20,
    shipTypes: ['pirate', 'pirate', 'navy'],
    motto: 'The sea takes. We take first.',
  },
  ashen: {
    name: 'Ashen Company',
    short: 'Ashen',
    color: '#8a8f9a',
    accent: '#d8dde4',
    emblem: 'anchor',
    leader: 'Commodore Iyare Okonkwo',
    leaderTitle: 'the Grey Wall',
    personality: 'Disciplined',
    playstyle: 'A professional fleet that keeps order in its waters. Slow to anger, impossible to shake off once angered.',
    home: 'Greyharbour Reach',
    homeRegion: { x: -2, y: -2 },
    baseRep: 10,
    shipTypes: ['navy', 'navy', 'merchant'],
    motto: 'Order, or nothing.',
  },
  goldwake: {
    name: 'The Goldwake Consortium',
    short: 'Goldwake',
    color: '#e0b345',
    accent: '#fff0c0',
    emblem: 'coin',
    leader: 'Factor Mireille Vasque',
    leaderTitle: 'the Ledger',
    personality: 'Mercantile',
    playstyle: 'Buys what it cannot sink. Friendly while you are profitable, and it remembers every coin.',
    home: 'The Bullion Run',
    homeRegion: { x: 1, y: 2 },
    baseRep: 15,
    shipTypes: ['merchant', 'merchant', 'civilian'],
    motto: 'Every wave has a price.',
  },
  nightglass: {
    name: 'Nightglass Covenant',
    short: 'Nightglass',
    color: '#9b6ef0',
    accent: '#e0d0ff',
    emblem: 'eye',
    leader: 'The Whisper',
    leaderTitle: 'name unknown',
    personality: 'Secretive',
    playstyle: 'Smugglers and spies. They will not start a fight, but they know exactly where you sleep.',
    home: 'The Drowned Lanterns',
    homeRegion: { x: -2, y: 2 },
    baseRep: 0,
    shipTypes: ['civilian', 'pirate', 'ghost'],
    motto: 'We were never here.',
  },
  tideborn: {
    name: 'The Tideborn',
    short: 'Tideborn',
    color: '#3fc2b0',
    accent: '#d0fff8',
    emblem: 'wave',
    leader: 'Mother Kelune',
    leaderTitle: 'Voice of the Deep',
    personality: 'Zealous',
    playstyle: 'They serve something older than flags. Peaceful until you disturb the drowned places.',
    home: 'The Sunken Choir',
    homeRegion: { x: 0, y: -3 },
    baseRep: 5,
    shipTypes: ['ghost', 'civilian', 'fishing'],
    motto: 'The deep keeps its own.',
  },
  saltborn: {
    name: 'Saltborn Free Company',
    short: 'Saltborn',
    color: '#6fce62',
    accent: '#e0ffd8',
    emblem: 'gull',
    leader: 'Captain Bram Halloway',
    leaderTitle: 'the Unhanged',
    personality: 'Independent',
    playstyle: 'Free captains who answer to nobody. Fair to those who are fair, and the readiest to take an outsider in.',
    home: 'The Open Reach',
    homeRegion: { x: 3, y: 2 },
    baseRep: 20,
    shipTypes: ['fishing', 'civilian', 'merchant'],
    motto: 'No crown, no chain.',
  },
};

export const CLAN_IDS = Object.keys(CLANS);

/** Standing bands. Kept identical to the old faction ladder. */
const STANDING_LABELS = [
  [-60, 'Hunted'], [-25, 'Hostile'], [-5, 'Unfriendly'], [20, 'Neutral'],
  [55, 'Friendly'], [90, 'Honored'], [101, 'Sworn'],
];

/** What each standing band opens up. Shown verbatim in the clan profile. */
export const REP_PERKS = [
  { at: -60, text: 'Their fleets hunt you on sight.', bad: true },
  { at: -25, text: 'Their ships turn hostile when you come near.', bad: true },
  { at: 20, text: 'Their ports trade with you at ordinary prices.' },
  { at: 40, text: 'Discounts at ports they control.' },
  { at: 55, text: 'Their crews will take your coin and join you.' },
  { at: 70, text: 'Exclusive contracts from their harbourmasters.' },
  { at: 90, text: 'Rare hulls released from their private slips.' },
  { at: 100, text: 'They will sail with you as sworn allies.' },
];

/** A clan holds its harbours until its fleet strength falls below this. */
const CLAIM_STRENGTH = 45;
/** What the garrison wants to change sides. */
const CLAIM_COST = 5000;

export function regionKey(x, y) {
  return `${Math.round(x / REGION_SIZE)},${Math.round(y / REGION_SIZE)}`;
}

export class Clans {
  constructor(game, saved) {
    this.game = game;
    this.rep = {};
    for (const id of CLAN_IDS) {
      this.rep[id] = saved?.rep?.[id] ?? CLANS[id].baseRep;
    }
    // Fleet strength drives who wins wars and how many hulls they field.
    this.strength = saved?.strength ?? Object.fromEntries(
      CLAN_IDS.map((id) => [id, 60 + Math.round(Math.random() * 40)]),
    );
    /** regionKey -> clanId. Grown lazily from home waters outward. */
    this.territory = new Map(Object.entries(saved?.territory ?? {}));
    /** portSeed -> clanId. Ports are the prize worth fighting over. */
    this.ports = new Map(Object.entries(saved?.ports ?? {}));
    /** Active wars as "a|b" pair keys, and alliances the same way. */
    this.wars = new Set(saved?.wars ?? []);
    this.allies = new Set(saved?.allies ?? []);
    /** The player's own clan, once founded. */
    this.playerClan = saved?.playerClan ?? null;
    this.log = saved?.log ?? [];

    this._warTimer = saved?.warTimer ?? 40;
    this._seed = game.seed >>> 0;

    if (!this.wars.size && !saved) this._seedDiplomacy();
    this._wire();
  }

  /* ---- setup ---------------------------------------------------------- */

  _seedDiplomacy() {
    // The world starts mid-argument rather than at peace: two wars and an
    // alliance, so the first thing the player sees is a sea in motion.
    const rng = mulberry32(this._seed ^ 0xc1a4);
    this.declareWar('crimson', 'ashen', true);
    this.declareWar('nightglass', 'goldwake', true);
    this.makeAllies('saltborn', pick(rng, ['tideborn', 'goldwake']), true);
  }

  _wire() {
    const ev = this.game.events;
    ev.on('ship:sunk', (e) => {
      if (!e.byPlayer || !e.clanId) return;
      const clan = e.clanId;
      this.add(clan, -10);
      // Sinking a clan's ship endears you to everyone at war with them,
      // which is how a player drifts into somebody's orbit without ever
      // choosing a side outright.
      for (const other of CLAN_IDS) {
        if (other === clan) continue;
        if (this.atWar(clan, other)) this.add(other, 4);
        else if (this.areAllied(clan, other)) this.add(other, -4);
      }
      // Losses cost the clan real standing in the world.
      this.strength[clan] = Math.max(10, this.strength[clan] - 1);
    });
    ev.on('survivor:rescued', (e) => {
      if (e?.clanId) this.add(e.clanId, 6);
    });
    ev.on('quest:completed', (q) => {
      const clan = q?.clanId ?? this.portOwner(q?.originPort);
      if (clan) this.add(clan, 8);
    });
    ev.on('bounty:claimed', (b) => {
      // Bounty targets are outlaws even by clan standards.
      if (b?.clanId) this.add(b.clanId, -6);
      for (const id of CLAN_IDS) if (id !== b?.clanId) this.add(id, 2);
    });
    ev.on('boss:defeated', () => this.add('tideborn', 10));
    ev.on('dungeon:cleared', () => this.add('tideborn', 5));
  }

  /* ---- reputation (the old Factions surface, preserved) --------------- */

  add(id, amount) {
    if (!(id in this.rep)) return;
    const before = this.rep[id];
    this.rep[id] = clamp(Math.round(this.rep[id] + amount), -100, 100);
    if (this.rep[id] === before) return;
    this.game.events.emit('clan:rep', { id, rep: this.rep[id], delta: this.rep[id] - before });
    this.game.events.emit('faction:changed', { id, rep: this.rep[id] });
    const cross = (t) => (before < t) !== (this.rep[id] < t);
    if (cross(-25) || cross(55) || cross(-60) || cross(90)) {
      this.game.hud.toast(`${CLANS[id].name}: now ${this.label(id)}`, CLANS[id].color);
    }
  }

  label(id) {
    const r = this.rep[id];
    for (const [max, text] of STANDING_LABELS) if (r < max) return text;
    return 'Sworn';
  }

  isHostile(id) {
    return this.rep[id] < -25;
  }

  isFriendly(id) {
    return this.rep[id] >= 55;
  }

  /** Below this they do not merely dislike you — they come looking. */
  isHunting(id) {
    return this.rep[id] < -60;
  }

  /**
   * Shop prices. The old signature took a shop key; it now also accepts a
   * port so the controlling clan's standing is what actually moves the
   * price — which is the point of holding a harbour.
   */
  priceMult(shopKey, port = null) {
    const owner = port ? this.portOwner(port) : null;
    let mult = 1;
    if (owner === 'player') {
      mult = 0.75; // your own harbour charges you the best price there is
    } else if (owner) {
      const r = this.rep[owner] ?? 0;
      mult *= clamp(1 - r * 0.0025, 0.75, 1.3);
    }
    if (shopKey === 'black') mult *= 1.0; // the port UI already marks black-market goods up
    return clamp(mult, 0.7, 1.35);
  }

  /** Average standing across all clans — the gate on founding your own. */
  get globalRep() {
    return Math.round(CLAN_IDS.reduce((n, id) => n + this.rep[id], 0) / CLAN_IDS.length);
  }

  /** Perks unlocked with a clan at the current standing. */
  perks(id) {
    const r = this.rep[id];
    return REP_PERKS.filter((p) => (p.bad ? r <= p.at : r >= p.at));
  }

  /* ---- diplomacy ------------------------------------------------------ */

  static pairKey(a, b) {
    return [a, b].sort().join('|');
  }

  atWar(a, b) {
    return this.wars.has(Clans.pairKey(a, b));
  }

  areAllied(a, b) {
    return this.allies.has(Clans.pairKey(a, b));
  }

  warsOf(id) {
    return CLAN_IDS.filter((o) => o !== id && this.atWar(id, o));
  }

  alliesOf(id) {
    return CLAN_IDS.filter((o) => o !== id && this.areAllied(id, o));
  }

  declareWar(a, b, quiet = false) {
    const key = Clans.pairKey(a, b);
    if (this.wars.has(key)) return;
    this.allies.delete(key);
    this.wars.add(key);
    this._note(`${CLANS[a].short} declares war on ${CLANS[b].short}.`);
    if (!quiet) {
      this.game.hud?.toast(`War! ${CLANS[a].name} against ${CLANS[b].name}`, CLANS[a].color);
      this.game.events.emit('clan:war', { a, b });
    }
  }

  makePeace(a, b) {
    const key = Clans.pairKey(a, b);
    if (!this.wars.delete(key)) return;
    this._note(`${CLANS[a].short} and ${CLANS[b].short} agree terms.`);
    this.game.events.emit('clan:peace', { a, b });
  }

  makeAllies(a, b, quiet = false) {
    const key = Clans.pairKey(a, b);
    if (this.allies.has(key)) return;
    this.wars.delete(key);
    this.allies.add(key);
    this._note(`${CLANS[a].short} and ${CLANS[b].short} sign an accord.`);
    if (!quiet) this.game.events.emit('clan:alliance', { a, b });
  }

  _note(text) {
    this.log.unshift({ text, day: this.game.dayNight?.day ?? 0 });
    if (this.log.length > 24) this.log.pop();
  }

  /* ---- territory ------------------------------------------------------ */

  /**
   * Who holds this stretch of sea. Regions are resolved lazily and then
   * remembered, so the map only materialises where anyone has actually
   * sailed — the same trick the world generator uses for chunks.
   */
  ownerOfRegion(x, y) {
    const key = regionKey(x, y);
    const held = this.territory.get(key);
    if (held) return held;
    const rx = Math.round(x / REGION_SIZE);
    const ry = Math.round(y / REGION_SIZE);
    // Nearest home waters wins, with a deterministic wobble so borders
    // are ragged rather than a Voronoi diagram of straight lines.
    const rng = mulberry32(((rx * 73856093) ^ (ry * 19349663) ^ this._seed) >>> 0);
    let best = null;
    let bestD = Infinity;
    for (const id of CLAN_IDS) {
      const h = CLANS[id].homeRegion;
      const d = Math.hypot(rx - h.x, ry - h.y) + rng() * 1.1
        - (this.strength[id] - 70) / 60; // strong clans push their borders out
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    this.territory.set(key, best);
    return best;
  }

  /**
   * Resolve a clan id to its definition. Harbours the player has taken
   * report an owner of 'player', which is not in the CLANS table — every
   * consumer that wants a name or a colour goes through here.
   */
  def(id) {
    if (id === 'player') return this.playerClan;
    return CLANS[id] ?? null;
  }

  /** Clan that controls a port (falls back to its region). */
  portOwner(port) {
    if (!port) return null;
    const key = String(port.seed ?? port);
    const held = this.ports.get(key);
    if (held) return held;
    if (port.x === undefined) return null;
    const owner = this.ownerOfRegion(port.x, port.y);
    this.ports.set(key, owner);
    return owner;
  }

  setPortOwner(port, clanId) {
    this.ports.set(String(port.seed), clanId);
  }

  /** Every port the player has actually seen, grouped by holder. */
  portCount(clanId) {
    let n = 0;
    for (const owner of this.ports.values()) if (owner === clanId) n++;
    return n;
  }

  fleetSize(clanId) {
    // Strength and held harbours both feed the number of hulls they can
    // put to sea; this is the figure the Clans tab reports.
    return Math.max(3, Math.round(this.strength[clanId] / 8) + this.portCount(clanId) * 2);
  }

  /* ---- the world moves on -------------------------------------------- */

  update(dt) {
    this._warTimer -= dt;
    if (this._warTimer > 0) return;
    this._warTimer = 45 + Math.random() * 45;
    this._tickWorld();
  }

  /**
   * One turn of the world's own politics. Wars grind strength down,
   * winners take harbours, and the diplomatic map reshuffles slowly —
   * all of it independent of anything the player is doing.
   */
  _tickWorld() {
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);

    // Wars cost both sides, and the stronger side gains ground.
    for (const key of [...this.wars]) {
      const [a, b] = key.split('|');
      const swing = (this.strength[a] - this.strength[b]) / 40;
      this.strength[a] = clamp(Math.round(this.strength[a] + swing - rng() * 2), 15, 140);
      this.strength[b] = clamp(Math.round(this.strength[b] - swing - rng() * 2), 15, 140);

      // The winner takes a harbour off the loser, if the player has seen
      // one to take. Ports the player has never visited are not yet real.
      const winner = this.strength[a] >= this.strength[b] ? a : b;
      const loser = winner === a ? b : a;
      if (rng() < 0.45) this._captureFrom(loser, winner);

      // Exhausted wars end.
      if (rng() < 0.18 || this.strength[loser] < 25) this.makePeace(a, b);
    }

    // Peacetime clans slowly rebuild.
    for (const id of CLAN_IDS) {
      if (!this.warsOf(id).length) {
        this.strength[id] = clamp(this.strength[id] + 1, 15, 140);
      }
    }

    // New quarrels and new friendships.
    if (rng() < 0.3) {
      const a = pick(rng, CLAN_IDS);
      const b = pick(rng, CLAN_IDS.filter((x) => x !== a));
      if (!this.atWar(a, b) && !this.areAllied(a, b)) {
        if (rng() < 0.65) this.declareWar(a, b);
        else this.makeAllies(a, b);
      }
    }

    this.game.events.emit('clan:worldtick');
  }

  _captureFrom(loser, winner) {
    const held = [...this.ports.entries()].filter(([, o]) => o === loser);
    if (!held.length) return;
    const [portKey] = held[(Math.random() * held.length) | 0];
    this.ports.set(portKey, winner);
    const name = this.game.mapData?.ports?.find((p) => String(p.seed) === portKey)?.name;
    this._note(`${CLANS[winner].short} takes ${name ?? 'a harbour'} from ${CLANS[loser].short}.`);
    if (name) {
      this.game.hud?.toast(`${CLANS[winner].name} has taken ${name}!`, CLANS[winner].color);
    }
    this.game.events.emit('clan:portcaptured', { portKey, winner, loser, name });
  }

  /* ---- taking a harbour ------------------------------------------------ */

  /**
   * Can this port be claimed for the player's clan, and if not, why?
   * A harbour changes hands when its holder's grip slips — which is what
   * sinking their ships and their lost wars actually do to `strength`.
   * That makes "conquer a region" a consequence of ordinary play rather
   * than a separate button.
   */
  claimCheck(port) {
    const owner = this.portOwner(port);
    if (!this.playerClan) {
      return { ok: false, reason: 'You have no colours of your own to raise here.' };
    }
    if (owner === 'player') return { ok: false, reason: 'This harbour already flies your flag.' };
    const strength = this.strength[owner] ?? 100;
    if (strength >= CLAIM_STRENGTH) {
      return {
        ok: false,
        reason: `${CLANS[owner].name} still holds this coast firmly.`,
        need: `Break their fleet below ${CLAIM_STRENGTH} — sink their ships. (Now ${strength})`,
        strength,
      };
    }
    if (this.game.resources.coins < CLAIM_COST) {
      return {
        ok: false,
        reason: `The garrison wants ${CLAIM_COST} gold to change sides.`,
        need: `${CLAIM_COST - this.game.resources.coins} more gold`,
        strength,
      };
    }
    return { ok: true, cost: CLAIM_COST, owner, strength };
  }

  claimPort(port) {
    const check = this.claimCheck(port);
    if (!check.ok) return false;
    const loser = check.owner;
    this.game.resources.coins -= CLAIM_COST;
    this.ports.set(String(port.seed), 'player');
    this.strength[loser] = Math.max(10, this.strength[loser] - 8);
    this.add(loser, -18);
    this._note(`${this.playerClan.short} takes ${port.name} from ${CLANS[loser].short}.`);
    this.game.events.emit('resources:changed', { ...this.game.resources });
    this.game.events.emit('clan:portclaimed', { port, loser });
    this.game.events.emit('sfx', 'victory');
    this.game.hud.notify(`${port.name} is yours.`, {
      kind: 'flag',
      detail: `${this.playerClan.name} now holds ${this.portCount('player')} harbour(s).`,
      color: this.playerClan.color,
      hold: 7000,
    });
    this.game.save();
    return true;
  }

  /* ---- the player's own clan ------------------------------------------ */

  get canFound() {
    return !this.playerClan && this.globalRep >= 35;
  }

  foundClan({ name, color, emblem, flagBody, flagMark }) {
    this.playerClan = {
      name,
      short: name.split(' ').slice(-1)[0],
      color,
      accent: '#f4ecd8',
      emblem,
      flagBody,
      flagMark,
      leader: 'You',
      founded: this.game.dayNight?.day ?? 0,
      members: [],
    };
    this._note(`${name} raises its colours for the first time.`);
    this.game.events.emit('clan:founded', { ...this.playerClan });
    this.game.hud?.toast(`${name} sails under its own flag!`, color);
    return this.playerClan;
  }

  serialize() {
    return {
      rep: { ...this.rep },
      strength: { ...this.strength },
      // Only regions the player has actually reached are worth storing.
      territory: Object.fromEntries([...this.territory].slice(-400)),
      ports: Object.fromEntries(this.ports),
      wars: [...this.wars],
      allies: [...this.allies],
      playerClan: this.playerClan,
      log: this.log.slice(0, 24),
      warTimer: this._warTimer,
    };
  }
}
