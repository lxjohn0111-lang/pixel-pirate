// The Captain's Log (L): Collection book, Achievements, Statistics,
// Factions and Daily content. Read-only views over the meta systems,
// plus the daily chart claim and the ship cosmetics locker.

import { COLLECTION } from '../meta/collection.js';
import { ACHIEVEMENTS } from '../meta/achievements.js';
import { STAT_LABELS } from '../meta/stats.js';
import { FACTIONS } from '../world/factions.js';
import { MODIFIERS } from '../meta/daily.js';
import { SAILS, FLAGS, FIGUREHEADS, LANTERNS } from '../meta/cosmetics.js';

export class LogUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.tab = 'collection';
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
      ['factions', 'Factions'],
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
    this[`_${this.tab}`](body);
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

  _factions(body) {
    const { factions } = this.game;
    body.innerHTML = Object.entries(FACTIONS).map(([id, f]) => {
      const rep = factions.rep[id];
      const pct = ((rep + 100) / 200) * 100;
      return `<div class="fact-row">
        <div class="fact-head"><span style="color:${f.color}">${f.name}</span>
        <b style="color:${f.color}">${factions.label(id)} (${rep > 0 ? '+' : ''}${rep})</b></div>
        <div class="fact-bar"><div style="width:${pct}%;background:${f.color}"></div><i></i></div>
        <div class="fact-desc">${f.desc}</div>
      </div>`;
    }).join('') + '<p class="panel-note">Standing shifts with your deeds: who you sink, who you save, who you serve.</p>';
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
