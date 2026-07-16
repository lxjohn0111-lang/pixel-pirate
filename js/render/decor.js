// Island decoration drawing: palms, trees, rocks, shrubs, ruins, caves.
// Drawn every frame (not baked into the island canvas) so foliage can
// sway with the wind. Each function draws at the decor's world position;
// the context is already in world space.

export function drawDecor(g, d, t, windX, windY) {
  const sway = Math.sin(t * 1.4 + d.phase) * (0.6 + Math.hypot(windX, windY) / 90);
  switch (d.type) {
    case 'palm': return drawPalm(g, d, sway);
    case 'tree': return drawTree(g, d, sway);
    case 'rock': return drawRock(g, d);
    case 'shrub': return drawShrub(g, d, sway);
    case 'ruin': return drawRuin(g, d);
    case 'cave': return drawCave(g, d);
  }
}

function shadow(g, x, y, w) {
  g.fillStyle = 'rgba(20,26,20,0.25)';
  g.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
}

function drawPalm(g, d, sway) {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const h = Math.round(11 * d.size);
  const lean = d.variant - 1; // -1, 0, 1
  shadow(g, x + 2, y, 8);
  // curved trunk
  g.fillStyle = '#8a5a33';
  for (let i = 0; i < h; i++) {
    const bend = Math.round((i / h) * (i / h) * 3 * lean + (i / h) * sway);
    g.fillRect(x + bend, y - i, 2, 1);
  }
  const topX = x + Math.round(3 * lean + sway);
  const topY = y - h;
  // fronds
  const greens = ['#3f8a3f', '#4f9e4f', '#357a38'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4 + sway * 0.08;
    const len = 6 * d.size;
    g.strokeStyle = greens[(i + d.variant) % 3];
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(topX + 1, topY);
    g.quadraticCurveTo(
      topX + 1 + Math.cos(a) * len * 0.7,
      topY + Math.sin(a) * len * 0.35 - 2,
      topX + 1 + Math.cos(a) * len,
      topY + Math.sin(a) * len * 0.5 + 1,
    );
    g.stroke();
  }
  // coconuts
  if (d.variant === 2) {
    g.fillStyle = '#5a3a20';
    g.fillRect(topX, topY + 1, 1, 1);
    g.fillRect(topX + 2, topY + 2, 1, 1);
  }
}

function drawTree(g, d, sway) {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const s = d.size;
  shadow(g, x + 1, y, Math.round(9 * s));
  g.fillStyle = '#5a3a20';
  g.fillRect(x, y - Math.round(5 * s), 2, Math.round(5 * s));
  const cx = x + 1 + Math.round(sway);
  const cy = y - Math.round(7 * s);
  const r = Math.round(5 * s);
  g.fillStyle = ['#2f6e38', '#357a38', '#2a6432'][d.variant];
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.arc(cx - r * 0.7, cy + 2, r * 0.7, 0, Math.PI * 2);
  g.arc(cx + r * 0.7, cy + 1, r * 0.75, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(cx - 1, cy - r + 1, 3, 1);
  g.fillRect(cx + 2, cy - r + 3, 2, 1);
}

function drawRock(g, d) {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const s = d.size;
  const w = Math.round(6 * s);
  const h = Math.round(4 * s);
  shadow(g, x, y + 1, w + 2);
  g.fillStyle = '#5d6165';
  g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = '#7e8388';
  g.fillRect(x - w / 2, y - h, w, Math.max(1, h - 2));
  g.fillStyle = '#9aa0a6';
  g.fillRect(x - w / 2 + 1, y - h, Math.max(1, w - 3), 1);
}

function drawShrub(g, d, sway) {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  g.fillStyle = ['#4f9e4f', '#5dae5a', '#458a45'][d.variant];
  g.fillRect(x - 2 + Math.round(sway * 0.5), y - 3, 5, 3);
  g.fillRect(x - 1 + Math.round(sway * 0.5), y - 4, 3, 1);
  if (d.variant === 1) {
    g.fillStyle = '#c9506a'; // berries
    g.fillRect(x, y - 3, 1, 1);
    g.fillRect(x - 2, y - 2, 1, 1);
  }
}

function drawRuin(g, d) {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const h = Math.round((6 + d.variant * 2) * d.size);
  shadow(g, x + 1, y, 6);
  g.fillStyle = '#9aa0a0';
  g.fillRect(x - 1, y - h, 3, h);
  g.fillStyle = '#b8bebc';
  g.fillRect(x - 1, y - h, 1, h);
  g.fillStyle = '#787e7c'; // cracks + broken top
  g.fillRect(x, y - h, 2, 1);
  g.fillRect(x + 1, y - Math.round(h * 0.6), 1, 1);
  g.fillStyle = '#6b8a4a'; // moss
  g.fillRect(x - 1, y - 2, 1, 2);
}

function drawCave(g, d) {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  // rocky surround
  g.fillStyle = '#4a4e54';
  g.fillRect(x - 6, y - 7, 12, 7);
  g.fillStyle = '#5d6165';
  g.fillRect(x - 6, y - 7, 12, 2);
  // dark mouth — a mystery for a future update
  g.fillStyle = '#14161c';
  g.fillRect(x - 3, y - 5, 6, 5);
  g.fillRect(x - 2, y - 6, 4, 1);
}
