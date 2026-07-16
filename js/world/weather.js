// Weather state machine: sunny / cloudy / rain / storm / fog with wind.
// States blend into each other gradually; the renderer and audio read
// the blended parameters, never the raw state.

import { mulberry32 } from '../util/random.js';
import { lerp, TAU } from '../util/math.js';

const PARAMS = {
  sunny:  { cloud: 0.08, rain: 0,    fog: 0,    wind: 16 },
  cloudy: { cloud: 0.55, rain: 0,    fog: 0.04, wind: 32 },
  rain:   { cloud: 0.72, rain: 0.55, fog: 0.08, wind: 48 },
  storm:  { cloud: 0.95, rain: 1,    fog: 0.12, wind: 90 },
  fog:    { cloud: 0.35, rain: 0,    fog: 0.85, wind: 10 },
};

// Weighted transitions — weather evolves believably (no sun -> storm jumps).
const TRANSITIONS = {
  sunny:  [['sunny', 3], ['cloudy', 4], ['fog', 1.5]],
  cloudy: [['sunny', 3.5], ['cloudy', 2], ['rain', 3], ['fog', 1], ['storm', 0.8]],
  rain:   [['cloudy', 4], ['rain', 2], ['storm', 2]],
  storm:  [['rain', 4], ['cloudy', 2]],
  fog:    [['sunny', 3], ['cloudy', 3], ['fog', 1.5]],
};

const BLEND_TIME = 14; // seconds to fade between states

export class Weather {
  constructor(seed, saved) {
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.current = saved?.current ?? 'sunny';
    this.next = saved?.next ?? this.current;
    this.blend = saved?.blend ?? 1;
    this.timer = saved?.timer ?? this._duration();
    this.windAngle = saved?.windAngle ?? this.rng() * TAU;

    // Blended outputs.
    this.cloud = 0;
    this.rain = 0;
    this.fog = 0;
    this.windSpeed = 0;
    this.windX = 0;
    this.windY = 0;

    this.lightning = 0; // flash intensity 0..1, decays fast
    this._lightningTimer = 5;
    this._compute();
  }

  _duration() {
    return 70 + this.rng() * 110;
  }

  _pickNext() {
    const options = TRANSITIONS[this.current];
    let total = 0;
    for (const [, w] of options) total += w;
    let r = this.rng() * total;
    for (const [kind, w] of options) {
      r -= w;
      if (r <= 0) return kind;
    }
    return options[0][0];
  }

  update(dt, events) {
    this.timer -= dt;
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / BLEND_TIME);
      if (this.blend >= 1) this.current = this.next;
    } else if (this.timer <= 0) {
      this.next = this._pickNext();
      this.timer = this._duration();
      if (this.next !== this.current) {
        this.blend = 0;
        events?.emit('weather:changed', { kind: this.next });
      }
    }

    // Wind direction wanders slowly.
    this.windAngle += (this.rng() - 0.5) * dt * 0.25;
    this._compute();

    // Lightning during storms (also during heavy rain->storm blends).
    if (this.rain > 0.8) {
      this._lightningTimer -= dt;
      if (this._lightningTimer <= 0) {
        this._lightningTimer = 3 + this.rng() * 9;
        this.lightning = 1;
        events?.emit('weather:lightning');
      }
    }
    this.lightning = Math.max(0, this.lightning - dt * 3.2);
  }

  _compute() {
    const a = PARAMS[this.current];
    const b = PARAMS[this.next];
    const k = this.blend;
    this.cloud = lerp(a.cloud, b.cloud, k);
    this.rain = lerp(a.rain, b.rain, k);
    this.fog = lerp(a.fog, b.fog, k);
    this.windSpeed = lerp(a.wind, b.wind, k);
    this.windX = Math.cos(this.windAngle) * this.windSpeed;
    this.windY = Math.sin(this.windAngle) * this.windSpeed;
  }

  /** The label shown in UI / used by audio. */
  get kind() {
    return this.blend < 0.5 ? this.current : this.next;
  }

  serialize() {
    return {
      current: this.current, next: this.next, blend: this.blend,
      timer: this.timer, windAngle: this.windAngle,
    };
  }
}
