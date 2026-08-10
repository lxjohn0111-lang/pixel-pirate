# Sea of Rogues 🏴‍☠️

An infinite pixel-art pirate sailing adventure. Pure HTML, CSS and JavaScript —
no frameworks, no build step, no external assets. Every sprite, island and
sound is generated procedurally at runtime.

**Part 1** built the foundation: one customizable pirate, one small wooden
ship, and an endless mysterious ocean. **Part 2** populated that ocean:
encounters, loot and rarity, a full inventory, combat at sea and on deck,
crew, ports, contracts and a world map. **Part 3 — the final expansion —**
turns it into a living sandbox: factions, world events, legendary bosses,
dungeons, fishing, expeditions, a private island, a collection book,
achievements, daily content and endless prestige.

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
| Fish (cast / hook) | `R`, then `R`/`F` on the bite | 🎣 button |
| Captain's Log (collection, achievements...) | `L` | 📖 button |
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

## What the final expansion adds

- **A living world** — ships sail with destinations, merchants form convoys,
  pirates raid shipping, the navy hunts raiders, and battles play out (and
  leave burning wrecks and floating cargo) whether or not you're there.
- **Factions & reputation** — standing that reacts to everything you sink,
  save and serve: prices shift, patrols turn hostile, raiders let kindred
  spirits pass. *(Superseded by Pirate Clans, below — the clan system took
  over this API, so everything built on it kept working.)*
- **World events** — rumor toasts point to merchant convoys, pirate
  ambushes, sea battles, treasure fleets, burning ships, naval blockades,
  haunted fog (with something inside), great storms and treasure rumors.
- **Legends** — the three-phase Kraken (destructible tentacles, ink clouds,
  a vulnerable head), the diving Sea Serpent, the Wailing Duchess (a ghost
  boss-ship that summons spectral escorts), plus two peaceful wonders: the
  Wandering Isle (an island that swims) and the Singing Reef. Boss health
  bars, boss music, exclusive relic drops. All heavily throttled — a
  sighting is a story.
- **Dungeons** — shoreline entrances lead into ancient temples, sea caves,
  volcano depths, sunken ruins and pirate hideouts: chained rooms, spike
  and lava traps, skeletons and cultists, an Ancient Guardian with a
  telegraphed slam, a treasure vault and hidden lore tablets. Cleared
  dungeons stay sealed forever.
- **Legendary relics** — 12 uniques with real effects: Ghost Cannon (+1 gun
  per side), Phoenix Sail (speed + self-repair), Storm Lantern (bright
  night, fast in storms), Golden Compass (points at the unfound), Treasure
  Locator, Cursed Sword, Kraken Harpoon, Royal Armor and more.
- **Ship customization** — hull paints, tinted and marked sails, flag
  designs, bow figureheads, colored lanterns, and your pet parrot or monkey
  on deck. Bought at port Outfitters or earned from collections,
  achievements and prestige; managed in the Locker.
- **A private island** — buy the deed in any port, then build a house
  (full rest), dock (free repairs), warehouse (+16 storage), treasure room
  (displays your six rarest finds), garden and pens (daily provisions),
  beacon bonfire and a statue of yourself.
- **Collection book** — ten categories (fish, treasures, relics, ships,
  foes, wildlife, flora, crew traits, legends, locations); every first
  sighting is recorded and each completed page unlocks a cosmetic.
- **Fishing** — cast, wait for the tug, hook it in the window; catches vary
  by biome, hour, weather and season, up to the Midnight Marlin and the
  mythic Golden Kingfish.
- **Expeditions** — Weathered Charts open multi-clue treasure hunts: riddles
  mark shrinking search areas on the chart until the hoard itself surfaces.
- **Achievements & statistics** — 26 achievements (several award cosmetics)
  over 20+ tracked lifetime statistics including cannon accuracy.
- **Daily content** — a shared daily quest, weekly challenge, rotating world
  modifier (Tailwinds, Pirate Moon, Ghost Tide...) and a free daily treasure
  chart, all seeded by the real-world date.
- **Endgame** — at level 20, retire into Legend: level resets, everything
  else stays, and each prestige rank grants permanent speed and luck plus
  the Flag of Legend. Repeat forever.
- **Polish** — boss and dungeon music modes, roars and slams, lantern-colored
  night glow, localized event fog, and auto-aim assist that includes
  legendary targets. Still 60 FPS.

## The story layer

The systems were all there, but nothing told you *why* to use them. "The
Gracechurch Debt" is a six-chapter campaign whose job is to be a tutorial
that never admits it is one: every chapter hands you an objective that can
only be finished by learning one system, and the next chapter opens the
moment you do.

| Chapter | Teaches |
| ------- | ------- |
| The Debt | Sailing, the compass heading, searching a wreck |
| Make Port | Docking, merchants, the tavern |
| Red Ketch | Ship combat and boarding |
| Beneath the Stone | Dungeons |
| Six Pieces | Treasure fragments from every source in the game |
| The Drowned Court | The finale, and what the debt actually was |

**Talking portraits.** Five characters are drawn as 64×64 pixel faces
(`js/render/portrait.js`) — procedurally, like everything else here, so
there are still no image assets. Each face is assembled from skin, jaw,
brows, eyes, nose, beard, mouth, scar, hair and headwear layers, and an
expression table drives brow height, brow tilt, eyelid opening and mouth
shape. They blink on an irregular cycle and their mouths articulate while
text is typing, so a scene reads as somebody speaking rather than a text
box with a picture next to it. Each character also has a voice — pitch,
wobble and rate — driving the typing blips.

**The stage** (`js/story/dialogue.js`) is a ship's-log page pinned to the
lower third with a carved portrait frame and a brass nameplate straddling
its edge. Scenes are arrays of beats: a spoken line, a branch with choices,
or a chapter title card. During a scene the world freezes — but the sea
does not: waves, gulls and light keep moving behind the portrait, so
nothing can sail into you mid-sentence and nothing looks paused.

**Barks.** One-line hints from your first mate play *over* live gameplay in
a small framed portrait at the edge of the screen — they never take control.
Freezing the world to tell someone their hull is leaking is how a hint turns
into an interruption. Barks are contextual and fire once each: low hull,
first crew member, nightfall, heavy weather, rod in the hold, first leviathan.

## Ports, ships and bounties

**Docking stops the world.** Tying up at a quay sets `game.docked`, which
freezes the ship, every AI ship, the day/night clock and all combat — the
sea keeps animating, but nothing can drift, and nothing can shoot a ship
nobody is steering. Because you cannot sail while ashore there is no
reason to keep the water on screen, so the port takes the whole viewport
and **⚓ Set Sail** sits in the header at all times.

**The harbour square** is a hub of districts rather than a strip of tabs.
Each one carries a live status line, so the square doubles as a dashboard:

| District | What it holds |
| -------- | ------------- |
| Harbour Office | Careening, cargo sales, the deed to a private isle |
| Shipyard | The ship shop — buy and switch hulls |
| Shipwright | Upgrades and hull paint |
| Bounty Board | Wanted captains |
| The Tavern | Crew for hire, contracts, retirement into Legend |
| Market Row | General store, weapons, black market |
| Outfitter | Sails, flags, figureheads, lanterns |

Dockhands stroll the quay along the bottom, and a procedural panorama of
the town is drawn per port and lit by the current hour — docking at dusk
looks like dusk.

### The ship shop

Six hulls, from the starting **Sloop** to the **Man-o-War**
(`js/entities/ships.js`). Every hull is a base stat line; upgrade levels
stack on top, so a fully fitted sloop is still a sloop and trading up is
the only way past the ceiling. Upgrades move with you when you change
hulls.

Every hull is previewable, including locked ones — you can see exactly
what you are working toward and what it will take. Locks are things you
did, not just money: captain level, bounties claimed, a leviathan killed,
a prestige run. The shipyard draws each hull to a shared scale so the
list reads as a fleet, and puts its stats side by side against the ship
you are currently sailing, with gains and losses marked. Bigger hulls are
visibly bigger on the water, and buying one gets a full-screen moment
rather than a toast.

### Bounties

Every port board posts three wanted captains as pinned posters — portrait,
name, ship, skull rating, the crime, and the reward. Taking one starts a
hunt (`js/world/bounties.js`), and the target is a real ship with a real
position:

- It **keeps sailing whether or not you are watching.** Far away it is
  simulated; come within 780px and it materialises as a fightable ship,
  carrying whatever damage it already took.
- Your compass points at it and it shows on the world map as a moving
  skull — the only mark on that chart that does not stay put.
- **You can lose it.** The escape clock runs down, and another crew may
  claim the name first. One contract at a time, so the arrow on the
  compass always means exactly one thing.

The clock only runs while you are at sea; time is stopped in port.

## Pirate Clans

Clans are the spine everything else hangs off. Six of them hold the sea
between them (`js/world/clans.js`), and they took over the old faction
standing system rather than sitting beside it — the API other systems
already called is preserved exactly, so shops, spawners and quests kept
working while the meaning underneath became *which clan is this*.

| Clan | Leader | Home waters | Temperament |
| ---- | ------ | ----------- | ----------- |
| The Crimson Tide | Admiral Rosa Sanguine | The Bleeding Shoals | Aggressive |
| Ashen Company | Commodore Iyare Okonkwo | Greyharbour Reach | Disciplined |
| The Goldwake Consortium | Factor Mireille Vasque | The Bullion Run | Mercantile |
| Nightglass Covenant | The Whisper | The Drowned Lanterns | Secretive |
| The Tideborn | Mother Kelune | The Sunken Choir | Zealous |
| Saltborn Free Company | Captain Bram Halloway | The Open Reach | Independent |

**You can tell at a glance.** Every NPC ship belongs to a clan and shows
it three ways: a clan-coloured name plate with the clan's emblem above
the hull, and a clan-coloured pennant flying from the stern. Emblems,
flags, banners and badges are all drawn procedurally from one 16×16 glyph
vocabulary (`js/render/clanart.js`), so a clan looks like itself whether
you are reading a menu or squinting at a sail.

**Territory** is a coarse grid radiating from each clan's home waters,
resolved lazily and then remembered — the political map only materialises
where someone has actually sailed. Strong clans push their borders out.

**They fight without you.** Wars grind both sides' strength down, the
winner takes harbours off the loser, exhausted wars end, and new quarrels
and accords form on their own clock. Ships whose clans are at war go for
each other on sight regardless of what they are carrying. The Clans tab
carries a running log of it: *"Goldwake takes Cape Ivory from Nightglass."*

### Reputation

Standing runs −100 to +100 per clan and moves on what you actually do:
sinking their ships, rescuing their people, finishing their contracts,
poaching their crew, killing their flagship. Helping one clan quietly
endears you to everyone at war with them, so you drift into somebody's
orbit without ever picking a side outright.

| Standing | What it opens |
| -------- | ------------- |
| −60 | Their fleets hunt you on sight |
| −25 | Their ships turn hostile nearby |
| +20 | Ordinary prices in their ports |
| +40 | Discounts where they hold the harbour |
| +55 | Their crews will take your coin |
| +70 | Exclusive contracts |
| +90 | Rare hulls from their private slips |

**Ports answer to clans.** Banners fly over the quay in the holder's
colours, the port header names them, and their standing with you is what
actually moves the prices. Ownership changes as wars are won and lost.

### Your own clan

At an average standing of +35 any harbourmaster will enter you in the
register. You pick a name, a colour and an emblem with a live preview of
the badge and banner, and from then on your colours fly from your own
mast and every hand you take sails under them.

### Recruitment

Five routes in, deliberately different in feel rather than five buttons
that all mean *pay*: coin at a tavern, winning a boarding, beating a
bounty captain, pulling someone out of the water, or doing a clan's work.
All of them run the same check, so someone out of reach is out of reach
whichever door you knock on — what changes is how much pull the route
brings. A captain will never be bought, but they might follow the person
who just beat them.

Crew carry a **rank** (Deckhand → Captain), their **original clan** and a
**loyalty** score, all on the card. A deck poached from four clans reads
very differently from six Saltborn who signed on together.

### Named ships

Five hulls everyone has heard of, each tied to a clan and patrolling its
home waters — the **Crimson Widow**, **Sea Ghost**, **Golden Fortune**,
**Iron Leviathan** and **Black Tempest**. They are found, not thrown at
you: sail into the right stretch of sea and one appears, visibly larger,
several times tougher, with its own captain and backstory. Each drops a
relic nobody else carries. Sink one and it stays sunk — there are five in
the world, ever, and killing a clan's flagship costs you 25 standing with
them and delights everyone they are at war with.

### Ship customization

Nine categories with a live preview of your actual ship: hull paint,
sails, **sail patterns**, flags, figureheads, **cannons**, **cannon
effects**, lanterns and **deck fittings**. Everything is a look, not a
stat. The fitted guns show at the gun ports, the deck lanterns swing in
the rigging, and the cannon effect tints your muzzle smoke.

### Treasure maps

Expeditions now hand you an actual chart (`js/render/chart.js`): burnt
parchment with wobbling coastlines somebody drew from memory, a dashed
trail, the legs you have already walked struck through, and an X on the
last one. The margin notes whose water you are heading into — the only
hard intelligence on an otherwise unreliable document. Hoards can hold
clan relics, ship parts and cosmetics as well as gold.

## Guidance and progression

The sandbox got large. This layer exists so nobody has to wonder what to
do with it.

### The main quest

An eight-chapter ladder to becoming **Pirate King**
(`js/quests/mainquest.js`), running from the first minute to the last.
It is deliberately not the story campaign — "The Gracechurch Debt" is a
tutorial that teaches the systems and ends, while this never stops
pointing somewhere.

| # | Chapter | Goal |
| - | ------- | ---- |
| 1 | First Blood | Sink 3 hostile ships |
| 2 | A Purse Worth Carrying | Earn 1,000 gold |
| 3 | A Ship Worth The Name | Buy a bigger hull |
| 4 | Hands To Sail Her | 4 crew aboard |
| 5 | Make A Name | Claim 3 bounties |
| 6 | Colours Of Your Own | Found your clan |
| 7 | Break The Great Ships | Defeat 3 of the five |
| 8 | Take The Sea | Claim 3 harbours |

Every chapter measures something the player was already going to do, so
the ladder narrates the sandbox rather than diverting it — no chapter
spawns a fetch quest. Each pays gold and XP, and the last one crowns you.

**Claiming harbours** makes the final chapter real: a clan holds its ports
until its fleet strength falls below 45, which is exactly what sinking its
ships and losing its wars does. Weaken one and the garrison at its harbour
will change sides for 5,000 gold. The Harbour Office shows the holder's
strength against the mark where their grip fails.

### The quest tracker

One panel, top centre, always answering "what now": the main quest chapter
and its number, the objective, a progress bar with `2 / 5`, and the
distance and bearing to wherever the chapter points. The story campaign
rides underneath it as a secondary line while it is running, so there are
never two panels competing to be read. The `?` button asks the bosun
directly.

### The Guide

Bosun Maddox — already the story's first mate — is the mentor
(`js/story/guide.js`). He speaks in barks, the small portrait at the
screen edge that plays over live gameplay, because a mentor who freezes
the world every time he has a thought is an interruption rather than a
mentor.

Three jobs, in priority order: introduce a feature the first time it is
actually reachable (sailing, combat, clans, ports, the shipyard, bounties,
crew, expeditions, customization, founding a clan, the great ships);
narrate each new main-quest chapter; and if the player stalls — not moving
for a while, rather than merely not pressing keys — suggest the next thing
worth doing. Everything is once-only and rate-limited.

His recommendation prefers what is already in front of you: a running
bounty clock beats being told to go be Pirate King.

### The fleet progression tree

The shipyard shows all six hulls as a numbered ladder with connectors:
owned ones in green, the next rung flagged **Next** in gold, and every
locked one stating exactly what it needs — `Needs Captain level 8 (3/8)`,
`Needs 3 bounties claimed (0/3)`, or a standing requirement like *Ashen
Company at +40*. Two hulls are gated on reputation as well as deeds, so
the Frigate and Galleon need a clan to actually like you.

### Notifications

Top-centre stack with a coloured icon badge, headline and optional detail
line, a dismiss **✕**, and a countdown bar that makes the auto-expiry
visible so nothing vanishes without warning. At most three show at once —
the oldest is pushed out — so a burst of pickups can never bury the one
line that mattered. Every existing `toast()` call site got this for free;
the icon is inferred from the colour and wording.

## Death and a new life

A captain can now actually die, and when one does the run is over and a
new pirate takes the wheel. Death is deliberately hard to reach — it takes
two disasters, an ignored warning and a refused rescue — so that reaching
it means something.

### The rule: one blow from the grave

The game already had two moments that *should* have killed you: the hull
reaching zero, and being cut down on somebody else's deck. Both were
softened into a bruise, and both stay exactly as they were. What is new is
the second strike.

1. **Go down once** — sink, lose a boarding, or crawl out of a dungeon
   beaten — and you are **Bleeding Out**: a red badge under the health
   bars with a live countdown, a notification spelling out the stakes, and
   the bosun telling you to your face to patch it.
2. **Bind it and nothing happens.** Heal to full — food, a surgeon at any
   port, a night at the homestead, a level-up — or simply survive the
   2½-minute window, and the state clears with no cost at all.
3. **Take a second beating while wounded and that captain is finished.**

Every rescue that already existed still saves you: accepting the *Save the
ship* or *Rally* offer means you never went down, so the ladder never
starts. Death only ever arrives at the end of a chain the player chose.

### The end of a captain

Death waits for the loot and crew-rescue screens to clear — a last moment
is not something to stack on a popup — then the world stops and the
epitaph opens: the captain's own portrait with their eyes shut, what
killed them, how far up the Pirate King ladder they got, and twelve
numbers for what they actually did with the run.

Two ways out:

| | |
| --- | --- |
| **One Last Breath** | A rewarded ad, **once per life**. Back up at half health with a barely-floating hull, keeping everything. The single most wanted reward in the game, and the only one you can never buy twice. |
| **Begin a New Life** | Wipes the save and boots the character creator. New pirate, new name, new world seed, new everything. If a breath is still unspent, the button asks once before it buries them. |

A dead save stays dead: reloading the page reopens the epitaph rather than
quietly handing the ship back.

### The graveyard

The wipe is total, so the names are kept where it cannot reach — their own
storage key (`js/meta/graveyard.js`), written once per death. The last
twenty captains are listed under every epitaph with their grave number,
what took them and what they earned. It gives the next captain nothing;
it is only a list of people who tried this before them.

Captains are named at creation now — a generated pirate name you can type
over or re-roll — because a captain with a name is a captain worth
burying.

## Ads (CrazyGames SDK)

Ads are integrated through the [CrazyGames HTML5 SDK](https://docs.crazygames.com/sdk/video-ads/)
(`js/ads/ads.js`), in both kinds the SDK offers — **rewarded** and
**midgame** — under different rules.

### Rewarded

The rule the module enforces is that a rewarded ad is always a *favour to
the player*, never a toll:

- **Nothing is gated.** Declining leaves you exactly where the game would
  have put you anyway. There are no timers to skip and no lives to buy.
- **Offers appear only where you already care.** They fire at the game's
  genuinely painful or greedy moments, or sit as a quiet button inside a
  menu you opened yourself. Nothing ever interrupts sailing.
- **Cooldowns per placement plus a 40 s global gap**, so a disastrous run
  can't become a wall of offers.
- **The reward is stated before the ad**, and granted only on the SDK's
  `adFinished`. On `adError` nothing is granted (per CrazyGames policy)
  and no extra punishment is applied either.

| Placement | Moment | Reward |
| --------- | ------ | ------ |
| Save the ship | Hull reaches 0 | Full hull + sails, and keep the 15% gold you'd have lost |
| Save the crew | After a boarding or dungeon where crew fell | Revive them — otherwise the loss is permanent |
| Rally | Driven off an enemy deck | Full health, and keep the 10% gold |
| Double the haul | Inside the loot popup, rare+ or 40+ gold only | Twice the gold and items |
| Free careening | At a port with a damaged hull | Full repair, no gold |
| Another heading | Log → Daily, once the free chart is spent | A second charted treasure |

### Midgame

CrazyGames' hard requirement for interstitials is that they may only run
**when gameplay has stopped**. This game has two moments where it genuinely
does, and midgame ads are attached to those and nowhere else:

| Trigger | Why it qualifies |
| ------- | ---------------- |
| Docking at a port | The world is frozen: the ship cannot move, the clock stops, nothing can attack you. You are reading menus. |
| End of a boarding or dungeon | The fight is over and the results screens are up. Nobody is steering. |

They never fire mid-sail, never during a fight, and are paced so they read
as a breath rather than a toll:

- **A 3-minute grace period** at the start of a session, then the **first
  two stopping points pass for free** — nobody is greeted by an ad.
- **At least 3½ minutes between interstitials**, plus the same 40 s global
  gap that governs rewarded offers, so an ad never lands on the heels of one.
- **A rewarded offer always wins.** A boarding ends into a captured-hold
  screen, then possibly a *Save the crew* offer, then a freed prisoner
  asking to sign on. Rather than cutting into that, the break is **armed**
  and spent only once the deck is clear (`armMidgame` / `tickArmed`); if
  the player lingers past 45 s the moment is judged gone and the break is
  dropped rather than ambushing them on the way back to the helm.
- `gameplayStop()` is always sent **before** `requestAd`, so the SDK is
  never asked for an interstitial while it believes the player is playing.
- **`adError` is a non-event.** No reward was promised, so a failed fill
  simply waves the player through — the game is handed back exactly as an
  `adFinished` would.

While the ad loads, a curtain explains the pause in the game's own voice
("Tying up alongside...", "The fighting is over...") so the stop never
reads as a hitch.

Also wired: `gameplayStart` / `gameplayStop` around menus, pauses and ad
breaks; audio hard-muted for the duration of an ad (only from `adStarted`,
as required); and `happytime()` on boss kills.

The host page supplies the SDK script (`index.html`). Where it isn't
present — local dev, itch.io, the single-file build — the manager falls
back to a **clearly labelled simulation** so the flow stays testable; it
never pretends a real ad was shown, and never silently rewards as if one had been.

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
│   ├── mortality.js     bleeding out, death, the end of a run
│   └── save.js          localStorage persistence
├── world/               simulation
│   ├── world.js         chunk manager + feature-generator registry
│   ├── island.js        deterministic island shapes, biomes, decor
│   ├── encounters.js    wrecks, rafts, survivors, camps, dungeons doors
│   ├── ports.js         procedural harbors on large islands
│   ├── factions.js      reputation with six factions
│   ├── events.js        rumor-driven world events
│   ├── legends.js       Kraken, Serpent, Duchess, wonders
│   ├── dungeons.js      room-chain dungeon crawls (on the boarding engine)
│   ├── clans.js         the six clans: standing, territory, wars, ports
│   ├── namedships.js    the five great ships and their captains
│   ├── bounties.js      wanted captains, roaming hunts
│   ├── homestead.js     the captain's private isle
│   ├── daynight.js      keyframed day/night color cycle
│   └── weather.js       blended weather state machine
├── entities/
│   ├── ship.js          player ship physics + drawing
│   ├── ships.js         the hull catalogue (sloop → man-o-war)
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
├── ads/ads.js           CrazyGames rewarded + midgame ads, gating and pacing
├── story/               the campaign layer
│   ├── story.js         six chapters, goals, markers, contextual barks
│   ├── dialogue.js      the dialogue stage: beats, typing, choices, barks
│   ├── characters.js    the cast: faces and voices
│   └── guide.js         the mentor: briefings, nudges, recommendations
├── crew/
│   ├── crew.js          crew members, traits, roles, ranks, bonuses
│   └── recruitment.js   the five ways a pirate joins your clan
├── quests/
│   ├── quests.js        procedural contracts
│   └── mainquest.js     the eight-chapter road to Pirate King
├── meta/                long-term progression (Part 3)
│   ├── stats.js         lifetime statistics (EventBus observers)
│   ├── collection.js    the collection book + completion rewards
│   ├── achievements.js  26 achievements over stats & collection
│   ├── daily.js         date-seeded daily/weekly content & modifiers
│   ├── graveyard.js     the roll of fallen captains (survives a wipe)
│   └── cosmetics.js     sails, flags, figureheads, lanterns
├── systems/
│   ├── fishing.js       biome/time/weather/season fishing
│   └── treasurehunt.js  multi-clue expedition hunts
├── render/
│   ├── renderer.js      frame composition, backbuffer, lighting
│   ├── water.js         the animated ocean field
│   ├── sprites.js       procedural sprite factory
│   ├── pirate.js        layered captain sprite + appearance options
│   ├── portrait.js      64×64 expressive character portraits
│   ├── clanart.js       clan emblems, flags, banners and badges
│   ├── shipdecor.js     sail patterns and deck fittings
│   ├── chart.js         the hand-drawn treasure chart
│   ├── decor.js         swaying island decorations
│   └── particles.js     particles + floating text
├── audio/audio.js       WebAudio soundscape + generative music
├── ui/                  DOM screens: creator, HUD, pause menu
└── util/                seeded random, value noise, math helpers
```

### Extension points

Every expansion plugged in through the same seams Part 1 established —
Part 2's inventory/combat/ports/quests and Part 3's factions, events,
legends, dungeons, fishing, homestead, collection, achievements and
dailies all arrived without rewriting what came before:

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
