// Full day/night cycle: sunrise, day, sunset, night, moonlight.
// Produces a color "snapshot" every frame that the water, lighting and
// audio systems read from, keyframed over normalized time t in [0, 1).

import { DAY_LENGTH } from '../core/constants.js';
import { lerpColor } from '../util/math.js';

// t, water deep, water light, ambient light (multiply), sun, moon, glint tint
const KEYS = [
  { t: 0.0,  deep: [8, 18, 46],    hi: [18, 40, 82],    amb: [86, 104, 168],  sun: 0,    moon: 1,   glint: [190, 210, 255] },
  { t: 0.2,  deep: [14, 26, 58],   hi: [30, 52, 96],    amb: [116, 122, 182], sun: 0,    moon: 0.7, glint: [200, 210, 250] },
  { t: 0.26, deep: [42, 56, 104],  hi: [140, 106, 118], amb: [230, 180, 160], sun: 0.45, moon: 0.1, glint: [255, 200, 140] },
  { t: 0.33, deep: [26, 84, 138],  hi: [64, 140, 186],  amb: [255, 240, 225], sun: 0.9,  moon: 0,   glint: [255, 236, 190] },
  { t: 0.42, deep: [23, 92, 156],  hi: [64, 152, 200],  amb: [255, 255, 255], sun: 1,    moon: 0,   glint: [240, 250, 255] },
  { t: 0.6,  deep: [23, 92, 156],  hi: [64, 152, 200],  amb: [255, 255, 255], sun: 1,    moon: 0,   glint: [240, 250, 255] },
  { t: 0.7,  deep: [40, 74, 126],  hi: [150, 124, 130], amb: [255, 228, 192], sun: 0.75, moon: 0,   glint: [255, 214, 150] },
  { t: 0.76, deep: [54, 54, 96],   hi: [200, 122, 84],  amb: [255, 196, 152], sun: 0.4,  moon: 0.1, glint: [255, 170, 110] },
  { t: 0.84, deep: [18, 30, 64],   hi: [44, 62, 108],   amb: [140, 138, 190], sun: 0.05, moon: 0.5, glint: [220, 210, 240] },
  { t: 0.92, deep: [8, 18, 46],    hi: [18, 40, 82],    amb: [86, 104, 168],  sun: 0,    moon: 1,   glint: [190, 210, 255] },
  { t: 1.0,  deep: [8, 18, 46],    hi: [18, 40, 82],    amb: [86, 104, 168],  sun: 0,    moon: 1,   glint: [190, 210, 255] },
];

export class DayNight {
  constructor(saved) {
    /** Normalized time of day, 0 = midnight, 0.5 = noon. */
    this.t = saved?.t ?? 0.34; // start in the morning
    this.day = saved?.day ?? 1;
    this.snapshot = {
      deep: [0, 0, 0], hi: [0, 0, 0], amb: [255, 255, 255],
      sun: 1, moon: 0, glint: [255, 255, 255], phase: 'day',
    };
    this._lastPhase = null;
    this._compute();
  }

  update(dt, events) {
    this.t += dt / DAY_LENGTH;
    if (this.t >= 1) {
      this.t -= 1;
      this.day++;
    }
    this._compute();
    if (events && this.snapshot.phase !== this._lastPhase) {
      this._lastPhase = this.snapshot.phase;
      events.emit('daynight:phase', { phase: this.snapshot.phase });
    }
  }

  _compute() {
    const t = this.t;
    let a = KEYS[0];
    let b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (t >= KEYS[i].t && t <= KEYS[i + 1].t) {
        a = KEYS[i];
        b = KEYS[i + 1];
        break;
      }
    }
    const span = b.t - a.t || 1;
    const k = (t - a.t) / span;
    const s = this.snapshot;
    lerpColor(a.deep, b.deep, k, s.deep);
    lerpColor(a.hi, b.hi, k, s.hi);
    lerpColor(a.amb, b.amb, k, s.amb);
    lerpColor(a.glint, b.glint, k, s.glint);
    s.sun = a.sun + (b.sun - a.sun) * k;
    s.moon = a.moon + (b.moon - a.moon) * k;
    s.phase = t < 0.22 ? 'night' : t < 0.34 ? 'dawn' : t < 0.68 ? 'day' : t < 0.86 ? 'dusk' : 'night';
  }

  get isNight() {
    return this.snapshot.sun < 0.25;
  }

  serialize() {
    return { t: this.t, day: this.day };
  }
}
