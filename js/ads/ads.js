// Rewarded ads via the CrazyGames SDK.
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
