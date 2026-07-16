# Sea of Rogues 🏴‍☠️

An infinite pixel-art pirate sailing adventure. Pure HTML, CSS and JavaScript —
no frameworks, no build step, no external assets. Every sprite, island and
sound is generated procedurally at runtime.

**Part 1** built the foundation: one customizable pirate, one small wooden
ship, and an endless mysterious ocean. **Part 2** populates that ocean:
encounters, loot and rarity, a full inventory, combat at sea and on deck,
crew, ports, contracts and a world map.

## Running

The game uses ES modules, so it needs to be served over HTTP (any static
server works):

```sh
npm start            # python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000>.

## Controls

| Action | Desktop | Mobile |
| ------ | ------- | ------ |
| Sail / steer | `WASD` or arrow keys | drag anywhere (virtual joystick) |
| Fire cannons | `Space` | ✕ button |
| Interact / dock / board | `F` | F button (appears in range) |
| Inventory / Crew / Ship | `I` (`C` jumps to Crew) | ⚔ button |
| World map | `M` | 🗺 button |
| Quick bar | `1`–`4` | tap slot |
| Boarding: move / attack | `WASD` + click (or `J`) | joystick + 🗡 |
| Boarding: pistol / musket / dodge | `K` / `L` / `Shift` | 🔫 / 💨 |
| Pause | `Esc` or `P` | pause button |

## What's in the foundation

- **Character creation** — hair, beard, skin, hat, coat, pants, boots,
  eye patch, hook, wooden leg, primary/secondary colors, randomize. The
  captain you create stands on your deck and is saved permanently.
- **Infinite deterministic world** — chunked procedural generation around
  the player; distant chunks unload; revisited places regenerate identically
  from the world seed. No borders, no loading screens.
- **Procedural islands** — five biomes (sand bar, palm, rock, jungle, coral),
  varied shapes and sizes, beaches, cliffs, ponds, palms, trees, ruins and
  cave mouths. Islands cluster into archipelagos separated by open sea.
- **A living ocean** — animated wave crests, drifting currents, shore foam,
  sun/moon glints, cloud shadows, seaweed, sea rocks and flotsam.
- **Ambient wildlife** — fish schools, seagulls, dolphins, sea turtles,
  whales and the occasional shark fin.
- **Sailing that feels good** — momentum, water drag, speed-dependent
  turning, hull rocking, bow spray and a foaming wake; smooth camera with
  look-ahead and speed-based zoom.
- **Day/night cycle** — sunrise, day, sunset, night and moonlight with
  dynamic lighting and a lantern glow after dark.
- **Weather** — sunny, cloudy, rain, storm (with lightning) and fog, blending
  gradually, driven by wind.
- **Minimal gameplay** — collect floating coins, wood, barrels, crates and
  treasure chests with magnet pickup, particles, floating numbers and sound.
- **Procedural audio** — ocean, wind, rain, gull cries, wood creaks, collect
  chimes, thunder, and a generative music box that changes between day and
  night. All synthesized with WebAudio.
- **Autosave** — appearance, ship position, world seed, resources, time,
  weather, collected items and settings persist in `localStorage`.
- **HUD** — compass, gold and wood counters, pause menu with volume and
  effects-quality settings.

## What Part 2 adds

- **World encounters** — shipwrecks (with clinging survivors), supply rafts,
  message bottles, locked sea chests, drifting castaways, island camps with
  campfires and hermits, debris fields — all deterministic per chunk and
  remembered once searched.
- **Loot & rarity** — 45+ items across resources, consumables, ammo, weapons,
  armor, trinkets, pets, ship parts, maps, keys, treasure fragments and
  valuables, in six rarity tiers (Common → Mythic) with colors and glow.
  Weighted loot tables per container; luck improves rare odds.
- **Inventory** — drag & drop between backpack, ship hold, nine equipment
  slots and a quick bar; stacking, sorting, rarity tooltips, double-click to
  equip/use. No weight.
- **Player progression** — health, attack, defense, crit, reload speed,
  movement, luck; XP and levels from fighting, rescuing and questing.
- **Ships of the world** — fishing boats, sloops, merchants, pirate raiders
  and navy patrols, with wander/flee/hunt AI. Danger and rewards scale with
  distance from the spawn.
- **Naval combat** — broadsides with real travel time, wood splinters,
  smoke, fire on burning hulls, dramatic sinking, loot bobbing on the water.
- **Boarding** — pull alongside and fight deck-to-deck in real time: sword
  arcs, pistols, muskets, dodge-dash, knockback, crits, and your crew
  fighting (and permanently dying) beside you. Win to empty their hold.
- **Crew** — rescue, free or hire pirates with names, faces, levels, weapons
  and traits (Fast Reload, Cook, Coward, Fearless...). They speed up your
  guns, boost the ship and brawl in boardings.
- **Ship management** — hull/sail health, repairs (kits, port, slow at-sea
  patching), six upgrade tracks (hull, cannons, sails, cargo, quarters,
  rudder) and hull paints.
- **Ports** — large islands grow named harbors with docks and houses:
  repair, general store, weapon merchant, black market, shipwright and
  tavern (hiring + contracts). Stock rotates daily.
- **Contracts** — procedural quests: cargo runs, pirate bounties, rescues,
  supply gathering, treasure recovery — tracked with a HUD guide arrow.
- **Sea chart** — fog-of-war world map with discovered islands, ports,
  objectives, charted treasure and custom markers (click to place).
- **Save v2** — everything above persists; Part 1 saves migrate seamlessly.

## Architecture

```
js/
├── main.js              entry point
├── core/                engine plumbing
│   ├── game.js          orchestrator, loop, state machine, system registry
│   ├── events.js        EventBus — the seam future systems plug into
│   ├── constants.js     all tuning values in one place
│   ├── input.js         keyboard + virtual joystick
│   ├── camera.js        smooth follow / look-ahead / zoom / shake
│   └── save.js          localStorage persistence
├── world/               simulation
│   ├── world.js         chunk manager + feature-generator registry
│   ├── island.js        deterministic island shapes, biomes, decor
│   ├── encounters.js    wrecks, rafts, survivors, camps, treasure
│   ├── ports.js         procedural harbors on large islands
│   ├── daynight.js      keyframed day/night color cycle
│   └── weather.js       blended weather state machine
├── entities/
│   ├── ship.js          player ship physics + drawing
│   ├── shipstate.js     hull/sails/cannons/upgrades/paint
│   ├── player.js        stats, XP, levels
│   ├── aiship.js        merchant/pirate/navy AI ships
│   ├── collectibles.js  floating loot, magnet pickup, rewards
│   └── wildlife.js      ambient animals
├── items/
│   ├── itemdefs.js      item catalogue, rarity, loot tables, icons
│   └── inventory.js     containers, equipment, quick bar
├── combat/
│   ├── shipcombat.js    broadsides, projectiles, sinking, drops
│   └── boarding.js      deck-to-deck real-time combat
├── crew/crew.js         crew members, traits, bonuses
├── quests/quests.js     procedural contracts
├── render/
│   ├── renderer.js      frame composition, backbuffer, lighting
│   ├── water.js         the animated ocean field
│   ├── sprites.js       procedural sprite factory
│   ├── pirate.js        layered captain sprite + appearance options
│   ├── decor.js         swaying island decorations
│   └── particles.js     particles + floating text
├── audio/audio.js       WebAudio soundscape + generative music
├── ui/                  DOM screens: creator, HUD, pause menu
└── util/                seeded random, value noise, math helpers
```

### Extension points

Part 2 (inventory, combat, ships, crew, ports, quests, map) plugged in
through exactly the seams Part 1 left — and the final expansion (bosses,
sea monsters, ghost ships, world events, fishing, building, skills,
achievements, statistics) is expected to do the same:

1. **`game.registerSystem(system)`** — anything with an `update(dt)` joins
   the simulation loop (wildlife and collectibles already work this way).
2. **`world.addFeatureGenerator(fn)`** — deterministic per-chunk content
   (islands, rocks, loot already work this way; shipwrecks, enemy camps or
   quest sites would be new generators).
3. **`game.events`** — gameplay events (`collect`, `ship:collide`,
   `weather:changed`, `daynight:phase`...) are broadcast on the EventBus, so
   achievements/statistics/quests can observe play without touching the
   emitting code. The save format is a single versioned JSON blob ready to
   grow new fields.

Rendering supports the same growth: the y-sorted surface layer accepts any
`{ y, draw(g) }` drawable, and sprites are cached procedural canvases —
adding an enemy ship reuses the whole pipeline.

## Performance notes

The world renders at 1/3 resolution to a backbuffer and upscales with
`image-rendering: pixelated` — crisp pixels and a ~640×360 fill cost, which
comfortably holds 60 FPS. Island terrain is rasterized once per chunk load
and cached; everything animated is cheap rectangles over that cache. The
pause menu offers a "Light" effects mode for weaker mobile GPUs.
