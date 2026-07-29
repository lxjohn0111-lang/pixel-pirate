// Sail patterns and deck decorations.
//
// Both are painted straight onto the ship each frame (patterns into the
// cached sail canvas, decor into the rotated hull space), so they follow
// the hull, the paint job and the sail tint without needing their own
// sprite variants.

/**
 * Print a pattern over a sail. Called with source-atop already set, so
 * everything drawn here is clipped to the canvas of the sail itself.
 */
export function drawSailPattern(g, w, h, pat) {
  const ink = pat.mark ?? 'rgba(30,26,40,0.42)';
  g.fillStyle = ink;
  switch (pat.pattern) {
    case 'stripes':
      for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 3);
      break;
    case 'chevron':
      for (let y = -h; y < h * 2; y += 8) {
        for (let x = 0; x < w; x += 2) {
          const off = Math.abs(((x / 6) % 4) - 2) * 2;
          g.fillRect(x, y + off, 2, 3);
        }
      }
      break;
    case 'cross':
      g.fillRect(0, Math.round(h / 2) - 2, w, 4);
      g.fillRect(Math.round(w / 2) - 2, 0, 4, h);
      break;
    case 'scales':
      for (let y = 0; y < h; y += 5) {
        for (let x = (y / 5) % 2 ? 3 : 0; x < w; x += 6) {
          g.fillRect(x, y, 4, 1);
          g.fillRect(x - 1, y + 1, 1, 2);
          g.fillRect(x + 4, y + 1, 1, 2);
        }
      }
      break;
    case 'clan':
      // The clan mark, blown up big enough to read from the next ship.
      if (pat.clanColor) {
        g.fillStyle = pat.clanColor;
        const cx = Math.round(w / 2);
        const cy = Math.round(h / 2);
        g.fillRect(cx - 7, cy - 7, 14, 14);
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.fillRect(cx - 3, cy - 3, 6, 6);
      }
      break;
    default:
      break;
  }
}

/**
 * Deck fittings, drawn in the hull's rotated space so they ride with the
 * ship. `t` drives the small animated ones (swinging lanterns).
 */
export function drawDeckDecor(g, id, t = 0) {
  if (!id || id === 'none') return;
  switch (id) {
    case 'barrels':
      g.fillStyle = '#8a5a34';
      g.fillRect(-14, -5, 5, 5);
      g.fillRect(-14, 1, 5, 5);
      g.fillStyle = '#5e3a22';
      g.fillRect(-14, -3, 5, 1);
      g.fillRect(-14, 3, 5, 1);
      break;
    case 'netting':
      g.fillStyle = 'rgba(220,210,190,0.55)';
      for (let x = -16; x < 16; x += 4) g.fillRect(x, -8, 1, 16);
      for (let y = -8; y <= 8; y += 4) g.fillRect(-16, y, 32, 1);
      break;
    case 'lanterns': {
      // Three lamps swinging a little out of phase with each other.
      for (let i = 0; i < 3; i++) {
        const lx = -10 + i * 10;
        const sway = Math.sin(t * 2.2 + i * 1.7) * 1.2;
        g.fillStyle = '#3a2a18';
        g.fillRect(lx, -9, 1, 3);
        g.fillStyle = '#ffd27a';
        g.fillRect(lx - 1 + Math.round(sway), -6, 3, 3);
        g.fillStyle = 'rgba(255,200,110,0.22)';
        g.fillRect(lx - 3 + Math.round(sway), -8, 7, 7);
      }
      break;
    }
    case 'skulls':
      g.fillStyle = '#e8e4da';
      for (let x = -12; x <= 12; x += 8) {
        g.fillRect(x, -9, 4, 3);
        g.fillRect(x + 1, -6, 2, 1);
        g.fillStyle = '#1a1420';
        g.fillRect(x, -9, 1, 1);
        g.fillRect(x + 3, -9, 1, 1);
        g.fillStyle = '#e8e4da';
      }
      break;
    case 'garland':
      g.fillStyle = '#2e6e4e';
      for (let x = -15; x < 15; x += 3) {
        const y = Math.round(Math.sin(x * 0.5 + t) * 1) - 8;
        g.fillRect(x, y, 2, 2);
      }
      g.fillStyle = '#4ec9b0';
      for (let x = -13; x < 15; x += 6) g.fillRect(x, -7, 1, 2);
      break;
    default:
      break;
  }
}
