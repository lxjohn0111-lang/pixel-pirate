// Records a 19-second silent gameplay clip for store pages and portals.
//
// Usage, with the game served on :8630 from the repo root:
//   python3 -m http.server 8630 &
//   FFMPEG=/path/to/ffmpeg node tools/record-gameplay.mjs
//
//
// The menu and the character creator are walked through BEFORE recording
// starts: frames come from CDP's screencast, which is independent of the
// page's lifetime, so the first frame of the clip is already gameplay.
// Nothing but the game is ever in shot.
//
// Beats: golden-hour sailing past an island -> a broadside battle ->
// boarding an enemy deck, still swinging when the clip ends.
//
// Every distance below is in world units and sized against the real
// camera rect (~478x269), because anything further out is off screen.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Output next to the repo; ffmpeg and Playwright come from the machine.
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'dist');
const FRAMES = path.join(OUT, 'frames');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const W = 1280;
const H = 720;
const FPS = 30;
const SECONDS = 19;
const CAPTURE_MS = 20500;

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const errs = [];
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--hide-scrollbars'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://localhost:8630/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

/* ---- through the menu, off camera ----------------------------------- */
await page.click('.menu-new');
await page.waitForTimeout(400);
await page.click('.sail-btn');
await page.waitForTimeout(1300);
// Walk the opening scene out: it pauses the world until it is done.
await page.evaluate(() => new Promise((resolve) => {
  const g = window.__seaOfRogues;
  const iv = setInterval(() => {
    if (!g.dialogue?.isOpen && !g.dialoguePaused) { clearInterval(iv); resolve(); return; }
    const choice = document.querySelector('.dlg-choice');
    if (choice) choice.click(); else g.dialogue._advance();
  }, 120);
  setTimeout(() => { clearInterval(iv); resolve(); }, 30000);
}));
await page.waitForTimeout(400);

/* ---- dress the set --------------------------------------------------- */
const setup = await page.evaluate(async () => {
  const g = window.__seaOfRogues;

  g.audio.setMuted(true);
  g.settings.master = 0;

  // The biggest hull in the game, fully fitted — a warship, not a sloop.
  // Sails stay at stock so she does not outrun her own scenery.
  g.shipState.hullId = 'manowar';
  if (!g.shipState.ownedHulls.includes('manowar')) g.shipState.ownedHulls.push('manowar');
  g.shipState.levels.hull = 3;
  g.shipState.levels.cannons = 3;
  g.shipState.levels.rudder = 2;
  g.shipState.hull = g.shipState.maxHull;
  g.shipState.sailHp = g.shipState.maxSail;

  const cos = g.cosmetics;
  for (const [slot, id] of [['sail', 'night'], ['flag', 'kraken'], ['figurehead', 'kraken'],
    ['lantern', 'ember'], ['cannon', 'brass'], ['cannonfx', 'ember']]) {
    try { cos.unlock(slot, id); cos.equip(slot, id); } catch { /* skip unknown ids */ }
  }

  g.player.level = 14;
  g.player.recompute();
  g.player.health = g.player.maxHealth;
  g.resources.coins = 18400;

  const { createCrewMember } = await import('/js/crew/crew.js');
  while (g.crew.members.length < 4) {
    g.crew.members.push(createCrewMember((Math.random() * 0xffffffff) >>> 0, 8));
  }

  // Sunset: the 0.70 keyframe is warm amber light on water that has just
  // started to turn. Past ~0.74 the sea goes purple and photographs muddy.
  g.dayNight.t = 0.668;
  g.dayNight._compute();
  g.weather.current = 'sunny';
  g.weather.next = 'sunny';
  g.weather.blend = 1;
  g.weather._compute();

  // The biggest island within reach, so it fills a real part of frame.
  let best = null;
  for (let r = 1; r < 20; r++) {
    for (let cx = -r; cx <= r; cx++) {
      for (const cy of [-r, r]) {
        for (const [x, y] of [[cx, cy], [cy, cx]]) {
          const k = `${x},${y}`;
          if (!g.world.chunks.has(k)) g.world.chunks.set(k, g.world._generate(x, y));
          const isl = g.world.chunks.get(k)?.island;
          if (!isl) continue;
          // Green islands photograph far better than bare rock, so a
          // jungle or palm shore outranks a bigger grey one.
          const score = (i) => i.r + (i.biome === 'jungle' || i.biome === 'palm' ? 90 : 0);
          if (!best || score(isl) > score(best)) best = isl;
        }
      }
    }
    if (best && best.r >= 80 && (best.biome === 'jungle' || best.biome === 'palm')) break;
  }

  const view = g.renderer.viewRect();
  // Stand off to the west so the island sits in the right third of frame,
  // and start south of it so we sail up its coast.
  const standoff = Math.min(200, view.w * 0.22 + (best?.r ?? 0) * 0.55);
  let sx = (best?.x ?? 0) - standoff;
  let sy = (best?.y ?? 0) + 120;
  for (let i = 0; i < 24 && !g.world.isOpenWater(sx, sy); i++) sx -= 24;
  g.ship.x = sx;
  g.ship.y = sy;
  g.ship.heading = -Math.PI / 2;
  g.ship.speed = 40;
  g.camera.snapTo(g.ship.x, g.ship.y);

  g.combat.ships.length = 0;
  g.combat.drops.length = 0;
  g.hud.hideObjective?.();
  g.guide.enabled = false;

  // No pop-up chatter in a trailer: discoveries fire notifications the
  // moment new water is streamed in, which reads as debris on screen.
  g.hud.notify = () => null;
  g.hud.toast = () => null;
  g.openLoot = () => {};
  g.lootUI.showLoot = () => {};
  g.lootUI.showRecruit = () => {};
  g.lootUI.showMessage = () => {};
  g.dialogue.bark = () => {};
  document.querySelectorAll('.note').forEach((n) => n.remove());

  // Make the HUD agree with everything set above.
  g.events.emit('player:changed');
  g.events.emit('resources:changed', { ...g.resources });
  g.events.emit('playership:damaged', { hull: g.shipState.hull });
  g.events.emit('crew:changed');

  return {
    maxHull: g.shipState.maxHull,
    island: best ? { x: Math.round(best.x), y: Math.round(best.y), r: Math.round(best.r), biome: best.biome } : null,
    ship: { x: Math.round(g.ship.x), y: Math.round(g.ship.y) },
    view: { w: Math.round(view.w), h: Math.round(view.h) },
  };
});
console.log('SET:', JSON.stringify(setup));

await page.evaluate(() => {
  const g = window.__seaOfRogues;
  const v = g.renderer.viewRect();
  g.world.ensure(v.x - 500, v.y - 500, v.w + 1000, v.h + 1000);
});
await page.waitForTimeout(1000);

/* ---- roll ------------------------------------------------------------ */
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ t: metadata.timestamp, data });
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch { /* closing */ }
});
await cdp.send('Page.startScreencast', {
  format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1,
});

const t0 = Date.now();
const at = async (ms, fn) => {
  const wait = ms - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await fn();
};
const drive = (js) => page.evaluate(`(() => { const g = window.__seaOfRogues; ${js} })()`).catch(() => {});

// Under way up the coast.
await drive(`g.input.keys.add('KeyW');`);

// 1.0s — three raiders come up out of the sunset, inside the camera rect.
await at(1000, () => page.evaluate(`(async () => {
  const g = window.__seaOfRogues;
  const { AIShip } = await import('/js/entities/aiship.js');
  const mk = (type, dx, dy, heading) => {
    const s = new AIShip(type, g.ship.x + dx, g.ship.y + dy, 4);
    s.heading = heading;
    s.hostileToPlayer = true;
    g.combat.assignClan(s, s.x, s.y);
    g.combat.ships.push(s);
    return s;
  };
  window.__foes = [
    mk('pirate', 95, -120, Math.PI * 0.62),
    mk('pirate', -105, -135, Math.PI * 0.40),
    mk('pirate', -20, -175, Math.PI * 0.50),
  ];
  window.__mk = mk;
})()`).catch(() => {}));

// 2.4s — ease off the throttle so the fight stays beside the island.
await at(2000, () => drive(`g.input.keys.delete('KeyW');`));
// Turn broadside-on.
await at(2700, () => drive(`g.input.keys.add('KeyD');`));
await at(3500, () => drive(`g.input.keys.delete('KeyD');`));

// 3.2s -> 9.6s — broadsides.
for (let i = 0; i < 9; i++) {
  await at(3200 + i * 720, () => drive(`g.input.pressVirtual('Space');`));
}

// 6.0s — two more come round the headland.
await at(6000, () => page.evaluate(`(() => {
  const g = window.__seaOfRogues;
  const mk = window.__mk;
  if (!mk) return;
  window.__foes.push(mk('pirate', -140, 60, -Math.PI * 0.3));
  window.__foes.push(mk('merchant', 150, 55, -Math.PI * 0.55));
})()`).catch(() => {}));

// Keep the melee on camera: any raider that wanders out of frame is
// brought back to the edge of it rather than left to sail off alone.
const herd = setInterval(() => {
  page.evaluate(`(() => {
    const g = window.__seaOfRogues;
    if (g.boarding.active) return;
    for (const s of g.combat.ships) {
      if (s.sinking) continue;
      const dx = s.x - g.ship.x, dy = s.y - g.ship.y;
      const d = Math.hypot(dx, dy);
      if (d > 230) {
        const a = Math.atan2(dy, dx);
        s.x = g.ship.x + Math.cos(a) * 170;
        s.y = g.ship.y + Math.sin(a) * 170;
      }
    }
  })()`).catch(() => {});
}, 900);

// 6.6s — the first raider breaks up and goes down.
await at(6600, () => drive(`
  const f = (window.__foes || [])[0];
  if (f && !f.sinking) { f.hp = 0; f.sinking = true; f.sinkT = 0; g.events.emit('ship:sunk', { byPlayer: true, type: f.type }); }
`));

// 8.4s — come about onto the next one.
await at(8400, () => drive(`g.input.keys.add('KeyA');`));
await at(9300, () => drive(`g.input.keys.delete('KeyA');`));

// 10.4s — alongside, grapples away, over the rail.
await at(12300, () => drive(`
  const foe = (window.__foes || []).find((s) => s && s.type === 'pirate' && !s.sinking && g.combat.ships.includes(s))
    || g.combat.ships.find((s) => s.type === 'pirate' && !s.sinking);
  if (foe) {
    foe.hp = Math.max(1, foe.maxHp * 0.12);
    foe.crewCount = 9;                 // a full deck: no clearing it in six seconds
    foe.x = g.ship.x + 46; foe.y = g.ship.y - 8;
    g.boarding.start(foe);
  }
`));

// Deck fight to the final frame.
const deck = [
  [13100, `g.input.keys.add('KeyD');`],
  [13420, `g.input.pressVirtual('KeyJ');`],
  [13740, `g.input.pressVirtual('KeyJ');`],
  [14060, `g.input.keys.add('KeyS');`],
  [14380, `g.input.pressVirtual('KeyK');`],
  [14700, `g.input.pressVirtual('KeyJ');`],
  [15020, `g.input.keys.delete('KeyS'); g.input.keys.add('KeyW');`],
  [15340, `g.input.pressVirtual('KeyJ');`],
  [15660, `g.input.pressVirtual('ShiftLeft');`],
  [15980, `g.input.pressVirtual('KeyJ');`],
  [16300, `g.input.keys.delete('KeyW');`],
  [16620, `g.input.pressVirtual('KeyL');`],
  [16940, `g.input.pressVirtual('KeyJ');`],
  [17260, `g.input.keys.add('KeyS');`],
  [17580, `g.input.pressVirtual('KeyJ');`],
  [17900, `g.input.keys.delete('KeyS');`],
  [18220, `g.input.pressVirtual('KeyJ');`],
  [18540, `g.input.pressVirtual('KeyK');`],
  [18860, `g.input.pressVirtual('KeyJ');`],
  [19180, `g.input.keys.add('KeyW');`],
  [19500, `g.input.pressVirtual('KeyJ');`],
  [19820, `g.input.pressVirtual('KeyJ');`],
  [20140, `g.input.pressVirtual('KeyJ');`],
];
for (const [ms, js] of deck) await at(ms, () => drive(js));

await at(CAPTURE_MS, async () => {});
clearInterval(herd);
await cdp.send('Page.stopScreencast').catch(() => {});
await page.waitForTimeout(250);

console.log('END:', JSON.stringify(await page.evaluate(() => {
  const g = window.__seaOfRogues;
  return {
    state: g.state, boarding: g.boarding.active, ships: g.combat.ships.length,
    day: +g.dayNight.t.toFixed(3), modal: !!document.querySelector('.modal-screen'),
  };
})), 'frames:', frames.length);
if (errs.length) console.log('PAGE ERRORS:', [...new Set(errs)].slice(0, 4).join(' | '));
await browser.close();

/* ---- assemble exactly 19.000 s -------------------------------------- */
if (frames.length < 60) { console.error('Not enough frames.'); process.exit(1); }
const base = frames[0].t;
const rel = frames.map((f) => ({ t: f.t - base, data: f.data }));
const need = FPS * SECONDS;
let cursor = 0;
for (let i = 0; i < need; i++) {
  const want = i / FPS;
  while (cursor + 1 < rel.length && rel[cursor + 1].t <= want) cursor++;
  fs.writeFileSync(path.join(FRAMES, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(rel[cursor].data, 'base64'));
}
console.log(`Frames: ${need} (source span ${rel[rel.length - 1].t.toFixed(2)}s)`);

const mp4 = path.join(OUT, 'sea-of-rogues-gameplay.mp4');
execFileSync(FFMPEG, [
  '-y', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%05d.jpg'),
  '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), mp4,
], { stdio: ['ignore', 'ignore', 'pipe'] });
console.log('Wrote', mp4);

// Contact sheet, so the result can be judged without playing it back.
execFileSync(FFMPEG, [
  '-y', '-i', mp4, '-vf', 'fps=1,scale=320:-1,tile=5x4', '-frames:v', '1',
  path.join(OUT, 'trailer-contact.jpg'),
], { stdio: ['ignore', 'ignore', 'pipe'] });
console.log('Wrote contact sheet');
