// Entry point: wire the game to the DOM and boot into the character
// creator (or the continue screen when a voyage is already underway).

import { Game } from './core/game.js';

const canvas = document.getElementById('game');
const uiRoot = document.getElementById('ui');

const game = new Game(canvas, uiRoot);
game.boot();

// Handy for debugging from the console.
window.__seaOfRogues = game;
