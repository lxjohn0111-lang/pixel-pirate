// The ocean. A continuous, global animated field — no chunk seams are
// possible because everything derives from world coordinates:
//   base color from the day/night cycle, drifting detail layers
//   (currents), animated wave crests, cloud shadows, and sun/moon glints.

import { rand2 } from '../util/random.js';
import { Noise2D } from '../util/noise.js';
import { rgb, TAU } from '../util/math.js';
import { makeCanvas } from './sprites.js';

const TILE = 192;

export class Water {
  constructor() {
    this.noise = new Noise2D(777001);
    this.depthTile = this._makeDepthTile();
    this.streakTile = this._makeStreakTile();
    this.quality = 1;
  }

  /** Soft darker blobs — reads as depth variation / swell. */
  _makeDepthTile() {
    const c = makeCanvas(TILE, TILE);
    const g = c.getContext('2d');
    const n = new Noise2D(9134);
    const img = g.createImageData(TILE, TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        // Tileable-ish: sample noise on a torus.
        const a = (x / TILE) * TAU;
        const b = (y / TILE) * TAU;
        const v = n.fbm(Math.cos(a) * 2.2 + 9, Math.sin(a) * 2.2 + Math.cos(b) * 2.2, 3)
          + n.value(Math.sin(b) * 2.2 + 4, Math.cos(b) * 2.2 + Math.sin(a));
        const k = v / 2;
        const i = (y * TILE + x) * 4;
        // Soft-edged, subtle swell shading — must whisper, not shout.
        const dark = Math.max(0, Math.min(1, (0.46 - k) * 8)) * 16;
        img.data[i] = 6;
        img.data[i + 1] = 14;
        img.data[i + 2] = 30;
        img.data[i + 3] = dark;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /** Sparse light streaks — reads as surface current lines. */
  _makeStreakTile() {
    const c = makeCanvas(TILE, TILE);
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x = rand2(55, i, 0) * TILE;
      const y = rand2(55, i, 1) * TILE;
      const len = 6 + rand2(55, i, 2) * 18;
      const ang = rand2(55, i, 3) * 0.8 - 0.4;
      g.globalAlpha = 0.25 + rand2(55, i, 4) * 0.3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.stroke();
    }
    g.globalAlpha = 1;
    return c;
  }

  _tileLayer(g, tile, viewX, viewY, viewW, viewH, driftX, driftY, alpha) {
    g.globalAlpha = alpha;
    const ox = ((viewX + driftX) % TILE + TILE) % TILE;
    const oy = ((viewY + driftY) % TILE + TILE) % TILE;
    for (let y = -oy; y < viewH; y += TILE) {
      for (let x = -ox; x < viewW; x += TILE) {
        g.drawImage(tile, Math.round(viewX + x), Math.round(viewY + y));
      }
    }
    g.globalAlpha = 1;
  }

  /**
   * Draw the ocean. g is already translated to world space; the visible
   * world rect is (viewX, viewY, viewW, viewH).
   */
  draw(g, viewX, viewY, viewW, viewH, t, dayNight, weather) {
    const s = dayNight.snapshot;

    // --- base gradient-ish fill: deep color darkened by cloud cover ----
    const cloudDim = 1 - weather.cloud * 0.22;
    g.fillStyle = rgb([s.deep[0] * cloudDim, s.deep[1] * cloudDim, s.deep[2] * cloudDim]);
    g.fillRect(viewX, viewY, viewW, viewH);

    // --- drifting depth + current layers (parallax = alive) -------------
    this._tileLayer(g, this.depthTile, viewX, viewY, viewW, viewH, t * 4, t * 2.6, 0.9);
    this._tileLayer(g, this.depthTile, viewX, viewY, viewW, viewH, -t * 2.2 + 77, t * 3.4, 0.45);
    const windDrift = 1 + weather.windSpeed / 40;
    this._tileLayer(
      g, this.streakTile, viewX, viewY, viewW, viewH,
      t * 6 * windDrift, t * 1.8 * windDrift, 0.12 + weather.windSpeed / 700,
    );

    // --- animated wave crests -------------------------------------------
    const hi = rgb(s.hi);
    const cell = 44;
    const density = 0.32 + weather.windSpeed / 260;
    const gx0 = Math.floor(viewX / cell);
    const gy0 = Math.floor(viewY / cell);
    const gx1 = Math.ceil((viewX + viewW) / cell);
    const gy1 = Math.ceil((viewY + viewH) / cell);
    g.fillStyle = hi;
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const h = rand2(31337, gx, gy);
        if (h > density) continue;
        const phase = t * (1.1 + h) + h * 40;
        const wave = Math.sin(phase);
        if (wave <= 0.1) continue;
        const x = gx * cell + rand2(4551, gx, gy) * (cell - 14);
        const y = gy * cell + rand2(8721, gx, gy) * (cell - 6);
        const w = Math.round(3 + wave * 6);
        g.globalAlpha = wave * 0.5;
        // Small crest: three offset dashes form a curl.
        g.fillRect(Math.round(x), Math.round(y), w, 1);
        g.fillRect(Math.round(x + w * 0.3), Math.round(y - 1), Math.round(w * 0.55), 1);
        if (wave > 0.75 && weather.windSpeed > 40) {
          g.fillRect(Math.round(x + w * 0.15), Math.round(y - 2), Math.round(w * 0.3), 1);
        }
      }
    }
    g.globalAlpha = 1;

    // --- sun / moon glints ------------------------------------------------
    const glintStrength = Math.max(s.sun * (1 - weather.cloud * 0.8), s.moon * 0.55 * (1 - weather.cloud));
    if (glintStrength > 0.03) {
      const gc = s.glint;
      const gcell = 26;
      const hx0 = Math.floor(viewX / gcell);
      const hy0 = Math.floor(viewY / gcell);
      const hx1 = Math.ceil((viewX + viewW) / gcell);
      const hy1 = Math.ceil((viewY + viewH) / gcell);
      for (let gy = hy0; gy <= hy1; gy++) {
        for (let gx = hx0; gx <= hx1; gx++) {
          const h = rand2(90210, gx, gy);
          if (h > 0.09 * this.quality) continue;
          const tw = Math.sin(t * (2 + h * 20) + h * 90);
          if (tw < 0.55) continue;
          const a = (tw - 0.55) * 2.2 * glintStrength;
          const x = Math.round(gx * gcell + rand2(1213, gx, gy) * gcell);
          const y = Math.round(gy * gcell + rand2(3141, gx, gy) * gcell);
          g.fillStyle = `rgba(${gc[0] | 0},${gc[1] | 0},${gc[2] | 0},${a})`;
          g.fillRect(x, y, 2, 1);
          if (tw > 0.9) g.fillRect(x, y - 1, 1, 3);
        }
      }
    }
  }

  /** Cloud shadows, drawn over everything below the weather layer. */
  drawCloudShadows(g, viewX, viewY, viewW, viewH, t, weather) {
    if (weather.cloud < 0.12) return;
    const alpha = weather.cloud * 0.16;
    g.fillStyle = `rgba(10,16,34,${alpha})`;
    const drift = t * (6 + weather.windSpeed * 0.35);
    const cell = 260;
    const gx0 = Math.floor((viewX + drift) / cell) - 1;
    const gy0 = Math.floor(viewY / cell) - 1;
    for (let gy = gy0; gy <= gy0 + Math.ceil(viewH / cell) + 2; gy++) {
      for (let gx = gx0; gx <= gx0 + Math.ceil(viewW / cell) + 2; gx++) {
        const h = rand2(60606, gx, gy);
        if (h > 0.4 + weather.cloud * 0.45) continue;
        const x = gx * cell - drift + rand2(701, gx, gy) * cell;
        const y = gy * cell + rand2(702, gx, gy) * cell;
        const rx = 70 + rand2(703, gx, gy) * 110;
        const ry = rx * 0.55;
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, TAU);
        g.fill();
      }
    }
  }
}
