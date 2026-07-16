// Frame composition. Renders the world to a low-resolution backbuffer
// (crisp pixel-art), then blits it to the screen canvas scaled by
// PIXEL_SCALE * camera zoom. Overscan on the buffer lets the camera
// zoom out without exposing edges.
//
// Layer order (back to front):
//   water -> islands -> shore foam -> underwater life -> wake ->
//   y-sorted surface entities (collectibles, ship, decor, animals) ->
//   above-particles & texts -> gulls -> cloud shadows -> weather ->
//   lighting (day/night multiply + lantern glow)

import { PIXEL_SCALE, OVERSCAN } from '../core/constants.js';
import { Water } from './water.js';
import { drawDecor } from './decor.js';
import { seaRockSprite } from './sprites.js';
import { rgb } from '../util/math.js';

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.screen = canvas.getContext('2d');
    this.buffer = document.createElement('canvas');
    this.g = this.buffer.getContext('2d');
    this.water = new Water();
    this._drawables = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.buffer.width = Math.ceil((this.canvas.width / PIXEL_SCALE) * OVERSCAN);
    this.buffer.height = Math.ceil((this.canvas.height / PIXEL_SCALE) * OVERSCAN);
    this.screen.imageSmoothingEnabled = false;
    this.g.imageSmoothingEnabled = false;
  }

  /** The world-space rect currently covered by the backbuffer. */
  viewRect() {
    const cam = this.game.camera;
    return {
      x: cam.x - this.buffer.width / 2 + cam.shakeX,
      y: cam.y - this.buffer.height / 2 + cam.shakeY,
      w: this.buffer.width,
      h: this.buffer.height,
    };
  }

  render(t) {
    const { game, g } = this;
    const { world, ship, dayNight, weather, wildlife, collectibles, particles } = game;
    const view = this.viewRect();
    this.water.quality = particles.quality;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.save();
    g.translate(-Math.round(view.x), -Math.round(view.y));

    // 1. Ocean
    this.water.draw(g, view.x, view.y, view.w, view.h, t, dayNight, weather);

    // 2. Islands (cached terrain) + sea rocks + foam
    world.forEachChunkIn(view.x, view.y, view.w, view.h, (chunk) => {
      if (chunk.island) {
        g.drawImage(chunk.island.canvas, Math.round(chunk.island.ox), Math.round(chunk.island.oy));
      }
      for (const r of chunk.rocks) {
        const spr = seaRockSprite(r.variant);
        // foam lapping at the rock
        const lap = Math.sin(t * 1.6 + r.x) * 0.5 + 0.5;
        g.fillStyle = `rgba(230,242,250,${0.25 + lap * 0.25})`;
        g.fillRect(Math.round(r.x - r.r), Math.round(r.y + 2), Math.round(r.r * 2), 1);
        g.drawImage(spr, Math.round(r.x - spr.width / 2), Math.round(r.y - spr.height + 4));
      }
    });
    this._drawFoam(g, view, t);

    // 3. Underwater ambience: seaweed + submerged animals
    world.forEachChunkIn(view.x, view.y, view.w, view.h, (chunk) => {
      for (const s of chunk.seaweed) this._drawSeaweed(g, s, t);
    });
    wildlife.drawUnderwater(g, t);

    // 4. Wake foam (below the hull)
    particles.drawLayer(g, 'below');

    // 5. Y-sorted surface layer: the "slight angle" painter's algorithm.
    const drawables = this._drawables;
    drawables.length = 0;
    drawables.push({ y: ship.y, draw: (gg) => ship.draw(gg, t, dayNight) });
    world.forEachChunkIn(view.x, view.y, view.w, view.h, (chunk) => {
      if (!chunk.island) return;
      for (const d of chunk.island.decor) {
        drawables.push({ y: d.y, draw: (gg) => drawDecor(gg, d, t, weather.windX, weather.windY) });
      }
    });
    wildlife.collectSurfaceDrawables(drawables, t);
    drawables.sort((a, b) => a.y - b.y);
    collectibles.draw(g, view.x, view.y, view.w, view.h, t);
    for (const d of drawables) d.draw(g);

    // 6. Foreground particles, floating text, birds
    particles.drawLayer(g, 'above');
    particles.drawTexts(g);
    wildlife.drawAir(g, t);

    // 7. Weather
    this.water.drawCloudShadows(g, view.x, view.y, view.w, view.h, t, weather);
    if (weather.rain > 0.02) this._drawRain(g, view, weather);
    if (weather.fog > 0.02) this._drawFog(g, view, t, weather);

    g.restore();

    // 8. Lighting: ambient multiply + additive glows (screen space).
    this._drawLighting(view, t);

    // 9. Lightning flash
    if (weather.lightning > 0.01) {
      g.fillStyle = `rgba(235,240,255,${weather.lightning * 0.55})`;
      g.fillRect(0, 0, this.buffer.width, this.buffer.height);
    }

    // Blit backbuffer -> screen with camera zoom.
    const cam = this.game.camera;
    const scale = PIXEL_SCALE * cam.zoom;
    const dw = this.buffer.width * scale;
    const dh = this.buffer.height * scale;
    this.screen.imageSmoothingEnabled = false;
    this.screen.fillStyle = '#04101e';
    this.screen.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.screen.drawImage(
      this.buffer,
      Math.round((this.canvas.width - dw) / 2),
      Math.round((this.canvas.height - dh) / 2),
      Math.round(dw),
      Math.round(dh),
    );
  }

  _drawFoam(g, view, t) {
    const { world } = this.game;
    world.forEachChunkIn(view.x - 200, view.y - 200, view.w + 400, view.h + 400, (chunk) => {
      const isl = chunk.island;
      if (!isl) return;
      for (let i = 0; i < isl.shore.length; i++) {
        const p = isl.shore[i];
        const phase = t * 1.5 + i * 0.7;
        const s = Math.sin(phase);
        if (s <= 0) continue;
        const off = 1 + (1 - s) * 3; // foam rolls out from the shore
        g.fillStyle = `rgba(235,246,252,${s * 0.55})`;
        g.fillRect(Math.round(p.x + p.nx * off), Math.round(p.y + p.ny * off), 2, 1);
        if (s > 0.75) {
          g.fillRect(Math.round(p.x + p.nx * (off + 3)), Math.round(p.y + p.ny * (off + 3)), 1, 1);
        }
      }
    });
  }

  _drawSeaweed(g, s, t) {
    g.strokeStyle = 'rgba(24,78,64,0.5)';
    g.lineWidth = 1;
    for (let b = 0; b < s.blades; b++) {
      const bx = s.x + b * 3 - s.blades * 1.5;
      const swayX = Math.sin(t * 1.1 + s.phase + b) * 2;
      g.beginPath();
      g.moveTo(bx, s.y);
      g.quadraticCurveTo(bx + swayX, s.y - 4, bx + swayX * 1.5, s.y - 7 - (b % 3));
      g.stroke();
    }
  }

  _drawRain(g, view, weather) {
    const n = Math.round(weather.rain * 130 * this.game.particles.quality);
    const slantX = weather.windX * 0.06;
    g.strokeStyle = 'rgba(200,225,245,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = view.x + Math.random() * view.w;
      const y = view.y + Math.random() * view.h;
      g.moveTo(x, y);
      g.lineTo(x + slantX, y + 6 + weather.rain * 4);
    }
    g.stroke();
    // splash rings on the water surface
    g.strokeStyle = 'rgba(220,238,250,0.22)';
    const rings = Math.round(weather.rain * 14 * this.game.particles.quality);
    for (let i = 0; i < rings; i++) {
      const x = view.x + Math.random() * view.w;
      const y = view.y + Math.random() * view.h;
      const r = 1 + Math.random() * 2.5;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
    }
  }

  _drawFog(g, view, t, weather) {
    const alpha = weather.fog * 0.28;
    g.fillStyle = `rgba(196,206,214,${alpha})`;
    g.fillRect(view.x, view.y, view.w, view.h);
    // drifting fog banks
    g.fillStyle = `rgba(208,216,224,${weather.fog * 0.2})`;
    const cell = 200;
    const drift = t * 9;
    const gx0 = Math.floor((view.x + drift) / cell) - 1;
    const gy0 = Math.floor(view.y / cell) - 1;
    for (let gy = gy0; gy < gy0 + view.h / cell + 2; gy++) {
      for (let gx = gx0; gx < gx0 + view.w / cell + 2; gx++) {
        const h = ((gx * 733 + gy * 271) % 97) / 97;
        if (h > 0.55) continue;
        g.beginPath();
        g.ellipse(gx * cell - drift + h * 160, gy * cell + h * 90, 90 + h * 70, 34, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  _drawLighting(view, t) {
    const { dayNight, weather, ship } = this.game;
    const s = dayNight.snapshot;
    const g = this.g;

    // Ambient tint (multiply), dimmed further by heavy weather.
    const stormDim = 1 - weather.rain * 0.18 - weather.cloud * 0.08;
    const amb = [s.amb[0] * stormDim, s.amb[1] * stormDim, s.amb[2] * stormDim];
    if (amb[0] < 252 || amb[1] < 252 || amb[2] < 252) {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = rgb(amb);
      g.fillRect(0, 0, this.buffer.width, this.buffer.height);
      g.globalCompositeOperation = 'source-over';
    }

    // Golden-hour wash at sunrise and sunset (additive warm overlay).
    const tD = dayNight.t;
    const win = (c, w) => Math.max(0, 1 - Math.abs(tD - c) / w);
    const warm = Math.max(win(0.29, 0.055), win(0.755, 0.065)) * (1 - weather.cloud * 0.7);
    if (warm > 0.02) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(255,116,44,${0.1 * warm})`;
      g.fillRect(0, 0, this.buffer.width, this.buffer.height);
      g.globalCompositeOperation = 'source-over';
    }

    // Lantern glow around the ship at night (additive).
    if (s.sun < 0.35) {
      const sx = ship.x - view.x;
      const sy = ship.y - view.y;
      const flicker = 0.9 + Math.sin(t * 11) * 0.04 + Math.sin(t * 23) * 0.03;
      const r = 70 * flicker;
      const grad = g.createRadialGradient(sx, sy, 4, sx, sy, r);
      const str = (0.35 - s.sun) / 0.35;
      grad.addColorStop(0, `rgba(255,190,96,${0.34 * str})`);
      grad.addColorStop(0.5, `rgba(255,170,70,${0.12 * str})`);
      grad.addColorStop(1, 'rgba(255,160,60,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = grad;
      g.fillRect(sx - r, sy - r, r * 2, r * 2);

      // Cool moonlight sheen across the scene.
      if (s.moon > 0.05 && weather.cloud < 0.7) {
        g.fillStyle = `rgba(160,180,230,${0.05 * s.moon})`;
        g.fillRect(0, 0, this.buffer.width, this.buffer.height);
      }
      g.globalCompositeOperation = 'source-over';
    }
  }
}
