// The dialogue stage.
//
// Presents a scene as a ship's-log page pinned to the lower third: a
// carved portrait frame on the left, a name plate straddling its top
// edge, and typed text to the right. The portrait blinks and its mouth
// articulates while text is typing, so the scene reads as someone
// speaking rather than a text box with a picture beside it.
//
// A scene is an array of beats:
//   { who, expression, text }                     — a spoken line
//   { who, expression, text, choices: [...] }     — a branch
//   { card: 'CHAPTER TWO', sub: 'Make Port' }     — a title card
// Choices are { label, next }, where next is a scene key or a function.

import { drawPortrait, P } from '../render/portrait.js';
import { getCharacter } from './characters.js';

const CHAR_MS = 18; // per-character typing speed
const PUNCT_PAUSE = { '.': 9, '!': 9, '?': 9, ',': 4, '—': 6, ':': 5 };

export class Dialogue {
  constructor(uiRoot, game) {
    this.game = game;
    this.uiRoot = uiRoot;
    this.active = false;
    this.el = null;
    this._raf = 0;
    this._onDone = null;
  }

  get isOpen() {
    return this.active;
  }

  /** Play a scene. Resolves (and calls onDone) when the last beat ends. */
  play(beats, onDone) {
    if (this.active) this.finish(true);
    this.beats = beats.slice();
    this.index = -1;
    this._onDone = onDone;
    this.active = true;
    this.game.dialoguePaused = true;
    this.game.ads?.setGameplayActive(false);
    this._build();
    this._next();
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'dialogue-stage';
    el.innerHTML = `
      <div class="dlg-scrim"></div>
      <div class="dlg-card">
        <div class="dlg-portrait-frame">
          <canvas class="dlg-portrait" width="${P}" height="${P}"></canvas>
          <div class="dlg-frame-rivets"></div>
        </div>
        <div class="dlg-body">
          <div class="dlg-nameplate"><span class="dlg-name"></span><span class="dlg-title"></span></div>
          <p class="dlg-text"></p>
          <div class="dlg-choices"></div>
          <div class="dlg-advance">Continue <span class="dlg-caret">▾</span></div>
        </div>
      </div>
      <div class="dlg-cardtitle hidden"><h2></h2><p></p></div>`;
    this.uiRoot.appendChild(el);
    this.el = el;

    this.pCtx = el.querySelector('.dlg-portrait').getContext('2d');
    this.pCtx.imageSmoothingEnabled = false;
    this.nameEl = el.querySelector('.dlg-name');
    this.titleEl = el.querySelector('.dlg-title');
    this.textEl = el.querySelector('.dlg-text');
    this.choicesEl = el.querySelector('.dlg-choices');
    this.advanceEl = el.querySelector('.dlg-advance');
    this.cardEl = el.querySelector('.dlg-cardtitle');
    this.frameEl = el.querySelector('.dlg-portrait-frame');
    this.bodyEl = el.querySelector('.dlg-body');

    // Advance on click / tap / space / enter anywhere on the stage.
    this._click = (e) => {
      if (e.target.closest('.dlg-choice')) return;
      this._advance();
    };
    el.addEventListener('pointerdown', this._click);
    this._key = (e) => {
      if (!this.active) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') {
        e.preventDefault();
        e.stopPropagation();
        this._advance();
      }
    };
    window.addEventListener('keydown', this._key, true);

    // Portrait render loop.
    const loop = (ts) => {
      if (!this.active) return;
      this._drawPortrait(ts / 1000);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  _drawPortrait(t) {
    if (!this.face) return;
    // Blink on an irregular schedule so it never looks mechanical.
    const cyc = (t * 0.9) % 4.3;
    const blink = cyc < 0.11 || (cyc > 1.9 && cyc < 1.98);
    drawPortrait(this.pCtx, this.face, {
      t,
      expression: this.expression,
      talking: this.typing,
      blink,
    });
  }

  /* ---- beat flow ---------------------------------------------------- */

  _next() {
    this.index++;
    if (this.index >= this.beats.length) {
      this.finish();
      return;
    }
    const beat = this.beats[this.index];

    if (beat.card) {
      this._showCard(beat);
      return;
    }

    const ch = getCharacter(beat.who);
    const changedSpeaker = this.who !== beat.who;
    this.who = beat.who;
    this.face = ch.face;
    this.voice = ch.voice;
    this.expression = beat.expression ?? 'neutral';

    this.nameEl.textContent = ch.name;
    this.titleEl.textContent = ch.title ?? '';
    if (changedSpeaker) {
      this.frameEl.classList.remove('swap');
      void this.frameEl.offsetWidth;
      this.frameEl.classList.add('swap');
    }

    this.choicesEl.innerHTML = '';
    this.advanceEl.classList.add('hidden');
    this._type(beat.text, () => {
      if (beat.choices) this._showChoices(beat.choices);
      else this.advanceEl.classList.remove('hidden');
    });
  }

  _type(text, done) {
    clearTimeout(this._typeTimer);
    this.typing = true;
    this.fullText = text;
    this.textEl.textContent = '';
    let i = 0;
    const step = () => {
      if (!this.active) return;
      if (i >= text.length) {
        this.typing = false;
        done();
        return;
      }
      const c = text[i++];
      this.textEl.textContent += c;
      // one blip every few letters, pitched to the speaker
      if (i % 3 === 0 && c !== ' ') this.game.audio.speakBlip?.(this.voice);
      const delay = CHAR_MS * (this.voice?.rate ?? 1) * (PUNCT_PAUSE[c] ?? 1);
      this._typeTimer = setTimeout(step, delay);
    };
    step();
  }

  _showChoices(choices) {
    this.choicesEl.innerHTML = '';
    choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'dlg-choice';
      b.style.animationDelay = `${i * 70}ms`;
      b.innerHTML = `<span class="dlg-choice-mark">›</span> ${c.label}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.events.emit('sfx', 'ui');
        this._pick(c);
      });
      this.choicesEl.appendChild(b);
    });
  }

  _pick(choice) {
    this.choicesEl.innerHTML = '';
    if (typeof choice.next === 'function') {
      const more = choice.next();
      if (Array.isArray(more)) {
        // splice the branch in after the current beat
        this.beats.splice(this.index + 1, 0, ...more);
      }
    }
    this._next();
  }

  _showCard(beat) {
    this.el.querySelector('.dlg-card').classList.add('hidden');
    this.cardEl.querySelector('h2').textContent = beat.card;
    this.cardEl.querySelector('p').textContent = beat.sub ?? '';
    this.cardEl.classList.remove('hidden');
    this.cardEl.classList.remove('in');
    void this.cardEl.offsetWidth;
    this.cardEl.classList.add('in');
    this.game.events.emit('sfx', 'chapter');
    clearTimeout(this._cardTimer);
    this._cardTimer = setTimeout(() => {
      this.cardEl.classList.add('hidden');
      this.el.querySelector('.dlg-card').classList.remove('hidden');
      this._next();
    }, beat.hold ?? 2400);
  }

  /** Click/space: finish typing first, then move on. */
  _advance() {
    if (!this.active) return;
    if (this.cardEl && !this.cardEl.classList.contains('hidden')) {
      clearTimeout(this._cardTimer);
      this.cardEl.classList.add('hidden');
      this.el.querySelector('.dlg-card').classList.remove('hidden');
      this._next();
      return;
    }
    if (this.typing) {
      clearTimeout(this._typeTimer);
      this.typing = false;
      this.textEl.textContent = this.fullText;
      const beat = this.beats[this.index];
      if (beat.choices) this._showChoices(beat.choices);
      else this.advanceEl.classList.remove('hidden');
      return;
    }
    if (this.choicesEl.children.length) return; // must pick one
    this._next();
  }

  /* ---- barks -------------------------------------------------------- */
  // A bark is one line shouted across the deck: a small live portrait and
  // typed text that slide in at the edge of the screen and leave on their
  // own. Unlike play(), a bark never sets dialoguePaused — freezing the
  // world for a one-line hint is the fastest way to make a tip feel like
  // an interruption instead of a crewmate talking to you.

  /** Queue a non-blocking line. Safe to call during combat. */
  bark(who, expression, text) {
    (this._barkQueue ??= []).push({ who, expression, text });
    if (!this._barkEl) this._nextBark();
  }

  _nextBark() {
    const beat = this._barkQueue?.shift();
    if (!beat) return;
    const ch = getCharacter(beat.who);

    const el = document.createElement('div');
    el.className = 'bark';
    el.innerHTML = `
      <div class="bark-frame"><canvas class="bark-portrait" width="${P}" height="${P}"></canvas></div>
      <div class="bark-body"><span class="bark-name"></span><p class="bark-text"></p></div>`;
    el.querySelector('.bark-name').textContent = ch.name;
    this.uiRoot.appendChild(el);
    this._barkEl = el;

    const ctx = el.querySelector('.bark-portrait').getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const textEl = el.querySelector('.bark-text');

    this._barkTyping = true;
    const loop = (ts) => {
      if (this._barkEl !== el) return;
      const t = ts / 1000;
      const cyc = (t * 0.9) % 4.3;
      drawPortrait(ctx, ch.face, {
        t,
        expression: beat.expression ?? 'neutral',
        talking: this._barkTyping,
        blink: cyc < 0.11 || (cyc > 1.9 && cyc < 1.98),
      });
      this._barkRaf = requestAnimationFrame(loop);
    };
    this._barkRaf = requestAnimationFrame(loop);

    let i = 0;
    const step = () => {
      if (this._barkEl !== el) return;
      if (i >= beat.text.length) {
        this._barkTyping = false;
        // Read time scales with the line, with a floor so short barks
        // do not blink out before the eye reaches them.
        this._barkHold = setTimeout(() => this._endBark(el), 1800 + beat.text.length * 45);
        return;
      }
      const c = beat.text[i++];
      textEl.textContent += c;
      if (i % 3 === 0 && c !== ' ') this.game.audio.speakBlip?.(ch.voice);
      this._barkTimer = setTimeout(step, CHAR_MS * (ch.voice?.rate ?? 1) * (PUNCT_PAUSE[c] ?? 1));
    };
    step();

    // Tapping a bark dismisses it — never make the player wait on a hint.
    el.addEventListener('pointerdown', () => {
      if (this._barkTyping) {
        clearTimeout(this._barkTimer);
        this._barkTyping = false;
        textEl.textContent = beat.text;
        this._barkHold = setTimeout(() => this._endBark(el), 1400);
      } else {
        this._endBark(el);
      }
    });
  }

  _endBark(el) {
    if (this._barkEl !== el) return;
    clearTimeout(this._barkTimer);
    clearTimeout(this._barkHold);
    cancelAnimationFrame(this._barkRaf);
    this._barkEl = null;
    el.classList.add('out');
    setTimeout(() => {
      el.remove();
      this._nextBark();
    }, 260);
  }

  finish(silent = false) {
    if (!this.active) return;
    this.active = false;
    clearTimeout(this._typeTimer);
    clearTimeout(this._cardTimer);
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._key, true);
    this.el?.classList.add('out');
    const el = this.el;
    setTimeout(() => el?.remove(), 260);
    this.el = null;
    this.who = null;
    this.game.dialoguePaused = false;
    this.game._lastTs = performance.now();
    this.game.ads?.setGameplayActive(this.game.state === 'playing');
    if (!silent) this._onDone?.();
    this._onDone = null;
  }
}
