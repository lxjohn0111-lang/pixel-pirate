// Item catalogue, rarity system and loot tables.
//
// Every item in the game is defined here once: identity, rarity, stack
// size, gameplay stats, gold value and a procedurally drawn pixel icon.
// Loot tables reference item ids with weights; rollLoot() turns a table
// into concrete { id, qty } drops. New content (Part 3 bosses, events)
// only needs new entries here — no system code changes.

import { makeCanvas } from '../render/sprites.js';
import { shade } from '../render/pirate.js';

/* ------------------------------------------------------------------ */
/* Rarity                                                              */
/* ------------------------------------------------------------------ */

export const RARITY = {
  common:    { name: 'Common',    color: '#c8cdd2', glow: null,      mult: 1 },
  uncommon:  { name: 'Uncommon',  color: '#6fce62', glow: null,      mult: 1.6 },
  rare:      { name: 'Rare',      color: '#5aa5f0', glow: '#5aa5f0', mult: 2.8 },
  epic:      { name: 'Epic',      color: '#b46ef0', glow: '#b46ef0', mult: 5 },
  legendary: { name: 'Legendary', color: '#f0a83c', glow: '#f0a83c', mult: 9 },
  mythic:    { name: 'Mythic',    color: '#f05a78', glow: '#f05a78', mult: 16 },
};

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

/* ------------------------------------------------------------------ */
/* Item definitions                                                    */
/* ------------------------------------------------------------------ */
// type: resource | consumable | ammo | weapon | armor | trinket |
//       shippart | special | valuable
// slot (equippable): sword | pistol | musket | hat | coat | boots |
//       ring | necklace | charm
// stats: attack, defense, maxHealth, speed, reloadSpeed, critChance, luck

export const ITEMS = {
  /* -- resources ---------------------------------------------------- */
  wood:      { name: 'Wood',       type: 'resource', rarity: 'common',   stack: 99, value: 2,  desc: 'Sturdy planks. Repairs and upgrades.' },
  stone:     { name: 'Stone',      type: 'resource', rarity: 'common',   stack: 99, value: 3,  desc: 'Heavy ballast stone.' },
  iron:      { name: 'Iron',       type: 'resource', rarity: 'uncommon', stack: 99, value: 6,  desc: 'Cold iron ingot. Cannons love it.' },
  gunpowder: { name: 'Gunpowder',  type: 'resource', rarity: 'uncommon', stack: 99, value: 8,  desc: 'Keep away from the cook.' },
  cloth:     { name: 'Sailcloth',  type: 'resource', rarity: 'common',   stack: 99, value: 4,  desc: 'Patch for torn sails.' },

  /* -- consumables ---------------------------------------------------- */
  food:      { name: 'Rations',    type: 'consumable', rarity: 'common',   stack: 20, value: 5,  heal: 15, desc: 'Hardtack and salted fish. Heals 15.' },
  rum:       { name: 'Rum',        type: 'consumable', rarity: 'common',   stack: 20, value: 8,  heal: 30, desc: 'Liquid courage. Heals 30.' },
  fineRum:   { name: 'Aged Rum',   type: 'consumable', rarity: 'rare',     stack: 10, value: 30, heal: 75, desc: 'Smooth as a calm sea. Heals 75.' },
  repairKit: { name: 'Repair Kit', type: 'consumable', rarity: 'uncommon', stack: 10, value: 25, repair: 35, desc: 'Patches 35 hull on the spot.' },

  /* -- ammo ------------------------------------------------------------ */
  cannonball: { name: 'Cannonball', type: 'ammo', rarity: 'common', stack: 99, value: 3, desc: 'Round shot for the cannons.' },
  bullets:    { name: 'Shot & Powder', type: 'ammo', rarity: 'common', stack: 99, value: 2, desc: 'Ammunition for pistols and muskets.' },

  /* -- weapons ----------------------------------------------------------- */
  rustyCutlass:  { name: 'Rusty Cutlass',   type: 'weapon', slot: 'sword',  rarity: 'common',    value: 15,  stats: { attack: 3 },  desc: 'Seen better decades.' },
  cutlass:       { name: 'Cutlass',         type: 'weapon', slot: 'sword',  rarity: 'uncommon',  value: 45,  stats: { attack: 6 },  desc: 'A pirate’s honest blade.' },
  officerSaber:  { name: 'Officer’s Saber', type: 'weapon', slot: 'sword', rarity: 'rare',  value: 120, stats: { attack: 10, critChance: 5 }, desc: 'Taken from a navy captain.' },
  corsairBlade:  { name: 'Corsair Blade',   type: 'weapon', slot: 'sword',  rarity: 'epic',      value: 320, stats: { attack: 15, critChance: 8, speed: 1 }, desc: 'Light, cruel and quick.' },
  krakenFang:    { name: 'Kraken Fang',     type: 'weapon', slot: 'sword',  rarity: 'legendary', value: 800, stats: { attack: 22, critChance: 12 }, desc: 'Carved from something best forgotten.' },
  flintlock:     { name: 'Flintlock Pistol', type: 'weapon', slot: 'pistol', rarity: 'uncommon', value: 60,  stats: { attack: 8 },  desc: 'One loud argument-ender.' },
  duelPistol:    { name: 'Dueling Pistol',  type: 'weapon', slot: 'pistol', rarity: 'rare',      value: 150, stats: { attack: 13, reloadSpeed: 10 }, desc: 'Balanced for a steady hand.' },
  dragonPistol:  { name: 'Dragon Pistol',   type: 'weapon', slot: 'pistol', rarity: 'epic',      value: 380, stats: { attack: 19, reloadSpeed: 15 }, desc: 'Breathes fire at close range.' },
  musket:        { name: 'Musket',          type: 'weapon', slot: 'musket', rarity: 'uncommon',  value: 80,  stats: { attack: 14 }, desc: 'Slow, loud, decisive.' },
  longRifle:     { name: 'Long Rifle',      type: 'weapon', slot: 'musket', rarity: 'rare',      value: 200, stats: { attack: 22 }, desc: 'Reaches across the whole deck.' },
  seaSerpent:    { name: 'Sea Serpent',     type: 'weapon', slot: 'musket', rarity: 'legendary', value: 900, stats: { attack: 34, critChance: 6 }, desc: 'Etched with scales. Whisper-accurate.' },

  /* -- armor ---------------------------------------------------------------- */
  strawHat:     { name: 'Straw Hat',       type: 'armor', slot: 'hat',   rarity: 'common',    value: 10,  stats: { defense: 1 }, desc: 'Keeps the sun off.' },
  tricornHat:   { name: 'Tricorn Hat',     type: 'armor', slot: 'hat',   rarity: 'uncommon',  value: 40,  stats: { defense: 2, critChance: 3 }, desc: 'Proper pirate headwear.' },
  captainsHat:  { name: 'Captain’s Hat', type: 'armor', slot: 'hat', rarity: 'epic',     value: 300, stats: { defense: 4, critChance: 6, maxHealth: 10 }, desc: 'Commands respect on sight.' },
  sailorCoat:   { name: 'Sailor’s Coat', type: 'armor', slot: 'coat', rarity: 'common',  value: 20,  stats: { defense: 2 }, desc: 'Wool, salt and tar.' },
  leatherCoat:  { name: 'Leather Coat',    type: 'armor', slot: 'coat',  rarity: 'uncommon',  value: 60,  stats: { defense: 4, maxHealth: 5 }, desc: 'Turns a glancing blade.' },
  navalCoat:    { name: 'Naval Coat',      type: 'armor', slot: 'coat',  rarity: 'rare',      value: 160, stats: { defense: 7, maxHealth: 10 }, desc: 'Brass buttons, battle-tested.' },
  stormCoat:    { name: 'Stormcaller Coat', type: 'armor', slot: 'coat', rarity: 'legendary', value: 850, stats: { defense: 12, maxHealth: 25, speed: 1 }, desc: 'The wind seems to favor its wearer.' },
  deckBoots:    { name: 'Deck Boots',      type: 'armor', slot: 'boots', rarity: 'common',    value: 15,  stats: { defense: 1, speed: 1 }, desc: 'Grip like barnacles.' },
  buccaneerBoots: { name: 'Buccaneer Boots', type: 'armor', slot: 'boots', rarity: 'rare',    value: 140, stats: { defense: 3, speed: 2 }, desc: 'Quiet on any deck.' },

  /* -- trinkets ------------------------------------------------------------- */
  copperRing:   { name: 'Copper Ring',     type: 'trinket', slot: 'ring',     rarity: 'common',    value: 12,  stats: { critChance: 2 }, desc: 'Green around the band.' },
  signetRing:   { name: 'Signet Ring',     type: 'trinket', slot: 'ring',     rarity: 'rare',      value: 180, stats: { critChance: 6, attack: 2 }, desc: 'Some noble misses this dearly.' },
  boneCharm:    { name: 'Bone Charm',      type: 'trinket', slot: 'charm',    rarity: 'uncommon',  value: 50,  stats: { luck: 3 }, desc: 'Rattles when storms come.' },
  parrot:       { name: 'Parrot',          type: 'trinket', slot: 'charm',    rarity: 'epic',      value: 400, stats: { luck: 8, critChance: 3 }, desc: 'Screams "TREASURE!" at random.' },
  monkey:       { name: 'Ship’s Monkey', type: 'trinket', slot: 'charm', rarity: 'rare',      value: 220, stats: { luck: 5, speed: 1 }, desc: 'Steals from your enemies. Mostly.' },
  pearlNecklace: { name: 'Pearl Necklace', type: 'trinket', slot: 'necklace', rarity: 'rare',      value: 200, stats: { maxHealth: 15 }, desc: 'Dived from deep reefs.' },
  sharkTooth:   { name: 'Shark Tooth',     type: 'trinket', slot: 'necklace', rarity: 'uncommon',  value: 55,  stats: { attack: 3 }, desc: 'From a fish that bit first.' },
  stormEye:     { name: 'Eye of the Storm', type: 'trinket', slot: 'necklace', rarity: 'mythic',   value: 2000, stats: { attack: 8, defense: 8, maxHealth: 30, luck: 10 }, desc: 'It watches back. It approves.' },

  /* -- ship parts -------------------------------------------------------------- */
  hullPlanks:   { name: 'Hull Planks',     type: 'shippart', rarity: 'uncommon', stack: 10, value: 20, desc: 'Shaped timber for shipwrights.' },
  cannonBarrel: { name: 'Cannon Barrel',   type: 'shippart', rarity: 'rare',     stack: 5,  value: 90, desc: 'The loud half of a cannon.' },
  silkSails:    { name: 'Silk Sails',      type: 'shippart', rarity: 'epic',     stack: 3,  value: 260, desc: 'Catch wind other sails miss.' },

  /* -- specials ------------------------------------------------------------------ */
  treasureMap:  { name: 'Treasure Map',    type: 'special', rarity: 'rare',      stack: 5, value: 40, use: 'map', desc: 'X marks the spot. Use to chart it.' },
  weatheredChart: { name: 'Weathered Chart', type: 'special', rarity: 'epic',    stack: 3, value: 120, use: 'expedition', desc: 'A trail of riddles to a grand hoard. Use to begin the expedition.' },
  message:      { name: 'Message Bottle',  type: 'special', rarity: 'uncommon',  stack: 5, value: 5,  use: 'message', desc: 'A sealed note. Use to read it.' },
  rustyKey:     { name: 'Rusty Key',       type: 'special', rarity: 'uncommon',  stack: 10, value: 15, desc: 'Opens locked chests found at sea.' },
  treasureFragment: { name: 'Treasure Fragment', type: 'special', rarity: 'epic', stack: 8, value: 120, desc: 'Part of something legendary. Collect them.' },

  /* -- legendary relics (Part 3) — each with a unique gameplay effect --- */
  cursedSword:  { name: 'Cursed Sword',   type: 'weapon', slot: 'sword', rarity: 'legendary', value: 1200, stats: { attack: 32, maxHealth: -20 }, desc: 'It whispers. It cuts. It takes.' },
  kingsHat:     { name: 'Hat of the Pirate King', type: 'armor', slot: 'hat', rarity: 'legendary', value: 1100, stats: { defense: 6, critChance: 10, maxHealth: 15, luck: 3 }, desc: 'Whoever wears it, rules the tale.' },
  royalArmor:   { name: 'Royal Armor',    type: 'armor', slot: 'coat', rarity: 'legendary', value: 1300, stats: { defense: 16, maxHealth: 35 }, desc: 'Gilded plate from the palace guard.' },
  krakenHarpoon: { name: 'Kraken Harpoon', type: 'weapon', slot: 'musket', rarity: 'mythic', value: 2400, stats: { attack: 45, critChance: 10 }, desc: 'Forged to pin gods to the seabed.' },
  goldenCompass: { name: 'Golden Compass', type: 'trinket', slot: 'relic', rarity: 'legendary', value: 1500, stats: { luck: 4 }, effect: 'compass', desc: 'Points toward whatever you have not found yet.' },
  ghostCannon:  { name: 'Ghost Cannon',   type: 'trinket', slot: 'relic', rarity: 'legendary', value: 1600, stats: {}, effect: 'ghostCannon', desc: 'A spectral gun crew mans an extra cannon per side.' },
  phoenixSail:  { name: 'Phoenix Sail',   type: 'trinket', slot: 'relic', rarity: 'legendary', value: 1600, stats: {}, effect: 'phoenixSail', desc: 'The ship sails 12% faster and her wounds close like embers rekindling.' },
  stormLantern: { name: 'Storm Lantern',  type: 'trinket', slot: 'relic', rarity: 'legendary', value: 1400, stats: {}, effect: 'stormLantern', desc: 'Burns brighter in the dark; foul weather fills your sails (+15% speed in rain).' },
  treasureLocator: { name: 'Treasure Locator', type: 'trinket', slot: 'relic', rarity: 'legendary', value: 1500, stats: { luck: 2 }, effect: 'locator', desc: 'A needle that trembles near unopened riches.' },
  serpentScale: { name: 'Serpent Scale',  type: 'trinket', slot: 'relic', rarity: 'legendary', value: 1300, stats: { defense: 6, speed: 2 }, desc: 'Still warm. Still watching.' },
  coralHeart:   { name: 'Living Coral Heart', type: 'trinket', slot: 'relic', rarity: 'legendary', value: 1400, stats: { maxHealth: 20 }, effect: 'regen', desc: 'It beats in time with the tide, and so do you.' },

  /* -- clan relics: taken from named ships, one per great captain ------- */
  widowsLocket: { name: "The Widow's Locket", type: 'trinket', slot: 'necklace', rarity: 'mythic', value: 2200, stats: { attack: 10, critChance: 8 }, desc: 'Still holds a portrait. Nobody living knows of whom.' },
  ghostlight:   { name: 'Ghostlight', type: 'trinket', slot: 'relic', rarity: 'mythic', value: 2300, stats: { luck: 5 }, effect: 'stormLantern', desc: 'A lamp that burns with no oil and casts no shadow.' },
  fortuneChain: { name: 'Chain of Fortune', type: 'trinket', slot: 'necklace', rarity: 'mythic', value: 2600, stats: { luck: 12, defense: 4 }, desc: 'Every link was a debt somebody else paid.' },
  leviathanPlate: { name: 'Leviathan Plate', type: 'armor', slot: 'coat', rarity: 'mythic', value: 2800, stats: { defense: 22, maxHealth: 40 }, desc: 'Hull plating from a ship that ate other ships.' },
  tempestCore:  { name: 'Heart of the Tempest', type: 'trinket', slot: 'relic', rarity: 'mythic', value: 3000, stats: { speed: 4 }, effect: 'phoenixSail', desc: 'The storm never ended. It was only bottled.' },

  /* -- fishing ------------------------------------------------------------- */
  fishingRod:  { name: 'Fishing Rod', type: 'special', rarity: 'common', value: 10, desc: 'Stop the ship and press R to cast.' },
  sardine:     { name: 'Sardine', type: 'fish', rarity: 'common', stack: 20, value: 3, heal: 8, desc: 'Small, silver, everywhere.' },
  mackerel:    { name: 'Mackerel', type: 'fish', rarity: 'common', stack: 20, value: 5, heal: 12, desc: 'Striped and dependable.' },
  grouper:     { name: 'Grouper', type: 'fish', rarity: 'uncommon', stack: 20, value: 9, heal: 18, desc: 'A grumpy reef bruiser.' },
  parrotfish:  { name: 'Parrotfish', type: 'fish', rarity: 'uncommon', stack: 20, value: 12, heal: 15, desc: 'Eats coral, gleams like one.' },
  tuna:        { name: 'Yellowfin Tuna', type: 'fish', rarity: 'rare', stack: 10, value: 25, heal: 30, desc: 'A torpedo with fins.' },
  swordfish:   { name: 'Swordfish', type: 'fish', rarity: 'rare', stack: 10, value: 32, heal: 35, desc: 'Duel it and lose.' },
  moonfish:    { name: 'Moonfish', type: 'fish', rarity: 'epic', stack: 5, value: 70, heal: 50, desc: 'Only rises when the moon does.' },
  stormkoi:    { name: 'Storm Koi', type: 'fish', rarity: 'epic', stack: 5, value: 85, heal: 55, desc: 'Swims up the rain, they say.' },
  midnightMarlin: { name: 'Midnight Marlin', type: 'fish', rarity: 'legendary', stack: 3, value: 240, heal: 100, desc: 'A shadow with a spear. Anglers dream of it.' },
  goldenKingfish: { name: 'Golden Kingfish', type: 'fish', rarity: 'mythic', stack: 1, value: 600, heal: 150, desc: 'The sea only ever mints a few of these.' },

  /* -- valuables (sell loot) -------------------------------------------------------- */
  goldNugget:   { name: 'Gold Nugget',     type: 'valuable', rarity: 'rare',      stack: 20, value: 60,  desc: 'Heavy, shiny, spendable.' },
  spices:       { name: 'Exotic Spices',   type: 'valuable', rarity: 'uncommon',  stack: 20, value: 25,  desc: 'Worth more than gold to the right buyer.' },
  silverware:   { name: 'Fine Silverware', type: 'valuable', rarity: 'uncommon',  stack: 20, value: 30,  desc: 'Engraved with someone else’s initials.' },
  jewelBox:     { name: 'Jewel Box',       type: 'valuable', rarity: 'epic',      stack: 5,  value: 250, desc: 'Someone’s life savings, portable.' },
  ancientIdol:  { name: 'Ancient Idol',    type: 'valuable', rarity: 'legendary', stack: 3,  value: 700, desc: 'Its smile predates every kingdom.' },
  figurehead:   { name: 'Gilded Figurehead', type: 'valuable', rarity: 'epic',    stack: 2,  value: 320, desc: 'A decoration for a grand cabin.' },
  spyglass:     { name: 'Fine Spyglass',   type: 'valuable', rarity: 'rare',      stack: 3,  value: 150, desc: 'Sees gulls three bays over.' },
};

for (const [id, def] of Object.entries(ITEMS)) {
  def.id = id;
  def.stack = def.stack ?? 1;
}

/* ------------------------------------------------------------------ */
/* Loot tables                                                         */
/* ------------------------------------------------------------------ */
// Entries: [itemId | 'gold', weight, minQty, maxQty]
// rolls: [min, max] number of picks. gold amounts scale with rarity mult.

export const LOOT_TABLES = {
  barrel: {
    rolls: [1, 2],
    entries: [
      ['gold', 20, 3, 10], ['wood', 25, 1, 3], ['food', 18, 1, 3], ['rum', 14, 1, 2],
      ['cloth', 8, 1, 2], ['bullets', 8, 4, 10], ['gunpowder', 5, 1, 2], ['message', 2, 1, 1],
    ],
  },
  crate: {
    rolls: [1, 2],
    entries: [
      ['gold', 15, 4, 12], ['wood', 22, 2, 4], ['stone', 12, 1, 3], ['iron', 10, 1, 2],
      ['cannonball', 12, 2, 6], ['cloth', 8, 1, 2], ['spices', 6, 1, 2], ['repairKit', 5, 1, 1],
      ['hullPlanks', 4, 1, 2], ['silverware', 4, 1, 1],
    ],
  },
  chest: {
    rolls: [2, 3],
    entries: [
      ['gold', 24, 15, 45], ['goldNugget', 8, 1, 2], ['spices', 8, 1, 2], ['silverware', 8, 1, 2],
      ['rustyKey', 6, 1, 1], ['treasureMap', 5, 1, 1], ['copperRing', 5, 1, 1],
      ['boneCharm', 4, 1, 1], ['sharkTooth', 4, 1, 1], ['cutlass', 4, 1, 1],
      ['flintlock', 3, 1, 1], ['tricornHat', 3, 1, 1], ['leatherCoat', 3, 1, 1],
      ['jewelBox', 2, 1, 1], ['spyglass', 2, 1, 1], ['treasureFragment', 1.5, 1, 1],
      ['officerSaber', 1.2, 1, 1], ['pearlNecklace', 1.2, 1, 1], ['duelPistol', 1, 1, 1],
      ['captainsHat', 0.5, 1, 1], ['parrot', 0.4, 1, 1], ['ancientIdol', 0.3, 1, 1],
    ],
  },
  lockedChest: { // needs rustyKey — better odds
    rolls: [3, 4],
    entries: [
      ['gold', 18, 40, 90], ['goldNugget', 10, 1, 3], ['jewelBox', 8, 1, 1],
      ['treasureFragment', 7, 1, 2], ['treasureMap', 6, 1, 1],
      ['officerSaber', 5, 1, 1], ['duelPistol', 5, 1, 1], ['navalCoat', 5, 1, 1],
      ['buccaneerBoots', 4, 1, 1], ['signetRing', 4, 1, 1], ['pearlNecklace', 4, 1, 1],
      ['weatheredChart', 3, 1, 1],
      ['corsairBlade', 2.5, 1, 1], ['dragonPistol', 2, 1, 1], ['longRifle', 2, 1, 1],
      ['captainsHat', 2, 1, 1], ['monkey', 1.5, 1, 1], ['ancientIdol', 1.5, 1, 1],
      ['silkSails', 1.2, 1, 1], ['krakenFang', 0.7, 1, 1], ['stormCoat', 0.6, 1, 1],
      ['seaSerpent', 0.5, 1, 1], ['parrot', 1, 1, 1], ['figurehead', 1.5, 1, 1],
      ['stormEye', 0.15, 1, 1],
    ],
  },
  wreck: {
    rolls: [2, 4],
    entries: [
      ['gold', 16, 8, 25], ['wood', 20, 2, 6], ['iron', 10, 1, 3], ['cannonball', 10, 2, 8],
      ['cloth', 8, 1, 3], ['repairKit', 7, 1, 1], ['hullPlanks', 6, 1, 2],
      ['rum', 6, 1, 2], ['message', 4, 1, 1], ['spyglass', 3, 1, 1],
      ['cannonBarrel', 2.5, 1, 1], ['treasureMap', 2.5, 1, 1], ['silverware', 4, 1, 1],
      ['figurehead', 1, 1, 1],
    ],
  },
  raft: {
    rolls: [1, 2],
    entries: [
      ['food', 22, 1, 3], ['rum', 16, 1, 2], ['wood', 18, 1, 3], ['cloth', 10, 1, 2],
      ['gold', 14, 3, 12], ['bullets', 8, 3, 8], ['message', 4, 1, 1], ['fineRum', 3, 1, 1],
    ],
  },
  camp: {
    rolls: [2, 3],
    entries: [
      ['gold', 18, 6, 20], ['food', 14, 1, 3], ['rum', 10, 1, 2], ['bullets', 10, 3, 8],
      ['gunpowder', 8, 1, 3], ['boneCharm', 5, 1, 1], ['rustyCutlass', 6, 1, 1],
      ['strawHat', 5, 1, 1], ['treasureMap', 4, 1, 1], ['sharkTooth', 4, 1, 1],
      ['flintlock', 3, 1, 1], ['spices', 4, 1, 2], ['rustyKey', 3, 1, 1],
    ],
  },
  merchantShip: {
    rolls: [3, 4],
    entries: [
      ['gold', 20, 20, 60], ['spices', 14, 1, 3], ['silverware', 10, 1, 2], ['cloth', 10, 2, 4],
      ['food', 10, 2, 4], ['rum', 8, 1, 3], ['jewelBox', 4, 1, 1], ['iron', 8, 1, 3],
      ['fineRum', 4, 1, 2], ['goldNugget', 5, 1, 2], ['silkSails', 1.5, 1, 1],
      ['figurehead', 2, 1, 1], ['spyglass', 3, 1, 1],
    ],
  },
  pirateShip: {
    rolls: [3, 4],
    entries: [
      ['gold', 20, 15, 50], ['cannonball', 12, 3, 8], ['gunpowder', 10, 2, 4], ['bullets', 10, 4, 10],
      ['rum', 10, 1, 3], ['cutlass', 6, 1, 1], ['flintlock', 5, 1, 1], ['rustyKey', 5, 1, 1],
      ['treasureMap', 4, 1, 1], ['tricornHat', 4, 1, 1], ['leatherCoat', 3, 1, 1],
      ['musket', 3, 1, 1], ['goldNugget', 4, 1, 2], ['treasureFragment', 2, 1, 1],
      ['officerSaber', 1.5, 1, 1], ['duelPistol', 1.2, 1, 1],
    ],
  },
  navyShip: {
    rolls: [3, 4],
    entries: [
      ['gold', 18, 25, 70], ['cannonball', 14, 4, 10], ['iron', 10, 2, 4], ['bullets', 10, 4, 10],
      ['repairKit', 8, 1, 2], ['musket', 5, 1, 1], ['officerSaber', 4, 1, 1],
      ['navalCoat', 3.5, 1, 1], ['longRifle', 2.5, 1, 1], ['cannonBarrel', 3, 1, 1],
      ['signetRing', 2, 1, 1], ['captainsHat', 1.2, 1, 1], ['hullPlanks', 6, 1, 2],
    ],
  },
  fishingBoat: {
    rolls: [1, 2],
    entries: [
      ['food', 30, 2, 5], ['gold', 16, 4, 12], ['wood', 14, 1, 3], ['cloth', 10, 1, 2],
      ['pearlNecklace', 2, 1, 1], ['sharkTooth', 4, 1, 1], ['message', 4, 1, 1],
    ],
  },
  treasure: { // dug-up / charted legendary treasure
    rolls: [4, 5],
    entries: [
      ['gold', 16, 60, 150], ['goldNugget', 10, 2, 4], ['jewelBox', 8, 1, 2],
      ['treasureFragment', 8, 1, 2], ['ancientIdol', 5, 1, 1], ['signetRing', 5, 1, 1],
      ['corsairBlade', 3, 1, 1], ['dragonPistol', 2.5, 1, 1], ['captainsHat', 3, 1, 1],
      ['krakenFang', 1.5, 1, 1], ['stormCoat', 1.2, 1, 1], ['seaSerpent', 1, 1, 1],
      ['parrot', 2, 1, 1], ['stormEye', 0.4, 1, 1], ['silkSails', 2, 1, 1],
    ],
  },
};

/**
 * Roll a loot table into drops. luck (0..~10) slightly boosts the odds of
 * high-rarity entries. Returns { gold, items: [{id, qty}] }.
 */
export function rollLoot(rng, tableName, luck = 0) {
  const table = LOOT_TABLES[tableName];
  const result = { gold: 0, items: [] };
  if (!table) return result;
  const n = table.rolls[0] + Math.floor(rng() * (table.rolls[1] - table.rolls[0] + 1));
  for (let i = 0; i < n; i++) {
    let total = 0;
    const weights = table.entries.map(([id, w]) => {
      const def = ITEMS[id];
      const rareBoost = def && RARITY[def.rarity].mult >= 2.8 ? 1 + luck * 0.04 : 1;
      const weight = w * rareBoost;
      total += weight;
      return weight;
    });
    let r = rng() * total;
    let picked = table.entries[0];
    for (let e = 0; e < table.entries.length; e++) {
      r -= weights[e];
      if (r <= 0) {
        picked = table.entries[e];
        break;
      }
    }
    const [id, , minQ, maxQ] = picked;
    const qty = minQ + Math.floor(rng() * (maxQ - minQ + 1));
    if (id === 'gold') {
      result.gold += qty;
    } else {
      const existing = result.items.find((it) => it.id === id);
      if (existing) existing.qty += qty;
      else result.items.push({ id, qty });
    }
  }
  return result;
}

/** Best rarity present in a set of drops (for pickup fanfare scale). */
export function bestRarity(drops) {
  let best = 0;
  for (const it of drops.items) {
    const idx = RARITY_ORDER.indexOf(ITEMS[it.id].rarity);
    if (idx > best) best = idx;
  }
  return RARITY_ORDER[best];
}

/* ------------------------------------------------------------------ */
/* Item icons (procedural 12x12 pixel art, cached)                     */
/* ------------------------------------------------------------------ */

const iconCache = new Map();

export function itemIcon(id) {
  let c = iconCache.get(id);
  if (!c) {
    c = makeCanvas(12, 12);
    drawIcon(c.getContext('2d'), id);
    iconCache.set(id, c);
  }
  return c;
}

function drawIcon(g, id) {
  const p = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  const def = ITEMS[id];

  // fish: shared silhouette, scale color from rarity
  if (def?.type === 'fish') {
    const body = { common: '#8aa0b0', uncommon: '#6fb08a', rare: '#5a8ac0', epic: '#a07ac9', legendary: '#d9a441', mythic: '#e0708a' }[def.rarity];
    p(2, 5, 7, 3, body);
    p(3, 4, 5, 1, shade(body, 24));
    p(3, 8, 4, 1, shade(body, -24));
    p(9, 4, 2, 5, body); // tail
    p(3, 5, 1, 1, '#1e1a22'); // eye
    if (def.rarity === 'legendary' || def.rarity === 'mythic') {
      p(1, 3, 1, 1, '#fff2c8');
      p(10, 8, 1, 1, '#fff2c8');
    }
    return;
  }
  if (id === 'fishingRod') {
    p(1, 9, 2, 2, '#5a3a20');
    for (let i = 0; i < 7; i++) p(2 + i, 8 - i, 1, 1, '#8a5f38');
    p(9, 1, 1, 5, 'rgba(220,230,240,0.7)');
    p(9, 6, 1, 1, '#e0b345');
    return;
  }
  if (id === 'goldenCompass') {
    g.strokeStyle = '#e0b345';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(6, 6, 4.5, 0, Math.PI * 2);
    g.stroke();
    p(5, 3, 2, 4, '#c9506a');
    p(5, 6, 2, 3, '#e8e4da');
    return;
  }
  if (id === 'stormLantern') {
    p(4, 2, 4, 1, '#4a4a52');
    p(3, 3, 6, 6, '#4a4a52');
    p(4, 4, 4, 4, '#8cc8ff');
    p(5, 5, 2, 2, '#e8f4ff');
    p(4, 9, 4, 1, '#4a4a52');
    return;
  }
  if (id === 'ghostCannon') {
    p(2, 5, 7, 3, 'rgba(120,240,180,0.7)');
    p(8, 4, 3, 5, 'rgba(90,200,150,0.8)');
    p(3, 6, 4, 1, 'rgba(220,255,235,0.9)');
    return;
  }
  if (id === 'phoenixSail') {
    for (let y = 0; y < 8; y++) p(3, 2 + y, 6 - Math.floor(y / 3), 1, y < 3 ? '#f2d98a' : y < 6 ? '#f0a83c' : '#e05a3c');
    p(2, 2, 1, 8, '#5a3a20');
    return;
  }
  switch (def?.type) {
    case 'weapon':
      if (def.slot === 'sword') {
        const blade = { common: '#9aa0a6', uncommon: '#c8cdd2', rare: '#bcd6f0', epic: '#d0b4f0', legendary: '#f0d090', mythic: '#f0a0b4' }[def.rarity];
        p(7, 1, 2, 7, blade);
        p(8, 0, 1, 2, blade);
        p(5, 7, 5, 1, '#7a5a34');
        p(7, 8, 2, 3, '#4d3a28');
        break;
      }
      if (def.slot === 'pistol') {
        p(2, 4, 7, 2, '#6a7078');
        p(8, 3, 2, 2, '#6a7078');
        p(2, 6, 3, 4, '#7a5a34');
        p(6, 6, 1, 1, '#e0b345');
        break;
      }
      // musket
      p(1, 5, 10, 1, '#6a7078');
      p(0, 4, 3, 2, '#6a7078');
      p(7, 6, 4, 3, '#7a5a34');
      p(4, 6, 3, 1, '#7a5a34');
      break;
    case 'armor':
      if (def.slot === 'hat') {
        p(2, 6, 8, 2, '#3a2b1e');
        p(4, 3, 4, 4, '#4d3a28');
        p(4, 5, 4, 1, RARITY[def.rarity].color);
        break;
      }
      if (def.slot === 'coat') {
        p(3, 2, 6, 8, def.rarity === 'legendary' ? '#3a4e8e' : '#5a4632');
        p(3, 2, 1, 8, RARITY[def.rarity].color);
        p(8, 2, 1, 8, RARITY[def.rarity].color);
        p(5, 4, 2, 1, '#e0b345');
        break;
      }
      // boots
      p(3, 3, 2, 6, '#3a2b20');
      p(7, 3, 2, 6, '#3a2b20');
      p(2, 8, 3, 2, '#2c2118');
      p(6, 8, 3, 2, '#2c2118');
      break;
    case 'trinket':
      if (def.slot === 'ring') {
        g.strokeStyle = def.rarity === 'common' ? '#b5702a' : '#e0b345';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(6, 7, 3, 0, Math.PI * 2);
        g.stroke();
        p(5, 2, 2, 2, RARITY[def.rarity].color);
        break;
      }
      if (def.slot === 'necklace') {
        g.strokeStyle = '#c8ccd4';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(6, 4, 4, 0.3, Math.PI - 0.3);
        g.stroke();
        p(5, 7, 3, 3, RARITY[def.rarity].color);
        break;
      }
      // charm / pet
      if (id === 'parrot') {
        p(4, 2, 4, 6, '#c9506a');
        p(5, 1, 3, 2, '#c9506a');
        p(7, 2, 2, 1, '#e0b345');
        p(4, 7, 2, 3, '#2e6e4e');
        p(6, 3, 1, 1, '#1e1a22');
        break;
      }
      if (id === 'monkey') {
        p(4, 3, 5, 5, '#7a5a34');
        p(5, 4, 3, 3, '#c9a06a');
        p(3, 2, 2, 2, '#7a5a34');
        p(8, 2, 2, 2, '#7a5a34');
        p(9, 8, 2, 2, '#7a5a34');
        break;
      }
      p(4, 3, 4, 6, '#e8e4da');
      p(5, 2, 2, 2, RARITY[def.rarity].color);
      break;
    default:
      break;
  }
  // typed generic icons
  switch (id) {
    case 'wood':
      p(1, 3, 10, 3, '#8a5f38'); p(1, 7, 10, 3, '#6e4a2a'); p(9, 3, 2, 3, '#c9a06a');
      break;
    case 'stone':
      p(3, 4, 6, 5, '#7e8388'); p(4, 3, 4, 2, '#9aa0a6'); p(5, 6, 2, 1, '#5d6165');
      break;
    case 'iron':
      p(2, 5, 8, 4, '#8a9098'); p(3, 4, 6, 2, '#aab2ba'); p(4, 6, 4, 1, '#6a7078');
      break;
    case 'gunpowder':
      p(3, 3, 6, 7, '#4a4a52'); p(4, 2, 4, 2, '#2c2c33'); p(5, 5, 2, 2, '#26202a');
      break;
    case 'cloth':
      p(2, 3, 8, 6, '#e8ddc4'); p(2, 5, 8, 1, '#cec2a6'); p(2, 7, 8, 1, '#cec2a6');
      break;
    case 'food':
      p(3, 4, 6, 5, '#c9a06a'); p(4, 3, 4, 2, '#d9b98a'); p(5, 5, 2, 2, '#8a5f38');
      break;
    case 'rum':
    case 'fineRum':
      p(4, 3, 4, 7, id === 'rum' ? '#8a5c33' : '#a8422a'); p(5, 1, 2, 3, '#5a3a20'); p(5, 5, 2, 3, '#e0b345');
      break;
    case 'repairKit':
      p(2, 4, 8, 6, '#7a5a34'); p(3, 5, 6, 4, '#96703f'); p(5, 3, 2, 5, '#c8ccd4'); p(4, 6, 4, 1, '#c8ccd4');
      break;
    case 'cannonball':
      g.fillStyle = '#3a3a42';
      g.beginPath(); g.arc(6, 6, 4, 0, Math.PI * 2); g.fill();
      p(4, 4, 2, 2, '#6a7078');
      break;
    case 'bullets':
      p(3, 5, 2, 4, '#8a9098'); p(6, 4, 2, 5, '#8a9098'); p(9, 6, 2, 3, '#8a9098'); p(3, 4, 2, 1, '#e0b345'); p(6, 3, 2, 1, '#e0b345');
      break;
    case 'hullPlanks':
      p(1, 2, 10, 2, '#8a5f38'); p(1, 5, 10, 2, '#7a5230'); p(1, 8, 10, 2, '#8a5f38');
      break;
    case 'cannonBarrel':
      p(2, 4, 8, 4, '#4a4a52'); p(9, 3, 2, 6, '#3a3a42'); p(2, 5, 6, 1, '#6a7078');
      break;
    case 'silkSails':
      p(2, 2, 8, 8, '#f0e8d8'); p(2, 4, 8, 1, '#d8c8f0'); p(2, 7, 8, 1, '#d8c8f0');
      break;
    case 'treasureMap':
      p(2, 2, 8, 8, '#d9c9a0'); p(4, 4, 1, 1, '#8e2f2f'); p(7, 7, 2, 2, '#8e2f2f'); p(5, 5, 1, 1, '#5a4632'); p(6, 6, 1, 1, '#5a4632');
      break;
    case 'message':
      p(4, 2, 4, 8, 'rgba(150,200,220,0.8)'); p(5, 1, 2, 2, '#7a5a34'); p(5, 5, 2, 4, '#d9c9a0');
      break;
    case 'rustyKey':
      p(3, 3, 3, 3, '#a8781f'); p(4, 4, 1, 1, '#1e1a22'); p(6, 4, 5, 1, '#a8781f'); p(9, 5, 1, 2, '#a8781f');
      break;
    case 'treasureFragment':
      p(4, 3, 4, 2, '#f0d090'); p(3, 5, 6, 3, '#e0b345'); p(5, 8, 2, 1, '#a8781f'); p(5, 4, 1, 1, '#fff2c8');
      break;
    case 'goldNugget':
      p(3, 4, 6, 5, '#e0b345'); p(4, 3, 4, 2, '#f2d98a'); p(5, 6, 2, 2, '#a8781f');
      break;
    case 'spices':
      p(2, 5, 3, 5, '#b5502a'); p(5, 4, 3, 6, '#c9973f'); p(8, 5, 3, 5, '#5d7a2e');
      break;
    case 'silverware':
      p(3, 2, 1, 8, '#c8ccd4'); p(2, 2, 3, 2, '#c8ccd4'); p(7, 2, 2, 8, '#aab2ba'); p(6, 2, 4, 1, '#c8ccd4');
      break;
    case 'jewelBox':
      p(2, 4, 8, 6, '#5e3a7a'); p(2, 4, 8, 2, '#8e5aae'); p(5, 5, 2, 2, '#f05a78'); p(3, 7, 1, 1, '#5aa5f0'); p(8, 7, 1, 1, '#6fce62');
      break;
    case 'ancientIdol':
      p(4, 2, 4, 3, '#c9973f'); p(3, 5, 6, 5, '#a8781f'); p(5, 3, 1, 1, '#26202a'); p(7, 3, 1, 1, '#26202a'); p(5, 7, 3, 1, '#e0b345');
      break;
    case 'figurehead':
      p(4, 1, 4, 4, '#e0b345'); p(5, 5, 3, 5, '#c9973f'); p(3, 8, 2, 2, '#a8781f');
      break;
    case 'spyglass':
      p(1, 6, 4, 3, '#7a5a34'); p(5, 5, 4, 3, '#a8781f'); p(9, 4, 2, 3, '#c8ccd4');
      break;
    default:
      break;
  }
}
