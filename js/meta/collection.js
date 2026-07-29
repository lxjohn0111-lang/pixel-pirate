// The Captain's Collection Book. Ten categories of discoverables; every
// first sighting is recorded permanently, category completion unlocks
// ship cosmetics. Discovery happens via game.collection.discover() calls
// sprinkled through the systems (one line each) or EventBus listeners.

export const COLLECTION = {
  fish: {
    name: 'Fish',
    entries: {}, // filled from fishing.js FISH defs at boot
    reward: { kind: 'sail', id: 'koi', label: 'Koi Sail' },
  },
  treasures: {
    name: 'Treasures',
    entries: {
      goldNugget: 'Gold Nugget', spices: 'Exotic Spices', silverware: 'Fine Silverware',
      jewelBox: 'Jewel Box', ancientIdol: 'Ancient Idol', figurehead: 'Gilded Figurehead',
      spyglass: 'Fine Spyglass', treasureFragment: 'Treasure Fragment',
    },
    reward: { kind: 'paint', id: 'gilded', label: 'Gilded Paint' },
  },
  relics: {
    name: 'Relics',
    entries: {
      cursedSword: 'Cursed Sword', goldenCompass: 'Golden Compass', ghostCannon: 'Ghost Cannon',
      phoenixSail: 'Phoenix Sail', krakenHarpoon: 'Kraken Harpoon', royalArmor: 'Royal Armor',
      stormLantern: 'Storm Lantern', treasureLocator: 'Treasure Locator', kingsHat: 'Hat of the Pirate King',
      stormEye: 'Eye of the Storm', serpentScale: 'Serpent Scale', coralHeart: 'Living Coral Heart',
    },
    reward: { kind: 'flag', id: 'kraken', label: 'Kraken Flag' },
  },
  ships: {
    name: 'Ships',
    entries: {
      fishing: 'Fishing Boat', civilian: 'Sloop', merchant: 'Merchant Ship',
      pirate: 'Pirate Raider', navy: 'Navy Patrol', ghost: 'Ghost Ship',
      duchess: 'The Wailing Duchess', convoy: 'Merchant Convoy', treasureFleet: 'Treasure Fleet',
    },
    reward: { kind: 'figurehead', id: 'dragon', label: 'Dragon Figurehead' },
  },
  foes: {
    name: 'Foes',
    entries: {
      brawler: 'Deck Brawler', marksman: 'Marksman', skeleton: 'Restless Bones',
      cultist: 'Deep Cultist', guardian: 'Ancient Guardian', kraken: 'The Kraken',
      serpent: 'Sea Serpent',
    },
    reward: { kind: 'paint', id: 'abyssal', label: 'Abyssal Paint' },
  },
  animals: {
    name: 'Wildlife',
    entries: {
      fishschool: 'Fish School', gull: 'Seagull', dolphin: 'Dolphin', turtle: 'Sea Turtle',
      whale: 'Whale', shark: 'Shark', turtleIsland: 'The Wandering Isle',
    },
    reward: { kind: 'sail', id: 'gullwing', label: 'Gullwing Sail' },
  },
  plants: {
    name: 'Flora',
    entries: {
      palm: 'Palm Tree', tree: 'Jungle Canopy', shrub: 'Beach Shrub', seaweed: 'Seaweed',
      coral: 'Coral Bed', livingCoral: 'Living Coral',
    },
    reward: { kind: 'lantern', id: 'verdant', label: 'Verdant Lantern' },
  },
  crew: {
    name: 'Crew Traits',
    entries: {
      fastReload: 'Fast Reload', strong: 'Strong', lucky: 'Lucky', navigator: 'Navigator',
      cook: 'Cook', coward: 'Coward', fearless: 'Fearless', greedy: 'Greedy',
      eagleEye: 'Eagle Eye', surgeon: 'Surgeon',
    },
    reward: { kind: 'flag', id: 'crew', label: 'Brotherhood Flag' },
  },
  bosses: {
    name: 'Legends',
    entries: {
      kraken: 'The Kraken', serpent: 'The Sea Serpent', duchess: 'The Wailing Duchess',
      guardian: 'The Ancient Guardian', turtleIsland: 'The Wandering Isle', livingCoral: 'The Singing Reef',
    },
    reward: { kind: 'figurehead', id: 'leviathan', label: 'Leviathan Figurehead' },
  },
  locations: {
    name: 'Locations',
    entries: {
      'biome:sand': 'Sand Bar', 'biome:palm': 'Palm Island', 'biome:rock': 'Rock Island',
      'biome:jungle': 'Jungle Island', 'biome:coral': 'Coral Island',
      'dungeon:temple': 'Ancient Temple', 'dungeon:cave': 'Sea Cave', 'dungeon:volcano': 'Volcano Depths',
      'dungeon:ruins': 'Sunken Ruins', 'dungeon:hideout': 'Pirate Hideout',
      port: 'A Port of Call', homestead: 'A Place to Call Home',
    },
    reward: { kind: 'flag', id: 'horizon', label: 'Horizon Society Flag' },
  },
  named: {
    name: 'Great Ships',
    entries: {
      crimsonWidow: 'The Crimson Widow', seaGhost: 'Sea Ghost',
      goldenFortune: 'Golden Fortune', ironLeviathan: 'Iron Leviathan',
      blackTempest: 'Black Tempest',
    },
    reward: { kind: 'figurehead', id: 'leviathan', label: 'Leviathan Figurehead' },
  },
  clans: {
    name: 'Clan Colours',
    entries: {
      crimson: 'The Crimson Tide', ashen: 'Ashen Company',
      goldwake: 'The Goldwake Consortium', nightglass: 'Nightglass Covenant',
      tideborn: 'The Tideborn', saltborn: 'Saltborn Free Company',
    },
    reward: { kind: 'flag', id: 'crew', label: 'Brotherhood Flag' },
  },
};

export class Collection {
  constructor(game, saved) {
    this.game = game;
    this.found = new Set(saved?.found ?? []);
    this.rewarded = new Set(saved?.rewarded ?? []);

    const ev = game.events;
    ev.on('ship:sunk', (e) => this.discover('ships', e.type));
    ev.on('crew:changed', () => {
      for (const m of game.crew.members) {
        for (const t of m.traits) this.discover('crew', t);
      }
    });
    ev.on('loot:granted', (drops) => {
      for (const it of drops.items) {
        if (COLLECTION.treasures.entries[it.id]) this.discover('treasures', it.id);
        if (COLLECTION.relics.entries[it.id]) this.discover('relics', it.id);
        if (COLLECTION.fish.entries[it.id]) this.discover('fish', it.id);
      }
    });
  }

  discover(category, id) {
    const cat = COLLECTION[category];
    if (!cat || !cat.entries[id]) return false;
    const key = `${category}:${id}`;
    if (this.found.has(key)) return false;
    this.found.add(key);
    this.game.hud.toast(`Collection: ${cat.entries[id]} recorded!`, '#4ec9b0');
    this.game.events.emit('sfx', 'quest');
    this.game.events.emit('collection:discovered', { category, id });
    this._checkReward(category);
    return true;
  }

  has(category, id) {
    return this.found.has(`${category}:${id}`);
  }

  progress(category) {
    const cat = COLLECTION[category];
    const total = Object.keys(cat.entries).length;
    let n = 0;
    for (const id of Object.keys(cat.entries)) {
      if (this.found.has(`${category}:${id}`)) n++;
    }
    return { n, total };
  }

  get completionPercent() {
    let n = 0;
    let total = 0;
    for (const c of Object.keys(COLLECTION)) {
      const p = this.progress(c);
      n += p.n;
      total += p.total;
    }
    return total ? Math.round((n / total) * 100) : 0;
  }

  _checkReward(category) {
    const cat = COLLECTION[category];
    const p = this.progress(category);
    if (p.n >= p.total && !this.rewarded.has(category)) {
      this.rewarded.add(category);
      this.game.cosmetics.unlock(cat.reward.kind, cat.reward.id);
      this.game.hud.toast(`${cat.name} complete! Unlocked: ${cat.reward.label}`, '#f0a83c');
      this.game.events.emit('sfx', 'victory');
    }
  }

  serialize() {
    return { found: [...this.found], rewarded: [...this.rewarded] };
  }
}
