// Large expressive pixel portraits for dialogue.
//
// Drawn procedurally at 64x64 and scaled up with image-rendering:
// pixelated, so every face is authored in the same pixel grammar as the
// rest of the game. Faces blink on their own and articulate their
// mouths while a line is being typed — the point is that these read as
// people talking, not as a static bust beside a text dump.

import { makeCanvas } from './sprites.js';
import { shade } from './pirate.js';

export const P = 64; // portrait size in native pixels

/* ------------------------------------------------------------------ */
/* Small drawing helpers                                               */
/* ------------------------------------------------------------------ */

function px(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x | 0, y | 0, w | 0, h | 0);
}

/** Rough organic blob, dithered at the edge so it never looks vector. */
function blob(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const t = y / ry;
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    if (w > 0) g.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

/* ------------------------------------------------------------------ */
/* Expression tables                                                   */
/* ------------------------------------------------------------------ */
// browY: vertical offset, browTilt: inner-end lift (negative = angry)
// eyeOpen: 0..1, mouth: shape key

const EXPRESSIONS = {
  neutral:   { browY: 0, browTilt: 0, eyeOpen: 1, mouth: 'line' },
  warm:      { browY: -1, browTilt: 1, eyeOpen: 0.8, mouth: 'smile' },
  grin:      { browY: -1, browTilt: 1, eyeOpen: 0.7, mouth: 'grin' },
  angry:     { browY: 1, browTilt: -2, eyeOpen: 1, mouth: 'snarl' },
  grim:      { browY: 1, browTilt: -1, eyeOpen: 0.9, mouth: 'frown' },
  sad:       { browY: 0, browTilt: 2, eyeOpen: 0.6, mouth: 'frown' },
  shock:     { browY: -3, browTilt: 0, eyeOpen: 1.4, mouth: 'open' },
  sly:       { browY: -1, browTilt: -1, eyeOpen: 0.5, mouth: 'smirk' },
  hollow:    { browY: 0, browTilt: 0, eyeOpen: 1.2, mouth: 'none' },
};

/* ------------------------------------------------------------------ */
/* Portrait renderer                                                   */
/* ------------------------------------------------------------------ */

/**
 * Draw one portrait frame.
 * face  — the character's look (see story/characters.js)
 * opts  — { expression, t, talking, blink }
 */
export function drawPortrait(g, face, opts = {}) {
  const t = opts.t ?? 0;
  const ex = EXPRESSIONS[opts.expression] ?? EXPRESSIONS.neutral;
  const blink = opts.blink ?? false;
  const talking = opts.talking ?? false;

  g.clearRect(0, 0, P, P);

  // ---- backdrop: a soft vignette in the character's own hue --------
  const bg = g.createLinearGradient(0, 0, 0, P);
  bg.addColorStop(0, face.bgTop);
  bg.addColorStop(1, face.bgBottom);
  g.fillStyle = bg;
  g.fillRect(0, 0, P, P);
  // subtle scanline texture, keeps the flat gradient from feeling digital
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < P; y += 2) g.fillRect(0, y, P, 1);

  // gentle breathing so a silent portrait is never fully static
  const bob = Math.round(Math.sin(t * 1.6) * 0.5 + 0.5) - 1;
  g.save();
  g.translate(0, bob);

  const skin = face.skin;
  const skinDark = shade(skin, -26);
  const skinLight = shade(skin, 18);
  const cx = 32;
  const headY = 31;

  // ---- neck & shoulders ---------------------------------------------
  px(g, cx - 5, headY + 13, 10, 8, skinDark);
  blob(g, cx, P - 2, 26, 12, face.coat);
  px(g, cx - 26, P - 8, 52, 8, face.coat);
  // collar
  px(g, cx - 9, P - 12, 5, 6, shade(face.coat, 22));
  px(g, cx + 4, P - 12, 5, 6, shade(face.coat, 22));
  if (face.collarTrim) {
    px(g, cx - 10, P - 13, 6, 2, face.collarTrim);
    px(g, cx + 4, P - 13, 6, 2, face.collarTrim);
  }

  // ---- head ------------------------------------------------------------
  // Cranium plus a jaw that tapers to the chin — an untapered blob is
  // what makes pixel faces read as square blocks.
  blob(g, cx, headY - 2, 15, 15, skin);
  for (let i = 0; i < 12; i++) {
    const w = Math.round(15 - (i / 11) * 7); // 15 wide at the cheek, 8 at the chin
    px(g, cx - w, headY + 6 + i, w * 2, 1, skin);
  }
  // cheek shading + lit side
  g.globalAlpha = 0.5;
  blob(g, cx + 9, headY + 3, 6, 11, skinDark);
  blob(g, cx - 10, headY - 2, 5, 9, skinLight);
  g.globalAlpha = 1;
  // cheekbone catch
  g.globalAlpha = 0.3;
  px(g, cx - 12, headY + 3, 4, 2, skinLight);
  px(g, cx + 8, headY + 3, 4, 2, skinLight);
  g.globalAlpha = 1;

  // ---- ears -------------------------------------------------------------
  px(g, cx - 16, headY + 1, 3, 6, skin);
  px(g, cx + 13, headY + 1, 3, 6, skin);
  if (face.earring) {
    px(g, cx + 14, headY + 7, 2, 3, face.earring);
    px(g, cx + 14, headY + 9, 2, 1, shade(face.earring, -30));
  }

  // ---- hair behind (long styles) ------------------------------------------
  if (face.hair === 'long' || face.hair === 'dreads') {
    px(g, cx - 18, headY - 8, 5, 26, face.hairColor);
    px(g, cx + 13, headY - 8, 5, 26, face.hairColor);
  }
  if (face.hair === 'dreads') {
    for (let i = 0; i < 4; i++) {
      px(g, cx - 18 + (i % 2), headY + 16 + i * 3, 4, 3, shade(face.hairColor, -12));
      px(g, cx + 14 - (i % 2), headY + 16 + i * 3, 4, 3, shade(face.hairColor, -12));
    }
  }

  // ---- brows ----------------------------------------------------------------
  const browBase = headY - 7 + ex.browY;
  const browCol = shade(face.beardColor ?? face.hairColor, -18);
  for (const side of [-1, 1]) {
    const bx = cx + side * 9;
    for (let i = 0; i < 8; i++) {
      // inner end of the brow lifts or drops to carry the emotion
      const inner = side < 0 ? i : 7 - i;
      const lift = Math.round((inner / 7) * ex.browTilt);
      px(g, bx - side * 4 + side * i, browBase + lift, 1, 3, browCol);
    }
  }

  // ---- eyes -------------------------------------------------------------------
  // Mostly iris with slivers of white either side — a wide sclera reads
  // as googly at this size, which is the classic pixel-portrait trap.
  const eyeY = headY - 1;
  const open = blink ? 0 : ex.eyeOpen;
  const eyeH = Math.max(1, Math.round(3 * open));
  for (const side of [-1, 1]) {
    const exx = cx + side * 8;
    if (face.eyepatch === side) continue; // covered below
    const top = eyeY - Math.floor(eyeH / 2);
    // socket shadow gives the eye somewhere to sit
    px(g, exx - 4, top - 1, 9, eyeH + 2, shade(skin, -16));
    if (blink) {
      px(g, exx - 4, eyeY, 9, 1, skinDark); // closed lid
    } else {
      const look = Math.round(Math.sin(t * 0.5 + side) * 1);
      px(g, exx - 3, top, 7, eyeH, '#efe7d8'); // sclera
      px(g, exx - 2 + look, top, 4, eyeH, face.eyeColor); // iris
      px(g, exx - 1 + look, top, 2, eyeH, '#14121a'); // pupil
      px(g, exx - 1 + look, top, 1, 1, '#ffffff'); // catchlight
      if (face.glowEyes) {
        g.globalAlpha = 0.45 + Math.sin(t * 3) * 0.2;
        px(g, exx - 4, top - 1, 9, eyeH + 2, face.eyeColor);
        g.globalAlpha = 1;
      }
    }
    // upper lid, heavier than the lower — sells the brow weight
    px(g, exx - 4, top - 2, 9, 2, skinDark);
    px(g, exx - 3, top + eyeH, 7, 1, shade(skin, -8));
  }

  // ---- eyepatch ------------------------------------------------------------------
  if (face.eyepatch) {
    const exx = cx + face.eyepatch * 8;
    px(g, cx - 16, eyeY - 3, 32, 2, '#26202a'); // strap across the brow
    px(g, exx - 5, eyeY - 4, 10, 8, '#1a161f');
    px(g, exx - 4, eyeY - 3, 8, 2, '#2e2833');
  }

  // ---- nose --------------------------------------------------------------------------
  px(g, cx - 1, eyeY + 3, 3, 5, skinDark);
  px(g, cx - 2, eyeY + 7, 5, 1, shade(skin, -12));

  // ---- facial hair ------------------------------------------------------------------------
  // Drawn before the mouth so speech always reads on top of a beard.
  const my = headY + 11; // mouth line, shared with the mouth block below
  const hc = face.beardColor ?? face.hairColor;
  switch (face.beard) {
    case 'stubble':
      g.globalAlpha = 0.35;
      px(g, cx - 12, my - 6, 25, 12, hc);
      g.globalAlpha = 1;
      break;
    case 'mustache':
      px(g, cx - 7, my - 5, 15, 2, hc);
      px(g, cx - 8, my - 4, 2, 3, hc);
      px(g, cx + 7, my - 4, 2, 3, hc);
      break;
    case 'full':
      // Jawline and chin only; the lip gap keeps the mouth legible.
      px(g, cx - 13, my - 6, 6, 10, hc);
      px(g, cx + 8, my - 6, 6, 10, hc);
      blob(g, cx, my + 7, 12, 7, hc);
      px(g, cx - 7, my - 5, 15, 2, hc); // mustache, above the lip
      break;
    case 'braided':
      px(g, cx - 13, my - 6, 6, 10, hc);
      px(g, cx + 8, my - 6, 6, 10, hc);
      blob(g, cx, my + 6, 11, 6, hc);
      px(g, cx - 7, my - 5, 15, 2, hc);
      px(g, cx - 5, my + 10, 3, 6, hc);
      px(g, cx + 3, my + 10, 3, 6, hc);
      px(g, cx - 5, my + 13, 3, 1, face.earring ?? '#e0b345');
      px(g, cx + 3, my + 13, 3, 1, face.earring ?? '#e0b345');
      break;
    default:
      break;
  }

  // ---- mouth ----------------------------------------------------------------------------
  // While talking the mouth cycles through open shapes; the cadence is
  // deliberately irregular so it reads as speech, not a metronome.
  let shape = ex.mouth;
  if (talking && shape !== 'none') {
    const phase = (Math.sin(t * 17) + Math.sin(t * 11.3)) * 0.5;
    shape = phase > 0.35 ? 'open' : phase > -0.1 ? 'ajar' : shape;
  }
  const lip = '#7a4038';
  const maw = '#3a1e20';
  switch (shape) {
    case 'line':
      px(g, cx - 4, my, 9, 1, lip);
      break;
    case 'smile':
      px(g, cx - 4, my, 9, 1, lip);
      px(g, cx - 5, my - 1, 1, 1, lip);
      px(g, cx + 5, my - 1, 1, 1, lip);
      break;
    case 'grin':
      px(g, cx - 5, my - 1, 11, 2, maw);
      px(g, cx - 4, my - 1, 9, 1, '#e8e4da'); // teeth
      px(g, cx - 6, my - 2, 1, 1, lip);
      px(g, cx + 6, my - 2, 1, 1, lip);
      break;
    case 'smirk':
      px(g, cx - 3, my, 8, 1, lip);
      px(g, cx + 5, my - 1, 2, 1, lip);
      break;
    case 'frown':
      px(g, cx - 4, my + 1, 9, 1, lip);
      px(g, cx - 5, my, 1, 1, lip);
      px(g, cx + 5, my, 1, 1, lip);
      break;
    case 'snarl':
      px(g, cx - 5, my - 1, 11, 3, maw);
      px(g, cx - 4, my - 1, 9, 1, '#e8e4da');
      px(g, cx - 5, my - 2, 2, 1, lip);
      px(g, cx + 4, my - 2, 2, 1, lip);
      break;
    case 'ajar':
      px(g, cx - 3, my - 1, 7, 3, maw);
      px(g, cx - 3, my - 1, 7, 1, '#e8e4da');
      break;
    case 'open':
      px(g, cx - 4, my - 2, 9, 6, maw);
      px(g, cx - 3, my - 2, 7, 1, '#e8e4da');
      px(g, cx - 2, my + 2, 5, 1, '#8e3a44'); // tongue
      break;
    default:
      break; // 'none' — the Herald never moves its mouth
  }

  // ---- scar ------------------------------------------------------------------------------------
  if (face.scar) {
    const sx = cx + face.scar * 10;
    px(g, sx, headY - 10, 1, 14, shade(skin, -40));
    px(g, sx - 1, headY - 7, 3, 1, shade(skin, -40));
    px(g, sx - 1, headY - 2, 3, 1, shade(skin, -40));
  }

  // ---- hair on top ------------------------------------------------------------------------------
  switch (face.hair) {
    case 'short':
      blob(g, cx, headY - 12, 15, 7, face.hairColor);
      px(g, cx - 15, headY - 11, 3, 7, face.hairColor);
      px(g, cx + 12, headY - 11, 3, 7, face.hairColor);
      break;
    case 'long':
    case 'dreads':
      blob(g, cx, headY - 12, 16, 8, face.hairColor);
      break;
    case 'wild':
      blob(g, cx, headY - 12, 16, 8, face.hairColor);
      for (let i = 0; i < 6; i++) {
        px(g, cx - 14 + i * 5, headY - 22 + (i % 3) * 3, 3, 8, face.hairColor);
      }
      break;
    case 'bald':
    default:
      break;
  }

  // ---- headwear -----------------------------------------------------------------------------------
  switch (face.hat) {
    case 'bandana': {
      px(g, cx - 16, headY - 14, 32, 6, face.hatColor);
      px(g, cx - 15, headY - 17, 30, 4, face.hatColor);
      px(g, cx + 14, headY - 12, 5, 4, shade(face.hatColor, -18));
      px(g, cx + 16, headY - 9, 4, 8, shade(face.hatColor, -18));
      // knot highlights
      px(g, cx - 8, headY - 15, 2, 2, shade(face.hatColor, 26));
      px(g, cx + 2, headY - 16, 2, 2, shade(face.hatColor, 26));
      break;
    }
    // Brims ride 2px clear of the brow line (browBase is headY - 7, and a
    // raised "shock" brow reaches headY - 10) — a brim resting on the brows
    // erases the one feature that carries the expression.
    case 'tricorne': {
      px(g, cx - 25, headY - 14, 50, 4, face.hatColor);
      px(g, cx - 25, headY - 17, 8, 4, face.hatColor);
      px(g, cx + 17, headY - 17, 8, 4, face.hatColor);
      blob(g, cx, headY - 18, 15, 9, shade(face.hatColor, 12));
      px(g, cx - 15, headY - 15, 30, 2, face.hatTrim ?? '#e0b345');
      break;
    }
    case 'captain': {
      px(g, cx - 27, headY - 15, 54, 5, shade(face.hatColor, -12));
      px(g, cx - 27, headY - 19, 9, 5, shade(face.hatColor, -12));
      px(g, cx + 18, headY - 19, 9, 5, shade(face.hatColor, -12));
      blob(g, cx, headY - 19, 16, 10, face.hatColor);
      px(g, cx - 16, headY - 16, 32, 2, face.hatTrim ?? '#e0b345');
      // skull mark
      px(g, cx - 3, headY - 24, 6, 5, '#e8e4da');
      px(g, cx - 2, headY - 23, 1, 1, '#14121a');
      px(g, cx + 1, headY - 23, 1, 1, '#14121a');
      px(g, cx - 2, headY - 20, 4, 1, '#c8c4ba');
      break;
    }
    case 'coral': {
      // The Herald wears the reef itself.
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * Math.PI + Math.PI;
        const hx = cx + Math.cos(a) * 15;
        const hy = headY - 10 + Math.sin(a) * 12;
        const h = 5 + (i % 3) * 4;
        px(g, hx, hy - h, 3, h + 3, i % 2 ? '#3f8f80' : '#2e6e64');
        px(g, hx, hy - h, 3, 2, '#7ae0cc');
      }
      blob(g, cx, headY - 12, 15, 6, '#2e6e64');
      break;
    }
    default:
      break;
  }

  g.restore();

  // ---- frame vignette (drawn last, over everything) --------------------
  const vg = g.createRadialGradient(cx, 28, 14, cx, 30, 40);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(4,8,16,0.55)');
  g.fillStyle = vg;
  g.fillRect(0, 0, P, P);
}

/** Convenience: a static portrait canvas (menus, crew lists). */
export function portraitCanvas(face, expression = 'neutral') {
  const c = makeCanvas(P, P);
  drawPortrait(c.getContext('2d'), face, { expression });
  return c;
}
