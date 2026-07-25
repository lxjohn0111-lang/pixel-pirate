// The cast. Each entry is a face for the portrait renderer plus a
// "voice" — a base pitch and cadence for the typewriter blips, so you
// can tell who is speaking with your eyes shut.

export const CHARACTERS = {
  maddox: {
    name: 'Bosun Maddox',
    title: 'Your first mate',
    face: {
      skin: '#8a5a3b',
      hair: 'short', hairColor: '#5a5148', beardColor: '#6e655a',
      beard: 'full',
      hat: 'bandana', hatColor: '#8e2f2f',
      earring: '#e0b345',
      eyeColor: '#5a7a4a',
      coat: '#5a4632', collarTrim: '#8a7350',
      scar: -1,
      bgTop: '#2a3a52', bgBottom: '#101c30',
    },
    voice: { pitch: 190, wobble: 30, rate: 1 },
  },

  vane: {
    name: 'Captain Vane',
    title: 'Lost with the Gracechurch',
    face: {
      skin: '#d9b18c',
      hair: 'long', hairColor: '#2a2028',
      beard: 'none',
      hat: 'captain', hatColor: '#3a2b4e', hatTrim: '#e0b345',
      eyeColor: '#3a6e8e',
      coat: '#3a2b4e', collarTrim: '#e0b345',
      scar: 1,
      bgTop: '#3a4a6e', bgBottom: '#141a30',
    },
    voice: { pitch: 300, wobble: 40, rate: 0.92 },
  },

  quint: {
    name: 'Harbourmaster Quint',
    title: 'Keeper of the ledger',
    face: {
      skin: '#e6b98d',
      hair: 'bald', hairColor: '#8a8078', beardColor: '#9a9088',
      beard: 'braided',
      hat: 'tricorne', hatColor: '#4d3a28', hatTrim: '#c9a06a',
      earring: '#c8ccd4',
      eyeColor: '#7a6a4a',
      coat: '#6e5a3a', collarTrim: '#c9b284',
      bgTop: '#4a3f2e', bgBottom: '#1e1810',
    },
    voice: { pitch: 150, wobble: 22, rate: 1.1 },
  },

  ketch: {
    name: 'Red Ketch',
    title: 'Raider, and proud of it',
    face: {
      skin: '#cf9d6e',
      hair: 'wild', hairColor: '#8e3a1e', beardColor: '#a04a26',
      beard: 'braided',
      hat: 'none', hatColor: '#1e1a22',
      earring: '#e0b345',
      eyeColor: '#8e5a2a',
      eyepatch: -1,
      coat: '#5a2a2a', collarTrim: '#8e4a3a',
      bgTop: '#5a2430', bgBottom: '#200c14',
    },
    voice: { pitch: 130, wobble: 45, rate: 1.15 },
  },

  herald: {
    name: 'The Drowned Herald',
    title: 'Voice of the Sunken Kingdom',
    face: {
      skin: '#7fae9e',
      hair: 'dreads', hairColor: '#2e6e64',
      beard: 'none',
      hat: 'coral', hatColor: '#2e6e64',
      eyeColor: '#7ae0cc', glowEyes: true,
      coat: '#1e4a42', collarTrim: '#4ec9b0',
      bgTop: '#12403c', bgBottom: '#04161a',
    },
    voice: { pitch: 90, wobble: 12, rate: 0.75 },
  },
};

export function getCharacter(id) {
  return CHARACTERS[id] ?? CHARACTERS.maddox;
}
