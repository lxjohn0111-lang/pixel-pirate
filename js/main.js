// Entry point: wire the game to the DOM and boot into the main menu.

import { Game } from './core/game.js';
import { Storage } from './core/storage.js';

const canvas = document.getElementById('game');
const uiRoot = document.getElementById('ui');

const game = new Game(canvas, uiRoot);
game.boot();

// Handy for debugging from the console.
window.__seaOfRogues = game;
window.__seaOfRoguesStorage = Storage;
