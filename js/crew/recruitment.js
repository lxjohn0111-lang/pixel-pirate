// Recruitment: how pirates from other clans end up flying your colours.
//
// There are five ways in, and they are deliberately different in feel
// rather than five buttons that all mean "pay":
//
//   pay      — coin at a tavern. Cheap for deckhands, ruinous for officers.
//   defeat   — win a boarding and the survivors can be talked round.
//   captain  — beat a bounty captain and their crew may follow you instead.
//   rescue   — pull someone off a wreck and they owe you.
//   quest    — do a clan's work and they lend you their people.
//
// Every route runs through the same check, so a pirate who is out of
// reach is out of reach whichever door you knock on. What changes is the
// pull each route brings: a captain you have just beaten is far easier to
// turn than one you are trying to buy.

import { RANKS, rankFor, createCrewMember } from './crew.js';
import { CLANS } from '../world/clans.js';

/** How much persuasion each route brings on its own. */
const ROUTE_PULL = {
  pay: 20,
  defeat: 45,
  captain: 60,
  rescue: 70,
  quest: 50,
};

const ROUTE_LABEL = {
  pay: 'paid their price',
  defeat: 'beaten on their own deck',
  captain: 'lost their captain to you',
  rescue: 'pulled from the water',
  quest: 'earned through service',
};

export class Recruitment {
  constructor(game) {
    this.game = game;
    /** Pending offers, e.g. survivors of a boarding you just won. */
    this.pending = [];

    game.events.on('boarding:end', (e) => {
      if (e.outcome === 'win') this._offerFromBoarding(e);
    });
    game.events.on('bounty:claimed', (b) => this._offerFromCaptain(b));
  }

  /**
   * Can this pirate be turned, and what is stopping them?
   * Returns { ok, chance, reason, need } — chance is 0..1.
   */
  evaluate(member, route) {
    const { clans } = this.game;
    const rank = RANKS.find((r) => r.id === member.rank) ?? rankFor(member.level);
    const clanId = member.originClan;
    const rep = clans.rep[clanId] ?? 0;
    const pull = (ROUTE_PULL[route] ?? 0) + (clans.playerClan ? 15 : 0);

    // Standing with their own clan cuts both ways: a clan that likes you
    // will release its people, one that hates you will not — but a pirate
    // you have just beaten cares rather less what their clan thinks.
    const repWeight = route === 'defeat' || route === 'captain' ? 0.25 : 0.6;
    const score = pull + rep * repWeight - rank.pull;

    if (rank.id === 'captain' && route === 'pay') {
      return { ok: false, chance: 0, reason: `${member.name} captains their own deck. Coin will not move them.` };
    }
    if (rep < -40 && route !== 'defeat' && route !== 'captain') {
      return {
        ok: false,
        chance: 0,
        reason: `${CLANS[clanId].name} would sooner drown than sail with you.`,
        need: `Standing above -40 with ${CLANS[clanId].short}`,
      };
    }
    if (score < 0) {
      return {
        ok: false,
        chance: 0,
        reason: `${member.name} is too senior to follow an outsider.`,
        need: `Better standing with ${CLANS[clanId].short}, or beat them in a fight`,
      };
    }
    return { ok: true, chance: Math.max(0.15, Math.min(1, score / 80)), reason: null };
  }

  /**
   * Try to recruit. Returns { joined, message }. Loyalty starts from how
   * willingly they came, which is what makes a bought officer flightier
   * than a rescued deckhand.
   */
  attempt(member, route, { free = false } = {}) {
    const { game } = this;
    const check = this.evaluate(member, route);
    if (!check.ok) return { joined: false, message: check.reason };
    if (game.crew.members.length >= game.crew.capacity) {
      return { joined: false, message: 'No berth free — your quarters are full.' };
    }
    const rank = RANKS.find((r) => r.id === member.rank) ?? rankFor(member.level);
    const price = free ? 0 : Math.round((40 + member.level * 35) * rank.wageMult);
    if (!free && game.resources.coins < price) {
      return { joined: false, message: `${price} gold needed to sign ${member.name}.` };
    }
    // Persuasion can fail; a signed contract cannot. Rolling dice on a
    // tavern hire only ever produces a re-click, since a refusal costs
    // the player nothing — so `pay` succeeds whenever they were willing
    // at all, and the drama lives in the routes where it means something.
    if (route !== 'pay' && Math.random() > check.chance) {
      return { joined: false, message: `${member.name} turns you down. For now.` };
    }
    if (!free) {
      game.resources.coins -= price;
      game.events.emit('resources:changed', { ...game.resources });
    }
    member.joinedBy = route;
    member.loyalty = Math.round(35 + check.chance * 45);
    if (!game.crew.recruit(member)) {
      return { joined: false, message: 'No berth free — your quarters are full.' };
    }
    // Poaching is noticed. Their old clan minds; that clan's enemies
    // rather enjoy it.
    const clanId = member.originClan;
    game.clans.add(clanId, route === 'pay' ? -2 : -5);
    for (const other of Object.keys(CLANS)) {
      if (other !== clanId && game.clans.atWar(clanId, other)) game.clans.add(other, 2);
    }
    if (game.clans.playerClan) {
      game.clans.playerClan.members = game.clans.playerClan.members ?? [];
      game.clans.playerClan.members.push({ id: member.id, name: member.name, rank: member.rank });
    }
    game.events.emit('crew:hired', { name: member.name, route });
    game.events.emit('clan:recruited', { member, route });
    game.hud.toast(`${member.name} joins your crew — ${ROUTE_LABEL[route]}.`, '#6fce62');
    return { joined: true, message: null, price };
  }

  /* ---- offers that arrive on their own -------------------------------- */

  _offerFromBoarding(e) {
    const ship = e.ship ?? null;
    const clanId = ship?.clanId ?? this.game.clans.ownerOfRegion(this.game.ship.x, this.game.ship.y);
    // Not every deck yields somebody worth taking.
    if (Math.random() > 0.45) return;
    const level = 1 + Math.floor(Math.random() * 4) + (ship?.tier ?? 0);
    this._queue(clanId, level, 'defeat',
      'One of the survivors would rather sail than swim.');
  }

  _offerFromCaptain(b) {
    if (!b?.clanId) return;
    this._queue(b.clanId, 5 + (b.rank ?? 0), 'captain',
      `With ${b.name} gone, their crew are looking for a new deck.`);
  }

  _queue(clanId, level, route, blurb) {
    const m = createCrewMember((Math.random() * 0xffffffff) >>> 0, level, clanId);
    this.pending.push({ member: m, route, blurb });
    this.game.events.emit('recruit:offer', { member: m, route, blurb });
  }

  takePending() {
    return this.pending.shift() ?? null;
  }
}
