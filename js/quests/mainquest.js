// The main quest: become Pirate King.
//
// This is the long arc, and it is deliberately not the story campaign.
// "The Gracechurch Debt" (js/story/story.js) is a six-chapter tutorial
// that teaches the systems and then ends. This runs from the first
// minute to the last and never stops pointing somewhere — its job is to
// answer "what am I actually working toward" at any moment of the game.
//
// Every chapter measures something the player was already going to do,
// so the ladder narrates the sandbox rather than diverting it: gold you
// were earning anyway, a hull you wanted anyway, bounties that were
// already worth taking. Nothing here spawns a fetch quest.

import { HULL_ORDER } from '../entities/ships.js';

/**
 * A chapter's goal reports { have, need } so the tracker can show real
 * progress rather than a checkbox, and `done` falls out of that.
 */
export const MAIN_CHAPTERS = [
  {
    id: 'firstBlood',
    title: 'First Blood',
    subtitle: 'Nobody fears a captain who has never fired.',
    objective: 'Sink 3 hostile ships',
    hint: 'Hold Space to fire a broadside. Turn side-on to bring the guns to bear.',
    progress: (g) => ({ have: g.stats.get('shipsSunk'), need: 3 }),
    reward: { gold: 250, xp: 60 },
    guide: 'Every name out here started the same way — with a fight somebody else lost.',
  },
  {
    id: 'purse',
    title: 'A Purse Worth Carrying',
    subtitle: 'Ambition is expensive.',
    objective: 'Earn 1,000 gold in total',
    hint: 'Sell cargo at any Harbour Office, and loot what floats after a fight.',
    progress: (g) => ({ have: g.stats.get('goldEarned'), need: 1000 }),
    reward: { gold: 300, xp: 80 },
    guide: 'Coin first. Everything after this costs some.',
  },
  {
    id: 'ship',
    title: 'A Ship Worth The Name',
    subtitle: 'You cannot take the sea in a sloop.',
    objective: 'Buy a bigger hull at any Shipyard',
    hint: 'Dock at a port and visit the Shipyard. The Cutter is the first step up.',
    progress: (g) => ({
      have: g.shipState.ownedHulls.filter((h) => h !== HULL_ORDER[0]).length ? 1 : 0,
      need: 1,
    }),
    reward: { gold: 400, xp: 120 },
    guide: 'A bigger hull is more guns, more hold and more crew. It is the whole game, really.',
  },
  {
    id: 'crew',
    title: 'Hands To Sail Her',
    subtitle: 'A captain alone is a man in a boat.',
    objective: 'Have 4 crew aboard',
    hint: 'Hire hands at a port Tavern, or pull survivors out of the water.',
    progress: (g) => ({ have: g.crew.members.length, need: 4 }),
    reward: { gold: 400, xp: 140 },
    guide: 'Crew work the guns, fight beside you, and die where you take them. Choose well.',
  },
  {
    id: 'bounties',
    title: 'Make A Name',
    subtitle: 'Let them hear it in every harbour.',
    objective: 'Claim 3 bounties',
    hint: 'Take a contract at any port Bounty Board, then hunt them down before they slip away.',
    progress: (g) => ({ have: g.stats.get('bountiesClaimed'), need: 3 }),
    reward: { gold: 900, xp: 220 },
    guide: 'Bounties are how a nobody becomes a somebody. The board keeps score.',
  },
  {
    id: 'clan',
    title: 'Colours Of Your Own',
    subtitle: 'Stop sailing under other men\'s flags.',
    objective: 'Found your own pirate clan',
    hint: 'Reach +35 average standing, then register your colours at any Harbour Office.',
    progress: (g) => ({ have: g.clans.playerClan ? 1 : 0, need: 1 }),
    reward: { gold: 1200, xp: 300 },
    guide: 'Six clans hold this sea between them. There is no law saying it has to be six.',
  },
  {
    id: 'greatShips',
    title: 'Break The Great Ships',
    subtitle: 'Every legend has a hull under it.',
    objective: 'Defeat 3 of the five great ships',
    hint: 'Each patrols its clan\'s home waters. Sail deep into their territory to find one.',
    progress: (g) => ({ have: g.namedShips.defeated.size, need: 3 }),
    reward: { gold: 3000, xp: 600 },
    guide: 'Five ships everyone has heard of. Sink three and they will start saying yours instead.',
  },
  {
    id: 'harbours',
    title: 'Take The Sea',
    subtitle: 'A king needs somewhere to be king of.',
    objective: 'Claim 3 harbours for your clan',
    hint: 'Weaken a clan by sinking its ships, then claim its port at the Harbour Office.',
    progress: (g) => ({ have: g.clans.portCount('player'), need: 3 }),
    reward: { gold: 5000, xp: 1000 },
    guide: 'Sink enough of a clan\'s hulls and their grip slips. That is when a harbour changes hands.',
  },
];

export class MainQuest {
  constructor(game, saved) {
    this.game = game;
    this.chapter = saved?.chapter ?? 0;
    this.complete = saved?.complete ?? false;
    this.crowned = saved?.crowned ?? false;
    this._checkTimer = 1;

    // A chapter can complete from any direction — a sale, a sinking, a
    // hire — so rather than wiring a listener per goal, the ladder polls
    // its own progress. It is two comparisons a second.
    game.events.on('resources:changed', () => this._check());
    game.events.on('crew:changed', () => this._check());
    game.events.on('ship:bought', () => this._check());
    game.events.on('clan:founded', () => this._check());
    game.events.on('named:defeated', () => this._check());
    game.events.on('bounty:claimed', () => this._check());
  }

  get current() {
    return this.complete ? null : MAIN_CHAPTERS[this.chapter];
  }

  /** { have, need, done, pct } for the active chapter. */
  get progress() {
    const ch = this.current;
    if (!ch) return null;
    const p = ch.progress(this.game);
    const have = Math.max(0, Math.min(p.need, p.have ?? 0));
    return { have, need: p.need, done: have >= p.need, pct: (have / p.need) * 100 };
  }

  /** Chapter number out of the total, for the tracker's eyebrow. */
  get position() {
    return { index: Math.min(this.chapter + 1, MAIN_CHAPTERS.length), total: MAIN_CHAPTERS.length };
  }

  update(dt) {
    this._checkTimer -= dt;
    if (this._checkTimer > 0) return;
    this._checkTimer = 0.5;
    this._check();
  }

  /**
   * Advance as far as the player has actually earned. Granting a reward
   * emits resources:changed, which lands right back here — so this is
   * re-entrancy guarded, and the chapter index moves BEFORE any reward
   * goes out. Without both, paying for a chapter re-completes it.
   */
  _check() {
    if (this.complete || this._advancing) return;
    this._advancing = true;
    try {
      // A single event can satisfy several rungs at once (a windfall that
      // clears the purse chapter may also clear the one after it), so
      // this loops — bounded, because the ladder is finite.
      for (let guard = 0; guard < MAIN_CHAPTERS.length + 1; guard++) {
        if (this.complete) break;
        const p = this.progress;
        if (!p || !p.done) break;
        this._advance();
      }
    } finally {
      this._advancing = false;
    }
  }

  _advance() {
    const ch = MAIN_CHAPTERS[this.chapter];
    const { game } = this;

    // Move first: everything below can emit, and an emit re-enters.
    this.chapter++;
    const next = MAIN_CHAPTERS[this.chapter];

    if (ch.reward?.gold) {
      game.resources.coins += ch.reward.gold;
      game.events.emit('resources:changed', { ...game.resources });
      game.events.emit('resources:earned', ch.reward.gold);
    }
    if (ch.reward?.xp) game.player.addXp(ch.reward.xp);
    game.events.emit('mainquest:chapter', { done: ch, next, index: this.chapter });
    game.hud.notify(`${ch.title} — complete`, {
      kind: 'quest',
      detail: next ? `Next: ${next.objective}` : 'The sea is yours.',
      color: '#f0a83c',
      hold: 6000,
    });
    game.events.emit('sfx', 'quest');

    if (!next) {
      this.complete = true;
      this.crowned = true;
      game.events.emit('mainquest:complete', {});
      this._crown();
    }
    game.save();
  }

  /** The one moment the whole ladder exists to reach. */
  _crown() {
    const { game } = this;
    const clan = game.clans.playerClan;
    game.showMessage?.(
      'PIRATE KING',
      `Six clans held this sea between them when you started.<br><br>
       ${clan ? `<b>${clan.name}</b> holds its share now, and the rest have taken to calling you
       something they used to say about other people.` : 'They have taken to calling you something else now.'}
       <br><br>There is no higher rank out here. There is only more sea.`,
      'The world keeps turning — every system stays open.',
    );
    game.hud.notify('You are the Pirate King.', { kind: 'crown', color: '#f0a83c', hold: 12000 });
    game.ads?.happytime?.();
    game.cosmetics?.unlock('flag', 'legend');
  }

  /** Where the tracker should point, if the chapter has a place. */
  trackedTarget() {
    const ch = this.current;
    if (!ch) return null;
    const { game } = this;
    // Chapters that want a port send you to the nearest one you know of.
    if (['ship', 'crew', 'clan', 'harbours'].includes(ch.id)) {
      let best = null;
      let bestD = Infinity;
      for (const p of game.mapData.ports) {
        const d = Math.hypot(p.x - game.ship.x, p.y - game.ship.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    }
    if (ch.id === 'greatShips') {
      // Point at the nearest great ship still afloat.
      let best = null;
      let bestD = Infinity;
      for (const entry of game.namedShips.roster()) {
        if (entry.defeated) continue;
        const a = game.namedShips.anchorFor(entry.id);
        const d = Math.hypot(a.x - game.ship.x, a.y - game.ship.y);
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      }
      return best;
    }
    return null;
  }

  serialize() {
    return { chapter: this.chapter, complete: this.complete, crowned: this.crowned };
  }
}
