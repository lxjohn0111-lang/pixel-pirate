// The Guide: Bosun Maddox as mentor.
//
// Maddox already stands on the deck as the story's first mate, so making
// him the guide costs nothing and means the voice explaining the game is
// a voice the player already knows. He speaks in barks — the small
// portrait at the edge of the screen that plays over live gameplay —
// because a mentor who freezes the world every time he has a thought is
// not a mentor, he is an interruption.
//
// Three jobs, in priority order:
//   1. Introduce a feature the first time it becomes reachable.
//   2. Narrate a new main-quest chapter.
//   3. If the player stalls, suggest the next thing worth doing.
//
// Everything is once-only and rate-limited, so nobody gets lectured
// twice about the same thing.

/**
 * Feature briefings. `when` decides the moment the feature has actually
 * become relevant — the point being to explain a thing when the player
 * can use it, not at the start when it is noise.
 */
const BRIEFINGS = [
  {
    id: 'sailing',
    when: () => true,
    delay: 4,
    text: 'Hold W to make way, A and D to put the helm over. She turns better with speed on her.',
  },
  {
    id: 'combat',
    when: (g) => g.combat.ships.some((s) => s.hostileToPlayer && Math.hypot(s.x - g.ship.x, s.y - g.ship.y) < 500),
    text: 'Guns fire from the sides, not the bow. Turn broadside on and hold Space.',
  },
  {
    id: 'clans',
    when: (g) => g.combat.ships.some((s) => s.clanId),
    text: 'Every hull out here flies somebody\'s colours — see the name over her? Press L for the Clans book. Who you sink decides who hates you.',
  },
  {
    id: 'port',
    when: (g) => !!g.ports.findNearby(),
    text: 'A harbour. Press F to tie up — the world stops while you are ashore, so take your time in there.',
  },
  {
    id: 'shipyard',
    when: (g) => g.stats.get('portsVisited') > 0 || g.mapData.ports.length > 0,
    text: 'Every port has a Shipyard. That is where a sloop becomes something worth being afraid of.',
  },
  {
    id: 'bounty',
    when: (g) => g.mapData.ports.length > 0 && g.player.level >= 2,
    text: 'The Bounty Board posts wanted captains. Take a name and your compass will find them — but they run, so do not dawdle.',
  },
  {
    id: 'crew',
    when: (g) => g.crew.members.length > 0,
    text: 'A hand aboard. They work the guns and fight beside you — and they can die doing it. Press C to see your crew.',
  },
  {
    id: 'treasure',
    when: (g) => g.treasureHunts.hunts.length > 0,
    text: 'An expedition. Read the chart, sail to the ring on your map, and the next clue turns up when you get there.',
  },
  {
    id: 'customize',
    when: (g) => g.resources.coins >= 400 && g.mapData.ports.length > 0,
    text: 'The Outfitter sells paint, sails and fittings. None of it makes you faster. All of it makes you recognisable.',
  },
  {
    id: 'clanFound',
    when: (g) => g.clans.canFound,
    text: 'Word has travelled far enough. Any harbourmaster will register colours of your own now — go and take them.',
  },
  {
    id: 'greatShip',
    when: (g) => g.namedShips.seen.size > 0,
    text: 'That is one of the five great ships. Do not take her on in a hull you like.',
  },
];

/** How long the player can do nothing before Maddox says something. */
const IDLE_SECONDS = 75;
/** Minimum gap between anything the guide says. */
const GAP = 26;

export class Guide {
  constructor(game, saved) {
    this.game = game;
    this.said = new Set(saved?.said ?? []);
    this.enabled = saved?.enabled ?? true;
    this._sinceSpoke = 12;
    this._idle = 0;
    this._lastPos = { x: 0, y: 0 };
    this._checkTimer = 2;
    this._pendingDelay = 0;
    this._pending = null;

    // A new chapter is the one moment worth speaking up unprompted.
    game.events.on('mainquest:chapter', (e) => {
      if (e.next) this._queue(`${e.next.title}. ${e.next.guide}`, 2.2);
    });
    game.events.on('clan:founded', (c) => {
      this._queue(`${c.name}. Took you long enough. Every hand we take from here sails under it.`, 1.5);
    });
  }

  /** Player asked for a hint directly (the tracker's "?" button). */
  nudge() {
    const line = this._recommendation();
    this.game.dialogue.bark('maddox', 'neutral', line);
    this._sinceSpoke = 0;
    this._idle = 0;
  }

  update(dt) {
    if (!this.enabled) return;
    const { game } = this;
    this._sinceSpoke += dt;

    // A queued line waits for its own beat so it never lands on top of
    // whatever just triggered it.
    if (this._pending) {
      this._pendingDelay -= dt;
      if (this._pendingDelay <= 0) {
        const line = this._pending;
        this._pending = null;
        this._say(line);
      }
      return;
    }

    // Idle means not going anywhere, not just not pressing keys — a
    // player reading a menu is not lost.
    const moved = Math.hypot(game.ship.x - this._lastPos.x, game.ship.y - this._lastPos.y);
    this._lastPos = { x: game.ship.x, y: game.ship.y };
    if (moved > 40 || game.uiBlocked) this._idle = 0;
    else this._idle += dt;

    this._checkTimer -= dt;
    if (this._checkTimer > 0) return;
    this._checkTimer = 1.5;

    if (this._sinceSpoke < GAP || game.uiBlocked || game.dialogue.isOpen) return;

    // 1. Anything newly worth explaining.
    for (const b of BRIEFINGS) {
      if (this.said.has(b.id)) continue;
      let ok = false;
      try {
        ok = b.when(game);
      } catch {
        ok = false; // a system not built yet is simply not ready to explain
      }
      if (!ok) continue;
      this.said.add(b.id);
      this._queue(b.text, b.delay ?? 0.6);
      return;
    }

    // 2. Stalled — point somewhere.
    if (this._idle > IDLE_SECONDS) {
      this._idle = 0;
      this._say(this._recommendation());
    }
  }

  _queue(text, delay) {
    this._pending = text;
    this._pendingDelay = delay;
  }

  _say(text) {
    this.game.dialogue.bark('maddox', 'neutral', text);
    this._sinceSpoke = 0;
  }

  /**
   * What the player should probably do next. The main quest is the
   * backbone, but a half-finished thing in front of them beats it —
   * being told to go be Pirate King while a bounty clock runs down is
   * exactly the advice nobody needs.
   */
  _recommendation() {
    const { game } = this;
    if (game.bounties.hasActive) {
      const b = game.bounties.active;
      const d = Math.round(Math.hypot(b.x - game.ship.x, b.y - game.ship.y));
      return `${b.name} is still out there — ${d} off, and the clock is running. Follow the compass.`;
    }
    if (game.story.started && !game.story.complete) {
      const t = game.story.objectiveText();
      if (t) return `The Gracechurch business first: ${t.toLowerCase()}.`;
    }
    const ch = game.mainQuest.current;
    if (ch) {
      const p = game.mainQuest.progress;
      return `${ch.objective} — ${p.have} of ${p.need}. ${ch.hint}`;
    }
    return 'There is no rank above yours, Captain. Sail where you like.';
  }

  serialize() {
    return { said: [...this.said], enabled: this.enabled };
  }
}
