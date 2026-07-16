// Pause menu with settings (volumes, effects quality) and new-voyage.

export class PauseMenu {
  constructor(uiRoot, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'screen pause hidden';
    const s = game.settings;
    this.el.innerHTML = `
      <div class="pause-panel">
        <h2>Anchored</h2>
        <div class="pause-info"></div>
        <button class="btn btn-primary resume-btn">Resume</button>
        <div class="settings">
          <label>Master <input type="range" min="0" max="1" step="0.05" data-key="master" value="${s.master}"></label>
          <label>Music <input type="range" min="0" max="1" step="0.05" data-key="music" value="${s.music}"></label>
          <label>Effects <input type="range" min="0" max="1" step="0.05" data-key="sfx" value="${s.sfx}"></label>
          <label class="quality-row">Visual Effects
            <select data-key="quality">
              <option value="high" ${s.quality === 'high' ? 'selected' : ''}>Full</option>
              <option value="low" ${s.quality === 'low' ? 'selected' : ''}>Light</option>
            </select>
          </label>
        </div>
        <button class="btn btn-ghost newgame-btn">New Voyage</button>
        <p class="pause-tip">Progress is saved automatically.</p>
      </div>`;
    uiRoot.appendChild(this.el);

    this.el.querySelector('.resume-btn').addEventListener('click', () => game.resume());
    this.el.querySelector('.newgame-btn').addEventListener('click', () => {
      if (confirm('Abandon this voyage and start over? All progress will be lost.')) {
        game.newGame();
      }
    });
    this.el.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      if (!key) return;
      game.settings[key] = key === 'quality' ? e.target.value : Number(e.target.value);
      game.events.emit('settings:changed', game.settings);
    });
  }

  show() {
    const { dayNight, weather, world, resources } = this.game;
    const phase = dayNight.snapshot.phase;
    this.el.querySelector('.pause-info').innerHTML =
      `Day ${dayNight.day} &middot; ${phase[0].toUpperCase() + phase.slice(1)} &middot; ` +
      `${weather.kind[0].toUpperCase() + weather.kind.slice(1)}<br>` +
      `${resources.coins} gold &middot; ${resources.wood} wood &middot; seed ${world.seed}`;
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }

  destroy() {
    this.el.remove();
  }
}
