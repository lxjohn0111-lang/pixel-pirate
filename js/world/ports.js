// Procedural ports. Large islands deterministically grow a harbor: a
// dock reaching into the water, a cluster of houses, and a name worth
// putting on the map. Docking opens the port screen (ui/portUI.js)
// where the player repairs, trades, upgrades, hires and takes contracts.

import { mulberry32, hash2u, pick, rangeInt } from '../util/random.js';
import { dockSprite, portHouseSprite } from '../render/sprites.js';
import { dist2 } from '../util/math.js';

const PORT_PREFIX = ['Port', 'Cape', 'Bahía', 'Havre', 'Cove', 'Anchorage'];
const PORT_NAMES = ['Meridian', 'Salt', 'Grouper', 'Widow', 'Ember', 'Corsair', 'Gull', 'Serpent',
  'Ivory', 'Rustwater', 'Palma', 'Ninefingers', 'Lantern', 'Mariner', 'Drift', 'Tortuga',
  'Cannonade', 'Solace', 'Vesper', 'Kingfisher'];

export class Ports {
  constructor(game) {
    this.game = game;
    game.world.addFeatureGenerator((chunk, rng, world) => this._generate(chunk, rng, world));
  }

  _generate(chunk, rng, world) {
    const isl = chunk.island;
    if (!isl || isl.r < 76 || isl.shore.length < 8) return;
    const seed = hash2u(world.seed ^ 0x9047, chunk.cx, chunk.cy);
    const prng = mulberry32(seed);
    if (prng() > 0.6) return;

    // Dock at a deterministic shore point; extends into open water.
    const shorePoint = isl.shore[rangeInt(prng, 0, isl.shore.length - 1)];
    const angle = Math.atan2(shorePoint.ny, shorePoint.nx);
    const name = `${pick(prng, PORT_PREFIX)} ${pick(prng, PORT_NAMES)}`;
    chunk.port = {
      seed,
      name,
      // dock end (the interaction point, out in the water)
      x: Math.round(shorePoint.x + shorePoint.nx * 34),
      y: Math.round(shorePoint.y + shorePoint.ny * 34),
      baseX: Math.round(shorePoint.x - shorePoint.nx * 6),
      baseY: Math.round(shorePoint.y - shorePoint.ny * 6),
      angle,
      houses: [],
    };
    // Houses scatter on land behind the dock.
    for (let i = 0; i < 3; i++) {
      for (let tries = 0; tries < 14; tries++) {
        const hx = shorePoint.x - shorePoint.nx * (18 + prng() * 30) + (prng() - 0.5) * 44;
        const hy = shorePoint.y - shorePoint.ny * (18 + prng() * 30) + (prng() - 0.5) * 44;
        if (isl.elevationAt(hx, hy) > 0.36) {
          chunk.port.houses.push({ x: Math.round(hx), y: Math.round(hy), variant: i });
          break;
        }
      }
    }
  }

  /** Port whose dock the ship is beside, or null. */
  findNearby() {
    const { ship, world } = this.game;
    let found = null;
    world.forEachChunkIn(ship.x - 400, ship.y - 400, 800, 800, (chunk) => {
      if (chunk.port && dist2(chunk.port.x, chunk.port.y, ship.x, ship.y) < 85 * 85) {
        found = chunk.port;
      }
    });
    return found;
  }

  collectSurfaceDrawables(out, t, viewX, viewY, viewW, viewH) {
    const { world, dayNight } = this.game;
    world.forEachChunkIn(viewX, viewY, viewW, viewH, (chunk) => {
      const port = chunk.port;
      if (!port) return;
      out.push({
        y: port.baseY,
        draw: (g) => {
          const dock = dockSprite();
          g.save();
          g.translate(port.baseX, port.baseY);
          g.rotate(port.angle + Math.PI / 2);
          g.drawImage(dock, -dock.width / 2, -44);
          g.restore();
          // moored rowboat
          g.fillStyle = '#8a5a34';
          g.fillRect(port.x - 8 + Math.round(Math.sin(t) * 1), port.y + 4, 10, 5);
          g.fillStyle = '#b98a55';
          g.fillRect(port.x - 7 + Math.round(Math.sin(t) * 1), port.y + 5, 8, 3);
          // dock lanterns at night
          if (dayNight.snapshot.sun < 0.35) {
            const glow = (0.35 - dayNight.snapshot.sun) / 0.35;
            const flicker = 0.8 + Math.sin(t * 9 + port.x) * 0.1;
            g.fillStyle = `rgba(255,196,90,${0.85 * glow})`;
            g.fillRect(port.x - 1, port.y - 6, 2, 2);
            g.fillStyle = `rgba(255,180,80,${0.18 * glow * flicker})`;
            g.beginPath();
            g.arc(port.x, port.y - 5, 12, 0, Math.PI * 2);
            g.fill();
          }
        },
      });
      for (const h of port.houses) {
        out.push({
          y: h.y,
          draw: (g) => {
            const spr = portHouseSprite(h.variant);
            g.drawImage(spr, h.x - 10, h.y - 16);
          },
        });
      }
    });
  }
}
