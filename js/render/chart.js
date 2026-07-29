// The hand-drawn treasure chart.
//
// The world map (ui/mapUI.js) is the accurate one. This is the opposite:
// a scrap of parchment somebody sketched from memory, with wobbling
// coastlines, a dashed trail, legs already walked crossed off, and an X
// where the last clue points. It is deliberately imprecise — the chart
// tells you the story, the sea chart tells you the coordinates.

import { makeCanvas } from './sprites.js';
import { mulberry32 } from '../util/random.js';
import { CLANS } from '../world/clans.js';

const CLAN_NAMES = Object.fromEntries(Object.entries(CLANS).map(([id, c]) => [id, c.short]));

const W = 300;
const H = 210;

export function drawTreasureChart(hunt, game) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const rng = mulberry32((hunt.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) * 7919) >>> 0);

  // ---- parchment ----------------------------------------------------
  g.fillStyle = '#d8c49a';
  g.fillRect(0, 0, W, H);
  // fibres and age stains
  for (let i = 0; i < 900; i++) {
    const x = rng() * W;
    const y = rng() * H;
    g.fillStyle = rng() < 0.5 ? 'rgba(120,96,58,0.10)' : 'rgba(255,246,220,0.10)';
    g.fillRect(x | 0, y | 0, 1, 1);
  }
  for (let i = 0; i < 7; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 10 + rng() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(126,92,44,0.16)');
    grd.addColorStop(1, 'rgba(126,92,44,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // burnt, curling edges
  g.strokeStyle = 'rgba(90,62,28,0.55)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, W - 3, H - 3);
  g.fillStyle = 'rgba(70,48,22,0.30)';
  for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 2, 1 + rng() * 3);
  for (let x = 0; x < W; x += 4) g.fillRect(x, H - (1 + rng() * 3), 2, 3);
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, 1 + rng() * 3, 2);
  for (let y = 0; y < H; y += 4) g.fillRect(W - (1 + rng() * 3), y, 3, 2);

  const ink = '#4a3016';
  const inkFaint = 'rgba(74,48,22,0.45)';

  // ---- sketched coastlines -------------------------------------------
  // Three or four islands drawn as wobbling closed loops. They are not
  // the real islands; they are what the mapmaker remembered.
  g.strokeStyle = ink;
  g.lineWidth = 1.4;
  const isles = 3 + ((rng() * 2) | 0);
  for (let i = 0; i < isles; i++) {
    const cx = 30 + rng() * (W - 60);
    const cy = 26 + rng() * (H - 78);
    const r = 14 + rng() * 22;
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.22) {
      const wob = r * (0.72 + Math.sin(a * 3 + i) * 0.14 + rng() * 0.12);
      const px = cx + Math.cos(a) * wob;
      const py = cy + Math.sin(a) * wob * 0.72;
      if (a === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.stroke();
    // hatched shoreline
    g.strokeStyle = inkFaint;
    g.lineWidth = 0.8;
    g.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const wob = r * 0.78;
      g.moveTo(cx + Math.cos(a) * wob, cy + Math.sin(a) * wob * 0.72);
      g.lineTo(cx + Math.cos(a) * (wob + 4), cy + Math.sin(a) * (wob + 4) * 0.72);
    }
    g.stroke();
    g.strokeStyle = ink;
    g.lineWidth = 1.4;
  }

  // a compass rose in a corner
  const crx = W - 38;
  const cry = 36;
  g.strokeStyle = inkFaint;
  g.lineWidth = 1;
  g.beginPath();
  g.arc(crx, cry, 15, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(crx, cry - 16);
  g.lineTo(crx - 4, cry);
  g.lineTo(crx + 4, cry);
  g.closePath();
  g.fill();
  g.font = 'bold 9px "Courier New", monospace';
  g.fillText('N', crx - 3, cry - 18);

  // ---- the trail ------------------------------------------------------
  // Legs are laid out along the chart rather than to scale — the shape of
  // the journey, not its geometry.
  const n = hunt.stages.length;
  const pts = hunt.stages.map((_, i) => ({
    x: 40 + (i / Math.max(1, n - 1)) * (W - 96),
    y: 60 + Math.sin(i * 1.9 + rng()) * 34 + rng() * 12,
  }));

  g.strokeStyle = ink;
  g.lineWidth = 1.6;
  g.setLineDash([5, 4]);
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.stroke();
  g.setLineDash([]);

  pts.forEach((p, i) => {
    const done = i < hunt.stage;
    const current = i === hunt.stage;
    const last = i === n - 1;
    if (last) {
      // X marks the spot, drawn heavier than anything else on the page
      g.strokeStyle = current || done ? '#8a2020' : inkFaint;
      g.lineWidth = current ? 3.4 : 2.4;
      g.beginPath();
      g.moveTo(p.x - 8, p.y - 8);
      g.lineTo(p.x + 8, p.y + 8);
      g.moveTo(p.x + 8, p.y - 8);
      g.lineTo(p.x - 8, p.y + 8);
      g.stroke();
    } else {
      g.fillStyle = done ? inkFaint : ink;
      g.beginPath();
      g.arc(p.x, p.y, current ? 5 : 3.5, 0, Math.PI * 2);
      g.fill();
      if (done) {
        // struck through: this leg is behind you
        g.strokeStyle = '#8a2020';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(p.x - 6, p.y + 6);
        g.lineTo(p.x + 6, p.y - 6);
        g.stroke();
      }
    }
    if (current) {
      g.strokeStyle = '#8a2020';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(p.x, p.y, 12, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = ink;
    g.font = '9px "Courier New", monospace';
    g.fillText(`${i + 1}`, p.x - 2, p.y - 11);
  });

  // ---- marginalia -----------------------------------------------------
  // Whose water the current leg sits in, scrawled in the margin — the
  // one piece of hard intelligence on an otherwise unreliable document.
  const st = hunt.stages[hunt.stage];
  const owner = game?.clans?.ownerOfRegion(st.x, st.y);
  if (owner) {
    const clan = CLAN_NAMES[owner] ?? owner;
    g.fillStyle = ink;
    g.font = 'italic 10px "Courier New", monospace';
    g.fillText(`${clan} water`, 14, H - 26);
  }
  g.font = '9px "Courier New", monospace';
  g.fillStyle = inkFaint;
  g.fillText('drawn from memory, and memory drinks', 14, H - 12);

  return c;
}
