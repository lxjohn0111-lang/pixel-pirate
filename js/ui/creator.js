// Character creation screen. Full-DOM UI with a live animated canvas
// preview of the pirate. Confirming hands the appearance to the game;
// if a save exists a "Continue Voyage" path skips creation entirely.

import {
  OPTIONS, PALETTE, HAIR_COLORS, SKIN_COLORS,
  drawPirate, randomAppearance, defaultAppearance, PIRATE_W, PIRATE_H,
} from '../render/pirate.js';

const PREVIEW_SCALE = 7;

export class CharacterCreator {
  constructor(uiRoot, existingSave, onStart) {
    this.uiRoot = uiRoot;
    this.save = existingSave;
    this.onStart = onStart;
    this.appearance = existingSave?.appearance
      ? { ...existingSave.appearance }
      : randomAppearance();
    this.el = null;
    this._raf = 0;
  }

  show() {
    const hasSave = !!this.save?.appearance;
    const el = document.createElement('div');
    el.className = 'screen creator';
    el.innerHTML = `
      <div class="creator-inner">
        <header class="creator-header">
          <h1>Sea of Rogues</h1>
          <p class="tagline">Every legend starts with one sail.</p>
        </header>
        <div class="creator-body">
          <div class="creator-preview">
            <canvas class="preview-canvas" width="${PIRATE_W * PREVIEW_SCALE + 40}" height="${PIRATE_H * PREVIEW_SCALE + 60}"></canvas>
            <button class="btn btn-ghost randomize">&#x2684; Randomize</button>
          </div>
          <div class="creator-options"></div>
        </div>
        <footer class="creator-footer">
          ${hasSave ? '<button class="btn btn-primary continue-btn">Continue Voyage</button>' : ''}
          <button class="btn ${hasSave ? '' : 'btn-primary'} sail-btn">${hasSave ? 'New Pirate' : 'Set Sail'}</button>
        </footer>
      </div>`;
    this.uiRoot.appendChild(el);
    this.el = el;

    this._buildOptions(el.querySelector('.creator-options'));

    el.querySelector('.randomize').addEventListener('click', () => {
      this.appearance = randomAppearance();
      this._refreshOptions();
    });
    el.querySelector('.sail-btn').addEventListener('click', () => {
      if (hasSave && !confirm('Start a new voyage? Your current captain and progress will be lost.')) return;
      this._finish(false);
    });
    el.querySelector('.continue-btn')?.addEventListener('click', () => this._finish(true));

    // Live animated preview.
    this.previewCtx = el.querySelector('.preview-canvas').getContext('2d');
    this.previewCtx.imageSmoothingEnabled = false;
    this._pirateBuf = document.createElement('canvas');
    this._pirateBuf.width = PIRATE_W;
    this._pirateBuf.height = PIRATE_H;
    const loop = (ts) => {
      this._drawPreview(ts / 1000);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  _finish(useSave) {
    cancelAnimationFrame(this._raf);
    this.el.classList.add('fade-out');
    const appearance = useSave ? this.save.appearance : this.appearance;
    setTimeout(() => {
      this.el.remove();
      this.onStart(appearance, useSave);
    }, 450);
  }

  /* ---- option rows ---------------------------------------------------- */

  _buildOptions(root) {
    this._rows = {};
    const sections = [
      ['The Pirate', ['skin', 'hair', 'hairColor', 'beard']],
      ['The Garb', ['hat', 'coat', 'pants', 'boots']],
      ['Battle Scars', ['eyepatch', 'hook', 'woodenLeg']],
    ];
    for (const [title, keys] of sections) {
      const h = document.createElement('h3');
      h.textContent = title;
      root.appendChild(h);
      for (const key of keys) root.appendChild(this._makeStepper(key));
    }

    const h = document.createElement('h3');
    h.textContent = 'Colors';
    root.appendChild(h);
    root.appendChild(this._makeSwatches('primary', 'Primary', PALETTE));
    root.appendChild(this._makeSwatches('secondary', 'Secondary', PALETTE));
  }

  _makeStepper(key) {
    const opt = OPTIONS[key];
    const row = document.createElement('div');
    row.className = 'opt-row';
    row.innerHTML = `
      <span class="opt-label">${opt.label}</span>
      <button class="opt-arrow" data-dir="-1" aria-label="Previous ${opt.label}">&#9664;</button>
      <span class="opt-value"></span>
      <button class="opt-arrow" data-dir="1" aria-label="Next ${opt.label}">&#9654;</button>`;
    const value = row.querySelector('.opt-value');
    const update = () => {
      if (key === 'hairColor') {
        value.innerHTML = `<span class="mini-swatch" style="background:${HAIR_COLORS[this.appearance.hairColor]}"></span>`;
      } else if (key === 'skin') {
        value.innerHTML = `<span class="mini-swatch" style="background:${SKIN_COLORS[this.appearance.skin]}"></span> ${opt.values[this.appearance.skin]}`;
      } else {
        value.textContent = opt.values[this.appearance[key]];
      }
    };
    row.querySelectorAll('.opt-arrow').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = opt.values.length;
        this.appearance[key] = (this.appearance[key] + Number(btn.dataset.dir) + n) % n;
        update();
      });
    });
    update();
    this._rows[key] = update;
    return row;
  }

  _makeSwatches(key, label, colors) {
    const row = document.createElement('div');
    row.className = 'opt-row swatch-row';
    row.innerHTML = `<span class="opt-label">${label}</span><span class="swatches"></span>`;
    const holder = row.querySelector('.swatches');
    const buttons = colors.map((c, i) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = c;
      b.setAttribute('aria-label', `${label} color ${i + 1}`);
      b.addEventListener('click', () => {
        this.appearance[key] = i;
        update();
      });
      holder.appendChild(b);
      return b;
    });
    const update = () => {
      buttons.forEach((b, i) => b.classList.toggle('selected', i === this.appearance[key]));
    };
    update();
    this._rows[key] = update;
    return row;
  }

  _refreshOptions() {
    Object.values(this._rows).forEach((fn) => fn());
  }

  /* ---- animated preview -------------------------------------------------- */

  _drawPreview(t) {
    const g = this.previewCtx;
    const W = g.canvas.width;
    const H = g.canvas.height;

    // Backdrop: sky, sea, deck.
    const sky = g.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, '#8ec3dd');
    sky.addColorStop(1, '#cfe3ea');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H * 0.55);
    g.fillStyle = '#2a7ab0';
    g.fillRect(0, H * 0.55, W, H * 0.2);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 5; i++) {
      const wx = ((t * 14 + i * 67) % (W + 30)) - 15;
      g.fillRect(wx, H * 0.57 + (i % 3) * 9, 12 + (i % 2) * 8, 2);
    }
    // deck planks
    g.fillStyle = '#8a5f38';
    g.fillRect(0, H * 0.75, W, H * 0.25);
    g.fillStyle = '#7a5230';
    for (let y = H * 0.75; y < H; y += 12) g.fillRect(0, y, W, 2);
    g.fillStyle = '#96703f';
    for (let y = H * 0.75 + 4; y < H; y += 12) g.fillRect(0, y, W, 1);

    // Pirate, bobbing gently with the ship.
    const buf = this._pirateBuf;
    const bg = buf.getContext('2d');
    bg.clearRect(0, 0, buf.width, buf.height);
    drawPirate(bg, this.appearance, { t, animate: true });

    const px = Math.round((W - PIRATE_W * PREVIEW_SCALE) / 2);
    const py = Math.round(H - PIRATE_H * PREVIEW_SCALE - 18 + Math.sin(t * 1.3) * 3);
    g.fillStyle = 'rgba(20,16,12,0.3)';
    g.beginPath();
    g.ellipse(W / 2, H - 20, PIRATE_W * PREVIEW_SCALE * 0.32, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.imageSmoothingEnabled = false;
    g.drawImage(buf, px, py, PIRATE_W * PREVIEW_SCALE, PIRATE_H * PREVIEW_SCALE);
  }
}
