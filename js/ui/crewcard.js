// The crew card, shared by the tavern and the Captain's Log.
//
// A card has to answer four questions at a glance: who is this, what are
// they for, how loyal are they, and where did they come from. The last
// one is what turns a crew list into a clan roster — a deck of hands
// poached from four different clans reads very differently from six
// Saltborn who all signed on together.

import { ITEMS } from '../items/itemdefs.js';
import { TRAITS, crewRole, hashId, RANKS } from '../crew/crew.js';
import { portraitCanvas, faceFromAppearance } from '../render/portrait.js';
import { CLANS } from '../world/clans.js';
import { clanEmblem } from '../render/clanart.js';

const JOIN_LABEL = {
  pay: 'Signed for coin',
  defeat: 'Taken in battle',
  captain: 'Followed you after their captain fell',
  rescue: 'Owes you their life',
  quest: 'Won through service',
};

export function crewCardHTML(m, i, opts = {}) {
  const role = crewRole(m);
  const rank = RANKS.find((r) => r.id === m.rank) ?? RANKS[0];
  const clan = m.originClan ? CLANS[m.originClan] : null;
  const frac = m.health / m.maxHealth;
  const loyalty = m.loyalty ?? 50;
  const traits = m.traits.map((t) =>
    `<span class="trait-chip" title="${TRAITS[t].desc}">${TRAITS[t].name}</span>`).join('');

  return `<article class="crew-card" data-i="${i}" ${clan ? `style="--clan:${clan.color}"` : ''}>
    ${clan ? `<span class="crew-clan-strip" title="${clan.name}"></span>` : ''}
    <div class="crew-card-top">
      <canvas class="crew-portrait" width="64" height="64" data-i="${i}"></canvas>
      <div class="crew-ident">
        <b>${m.name}</b>
        <span class="crew-role">${role.icon} ${role.name}</span>
        <span class="crew-rank">${rank.name} · Level ${m.level}</span>
      </div>
    </div>
    ${clan ? `<div class="crew-origin">
      <canvas class="crew-clan-icon" width="12" height="12" data-clan="${m.originClan}"></canvas>
      <span>${clan.short}</span>
      ${m.joinedBy ? `<i title="${JOIN_LABEL[m.joinedBy] ?? ''}">${JOIN_LABEL[m.joinedBy] ?? ''}</i>` : ''}
    </div>` : ''}
    <div class="crew-stats">
      <div class="crew-stat"><span>Health</span><div class="crew-hpbar"><i style="width:${Math.round(frac * 100)}%"></i></div><b>${Math.round(m.health)}</b></div>
      ${opts.showLoyalty !== false ? `<div class="crew-stat"><span>Loyalty</span>
        <div class="crew-hpbar loyal"><i style="width:${Math.round(loyalty)}%"></i></div><b>${Math.round(loyalty)}</b></div>` : ''}
      <div class="crew-stat"><span>Weapon</span><b class="crew-weapon">${ITEMS[m.weapon]?.name ?? 'Fists'}</b></div>
      ${m.ship ? `<div class="crew-stat"><span>Ship</span><b class="crew-weapon">${m.ship}</b></div>` : ''}
    </div>
    <div class="crew-traits">${traits}</div>
    ${opts.note ? `<p class="crew-note">${opts.note}</p>` : ''}
    ${opts.action ? `<button class="mini-btn crew-action ${opts.ghost ? 'ghost' : ''}" data-i="${i}"
      ${opts.disabled ? 'disabled' : ''}>${opts.action}</button>` : ''}
  </article>`;
}

/** Fill in every portrait and clan icon inside a container. */
export function paintCrewPortraits(root, list) {
  root.querySelectorAll('.crew-portrait').forEach((c) => {
    const m = list[Number(c.dataset.i)];
    if (!m) return;
    const face = faceFromAppearance(m.appearance, hashId(m.id));
    c.getContext('2d').drawImage(portraitCanvas(face, crewRole(m).mood), 0, 0);
  });
  root.querySelectorAll('.crew-clan-icon').forEach((c) => {
    const clan = CLANS[c.dataset.clan];
    if (clan) c.getContext('2d').drawImage(clanEmblem(clan.emblem, clan.color, 12, clan.accent), 0, 0);
  });
}
