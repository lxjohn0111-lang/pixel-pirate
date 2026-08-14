// The end of a captain, and the start of the next one.
//
// Death is rare and earned (see core/mortality.js), so the screen it
// opens is written to be worth reaching: the captain's own face, what
// killed them, what they actually did with their run, and the roll of
// everyone who came before.
//
// It runs in two stages, because the two decisions are different:
//
//   FALLEN — you are down, but not written off. One rewarded ad puts you
//            back on your feet at full health with a whole ship. Or you
//            can accept it, which is a choice the player makes, not one
//            the game makes for them.
//   OVER   — game over. The run is closed, and the only road out is a
//            new pirate, a new sea and nothing carried over.
//
// A captain with no reprieve left goes straight to OVER; there is no
// choice to offer. Booting on a dead save opens OVER too — the run ended
// long ago and the ad moment has passed with it.

import { portraitCanvas, faceFromAppearance } from '../render/portrait.js';
import { CAUSES } from '../core/mortality.js';
import { Graveyard } from '../meta/graveyard.js';
import { SaveManager } from '../core/save.js';

/** Which numbers are worth putting on a headstone. */
const FIELDS = [
  { key: 'goldEarned', label: 'Gold earned', fmt: (n) => n.toLocaleString() },
  { key: 'shipsSunk', label: 'Ships sunk' },
  { key: 'boardingsWon', label: 'Decks taken' },
  { key: 'bountiesClaimed', label: 'Bounties claimed' },
  { key: 'dungeonsCleared', label: 'Dungeons cleared' },
  { key: 'bossesDefeated', label: 'Legends broken' },
  { key: 'portsVisited', label: 'Ports found' },
  { key: 'crewLost', label: 'Hands buried' },
];

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function duration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export class DeathUI {
  constructor(uiRoot, game) {
    this.uiRoot = uiRoot;
    this.game = game;
    this.el = null;
    this.entry = null;
    this.stage = null;
    this.live = false;
  }

  get isOpen() {
    return !!this.el;
  }

  /** Called from the game the moment a captain dies. */
  show(summary) {
    this.entry = Graveyard.bury(summary);
    this.live = true;
    this.game.state = 'dead';
    this.game.ads?.setGameplayActive(false);
    this.game.audio?.setMusicMode?.('normal');
    // The save is kept, but marked — a reload lands back here rather
    // than quietly resurrecting a captain who is dead.
    this.game.save();
    this._stage(this._canRevive() ? 'fallen' : 'over');
  }

  /** Called at boot when the stored voyage ended in a death. */
  showFromSave(summary) {
    // The grave was already dug when they died; find it rather than
    // burying the same captain twice on every reload.
    const found = Graveyard.list().find((e) => e.diedAt === summary.diedAt);
    this.entry = found ?? { ...summary, number: Graveyard.list().length + 1 };
    this.live = false;
    this._stage('over');
  }

  /** One reprieve per life, and only while the body is still warm. */
  _canRevive() {
    return this.live
      && (this.game.mortality?.reprieves ?? 0) < 1
      && !!this.game.ads?.ready
      && !this.game.adsDisabled;
  }

  _stage(stage) {
    this.stage = stage;
    this._render();
  }

  _render() {
    this.close();
    const entry = this.entry;
    const over = this.stage === 'over';
    const cause = CAUSES[entry.cause] ?? CAUSES.sea;
    const graves = Graveyard.list().filter((e) => e.diedAt !== entry.diedAt).slice(0, 6);

    const el = document.createElement('div');
    el.className = `screen death-screen${over ? ' is-over' : ''}`;
    el.innerHTML = `
      <div class="death-wrap">
        ${over ? '<div class="game-over-band"><span>Game Over</span></div>' : ''}
        <div class="death-card">
          <div class="death-head">
            <div class="death-frame"><canvas class="death-portrait" width="64" height="64"></canvas></div>
            <div class="death-title">
              <span class="death-eyebrow">${over ? 'That was the end of' : 'Here lies'}</span>
              <h1 class="death-name"></h1>
              <span class="death-cause"></span>
            </div>
          </div>

          <p class="death-epitaph"></p>

          <div class="death-rank">
            <span class="death-rank-main"></span>
            <span class="death-rank-sub"></span>
          </div>

          <div class="death-stats"></div>

          <div class="death-actions">
            ${over ? `
              <button class="btn btn-primary death-new">
                Try Again
                <small>A new pirate, a new sea, nothing carried over</small>
              </button>` : `
              <button class="btn btn-primary death-revive">
                <span class="ad-play">▶</span> One Last Breath
                <small>Watch an ad — back on your feet at full health, ship and all</small>
              </button>
              <button class="btn btn-ghost death-accept">
                Accept Your Fate
                <small>Their story ends here</small>
              </button>`}
          </div>
          ${graves.length ? `
            <div class="death-graveyard">
              <h4>Others who tried</h4>
              <ul class="grave-list">
                ${graves.map((g) => `
                  <li class="grave-row">
                    <span class="grave-num">${ordinal(g.number)}</span>
                    <span class="grave-name"></span>
                    <span class="grave-cause"></span>
                    <span class="grave-gold">${(g.goldEarned ?? 0).toLocaleString()}g</span>
                  </li>`).join('')}
              </ul>
            </div>` : ''}
        </div>
      </div>`;
    this.uiRoot.appendChild(el);
    this.el = el;

    // Text goes in as text, never as markup — captain names are typed by
    // the player and clan names come from their own naming sheet.
    el.querySelector('.death-name').textContent = entry.name ?? 'The Captain';
    el.querySelector('.death-cause').textContent = cause.label;
    el.querySelector('.death-epitaph').textContent = cause.epitaph;
    graves.forEach((g, i) => {
      const row = el.querySelectorAll('.grave-row')[i];
      row.querySelector('.grave-name').textContent = g.name ?? 'Unknown';
      row.querySelector('.grave-cause').textContent = (CAUSES[g.cause] ?? CAUSES.sea).label;
    });

    // How far up the ladder they got — the line that stings the most.
    const rank = el.querySelector('.death-rank-main');
    const sub = el.querySelector('.death-rank-sub');
    if (entry.chapter === 'Pirate King') {
      rank.textContent = 'Pirate King';
      sub.textContent = 'They finished the climb. The sea took them anyway.';
    } else {
      rank.textContent = entry.chapter ?? 'Nobody in particular';
      sub.textContent = `Chapter ${entry.chapterIndex ?? 1} of ${entry.chapterTotal ?? 8}`
        + (entry.clan ? ` · ${entry.clan}` : '')
        + (entry.ports ? ` · ${entry.ports} harbour${entry.ports > 1 ? 's' : ''} held` : '');
    }

    const stats = el.querySelector('.death-stats');
    const cells = [
      ...FIELDS.map((f) => ({
        label: f.label,
        value: f.fmt ? f.fmt(entry[f.key] ?? 0) : String(entry[f.key] ?? 0),
        dim: !(entry[f.key] > 0),
      })),
      { label: 'Captain level', value: String(entry.level ?? 1) },
      { label: 'Last hull', value: entry.hull ?? 'Sloop' },
      { label: 'Time at sea', value: duration(entry.timePlayed ?? 0) },
      { label: 'Gold in the hold', value: (entry.gold ?? 0).toLocaleString() },
    ];
    for (const c of cells) {
      const d = document.createElement('div');
      d.className = `death-stat${c.dim ? ' dim' : ''}`;
      d.innerHTML = '<b></b><span></span>';
      d.querySelector('b').textContent = c.value;
      d.querySelector('span').textContent = c.label;
      stats.appendChild(d);
    }

    // The captain's own face, eyes shut.
    const canvas = el.querySelector('.death-portrait');
    if (entry.appearance) {
      canvas.getContext('2d').drawImage(
        portraitCanvas(faceFromAppearance(entry.appearance), 'gone'), 0, 0);
    }

    el.querySelector('.death-revive')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      // Straight to play(): the offer *is* this screen, and a global gap
      // meant for unsolicited pop-ups must not silence the player's own
      // last request.
      this.game.ads.play('cheatDeath').then((rewarded) => {
        if (rewarded) this._revive();
        else btn.disabled = false;   // no ad, no reprieve spent — try again
      });
    });

    // Calling it is the player's decision, so it is a button of its own
    // rather than a confirmation buried in the restart.
    el.querySelector('.death-accept')?.addEventListener('click', () => {
      this.game.events.emit('sfx', 'sink');
      this._stage('over');
    });

    el.querySelector('.death-new')?.addEventListener('click', () => this._newLife());

    if (!over) this.game.events.emit('sfx', 'sink');
  }

  /** The reprieve: whole again, ship and all, and straight back to it. */
  _revive() {
    this.game.mortality.revive();
    this.close();
    this.game.state = 'playing';
    this.game._lastTs = performance.now();
    this.game.ads?.setGameplayActive(true);
    this.game.hud.notify('Back on your feet', {
      kind: 'good',
      detail: 'Full health and a whole ship. Do not waste them.',
      color: '#6fce62',
      hold: 7000,
    });
    this.game.save();
  }

  /** New pirate, new sea, nothing carried over — the graveyard aside. */
  _newLife() {
    // Through the game so the save is latched shut: the reload below
    // fires beforeunload, and an unlatched save() there would put the
    // dead captain straight back.
    if (this.game.world) this.game.wipeSave();
    else SaveManager.clear();
    // A boot from nothing is the only way to guarantee "new everything":
    // every system rebuilds from its own defaults instead of trying to
    // unwind fifty of them by hand.
    window.location.reload();
  }

  close() {
    this.el?.remove();
    this.el = null;
  }
}
