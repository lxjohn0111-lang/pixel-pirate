// Lightweight particle + floating-text system. Two layers: 'below'
// renders under the ship (wake foam), 'above' renders over everything
// (spray, sparkles, splash rings).

import { TAU } from '../util/math.js';

const MAX_PARTICLES = 600;

export class Particles {
  constructor() {
    this.below = [];
    this.above = [];
    this.texts = [];
    this.quality = 1; // multiplier from settings
  }

  _push(layer, p) {
    const list = this[layer];
    if (list.length >= MAX_PARTICLES * this.quality) list.shift();
    p.age = 0;
    list.push(p);
  }

  /* ---- spawners ---------------------------------------------------- */

  spawnWake(x, y, velX, velY) {
    const n = Math.round(2 * this.quality) || 1;
    for (let i = 0; i < n; i++) {
      const side = (Math.random() - 0.5) * 14;
      const px = -velY / (Math.hypot(velX, velY) || 1);
      const py = velX / (Math.hypot(velX, velY) || 1);
      this._push('below', {
        kind: 'dot',
        x: x + px * side,
        y: y + py * side,
        vx: -velX * 0.06 + px * side * 0.6,
        vy: -velY * 0.06 + py * side * 0.6,
        life: 1.1 + Math.random() * 0.9,
        size: 1.5 + Math.random(),
        growth: 2.2,
        color: '230,242,250',
        alpha: 0.5,
        drag: 1.4,
      });
    }
  }

  spawnBowSpray(x, y, fx, fy) {
    const n = Math.round(3 * this.quality) || 1;
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(fy, fx) + (Math.random() - 0.5) * 1.4;
      const s = 26 + Math.random() * 30;
      this._push('above', {
        kind: 'dot',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.3,
        size: 1,
        growth: 0,
        color: '240,250,255',
        alpha: 0.85,
        drag: 2.5,
      });
    }
  }

  burstSplash(x, y, count) {
    for (let i = 0; i < count * this.quality; i++) {
      const a = Math.random() * TAU;
      const s = 15 + Math.random() * 45;
      this._push('above', {
        kind: 'dot',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5,
        size: 1 + Math.random(),
        growth: 0,
        color: '235,245,252',
        alpha: 0.9,
        drag: 3,
      });
    }
    this._push('above', {
      kind: 'ring', x, y, vx: 0, vy: 0,
      life: 0.7, size: 4, growth: 30, color: '235,245,252', alpha: 0.6, drag: 0,
    });
  }

  burstCollect(x, y, color = '240,205,90', count = 10) {
    for (let i = 0; i < count * this.quality; i++) {
      const a = Math.random() * TAU;
      const s = 18 + Math.random() * 40;
      this._push('above', {
        kind: 'spark',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 18,
        life: 0.5 + Math.random() * 0.45,
        size: 1 + (Math.random() < 0.3 ? 1 : 0),
        growth: 0,
        color,
        alpha: 1,
        drag: 2.2,
      });
    }
    this._push('above', {
      kind: 'ring', x, y, vx: 0, vy: 0,
      life: 0.5, size: 3, growth: 36, color, alpha: 0.8, drag: 0,
    });
  }

  splashRing(x, y, size = 2) {
    this._push('above', {
      kind: 'ring', x, y, vx: 0, vy: 0,
      life: 0.6, size, growth: 14, color: '225,240,250', alpha: 0.4, drag: 0,
    });
  }

  spawnText(x, y, text, color = '#f2d98a') {
    this.texts.push({ x, y, text, color, age: 0, life: 1.3 });
  }

  /* ---- simulation --------------------------------------------------- */

  update(dt) {
    for (const list of [this.below, this.above]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) {
          list.splice(i, 1);
          continue;
        }
        const drag = Math.exp(-(p.drag || 0) * dt);
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += (p.growth || 0) * dt;
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.age += dt;
      t.y -= 16 * dt;
      if (t.age >= t.life) this.texts.splice(i, 1);
    }
  }

  drawLayer(g, layer) {
    for (const p of this[layer]) {
      const k = 1 - p.age / p.life;
      const alpha = p.alpha * k;
      if (p.kind === 'ring') {
        g.strokeStyle = `rgba(${p.color},${alpha})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, TAU);
        g.stroke();
      } else if (p.kind === 'spark') {
        g.fillStyle = `rgba(${p.color},${alpha})`;
        const s = p.size;
        g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        g.fillRect(p.x - s / 2 - 1, p.y - 0.5, s + 2, 1);
        g.fillRect(p.x - 0.5, p.y - s / 2 - 1, 1, s + 2);
      } else {
        g.fillStyle = `rgba(${p.color},${alpha})`;
        const s = Math.max(1, p.size);
        g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
  }

  drawTexts(g) {
    g.font = 'bold 8px monospace';
    g.textAlign = 'center';
    for (const t of this.texts) {
      const k = 1 - t.age / t.life;
      g.globalAlpha = Math.min(1, k * 2);
      g.fillStyle = '#1e1a22';
      g.fillText(t.text, Math.round(t.x) + 1, Math.round(t.y) + 1);
      g.fillStyle = t.color;
      g.fillText(t.text, Math.round(t.x), Math.round(t.y));
    }
    g.globalAlpha = 1;
    g.textAlign = 'left';
  }
}
