// World map (M): fog-of-war over explored waters, discovered islands
// colored by biome, ports, quest objectives, treasure charts and custom
// markers (click to place, click again to remove). Drag to pan, wheel
// or buttons to zoom.

import { CHUNK_SIZE } from '../core/constants.js';

const BIOME_COLORS = {
  sand: '#e8d29a', palm: '#5c9e52', rock: '#7e8388', jungle: '#40823e', coral: '#f0d8a8',
};

export class MapUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'panel map-panel hidden';
    this.el.innerHTML = `
      <div class="panel-head">
        <div class="panel-tabs"><span class="map-title">Sea Chart</span></div>
        <div class="map-controls">
          <button class="mini-btn zoom-out">−</button>
          <button class="mini-btn zoom-in">+</button>
          <button class="close-btn" aria-label="Close">✕</button>
        </div>
      </div>
      <canvas class="map-canvas"></canvas>
      <div class="map-legend">
        <span><i style="background:#e0b345"></i> You</span>
        <span><i style="background:#c8cdd2"></i> Port</span>
        <span><i style="background:#f0a83c"></i> Treasure</span>
        <span><i style="background:#6fce62"></i> Contract</span>
        <span><i style="background:#c9506a"></i> Marker</span>
        <span class="map-hint">Click the chart to place or remove a marker</span>
      </div>`;
    uiRoot.appendChild(this.el);

    this.canvas = this.el.querySelector('.map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scale = 0.14; // world px -> map px
    this.panX = 0; // world coords at map center (relative to ship)
    this.panY = 0;
    this._raf = 0;
    this._dragging = false;
    this._moved = 0;

    this.el.querySelector('.close-btn').addEventListener('click', () => this.close());
    this.el.querySelector('.zoom-in').addEventListener('click', () => this._zoom(1.5));
    this.el.querySelector('.zoom-out').addEventListener('click', () => this._zoom(1 / 1.5));
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._zoom(e.deltaY < 0 ? 1.25 : 0.8);
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      this._dragging = true;
      this._moved = 0;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      this._moved += Math.abs(dx) + Math.abs(dy);
      this.panX -= dx / this.scale;
      this.panY -= dy / this.scale;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
    window.addEventListener('pointerup', (e) => {
      if (!this._dragging) return;
      this._dragging = false;
      if (this._moved < 6 && e.target === this.canvas) this._clickMarker(e);
    });
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.el.classList.remove('hidden');
    this.panX = 0;
    this.panY = 0;
    this.game.events.emit('sfx', 'ui');
    const loop = () => {
      if (!this.isOpen) return;
      this._draw();
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  close() {
    this.el.classList.add('hidden');
    cancelAnimationFrame(this._raf);
    this.game.save();
  }

  _zoom(f) {
    this.scale = Math.max(0.03, Math.min(0.6, this.scale * f));
  }

  _center() {
    const { ship } = this.game;
    return { x: ship.x + this.panX, y: ship.y + this.panY };
  }

  _toMap(wx, wy) {
    const c = this._center();
    return {
      x: this.canvas.width / 2 + (wx - c.x) * this.scale,
      y: this.canvas.height / 2 + (wy - c.y) * this.scale,
    };
  }

  _toWorld(mx, my) {
    const c = this._center();
    return {
      x: c.x + (mx - this.canvas.width / 2) / this.scale,
      y: c.y + (my - this.canvas.height / 2) / this.scale,
    };
  }

  _clickMarker(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    const w = this._toWorld(mx, my);
    const { markers } = this.game.mapData;
    // remove if clicking near an existing marker
    for (let i = 0; i < markers.length; i++) {
      const m = this._toMap(markers[i].x, markers[i].y);
      if (Math.hypot(m.x - mx, m.y - my) < 10) {
        markers.splice(i, 1);
        this.game.events.emit('sfx', 'ui');
        return;
      }
    }
    if (markers.length >= 20) markers.shift();
    markers.push({ x: Math.round(w.x), y: Math.round(w.y) });
    this.game.events.emit('sfx', 'ui');
  }

  _draw() {
    const { game, ctx: g, canvas } = this;
    const rect = this.el.getBoundingClientRect();
    const w = Math.max(200, Math.floor(rect.width) - 24);
    const h = Math.max(160, Math.floor(rect.height) - 110);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    // parchment background = unexplored
    g.fillStyle = '#20283c';
    g.fillRect(0, 0, w, h);

    // explored water cells (chunk resolution)
    const cell = CHUNK_SIZE * this.scale;
    g.fillStyle = '#2c4a6e';
    for (const key of game.mapData.explored) {
      const [cx, cy] = key.split(',').map(Number);
      const p = this._toMap(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
      if (p.x < -cell || p.y < -cell || p.x > w || p.y > h) continue;
      g.fillRect(p.x, p.y, cell + 0.5, cell + 0.5);
    }

    // discovered islands
    for (const isl of game.mapData.islands) {
      const p = this._toMap(isl.x, isl.y);
      const r = Math.max(3, isl.r * 0.75 * this.scale);
      if (p.x < -r || p.y < -r || p.x > w + r || p.y > h + r) continue;
      g.fillStyle = BIOME_COLORS[isl.biome] ?? '#c9b284';
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fill();
    }

    // ports
    g.font = 'bold 10px monospace';
    for (const port of game.mapData.ports) {
      const p = this._toMap(port.x, port.y);
      if (p.x < -60 || p.y < -20 || p.x > w + 60 || p.y > h + 20) continue;
      g.fillStyle = '#c8cdd2';
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
      g.fillRect(p.x - 1, p.y - 5, 2, 3);
      g.fillStyle = 'rgba(200,205,210,0.9)';
      g.fillText(port.name, p.x + 6, p.y + 3);
    }

    // treasure charts
    for (const tr of game.encounters.treasures) {
      const p = this._toMap(tr.x, tr.y);
      g.strokeStyle = '#f0a83c';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(p.x - 4, p.y - 4);
      g.lineTo(p.x + 4, p.y + 4);
      g.moveTo(p.x + 4, p.y - 4);
      g.lineTo(p.x - 4, p.y + 4);
      g.stroke();
    }

    // quest objectives
    for (const q of game.quests.active) {
      if (q.x === undefined) continue;
      const p = this._toMap(q.x, q.y);
      g.fillStyle = '#6fce62';
      g.beginPath();
      g.arc(p.x, p.y, 5, 0, Math.PI * 2);
      g.stroke();
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
      g.strokeStyle = '#6fce62';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(p.x, p.y, 8 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2);
      g.stroke();
    }

    // custom markers
    for (const m of game.mapData.markers) {
      const p = this._toMap(m.x, m.y);
      g.fillStyle = '#c9506a';
      g.fillRect(p.x - 1, p.y - 8, 2, 8);
      g.beginPath();
      g.moveTo(p.x + 1, p.y - 8);
      g.lineTo(p.x + 8, p.y - 5.5);
      g.lineTo(p.x + 1, p.y - 3);
      g.fill();
    }

    // the player's ship
    {
      const p = this._toMap(game.ship.x, game.ship.y);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(game.ship.heading);
      g.fillStyle = '#e0b345';
      g.beginPath();
      g.moveTo(6, 0);
      g.lineTo(-4, -4);
      g.lineTo(-4, 4);
      g.fill();
      g.restore();
      g.strokeStyle = 'rgba(224,179,69,0.5)';
      g.beginPath();
      g.arc(p.x, p.y, 10 + Math.sin(performance.now() / 400) * 2, 0, Math.PI * 2);
      g.stroke();
    }

    // frame
    g.strokeStyle = 'rgba(224,179,69,0.25)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  }
}
