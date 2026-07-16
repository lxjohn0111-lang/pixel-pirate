# Sea of Rogues 🏴‍☠️

An infinite pixel-art pirate sailing adventure. Pure HTML, CSS and JavaScript —
no frameworks, no build step, no external assets. Every sprite, island and
sound is generated procedurally at runtime.

**This is Part 1: the foundation.** One customizable pirate, one small wooden
ship, and an endless mysterious ocean.

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
| Pause | `Esc` or `P` | pause button (top right) |

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
│   ├── daynight.js      keyframed day/night color cycle
│   └── weather.js       blended weather state machine
├── entities/
│   ├── ship.js          player ship physics + drawing
│   ├── collectibles.js  floating loot, magnet pickup, rewards
│   └── wildlife.js      ambient animals
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

### Extension points (for Part 2+)

Future systems — inventory, combat, enemy ships, crew, NPCs, trading,
crafting, ship upgrades, quests, sea monsters, fishing, building, skills,
bosses, events, achievements, statistics — are expected to plug in through
three seams that already exist and are already used by the current code:

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
