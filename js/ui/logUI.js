// The Captain's Log (L): Collection book, Achievements, Statistics,
// Factions and Daily content. Read-only views over the meta systems,
// plus the daily chart claim and the ship cosmetics locker.

import { COLLECTION } from '../meta/collection.js';
import { ACHIEVEMENTS } from '../meta/achievements.js';
import { STAT_LABELS } from '../meta/stats.js';
import { CLANS, CLAN_IDS, REP_PERKS } from '../world/clans.js';
import { clanBadge, clanEmblem } from '../render/clanart.js';
import { MODIFIERS } from '../meta/daily.js';
import { SAILS, FLAGS, FIGUREHEADS, LANTERNS } from '../meta/cosmetics.js';

export class LogUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.tab = 'collection';
    this.clanFocus = null; // clan id whose profile is open
    this.el = document.createElement('div');
    this.el.className = 'panel captain-panel hidden';
    uiRoot.appendChild(this.el);
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open(tab = this.tab) {
    // Leaving the Clans tab drops the open profile, so coming back lands
    // on the list rather than wherever you happened to stop reading.
    if (tab !== 'clans') this.clanFocus = null;
    this.tab = tab;
    this.el.classList.remove('hidden');
    this.game.events.emit('sfx', 'ui');
    this.render();
  }

  close() {
    this.el.classList.add('hidden');
    this.game.save();
  }

  render() {
    const { game } = this;
    const tabs = [
      ['collection', `Collection ${game.collection.completionPercent}%`],
      ['achievements', 'Achievements'],
      ['stats', 'Statistics'],
      ['clans', 'Clans'],
      ['daily', 'Daily'],
      ['locker', 'Locker'],
    ];
    this.el.innerHTML = `
      <div class="panel-head">
        <div class="panel-tabs">
          ${tabs.map(([k, l]) => `<button class="tab-btn ${k === this.tab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
        </div>
        <button class="close-btn" aria-label="Close">✕</button>
      </div>
      <div class="panel-body"></div>`;
    this.el.querySelector('.close-btn').addEventListener('click', () => this.close());
    this.el.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => this.open(b.dataset.tab)));
    const body = this.el.querySelector('.panel-body');
    // Fall back rather than throw: an unknown tab name (a renamed tab, a
    // stale deep link) should land somewhere useful, not break the panel.
    const draw = this[`_${this.tab}`] ?? this._collection;
    draw.call(this, body);
  }

  _collection(body) {
    const { collection } = this.game;
    body.innerHTML = Object.entries(COLLECTION).map(([cat, def]) => {
      const p = collection.progress(cat);
      const entries = Object.entries(def.entries).map(([id, name]) => {
        const found = collection.has(cat, id);
        return `<span class="col-entry ${found ? 'found' : ''}">${found ? name : '???'}</span>`;
      }).join('');
      const done = p.n >= p.total;
      return `<div class="col-cat">
        <h4>${def.name} <span class="hint-inline">${p.n}/${p.total}${done ? ` — reward: ${def.reward.label} ✔` : ` — completes: ${def.reward.label}`}</span></h4>
        <div class="col-entries">${entries}</div>
      </div>`;
    }).join('');
  }

  _achievements(body) {
    const { achievements } = this.game;
    body.innerHTML = ACHIEVEMENTS.map((a) => {
      const done = achievements.unlocked.has(a.id);
      const prog = achievements.progressFor(a);
      return `<div class="ach-row ${done ? 'done' : ''}">
        <div class="ach-check">${done ? '★' : '☆'}</div>
        <div class="ach-info">
          <div class="ach-name">${a.name}${a.reward ? ` <span class="hint-inline">→ ${a.reward.label}</span>` : ''}</div>
          <div class="ach-desc">${a.desc}</div>
          ${!done && a.stat ? `<div class="ach-bar"><div style="width:${Math.round(prog * 100)}%"></div></div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  _stats(body) {
    const { stats } = this.game;
    const fmt = (key, v) => {
      if (key === 'timePlayed') {
        const h = Math.floor(v / 3600);
        const m = Math.floor((v % 3600) / 60);
        return `${h}h ${m}m`;
      }
      return Math.round(v).toLocaleString();
    };
    const extra = `
      <div class="stat-row"><span>Cannon Accuracy</span><b>${stats.accuracy}%</b></div>
      <div class="stat-row"><span>Collection Completion</span><b>${this.game.collection.completionPercent}%</b></div>
      <div class="stat-row"><span>Legend Rank (Prestige)</span><b>${this.game.prestige}</b></div>`;
    body.innerHTML = `<div class="stats-grid">${Object.entries(STAT_LABELS).map(([k, label]) =>
      `<div class="stat-row"><span>${label}</span><b>${fmt(k, stats.get(k))}</b></div>`).join('')}${extra}</div>`;
  }

  /* ---- clans ------------------------------------------------------ */

  _clans(body) {
    const { clans } = this.game;
    if (this.clanFocus) {
      this._clanProfile(body, this.clanFocus);
      return;
    }
    const mine = clans.playerClan;
    const rows = CLAN_IDS.map((id) => {
      const c = CLANS[id];
      const rep = clans.rep[id];
      const pct = ((rep + 100) / 200) * 100;
      const wars = clans.warsOf(id);
      const allies = clans.alliesOf(id);
      return `<button class="clan-row" data-clan="${id}" style="--clan:${c.color}">
        <canvas class="clan-badge" width="44" height="44" data-clan="${id}"></canvas>
        <div class="clan-main">
          <div class="clan-title">
            <b>${c.name}</b>
            <span class="clan-standing">${clans.label(id)} (${rep > 0 ? '+' : ''}${rep})</span>
          </div>
          <div class="clan-sub">${c.leader} · ${c.home} · ${c.personality}</div>
          <div class="clan-bar"><i style="width:${pct}%"></i><em></em></div>
          <div class="clan-facts">
            <span title="Fleet strength">Str <b>${clans.strength[id]}</b></span>
            <span title="Hulls they can put to sea">Fleet <b>${clans.fleetSize(id)}</b></span>
            <span title="Harbours held">Ports <b>${clans.portCount(id)}</b></span>
            ${wars.length ? `<span class="clan-war">At war: ${wars.map((w) => CLANS[w].short).join(', ')}</span>` : ''}
            ${allies.length ? `<span class="clan-ally">Allied: ${allies.map((a) => CLANS[a].short).join(', ')}</span>` : ''}
          </div>
        </div>
        <span class="clan-go">›</span>
      </button>`;
    }).join('');

    body.innerHTML = `
      ${mine ? `<div class="my-clan" style="--clan:${mine.color}">
          <canvas class="clan-badge" width="44" height="44" data-mine="1"></canvas>
          <div><span class="clan-eyebrow">Your clan</span><b>${mine.name}</b>
          <i>${mine.members?.length ?? 0} sworn · founded day ${mine.founded}</i></div>
        </div>`
        : `<div class="found-teaser">
            <b>Found your own clan</b>
            <p class="panel-note">Reach an average standing of +35 across the six clans and any
            harbourmaster will register your colours. Currently ${clans.globalRep >= 0 ? '+' : ''}${clans.globalRep}.</p>
            <div class="clan-bar wide"><i style="width:${Math.max(0, Math.min(100, ((clans.globalRep + 100) / 135) * 100))}%"></i></div>
          </div>`}
      <div class="clan-list">${rows}</div>
      ${clans.log.length ? `<h4>Word from the sea lanes</h4>
        <div class="clan-log">${clans.log.slice(0, 8).map((l) =>
          `<div class="clan-log-row"><span>Day ${l.day}</span>${l.text}</div>`).join('')}</div>` : ''}`;

    body.querySelectorAll('canvas.clan-badge').forEach((c) => {
      const clan = c.dataset.mine ? clans.playerClan : CLANS[c.dataset.clan];
      if (clan) c.getContext('2d').drawImage(clanBadge(clan, 44), 0, 0);
    });
    body.querySelectorAll('.clan-row').forEach((b) => b.addEventListener('click', () => {
      this.clanFocus = b.dataset.clan;
      this.game.events.emit('sfx', 'ui');
      this.render();
    }));
  }

  _clanProfile(body, id) {
    const { clans } = this.game;
    const c = CLANS[id];
    const rep = clans.rep[id];
    const wars = clans.warsOf(id);
    const allies = clans.alliesOf(id);
    const perks = REP_PERKS.map((p) => {
      const has = p.bad ? rep <= p.at : rep >= p.at;
      return `<li class="${has ? (p.bad ? 'perk-bad' : 'perk-on') : 'perk-off'}">
        <span>${p.bad ? '!' : has ? '✓' : '·'}</span>
        ${p.text}<i>${p.bad ? 'at' : 'needs'} ${p.at > 0 ? '+' : ''}${p.at}</i></li>`;
    }).join('');

    body.innerHTML = `
      <button class="clan-back">‹ All clans</button>
      <div class="clan-profile" style="--clan:${c.color}">
        <header class="cp-head">
          <canvas class="cp-badge" width="72" height="72"></canvas>
          <div>
            <h3>${c.name}</h3>
            <p class="cp-motto">“${c.motto}”</p>
            <p class="cp-standing">${clans.label(id)} <span>(${rep > 0 ? '+' : ''}${rep})</span></p>
          </div>
        </header>
        <div class="cp-grid">
          <div><span>Leader</span><b>${c.leader}</b><i>${c.leaderTitle}</i></div>
          <div><span>Home waters</span><b>${c.home}</b></div>
          <div><span>Temperament</span><b>${c.personality}</b></div>
          <div><span>Fleet strength</span><b>${clans.strength[id]}</b></div>
          <div><span>Hulls at sea</span><b>${clans.fleetSize(id)}</b></div>
          <div><span>Harbours held</span><b>${clans.portCount(id)}</b></div>
        </div>
        <p class="cp-desc">${c.playstyle}</p>
        <div class="cp-cols">
          <div>
            <h4>Wars</h4>
            ${wars.length ? wars.map((w) => `<div class="cp-rel war" style="--o:${CLANS[w].color}">${CLANS[w].name}</div>`).join('')
              : '<p class="panel-note">At peace with everyone.</p>'}
          </div>
          <div>
            <h4>Allies</h4>
            ${allies.length ? allies.map((a) => `<div class="cp-rel ally" style="--o:${CLANS[a].color}">${CLANS[a].name}</div>`).join('')
              : '<p class="panel-note">No standing accords.</p>'}
          </div>
        </div>
        <h4>What standing buys you</h4>
        <ul class="cp-perks">${perks}</ul>
      </div>`;

    body.querySelector('.cp-badge').getContext('2d').drawImage(clanBadge(c, 72), 0, 0);
    body.querySelector('.clan-back').addEventListener('click', () => {
      this.clanFocus = null;
      this.game.events.emit('sfx', 'ui');
      this.render();
    });
  }

  _daily(body) {
    const { daily, stats } = this.game;
    const d = daily.daily;
    const w = daily.weekly;
    const mod = daily.modifier;
    const dp = Math.min(d.goal, daily.progress('daily'));
    const wp = Math.min(w.goal, daily.progress('weekly'));
    body.innerHTML = `
      <h4>Today's Tide <span class="hint-inline">(${daily.state.dateKey})</span></h4>
      <div class="quest-row"><div class="quest-info">
        <div class="quest-name">World Modifier: ${mod.name}</div>
        <div class="quest-desc">${mod.desc}</div>
      </div></div>
      <div class="quest-row ${daily.state.dailyDone ? 'turnin-row' : ''}"><div class="quest-info">
        <div class="quest-name">Daily: ${d.name} ${daily.state.dailyDone ? '✔' : ''}</div>
        <div class="quest-desc">${d.desc} — ${dp}/${d.goal}</div>
        <div class="quest-reward">${d.gold} gold · ${d.xp} XP</div>
      </div></div>
      <div class="quest-row ${daily.state.weeklyDone ? 'turnin-row' : ''}"><div class="quest-info">
        <div class="quest-name">Weekly: ${w.name} ${daily.state.weeklyDone ? '✔' : ''}</div>
        <div class="quest-desc">${w.desc} — ${wp}/${w.goal}</div>
        <div class="quest-reward">${w.gold} gold · ${w.xp} XP</div>
      </div></div>
      <div class="quest-row"><div class="quest-info">
        <div class="quest-name">Today's Treasure</div>
        <div class="quest-desc">One free charted treasure, every day.</div>
      </div>
      <button class="mini-btn chart-btn" ${daily.state.chartClaimed ? 'disabled' : ''}>${daily.state.chartClaimed ? 'Claimed' : 'Claim Chart'}</button></div>
      <h4>Legacy</h4>
      <div class="quest-row"><div class="quest-info">
        <div class="quest-name">Retire into Legend (Prestige ${this.game.prestige})</div>
        <div class="quest-desc">At level 20+, retire at any tavern: level resets, your legend grows.
        Permanent +2% speed & +1 luck per rank, plus the Flag of Legend.</div>
      </div></div>`;
    body.querySelector('.chart-btn')?.addEventListener('click', () => {
      if (daily.claimChart()) this.render();
    });

    // Once today's free chart is spent, a second one is available to
    // anyone willing to watch for it.
    if (daily.state.chartClaimed && this.game.ads.canOffer('dailyChart')) {
      const row = document.createElement('div');
      row.className = 'quest-row ad-row';
      row.innerHTML = `<div class="quest-info">
        <div class="quest-name">Another Heading</div>
        <div class="quest-desc">A second treasure charted, on today's tide.</div>
      </div>`;
      row.appendChild(this.game.ads.button('dailyChart', 'Chart another', () => {
        this.game.encounters.chartTreasure();
        this.game.hud.toast('A second treasure is charted!', '#f0a83c');
        this.game.events.emit('sfx', 'quest');
        this.render();
      }));
      body.querySelector('.chart-btn')?.closest('.quest-row')?.after(row);
    }
  }

  _locker(body) {
    const { cosmetics } = this.game;
    const section = (kind, defs, label) => `
      <h4>${label}</h4>
      <div class="paint-row">
        ${Object.entries(defs).map(([id, d]) => {
          const unlocked = cosmetics.isUnlocked(kind, id);
          const active = cosmetics.equipped[kind] === id;
          return `<button class="mini-btn locker-btn ${active ? 'active' : ''}" data-kind="${kind}" data-id="${id}"
            ${unlocked ? '' : 'disabled'}>${unlocked ? d.name : '🔒 ' + d.name}</button>`;
        }).join('')}
      </div>`;
    body.innerHTML = `
      <p class="panel-note">Cosmetics unlock from ports, collection pages, achievements and prestige. Hull paint is fitted at any shipwright.</p>
      ${section('sail', SAILS, 'Sails')}
      ${section('flag', FLAGS, 'Flags')}
      ${section('figurehead', FIGUREHEADS, 'Figureheads')}
      ${section('lantern', LANTERNS, 'Lanterns')}`;
    body.querySelectorAll('.locker-btn').forEach((b) => {
      b.addEventListener('click', () => {
        this.game.cosmetics.equip(b.dataset.kind, b.dataset.id);
        this._locker(body);
      });
    });
  }
}
