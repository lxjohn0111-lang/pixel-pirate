// In-game HUD: resource counters, compass, health/XP, ship hull, quick
// bar, interact prompt, toasts, quest guide arrow and touch buttons.
// DOM-based so it stays crisp at any resolution.

import { hudCoinIcon, hudWoodIcon } from '../render/sprites.js';
import { ITEMS, itemIcon } from '../items/itemdefs.js';
import { QUICKBAR_SIZE } from '../items/inventory.js';

/** How many notifications may stack before the oldest is pushed out. */
const MAX_NOTES = 3;

const NOTE_ICONS = {
  info: '•',
  gold: '◉',
  quest: '❯',
  combat: '✕',
  loot: '◆',
  clan: '⚑',
  flag: '⚑',
  crown: '♛',
  warn: '!',
  good: '✓',
  danger: '☠',
};

/**
 * Most callers pass only a colour, so the icon is inferred from that plus
 * the wording. It keeps every existing toast() call site working while
 * still getting a glyph that means something.
 */
function guessKind(text, color) {
  const t = text.toLowerCase();
  if (color === '#f0a83c' || /gold|bounty claimed|treasure|hoard/.test(t)) return 'gold';
  if (color === '#e05a4a' || /sunk|hunt|sighted|lost|full|not enough/.test(t)) return 'warn';
  if (color === '#6fce62' || /complete|repair|joins|whole|discovered/.test(t)) return 'good';
  if (/collection|achievement/.test(t)) return 'quest';
  if (/clan|war|takes|colours/.test(t)) return 'clan';
  return 'info';
}

export class HUD {
  constructor(uiRoot, game) {
    this.game = game;
    const touch = 'ontouchstart' in window;
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-topleft">
        <div class="hud-resources">
          <div class="hud-counter" id="hud-coins"><img alt="gold"><span>0</span></div>
          <div class="hud-counter" id="hud-wood"><img alt="wood"><span>0</span></div>
        </div>
        <div class="hud-bars">
          <div class="hud-bar hp-bar" title="Health"><div class="fill"></div><span class="bar-text"></span></div>
          <div class="hud-bar xp-bar" title="Experience"><div class="fill"></div><span class="bar-text lvl-text"></span></div>
          <div class="hud-bar hull-bar" title="Ship hull"><div class="fill"></div><span class="bar-text"></span></div>
        </div>
        <div class="wound-badge hidden" title="Take another beating and this captain is finished">
          <span class="wound-icon">🩸</span>
          <div class="wound-body">
            <b>Bleeding out</b>
            <span class="wound-sub">Heal to full to bind it</span>
          </div>
          <span class="wound-clock"></span>
        </div>
      </div>
      <div class="hud-sidebtns">
        <button class="pause-btn hud-btn" aria-label="Pause">II</button>
        <button class="hud-btn bag-btn" aria-label="Inventory (I)">⚔</button>
        <button class="hud-btn map-btn" aria-label="Map (M)">🗺</button>
        <button class="hud-btn log-btn" aria-label="Captain's Log (L)">📖</button>
        ${touch ? '<button class="hud-btn fish-btn" aria-label="Fish (R)">🎣</button>' : ''}
      </div>
      <div class="compass">
        <span class="compass-n">N</span><span class="compass-e">E</span>
        <span class="compass-s">S</span><span class="compass-w">W</span>
        <div class="compass-needle"></div>
        <div class="quest-arrow hidden"></div>
        <div class="quest-arrow relic-arrow hidden"></div>
      </div>
      <div class="hud-top">
      <div class="tracker hidden">
        <div class="trk-main">
          <div class="trk-head">
            <span class="trk-eyebrow">Main Quest</span>
            <span class="trk-chapter"></span>
            <button class="trk-help" title="What should I do?" aria-label="Ask the bosun">?</button>
          </div>
          <div class="trk-title"></div>
          <div class="trk-objective"></div>
          <div class="trk-bar"><i></i></div>
          <div class="trk-foot"><span class="trk-progress"></span><span class="trk-dist"></span></div>
        </div>
        <div class="trk-side hidden">
          <span class="trk-side-tag">Story</span>
          <span class="trk-side-text"></span>
        </div>
        <div class="trk-hint"></div>
      </div>
      <div class="toasts"></div>
      </div>
      <div class="boss-bar hidden">
        <div class="boss-name"></div>
        <div class="boss-hp"><div class="fill"></div></div>
      </div>
      <div class="hunt-bar hidden">
        <span class="hunt-tag">Hunting</span>
        <div class="hunt-body"><div class="hunt-name"></div><div class="hunt-meta"></div></div>
      </div>
      <div class="quickbar"></div>
      <div class="interact-prompt hidden"></div>
      <div class="hint">${touch ? 'Drag to sail · tap ✕ to fire' : 'WASD sail · Space fire · F interact · I inventory · M map'}</div>
      ${touch ? `
      <div class="touch-actions">
        <button class="hud-btn fire-btn" aria-label="Fire cannons">✕</button>
        <button class="hud-btn interact-btn hidden" aria-label="Interact">F</button>
      </div>
      <div class="board-actions hidden">
        <button class="hud-btn sword-tbtn">🗡</button>
        <button class="hud-btn pistol-tbtn">🔫</button>
        <button class="hud-btn dash-tbtn">💨</button>
      </div>` : ''}`;
    uiRoot.appendChild(this.el);

    this.el.querySelector('#hud-coins img').src = hudCoinIcon().toDataURL();
    this.el.querySelector('#hud-wood img').src = hudWoodIcon().toDataURL();
    this.coinsEl = this.el.querySelector('#hud-coins span');
    this.woodEl = this.el.querySelector('#hud-wood span');
    this.needle = this.el.querySelector('.compass-needle');
    this.questArrow = this.el.querySelector('.quest-arrow:not(.relic-arrow)');
    this.relicArrow = this.el.querySelector('.relic-arrow');
    this.trk = this.el.querySelector('.tracker');
    this.trkChapter = this.el.querySelector('.trk-chapter');
    this.trkTitle = this.el.querySelector('.trk-title');
    this.trkObjective = this.el.querySelector('.trk-objective');
    this.trkBar = this.el.querySelector('.trk-bar i');
    this.trkProgress = this.el.querySelector('.trk-progress');
    this.trkDist = this.el.querySelector('.trk-dist');
    this.trkSide = this.el.querySelector('.trk-side');
    this.trkSideText = this.el.querySelector('.trk-side-text');
    this.trkHint = this.el.querySelector('.trk-hint');
    this.el.querySelector('.trk-help').addEventListener('click', () => game.guide?.nudge());
    this.huntBar = this.el.querySelector('.hunt-bar');
    this.bossBar = this.el.querySelector('.boss-bar');
    this.bossName = this.el.querySelector('.boss-name');
    this.bossFill = this.el.querySelector('.boss-hp .fill');
    this.hint = this.el.querySelector('.hint');
    this.prompt = this.el.querySelector('.interact-prompt');
    this.toastsEl = this.el.querySelector('.toasts');
    this.quickbarEl = this.el.querySelector('.quickbar');
    this.hpFill = this.el.querySelector('.hp-bar .fill');
    this.hpText = this.el.querySelector('.hp-bar .bar-text');
    this.xpFill = this.el.querySelector('.xp-bar .fill');
    this.lvlText = this.el.querySelector('.lvl-text');
    this.hullBar = this.el.querySelector('.hull-bar');
    this.hullFill = this.el.querySelector('.hull-bar .fill');
    this.hullText = this.el.querySelector('.hull-bar .bar-text');

    this.el.querySelector('.pause-btn').addEventListener('click', () => game.events.emit('input:pause'));
    this.el.querySelector('.bag-btn').addEventListener('click', () => game.inventoryUI.toggle());
    this.el.querySelector('.map-btn').addEventListener('click', () => game.mapUI.toggle());
    this.el.querySelector('.log-btn').addEventListener('click', () => game.logUI.toggle());
    this.el.querySelector('.fish-btn')?.addEventListener('pointerdown', () => game.input.pressVirtual('KeyR'));
    this.el.querySelector('.fire-btn')?.addEventListener('pointerdown', () => game.input.pressVirtual('Space'));
    this.el.querySelector('.interact-btn')?.addEventListener('pointerdown', () => game.input.pressVirtual('KeyF'));
    this.el.querySelector('.sword-tbtn')?.addEventListener('pointerdown', () => game.input.pressVirtual('SwordBtn'));
    this.el.querySelector('.pistol-tbtn')?.addEventListener('pointerdown', () => game.input.pressVirtual('PistolBtn'));
    this.el.querySelector('.dash-tbtn')?.addEventListener('pointerdown', () => game.input.pressVirtual('DashBtn'));

    game.events.on('resources:changed', (r) => this._setResources(r));
    game.events.on('player:changed', () => this._refreshBars());
    game.events.on('playership:damaged', () => this._refreshBars());
    game.events.on('quickbar:changed', () => this.renderQuickbar());
    game.events.on('player:levelup', ({ level }) => this.toast(`Level up! You are now level ${level}`, '#f0d090'));
    game.events.on('boarding:start', () => this.el.querySelector('.board-actions')?.classList.remove('hidden'));
    game.events.on('boarding:end', () => this.el.querySelector('.board-actions')?.classList.add('hidden'));

    this._setResources(game.resources);
    this._refreshBars();
    this.renderQuickbar();
    setTimeout(() => this.hint.classList.add('fade'), 10000);
  }

  _setResources(r) {
    this._pop(this.coinsEl, r.coins);
    this._pop(this.woodEl, this.game.inventory.totalCount('wood'));
  }

  _pop(el, value) {
    const str = String(value);
    if (el.textContent !== str) {
      el.textContent = str;
      el.parentElement.classList.remove('pop');
      void el.parentElement.offsetWidth;
      el.parentElement.classList.add('pop');
    }
  }

  _refreshBars() {
    const p = this.game.player;
    const st = this.game.shipState;
    const hpFrac = p.health / p.maxHealth;
    this.hpFill.style.width = `${hpFrac * 100}%`;
    this.hpFill.style.background = hpFrac > 0.5 ? '#6fce62' : hpFrac > 0.25 ? '#e0b345' : '#e05a4a';
    this.hpText.textContent = `${Math.round(p.health)}/${p.maxHealth}`;
    this.xpFill.style.width = `${(p.xp / p.xpNext) * 100}%`;
    this.lvlText.textContent = `Lv ${p.level}`;
    const hullFrac = st.hull / st.maxHull;
    this.hullFill.style.width = `${hullFrac * 100}%`;
    this.hullFill.style.background = hullFrac > 0.5 ? '#c9a06a' : hullFrac > 0.25 ? '#e0b345' : '#e05a4a';
    this.hullText.textContent = `Hull ${Math.round(st.hull)}`;
    this.hullBar.classList.toggle('danger', st.inDanger);
  }

  renderQuickbar() {
    const { game } = this;
    this.quickbarEl.innerHTML = '';
    for (let i = 0; i < QUICKBAR_SIZE; i++) {
      const id = game.inventory.quickbar[i];
      const count = id ? game.inventory.totalCount(id) : 0;
      const cell = document.createElement('div');
      cell.className = `slot qb-slot ${id && count > 0 ? 'filled' : ''}`;
      cell.dataset.addr = JSON.stringify({ container: 'quickbar', index: i });
      cell.innerHTML = `<span class="qb-key">${i + 1}</span>` + (id
        ? `<img draggable="false" src="${itemIcon(id).toDataURL()}" alt="${ITEMS[id].name}"><span class="qty">${count}</span>`
        : '');
      cell.addEventListener('click', () => game.useQuickbar(i));
      this.quickbarEl.appendChild(cell);
    }
  }

  /* ---- quest tracker ----------------------------------------------- */
  //
  // One panel answers "what now". The main quest is the backbone and is
  // always shown; the story campaign — which is the tutorial and ends —
  // rides as a secondary line while it is running. story.js still calls
  // showObjective/updateObjective exactly as it always did.

  /** Story objective (the old API, unchanged for callers). */
  showObjective(text, hint) {
    if (!text) return this.hideObjective();
    this._storyObj = text;
    this.trkSideText.textContent = text;
    this.trkSide.classList.remove('hidden');
    this.trkHint.textContent = hint ?? '';
    this.trkHint.classList.toggle('hidden', !hint);
    this.trk.classList.remove('pulse');
    void this.trk.offsetWidth;
    this.trk.classList.add('pulse');
    clearTimeout(this._hintTimer);
    if (hint) this._hintTimer = setTimeout(() => this.trkHint.classList.add('faded'), 16000);
    else this.trkHint.classList.remove('faded');
  }

  /** Cheap per-tick refresh for counters like "3/6 fragments". */
  updateObjective(text) {
    if (!text || text === this._storyObj) return;
    this._storyObj = text;
    this.trkSideText.textContent = text;
    this.trkSide.classList.remove('tick');
    void this.trkSide.offsetWidth;
    this.trkSide.classList.add('tick');
  }

  hideObjective() {
    this._storyObj = null;
    this.trkSide.classList.add('hidden');
    this.trkHint.classList.add('hidden');
  }

  /**
   * Redraw the tracker from the main quest. Called every frame; all the
   * writes are guarded on change so it costs nothing when idle.
   */
  _updateTracker() {
    const mq = this.game.mainQuest;
    if (!mq) return;
    const ch = mq.current;

    if (!ch) {
      // Crowned. The panel stays, because a king still wants a heading.
      if (this._trkState !== 'done') {
        this._trkState = 'done';
        this.trk.classList.remove('hidden');
        this.trkChapter.textContent = 'Complete';
        this.trkTitle.textContent = 'Pirate King';
        this.trkObjective.textContent = 'The sea is yours. Sail where you like.';
        this.trkBar.style.width = '100%';
        this.trkProgress.textContent = '';
        this.trkDist.textContent = '';
      }
      return;
    }

    const p = mq.progress;
    const pos = mq.position;
    const key = `${ch.id}:${p.have}/${p.need}`;
    this.trk.classList.remove('hidden');

    if (this._trkState !== key) {
      const chapterChanged = this._trkChapter !== ch.id;
      this._trkState = key;
      this._trkChapter = ch.id;
      this.trkChapter.textContent = `${pos.index} of ${pos.total}`;
      this.trkTitle.textContent = ch.title;
      this.trkObjective.textContent = ch.objective;
      this.trkProgress.textContent = `${p.have} / ${p.need}`;
      this.trkBar.style.width = `${p.pct}%`;
      if (chapterChanged) {
        this.trk.classList.remove('pulse');
        void this.trk.offsetWidth;
        this.trk.classList.add('pulse');
        // A fresh chapter carries its hint until the player moves on.
        this.trkHint.textContent = ch.hint;
        this.trkHint.classList.remove('hidden', 'faded');
        clearTimeout(this._chHintTimer);
        this._chHintTimer = setTimeout(() => this.trkHint.classList.add('faded'), 18000);
      } else {
        this.trkProgress.classList.remove('tick');
        void this.trkProgress.offsetWidth;
        this.trkProgress.classList.add('tick');
      }
    }

    // Distance and bearing to wherever this chapter points.
    const t = mq.trackedTarget();
    if (t) {
      const dx = t.x - this.game.ship.x;
      const dy = t.y - this.game.ship.y;
      const d = Math.round(Math.hypot(dx, dy));
      const compass = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
      const dir = compass[(Math.round((Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8)];
      const text = `${d > 999 ? `${(d / 1000).toFixed(1)}k` : d} ${dir}`;
      if (this.trkDist.textContent !== text) this.trkDist.textContent = text;
    } else if (this.trkDist.textContent) {
      this.trkDist.textContent = '';
    }
  }

  /* ---- notifications ------------------------------------------------ */
  //
  // Every system in the game funnels through toast(), so the modern
  // presentation is built into notify() and toast() forwards to it — no
  // call site has to change to get an icon, a dismiss button and a
  // sensible queue.

  /**
   * @param {string} text  the headline
   * @param {object} opts  { kind, detail, color, hold }
   *   kind picks the icon glyph; detail is an optional second line.
   */
  notify(text, opts = {}) {
    const color = opts.color ?? '#e8ddc4';
    const kind = opts.kind ?? guessKind(text, color);
    const hold = opts.hold ?? 4200;

    const n = document.createElement('div');
    n.className = 'note';
    n.style.setProperty('--note', color);
    n.innerHTML = `
      <span class="note-icon">${NOTE_ICONS[kind] ?? NOTE_ICONS.info}</span>
      <div class="note-body">
        <span class="note-text"></span>
        ${opts.detail ? '<span class="note-detail"></span>' : ''}
      </div>
      <button class="note-x" aria-label="Dismiss">✕</button>
      <i class="note-timer"></i>`;
    n.querySelector('.note-text').textContent = text;
    if (opts.detail) n.querySelector('.note-detail').textContent = opts.detail;

    const close = () => {
      if (n.dataset.closing) return;
      n.dataset.closing = '1';
      clearTimeout(n._t);
      n.classList.add('out');
      setTimeout(() => n.remove(), 260);
    };
    n.querySelector('.note-x').addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });
    // The countdown bar is the auto-dismiss made visible, so a
    // notification never vanishes without warning.
    n.querySelector('.note-timer').style.animationDuration = `${hold}ms`;
    n._t = setTimeout(close, hold);

    this.toastsEl.appendChild(n);
    // Oldest goes first when the stack is full — a burst of pickups must
    // never bury the one line that mattered.
    while (this.toastsEl.children.length > MAX_NOTES) {
      const first = this.toastsEl.firstChild;
      clearTimeout(first._t);
      first.remove();
    }
    return n;
  }

  /** The long-standing API every system already calls. */
  toast(text, color = '#e8ddc4') {
    return this.notify(text, { color });
  }

  showPrompt(text) {
    this.prompt.textContent = text;
    this.prompt.classList.remove('hidden');
    this.el.querySelector('.interact-btn')?.classList.remove('hidden');
  }

  hidePrompt() {
    this.prompt.classList.add('hidden');
    this.el.querySelector('.interact-btn')?.classList.add('hidden');
  }

  /** Called every frame. */
  update() {
    const { game } = this;
    this._updateTracker();
    const deg = (game.ship.heading * 180) / Math.PI + 90;
    this.needle.style.transform = `translate(-50%,-100%) rotate(${deg}deg)`;

    // Guide arrow: the story's heading takes priority, then an active
    // hunt, then contracts — so the player is never left wondering where
    // to point the bow, and a bounty you are actively chasing outranks
    // the errand you picked up three ports ago.
    const storyMark = game.story?.trackedTarget();
    const bountyMark = !storyMark ? game.bounties?.trackedTarget() : null;
    const guide = storyMark ?? bountyMark ?? game.quests.trackedTarget();
    if (guide) {
      const a = Math.atan2(guide.y - game.ship.y, guide.x - game.ship.x);
      this.questArrow.classList.remove('hidden');
      this.questArrow.classList.toggle('story', !!storyMark);
      this.questArrow.classList.toggle('bounty', !!bountyMark);
      this.questArrow.style.transform = `translate(-50%,-50%) rotate(${(a * 180) / Math.PI + 90}deg)`;
    } else {
      this.questArrow.classList.add('hidden');
    }

    // Hunt banner: name, rank and the clock you are racing.
    const hunt = game.bounties?.active;
    if (hunt) {
      const d = Math.round(Math.hypot(hunt.x - game.ship.x, hunt.y - game.ship.y));
      this.huntBar.classList.remove('hidden');
      this.huntBar.querySelector('.hunt-name').textContent = hunt.name;
      this.huntBar.querySelector('.hunt-meta').textContent =
        `${'☠'.repeat(hunt.skulls)} · ${d} away · escapes in ${game.bounties.escapeClock}`;
    } else {
      this.huntBar.classList.add('hidden');
    }

    // relic senses: Golden Compass points to the unfound; the Treasure
    // Locator trembles toward unopened riches.
    const target = game.relicTarget?.();
    if (target) {
      const a = Math.atan2(target.y - game.ship.y, target.x - game.ship.x);
      this.relicArrow.classList.remove('hidden');
      this.relicArrow.style.transform = `translate(-50%,-50%) rotate(${(a * 180) / Math.PI + 90}deg)`;
    } else {
      this.relicArrow.classList.add('hidden');
    }

    // One blow from the grave. Loud on purpose — nobody should ever die
    // without having been told, in the corner of their eye, that they
    // were about to.
    const wound = game.mortality;
    this.woundBadge ??= this.el.querySelector('.wound-badge');
    if (wound?.wounded) {
      this.woundBadge.classList.remove('hidden');
      this.woundBadge.querySelector('.wound-clock').textContent =
        `${Math.max(0, Math.ceil(wound.woundLeft))}s`;
    } else {
      this.woundBadge.classList.add('hidden');
    }

    // legend health bar
    const boss = game.legends?.activeBoss;
    if (boss) {
      this.bossBar.classList.remove('hidden');
      this.bossName.textContent = `${boss.name} — Phase ${boss.phase}`;
      this.bossFill.style.width = `${Math.max(0, (boss.hp / boss.max) * 100)}%`;
    } else {
      this.bossBar.classList.add('hidden');
    }
  }

  destroy() {
    this.el.remove();
  }
}
