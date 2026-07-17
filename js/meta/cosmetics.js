// Ship cosmetics: sails, flags, figureheads and lantern colors (hull
// paints ride on the Part 2 paint system in shipstate.js). Unlocked by
// shops, collection completion, achievements and prestige; purely
// visual. The Ship entity reads the equipped set each frame.

export const SAILS = {
  canvas:  { name: 'Plain Canvas', tint: null },
  crimson: { name: 'Crimson Sails', tint: 'rgba(142,47,47,0.45)', cost: 200 },
  night:   { name: 'Night Sails', tint: 'rgba(30,26,40,0.55)', cost: 200 },
  verdant: { name: 'Verdant Sails', tint: 'rgba(46,110,78,0.45)', cost: 200 },
  koi:     { name: 'Koi Sail', tint: 'rgba(240,240,240,0.2)', mark: '#c9506a' },
  wave:    { name: 'Wavecrest Sail', tint: 'rgba(58,110,180,0.4)', mark: '#e8f4ff' },
  gullwing: { name: 'Gullwing Sail', tint: 'rgba(140,150,160,0.35)', mark: '#eef2f4' },
  phoenix: { name: 'Phoenix Sail Pattern', tint: 'rgba(224,120,40,0.45)', mark: '#f2d98a' },
};

export const FLAGS = {
  black:   { name: 'Black Pennant', body: '#1e1a22', mark: '#e8e4da' },
  skull:   { name: 'Jolly Roger', body: '#14121a', mark: '#f4f4f4', cost: 150 },
  crimson: { name: 'Red Ensign', body: '#8e2f2f', mark: '#e8ddc4', cost: 150 },
  scourge: { name: 'Black Scourge Flag', body: '#0c0a12', mark: '#c9506a' },
  crew:    { name: 'Brotherhood Flag', body: '#2e2a3a', mark: '#e0b345' },
  atlas:   { name: 'Atlas Flag', body: '#1a3a52', mark: '#6fce62' },
  horizon: { name: 'Horizon Society Flag', body: '#0e3a30', mark: '#4ec9b0' },
  kraken:  { name: 'Kraken Flag', body: '#1a1030', mark: '#b46ef0' },
  legend:  { name: 'Flag of Legend', body: '#2a1a08', mark: '#f0a83c' },
};

export const FIGUREHEADS = {
  none:      { name: 'Bare Bow' },
  swan:      { name: 'Swan Figurehead', cost: 250 },
  skull:     { name: 'Skull Figurehead', cost: 250 },
  mermaid:   { name: 'Mermaid Figurehead' },
  dragon:    { name: 'Dragon Figurehead' },
  kraken:    { name: 'Kraken Figurehead' },
  leviathan: { name: 'Leviathan Figurehead' },
};

export const LANTERNS = {
  warm:    { name: 'Whale-oil Lantern', color: [255, 190, 96] },
  verdant: { name: 'Verdant Lantern', color: [120, 240, 150] },
  aurora:  { name: 'Aurora Lantern', color: [140, 200, 255] },
  ember:   { name: 'Ember Lantern', color: [255, 120, 70], cost: 180 },
};

export const UNLOCK_PAINTS = {
  gilded:   { id: 'gilded', name: 'Gilded Paint', tint: 'rgba(224,179,69,0.35)' },
  abyssal:  { id: 'abyssal', name: 'Abyssal Paint', tint: 'rgba(30,20,60,0.5)' },
  navywhite: { id: 'navywhite', name: 'Admiralty White', tint: 'rgba(240,240,235,0.4)' },
  gold:     { id: 'gold', name: 'Dragonhoard Gold', tint: 'rgba(255,200,60,0.45)' },
};

const KINDS = { sail: SAILS, flag: FLAGS, figurehead: FIGUREHEADS, lantern: LANTERNS };

export class Cosmetics {
  constructor(game, saved) {
    this.game = game;
    this.unlocked = new Set(saved?.unlocked ?? ['sail:canvas', 'flag:black', 'figurehead:none', 'lantern:warm']);
    this.equipped = {
      sail: 'canvas', flag: 'black', figurehead: 'none', lantern: 'warm',
      ...(saved?.equipped ?? {}),
    };
  }

  defs(kind) {
    return KINDS[kind];
  }

  isUnlocked(kind, id) {
    return this.unlocked.has(`${kind}:${id}`);
  }

  unlock(kind, id) {
    if (kind === 'paint') {
      // Paint unlocks flow into the Part 2 paint system.
      const p = UNLOCK_PAINTS[id];
      if (p && !this.game.shipState.paints.includes(id)) {
        this.game.shipState.paints.push(id);
      }
      return;
    }
    this.unlocked.add(`${kind}:${id}`);
    this.game.events.emit('cosmetics:changed');
  }

  equip(kind, id) {
    if (!this.isUnlocked(kind, id)) return false;
    this.equipped[kind] = id;
    this.game.events.emit('cosmetics:changed');
    this.game.events.emit('sfx', 'equip');
    return true;
  }

  serialize() {
    return { unlocked: [...this.unlocked], equipped: { ...this.equipped } };
  }
}
