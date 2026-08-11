// Mortality: the one way a captain's story actually ends.
//
// The game already had two moments that should have killed you — the hull
// reaching zero, and being cut down on somebody else's deck — and both
// were softened into a bruise. That softening stays exactly as it was.
// What this adds is the second strike.
//
// Go down once and you are BLEEDING OUT: a loud, visible, timed state
// that anyone can walk away from. Bind your wounds (heal to full — a
// bandage, a meal, a surgeon at any port, a level-up) and it is over with
// nothing lost. Sail on wounded and take a second beating inside the
// window, and that is the end of that captain.
//
// So death is never a surprise and never cheap: it takes two disasters,
// an ignored warning, and a refused rescue. When it comes it is final —
// the save is marked, and the only way forward is a new life.

/** How long a captain stays one blow from the grave. */
export const WOUND_SECONDS = 150;

/** Why a run ended. Used for the epitaph and the graveyard record. */
export const CAUSES = {
  sea: {
    label: 'Lost with the ship',
    epitaph: 'The pumps lost. The sea took the hull, the hold and the captain together.',
  },
  deck: {
    label: 'Cut down on a boarded deck',
    epitaph: 'Boarded one deck too many, and the crew rowed back a body.',
  },
  depths: {
    label: 'Never came back up',
    epitaph: 'Went down into the dark after something worth having, and stayed there.',
  },
};

export class Mortality {
  constructor(game, saved) {
    this.game = game;
    this.wounded = saved?.wounded ?? false;
    this.woundLeft = saved?.woundLeft ?? 0;
    this.reprieves = saved?.reprieves ?? 0;   // second chances already spent
    this.dead = false;
    this.cause = null;
    /** The run as it stood at the moment of death, frozen. */
    this.record = null;
    this._pending = null;
    this._warned = saved?.warned ?? false;
  }

  /**
   * A disaster the player did not buy their way out of. The first one
   * wounds; the second inside the window is the end.
   */
  nearDeath(cause = 'sea') {
    if (this.dead || this._pending) return;
    if (this.wounded) {
      this._pending = cause;
      return;
    }
    this.wounded = true;
    this.woundLeft = WOUND_SECONDS;
    const { game } = this;
    // A wounded captain is not a whole one. Every real path here already
    // leaves you at a third of your health, so this changes nothing in
    // play — it only rules out the incoherent case (wounded and untouched)
    // that would otherwise bind itself the instant it opened.
    game.player.health = Math.min(game.player.health, Math.round(game.player.maxHealth * 0.6));
    game.events.emit('player:changed');
    game.events.emit('player:wounded', { seconds: WOUND_SECONDS });
    game.hud.notify('Bleeding out', {
      kind: 'danger',
      detail: 'Another beating like that kills you. Heal to full to bind it.',
      color: '#e05a4a',
      hold: 9000,
    });
    game.events.emit('sfx', 'hit');
    // The bosun has watched captains ignore exactly this, once each.
    if (!this._warned) {
      this._warned = true;
      game.dialogue?.bark?.('maddox', 'worried',
        "You're bleeding, Captain. Patch it before the next scrap — I've buried better men who said they were fine.");
    }
  }

  /** Wounds bound: back to an ordinary bad day. */
  patch(quiet = false) {
    if (!this.wounded) return;
    this.wounded = false;
    this.woundLeft = 0;
    this.game.events.emit('player:wounded', { seconds: 0 });
    if (!quiet) {
      this.game.hud.notify('Wounds bound', {
        kind: 'good',
        detail: 'You are off the surgeon\'s list.',
        color: '#6fce62',
      });
    }
  }

  update(dt) {
    const { game } = this;
    // A full recovery is the intended way out, and the commonest one:
    // eat, drink, sleep at the homestead, careen at a port, level up.
    if (this.wounded && game.player.health >= game.player.maxHealth) {
      this.patch();
    } else if (this.wounded) {
      this.woundLeft -= dt;
      if (this.woundLeft <= 0) this.patch();
    }
    // Death waits for the results screens — a captain's last moment is
    // not something to stack on top of a loot popup.
    if (this._pending && !game.uiBlocked) {
      const cause = this._pending;
      this._pending = null;
      this._die(cause);
    }
  }

  _die(cause) {
    const { game } = this;
    this.dead = true;
    this.cause = cause;
    this.wounded = false;
    this.woundLeft = 0;
    game.player.health = 0;
    game.events.emit('player:changed');
    // Taken once and kept: the epitaph, the grave and the save all have
    // to be the same record, right down to its timestamp, or the screen
    // ends up listing the captain among the captains who came before.
    this.record = this.summary(cause);
    game.events.emit('player:died', { cause, summary: this.record });
  }

  /**
   * Undo a death — the one reprieve a run gets, sold for an ad. It has to
   * be worth the ad, so it is a clean slate: full health, a whole hull,
   * whole sails and no wound. Everything the captain had is still theirs.
   */
  revive() {
    const { game } = this;
    this.dead = false;
    this.cause = null;
    this.record = null;
    this.reprieves++;
    this.wounded = false;
    this.woundLeft = 0;
    game.player.health = game.player.maxHealth;
    game.shipState.hull = game.shipState.maxHull;
    game.shipState.sailHp = game.shipState.maxSail;
    game.events.emit('player:changed');
    game.events.emit('playership:damaged', { hull: game.shipState.hull });
    game.events.emit('player:revived', {});
  }

  /** Everything the epitaph and the graveyard want to know about a run. */
  summary(cause = this.cause) {
    const { game } = this;
    const s = game.stats;
    const clan = game.clans?.playerClan;
    return {
      name: game.captainName ?? 'The Captain',
      appearance: game.appearance,
      cause,
      level: game.player.level,
      prestige: game.prestige,
      gold: Math.round(game.resources.coins),
      goldEarned: Math.round(s.get('goldEarned')),
      shipsSunk: s.get('shipsSunk'),
      bountiesClaimed: s.get('bountiesClaimed'),
      boardingsWon: s.get('boardingsWon'),
      dungeonsCleared: s.get('dungeonsCleared'),
      bossesDefeated: s.get('bossesDefeated'),
      portsVisited: s.get('portsVisited'),
      crewLost: s.get('crewLost'),
      crew: game.crew.members.length,
      hull: game.shipState.hullDef?.name ?? 'Sloop',
      timePlayed: Math.round(s.get('timePlayed')),
      clan: clan ? clan.name : null,
      ports: game.clans?.portCount?.('player') ?? 0,
      chapter: game.mainQuest?.complete
        ? 'Pirate King'
        : (game.mainQuest?.current?.title ?? null),
      chapterIndex: game.mainQuest?.position?.index ?? 1,
      chapterTotal: game.mainQuest?.position?.total ?? 8,
      named: [...(game.namedShips?.defeated ?? [])],
      diedAt: Date.now(),
    };
  }

  serialize() {
    return {
      wounded: this.wounded,
      woundLeft: Math.round(this.woundLeft),
      reprieves: this.reprieves,
      warned: this._warned,
    };
  }
}
