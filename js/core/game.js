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
// Part 3
import { Factions } from '../world/factions.js';
import { Stats } from '../meta/stats.js';
import { Collection } from '../meta/collection.js';
import { Achievements } from '../meta/achievements.js';
import { Daily } from '../meta/daily.js';
import { Cosmetics, SAILS, FLAGS, FIGUREHEADS, LANTERNS } from '../meta/cosmetics.js';
import { WorldEvents } from '../world/events.js';
import { Legends } from '../world/legends.js';
import { Dungeon } from '../world/dungeons.js';
import { Fishing } from '../systems/fishing.js';
import { TreasureHunts } from '../systems/treasurehunt.js';
import { Homestead } from '../world/homestead.js';
import { LogUI } from '../ui/logUI.js';
import { HomeUI } from '../ui/homeUI.js';
import { AdManager } from '../ads/ads.js';

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
    this.ads = new AdManager(this);

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

    // ---- Part 3: the living, remembering world ---------------------------
    this.prestige = save?.prestige ?? 0;
    this.factions = new Factions(this, save?.factions);
    this.stats = new Stats(this, save?.stats);
    this.cosmetics = new Cosmetics(this, save?.cosmetics);
    this.cosmeticsDefs = { SAILS, FLAGS, FIGUREHEADS, LANTERNS };
    this.collection = new Collection(this, save?.collection);
    this.achievements = new Achievements(this, save?.achievements);
    this.daily = new Daily(this, save?.daily);
    this.homestead = new Homestead(this, save?.homestead);
    this.worldEvents = this.registerSystem(new WorldEvents(this));
    this.legends = this.registerSystem(new Legends(this, save?.legends));
    this.dungeon = new Dungeon(this);
    this.fishing = this.registerSystem(new Fishing(this));
    this.treasureHunts = new TreasureHunts(this, save?.treasureHunts);
    if (this.prestige > 0) this.cosmetics.unlock('flag', 'legend');

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
    this.logUI = new LogUI(this.uiRoot, this);
    this.homeUI = new HomeUI(this.uiRoot, this);
    this._applyPaint();

    // Rewarded ads. Initialization is async and entirely optional — the
    // game is fully playable before (and without) it ever resolving.
    this.ads.init().then(() => this.ads.setGameplayActive(this.state === 'playing'));
    // A real milestone deserves the site's confetti.
    this.events.on('boss:defeated', () => this.ads.happytime());

    // Give returning captains their fishing rod; the sea provides.
    if (this.inventory.totalCount('fishingRod') === 0) {
      this.inventory.addAnywhere('fishingRod', 1);
    }

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
    this.ads.setGameplayActive(true);
    requestAnimationFrame((ts) => this._frame(ts));
  }

  /* ---- helpers shared across Part 2 systems ---------------------------- */

  /** Danger/reward tier grows with distance from the spawn point. */
  tierAt(x, y) {
    return Math.min(5, Math.floor(Math.hypot(x, y) / 2600));
  }

  /** True while a blocking dialog is up (loot, port, recruit, ad...). */
  get uiBlocked() {
    return this.lootUI?.isOpen || this.portUI?.isOpen || this.homeUI?.isOpen
      || this.ads?.isOpen;
  }

  /** Where the equipped relic points (Golden Compass / Treasure Locator). */
  relicTarget() {
    const relic = this.inventory?.equipment?.relic;
    if (relic === 'goldenCompass') {
      let best = null;
      let bestD = 900 * 900;
      this.world.forEachChunkIn(this.ship.x - 900, this.ship.y - 900, 1800, 1800, (chunk) => {
        for (const e of chunk.encounters ?? []) {
          if (e.searched) continue;
          const d = dist2(e.x, e.y, this.ship.x, this.ship.y);
          if (d < bestD && d > 90 * 90) {
            bestD = d;
            best = e;
          }
        }
      });
      return best;
    }
    if (relic === 'treasureLocator') {
      let best = null;
      let bestD = 700 * 700;
      for (const d of this.combat.drops) {
        const dd = dist2(d.x, d.y, this.ship.x, this.ship.y);
        if (dd < bestD) {
          bestD = dd;
          best = d;
        }
      }
      for (const tr of this.encounters.treasures) {
        const dd = dist2(tr.x, tr.y, this.ship.x, this.ship.y);
        if (dd < bestD) {
          bestD = dd;
          best = tr;
        }
      }
      return best;
    }
    return null;
  }

  /** Retire into Legend: the prestige loop. */
  doPrestige() {
    if (this.player.level < 20) return false;
    this.prestige++;
    this.player.level = 1;
    this.player.xp = 0;
    this.player.recompute();
    this.player.health = this.player.maxHealth;
    this.cosmetics.unlock('flag', 'legend');
    this.events.emit('player:changed');
    this.events.emit('sfx', 'victory');
    this.hud.toast(`You retire into Legend — rank ${this.prestige}. The sea remembers.`, '#f0a83c');
    this.save();
    return true;
  }

  _applyPaint() {
    this.ship.paintTint = PAINTS.find((p) => p.id === this.shipState.paint)?.tint ?? null;
  }

  /** Keep hull paint and Part 3 cosmetics in sync (cheap, per frame). */
  _syncPaint() {
    const tint = PAINTS.find((p) => p.id === this.shipState.paint)?.tint ?? null;
    if (tint !== this.ship.paintTint) this.ship.paintTint = tint;
    const eq = this.cosmetics.equipped;
    const sail = SAILS[eq.sail];
    this.ship.sailStyle = sail && (sail.tint || sail.mark) ? { id: eq.sail, tint: sail.tint, mark: sail.mark } : null;
    const flag = FLAGS[eq.flag];
    this.ship.flagStyle = eq.flag !== 'black' && flag ? { id: eq.flag, body: flag.body, mark: flag.mark } : null;
    this.ship.figurehead = eq.figurehead;
    this.ship.lanternColor = LANTERNS[eq.lantern]?.color ?? null;
    const charm = this.inventory.equipment.charm;
    this.ship.petId = charm === 'parrot' || charm === 'monkey' ? charm : null;
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
  openLoot(title, drops, x, y, after) {
    const show = () => {
      // Doubling is offered only on hauls that are actually worth it,
      // so the button reads as a windfall instead of a nag.
      const worthDoubling = drops.gold >= 40
        || RARITY_ORDER.indexOf(bestRarity(drops)) >= 2;
      const canOffer = worthDoubling && this.ads.canOffer('doubleLoot');
      const opts = { after };
      if (canOffer) {
        opts.doubleAd = this.ads.button('doubleLoot', 'Double this haul', () => {
          drops.gold *= 2;
          for (const it of drops.items) it.qty *= 2;
          this.hud.toast('The hold is twice as heavy!', '#f0a83c');
          this.events.emit('sfx', 'chest');
          // Re-open showing the doubled contents, minus the used offer.
          this.lootUI.showLoot(title, drops,
            () => this.grantLoot(drops, this.ship.x, this.ship.y - 20), { after });
        });
      }
      this.lootUI.showLoot(title, drops,
        () => this.grantLoot(drops, this.ship.x, this.ship.y - 20), opts);
    };
    show();
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
    } else if (def.use === 'expedition') {
      if (!this.treasureHunts.begin()) return false;
      this.inventory.removeAnywhere(id, 1);
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
    // Sometimes a prisoner rows out of the hold.
    const prisoner = (aiShip.type === 'pirate' || aiShip.type === 'navy') && Math.random() < 0.35
      ? createCrewMember((Math.random() * 0xffffffff) >>> 0, 1 + aiShip.tier)
      : null;
    this.openLoot(`${aiShip.label} — Captured Hold`, drops, this.ship.x, this.ship.y, () => {
      // Won the deck, but you may still have bodies to account for.
      this._offerCrewRescue();
      if (prisoner) {
        setTimeout(() => this.offerRecruit(prisoner, 'A freed prisoner offers to join you!'), 600);
      }
    });
  }

  onBoardingLoss(aiShip) {
    aiShip.fleeing = true;
    aiShip.hostileToPlayer = false;
    const lost = Math.floor(this.resources.coins * 0.1);

    const takeTheLoss = () => {
      this.resources.coins -= lost;
      this.player.health = Math.max(1, Math.round(this.player.maxHealth * 0.3));
      this.events.emit('player:changed');
      this.events.emit('resources:changed', { ...this.resources });
      this.hud.toast(`Thrown back to your ship!${lost > 0 ? ` Lost ${lost} gold.` : ''}`, '#e05a4a');
      this._offerCrewRescue();
    };

    this.ads.offer({
      id: 'rally',
      icon: '⚔',
      title: 'Driven Back to the Rail',
      body: 'You are bleeding on your own deck and they are cutting your purse. One last shout could rally the crew and save your coin.',
      reward: `Full health${lost > 0 ? ` &middot; keep your ${lost} gold` : ''}`,
      declineLabel: 'Fall back',
      accept: () => {
        this.player.health = this.player.maxHealth;
        this.events.emit('player:changed');
        this.hud.toast('You stagger up, whole — and the purse is still yours.', '#6fce62');
        this.events.emit('sfx', 'victory');
        this._offerCrewRescue();
      },
      decline: takeTheLoss,
    });
  }

  /**
   * Crew die permanently in boardings and dungeons — the single most
   * painful loss in the game, and so the offer players most want.
   * Presented only after the fighting stops.
   */
  _offerCrewRescue() {
    const fallen = this.crew.fallen;
    if (!fallen.length) return;
    const names = fallen.map((m) => m.name).join(' and ');
    const plural = fallen.length > 1;
    this.ads.offer({
      id: 'saveCrew',
      icon: '✚',
      title: plural ? 'They Still Have a Pulse' : `${fallen[0].name} Still Has a Pulse`,
      body: plural
        ? `The surgeon works fast, but they won't last the hour without supplies. Fetch what the surgeon needs and ${names} sail with you again — otherwise the sea keeps them.`
        : `The surgeon works fast, but ${fallen[0].name} won't last the hour without supplies. Fetch what the surgeon needs and they sail with you again — otherwise the sea keeps them.`,
      reward: plural ? `Revive ${fallen.length} fallen crew` : `Revive ${fallen[0].name}`,
      declineLabel: 'Bury them at sea',
      accept: () => {
        const revived = this.crew.reviveFallen();
        this.hud.toast(`${revived.map((m) => m.name).join(', ')} pulled through!`, '#6fce62');
        this.events.emit('sfx', 'recruit');
      },
      decline: () => this.crew.clearFallen(),
    });
  }

  /* ---- state -------------------------------------------------------- */

  togglePause() {
    // An ad offer owns its own buttons: dismissing it any other way
    // would skip the decline path and hand out a free pass.
    if (this.ads?.isOpen) return;
    // Escape first closes any open panel.
    for (const panel of [this.lootUI, this.portUI, this.mapUI, this.inventoryUI, this.logUI, this.homeUI]) {
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
    this.ads.setGameplayActive(false);
    this.events.emit('game:pause');
    this.save();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.pauseMenu.hide();
    this.audio.ctx?.resume?.();
    this.ads.setGameplayActive(true);
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

    // Boarding combat / dungeon crawls freeze the outside world.
    if (this.boarding.active || this.dungeon.active) {
      (this.boarding.active ? this.boarding : this.dungeon).update(dt);
      this.audio.update(dt);
      this.stats.data.timePlayed += dt;
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
    this.treasureHunts.update();
    this.stats.update(dt);
    this.achievements.update(dt);
    this.daily.update();
    this.particles.update(dt);
    this.camera.update(dt, this.ship);
    this.audio.update(dt);

    // boss music kicks in when a legend is loose
    const wantMode = this.legends.activeBoss ? 'boss' : 'normal';
    if (this.audio.musicMode !== wantMode) this.audio.setMusicMode(wantMode);

    // prestige + daily modifiers feed player luck
    const bonusLuck = this.prestige + (this.daily.modifier.luck ?? 0);
    if (this.player.bonusLuck !== bonusLuck) {
      this.player.bonusLuck = bonusLuck;
      this.player.recompute();
    }

    // the Living Coral Heart knits flesh like the tide mends sand
    if (this.shipState.relic === 'coralHeart') {
      this._coralTimer = (this._coralTimer ?? 0) - dt;
      if (this._coralTimer <= 0 && this.player.health < this.player.maxHealth) {
        this._coralTimer = 4;
        this.player.heal(2);
      }
    }

    this._updateInteractions();
    this._updateDiscovery(dt);
    this._checkShipwreck();
    this._syncPaint();
    // Menus and modals are breaks, not gameplay.
    this.ads.setGameplayActive(!this.uiBlocked && !this.inventoryUI.isOpen
      && !this.mapUI.isOpen && !this.logUI.isOpen);

    // Panel hotkeys.
    if (this.input.pressed('KeyI')) this.inventoryUI.toggle();
    if (this.input.pressed('KeyM')) this.mapUI.toggle();
    if (this.input.pressed('KeyL')) this.logUI.toggle();
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
    const home = !port && this.homestead.isNear() ? this.homestead : null;
    const boardTarget = port || home ? null : this.combat.boardingTarget();
    const wonder = port || home || boardTarget ? null : this.legends.findInteractable();
    const enc = port || home || boardTarget || wonder ? null : this.encounters.findInteractable();

    if (port) this.hud.showPrompt(`${key} — Dock at ${port.name}`);
    else if (home) this.hud.showPrompt(`${key} — Step ashore at ${this.homestead.isle.name}`);
    else if (boardTarget) this.hud.showPrompt(`${key} — Board the ${boardTarget.label}`);
    else if (wonder) this.hud.showPrompt(`${key} — ${this.legends.promptFor(wonder)}`);
    else if (enc) this.hud.showPrompt(`${key} — ${this.encounters.promptFor(enc)}`);
    else this.hud.hidePrompt();

    if (this.input.pressed('KeyF')) {
      if (port) this.portUI.open(port);
      else if (home) this.homeUI.open();
      else if (boardTarget) this.boarding.start(boardTarget);
      else if (wonder) this.legends.interactWonder(wonder);
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
            this.collection.discover('locations', `biome:${isl.biome}`);
            if (isl.biome === 'coral') this.collection.discover('plants', 'coral');
          }
          if (chunk.port && !this.mapData.ports.some((p) => p.name === chunk.port.name)) {
            this.mapData.ports.push({ name: chunk.port.name, x: chunk.port.x, y: chunk.port.y, seed: chunk.port.seed });
            this.hud.toast(`Discovered ${chunk.port.name}!`, '#c8cdd2');
            this.events.emit('sfx', 'quest');
            this.collection.discover('locations', 'port');
          }
          // island flora enters the collection when seen up close
          if (dist2(isl.x, isl.y, this.ship.x, this.ship.y) < 400 * 400) {
            for (const d of isl.decor) {
              if (d.type === 'palm' || d.type === 'tree' || d.type === 'shrub') {
                this.collection.discover('plants', d.type);
              }
            }
          }
        }
      }
      if (chunk.seaweed?.length && dist2(chunk.x, chunk.y, this.ship.x, this.ship.y) < 500 * 500) {
        this.collection.discover('plants', 'seaweed');
      }
    }
    // wildlife sightings
    for (const a of this.wildlife.animals) {
      if (dist2(a.x, a.y, this.ship.x, this.ship.y) < 260 * 260) {
        this.collection.discover('animals', a.type === 'fish' ? 'fishschool' : a.type);
      }
    }
  }

  _checkShipwreck() {
    if (this.shipState.hull > 0) return;
    // Going down! Dramatic, costly, but not run-ending.
    this.particles.burstSplash(this.ship.x, this.ship.y, 24);
    this.particles.burstSplinters(this.ship.x, this.ship.y, 16);
    this.camera.addShake(6);
    this.ship.speed = 0;
    this.ship.velX = 0;
    this.ship.velY = 0;
    this.events.emit('sfx', 'sink');
    // Stop the loop re-firing while the offer is up.
    this.shipState.hull = Math.round(this.shipState.maxHull * 0.4);

    const lost = Math.floor(this.resources.coins * 0.15);
    const sink = () => {
      this.resources.coins -= lost;
      this.events.emit('resources:changed', { ...this.resources });
      this.events.emit('playership:damaged', { hull: this.shipState.hull });
      this.hud.toast(`The crew barely kept her afloat!${lost > 0 ? ` Lost ${lost} gold.` : ''}`, '#e05a4a');
    };

    this.ads.offer({
      id: 'saveShip',
      icon: '⚓',
      title: 'She\'s Going Down!',
      body: 'The pumps are losing. Rally every hand to the breach and you can still save her — and the gold in the hold.',
      reward: `Full hull repair${lost > 0 ? ` &middot; keep your ${lost} gold` : ''}`,
      declineLabel: 'Let her list',
      accept: () => {
        this.shipState.hull = this.shipState.maxHull;
        this.shipState.sailHp = this.shipState.maxSail;
        this.events.emit('playership:damaged', { hull: this.shipState.hull });
        this.hud.toast('The breach is patched — she sails on, whole!', '#6fce62');
        this.events.emit('sfx', 'repair');
      },
      decline: sink,
    });
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
      // Part 3
      prestige: this.prestige,
      factions: this.factions.serialize(),
      stats: this.stats.serialize(),
      collection: this.collection.serialize(),
      achievements: this.achievements.serialize(),
      daily: this.daily.serialize(),
      cosmetics: this.cosmetics.serialize(),
      homestead: this.homestead.serialize(),
      legends: this.legends.serialize(),
      treasureHunts: this.treasureHunts.serialize(),
      mapData: {
        explored: [...this.mapData.explored],
        islands: this.mapData.islands,
        ports: this.mapData.ports,
        markers: this.mapData.markers,
      },
    });
  }
}
