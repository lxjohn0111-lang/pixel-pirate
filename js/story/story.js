// The campaign: "The Gracechurch Debt".
//
// Captain Rosalind Vane sailed to find the Sunken Kingdom and never came
// back. You served under her. Her chart was torn into pieces and split
// between her officers so no one could steal it whole — and the pieces
// are still out there.
//
// Each chapter is also the tutorial for one system, which is the point:
// the story exists so the player always knows what to do next, and so
// the game's depth is discovered through play instead of a manual.
// Objectives are checked against ordinary game events, so a player who
// ignores the story entirely still completes chapters by playing.

import { dist2, TAU } from '../util/math.js';

/**
 * Chapters. `goal.done(game)` decides completion; `goal.text` is what
 * the HUD tracker shows; `intro`/`outro` are dialogue scenes.
 */
export const CHAPTERS = [
  {
    id: 'prologue',
    title: 'Chapter One',
    subtitle: 'What the Sea Left',
    objective: 'Sail west and find the wreck Maddox spotted',
    hint: 'Hold W (or drag) to sail. The gold arrow on your compass points the way.',
    intro: (g) => [
      { card: 'THE GRACECHURCH DEBT', sub: 'A tale of the far seas', hold: 2800 },
      { who: 'maddox', expression: 'grim',
        text: 'Easy now. You have been face-down in that bilge for two days and I was not sure you would wake at all.' },
      { who: 'maddox', expression: 'sad',
        text: 'The Gracechurch is gone. Broke her back on something the charts swore was open water. Captain Vane went down with her.' },
      { who: 'maddox', expression: 'neutral',
        text: 'This little boat is what is left. That, and me. I have sailed for worse.' },
      { who: 'maddox', expression: 'grim', text: 'There is one more thing, and you will not like it.',
        choices: [
          { label: 'Say it.', next: null },
          { label: 'It has been that kind of week.', next: null },
        ] },
      { who: 'maddox', expression: 'neutral',
        text: 'Vane was chasing the Sunken Kingdom. Not for gold — she said the sea owed her an answer. She tore her chart into six pieces and gave one to each of her officers so no thief could take the whole of it.' },
      { who: 'maddox', expression: 'warm',
        text: 'Six pieces. Six officers. Some of them lived. I mean to find every one and finish what she started, and I would rather not do it alone.' },
      { who: 'maddox', expression: 'grin',
        text: 'There is a wreck on the horizon west of us — I saw her mast at first light. Sail for it. Let us see what the sea left.' },
    ],
    start(g) {
      // Plant the first fragment on a guaranteed wreck to the west.
      g.story.marker = g.story._placeSiteNear(g.ship.x, g.ship.y, 520, 'wreck', 'frag1');
    },
    goal: {
      text: 'Search the wreck',
      done: (g) => g.story.flags.frag1,
    },
    outro: (g) => [
      { who: 'maddox', expression: 'shock',
        text: 'That is her hand. Look at the ink — that is Vane\'s. One piece down.' },
      { who: 'maddox', expression: 'neutral',
        text: 'Five left, and none of them lying in open water like that one. We need a real port, a real hull, and coin to pay for both.' },
    ],
  },

  {
    id: 'port',
    title: 'Chapter Two',
    subtitle: 'Make Port',
    objective: 'Find a port and speak to the harbourmaster',
    hint: 'Ports sit on the biggest islands. Watch your sea chart (M) — discovered ports are marked.',
    goal: {
      text: 'Dock at any port',
      done: (g) => g.story.flags.docked,
    },
    outro: (g) => [
      { who: 'quint', expression: 'warm',
        text: 'Well. The Gracechurch\'s own, walking into my harbour on a boat I would not trust with my laundry.' },
      { who: 'quint', expression: 'neutral',
        text: 'Quint. I keep the ledger here. Repairs at the harbour, guns and coats from the merchants, hulls and sails from the shipwright, and hands for hire in the tavern.' },
      { who: 'quint', expression: 'sly',
        text: 'And contracts, if your purse is as light as your face suggests. Take one. Take three. I am not your mother.' },
      { who: 'maddox', expression: 'grim',
        text: 'Ask him about Vane\'s officers.' },
      { who: 'quint', expression: 'grim',
        text: 'Her gunner? Red Ketch. Turned raider the week she sank — took her piece of the chart with him and has been burning shipping lanes ever since.' },
      { who: 'quint', expression: 'neutral',
        text: 'He is out there now. If you want that scrap of paper you will have to take it off his deck.' },
    ],
  },

  {
    id: 'ketch',
    title: 'Chapter Three',
    subtitle: 'Blood in the Water',
    objective: 'Hunt Red Ketch and take the second fragment',
    hint: 'Space fires a broadside. Soften a ship, pull alongside, then press F to board it.',
    start(g) {
      g.story.marker = { x: g.ship.x, y: g.ship.y, pending: 'ketch' };
      g.story._spawnKetchWhenClear();
    },
    goal: {
      text: 'Board Red Ketch\'s raider',
      done: (g) => g.story.flags.frag2,
    },
    outro: (g) => [
      { who: 'ketch', expression: 'angry',
        text: 'You. Of course it is you. Crawled off the Gracechurch and straight into my rigging.' },
      { who: 'ketch', expression: 'grim',
        text: 'Take it. The scrap is yours. I have been carrying it two years and it has done nothing but keep me awake.' },
      { who: 'ketch', expression: 'sad',
        text: 'She did not hit a reef. I was on the gun deck. Something took hold of the keel and it did not let go until she was under.' },
      { who: 'maddox', expression: 'shock', text: 'You never said a word.' },
      { who: 'ketch', expression: 'grim',
        text: 'Who would have believed me? Go and look for yourself. The next piece went down with the quartermaster, in a hole in the rock where he thought it would be safe.' },
    ],
  },

  {
    id: 'dungeon',
    title: 'Chapter Four',
    subtitle: 'The Drowned Door',
    objective: 'Find a cave or ruin on an island and clear its vault',
    hint: 'Look for torch-lit cave mouths on island shores. Press F at the entrance to go in.',
    goal: {
      text: 'Clear any island dungeon',
      done: (g) => g.story.flags.frag3,
    },
    outro: (g) => [
      { who: 'maddox', expression: 'grim',
        text: 'He made it this far and no further. Poor devil.' },
      { who: 'maddox', expression: 'shock',
        text: 'These carvings are not his work, mate. Look how deep the water has been in here — and something took the trouble to write on the walls.' },
      { who: 'herald', expression: 'hollow',
        text: 'T H R E E.' },
      { who: 'maddox', expression: 'shock', text: 'Who said that?' },
      { who: 'herald', expression: 'hollow',
        text: 'Three of six. You carry her hand and her habit both. She counted too, at the end.' },
      { who: 'herald', expression: 'hollow',
        text: 'Keep counting, little hull. We are patient. We have had a very long time to practise.' },
    ],
  },

  {
    id: 'gather',
    title: 'Chapter Five',
    subtitle: 'What She Was Owed',
    objective: 'Recover three more fragments from the far seas',
    hint: 'Fragments turn up in chests, vaults, treasure hauls and the holds of ships worth taking.',
    goal: {
      text: (g) => `Treasure Fragments: ${g.story.fragmentCount(g)}/6`,
      done: (g) => g.story.fragmentCount(g) >= 6,
    },
    outro: (g) => [
      { who: 'maddox', expression: 'shock',
        text: 'Six. All six, and they fit — of course they fit, she drew them.' },
      { who: 'maddox', expression: 'neutral',
        text: 'It is not a treasure map. It never was. It is a door, and she marked the sill.' },
      { who: 'herald', expression: 'hollow',
        text: 'She is here. She has been here since the water closed. She asked her question and we answered it, and she has not stopped listening since.' },
      { who: 'maddox', expression: 'grim',
        text: 'Say the word and we go. Say the other word and we burn the lot and drink until we forget her name. I will not think less of you either way.' },
      { who: 'maddox', expression: 'warm', text: 'Well?',
        choices: [
          { label: 'We go. She waited long enough.', next: null },
          { label: 'She would have gone for me.', next: null },
        ] },
      { who: 'maddox', expression: 'grin',
        text: 'Aye. Chart is laid. Steer for the mark and do not look down.' },
    ],
    onComplete(g) {
      g.story.marker = g.story._placeSiteNear(g.ship.x, g.ship.y, 1300, 'kingdom', 'kingdom');
    },
  },

  {
    id: 'kingdom',
    title: 'Chapter Six',
    subtitle: 'The Sunken Kingdom',
    objective: 'Sail to the marked water and find what Vane found',
    hint: 'The mark is on your chart. Whatever is down there has been waiting.',
    goal: {
      text: 'Reach the drowned city',
      done: (g) => g.story.flags.kingdom,
    },
    outro: (g) => [
      { card: 'THE SUNKEN KINGDOM', sub: 'Fathoms down, and lit', hold: 2800 },
      { who: 'herald', expression: 'hollow',
        text: 'You came. They so rarely come.' },
      { who: 'vane', expression: 'neutral',
        text: 'You always were stubborn. I told you to take the boat and go east.' },
      { who: 'maddox', expression: 'shock', text: 'Captain—' },
      { who: 'vane', expression: 'sad',
        text: 'I am not a ghost and I am not alive, and I have stopped finding the difference interesting. I asked the sea what it owed me. This is the answer. It is not a good one.' },
      { who: 'vane', expression: 'warm',
        text: 'But you finished the chart. Six pieces, and you brought them to my door.' },
      { who: 'vane', expression: 'grin',
        text: 'Then take the rest of it. The hull, the horizon, all of it — it was always going to be someone\'s, and I would rather it were yours.' },
      { who: 'vane', expression: 'neutral',
        text: 'Sail well, Captain. Do not come back here.' },
      { who: 'maddox', expression: 'warm',
        text: 'You heard her. There is a whole sea out there and it has not been charted by anyone worth trusting.' },
      { who: 'maddox', expression: 'grin',
        text: 'Set a heading. Any heading. That is the joy of it.' },
    ],
    onComplete(g) {
      g.resources.coins += 2000;
      g.inventory.addAnywhere('stormEye', 1);
      g.cosmetics.unlock('flag', 'legend');
      g.cosmetics.unlock('figurehead', 'leviathan');
      g.events.emit('resources:changed', { ...g.resources });
      g.hud.toast('Vane\'s legacy is yours: the Eye of the Storm.', '#f0a83c');
      g.ads?.happytime();
    },
  },
];

/* ------------------------------------------------------------------ */
/* Contextual one-off tips — the rest of the onboarding                */
/* ------------------------------------------------------------------ */
// These fire once each, only when the player is actually in the
// situation, so the game teaches itself without a wall of tutorial.

const TIPS = [
  { id: 'lowHull', when: (g) => g.shipState.hull < g.shipState.maxHull * 0.4,
    who: 'maddox', expression: 'grim',
    text: 'She is taking water. Repair kits patch her at sea, or a harbour will do it properly for coin.' },
  { id: 'firstCrew', when: (g) => g.crew.members.length > 0,
    who: 'maddox', expression: 'warm',
    text: 'A hand aboard. They work the guns and fight beside you when you board — and they can die doing it, so mind them.' },
  { id: 'night', when: (g) => g.dayNight.isNight,
    who: 'maddox', expression: 'neutral',
    text: 'Night on the water. Sail slow, watch the lantern, and remember the strange things come out when the sun is down.' },
  { id: 'storm', when: (g) => g.weather.rain > 0.75,
    who: 'maddox', expression: 'grim',
    text: 'Weather coming in hard. Storms shake loose all sorts of cargo — and there is a fish or two that only bites in the rain.' },
  { id: 'fishing', when: (g) => g.inventory.totalCount('fishingRod') > 0 && Math.abs(g.ship.speed) < 6,
    who: 'maddox', expression: 'grin',
    text: 'We are barely moving — good a moment as any. Press R to cast, and strike the moment she pulls.' },
  { id: 'firstLegend', when: (g) => !!g.legends?.activeBoss,
    who: 'maddox', expression: 'shock',
    text: 'That is no whale! Keep the broadside on it and do NOT let it get under us!' },
];

/* ------------------------------------------------------------------ */

export class Story {
  constructor(game, saved) {
    this.game = game;
    this.chapter = saved?.chapter ?? 0;
    this.flags = saved?.flags ?? {};
    this.seenTips = new Set(saved?.seenTips ?? []);
    this.marker = saved?.marker ?? null;
    this.started = saved?.started ?? false;
    this.complete = saved?.complete ?? false;
    this._checkTimer = 1;
    this._tipTimer = 6;
    this._pendingKetch = false;

    // Fragments arriving from any source count toward Chapter Five.
    game.events.on('loot:granted', (drops) => {
      for (const it of drops.items) {
        if (it.id === 'treasureFragment') this._onFragment();
      }
    });
    game.events.on('port:docked', () => {
      this.flags.docked = true;
    });
    game.events.on('dungeon:cleared', () => {
      if (this.current?.id === 'dungeon') this._grantFragment('frag3');
    });
    game.events.on('ship:sunk', (e) => {
      if (e.byPlayer && e.isKetch) this._grantFragment('frag2');
    });
  }

  get current() {
    return this.complete ? null : CHAPTERS[this.chapter];
  }

  /** Total fragments held, for the Chapter Five counter. */
  fragmentCount(g) {
    return Math.min(6, (this.flags.fragments ?? 0));
  }

  /** Kick off the campaign (called once, after the creator closes). */
  begin() {
    if (this.started) return;
    this.started = true;
    const ch = CHAPTERS[0];
    ch.start?.(this.game);
    this.game.dialogue.play(ch.intro(this.game), () => {
      this.game.hud.showObjective(this.objectiveText(), ch.hint);
    });
  }

  objectiveText() {
    const ch = this.current;
    if (!ch) return null;
    const t = ch.goal.text;
    return typeof t === 'function' ? t(this.game) : t;
  }

  /* ---- progression ---------------------------------------------------- */

  update(dt) {
    const g = this.game;
    if (!this.started || this.complete) return;
    if (g.dialogue.isOpen) return;

    this._checkTimer -= dt;
    if (this._checkTimer <= 0) {
      this._checkTimer = 0.5;
      this._checkSites();
      const ch = this.current;
      if (ch && ch.goal.done(g)) this._advanceChapter();
      else g.hud.updateObjective(this.objectiveText());
    }

    // Contextual tips, spaced out and never during a fight.
    this._tipTimer -= dt;
    if (this._tipTimer <= 0) {
      this._tipTimer = 12;
      this._maybeTip();
    }
  }

  _advanceChapter() {
    const g = this.game;
    const ch = CHAPTERS[this.chapter];
    ch.onComplete?.(g);
    const outro = ch.outro?.(g) ?? [];
    this.chapter++;
    const next = CHAPTERS[this.chapter];
    const beats = [...outro];
    if (next) {
      beats.push({ card: next.title, sub: next.subtitle, hold: 2200 });
    }
    g.player.addXp(60);
    g.events.emit('story:chapter', { index: this.chapter });

    const after = () => {
      if (next) {
        next.start?.(g);
        g.hud.showObjective(this.objectiveText(), next.hint);
      } else {
        this.complete = true;
        g.hud.hideObjective();
        g.hud.toast('The Gracechurch Debt is settled. The sea is yours.', '#f0a83c');
      }
      g.save();
    };
    if (beats.length) g.dialogue.play(beats, after);
    else after();
  }

  _maybeTip() {
    const g = this.game;
    // Barks play over live gameplay, so the only things worth suppressing
    // are the modes that own the whole screen.
    if (g.uiBlocked || g.dialogue.isOpen || g.boarding.active || g.dungeon.active) return;
    for (const tip of TIPS) {
      if (this.seenTips.has(tip.id)) continue;
      if (!tip.when(g)) continue;
      this.seenTips.add(tip.id);
      g.dialogue.bark(tip.who, tip.expression, tip.text);
      this._tipTimer = 45;
      return;
    }
  }

  /* ---- story sites ------------------------------------------------------- */

  /** Drop a guaranteed story encounter in open water near a point. */
  _placeSiteNear(x, y, dist, kind, flag) {
    const g = this.game;
    let px = x;
    let py = y;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * TAU;
      const d = dist * (0.7 + Math.random() * 0.6);
      px = Math.round(x + Math.cos(a) * d);
      py = Math.round(y + Math.sin(a) * d);
      if (g.world.isOpenWater(px, py)) break;
    }
    return { x: px, y: py, kind, flag, spawned: false };
  }

  /** Materialise the site's encounter once the player is close. */
  _checkSites() {
    const g = this.game;
    const m = this.marker;
    if (!m || m.spawned || m.pending) return;
    if (dist2(m.x, m.y, g.ship.x, g.ship.y) > 700 * 700) return;

    const cx = g.world.chunkCoord(m.x);
    const cy = g.world.chunkCoord(m.y);
    const chunk = g.world.getChunk(cx, cy);
    if (!chunk) return;
    chunk.encounters = chunk.encounters ?? [];

    if (m.kind === 'wreck') {
      chunk.encounters.push({
        kind: 'wreck', id: `story:${m.flag}`, x: m.x, y: m.y,
        variant: 0, searched: false, storyFlag: m.flag,
      });
    } else if (m.kind === 'kingdom') {
      chunk.encounters.push({
        kind: 'kingdom', id: `story:${m.flag}`, x: m.x, y: m.y,
        searched: false, storyFlag: m.flag,
      });
    }
    m.spawned = true;
  }

  /** Chapter Three's antagonist, spawned as a real hostile raider. */
  _spawnKetchWhenClear() {
    const g = this.game;
    this._pendingKetch = true;
    const trySpawn = () => {
      if (!this._pendingKetch || this.current?.id !== 'ketch') return;
      const s = g.combat._spawn('pirate');
      if (s) {
        s.hostileToPlayer = true;
        s.isKetch = true;
        s.maxHull = Math.round(s.maxHull * 1.6);
        s.hull = s.maxHull;
        s.crewCount = Math.max(2, s.crewCount);
        s.lootTable = 'pirateShip';
        this._pendingKetch = false;
        this.marker = { x: s.x, y: s.y, kind: 'ship', ship: s, spawned: true };
        g.hud.toast('Red Ketch\'s raider is on the horizon.', '#e05a4a');
        g.events.emit('sfx', 'quest');
      } else {
        setTimeout(trySpawn, 2500);
      }
    };
    setTimeout(trySpawn, 1500);
  }

  /**
   * Called by the encounter system when a story site is searched.
   * Sites whose fragment arrives inside their loot only set the flag —
   * the shared `loot:granted` listener has already counted it.
   */
  onSiteSearched(flag) {
    if (flag === 'frag1') {
      this.flags.frag1 = true;
      this.marker = null;
      this.game.events.emit('sfx', 'chest');
    }
    if (flag === 'kingdom') {
      this.flags.kingdom = true;
      this.marker = null;
    }
  }

  /** For sites with no loot popup of their own (a sunk ship, a vault). */
  _grantFragment(flag) {
    if (this.flags[flag]) return;
    this.flags[flag] = true;
    this.marker = null;
    this.game.inventory.addAnywhere('treasureFragment', 1);
    this._onFragment();
    this.game.events.emit('sfx', 'chest');
  }

  _onFragment() {
    this.flags.fragments = Math.min(6, (this.flags.fragments ?? 0) + 1);
    this.game.hud.toast(`Chart fragment ${this.flags.fragments} of 6`, '#4ec9b0');
  }

  /** Where the story arrow should point, if anywhere. */
  trackedTarget() {
    if (this.complete || !this.started) return null;
    const m = this.marker;
    if (!m) return null;
    if (m.ship) return m.ship.state === 'sailing' ? m.ship : null;
    if (m.pending) return null;
    return m;
  }

  serialize() {
    return {
      chapter: this.chapter,
      flags: { ...this.flags },
      seenTips: [...this.seenTips],
      marker: this.marker && !this.marker.ship ? { ...this.marker } : null,
      started: this.started,
      complete: this.complete,
    };
  }
}
