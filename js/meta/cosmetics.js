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
  // Filled in from the player's own clan the moment they found one; the
  // colours live on the clan record, not here.
  clan:    { name: 'Your Clan Colours', body: '#c9384a', mark: '#f4ecd8', ownClan: true },
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

/** Cannon barrels — the gun itself, seen at the ports and in the smoke. */
export const CANNONS = {
  iron:    { name: 'Iron Guns', barrel: '#4a5058', cost: 0 },
  brass:   { name: 'Brass Guns', barrel: '#b08a3a', cost: 260 },
  blacked: { name: 'Blacked Guns', barrel: '#22202a', cost: 260 },
  bone:    { name: 'Bone-Inlaid Guns', barrel: '#ddd6c2' },
  coral:   { name: 'Coral-Grown Guns', barrel: '#3fc2b0' },
};

/** What leaves the muzzle. Purely a look — damage is unchanged. */
export const CANNON_FX = {
  smoke:   { name: 'Powder Smoke', color: [220, 220, 220], cost: 0 },
  ember:   { name: 'Ember Burst', color: [255, 140, 60], cost: 300 },
  verdant: { name: 'Verdant Flash', color: [120, 240, 150], cost: 300 },
  arcane:  { name: 'Arcane Flare', color: [180, 120, 255] },
  gold:    { name: 'Gilded Blast', color: [255, 210, 90] },
  abyss:   { name: 'Abyssal Ink', color: [70, 60, 130] },
};

/** Patterns printed on the canvas, on top of whatever tint the sail has. */
export const SAIL_PATTERNS = {
  none:    { name: 'Unmarked', cost: 0 },
  stripes: { name: 'Broad Stripes', pattern: 'stripes', cost: 220 },
  chevron: { name: 'Chevrons', pattern: 'chevron', cost: 220 },
  cross:   { name: 'Crossed Bars', pattern: 'cross', cost: 220 },
  scales:  { name: 'Scalework', pattern: 'scales' },
  clan:    { name: 'Your Clan Mark', pattern: 'clan' },
};

/** Things bolted to the deck. Visible on the ship at sea. */
export const DECOR = {
  none:     { name: 'Clear Decks', cost: 0 },
  barrels:  { name: 'Lashed Barrels', cost: 140 },
  netting:  { name: 'Boarding Netting', cost: 140 },
  lanterns: { name: 'Rigging Lanterns', cost: 200 },
  skulls:   { name: 'Rail of Skulls', cost: 260 },
  garland:  { name: 'Kelp Garland' },
};

export const UNLOCK_PAINTS = {
  gilded:   { id: 'gilded', name: 'Gilded Paint', tint: 'rgba(224,179,69,0.35)' },
  abyssal:  { id: 'abyssal', name: 'Abyssal Paint', tint: 'rgba(30,20,60,0.5)' },
  navywhite: { id: 'navywhite', name: 'Admiralty White', tint: 'rgba(240,240,235,0.4)' },
  gold:     { id: 'gold', name: 'Dragonhoard Gold', tint: 'rgba(255,200,60,0.45)' },
};

const KINDS = {
  sail: SAILS, flag: FLAGS, figurehead: FIGUREHEADS, lantern: LANTERNS,
  cannon: CANNONS, cannonfx: CANNON_FX, pattern: SAIL_PATTERNS, decor: DECOR,
};

export class Cosmetics {
  constructor(game, saved) {
    this.game = game;
    this.unlocked = new Set(saved?.unlocked ?? []);
    // The plain option in every category is always available, so a fresh
    // captain can open the customization screen and see a full set rather
    // than a wall of locks.
    for (const base of ['sail:canvas', 'flag:black', 'figurehead:none', 'lantern:warm',
      'cannon:iron', 'cannonfx:smoke', 'pattern:none', 'decor:none']) {
      this.unlocked.add(base);
    }
    this.equipped = {
      sail: 'canvas', flag: 'black', figurehead: 'none', lantern: 'warm',
      cannon: 'iron', cannonfx: 'smoke', pattern: 'none', decor: 'none',
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
