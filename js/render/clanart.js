// Clan heraldry, drawn the same way as everything else in this game:
// procedurally, into small offscreen canvases, cached by shape+colour.
//
// One emblem vocabulary serves three sizes — the icon over a ship at sea,
// the badge in the Clans tab, and the mark on a flag — so a clan reads as
// the same clan whether you are looking at a menu or at a sail on the
// horizon.

import { makeCanvas } from './sprites.js';

const _cache = new Map();

/**
 * Emblem glyph on a transparent canvas.
 * `shape` is one of blade / anchor / coin / eye / wave / gull / skull /
 * crown / star, and `size` is the canvas edge in pixels.
 */
export function clanEmblem(shape, color, size = 16, accent = '#ffffff') {
  const key = `${shape}:${color}:${size}:${accent}`;
  if (_cache.has(key)) return _cache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  // The glyphs are authored on a 16x16 grid and scaled up whole, which
  // keeps every emblem on the same pixel lattice at any size.
  const u = size / 16;
  const px = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x * u), Math.round(y * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)));
  };

  switch (shape) {
    case 'blade': // a cutlass on the diagonal
      px(3, 11, 10, 2, color);
      for (let i = 0; i < 8; i++) px(4 + i, 10 - i, 2, 2, color);
      px(11, 2, 3, 3, accent);
      px(2, 10, 3, 4, accent);
      break;
    case 'anchor':
      px(7, 2, 2, 11, color);
      px(4, 5, 8, 2, color);
      px(3, 9, 2, 4, color);
      px(11, 9, 2, 4, color);
      px(3, 12, 10, 2, color);
      px(6, 1, 4, 2, accent);
      break;
    case 'coin':
      px(4, 3, 8, 10, color);
      px(3, 5, 10, 6, color);
      px(6, 5, 4, 6, accent);
      px(7, 4, 2, 8, color);
      break;
    case 'eye':
      px(2, 7, 12, 2, color);
      px(4, 5, 8, 6, color);
      px(3, 6, 10, 4, color);
      px(6, 6, 4, 4, accent);
      px(7, 7, 2, 2, '#12101a');
      break;
    case 'wave':
      for (let i = 0; i < 3; i++) {
        const y = 4 + i * 4;
        px(1, y + 1, 3, 2, i === 1 ? accent : color);
        px(4, y, 3, 2, i === 1 ? accent : color);
        px(7, y + 1, 3, 2, i === 1 ? accent : color);
        px(10, y, 3, 2, i === 1 ? accent : color);
        px(13, y + 1, 2, 2, i === 1 ? accent : color);
      }
      break;
    case 'gull':
      px(1, 8, 3, 2, color);
      px(3, 6, 3, 2, color);
      px(5, 5, 3, 2, color);
      px(8, 5, 3, 2, color);
      px(10, 6, 3, 2, color);
      px(12, 8, 3, 2, color);
      px(7, 6, 2, 3, accent);
      break;
    case 'skull':
      px(4, 3, 8, 7, color);
      px(5, 10, 6, 2, color);
      px(5, 5, 2, 3, '#12101a');
      px(9, 5, 2, 3, '#12101a');
      px(7, 8, 2, 2, '#12101a');
      px(2, 12, 12, 2, accent);
      break;
    case 'crown':
      px(3, 9, 10, 4, color);
      px(3, 5, 2, 5, color);
      px(7, 4, 2, 6, color);
      px(11, 5, 2, 5, color);
      px(3, 3, 2, 2, accent);
      px(7, 2, 2, 2, accent);
      px(11, 3, 2, 2, accent);
      break;
    case 'star':
    default:
      px(7, 1, 2, 14, color);
      px(1, 7, 14, 2, color);
      for (let i = 0; i < 4; i++) {
        px(4 + i, 4 + i, 2, 2, color);
        px(10 - i, 4 + i, 2, 2, color);
      }
      px(6, 6, 4, 4, accent);
      break;
  }
  _cache.set(key, c);
  return c;
}

/**
 * A clan flag: a rippled pennant in the clan's colours carrying its
 * emblem. `frame` animates the ripple so flags at sea are never static.
 */
export function clanFlag(clan, frame = 0, w = 14, h = 9) {
  const key = `flag:${clan.color}:${clan.emblem}:${frame}:${w}x${h}`;
  if (_cache.has(key)) return _cache.get(key);
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  // Column-wise vertical offset gives the cloth its wave without needing
  // a separate sprite per frame.
  for (let x = 0; x < w; x++) {
    const wave = Math.round(Math.sin(x * 0.7 + frame * 1.6) * 1.2);
    const top = 1 + wave;
    g.fillStyle = clan.flagBody ?? clan.color;
    g.fillRect(x, Math.max(0, top), 1, h - 3);
    // a darker trailing edge reads as the far side of the cloth
    if (x > w - 4) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x, Math.max(0, top), 1, h - 3);
    }
  }
  // The emblem mark, simplified to a blob at flag scale.
  const mark = clan.flagMark ?? clan.accent ?? '#ffffff';
  const mw = Math.max(2, Math.round(w * 0.28));
  const mh = Math.max(2, Math.round((h - 3) * 0.5));
  const mx = Math.round(w * 0.3);
  const my = 1 + Math.round(Math.sin(mx * 0.7 + frame * 1.6) * 1.2) + Math.round((h - 3 - mh) / 2);
  g.fillStyle = mark;
  g.fillRect(mx, Math.max(0, my), mw, mh);
  _cache.set(key, c);
  return c;
}

/**
 * A hanging banner for port quays and menus: a vertical cloth with the
 * emblem, the shape you would actually nail to a harbour wall.
 */
export function clanBanner(clan, w = 22, h = 34) {
  const key = `banner:${clan.color}:${clan.emblem}:${w}x${h}`;
  if (_cache.has(key)) return _cache.get(key);
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  // pole
  g.fillStyle = '#5e3a22';
  g.fillRect(0, 0, w, 2);
  // cloth
  g.fillStyle = clan.color;
  g.fillRect(2, 2, w - 4, h - 8);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(w - 6, 2, 4, h - 8);
  // swallow tail
  for (let i = 0; i < 5; i++) {
    g.clearRect(2 + i, h - 8 + i, 1, 5);
    g.clearRect(w - 3 - i, h - 8 + i, 1, 5);
  }
  // emblem, centred on the cloth
  const em = clanEmblem(clan.emblem, clan.accent ?? '#ffffff', Math.min(w - 8, 16), clan.color);
  g.drawImage(em, Math.round((w - em.width) / 2), 5);
  _cache.set(key, c);
  return c;
}

/** Round badge for lists and profiles — emblem on a clan-coloured disc. */
export function clanBadge(clan, size = 40) {
  const key = `badge:${clan.color}:${clan.emblem}:${size}`;
  if (_cache.has(key)) return _cache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  g.fillStyle = '#12101a';
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = clan.color;
  g.beginPath();
  g.arc(r, r, r - 2, 0, Math.PI * 2);
  g.fill();
  // inner shade so the disc has some depth under the glyph
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.arc(r, r + size * 0.12, r - 2, 0, Math.PI * 2);
  g.fill();
  const em = clanEmblem(clan.emblem, clan.accent ?? '#ffffff', Math.round(size * 0.62), clan.color);
  g.drawImage(em, Math.round((size - em.width) / 2), Math.round((size - em.height) / 2));
  _cache.set(key, c);
  return c;
}
