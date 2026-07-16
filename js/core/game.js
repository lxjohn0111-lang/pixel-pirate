// Game orchestrator: owns every system, runs the loop, and manages the
// state machine (creator -> playing <-> paused). Systems communicate
// through the EventBus, so future features (combat, quests, trading...)
// can be added as new systems with update()/draw hooks without editing
// the ones below.

import { AUTOSAVE_INTERVAL } from './constants.js';
import { EventBus } from './events.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { SaveManager } from './save.js';
import { World } from '../world/world.js';
import { DayNight } from '../world/daynight.js';
import { Weather } from '../world/weather.js';
import { Ship } from '../entities/ship.js';
import { Wildlife } from '../entities/wildlife.js';
import { Collectibles } from '../entities/collectibles.js';
import { Particles } from '../render/particles.js';
import { Renderer } from '../render/renderer.js';
import { AudioManager } from '../audio/audio.js';
import { CharacterCreator } from '../ui/creator.js';
import { HUD } from '../ui/hud.js';
import { PauseMenu } from '../ui/pause.js';

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.events = new EventBus();
    this.state = 'boot';
    this.settings = { master: 0.8, music: 0.7, sfx: 0.9, quality: 'high' };
    this.time = 0;
    this._lastTs = 0;
    this._autosaveTimer = AUTOSAVE_INTERVAL;

    /** Ordered list of updatable systems — the plug-in point for future
     *  gameplay (combat, crew, fishing...). Each entry: { update(dt) }. */
    this.systems = [];
  }

  registerSystem(system) {
    this.systems.push(system);
    return system;
  }

  boot() {
    const save = SaveManager.load();
    if (save?.settings) Object.assign(this.settings, save.settings);
    const creator = new CharacterCreator(this.uiRoot, save, (appearance, useSave) => {
      this.start(appearance, useSave ? save : null);
    });
    creator.show();
  }

  start(appearance, save) {
    this.appearance = appearance;
    this.seed = save?.seed ?? ((Math.random() * 0xffffffff) >>> 0);
    this.resources = save?.resources ?? { coins: 0, wood: 0 };

    this.world = new World(this.seed, save?.collected ?? []);
    this.dayNight = new DayNight(save?.time);
    this.weather = new Weather(this.seed, save?.weather);
    this.ship = new Ship(save?.ship, appearance);
    this.camera = new Camera(this.ship.x, this.ship.y);
    this.particles = new Particles();
    this.input = new Input(this.events, this.uiRoot);
    this.audio = new AudioManager(this);

    this.registerSystem(this.wildlife = new Wildlife(this));
    this.registerSystem(this.collectibles = new Collectibles(this));

    this.renderer = new Renderer(this.canvas, this);
    this.hud = new HUD(this.uiRoot, this);
    this.pauseMenu = new PauseMenu(this.uiRoot, this);

    this.events.on('input:pause', () => this.togglePause());
    this.events.on('settings:changed', () => {
      this.particles.quality = this.settings.quality === 'high' ? 1 : 0.5;
      this.save();
    });
    this.particles.quality = this.settings.quality === 'high' ? 1 : 0.5;

    // Audio can only start on a user gesture; the "Set Sail" click was one,
    // but cover reloads/continues with a one-time listener as well.
    this.audio.start();
    const startAudio = () => {
      this.audio.start();
      if (this.audio.ctx?.state === 'suspended') this.audio.ctx.resume();
    };
    window.addEventListener('pointerdown', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });

    // Pause automatically when the tab is hidden; always save.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
      this.save();
    });
    window.addEventListener('beforeunload', () => this.save());

    // Pre-generate the chunks around the spawn so the first frame is complete.
    const view = this.renderer.viewRect();
    this.world.ensure(view.x - 200, view.y - 200, view.w + 400, view.h + 400);

    this.state = 'playing';
    this._lastTs = performance.now();
    requestAnimationFrame((ts) => this._frame(ts));
  }

  /* ---- state -------------------------------------------------------- */

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pauseMenu.show();
    this.audio.ctx?.suspend?.();
    this.events.emit('game:pause');
    this.save();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.pauseMenu.hide();
    this.audio.ctx?.resume?.();
    this.events.emit('game:resume');
    this._lastTs = performance.now();
  }

  newGame() {
    SaveManager.clear();
    location.reload();
  }

  /* ---- loop ----------------------------------------------------------- */

  _frame(ts) {
    requestAnimationFrame((next) => this._frame(next));
    const dt = Math.min(0.05, (ts - this._lastTs) / 1000);
    this._lastTs = ts;
    if (this.state !== 'playing') return;

    this.time += dt;
    this._update(dt);
    this.renderer.render(this.time);
    this.hud.update();
  }

  _update(dt) {
    this.input.update();
    this.dayNight.update(dt, this.events);
    this.weather.update(dt, this.events);

    // Keep the world generated around the camera view (plus a margin so
    // nothing pops in at the edges).
    const view = this.renderer.viewRect();
    this.world.ensure(view.x - 100, view.y - 100, view.w + 200, view.h + 200);

    this.ship.update(dt, this.input, this.world, this);
    for (const system of this.systems) system.update(dt);
    this.particles.update(dt);
    this.camera.update(dt, this.ship);
    this.audio.update(dt);

    this._autosaveTimer -= dt;
    if (this._autosaveTimer <= 0) {
      this._autosaveTimer = AUTOSAVE_INTERVAL;
      this.save();
    }
  }

  /* ---- persistence ------------------------------------------------------ */

  save() {
    if (!this.world) return;
    SaveManager.save({
      seed: this.seed,
      appearance: this.appearance,
      ship: this.ship.serialize(),
      resources: this.resources,
      time: this.dayNight.serialize(),
      weather: this.weather.serialize(),
      collected: [...this.world.collected],
      settings: this.settings,
    });
  }
}
