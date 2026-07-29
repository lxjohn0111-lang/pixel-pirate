// The hull catalog.
//
// Upgrades (entities/shipstate.js) make the ship you own better; a hull
// is the ship you own. Buying one is meant to land as a milestone rather
// than a purchase, so hulls are expensive, visibly larger on the water,
// and several are locked behind something you did rather than something
// you saved up for.
//
// Every stat here is a BASE. Upgrade levels stack on top, so a fully
// fitted sloop is still a sloop — trading up is the only way past the
// ceiling.

export const HULLS = {
  sloop: {
    name: 'Sloop',
    tagline: 'Every captain starts here.',
    desc: 'Small, willing and quick to answer the helm. She will not win a broadside duel, but she will get you out of one.',
    cost: 0,
    hull: 100,
    speed: 1,
    turn: 1,
    cannons: 2,
    cargo: 12,
    crew: 2,
    scale: 1,
    unlock: null, // owned from the start
  },
  cutter: {
    name: 'Cutter',
    tagline: 'Outrun what you cannot outgun.',
    desc: 'A smuggler\'s boat: lean, over-canvassed and impossible to corner. Favoured by captains who prefer the horizon to the fight.',
    cost: 1800,
    hull: 140,
    speed: 1.18,
    turn: 1.15,
    cannons: 2,
    cargo: 16,
    crew: 3,
    scale: 1.08,
    unlock: null,
  },
  brigantine: {
    name: 'Brigantine',
    tagline: 'The working pirate\'s ship.',
    desc: 'Two masts, a real gun deck and room for a proper crew. The first hull that can pick a fight on purpose.',
    cost: 5200,
    hull: 220,
    speed: 1.06,
    turn: 0.96,
    cannons: 3,
    cargo: 24,
    crew: 5,
    scale: 1.2,
    unlock: { type: 'level', value: 8, label: 'Captain level 8' },
  },
  frigate: {
    name: 'Frigate',
    tagline: 'Built to take the hit and answer it.',
    desc: 'Navy lines and navy timbers. Slower to turn than she looks, but she carries iron enough to end an argument.',
    cost: 12000,
    hull: 340,
    speed: 1.02,
    turn: 0.88,
    cannons: 4,
    cargo: 30,
    crew: 7,
    scale: 1.34,
    unlock: { type: 'bounties', value: 3, label: '3 bounties claimed' },
    // Navy lines come out of a navy yard: Ashen have to like you first.
    repRequired: { clan: 'ashen', value: 40 },
  },
  galleon: {
    name: 'Galleon',
    tagline: 'A treasure fleet of one.',
    desc: 'Enormous holds, quarters for a small village, and enough guns that most captains simply decline. She sails like a cathedral.',
    cost: 24000,
    hull: 420,
    speed: 0.92,
    turn: 0.76,
    cannons: 5,
    cargo: 48,
    crew: 10,
    scale: 1.5,
    unlock: { type: 'bosses', value: 1, label: 'Defeat a leviathan' },
    // The Consortium does not release a treasure hull to a stranger.
    repRequired: { clan: 'goldwake', value: 55 },
  },
  manowar: {
    name: 'Man-o-War',
    tagline: 'The last ship you will ever need.',
    desc: 'Three decks of guns and a name that clears harbours. They do not sell these — you take one, and the sea remembers.',
    cost: 60000,
    hull: 600,
    speed: 0.98,
    turn: 0.7,
    cannons: 7,
    cargo: 56,
    crew: 14,
    scale: 1.7,
    unlock: { type: 'prestige', value: 1, label: 'Retire into Legend once' },
  },
};

export const HULL_ORDER = ['sloop', 'cutter', 'brigantine', 'frigate', 'galleon', 'manowar'];

export const DEFAULT_HULL = 'sloop';

/** Stat rows used by the shipyard's comparison table. */
export const HULL_STATS = [
  { key: 'hull', label: 'Hull', format: (v) => `${v}`, better: 'high' },
  { key: 'cannons', label: 'Cannons / side', format: (v) => `${v}`, better: 'high' },
  { key: 'speed', label: 'Top speed', format: (v) => `${Math.round(v * 100)}%`, better: 'high' },
  { key: 'turn', label: 'Handling', format: (v) => `${Math.round(v * 100)}%`, better: 'high' },
  { key: 'cargo', label: 'Cargo slots', format: (v) => `${v}`, better: 'high' },
  { key: 'crew', label: 'Crew berths', format: (v) => `${v}`, better: 'high' },
];

export function getHull(id) {
  return HULLS[id] ?? HULLS[DEFAULT_HULL];
}

/** Standing gate, separate from the unlock so both can be reported. */
export function hullRepOk(id, game) {
  const h = getHull(id);
  if (!h.repRequired) return { ok: true };
  const { clan, value } = h.repRequired;
  const have = game.clans?.rep?.[clan] ?? 0;
  return {
    ok: have >= value,
    clan,
    value,
    have,
    label: `${game.clans?.def?.(clan)?.name ?? clan} at +${value}`,
  };
}

/**
 * Is this hull's unlock condition met? Returns { ok, label }.
 * Gold and standing are checked separately — this is only eligibility.
 */
export function hullUnlocked(id, game) {
  const h = getHull(id);
  if (!h.unlock) return { ok: true, label: null };
  const { type, value, label } = h.unlock;
  const have =
    type === 'level' ? (game.player?.level ?? 1)
      : type === 'bounties' ? (game.stats?.get('bountiesClaimed') ?? 0)
        : type === 'bosses' ? (game.stats?.get('bossesDefeated') ?? 0)
          : type === 'prestige' ? (game.prestige ?? 0)
            : 0;
  return { ok: have >= value, label, have, need: value };
}
