// Procedural WebAudio soundscape: ocean, wind, rain, gulls, wood creaks,
// collect chimes, thunder — plus a generative music box that shifts
// between a bright day scale and a wistful night scale.
// Everything is synthesized; there are no audio files.

import { clamp } from '../util/math.js';

const DAY_SCALE = [0, 2, 4, 7, 9, 12, 14, 16]; // C major pentatonic-ish
const NIGHT_SCALE = [0, 3, 5, 7, 10, 12, 15];  // minor pentatonic
const BOSS_SCALE = [0, 1, 5, 7, 8, 12, 13];    // phrygian menace
const DUNGEON_SCALE = [0, 3, 7, 10, 12];       // sparse and hollow
const DAY_ROOT = 261.63; // C4
const NIGHT_ROOT = 196.0; // G3
const BOSS_ROOT = 146.83; // D3
const DUNGEON_ROOT = 164.81; // E3

export class AudioManager {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.started = false;
    this._creakTimer = 4;
    this._beatTimer = 0;
    this._lastNote = 0;
    this.musicMode = 'normal'; // normal | boss | dungeon

    game.events.on('sfx', (name) => this.play(name));
    game.events.on('ship:collide', () => this.play('thud'));
    game.events.on('weather:lightning', () => {
      // Thunder arrives a beat after the flash.
      setTimeout(() => this.play('thunder'), 300 + Math.random() * 900);
    });
    game.events.on('settings:changed', () => this._applyVolumes());
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.started = true;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.ambientBus = this.ctx.createGain();
    this.ambientBus.connect(this.master);

    // Gentle echo makes plucks feel like they drift over water.
    this.delay = this.ctx.createDelay(1);
    this.delay.delayTime.value = 0.31;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.32;
    this.delay.connect(fb);
    fb.connect(this.delay);
    const delayOut = this.ctx.createGain();
    delayOut.gain.value = 0.4;
    this.delay.connect(delayOut);
    delayOut.connect(this.musicBus);

    this._noiseBuffer = this._makeNoise();
    this.ocean = this._loopNoise(320, 'lowpass', 0.5);
    this.wind = this._loopNoise(900, 'bandpass', 0.0);
    this.rain = this._loopNoise(3800, 'highpass', 0.0);
    this._applyVolumes();

    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Pinkish noise: smoother, more like water than white noise.
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 4.2;
    }
    return buf;
  }

  _loopNoise(freq, type, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ambientBus);
    src.start();
    return { src, filter, gain: g };
  }

  _applyVolumes() {
    if (!this.started) return;
    const s = this.game.settings;
    this.master.gain.value = s.master;
    this.sfxBus.gain.value = s.sfx;
    this.musicBus.gain.value = s.music * 0.6;
    this.ambientBus.gain.value = 0.9;
  }

  update(dt) {
    if (!this.started) return;
    const { ship, weather, dayNight } = this.game;
    const t = this.ctx.currentTime;
    const ramp = (param, v) => param.setTargetAtTime(v, t, 0.6);

    // Ambient mix follows the world state.
    const swell = 0.8 + Math.sin(t * 0.5) * 0.15 + Math.sin(t * 0.13) * 0.05;
    ramp(this.ocean.gain.gain, (0.16 + ship.speedNorm * 0.1 + weather.windSpeed / 400) * swell);
    ramp(this.wind.gain.gain, clamp(weather.windSpeed / 220, 0.02, 0.5));
    this.wind.filter.frequency.setTargetAtTime(650 + weather.windSpeed * 6, t, 1);
    ramp(this.rain.gain.gain, weather.rain * 0.14);

    // Random wood creaks while under way.
    this._creakTimer -= dt * (0.4 + ship.speedNorm * 1.6);
    if (this._creakTimer <= 0) {
      this._creakTimer = 3 + Math.random() * 7;
      if (ship.speedNorm > 0.05) this.play('creak');
    }

    // Generative music box: the melody follows the moment — bright by
    // day, wistful by night, driving in boss fights, hollow underground.
    this._beatTimer -= dt;
    if (this._beatTimer <= 0) {
      const night = dayNight.snapshot.sun < 0.35;
      let scale = night ? NIGHT_SCALE : DAY_SCALE;
      let root = night ? NIGHT_ROOT : DAY_ROOT;
      let beat = night ? 0.62 : 0.44;
      let density = night ? 0.3 : 0.42;
      let gain = night ? 0.028 : 0.038;
      let decay = night ? 1.4 : 0.9;
      if (this.musicMode === 'boss') {
        scale = BOSS_SCALE;
        root = BOSS_ROOT;
        beat = 0.3;
        density = 0.6;
        gain = 0.045;
        decay = 0.5;
      } else if (this.musicMode === 'dungeon') {
        scale = DUNGEON_SCALE;
        root = DUNGEON_ROOT;
        beat = 0.8;
        density = 0.25;
        gain = 0.03;
        decay = 2;
      }
      this._beatTimer = beat;
      if (Math.random() < density) {
        // Melodies wander stepwise for musicality.
        this._lastNote = clamp(
          this._lastNote + (((Math.random() * 3) | 0) - 1),
          0, scale.length - 1,
        );
        const freq = root * Math.pow(2, scale[this._lastNote] / 12);
        this._pluck(freq, gain, decay);
        // boss mode gets a driving low pulse underneath
        if (this.musicMode === 'boss' && Math.random() < 0.5) {
          this._pluck(root / 2, 0.05, 0.3);
        }
      }
    }
  }

  setMusicMode(mode) {
    this.musicMode = mode;
  }

  _pluck(freq, gain, decay) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g);
    g.connect(this.musicBus);
    g.connect(this.delay);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  /** One-shot sound effects. */
  play(name) {
    if (!this.started || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'coin': {
        this._blip(988, 0.06, t, 'sine', 0.12);
        this._blip(1319, 0.09, t + 0.07, 'sine', 0.12);
        break;
      }
      case 'chest': {
        [659, 831, 988, 1319].forEach((f, i) => this._blip(f, 0.12, t + i * 0.08, 'triangle', 0.14));
        break;
      }
      case 'wood': {
        this._thump(150, 0.09, t, 0.22);
        this._noiseBurst(600, 0.05, t, 0.06);
        break;
      }
      case 'creak': {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(84 + Math.random() * 30, t);
        osc.frequency.linearRampToValueAtTime(60 + Math.random() * 20, t + 0.35);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 260;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        osc.connect(f);
        f.connect(g);
        g.connect(this.sfxBus);
        osc.start(t);
        osc.stop(t + 0.45);
        break;
      }
      case 'gull': {
        const n = 1 + ((Math.random() * 2) | 0);
        for (let i = 0; i < n; i++) {
          const st = t + i * 0.22;
          const osc = this.ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(1150 + Math.random() * 200, st);
          osc.frequency.exponentialRampToValueAtTime(760, st + 0.16);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.022, st + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.18);
          osc.connect(g);
          g.connect(this.sfxBus);
          osc.start(st);
          osc.stop(st + 0.2);
        }
        break;
      }
      case 'thud': {
        this._thump(70, 0.25, t, 0.4);
        this._noiseBurst(300, 0.12, t, 0.12);
        break;
      }
      case 'thunder': {
        this._noiseBurst(140, 1.8, t, 0.5, 'lowpass');
        this._thump(46, 1.2, t + 0.05, 0.3);
        break;
      }
      case 'ui':
      case 'click': {
        this._blip(660, 0.05, t, 'square', 0.05);
        break;
      }
      /* ---- Part 2: combat & interface -------------------------------- */
      case 'cannon': {
        this._noiseBurst(180, 0.5, t, 0.5, 'lowpass');
        this._thump(60, 0.4, t, 0.5);
        this._noiseBurst(1200, 0.08, t, 0.12);
        break;
      }
      case 'cannonFar': {
        this._noiseBurst(140, 0.45, t, 0.22, 'lowpass');
        this._thump(52, 0.35, t, 0.2);
        break;
      }
      case 'woodhit': {
        this._thump(110, 0.16, t, 0.4);
        this._noiseBurst(900, 0.12, t, 0.2);
        this._noiseBurst(400, 0.2, t + 0.02, 0.15, 'lowpass');
        break;
      }
      case 'splash': {
        this._noiseBurst(2400, 0.22, t, 0.14, 'highpass');
        this._noiseBurst(700, 0.14, t, 0.1);
        break;
      }
      case 'sink': {
        this._noiseBurst(300, 1.4, t, 0.3, 'lowpass');
        this._thump(80, 1, t, 0.3);
        [220, 180, 140].forEach((f, i) => this._blip(f, 0.3, t + i * 0.3, 'sine', 0.08));
        break;
      }
      case 'swing': {
        this._noiseBurst(2600, 0.09, t, 0.08, 'bandpass');
        break;
      }
      case 'hit': {
        this._thump(180, 0.1, t, 0.24);
        this._noiseBurst(1600, 0.06, t, 0.1);
        break;
      }
      case 'crit': {
        this._thump(140, 0.14, t, 0.34);
        this._blip(880, 0.08, t, 'square', 0.08);
        this._noiseBurst(2000, 0.09, t, 0.14);
        break;
      }
      case 'death': {
        this._thump(90, 0.3, t, 0.3);
        this._blip(160, 0.25, t + 0.05, 'sawtooth', 0.05);
        break;
      }
      case 'pistol': {
        this._noiseBurst(1400, 0.12, t, 0.3);
        this._thump(150, 0.1, t, 0.25);
        break;
      }
      case 'pistolFar': {
        this._noiseBurst(1000, 0.1, t, 0.12);
        break;
      }
      case 'musket': {
        this._noiseBurst(900, 0.2, t, 0.4, 'lowpass');
        this._noiseBurst(2400, 0.08, t, 0.2);
        this._thump(100, 0.18, t, 0.3);
        break;
      }
      case 'dash': {
        this._noiseBurst(3200, 0.12, t, 0.1, 'highpass');
        break;
      }
      case 'boarding': {
        this._thump(70, 0.5, t, 0.4);
        [392, 466, 587].forEach((f, i) => this._blip(f, 0.2, t + i * 0.12, 'square', 0.06));
        break;
      }
      case 'victory': {
        [523, 659, 784, 1047].forEach((f, i) => this._blip(f, 0.22, t + i * 0.11, 'triangle', 0.12));
        break;
      }
      case 'levelup': {
        [440, 554, 659, 880].forEach((f, i) => this._blip(f, 0.25, t + i * 0.09, 'triangle', 0.13));
        break;
      }
      case 'quest': {
        this._blip(659, 0.12, t, 'triangle', 0.12);
        this._blip(988, 0.2, t + 0.12, 'triangle', 0.12);
        break;
      }
      case 'recruit': {
        [392, 494, 587].forEach((f, i) => this._blip(f, 0.15, t + i * 0.09, 'triangle', 0.1));
        break;
      }
      case 'equip': {
        this._noiseBurst(1800, 0.06, t, 0.1);
        this._blip(440, 0.08, t + 0.03, 'square', 0.06);
        break;
      }
      case 'buy': {
        this._blip(784, 0.06, t, 'sine', 0.1);
        this._blip(1046, 0.1, t + 0.07, 'sine', 0.1);
        break;
      }
      case 'repair': {
        this._thump(160, 0.08, t, 0.18);
        this._thump(200, 0.08, t + 0.14, 0.18);
        this._blip(660, 0.1, t + 0.3, 'triangle', 0.08);
        break;
      }
      case 'upgrade': {
        this._thump(140, 0.1, t, 0.2);
        [523, 659, 784].forEach((f, i) => this._blip(f, 0.16, t + 0.1 + i * 0.08, 'triangle', 0.1));
        break;
      }
      /* ---- Part 3: legends, dungeons, fishing ------------------------- */
      case 'roar': {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.exponentialRampToValueAtTime(38, t + 1);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 340;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.32, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        osc.connect(f);
        f.connect(g);
        g.connect(this.sfxBus);
        osc.start(t);
        osc.stop(t + 1.3);
        this._noiseBurst(200, 1, t, 0.2, 'lowpass');
        break;
      }
      case 'slam': {
        this._thump(50, 0.4, t, 0.5);
        this._noiseBurst(500, 0.3, t, 0.3, 'lowpass');
        break;
      }
      case 'hiss': {
        this._noiseBurst(4200, 0.5, t, 0.12, 'highpass');
        break;
      }
      case 'bite': {
        this._blip(320, 0.07, t, 'sine', 0.16);
        this._noiseBurst(1800, 0.1, t, 0.1);
        break;
      }
      case 'cast': {
        this._noiseBurst(3000, 0.14, t, 0.06, 'highpass');
        this._blip(520, 0.05, t + 0.15, 'sine', 0.05);
        break;
      }
      case 'dungeon': {
        this._thump(70, 0.6, t, 0.25);
        this._blip(146, 0.5, t + 0.1, 'triangle', 0.06);
        this._blip(110, 0.7, t + 0.4, 'triangle', 0.05);
        break;
      }
    }
  }

  _blip(freq, dur, t, type, gain) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.1);
  }

  _thump(freq, dur, t, gain) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.6, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _noiseBurst(freq, dur, t, gain, type = 'bandpass') {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
}
