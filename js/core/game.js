// Game orchestrator: owns every system, runs the loop, and manages the
// state machine (creator -> playing <-> paused, plus boarding combat).
// Systems communicate through the EventBus; Part 2 systems plug in via
// the seams Part 1 established (registerSystem, addFeatureGenerator).

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
// Part 2
import { Inventory } from '../items/inventory.js';
import { ITEMS, RARITY, RARITY_ORDER, bestRarity } from '../items/itemdefs.js';
import { Player } from '../entities/player.js';
import { ShipState, PAINTS } from '../entities/shipstate.js';
import { CrewSystem, createCrewMember } from '../crew/crew.js';
import { ShipCombat } from '../combat/shipcombat.js';
import { Boarding } from '../combat/boarding.js';
import { Encounters } from '../world/encounters.js';
import { Ports } from '../world/ports.js';
import { Quests } from '../quests/quests.js';
import { InventoryUI } from '../ui/inventoryUI.js';
import { PortUI } from '../ui/portUI.js';
import { MapUI } from '../ui/mapUI.js';
import { LootUI } from '../ui/lootUI.js';
import { rollLoot } from '../items/itemdefs.js';
import { mulberry32 } from '../util/random.js';
import { dist2 } from '../util/math.js';

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
    this._discoverTimer = 0;

    /** Ordered list of updatable systems — the plug-in point for future
     *  gameplay. Each entry: { update(dt) }. */
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

    // ---- Part 2 state ---------------------------------------------------
    this.shipState = new ShipState(this, save?.shipState);
    this.inventory = new Inventory(save?.inventory, this.shipState.cargoSlots);
    this.player = new Player(save?.player, this.inventory, this.events);
    this.crew = new CrewSystem(this, save?.crew);
    this.portHired = save?.portHired ?? {};
    this.mapData = {
      explored: new Set(save?.mapData?.explored ?? []),
      islands: save?.mapData?.islands ?? [],
      ports: save?.mapData?.ports ?? [],
      markers: save?.mapData?.markers ?? [],
    };
    this._savedTreasures = save?.treasures ?? [];

    // World feature generators must register before the first ensure().
    this.encounters = new Encounters(this);
    this.ports = new Ports(this);

    this.registerSystem(this.wildlife = new Wildlife(this));
    this.registerSystem(this.collectibles = new Collectibles(this));
    this.registerSystem(this.crew);
    this.combat = this.registerSystem(new ShipCombat(this));
    this.boarding = new Boarding(this);
    this.quests = new Quests(this, save?.quests);

    // First voyage: a captain needs the basics.
    if (!save?.inventory) {
      this.inventory.equip('rustyCutlass');
      this.inventory.addAnywhere('cannonball', 20);
      this.inventory.addAnywhere('bullets', 6);
      this.inventory.addAnywhere('food', 2);
      this.inventory.quickbar[0] = 'food';
      // Migrate Part 1 wood counter into the item world.
      if (save?.resources?.wood > 0) {
        this.inventory.addAnywhere('wood', save.resources.wood);
      } else if (this.resources.wood > 0) {
        this.inventory.addAnywhere('wood', this.resources.wood);
      }
      this.player.recompute();
    }

    this.renderer = new Renderer(this.canvas, this);
    this.hud = new HUD(this.uiRoot, this);
    this.pauseMenu = new PauseMenu(this.uiRoot, this);
    this.inventoryUI = new InventoryUI(this.uiRoot, this);
    this.portUI = new PortUI(this.uiRoot, this);
    this.mapUI = new MapUI(this.uiRoot, this);
    this.lootUI = new LootUI(this.uiRoot, this);
    this._applyPaint();

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

  /* ---- helpers shared across Part 2 systems ---------------------------- */

  /** Danger/reward tier grows with distance from the spawn point. */
  tierAt(x, y) {
    return Math.min(5, Math.floor(Math.hypot(x, y) / 2600));
  }

  /** True while a blocking dialog is up (loot, port, recruit...). */
  get uiBlocked() {
    return this.lootUI?.isOpen || this.portUI?.isOpen;
  }

  _applyPaint() {
    this.ship.paintTint = PAINTS.find((p) => p.id === this.shipState.paint)?.tint ?? null;
  }

  /** Keep the hull tint in sync with the chosen paint (cheap, per frame). */
  _syncPaint() {
    const tint = PAINTS.find((p) => p.id === this.shipState.paint)?.tint ?? null;
    if (tint !== this.ship.paintTint) this.ship.paintTint = tint;
  }

  /** Add rolled loot to the player with full feedback. */
  grantLoot(drops, x, y) {
    if (drops.gold > 0) {
      this.resources.coins += drops.gold;
      this.particles.spawnText(x, y - 12, `+${drops.gold} gold`, '#f2d98a');
    }
    const lost = [];
    drops.items.forEach((it, i) => {
      const left = this.inventory.addAnywhere(it.id, it.qty);
      const got = it.qty - left;
      const def = ITEMS[it.id];
      if (got > 0) {
        this.particles.spawnText(x, y - 22 - i * 9, `+${got > 1 ? got + ' ' : ''}${def.name}`, RARITY[def.rarity].color);
      }
      if (left > 0) lost.push(def.name);
    });
    if (lost.length) this.hud.toast(`No room for: ${lost.join(', ')}`, '#e05a4a');
    const best = bestRarity(drops);
    if (RARITY_ORDER.indexOf(best) >= 2) {
      this.hud.toast(`${RARITY[best].name} find!`, RARITY[best].color);
      this.events.emit('sfx', 'chest');
    } else {
      this.events.emit('sfx', drops.gold > 0 ? 'coin' : 'wood');
    }
    this.particles.burstCollect(x, y, '240,205,90', 10);
    this.events.emit('resources:changed', { ...this.resources });
    this.events.emit('quickbar:changed');
    this.events.emit('loot:granted', drops);
  }

  /** Show the loot popup; granting happens on Take All. */
  openLoot(title, drops, x, y) {
    this.lootUI.showLoot(title, drops, () => this.grantLoot(drops, this.ship.x, this.ship.y - 20));
  }

  offerRecruit(member, flavor) {
    this.lootUI.showRecruit(member, flavor, (yes) => {
      if (yes && !this.crew.recruit(member)) {
        this.hud.toast('Crew quarters are full!', '#e05a4a');
      }
    });
  }

  showMessage(title, body, footer) {
    this.lootUI.showMessage(title, body, footer);
  }

  /** Consume a usable item from anywhere in the inventory. */
  useItem(id) {
    const def = ITEMS[id];
    if (!def || this.inventory.totalCount(id) < 1) return false;
    if (def.heal) {
      if (this.player.health >= this.player.maxHealth) {
        this.hud.toast('Already at full health', '#e0b345');
        return false;
      }
      this.inventory.removeAnywhere(id, 1);
      this.player.heal(def.heal);
      this.particles.spawnText(this.ship.x, this.ship.y - 24, `+${def.heal} health`, '#6fce62');
      this.events.emit('sfx', 'buy');
    } else if (def.repair) {
      if (this.shipState.hull >= this.shipState.maxHull) {
        this.hud.toast('The hull is sound', '#e0b345');
        return false;
      }
      this.inventory.removeAnywhere(id, 1);
      this.shipState.repair(def.repair);
      this.particles.spawnText(this.ship.x, this.ship.y - 24, `+${def.repair} hull`, '#c9a06a');
      this.events.emit('sfx', 'repair');
    } else if (def.use === 'map') {
      this.inventory.removeAnywhere(id, 1);
      const tr = this.encounters.chartTreasure();
      this.hud.toast('Treasure charted! An X marks your map.', '#f0a83c');
      this.events.emit('sfx', 'quest');
      this.mapUI.open?.();
      return true;
    } else if (def.use === 'message') {
      this.inventory.removeAnywhere(id, 1);
      this.encounters._openBottle(mulberry32((Math.random() * 0xffffffff) >>> 0));
    } else {
      return false;
    }
    this.events.emit('quickbar:changed');
    return true;
  }

  useQuickbar(i) {
    const id = this.inventory.quickbar[i];
    if (id) this.useItem(id);
  }

  /* ---- boarding resolution ---------------------------------------------- */

  onBoardingWin(aiShip) {
    const rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    const luck = this.player.luck + this.crew.bonuses().luck;
    const drops = rollLoot(rng, aiShip.lootTable, luck + 2);
    drops.gold += 10 + aiShip.tier * 15; // the captain's purse
    this.player.addXp(20 + aiShip.tier * 12);
    this.combat.removeShip(aiShip.id);
    this.openLoot(`${aiShip.label} — Captured Hold`, drops, this.ship.x, this.ship.y);
    // Sometimes a prisoner rows out of the hold.
    if ((aiShip.type === 'pirate' || aiShip.type === 'navy') && Math.random() < 0.35) {
      const member = createCrewMember((Math.random() * 0xffffffff) >>> 0, 1 + aiShip.tier);
      setTimeout(() => this.offerRecruit(member, 'A freed prisoner offers to join you!'), 600);
    }
  }

  onBoardingLoss(aiShip) {
    const lost = Math.floor(this.resources.coins * 0.1);
    this.resources.coins -= lost;
    this.player.health = Math.max(1, Math.round(this.player.maxHealth * 0.3));
    this.events.emit('player:changed');
    this.events.emit('resources:changed', { ...this.resources });
    aiShip.fleeing = true;
    aiShip.hostileToPlayer = false;
    this.hud.toast(`Thrown back to your ship!${lost > 0 ? ` Lost ${lost} gold.` : ''}`, '#e05a4a');
  }

  /* ---- state -------------------------------------------------------- */

  togglePause() {
    // Escape first closes any open panel.
    for (const panel of [this.lootUI, this.portUI, this.mapUI, this.inventoryUI]) {
      if (panel?.isOpen) {
        panel.close();
        return;
      }
    }
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

    // Boarding combat freezes the outside world.
    if (this.boarding.active) {
      this.boarding.update(dt);
      this.audio.update(dt);
      this.input.endFrame();
      return;
    }

    this.dayNight.update(dt, this.events);
    this.weather.update(dt, this.events);

    const view = this.renderer.viewRect();
    this.world.ensure(view.x - 100, view.y - 100, view.w + 200, view.h + 200);

    this.ship.update(dt, this.uiBlocked ? { throttle: 0, steer: 0, headingTarget: null } : this.input, this.world, this);
    this.shipState.update(dt);
    for (const system of this.systems) system.update(dt);
    this.encounters.update(dt);
    this.quests.update(dt);
    this.particles.update(dt);
    this.camera.update(dt, this.ship);
    this.audio.update(dt);

    this._updateInteractions();
    this._updateDiscovery(dt);
    this._checkShipwreck();
    this._syncPaint();

    // Panel hotkeys.
    if (this.input.pressed('KeyI')) this.inventoryUI.toggle();
    if (this.input.pressed('KeyM')) this.mapUI.toggle();
    if (this.input.pressed('KeyC')) this.inventoryUI.isOpen ? this.inventoryUI.close() : this.inventoryUI.open('crew');
    for (let i = 0; i < 4; i++) {
      if (this.input.pressed(`Digit${i + 1}`)) this.useQuickbar(i);
    }

    this.input.endFrame();

    this._autosaveTimer -= dt;
    if (this._autosaveTimer <= 0) {
      this._autosaveTimer = AUTOSAVE_INTERVAL;
      this.save();
    }
  }

  _updateInteractions() {
    if (this.uiBlocked) {
      this.hud.hidePrompt();
      return;
    }
    const touch = 'ontouchstart' in window;
    const key = touch ? 'tap F' : 'F';
    const port = this.ports.findNearby();
    const boardTarget = port ? null : this.combat.boardingTarget();
    const enc = port || boardTarget ? null : this.encounters.findInteractable();

    if (port) this.hud.showPrompt(`${key} — Dock at ${port.name}`);
    else if (boardTarget) this.hud.showPrompt(`${key} — Board the ${boardTarget.label}`);
    else if (enc) this.hud.showPrompt(`${key} — ${this.encounters.promptFor(enc)}`);
    else this.hud.hidePrompt();

    if (this.input.pressed('KeyF')) {
      if (port) this.portUI.open(port);
      else if (boardTarget) this.boarding.start(boardTarget);
      else if (enc) this.encounters.interact(enc);
    }
  }

  _updateDiscovery(dt) {
    this._discoverTimer -= dt;
    if (this._discoverTimer > 0) return;
    this._discoverTimer = 1;
    const cx = this.world.chunkCoord(this.ship.x);
    const cy = this.world.chunkCoord(this.ship.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.mapData.explored.add(`${cx + dx},${cy + dy}`);
      }
    }
    // Discover islands & ports that come within sight.
    for (const chunk of this.world.chunks.values()) {
      if (chunk.island) {
        const isl = chunk.island;
        if (dist2(isl.x, isl.y, this.ship.x, this.ship.y) < 750 * 750) {
          const kkey = `${chunk.cx},${chunk.cy}`;
          if (!this.mapData.islands.some((i) => i.key === kkey)) {
            this.mapData.islands.push({ key: kkey, x: isl.x, y: isl.y, r: isl.r, biome: isl.biome });
          }
          if (chunk.port && !this.mapData.ports.some((p) => p.name === chunk.port.name)) {
            this.mapData.ports.push({ name: chunk.port.name, x: chunk.port.x, y: chunk.port.y, seed: chunk.port.seed });
            this.hud.toast(`Discovered ${chunk.port.name}!`, '#c8cdd2');
            this.events.emit('sfx', 'quest');
          }
        }
      }
    }
  }

  _checkShipwreck() {
    if (this.shipState.hull > 0) return;
    // Going down! Dramatic, costly, but not run-ending.
    const lost = Math.floor(this.resources.coins * 0.15);
    this.resources.coins -= lost;
    this.shipState.hull = Math.round(this.shipState.maxHull * 0.4);
    this.particles.burstSplash(this.ship.x, this.ship.y, 24);
    this.particles.burstSplinters(this.ship.x, this.ship.y, 16);
    this.camera.addShake(6);
    this.ship.speed = 0;
    this.ship.velX = 0;
    this.ship.velY = 0;
    this.events.emit('sfx', 'sink');
    this.events.emit('resources:changed', { ...this.resources });
    this.events.emit('playership:damaged', { hull: this.shipState.hull });
    this.hud.toast(`The crew barely kept her afloat!${lost > 0 ? ` Lost ${lost} gold.` : ''}`, '#e05a4a');
  }

  /* ---- persistence ------------------------------------------------------ */

  save() {
    if (!this.world) return;
    SaveManager.save({
      seed: this.seed,
      appearance: this.appearance,
      ship: this.ship.serialize(),
      resources: { coins: this.resources.coins, wood: 0 },
      time: this.dayNight.serialize(),
      weather: this.weather.serialize(),
      collected: [...this.world.collected],
      settings: this.settings,
      // Part 2
      player: this.player.serialize(),
      inventory: this.inventory.serialize(),
      crew: this.crew.serialize(),
      shipState: this.shipState.serialize(),
      quests: this.quests.serialize(),
      treasures: this.encounters.serialize(),
      portHired: this.portHired,
      mapData: {
        explored: [...this.mapData.explored],
        islands: this.mapData.islands,
        ports: this.mapData.ports,
        markers: this.mapData.markers,
      },
    });
  }
}
