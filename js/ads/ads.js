// Rewarded and midgame ads via the CrazyGames SDK.
//
// Two kinds of ad live here and they follow different rules.
//
// REWARDED ads are opt-in and always a favour: the player asks for one,
// and gets something they wanted.
//
// MIDGAME ads are the unprompted interstitials CrazyGames expects, and
// their governing rule is that they may only run when gameplay has
// actually stopped. This game has genuine stopping points — docking
// freezes the whole world, and a boarding or dungeon ends on a results
// beat — so midgame ads are attached to those transitions and nowhere
// else. They never fire mid-sail, never during a fight, never on the
// first minute of a session.
//
// Design rules this module enforces, so ads never feel like nagging:
//   1. Every ad is opt-in. Nothing is gated behind one — declining always
//      leaves the player exactly where the game would have put them.
//   2. Offers appear only at moments the player already cares about
//      (losing crew, sinking, a rare haul) or inside menus they opened
//      themselves. We never interrupt sailing.
//   3. Cooldowns per placement plus a global gap, so a bad run can't
//      turn into a wall of offers.
//   4. The reward is stated before the ad, and granted only on the
//      SDK's adFinished. On adError we apologise and grant nothing —
//      per CrazyGames policy — but we also don't apply extra punishment.
//
// When the SDK is absent (local dev, itch.io, a single-file build) the
// manager runs in clearly-labelled simulation mode so the flow stays
// testable; it never pretends a real ad was shown.

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const SDK_WAIT_MS = 4000;

/** Per-placement cooldowns in seconds. */
const COOLDOWNS = {
  saveCrew: 150,
  saveShip: 150,
  rally: 150,
  doubleLoot: 90,
  dailyChart: 0, // naturally capped: one extra chart per day
  freeRepair: 120,
};

/** No two offers within this many seconds, whatever the placement. */
const GLOBAL_GAP = 40;

/* ---- midgame pacing -------------------------------------------------- */
/** Nothing at all until the player has been aboard this long. */
const MIDGAME_GRACE = 180;
/** Minimum gap between two midgame ads. */
const MIDGAME_INTERVAL = 210;
/** Free passes before the first midgame ad, so nobody is greeted by one. */
const MIDGAME_SKIP_FIRST = 2;
/**
 * How long an armed break stays valid. A boarding ends into a chain of
 * result screens the player reads at their own pace; if they linger past
 * this, the moment has gone and we let it go rather than ambushing them
 * on the way back to the helm.
 */
const MIDGAME_ARM_TTL = 45;

/** Told to the player while the ad loads, so the pause is explained. */
const MIDGAME_COPY = {
  break: 'Taking a short break...',
  port: 'Tying up alongside...',
  boarding: 'The fighting is over...',
  dungeon: 'Back to the boats...',
};

export class AdManager {
  constructor(game) {
    this.game = game;
    this.sdk = null;
    this.ready = false;
    this.simulated = false;
    this.showing = false;
    this.uiRoot = game.uiRoot;
    this._lastShown = {}; // placement id -> timestamp (ms)
    this._lastAny = 0;
    this._gameplayActive = false;
    this.el = null;

    // Midgame state. `_breaks` counts the natural stopping points seen so
    // far; the first couple pass without an ad.
    this._sessionStart = Date.now();
    this._lastMidgame = 0;
    this._breaks = 0;
    this._armed = null;
  }

  /* ------------------------------------------------------------------ */
  /* SDK lifecycle                                                       */
  /* ------------------------------------------------------------------ */

  async init() {
    try {
      const sdk = await this._waitForSdk();
      await sdk.init();
      this.sdk = sdk;
      this.ready = true;
      this.simulated = false;
    } catch {
      // No SDK here (local dev, offline, single-file build, blocked by
      // CSP). Keep the feature usable and honest about it.
      this.ready = true;
      this.simulated = true;
    }
  }

  _waitForSdk() {
    return new Promise((resolve, reject) => {
      if (window.CrazyGames?.SDK) {
        resolve(window.CrazyGames.SDK);
        return;
      }
      // The host page supplies the script (see index.html). We only wait
      // for it — injecting it ourselves would trip the Content-Security-
      // Policy on strict hosts and log noise for no benefit.
      if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
        reject(new Error('CrazyGames SDK script not present on the page'));
        return;
      }
      const started = Date.now();
      const poll = setInterval(() => {
        if (window.CrazyGames?.SDK) {
          clearInterval(poll);
          resolve(window.CrazyGames.SDK);
        } else if (Date.now() - started > SDK_WAIT_MS) {
          clearInterval(poll);
          reject(new Error('CrazyGames SDK unavailable'));
        }
      }, 120);
    });
  }

  /** CrazyGames wants to know when the player is actually playing. */
  setGameplayActive(active) {
    if (active === this._gameplayActive) return;
    this._gameplayActive = active;
    if (!this.sdk?.game) return;
    try {
      if (active) this.sdk.game.gameplayStart();
      else this.sdk.game.gameplayStop();
    } catch {
      /* never let telemetry break the game */
    }
  }

  /** Celebration hook for genuine milestones (boss kills, legendaries). */
  happytime() {
    try {
      this.sdk?.game?.happytime();
    } catch {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------ */
  /* Offer gating                                                        */
  /* ------------------------------------------------------------------ */

  canOffer(id) {
    if (!this.ready || this.showing) return false;
    if (this.game.adsDisabled) return false;
    const now = Date.now();
    if (now - this._lastAny < GLOBAL_GAP * 1000) return false;
    const cd = (COOLDOWNS[id] ?? 60) * 1000;
    return now - (this._lastShown[id] ?? -Infinity) >= cd;
  }

  _markShown(id) {
    const now = Date.now();
    this._lastShown[id] = now;
    this._lastAny = now;
  }

  /* ------------------------------------------------------------------ */
  /* Playing an ad                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Play a rewarded ad. Resolves true only when the SDK reports the ad
   * finished (i.e. the player earned it).
   */
  play(id) {
    if (this.showing) return Promise.resolve(false);
    this.showing = true;
    this._markShown(id);
    const wasPlaying = this.game.state === 'playing';
    if (wasPlaying) this.game.state = 'adbreak';
    this.setGameplayActive(false);

    return new Promise((resolve) => {
      const finish = (rewarded, message) => {
        this._hideCurtain();
        this.game.audio.setMuted(false);
        if (wasPlaying) this.game.state = 'playing';
        this.game._lastTs = performance.now(); // don't bank a huge dt
        this.setGameplayActive(this.game.state === 'playing');
        this.showing = false;
        if (message) this.game.hud.toast(message, rewarded ? '#6fce62' : '#e0b345');
        resolve(rewarded);
      };

      if (this.simulated) {
        this._simulate(() => finish(true));
        return;
      }

      this._showCurtain('Your reward is on its way...');
      try {
        this.sdk.ad.requestAd('rewarded', {
          adStarted: () => {
            // Mute only once the ad actually starts, per CrazyGames.
            this.game.audio.setMuted(true);
            this._showCurtain('Advertisement playing...');
          },
          adFinished: () => finish(true),
          adError: (err) => {
            const unfilled = err?.code === 'unfilled';
            finish(false, unfilled
              ? 'No ad available right now — try again shortly.'
              : 'The ad could not be shown. No reward this time.');
          },
        });
      } catch {
        finish(false, 'The ad could not be shown. No reward this time.');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Midgame ads                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Is this a legitimate moment for an interstitial?
   *
   * CrazyGames' hard requirement is that midgame ads run only when
   * gameplay has stopped, so this refuses unless the game itself says it
   * is not playing — the same flag that drives gameplayStart/Stop. The
   * rest is pacing: a grace period so a new session is never greeted by
   * an ad, a couple of free breaks, and a floor on how often one can run.
   */
  canShowMidgame() {
    if (!this.ready || this.showing || this.game.adsDisabled) return false;
    // Never on top of a rewarded offer, or while one is playing.
    if (this.el) return false;
    // Gameplay must genuinely have stopped.
    if (this._gameplayActive) return false;
    const now = Date.now();
    if (now - this._sessionStart < MIDGAME_GRACE * 1000) return false;
    if (now - this._lastMidgame < MIDGAME_INTERVAL * 1000) return false;
    if (now - this._lastAny < GLOBAL_GAP * 1000) return false;
    return true;
  }

  /**
   * Offer a break at a natural stopping point. `reason` is only used for
   * the wording on the curtain, so the player knows why the game paused.
   *
   * Returns a promise that resolves when play may resume — whether an ad
   * ran, was skipped, or failed. Callers can await it, but nothing in the
   * game does: the stopping points this hangs off are already stopped.
   */
  async midgame(reason = 'break') {
    this._breaks++;
    if (this._breaks <= MIDGAME_SKIP_FIRST) return false;
    if (!this.canShowMidgame()) return false;

    this.showing = true;
    this._lastMidgame = Date.now();
    this._lastAny = this._lastMidgame;
    const wasPlaying = this.game.state === 'playing';
    if (wasPlaying) this.game.state = 'adbreak';
    // Belt and braces: the caller should already have stopped gameplay,
    // but the SDK must not see an ad requested while it thinks we play.
    this.setGameplayActive(false);

    return new Promise((resolve) => {
      const finish = () => {
        this._hideCurtain();
        this.game.audio.setMuted(false);
        if (wasPlaying) this.game.state = 'playing';
        this.game._lastTs = performance.now(); // don't bank a huge dt
        this.setGameplayActive(this.game.state === 'playing' && !this.game.uiBlocked);
        this.showing = false;
        this.game.events.emit('ad:midgame-done', { reason });
        resolve(true);
      };

      if (this.simulated) {
        this._simulateMidgame(finish);
        return;
      }

      this._showCurtain(MIDGAME_COPY[reason] ?? MIDGAME_COPY.break);
      try {
        this.sdk.ad.requestAd('midgame', {
          adStarted: () => {
            // Mute only once the ad actually starts, per CrazyGames.
            this.game.audio.setMuted(true);
            this._showCurtain('Advertisement');
          },
          adFinished: finish,
          // A midgame ad that cannot be filled is a non-event: no reward
          // was promised, so the player is simply waved through.
          adError: finish,
        });
      } catch {
        finish();
      }
    });
  }

  /**
   * Mark a stopping point that hasn't finished resolving yet.
   *
   * A boarding does not end cleanly: it ends into a captured-hold screen,
   * then possibly a rewarded offer to save the fallen, then a freed
   * prisoner asking to sign on. Firing an interstitial into the middle of
   * that would bury a rewarded offer the player wanted, so the break is
   * armed here and spent by `tickArmed` once the deck is clear.
   */
  armMidgame(reason = 'break') {
    if (this._armed) return;
    this._armed = { reason, at: Date.now() };
  }

  /**
   * Spend an armed break the moment nothing is on screen. Called from the
   * game loop *before* it reports gameplay as resumed, so the SDK is never
   * asked for an ad while it believes the player is sailing.
   */
  tickArmed() {
    const armed = this._armed;
    if (!armed) return;
    // Result screens and rewarded offers own the moment first.
    if (this.showing || this.el || this.game.uiBlocked) return;
    this._armed = null;
    if (Date.now() - armed.at > MIDGAME_ARM_TTL * 1000) return;
    this.setGameplayActive(false);
    this.midgame(armed.reason);
  }

  /** Dev/offline stand-in for an interstitial. */
  _simulateMidgame(done) {
    let left = 2;
    const paint = () => this._showCurtain(
      `<b>Simulated midgame ad</b><br><span class="ad-sim-note">CrazyGames SDK not detected — a real interstitial would play here.</span><br>Resuming in ${left}s`,
    );
    paint();
    const iv = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(iv);
        done();
      } else {
        paint();
      }
    }, 1000);
  }

  /** Blocking curtain so nothing is clickable behind a playing ad. */
  _showCurtain(text) {
    if (!this.curtain) {
      this.curtain = document.createElement('div');
      this.curtain.className = 'ad-curtain';
      this.uiRoot.appendChild(this.curtain);
    }
    this.curtain.innerHTML = `<div class="ad-curtain-inner">
      <div class="ad-spinner"></div><p>${text}</p></div>`;
    this.curtain.classList.remove('hidden');
  }

  _hideCurtain() {
    this.curtain?.classList.add('hidden');
  }

  /** Dev/offline stand-in. Explicitly labelled — never a fake ad. */
  _simulate(done) {
    let left = 3;
    const paint = () => {
      this._showCurtain(
        `<b>Simulated ad</b><br><span class="ad-sim-note">CrazyGames SDK not detected — this stands in for a real rewarded ad.</span><br>Reward in ${left}s`,
      );
    };
    paint();
    const iv = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(iv);
        done();
      } else {
        paint();
      }
    }, 1000);
  }

  /* ------------------------------------------------------------------ */
  /* The offer modal                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Present a rewarded-ad offer.
   * opts: { id, icon, title, body, reward, accept, decline, declineLabel }
   * `decline` runs when the player says no OR the ad fails, so the
   * normal (un-rewarded) outcome always happens exactly once.
   */
  offer(opts) {
    if (!this.canOffer(opts.id)) {
      opts.decline?.();
      return;
    }
    this._closeOffer();
    const el = document.createElement('div');
    el.className = 'screen modal-screen';
    el.innerHTML = `
      <div class="modal ad-offer">
        <div class="ad-badge">${this.simulated ? 'Rewarded Ad (simulated)' : 'Rewarded Ad'}</div>
        <div class="ad-icon">${opts.icon ?? '🎁'}</div>
        <h3>${opts.title}</h3>
        <p class="ad-body">${opts.body}</p>
        <div class="ad-reward"><span>You get</span><b>${opts.reward}</b></div>
        <div class="modal-btns">
          <button class="btn btn-primary ad-yes">Watch &amp; Claim</button>
          <button class="btn btn-ghost ad-no">${opts.declineLabel ?? 'No thanks'}</button>
        </div>
      </div>`;
    this.uiRoot.appendChild(el);
    this.el = el;
    this.game.events.emit('sfx', 'ui');

    let settled = false;
    const settle = (accepted) => {
      if (settled) return;
      settled = true;
      this._closeOffer();
      if (!accepted) {
        opts.decline?.();
        return;
      }
      this.play(opts.id).then((rewarded) => {
        if (rewarded) opts.accept?.();
        else opts.decline?.();
      });
    };
    el.querySelector('.ad-yes').addEventListener('click', () => settle(true));
    el.querySelector('.ad-no').addEventListener('click', () => settle(false));
  }

  _closeOffer() {
    this.el?.remove();
    this.el = null;
  }

  get isOpen() {
    return !!this.el || this.showing;
  }

  /** Inline button helper for offers embedded in existing panels. */
  button(id, label, onReward) {
    const disabled = !this.canOffer(id);
    const btn = document.createElement('button');
    btn.className = 'mini-btn ad-inline-btn';
    btn.innerHTML = `<span class="ad-play">▶</span> ${label}`;
    btn.disabled = disabled;
    if (disabled) btn.title = 'Available again shortly';
    btn.addEventListener('click', () => {
      btn.disabled = true;
      this.play(id).then((rewarded) => {
        if (rewarded) onReward();
      });
    });
    return btn;
  }
}
